#!/usr/bin/env node
/**
 * Max ↔ GigaChat Bridge
 *
 * Standalone скрипт: long-polling из Max → GigaChat completion → ответ в Max.
 * Запуск: node scripts/bridge.mjs
 *
 * Env:
 *   MAX_BOT_TOKEN — токен бота Max
 *   GIGACHAT_AUTH_KEY — Base64(client_id:client_secret)
 *   GIGACHAT_MODEL — модель (по умолчанию GigaChat-2-Max)
 *   GIGACHAT_SCOPE — scope (по умолчанию GIGACHAT_API_PERS)
 */

import { randomUUID } from "crypto";

// ─── Config ───

const MAX_TOKEN = process.env.MAX_BOT_TOKEN;
const GIGACHAT_AUTH = process.env.GIGACHAT_AUTH_KEY;
const GIGACHAT_MODEL = process.env.GIGACHAT_MODEL || "GigaChat-2-Max";
const GIGACHAT_SCOPE = process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS";

const MAX_API = "https://platform-api.max.ru";
const GIGACHAT_OAUTH = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const GIGACHAT_API = "https://gigachat.devices.sberbank.ru/api/v1";

if (!MAX_TOKEN || !GIGACHAT_AUTH) {
  console.error("Required env: MAX_BOT_TOKEN, GIGACHAT_AUTH_KEY");
  process.exit(1);
}

// ─── GigaChat OAuth2 Token Cache ───

let gcToken = null;
let gcTokenExpiresAt = 0;

async function getGigaChatToken() {
  if (gcToken && Date.now() < gcTokenExpiresAt - 60_000) {
    return gcToken;
  }

  const res = await fetch(GIGACHAT_OAUTH, {
    method: "POST",
    headers: {
      Authorization: `Basic ${GIGACHAT_AUTH}`,
      "Content-Type": "application/x-www-form-urlencoded",
      RqUID: randomUUID(),
    },
    body: `scope=${GIGACHAT_SCOPE}`,
  });

  if (!res.ok) {
    throw new Error(`GigaChat OAuth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  gcToken = data.access_token;
  gcTokenExpiresAt = data.expires_at;
  console.log("[gigachat] Token refreshed, expires:", new Date(gcTokenExpiresAt).toISOString());
  return gcToken;
}

// ─── GigaChat Completion ───

// Simple per-chat history (last N messages)
const chatHistory = new Map();
const MAX_HISTORY = 10;

const SYSTEM_PROMPT = `Ты — OpenClaw Bot, AI-ассистент в мессенджере Max. Отвечай коротко и по делу на русском языке. Если не знаешь ответ — скажи честно.`;

async function askGigaChat(chatId, userText) {
  const token = await getGigaChatToken();

  // Get or create chat history
  if (!chatHistory.has(chatId)) {
    chatHistory.set(chatId, []);
  }
  const history = chatHistory.get(chatId);

  // Add user message
  history.push({ role: "user", content: userText });

  // Trim history
  while (history.length > MAX_HISTORY) {
    history.shift();
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
  ];

  const res = await fetch(`${GIGACHAT_API}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GIGACHAT_MODEL,
      messages,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    // If 401, invalidate token and retry once
    if (res.status === 401) {
      gcToken = null;
      return askGigaChat(chatId, userText);
    }
    throw new Error(`GigaChat error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || "(пустой ответ)";

  // Add assistant reply to history
  history.push({ role: "assistant", content: reply });

  console.log(`[gigachat] ${GIGACHAT_MODEL} → ${data.usage?.total_tokens || "?"} tokens`);
  return reply;
}

// ─── Max API ───

async function maxApi(method, path, body, queryParams) {
  const url = new URL(path, MAX_API);
  // Query params (chat_id etc.)
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const opts = {
    method,
    headers: {
      Authorization: MAX_TOKEN,
    },
  };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Max API ${method} ${path}: ${res.status} ${err}`);
  }

  const ct = res.headers.get("content-type");
  return ct?.includes("json") ? res.json() : null;
}

async function sendTyping(chatId) {
  try {
    await maxApi("POST", "/chats/actions", { action: "typing_on" }, { chat_id: chatId });
  } catch { /* non-critical */ }
}

async function sendMessage(chatId, text, replyTo) {
  // Max text limit ~4000 chars
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= 4000) {
      chunks.push(remaining);
      break;
    }
    let breakAt = remaining.lastIndexOf("\n", 4000);
    if (breakAt < 2000) breakAt = remaining.lastIndexOf(" ", 4000);
    if (breakAt < 1000) breakAt = 4000;
    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }

  for (let i = 0; i < chunks.length; i++) {
    const body = {
      text: chunks[i],
      format: "markdown",
    };
    if (i === 0 && replyTo) {
      body.link = { type: "reply", mid: replyTo };
    }
    await maxApi("POST", "/messages", body, { chat_id: chatId });
  }
}

// ─── Message Handler ───

async function handleUpdate(update) {
  // Handle new messages
  if (update.update_type === "message_created" && update.message) {
    const msg = update.message;
    const text = msg.body?.text;
    const chatId = msg.recipient?.chat_id;
    const sender = msg.sender;
    const mid = msg.body?.mid;

    if (!text || !chatId || sender?.is_bot) return;

    console.log(`[max] ${sender.name}: ${text.slice(0, 80)}`);

    // Send typing indicator
    await sendTyping(chatId);

    try {
      const reply = await askGigaChat(String(chatId), text);
      await sendMessage(chatId, reply, mid);
      console.log(`[max] → ответ отправлен (${reply.length} chars)`);
    } catch (err) {
      console.error("[bridge] Error:", err.message);
      await sendMessage(chatId, `Ошибка: ${err.message}`, mid);
    }
  }

  // Handle /start
  if (update.update_type === "bot_started" && update.chat_id) {
    await sendMessage(update.chat_id, "Привет! Я OpenClaw Bot — AI-ассистент на базе GigaChat. Напиши мне что-нибудь :)");
    console.log(`[max] /start от user ${update.user?.name} в чате ${update.chat_id}`);
  }
}

// ─── Long-Polling Loop ───

async function poll() {
  // Verify bot
  const me = await maxApi("GET", "/me");
  console.log(`\n[bridge] Bot: ${me.name} (@${me.username})`);
  console.log(`[bridge] Model: ${GIGACHAT_MODEL}`);
  console.log(`[bridge] Polling for messages...\n`);

  // Delete any existing webhook
  try { await maxApi("DELETE", "/subscriptions"); } catch { /* ok */ }

  let marker = undefined;
  let backoff = 1000;

  while (true) {
    try {
      const url = new URL("/updates", MAX_API);
      url.searchParams.set("timeout", "25");
      if (marker) url.searchParams.set("marker", String(marker));

      const res = await fetch(url, {
        headers: { Authorization: MAX_TOKEN },
      });
      if (!res.ok) throw new Error(`Polling error: ${res.status}`);
      const data = await res.json();

      backoff = 1000;
      if (data.marker) marker = data.marker;

      if (data.updates?.length) {
        for (const upd of data.updates) {
          await handleUpdate(upd);
        }
      }
    } catch (err) {
      console.error(`[poll] ${err.message}, retry in ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, 30_000);
    }
  }
}

// ─── Start ───

// Bypass Sber TLS (self-signed cert)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

poll().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});

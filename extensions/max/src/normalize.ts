/**
 * Normalize Max messages ↔ OpenClaw internal format.
 *
 * Converts incoming Max updates to OpenClaw thread messages
 * and outgoing OpenClaw payloads to Max API format.
 */

import type { MaxMessage, MaxUpdate, MaxAttachment } from "./types.js";

/** Minimal OpenClaw-compatible inbound message shape. */
export interface NormalizedInboundMessage {
  channelId: "max";
  externalId: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  replyToId?: string;
  attachments?: NormalizedAttachment[];
  isCallback?: boolean;
  callbackData?: string;
  callbackId?: string;
}

export interface NormalizedAttachment {
  type: "image" | "video" | "audio" | "file";
  url?: string;
  caption?: string;
}

/**
 * Convert a Max update to a normalized inbound message.
 */
export function normalizeInbound(update: MaxUpdate): NormalizedInboundMessage | null {
  if (update.update_type === "message_created" && update.message) {
    return normalizeMessage(update.message);
  }

  if (update.update_type === "message_callback" && update.callback) {
    const cb = update.callback;
    return {
      channelId: "max",
      externalId: cb.callback_id,
      chatId: String(cb.message?.recipient?.chat_id || update.chat_id || 0),
      senderId: String(cb.user.user_id),
      senderName: cb.user.name,
      text: cb.payload || "",
      timestamp: cb.timestamp,
      isCallback: true,
      callbackData: cb.payload,
      callbackId: cb.callback_id,
    };
  }

  if (update.update_type === "bot_started" && update.user && update.chat_id) {
    return {
      channelId: "max",
      externalId: `bot_started_${update.chat_id}_${update.timestamp}`,
      chatId: String(update.chat_id),
      senderId: String(update.user.user_id),
      senderName: update.user.name,
      text: "/start",
      timestamp: update.timestamp,
    };
  }

  // Other update types (message_edited, user_added, etc.) — skip for now
  return null;
}

function normalizeMessage(msg: MaxMessage): NormalizedInboundMessage | null {
  if (!msg.sender || !msg.recipient) return null;

  const attachments: NormalizedAttachment[] = [];
  if (msg.body.attachments) {
    for (const att of msg.body.attachments) {
      const normalized = normalizeAttachment(att);
      if (normalized) attachments.push(normalized);
    }
  }

  return {
    channelId: "max",
    externalId: msg.body.mid,
    chatId: String(msg.recipient.chat_id),
    senderId: String(msg.sender.user_id),
    senderName: msg.sender.name,
    text: msg.body.text || "",
    timestamp: msg.timestamp,
    replyToId: msg.link?.type === "reply" ? msg.link.mid : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

function normalizeAttachment(att: MaxAttachment): NormalizedAttachment | null {
  switch (att.type) {
    case "image":
    case "video":
    case "audio":
    case "file":
      return {
        type: att.type,
        url: att.payload?.url,
        caption: att.payload?.caption,
      };
    default:
      return null;
  }
}

/**
 * Convert markdown text to Max-compatible format.
 * Max supports a subset of markdown.
 */
export function formatTextForMax(text: string): string {
  // Max supports basic markdown: *bold*, _italic_, `code`, ```pre```
  // OpenClaw outputs markdown-compatible text, so minimal conversion needed
  return text;
}

/**
 * Split long text into chunks respecting Max message limits.
 * Max text limit: ~4000 characters (similar to Telegram).
 */
export function chunkText(text: string, limit: number = 4000): string[] {
  if (text.length <= limit) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    // Try to break at newline
    let breakAt = remaining.lastIndexOf("\n", limit);
    if (breakAt < limit * 0.5) {
      // Newline too far back, try space
      breakAt = remaining.lastIndexOf(" ", limit);
    }
    if (breakAt < limit * 0.3) {
      // No good break point, force break
      breakAt = limit;
    }

    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }

  return chunks;
}

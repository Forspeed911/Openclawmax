/**
 * Max Channel Plugin — ChannelPlugin implementation.
 *
 * Follows the exact same contract as extensions/telegram/src/channel.ts.
 * Implements: meta, capabilities, config, outbound, gateway, status, setup.
 */

import { MaxBotApi } from "./max-api.ts";
import { monitorMaxChannel } from "./monitor.ts";
import { sendTextToMax, sendMediaToMax, sendTypingToMax } from "./outbound-adapter.ts";
import { getMaxRuntime } from "./runtime.ts";

// ─── Types ───

const DEFAULT_ACCOUNT_ID = "default";

interface ResolvedMaxAccount {
  accountId: string;
  token: string;
  tokenSource: "config" | "env" | "none";
  enabled: boolean;
  name: string;
  config: {
    webhookUrl?: string;
  };
}

interface MaxProbe {
  ok: boolean;
  bot?: {
    userId: number;
    username: string;
    name: string;
  };
  error?: string;
}

// ─── Helpers ───

function resolveMaxAccount(cfg: any, accountId?: string | null): ResolvedMaxAccount {
  const id = accountId || DEFAULT_ACCOUNT_ID;
  const maxCfg = cfg?.channels?.max;

  const configToken = maxCfg?.botToken ?? maxCfg?.accounts?.[id]?.botToken ?? "";
  const envToken = process.env.MAX_BOT_TOKEN ?? "";
  const token = configToken || (id === DEFAULT_ACCOUNT_ID ? envToken : "");
  const tokenSource: "config" | "env" | "none" = configToken
    ? "config"
    : token
      ? "env"
      : "none";

  return {
    accountId: id,
    token: token.trim(),
    tokenSource,
    enabled: maxCfg?.enabled !== false,
    name: maxCfg?.accounts?.[id]?.name ?? maxCfg?.name ?? "Max Bot",
    config: {
      webhookUrl: maxCfg?.webhookUrl ?? maxCfg?.accounts?.[id]?.webhookUrl,
    },
  };
}

function listMaxAccountIds(cfg: any): string[] {
  const maxCfg = cfg?.channels?.max;
  if (!maxCfg) return [];

  const ids = new Set<string>();

  if (maxCfg.botToken || process.env.MAX_BOT_TOKEN) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }

  if (maxCfg.accounts) {
    for (const id of Object.keys(maxCfg.accounts)) {
      if (maxCfg.accounts[id]?.botToken) {
        ids.add(id);
      }
    }
  }

  return Array.from(ids);
}

// ─── Channel Meta (matches ChannelMeta interface) ───

const maxMeta = {
  id: "max" as const,
  label: "Max",
  selectionLabel: "Max (VK)",
  docsPath: "/channels/max",
  blurb: "Max messenger by VK — Russian national messenger (70M+ users)",
  aliases: ["max-messenger", "vk-max"],
  showConfigured: true,
};

// ─── Channel Capabilities (matches ChannelCapabilities interface) ───

const maxCapabilities = {
  chatTypes: ["direct" as const],
  media: true,
  edit: true,
  reply: true,
  reactions: false,
  threads: false,
  polls: false,
  nativeCommands: false,
  blockStreaming: true,
};

// ─── Outbound helper ───

async function sendMaxOutbound(params: {
  cfg: any;
  to: string;
  text: string;
  mediaUrl?: string | null;
  accountId?: string | null;
  replyToId?: string | null;
}) {
  const account = resolveMaxAccount(params.cfg, params.accountId);
  if (!account.token) throw new Error("Max bot token not configured");

  if (params.mediaUrl) {
    const messageId = await sendMediaToMax({
      token: account.token,
      chatId: Number(params.to),
      mediaUrl: params.mediaUrl,
      mediaType: "image",
      caption: params.text || undefined,
    });
    return { channel: "max", messageIds: [messageId] };
  }

  const messageIds = await sendTextToMax({
    token: account.token,
    chatId: Number(params.to),
    text: params.text,
    replyToMessageId: params.replyToId || undefined,
  });
  return { channel: "max", messageIds };
}

// ─── Fallback text chunker ───

function fallbackChunkText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    let breakAt = remaining.lastIndexOf("\n", limit);
    if (breakAt < limit * 0.5) breakAt = remaining.lastIndexOf(" ", limit);
    if (breakAt < limit * 0.3) breakAt = limit;
    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  return chunks;
}

// ─── The Plugin ───

export const maxPlugin = {
  id: "max" as const,
  meta: maxMeta,
  capabilities: maxCapabilities,

  reload: { configPrefixes: ["channels.max"] },
  defaults: { queue: { debounceMs: 500 } },

  // ─── Config Adapter (ChannelConfigAdapter) ───
  config: {
    listAccountIds: (cfg: any): string[] => listMaxAccountIds(cfg),
    resolveAccount: (cfg: any, accountId?: string | null): ResolvedMaxAccount =>
      resolveMaxAccount(cfg, accountId),
    defaultAccountId: (_cfg: any) => DEFAULT_ACCOUNT_ID,
    isEnabled: (account: ResolvedMaxAccount, _cfg: any): boolean => account.enabled,
    isConfigured: (account: ResolvedMaxAccount, _cfg: any): boolean => !!account.token?.trim(),
    unconfiguredReason: (account: ResolvedMaxAccount, _cfg: any): string => {
      if (!account.token?.trim()) return "Bot token not configured";
      return "not configured";
    },
    describeAccount: (account: ResolvedMaxAccount, _cfg: any) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: !!account.token?.trim(),
      tokenSource: account.tokenSource,
    }),
  },

  // ─── Setup Adapter (ChannelSetupAdapter) ───
  setup: {
    resolveAccountId: ({ accountId }: { accountId: string }) =>
      accountId || DEFAULT_ACCOUNT_ID,

    validateInput: ({ input }: { accountId: string; input: any }) => {
      if (!input.useEnv && !input.token) {
        return "Max requires a bot token (or --use-env for MAX_BOT_TOKEN).";
      }
      return null;
    },

    applyAccountConfig: ({ cfg, accountId, input }: { cfg: any; accountId: string; input: any }) => {
      const next = { ...cfg };
      if (accountId === DEFAULT_ACCOUNT_ID) {
        next.channels = {
          ...next.channels,
          max: {
            ...next.channels?.max,
            enabled: true,
            ...(input.useEnv ? {} : input.token ? { botToken: input.token } : {}),
          },
        };
      } else {
        next.channels = {
          ...next.channels,
          max: {
            ...next.channels?.max,
            enabled: true,
            accounts: {
              ...next.channels?.max?.accounts,
              [accountId]: {
                ...next.channels?.max?.accounts?.[accountId],
                enabled: true,
                ...(input.token ? { botToken: input.token } : {}),
              },
            },
          },
        };
      }
      return next;
    },
  },

  // ─── Outbound Adapter (ChannelOutboundAdapter) ───
  outbound: {
    deliveryMode: "direct" as const,
    chunkerMode: "markdown" as const,
    textChunkLimit: 4000,

    chunker: (text: string, limit: number) => {
      try {
        return getMaxRuntime().channel.text.chunkMarkdownText(text, limit);
      } catch {
        return fallbackChunkText(text, limit);
      }
    },

    sendText: async (ctx: any) => {
      return sendMaxOutbound({
        cfg: ctx.cfg,
        to: ctx.to,
        text: ctx.text,
        accountId: ctx.accountId,
        replyToId: ctx.replyToId,
      });
    },

    sendMedia: async (ctx: any) => {
      return sendMaxOutbound({
        cfg: ctx.cfg,
        to: ctx.to,
        text: ctx.text,
        mediaUrl: ctx.mediaUrl,
        accountId: ctx.accountId,
        replyToId: ctx.replyToId,
      });
    },

    sendPayload: async (ctx: any) => {
      const text = ctx.payload?.text ?? ctx.payload?.body ?? "";
      const mediaUrl = ctx.payload?.mediaUrl ?? null;
      return sendMaxOutbound({
        cfg: ctx.cfg,
        to: ctx.to,
        text,
        mediaUrl,
        accountId: ctx.accountId,
        replyToId: ctx.replyToId,
      });
    },
  },

  // ─── Status Adapter (ChannelStatusAdapter) ───
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },

    probeAccount: async ({ account, timeoutMs }: {
      account: ResolvedMaxAccount;
      timeoutMs: number;
    }): Promise<MaxProbe> => {
      try {
        const api = new MaxBotApi(account.token);
        const timer = setTimeout(() => {}, timeoutMs);
        const me = await api.getMe();
        clearTimeout(timer);
        return {
          ok: true,
          bot: { userId: me.user_id, username: me.username, name: me.name },
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Connection failed",
        };
      }
    },

    buildAccountSnapshot: ({ account, runtime, probe }: {
      account: ResolvedMaxAccount;
      cfg: any;
      runtime?: any;
      probe?: MaxProbe;
    }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: !!account.token?.trim(),
      tokenSource: account.tokenSource,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      mode: account.config.webhookUrl ? "webhook" : "polling",
      probe,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),

    buildChannelSummary: ({ snapshot }: { snapshot: any }) => {
      const summary: Record<string, unknown> = {};
      if (snapshot.probe?.ok && snapshot.probe.bot) {
        summary.bot = `@${snapshot.probe.bot.username}`;
      }
      summary.mode = snapshot.mode ?? "polling";
      summary.running = snapshot.running ?? false;
      return summary;
    },
  },

  // ─── Gateway Adapter (ChannelGatewayAdapter) ───
  gateway: {
    startAccount: async (ctx: any) => {
      const account: ResolvedMaxAccount = ctx.account;
      const token = (account.token ?? "").trim();

      if (!token) {
        ctx.log?.error?.(`[max] [${account.accountId}] no bot token configured`);
        throw new Error("Max bot token not configured");
      }

      // Probe bot on start
      let botLabel = "";
      try {
        const api = new MaxBotApi(token);
        const me = await api.getMe();
        botLabel = ` (@${me.username})`;
      } catch (err) {
        ctx.log?.debug?.(`[max] [${account.accountId}] probe failed: ${String(err)}`);
      }

      ctx.log?.info(`[max] [${account.accountId}] starting provider${botLabel}`);

      return monitorMaxChannel({
        token,
        signal: ctx.abortSignal,

        onConnected: () => {
          ctx.log?.info?.(`[max] [${account.accountId}] connected${botLabel}`);
        },

        onError: (err: Error) => {
          ctx.log?.error?.(`[max] [${account.accountId}] error: ${err.message}`);
        },

        onMessage: async (msg) => {
          if (!msg.text && !msg.attachments?.length) return;

          const channelRt = ctx.channelRuntime;
          if (!channelRt) {
            ctx.log?.error?.(`[max] [${account.accountId}] channelRuntime unavailable`);
            return;
          }

          const fromKey = `max:${msg.senderId}`;
          const sessionKey = `max:${msg.chatId}`;

          const msgCtx = channelRt.reply.finalizeInboundContext({
            Body: msg.text,
            RawBody: msg.text,
            CommandBody: msg.text,
            From: fromKey,
            To: fromKey,
            SessionKey: sessionKey,
            AccountId: account.accountId,
            Provider: "max",
            Surface: "max",
            OriginatingChannel: "max",
            OriginatingTo: fromKey,
            ChatType: "direct",
            SenderName: msg.senderName || String(msg.senderId),
            SenderId: String(msg.senderId),
            ConversationLabel: msg.senderName || String(msg.senderId),
            MessageSid: msg.externalId,
            ReplyToId: msg.replyToId,
            Timestamp: msg.timestamp || Date.now(),
            CommandAuthorized: false,
          });

          await channelRt.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: msgCtx,
            cfg: ctx.cfg,
            dispatcherOptions: {
              deliver: async (payload: any) => {
                const text = payload?.text ?? payload?.body ?? "";
                const mediaUrl = payload?.mediaUrl ?? null;

                if (mediaUrl) {
                  await sendMediaToMax({
                    token,
                    chatId: Number(msg.chatId),
                    mediaUrl,
                    mediaType: "image",
                    caption: text || undefined,
                  });
                } else if (text) {
                  await sendTextToMax({
                    token,
                    chatId: Number(msg.chatId),
                    text,
                    replyToMessageId: msg.externalId,
                  });
                }
              },
              typingCallbacks: {
                start: async () => {
                  try {
                    await sendTypingToMax(token, Number(msg.chatId));
                  } catch { /* ignore typing errors */ }
                },
              },
            },
          });
        },
      });
    },

    logoutAccount: async ({ accountId, cfg }: { accountId: string; cfg: any }) => {
      const nextCfg = { ...cfg };
      let cleared = false;

      const maxCfg = cfg.channels?.max;
      if (maxCfg) {
        const nextMax = { ...maxCfg };

        if (accountId === DEFAULT_ACCOUNT_ID && nextMax.botToken) {
          delete nextMax.botToken;
          cleared = true;
        }

        if (nextMax.accounts?.[accountId]) {
          const nextAccounts = { ...nextMax.accounts };
          delete nextAccounts[accountId];
          nextMax.accounts = Object.keys(nextAccounts).length > 0 ? nextAccounts : undefined;
          cleared = true;
        }

        nextCfg.channels = { ...nextCfg.channels, max: nextMax };
      }

      const envToken = process.env.MAX_BOT_TOKEN?.trim() ?? "";
      const resolved = resolveMaxAccount(cleared ? nextCfg : cfg, accountId);

      return { cleared, envToken: Boolean(envToken), loggedOut: resolved.tokenSource === "none" };
    },
  },
};

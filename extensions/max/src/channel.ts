/**
 * Max Channel Plugin — main ChannelPlugin implementation.
 *
 * Follows the same contract as Telegram/Discord/WhatsApp channels.
 * Implements: config, outbound, gateway, setup wizard.
 */

import { MaxBotApi } from "./max-api.ts";
import { monitorMaxChannel } from "./monitor.ts";
import { sendTextToMax, sendTypingToMax, chunkText } from "./outbound-adapter.ts";
import { formatTextForMax } from "./normalize.ts";

/**
 * Channel metadata.
 */
export const maxChannelMeta = {
  id: "max" as const,
  label: "Max",
  icon: "max",
  description: "Мессенджер Max от VK — национальный российский мессенджер",
  website: "https://max.ru",
  helpUrl: "https://dev.max.ru/docs-api",
};

/**
 * Channel capabilities.
 */
export const maxChannelCapabilities = {
  /** Max supports inline keyboards */
  inlineButtons: true,
  /** Max supports message editing */
  editMessage: true,
  /** Max supports message deletion */
  deleteMessage: true,
  /** Max supports typing indicators */
  typing: true,
  /** Max supports media: images, video, audio, files */
  media: true,
  /** Max supports reply-to (message linking) */
  reply: true,
  /** Max does NOT support reactions (as of March 2026) */
  reactions: false,
  /** Max does NOT support threads (as of March 2026) */
  threads: false,
};

/**
 * Setup wizard for Max channel.
 * Prompts user for Bot Token during onboarding.
 */
export const maxSetupWizard = {
  channel: "max" as const,
  status: {
    configuredLabel: "Max Bot connected",
    unconfiguredLabel: "Max Bot not configured",
    resolveConfigured: (ctx: { config: Record<string, unknown> }) => {
      return !!(ctx.config?.["maxBotToken"] || process.env.MAX_BOT_TOKEN);
    },
  },
  credentials: [
    {
      inputKey: "token",
      credentialLabel: "Max Bot Token",
      preferredEnvVar: "MAX_BOT_TOKEN",
      helpTitle: "Max Bot Token",
      helpLines: [
        "1. Откройте dev.max.ru",
        "2. Создайте бота",
        "3. Скопируйте Bot Token",
        "Доступ к API: только для юрлиц и ИП — резидентов РФ",
      ],
      envPrompt: "MAX_BOT_TOKEN environment variable detected. Use it?",
      keepPrompt: "Keep existing Max Bot Token?",
      inputPrompt: "Enter Max Bot Token:",
      allowEnv: () => true,
      inspect: async (ctx: { value: string }) => {
        try {
          const api = new MaxBotApi(ctx.value);
          const me = await api.getMe();
          return {
            ok: true,
            label: `@${me.username} (${me.name})`,
          };
        } catch {
          return {
            ok: false,
            error: "Invalid Bot Token — could not connect to Max API",
          };
        }
      },
    },
  ],
};

/**
 * Build the full ChannelPlugin object.
 *
 * This is the main export that OpenClaw loads.
 * Implements the same interface as Telegram/Discord channels.
 */
export function buildMaxChannelPlugin() {
  return {
    id: "max" as const,
    meta: maxChannelMeta,
    capabilities: maxChannelCapabilities,
    setupWizard: maxSetupWizard,

    defaults: {
      queue: { debounceMs: 500 },
    },

    config: {
      /**
       * List available account IDs.
       * For Max we support a single "default" account.
       */
      listAccountIds: (cfg: any): string[] => {
        const token =
          cfg?.channels?.max?.botToken ||
          process.env.MAX_BOT_TOKEN;
        return token ? ["default"] : [];
      },

      /**
       * Resolve account details by ID.
       */
      resolveAccount: (cfg: any, accountId?: string | null) => {
        const token =
          cfg?.channels?.max?.botToken ||
          process.env.MAX_BOT_TOKEN ||
          "";
        return {
          accountId: accountId || "default",
          token,
          enabled: true,
          name: "Max Bot",
          config: {},
        };
      },

      /**
       * Check if account has valid credentials.
       */
      isConfigured: (account: any, _cfg: any): boolean => {
        return !!account.token?.trim();
      },
    },

    outbound: {
      deliveryMode: "direct" as const,
      chunkerMode: "markdown" as const,
      textChunkLimit: 4000,

      chunker: (text: string, limit: number) => chunkText(text, limit),

      sendPayload: async (ctx: {
        token: string;
        chatId: string;
        text: string;
        replyToMessageId?: string;
      }) => {
        const messageIds = await sendTextToMax({
          token: ctx.token,
          chatId: Number(ctx.chatId),
          text: ctx.text,
          replyToMessageId: ctx.replyToMessageId,
        });
        return {
          ok: true,
          messageIds,
        };
      },
    },

    gateway: {
      /**
       * Start long-polling for incoming Max messages.
       *
       * Uses channelRuntime to dispatch messages through
       * OpenClaw's AI pipeline (same pattern as Synology Chat plugin).
       */
      startAccount: async (ctx: any) => {
        const token = ctx.account.token;
        const accountId = ctx.accountId || "default";
        const channelRuntime = ctx.channelRuntime;

        if (!channelRuntime) {
          ctx.log?.error?.(
            `[max] [${accountId}] channelRuntime not available — cannot dispatch messages`
          );
          return;
        }

        return monitorMaxChannel({
          token,
          signal: ctx.abortSignal,

          onConnected: () => {
            ctx.log?.info?.(`[max] [${accountId}] channel connected`);
          },

          onError: (err: Error) => {
            ctx.log?.error?.(`[max] [${accountId}] error: ${err.message}`);
          },

          onMessage: async (msg) => {
            // Skip empty messages
            if (!msg.text && !msg.attachments?.length) return;

            // Build MsgContext for OpenClaw dispatch
            const fromKey = `max:${msg.senderId}`;
            const msgCtx = channelRuntime.reply.finalizeInboundContext({
              Body: msg.text,
              RawBody: msg.text,
              CommandBody: msg.text,
              From: fromKey,
              To: fromKey,
              SessionKey: `max:${msg.chatId}`,
              AccountId: accountId,
              Provider: "max",
              Surface: "max",
              OriginatingChannel: "max",
              OriginatingTo: fromKey,
              ChatType: "direct",
              SenderName: msg.senderName,
              SenderId: msg.senderId,
              ConversationLabel: msg.senderName || msg.senderId,
              MessageSid: msg.externalId,
              ReplyToId: msg.replyToId,
              Timestamp: msg.timestamp || Date.now(),
              CommandAuthorized: false,
            });

            // Dispatch through AI pipeline
            await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: msgCtx,
              cfg: ctx.cfg,
              dispatcherOptions: {
                deliver: async (payload: any) => {
                  const text = payload?.text ?? payload?.body ?? "";
                  if (!text) return;
                  await sendTextToMax({
                    token,
                    chatId: Number(msg.chatId),
                    text,
                  });
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
    },

    status: {
      probe: async (ctx: { account: { token: string } }) => {
        try {
          const api = new MaxBotApi(ctx.account.token);
          const me = await api.getMe();
          return {
            ok: true,
            label: `@${me.username}`,
            detail: me.name,
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Connection failed",
          };
        }
      },
    },
  };
}

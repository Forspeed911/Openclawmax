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
      resolveAccounts: (ctx: { config: Record<string, unknown> }) => {
        const token = (ctx.config?.["maxBotToken"] as string | undefined)
          || process.env.MAX_BOT_TOKEN;
        if (!token) return [];
        return [
          {
            accountId: "default",
            token,
          },
        ];
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
      startAccount: async (ctx: {
        account: { token: string };
        onMessage: (msg: unknown) => Promise<void>;
        onError?: (err: Error) => void;
        signal?: AbortSignal;
      }) => {
        return monitorMaxChannel({
          token: ctx.account.token,
          onMessage: ctx.onMessage as any,
          onError: ctx.onError,
          signal: ctx.signal,
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

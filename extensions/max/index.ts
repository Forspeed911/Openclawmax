/**
 * Max Channel Plugin for OpenClaw.
 *
 * Native integration with Max messenger (VK):
 * - Long-polling for incoming messages
 * - Webhook support (optional)
 * - Inline keyboards / callback buttons
 * - Media: images, video, audio, files
 * - Typing indicators
 * - Reply-to (message linking)
 *
 * Max — национальный российский мессенджер от VK (70M+ пользователей).
 * API: https://dev.max.ru/docs-api
 *
 * NOTE: We inline the plugin entry instead of importing defineChannelPluginEntry
 * from "openclaw/plugin-sdk/core" because jiti's alias resolution doesn't
 * work for bind-mounted extensions loaded at runtime.
 */

import { buildMaxChannelPlugin } from "./src/channel.ts";

const maxPlugin = buildMaxChannelPlugin();

const emptyConfigSchema = { type: "object" as const, properties: {} };

/**
 * Plugin entry — equivalent to defineChannelPluginEntry({
 *   id: "max", name: "Max Messenger", plugin: maxPlugin
 * })
 *
 * The register() function mirrors what defineChannelPluginEntry generates:
 * it calls api.registerChannel({ plugin }) to register the channel.
 */
export default {
  id: "max",
  name: "Max Messenger",
  description: "Мессенджер Max от VK — национальный российский мессенджер (70M+ пользователей)",
  configSchema: emptyConfigSchema,
  register(api: any) {
    api.registerChannel({ plugin: maxPlugin });
  },
};

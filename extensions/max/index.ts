/**
 * Max Channel Plugin for OpenClaw.
 *
 * Native integration with Max messenger (VK):
 * - Long-polling / webhook for incoming messages
 * - Inline keyboards / callback buttons
 * - Media: images, video, audio, files
 * - Typing indicators
 * - Reply-to (message linking)
 *
 * Max — национальный российский мессенджер от VK (70M+ пользователей).
 * API: https://dev.max.ru/docs-api
 */

import { maxPlugin } from "./src/channel.ts";
import { setMaxRuntime } from "./src/runtime.ts";

const emptyConfigSchema = { type: "object" as const, properties: {} };

export default {
  id: "max",
  name: "Max Messenger",
  description: "Мессенджер Max от VK — национальный российский мессенджер (70M+ пользователей)",
  configSchema: emptyConfigSchema,

  register(api: any) {
    setMaxRuntime(api.runtime);
    api.registerChannel({ plugin: maxPlugin });
  },
};

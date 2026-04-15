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
 */

import type { ChannelPlugin } from "openclaw/plugin-sdk/core";
import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { buildMaxChannelPlugin } from "./src/channel.ts";

const maxPlugin = buildMaxChannelPlugin();

export default defineChannelPluginEntry({
  id: "max",
  name: "Max Messenger",
  description: "Мессенджер Max от VK — национальный российский мессенджер (70M+ пользователей)",
  plugin: maxPlugin as ChannelPlugin,
});

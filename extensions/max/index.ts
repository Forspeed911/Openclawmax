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

console.log("[max-plugin] index.ts loading...");

import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { buildMaxChannelPlugin } from "./src/channel.ts";

console.log("[max-plugin] buildMaxChannelPlugin...");
const maxPlugin = buildMaxChannelPlugin();
console.log("[max-plugin] plugin built, id:", maxPlugin.id, "config keys:", Object.keys(maxPlugin.config));
console.log("[max-plugin] gateway.startAccount?", typeof maxPlugin.gateway?.startAccount);

const entry = defineChannelPluginEntry({
  id: "max",
  name: "Max Messenger",
  description: "Мессенджер Max от VK — национальный российский мессенджер (70M+ пользователей)",
  plugin: maxPlugin,
});

console.log("[max-plugin] entry created, id:", entry.id, "register?", typeof entry.register);

export default entry;

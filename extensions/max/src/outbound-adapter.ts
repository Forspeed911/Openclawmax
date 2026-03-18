/**
 * Outbound adapter — sending messages from OpenClaw to Max.
 *
 * Handles text, media, inline keyboards, and typing indicators.
 */

import { MaxBotApi } from "./max-api.js";
import { formatTextForMax, chunkText } from "./normalize.js";
import type { MaxInlineKeyboard, MaxButton, MaxSendMessageParams } from "./types.js";

export interface SendTextOpts {
  token: string;
  chatId: number;
  text: string;
  replyToMessageId?: string;
  keyboard?: MaxInlineKeyboard;
}

export interface SendMediaOpts {
  token: string;
  chatId: number;
  mediaUrl: string;
  mediaType: "image" | "video" | "audio" | "file";
  caption?: string;
}

/**
 * Send text message to Max chat.
 * Automatically chunks long messages.
 */
export async function sendTextToMax(opts: SendTextOpts): Promise<string[]> {
  const api = new MaxBotApi(opts.token);
  const chunks = chunkText(formatTextForMax(opts.text));
  const messageIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const params: MaxSendMessageParams = {
      chat_id: opts.chatId,
      text: chunks[i],
      format: "markdown",
    };

    // Reply to original message only for first chunk
    if (i === 0 && opts.replyToMessageId) {
      params.link = {
        type: "reply",
        mid: opts.replyToMessageId,
      };
    }

    // Keyboard only on last chunk
    if (i === chunks.length - 1 && opts.keyboard) {
      params.keyboard = opts.keyboard;
    }

    const result = await api.sendMessage(params);
    messageIds.push(result.body.mid);
  }

  return messageIds;
}

/**
 * Send media to Max chat.
 */
export async function sendMediaToMax(opts: SendMediaOpts): Promise<string> {
  const api = new MaxBotApi(opts.token);

  const params: MaxSendMessageParams = {
    chat_id: opts.chatId,
    text: opts.caption,
    attachments: [
      {
        type: opts.mediaType,
        payload: {
          url: opts.mediaUrl,
        },
      },
    ],
  };

  const result = await api.sendMessage(params);
  return result.body.mid;
}

/**
 * Send typing indicator.
 */
export async function sendTypingToMax(token: string, chatId: number): Promise<void> {
  const api = new MaxBotApi(token);
  await api.sendTyping(chatId);
}

/**
 * Build Max inline keyboard from button definitions.
 */
export function buildMaxKeyboard(
  buttons: Array<{ text: string; callbackData?: string; url?: string }>,
  columns: number = 2,
): MaxInlineKeyboard {
  const rows: MaxButton[][] = [];
  let currentRow: MaxButton[] = [];

  for (const btn of buttons) {
    const maxBtn: MaxButton = {
      type: btn.url ? "link" : "callback",
      text: btn.text,
      ...(btn.url ? { url: btn.url } : {}),
      ...(btn.callbackData ? { payload: btn.callbackData } : {}),
    };

    currentRow.push(maxBtn);
    if (currentRow.length >= columns) {
      rows.push(currentRow);
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return { buttons: rows };
}

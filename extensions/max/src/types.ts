/**
 * Max Bot API types.
 *
 * Based on: https://dev.max.ru/docs-api
 * Endpoint: https://platform-api.max.ru
 */

/** Max API base URL */
export const MAX_API_BASE = "https://platform-api.max.ru";

/** Incoming update from Max */
export interface MaxUpdate {
  update_type:
    | "message_created"
    | "message_edited"
    | "message_removed"
    | "message_callback"
    | "bot_started"
    | "bot_added"
    | "bot_removed"
    | "user_added"
    | "user_removed"
    | "chat_title_changed";
  timestamp: number;
  message?: MaxMessage;
  callback?: MaxCallback;
  chat_id?: number;
  user?: MaxUser;
}

/** Max message */
export interface MaxMessage {
  sender?: MaxUser;
  recipient?: MaxRecipient;
  timestamp: number;
  link?: MaxMessageLink;
  body: MaxMessageBody;
  stat?: MaxMessageStat;
}

/** Max message body */
export interface MaxMessageBody {
  mid: string;
  seq: number;
  text?: string;
  attachments?: MaxAttachment[];
  markup?: string;
}

/** Max attachment */
export interface MaxAttachment {
  type: "image" | "video" | "audio" | "file" | "sticker" | "contact" | "share" | "location";
  payload?: {
    url?: string;
    token?: string;
    file_id?: number;
    caption?: string;
  };
}

/** Max user */
export interface MaxUser {
  user_id: number;
  name: string;
  username?: string;
  is_bot?: boolean;
  last_activity_time?: number;
}

/** Max message recipient (chat) */
export interface MaxRecipient {
  chat_id: number;
  chat_type: "dialog" | "chat" | "channel";
}

/** Max callback (button press) */
export interface MaxCallback {
  timestamp: number;
  callback_id: string;
  payload: string;
  user: MaxUser;
  message?: MaxMessage;
}

/** Max message link (reply) */
export interface MaxMessageLink {
  type: "reply" | "forward";
  mid: string;
  sender?: MaxUser;
  chat_id?: number;
  message?: MaxMessageBody;
}

/** Max message statistics */
export interface MaxMessageStat {
  views?: number;
}

/** Max inline keyboard */
export interface MaxInlineKeyboard {
  buttons: MaxButton[][];
}

/** Max button */
export interface MaxButton {
  type: "callback" | "link" | "request_contact" | "request_geo_location" | "chat";
  text: string;
  payload?: string;
  url?: string;
  intent?: "positive" | "negative" | "default";
}

/** Max API response wrapper */
export interface MaxApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  result?: T;
}

/** Max send message params */
export interface MaxSendMessageParams {
  chat_id: number;
  text?: string;
  attachments?: MaxAttachment[];
  link?: MaxMessageLink;
  notify?: boolean;
  format?: "markdown" | "html";
  keyboard?: MaxInlineKeyboard;
}

/** Max bot info */
export interface MaxBotInfo {
  user_id: number;
  name: string;
  username: string;
  is_bot: true;
  commands?: MaxBotCommand[];
}

/** Max bot command */
export interface MaxBotCommand {
  name: string;
  description: string;
}

/** Subscription (webhook or long-polling) */
export interface MaxSubscription {
  url?: string;
  time?: number;
  update_types?: string[];
  version?: string;
}

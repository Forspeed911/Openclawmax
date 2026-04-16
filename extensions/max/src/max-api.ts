/**
 * Max Bot API HTTP client.
 *
 * Docs: https://dev.max.ru/docs-api
 * Base: https://platform-api.max.ru
 * Rate limit: 30 rps
 */

import type {
  MaxApiResponse,
  MaxBotInfo,
  MaxSendMessageParams,
  MaxMessage,
  MaxSubscription,
  MaxUpdate,
} from "./types.ts";
import { MAX_API_BASE } from "./types.ts";

export class MaxBotApi {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(token: string, baseUrl: string = MAX_API_BASE) {
    this.token = token;
    this.baseUrl = baseUrl;
  }

  // ─── Bot Info ───

  /** Get bot profile information. */
  async getMe(): Promise<MaxBotInfo> {
    return this.request<MaxBotInfo>("GET", "/me");
  }

  // ─── Messages ───

  /** Send a message to a chat. */
  async sendMessage(params: MaxSendMessageParams): Promise<MaxMessage> {
    return this.request<MaxMessage>("POST", "/messages", {
      body: params,
      query: { chat_id: params.chat_id },
    });
  }

  /** Edit an existing message. */
  async editMessage(messageId: string, params: Partial<MaxSendMessageParams>): Promise<MaxMessage> {
    return this.request<MaxMessage>("PUT", `/messages/${messageId}`, {
      body: params,
    });
  }

  /** Delete a message. */
  async deleteMessage(messageId: string): Promise<void> {
    await this.request("DELETE", `/messages/${messageId}`);
  }

  /** Answer a callback query (button press). */
  async answerCallback(callbackId: string, params?: { notification?: string }): Promise<void> {
    await this.request("POST", `/answers/callback`, {
      body: {
        callback_id: callbackId,
        ...params,
      },
    });
  }

  // ─── Subscriptions (Webhook / Long-Polling) ───

  /** Get current subscription info. */
  async getSubscription(): Promise<MaxSubscription> {
    return this.request<MaxSubscription>("GET", "/subscriptions");
  }

  /** Set webhook URL for receiving updates. */
  async setWebhook(url: string, updateTypes?: string[]): Promise<void> {
    await this.request("POST", "/subscriptions", {
      body: {
        url,
        update_types: updateTypes,
      },
    });
  }

  /** Remove webhook and switch to long-polling. */
  async deleteWebhook(): Promise<void> {
    await this.request("DELETE", "/subscriptions");
  }

  /** Get updates via long-polling. */
  async getUpdates(params?: {
    limit?: number;
    timeout?: number;
    marker?: number;
    types?: string[];
  }): Promise<{ updates: MaxUpdate[]; marker?: number }> {
    return this.request("GET", "/updates", {
      query: params,
    });
  }

  // ─── Typing ───

  /** Send typing indicator to a chat. */
  async sendTyping(chatId: number): Promise<void> {
    await this.request("POST", "/chats/actions", {
      body: {
        chat_id: chatId,
        action: "typing_on",
      },
    });
  }

  // ─── Chats ───

  /** Get chat info. */
  async getChat(chatId: number): Promise<unknown> {
    return this.request("GET", `/chats/${chatId}`);
  }

  /** Get chat members. */
  async getChatMembers(chatId: number, params?: { marker?: number; count?: number }): Promise<unknown> {
    return this.request("GET", `/chats/${chatId}/members`, { query: params });
  }

  // ─── HTTP Layer ───

  private async request<T = unknown>(
    method: string,
    path: string,
    opts?: {
      body?: unknown;
      query?: Record<string, unknown>;
    },
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    // Append query parameters
    if (opts?.query) {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(opts.query)) {
        if (val !== undefined && val !== null) {
          params.append(key, String(val));
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      Authorization: this.token,
    };

    const init: RequestInit = { method, headers };

    if (opts?.body) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Max API error (${response.status} ${method} ${path}): ${text}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return (await response.json()) as T;
    }

    return undefined as T;
  }
}

/**
 * Max channel monitor — long-polling loop for incoming updates.
 *
 * Handles reconnection, backoff, and graceful shutdown.
 * Follows the same pattern as Telegram's monitorTelegramProvider.
 */

import { MaxBotApi } from "./max-api.ts";
import { normalizeInbound, type NormalizedInboundMessage } from "./normalize.ts";

export interface MonitorMaxOpts {
  token: string;
  /** Called for each incoming message/callback */
  onMessage: (msg: NormalizedInboundMessage) => Promise<void>;
  /** Called when monitor encounters an error */
  onError?: (err: Error) => void;
  /** Called when monitor connects successfully */
  onConnected?: () => void;
  /** Abort signal for graceful shutdown */
  signal?: AbortSignal;
  /** Polling timeout in seconds (default: 30) */
  pollingTimeout?: number;
}

/**
 * Start long-polling monitor for Max updates.
 *
 * Runs until aborted via signal. Auto-reconnects on errors with backoff.
 */
export async function monitorMaxChannel(opts: MonitorMaxOpts): Promise<void> {
  const {
    token,
    onMessage,
    onError,
    onConnected,
    signal,
    pollingTimeout = 30,
  } = opts;

  const api = new MaxBotApi(token);
  let marker: number | undefined;
  let backoffMs = 1000;
  const maxBackoff = 30_000;

  // Verify bot token on start
  try {
    const me = await api.getMe();
    onConnected?.();
    console.log(`[max] Bot connected: @${me.username} (${me.name})`);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    onError?.(error);
    throw error;
  }

  // Ensure no webhook is set (we use long-polling)
  try {
    await api.deleteWebhook();
  } catch {
    // Ignore — may not have been set
  }

  // Main polling loop
  while (!signal?.aborted) {
    try {
      const result = await api.getUpdates({
        marker,
        timeout: pollingTimeout,
      });

      // Reset backoff on success
      backoffMs = 1000;

      if (result.marker) {
        marker = result.marker;
      }

      if (result.updates?.length) {
        for (const update of result.updates) {
          const normalized = normalizeInbound(update);
          if (normalized) {
            try {
              await onMessage(normalized);
            } catch (err) {
              // Don't crash the polling loop on message handler errors
              console.error("[max] Message handler error:", err);
            }
          }
        }
      }
    } catch (err) {
      if (signal?.aborted) break;

      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
      console.error(`[max] Polling error, retrying in ${backoffMs}ms:`, error.message);

      // Exponential backoff
      await sleep(backoffMs, signal);
      backoffMs = Math.min(backoffMs * 2, maxBackoff);
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

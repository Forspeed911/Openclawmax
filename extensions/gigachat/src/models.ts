/**
 * GigaChat model definitions.
 *
 * Pricing: https://developers.sber.ru/docs/ru/gigachat/tariffs/individual-tariffs
 * Models: https://developers.sber.ru/docs/ru/gigachat/models
 * Models are OpenAI-compatible (chat/completions format).
 *
 * GigaChat 1.x → автоматически перенаправляются на GigaChat-2 аналоги (с февраля 2026).
 * GigaChat-2 линейка: контекст 128K токенов, улучшенные RLHF/DPO.
 */

export const GIGACHAT_MODELS = [
  // ── GigaChat 2.x (актуальная линейка) ──────────────────────

  {
    id: "GigaChat-2",
    name: "GigaChat 2 Lite",
    reasoning: false,
    input: ["text"] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
    compat: {
      parallelToolCalls: false,
    },
  },
  {
    id: "GigaChat-2-Pro",
    name: "GigaChat 2 Pro",
    reasoning: false,
    input: ["text", "image"] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
    compat: {
      parallelToolCalls: false,
    },
  },
  {
    id: "GigaChat-2-Max",
    name: "GigaChat 2 Max",
    reasoning: false,
    input: ["text", "image", "audio"] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
    compat: {
      parallelToolCalls: false,
    },
  },

  // ── GigaChat 1.x (legacy, запросы редиректятся на 2.x) ────

  {
    id: "GigaChat",
    name: "GigaChat (legacy → 2 Lite)",
    reasoning: false,
    input: ["text"] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 8192,
    maxTokens: 4096,
    deprecated: true,
    compat: {
      parallelToolCalls: false,
    },
  },
  {
    id: "GigaChat-Plus",
    name: "GigaChat Plus (legacy → 2 Lite)",
    reasoning: false,
    input: ["text"] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32768,
    maxTokens: 8192,
    deprecated: true,
    compat: {
      parallelToolCalls: false,
    },
  },
  {
    id: "GigaChat-Pro",
    name: "GigaChat Pro (legacy → 2 Pro)",
    reasoning: false,
    input: ["text", "image"] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32768,
    maxTokens: 8192,
    deprecated: true,
    compat: {
      parallelToolCalls: false,
    },
  },
  {
    id: "GigaChat-Max",
    name: "GigaChat Max (legacy → 2 Max)",
    reasoning: false,
    input: ["text", "image"] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32768,
    maxTokens: 16384,
    deprecated: true,
    compat: {
      parallelToolCalls: false,
    },
  },
] as const;

export type GigaChatModelId = (typeof GIGACHAT_MODELS)[number]["id"];

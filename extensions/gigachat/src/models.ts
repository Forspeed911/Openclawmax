/**
 * GigaChat model definitions.
 *
 * Pricing: https://developers.sber.ru/docs/ru/gigachat/api/tariffs
 * Models are OpenAI-compatible (chat/completions format).
 */

export const GIGACHAT_MODELS = [
  {
    id: "GigaChat",
    name: "GigaChat",
    reasoning: false,
    input: ["text"] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 8192,
    maxTokens: 4096,
    compat: {
      parallelToolCalls: false,
    },
  },
  {
    id: "GigaChat-Plus",
    name: "GigaChat Plus",
    reasoning: false,
    input: ["text"] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32768,
    maxTokens: 8192,
    compat: {
      parallelToolCalls: false,
    },
  },
  {
    id: "GigaChat-Pro",
    name: "GigaChat Pro",
    reasoning: false,
    input: ["text", "image"] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32768,
    maxTokens: 8192,
    compat: {
      parallelToolCalls: false,
    },
  },
  {
    id: "GigaChat-Max",
    name: "GigaChat Max",
    reasoning: false,
    input: ["text", "image"] as const,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32768,
    maxTokens: 16384,
    compat: {
      parallelToolCalls: false,
    },
  },
] as const;

export type GigaChatModelId = (typeof GIGACHAT_MODELS)[number]["id"];

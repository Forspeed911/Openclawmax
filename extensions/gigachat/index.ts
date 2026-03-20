/**
 * GigaChat Provider Plugin for OpenClaw.
 *
 * Native integration with Sber's GigaChat LLM:
 * - OAuth2 authentication (auto-refresh)
 * - OpenAI-compatible chat completions API
 * - Models: GigaChat-2 (Lite), GigaChat-2-Pro, GigaChat-2-Max + legacy 1.x
 * - Function calling (single call per request — GigaChat limitation)
 * - Vision support (GigaChat-Pro, GigaChat-Max)
 * - Streaming (SSE)
 *
 * Registration: https://developers.sber.ru
 */

import { definePluginEntry } from "openclaw/plugin-sdk/core";
import { createProviderApiKeyAuthMethod } from "openclaw/plugin-sdk/provider-auth";
import { GIGACHAT_MODELS } from "./src/models.js";
import { getAccessToken, invalidateToken } from "./src/auth.js";

const PROVIDER_ID = "gigachat";
const BASE_URL = "https://gigachat.devices.sberbank.ru/api/v1";

export default definePluginEntry({
  id: PROVIDER_ID,
  name: "GigaChat Provider",
  description: "Sber GigaChat — российская LLM с OAuth2 аутентификацией",

  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "GigaChat",
      docsPath: "/providers/gigachat",
      envVars: ["GIGACHAT_CREDENTIALS"],

      auth: [
        createProviderApiKeyAuthMethod({
          providerId: PROVIDER_ID,
          methodId: "api-key",
          label: "GigaChat credentials",
          hint: "Base64(client_id:client_secret) from developers.sber.ru",
          optionKey: "gigachatCredentials",
          flagName: "--gigachat-credentials",
          envVar: "GIGACHAT_CREDENTIALS",
          promptMessage: "Enter GigaChat credentials (base64 of client_id:client_secret)",
          defaultModel: "gigachat/GigaChat-2-Max",
          expectedProviders: [PROVIDER_ID],
          wizard: {
            choiceId: "gigachat-credentials",
            choiceLabel: "GigaChat credentials",
            groupId: "gigachat",
            groupLabel: "GigaChat (Sber)",
            groupHint: "Российская LLM от Сбера — developers.sber.ru",
          },
        }),
      ],

      // Static model catalog
      catalog: {
        order: "simple",
        run: async (ctx) => {
          const apiKey = ctx.resolveProviderApiKey?.(PROVIDER_ID);
          if (!apiKey?.apiKey) return null;

          return {
            provider: {
              baseUrl: BASE_URL,
              api: "openai-completions" as const,
              // apiKey is credentials, but actual auth happens in prepareRuntimeAuth
              apiKey: apiKey.apiKey,
              models: [...GIGACHAT_MODELS],
            },
          };
        },
      },

      /**
       * Runtime auth: convert credentials → OAuth2 access_token.
       * Called before each API request.
       */
      prepareRuntimeAuth: async (ctx) => {
        const credentials = ctx.apiKey || ctx.resolvedModel?.apiKey;
        if (!credentials) return null;

        const scope = ctx.pluginConfig?.scope || "GIGACHAT_API_PERS";

        try {
          const accessToken = await getAccessToken(credentials, scope);
          return {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          };
        } catch (err) {
          invalidateToken();
          throw err;
        }
      },

      capabilities: {
        // GigaChat uses OpenAI-compatible API format
        providerFamily: "openai",
        // Single function call per request
        maxParallelToolCalls: 1,
        // Standard OpenAI tool schema
        anthropicToolSchemaMode: "openai-functions",
      },

      /**
       * Dynamic model resolution for models not in static catalog.
       * Allows `gigachat/any-future-model` to work.
       */
      resolveDynamicModel: (ctx) => {
        if (!ctx.modelId.startsWith("gigachat/")) return null;

        const modelName = ctx.modelId.replace("gigachat/", "");
        const known = GIGACHAT_MODELS.find((m) => m.id === modelName);

        return {
          id: modelName,
          name: known?.name || modelName,
          api: "openai-completions" as const,
          provider: PROVIDER_ID,
          baseUrl: BASE_URL,
          contextWindow: known?.contextWindow || 8192,
          maxTokens: known?.maxTokens || 4096,
          cost: known?.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        };
      },
    });
  },
});

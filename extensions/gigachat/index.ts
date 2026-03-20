/**
 * GigaChat Provider Plugin for OpenClaw.
 *
 * Native integration with Sber's GigaChat LLM:
 * - OAuth2 authentication (auto-refresh, cached)
 * - OpenAI-compatible chat completions API
 * - Models: GigaChat-2 (Lite), GigaChat-2-Pro, GigaChat-2-Max + legacy 1.x
 * - Function calling (single call per request — GigaChat limitation)
 * - Vision support (GigaChat-Pro, GigaChat-Max)
 * - Streaming (SSE)
 *
 * Registration: https://developers.sber.ru
 */

import { GIGACHAT_MODELS } from "./src/models.ts";
import { getAccessToken } from "./src/auth.ts";

const PROVIDER_ID = "gigachat";
const BASE_URL = "https://gigachat.devices.sberbank.ru/api/v1";

const emptyConfigSchema = { type: "object" as const, properties: {} };

/** Convert model defs to ModelDefinitionConfig (no extra fields) */
function toModelDefs() {
  return GIGACHAT_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    reasoning: m.reasoning,
    input: [...m.input].filter(
      (i): i is "text" | "image" => i === "text" || i === "image",
    ),
    cost: m.cost,
    contextWindow: m.contextWindow,
    maxTokens: m.maxTokens,
  }));
}

export default {
  id: PROVIDER_ID,
  name: "GigaChat Provider",
  description: "Sber GigaChat — российская LLM с OAuth2 аутентификацией",
  configSchema: emptyConfigSchema,

  register(api: any) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "GigaChat",
      docsPath: "/providers/gigachat",
      envVars: ["GIGACHAT_AUTH_KEY"],

      auth: [
        {
          id: "credentials",
          label: "GigaChat Credentials",
          hint: "Base64(client_id:client_secret) from developers.sber.ru",
          kind: "custom",
          run: async (ctx: any) => {
            const credentials = await ctx.prompter.text({
              message:
                "GigaChat credentials (base64 of client_id:client_secret)",
              validate: (value: string) =>
                value.trim() ? undefined : "Credentials required",
            });

            return {
              profiles: [
                {
                  profileId: "gigachat:default",
                  credential: {
                    type: "api_key",
                    provider: PROVIDER_ID,
                    key: credentials.trim(),
                  },
                },
              ],
              configPatch: {
                models: {
                  providers: {
                    [PROVIDER_ID]: {
                      baseUrl: BASE_URL,
                      api: "openai-completions",
                      apiKey: credentials.trim(),
                      models: toModelDefs(),
                    },
                  },
                },
              },
              defaultModel: `${PROVIDER_ID}/GigaChat-2-Max`,
            };
          },
        },
      ],

      discovery: {
        order: "simple" as const,
        run: async (ctx: any) => {
          // Resolve credentials: stored profile → env var
          const resolved = ctx.resolveProviderApiKey?.(PROVIDER_ID);
          const credentials =
            resolved?.apiKey ||
            resolved?.discoveryApiKey ||
            ctx.env?.GIGACHAT_AUTH_KEY ||
            process.env.GIGACHAT_AUTH_KEY;

          if (!credentials) return null;

          const scope =
            ctx.env?.GIGACHAT_SCOPE ||
            process.env.GIGACHAT_SCOPE ||
            "GIGACHAT_API_PERS";

          try {
            // Exchange credentials for OAuth2 access token (cached, auto-refresh)
            const accessToken = await getAccessToken(credentials, scope);

            return {
              provider: {
                baseUrl: BASE_URL,
                api: "openai-completions" as const,
                apiKey: accessToken,
                models: toModelDefs(),
              },
            };
          } catch {
            // OAuth failed — provider unavailable, don't crash
            return null;
          }
        },
      },

      wizard: {
        onboarding: {
          choiceId: "gigachat-credentials",
          choiceLabel: "GigaChat (Sber)",
          choiceHint: "Российская LLM — developers.sber.ru",
          groupId: "gigachat",
          groupLabel: "GigaChat (Sber)",
          groupHint: "Российская LLM от Сбера",
          methodId: "credentials",
        },
      },
    });
  },
};

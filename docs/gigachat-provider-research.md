# GigaChat Provider Plugin — Исследование

## GigaChat API

Документация: https://developers.sber.ru/docs/ru/gigachat/overview
Endpoint: `gigachat.devices.sberbank.ru/api/v1`

### Аутентификация — OAuth2
В отличие от OpenAI/Anthropic, GigaChat использует OAuth2:

1. Получить `client_id` и `client_secret` на developers.sber.ru
2. Запрос токена:
   ```
   POST https://ngw.devices.sberbank.ru:9443/api/v2/oauth
   Authorization: Basic base64(client_id:client_secret)
   Content-Type: application/x-www-form-urlencoded
   Body: scope=GIGACHAT_API_PERS (или GIGACHAT_API_CORP)
   ```
3. Ответ: `{ "access_token": "...", "expires_at": 1234567890 }`
4. Токен живёт ~30 минут → нужен auto-refresh

### Модели
| Модель | Контекст | Описание |
|--------|---------|----------|
| GigaChat | 8192 | Базовая, бесплатная для физлиц |
| GigaChat-Plus | 32768 | Расширенный контекст |
| GigaChat-Pro | 32768 | Максимальное качество |
| GigaChat-Max | 32768 | Новейшая, топ-качество |

### API — OpenAI-совместимый
```
POST /api/v1/chat/completions
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "model": "GigaChat",
  "messages": [{"role": "user", "content": "Привет"}],
  "stream": true
}
```

### Function Calling
Поддерживается, но с ограничениями:
- Максимум 1 function call за запрос (API limitation)
- Формат: OpenAI-совместимый (tools/tool_choice)
- Нужно учитывать в capabilities плагина

### Embeddings
```
POST /api/v1/embeddings
Body: { "model": "Embeddings", "input": ["текст"] }
```

### Vision
GigaChat-Pro поддерживает анализ изображений (base64 в content).

## Реализация OpenClaw Plugin

### Auth Hook (`auth.ts`)
```typescript
// OAuth2 flow для GigaChat
async function getAccessToken(clientId: string, clientSecret: string): Promise<TokenResponse> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'scope=GIGACHAT_API_PERS',
  });
  return response.json();
}
```

### Provider Registration
```typescript
api.registerProvider({
  id: 'gigachat',
  label: 'GigaChat',
  auth: [createProviderApiKeyAuthMethod({
    // client_id:client_secret как "API key"
    envVar: 'GIGACHAT_CREDENTIALS',
  })],
  catalog: {
    run: async (ctx) => ({
      provider: {
        baseUrl: 'https://gigachat.devices.sberbank.ru/api/v1',
        api: 'openai-completions',
        models: GIGACHAT_MODELS,
      },
    }),
  },
  prepareRuntimeAuth: async (ctx) => {
    // OAuth2: credentials → access_token
    const token = await getOrRefreshToken(ctx);
    return { headers: { Authorization: `Bearer ${token}` } };
  },
  capabilities: {
    maxParallelToolCalls: 1, // GigaChat limitation
  },
});
```

## Существующие решения (reference)

1. **gigachat-openclaw** (GitHub: SoapMaker101) — HTTP proxy, Node.js/Express
   - Полная реализация OAuth2
   - OpenAI-совместимый endpoint
   - Можно использовать как reference или fallback

2. **gpt2giga** — Python proxy
   - Переводит OpenAI запросы в GigaChat формат
   - Используется в community skills (Хабр)

3. **LiteLLM** — универсальный прокси
   - `model=gigachat/<model>` prefix
   - OAuth через env vars

## Стратегия

**Рекомендация:** нативный плагин (не proxy), потому что:
- Нет лишнего hop (proxy → latency)
- OAuth2 refresh встроен в OpenClaw lifecycle
- Полный контроль над function calling ограничениями
- Лучший UX (onboarding wizard в OpenClaw)

## TODO
- [ ] Зарегистрироваться на developers.sber.ru
- [ ] Получить credentials для тестов
- [ ] Написать OAuth2 auth module
- [ ] Реализовать catalog + models
- [ ] Тесты: chat, streaming, function calling
- [ ] Тесты: vision (GigaChat-Pro)

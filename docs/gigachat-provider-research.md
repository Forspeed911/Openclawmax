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

2. **gpt2giga** (GitHub: ai-forever/gpt2giga) — **официальный proxy от Сбера**
   - MIT лицензия, Python, PyPI: `pip install gpt2giga`
   - Полная трансляция OpenAI API → GigaChat API (и обратно)
   - Endpoints: `/v1/chat/completions`, `/v1/embeddings`, `/v1/messages` (Anthropic), `/responses`
   - OAuth2 из коробки (авто-refresh)
   - Streaming (SSE), vision, function calling
   - Запуск: `gpt2giga` → `localhost:8090`
   - FastAPI docs: `http://localhost:8090/docs`
   - Протестирован с Aider, n8n, Cline/Roo Code
   - **Ключевое:** поддерживает и OpenAI и Anthropic Messages API формат

3. **LiteLLM** — универсальный прокси
   - `model=gigachat/<model>` prefix
   - OAuth через env vars

## Стратегия

**Гибридный подход — два пути:**

### Путь A: Нативный плагин (основной)
- Прямой вызов GigaChat API, OAuth2 через `prepareRuntimeAuth`
- Минимальная latency (1 hop)
- Полный контроль над capabilities и edge cases
- **Для:** Hosted SaaS, продакшн

### Путь B: gpt2giga proxy (альтернатива)
- OpenClaw думает что говорит с OpenAI → gpt2giga транслирует в GigaChat
- Конфигурация: `baseUrl: http://gpt2giga:8090/v1`, формат `openai-completions`
- Все edge cases покрыты Сбером
- +1 Python-сервис в Docker Compose
- **Для:** quick start, web installer, fallback

### Docker Compose (gpt2giga вариант)
```yaml
services:
  gpt2giga:
    image: python:3.11-slim
    command: pip install gpt2giga && gpt2giga
    environment:
      - GIGACHAT_CREDENTIALS=${GIGACHAT_CREDENTIALS}
      - GIGACHAT_MODEL=GigaChat-Max
      - GIGACHAT_SCOPE=GIGACHAT_API_PERS
    ports:
      - "8090:8090"

  openclaw:
    image: openclaw/openclaw:latest
    environment:
      - OPENAI_API_BASE=http://gpt2giga:8090/v1
      - OPENAI_API_KEY=dummy  # gpt2giga handles auth
    depends_on:
      - gpt2giga
```

В web installer пользователь выбирает: "Нативная интеграция" или "Через gpt2giga (рекомендуется для быстрого старта)".

## TODO
- [ ] Зарегистрироваться на developers.sber.ru
- [ ] Получить credentials для тестов
- [ ] Написать OAuth2 auth module
- [ ] Реализовать catalog + models
- [ ] Тесты: chat, streaming, function calling
- [ ] Тесты: vision (GigaChat-Pro)

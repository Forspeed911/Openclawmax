# OpenClawMax — Архитектура проекта

## Концепция
SaaS-платформа на базе OpenClaw, адаптированная для российского рынка.
Два режима работы:
1. **Hosted SaaS** — полностью управляемая инфраструктура
2. **Web Installer** — автоматическая установка на серверы клиента

## Ключевые интеграции

### 1. Мессенджер Max (VK) — Channel Plugin

OpenClaw использует Channel Plugin SDK. Каждый канал — отдельный extension в `extensions/<channel>/`.

**Структура Max-плагина:**
```
extensions/max/
├── package.json              # @openclawmax/max
├── openclaw.plugin.json      # id: "max", channels: ["max"]
├── index.ts                  # defineChannelPluginEntry()
├── setup-entry.ts            # Визард настройки (ввод Bot Token)
└── src/
    ├── channel.ts            # ChannelPlugin — основной объект
    ├── channel.setup.ts      # Онбординг
    ├── runtime.ts            # Инициализация
    ├── accounts.ts           # Работа с аккаунтами ботов
    ├── normalize.ts          # Нормализация сообщений Max → OpenClaw
    ├── outbound-adapter.ts   # Отправка сообщений (platform-api.max.ru)
    ├── inbound-handler.ts    # Webhook обработчик входящих
    ├── max-api.ts            # HTTP-клиент для Max Bot API
    └── types.ts              # Типы Max API
```

**Max Bot API (dev.max.ru):**
- Endpoint: `platform-api.max.ru`
- Auth: Bot Token в header
- Rate limit: 30 rps
- Возможности: отправка/получение сообщений, работа с чатами, каналами, callback-кнопки
- Ограничение: только юрлица/ИП — резиденты РФ

**Необходимые адаптеры:**
| Адаптер | Задача |
|---------|--------|
| config | Управление bot-аккаунтами (token storage) |
| setup | Визард: ввод Bot Token, проверка, сохранение |
| outbound | Отправка сообщений через Max API |
| messaging | Парсинг входящих (webhook / long-polling) |
| gateway | Webhook endpoint для получения обновлений |
| status | Health check: проверка валидности токена |

### 2. GigaChat (Sber) — Provider Plugin

OpenClaw использует Provider Plugin SDK. Каждый LLM-провайдер — extension в `extensions/<provider>/`.

**Структура GigaChat-плагина:**
```
extensions/gigachat/
├── package.json              # @openclawmax/gigachat
├── openclaw.plugin.json      # id: "gigachat", providers: ["gigachat"]
├── index.ts                  # definePluginEntry() + registerProvider()
└── src/
    ├── auth.ts               # OAuth2 аутентификация (GigaChat использует OAuth, не API key)
    ├── catalog.ts            # Каталог моделей (GigaChat, GigaChat-Plus, GigaChat-Pro)
    ├── stream-wrapper.ts     # Обёртка стриминга (SSE совместимость)
    └── types.ts              # Типы GigaChat API
```

**GigaChat API:**
- Auth: OAuth2 (client_id:client_secret → access_token)
- API: OpenAI-compatible (openai-completions формат)
- Модели: GigaChat (base), GigaChat-Plus, GigaChat-Pro
- Поддерживает: chat, function calling, embeddings, vision
- Ограничение: 1 function call за запрос

**Ключевые отличия от стандартных провайдеров:**
1. OAuth2 вместо статичного API key — нужен `prepareRuntimeAuth` hook для обновления токена
2. Function calling ограничен — нужен `capabilities` флаг
3. Endpoint: `gigachat.devices.sberbank.ru/api/v1`

### 3. SaaS-платформа

#### Режим 1: Hosted SaaS

```
┌─────────────────────────────────────────────┐
│              OpenClawMax Cloud               │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Tenant A │  │ Tenant B │  │ Tenant C │  │
│  │ OpenClaw │  │ OpenClaw │  │ OpenClaw │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │        │
│  ┌────┴──────────────┴──────────────┴────┐  │
│  │         Shared Infrastructure          │  │
│  │  Docker Swarm / K8s  |  PostgreSQL     │  │
│  │  Redis               |  Nginx/Caddy    │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Компоненты:**
- Multi-tenant оркестрация (1 контейнер = 1 tenant)
- Панель управления (React + NestJS)
- Биллинг (подписки, лимиты)
- Мониторинг и логи
- Автоматический provisioning

#### Режим 2: Web Installer

```
┌─────────────────────┐        ┌──────────────────┐
│   Web Installer UI  │───────▶│  Сервер клиента   │
│                     │  SSH/  │                    │
│  1. Выбор: OpenClaw │  API   │  Docker + OpenClaw │
│  2. Ввод ключей     │───────▶│  + Max plugin      │
│  3. Ввод SSH/доступ │        │  + GigaChat plugin │
│  4. Деплой          │        │  + Настроено       │
└─────────────────────┘        └──────────────────────┘
```

**Wizard flow:**
1. Выбрать что ставить (OpenClaw + плагины)
2. Ввести ключи: GigaChat credentials, Max Bot Token
3. Ввести доступ к серверу: SSH или API провайдера (Hetzner, Selectel, Timeweb)
4. Автоматический деплой: Docker compose + конфиг + SSL
5. Мониторинг: health check, уведомления

## Стек

### Плагины (Max + GigaChat)
- TypeScript (OpenClaw Plugin SDK)
- pnpm (monorepo, как в OpenClaw)

### SaaS-платформа
- Backend: NestJS + PostgreSQL + Redis
- Frontend: React + Tailwind
- Деплой: Docker, Railway или собственный VPS
- Web Installer: Node.js + SSH2 библиотека

## Этапы разработки

### Phase 1: Плагины (MVP)
1. GigaChat Provider Plugin — 3-5 дней
2. Max Channel Plugin — 7-10 дней
3. Тестирование связки OpenClaw + GigaChat + Max

### Phase 2: Web Installer
4. Wizard UI (React) — выбор, ввод ключей
5. Backend деплоя (Docker compose генератор)
6. SSH-деплоер или API-деплоер

### Phase 3: Hosted SaaS
7. Multi-tenant оркестрация
8. Панель управления
9. Биллинг
10. Мониторинг

## Риски

| Риск | Митигация |
|------|-----------|
| Max API доступен только юрлицам РФ | Нужно юрлицо для получения Bot Token |
| GigaChat OAuth2 токен протухает | prepareRuntimeAuth hook с auto-refresh |
| OpenClaw быстро обновляется | Форк с upstream tracking, минимум изменений в ядре |
| Конкуренты на тему Max + AI | Скорость выхода на рынок — главное преимущество |

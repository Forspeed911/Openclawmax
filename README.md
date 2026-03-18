# OpenClawMax

OpenClaw, адаптированный для российского рынка: мессенджер Max (VK) + GigaChat (Sber).

## Что это

SaaS-платформа на базе [OpenClaw](https://github.com/openclaw/openclaw) с двумя режимами:

1. **Hosted SaaS** — мы разворачиваем и управляем всей инфраструктурой
2. **Web Installer** — автоматическая установка на серверы клиента через веб-визард

## Ключевые интеграции

| Интеграция | Статус | Описание |
|-----------|--------|----------|
| Max (VK) | 🔴 В разработке | Channel Plugin для мессенджера Max — национального мессенджера РФ (70M+ юзеров) |
| GigaChat (Sber) | 🔴 В разработке | LLM Provider Plugin — OAuth2, chat, function calling, embeddings |
| Web Installer | 🔴 Планируется | Wizard: выбор → ввод ключей → SSH/API → автодеплой |
| Hosted SaaS | 🔴 Планируется | Multi-tenant, Docker, панель управления, биллинг |

## Архитектура

Подробная документация: [docs/architecture.md](docs/architecture.md)

### Структура плагинов

```
extensions/
├── max/                  # Channel Plugin — мессенджер Max (VK)
│   ├── src/
│   │   ├── channel.ts         # Основной ChannelPlugin
│   │   ├── max-api.ts         # HTTP-клиент Max Bot API
│   │   ├── inbound-handler.ts # Webhook — входящие сообщения
│   │   ├── outbound-adapter.ts# Отправка сообщений
│   │   └── normalize.ts       # Нормализация Max → OpenClaw
│   ├── openclaw.plugin.json
│   └── package.json
│
└── gigachat/             # Provider Plugin — GigaChat (Sber)
    ├── src/
    │   ├── auth.ts            # OAuth2 (client_id:client_secret → token)
    │   ├── catalog.ts         # Модели: GigaChat, GigaChat-Plus, GigaChat-Pro
    │   └── stream-wrapper.ts  # SSE стриминг
    ├── openclaw.plugin.json
    └── package.json
```

## Стек

- **Плагины**: TypeScript, OpenClaw Plugin SDK, pnpm
- **SaaS Backend**: NestJS, PostgreSQL, Redis
- **SaaS Frontend**: React, Tailwind
- **Деплой**: Docker, Docker Compose

## Этапы

- **Phase 1** — Плагины (GigaChat + Max) → MVP
- **Phase 2** — Web Installer (wizard + SSH-деплоер)
- **Phase 3** — Hosted SaaS (multi-tenant + биллинг)

## Ссылки

- [OpenClaw](https://github.com/openclaw/openclaw) — основной проект
- [Max для разработчиков](https://dev.max.ru/) — API мессенджера Max
- [GigaChat API](https://developers.sber.ru/docs/ru/gigachat/overview) — документация GigaChat
- [gigachat-openclaw](https://github.com/SoapMaker101/gigachat-openclaw) — существующий proxy (reference)

## Лицензия

MIT

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

## Quick Start

### Вариант 1: Скрипт установки (рекомендуется)

```bash
git clone https://github.com/Forspeed911/Openclawmax.git
cd Openclawmax
bash scripts/install.sh
```

### Вариант 2: Вручную

```bash
git clone https://github.com/Forspeed911/Openclawmax.git
cd Openclawmax
cp .env.example .env
# Заполнить .env: GIGACHAT_CREDENTIALS, MAX_BOT_TOKEN

# Нативный GigaChat плагин:
docker compose up -d

# Или через gpt2giga proxy (быстрый старт):
docker compose -f docker-compose.gpt2giga.yml up -d
```

### Два варианта GigaChat-интеграции

| | Нативный плагин | gpt2giga proxy |
|--|-----------------|----------------|
| Compose файл | `docker-compose.yml` | `docker-compose.gpt2giga.yml` |
| Latency | Минимальная (1 hop) | +1 hop через proxy |
| Зависимости | TypeScript only | +Python-сервис |
| Edge cases | Покрываем сами | Покрыты Сбером |
| Для кого | Продакшн | Быстрый старт |

## Стек

- **Плагины**: TypeScript, OpenClaw Plugin SDK, pnpm
- **SaaS Backend**: NestJS, PostgreSQL, Redis
- **SaaS Frontend**: React, Tailwind
- **Деплой**: Docker, Docker Compose
- **GigaChat alt**: [gpt2giga](https://github.com/ai-forever/gpt2giga) — официальный proxy от Сбера

## Этапы

- **Phase 1** — Плагины (GigaChat + Max) → MVP ← текущий этап
- **Phase 2** — Web Installer (wizard + SSH-деплоер)
- **Phase 3** — Hosted SaaS (multi-tenant + биллинг)

## Ссылки

- [OpenClaw](https://github.com/openclaw/openclaw) — основной проект (310k+ stars)
- [Max для разработчиков](https://dev.max.ru/) — API мессенджера Max
- [GigaChat API](https://developers.sber.ru/docs/ru/gigachat/overview) — документация GigaChat
- [gpt2giga](https://github.com/ai-forever/gpt2giga) — OpenAI→GigaChat proxy от Сбера
- [gigachat-openclaw](https://github.com/SoapMaker101/gigachat-openclaw) — community proxy (reference)

## Лицензия

MIT

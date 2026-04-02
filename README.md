# OpenClawMax

AI-бот на базе [OpenClaw](https://github.com/openclaw/openclaw) для российского рынка: **GigaChat** (Sber) + **Max Messenger** (VK) + **Telegram**.

## Quick Start

### Скрипт установки (рекомендуется)

```bash
curl -sSL https://raw.githubusercontent.com/Forspeed911/Openclawmax/main/scripts/install.sh | bash
```

Или вручную:

```bash
git clone https://github.com/Forspeed911/Openclawmax.git
cd Openclawmax
bash scripts/install.sh
```

Установщик проведёт через 4 шага:
1. **Выбор LLM** → GigaChat
2. **Выбор модели** → GigaChat-2 / Pro / Max
3. **Ввод реквизитов** → AUTH_KEY (Base64) или Client ID + Secret
4. **Выбор мессенджера** → Max / Telegram / оба → ввод токена бота

### Вручную (без скрипта)

```bash
git clone https://github.com/Forspeed911/Openclawmax.git
cd Openclawmax
cp .env.example .env
# Заполнить .env: GIGACHAT_AUTH_KEY, MAX_BOT_TOKEN и/или TELEGRAM_BOT_TOKEN
docker compose build
docker compose up -d
```

## Архитектура

```
┌───────────┐     ┌──────────────┐     ┌──────────────┐
│ Max / TG  │────▶│   OpenClaw   │────▶│  gpt2giga    │────▶ GigaChat API
│ (каналы)  │◀────│  (gateway)   │◀────│  (proxy)     │◀──── (Sber OAuth2)
└───────────┘     └──────────────┘     └──────────────┘
                        │
                  ┌─────┴─────┐
                  │   Caddy   │  (SSL / reverse proxy)
                  └───────────┘
```

- **OpenClaw** — AI-платформа с плагинами для каналов и LLM-провайдеров
- **gpt2giga** — [прокси от Сбера](https://github.com/ai-forever/gpt2giga), транслирует OpenAI API → GigaChat API (OAuth2 внутри)
- **Max/Telegram** — стоковые плагины OpenClaw (long-polling, медиа, клавиатуры)
- **Caddy** — reverse proxy + авто-SSL (Let's Encrypt)

## Модели GigaChat

| Модель | Контекст | Ввод | Описание |
|--------|----------|------|----------|
| GigaChat-2 | 128K | текст | Lite — бесплатно |
| GigaChat-2-Pro | 128K | текст, картинки | Pro — с vision |
| GigaChat-2-Max | 128K | текст, картинки, аудио | Max — полный функционал |

## Переменные окружения

| Переменная | Обязательная | Описание |
|-----------|:---:|----------|
| `GIGACHAT_AUTH_KEY` | ✓ | Base64(client_id:client_secret) — [developers.sber.ru](https://developers.sber.ru) |
| `GIGACHAT_SCOPE` | | `GIGACHAT_API_PERS` (по умолчанию) / `B2B` / `CORP` |
| `MAX_BOT_TOKEN` | * | Токен бота Max — [dev.max.ru](https://dev.max.ru) |
| `TELEGRAM_BOT_TOKEN` | * | Токен бота Telegram — @BotFather |
| `OPENCLAW_PORT` | | Порт (по умолчанию 3000) |
| `DOMAIN` | | Домен для Caddy SSL |

\* Нужен хотя бы один мессенджер.

## Управление

```bash
docker compose logs -f        # логи
docker compose restart         # перезапуск
docker compose down            # остановка
docker compose up -d --build   # пересборка
```

## Ссылки

- [OpenClaw](https://github.com/openclaw/openclaw) — основной проект
- [Max API](https://dev.max.ru/) — документация Max
- [GigaChat API](https://developers.sber.ru/docs/ru/gigachat/overview) — документация GigaChat
- [gpt2giga](https://github.com/ai-forever/gpt2giga) — OpenAI→GigaChat proxy

## Лицензия

MIT

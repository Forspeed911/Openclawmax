# Max Channel Plugin — Исследование

## Max Bot API

Портал: https://dev.max.ru/
Endpoint: `platform-api.max.ru`
Rate limit: 30 rps

### Аутентификация
- Bot Token — выдаётся через панель разработчика
- Header: `Authorization: Bearer <bot_token>` (предположительно, уточнить по документации)
- Доступ к API: только юрлица/ИП — резиденты РФ

### Основные методы API
- Отправка сообщений (текст, фото, файлы, кнопки)
- Получение обновлений (webhook или long-polling)
- Управление чатами и каналами
- Callback-кнопки (inline keyboards)

### Ограничения
- Нет официального Python/Node.js SDK от VK
- Неофициальные SDK: maxgram, maxapi-python (не гарантируют стабильность)
- Фокус VK — на Java и Go (банки, госструктуры)
- 70M+ пользователей, обязательная предустановка на устройствах в РФ

## Что нужно реализовать

### 1. Max API Client (`max-api.ts`)
HTTP-клиент для Max Bot API:
- sendMessage(chatId, text, attachments?, keyboard?)
- getUpdates(offset?) — для long-polling
- setWebhook(url) — для webhook-режима
- deleteWebhook()
- getMe() — информация о боте
- getChatMembers(chatId)

### 2. Inbound Handler (`inbound-handler.ts`)
Обработка входящих сообщений:
- Webhook endpoint (POST /webhook/max)
- Парсинг payload Max → внутренний формат OpenClaw
- Обработка callback queries (кнопки)
- Обработка медиа (фото, файлы, голосовые)

### 3. Outbound Adapter (`outbound-adapter.ts`)
Отправка сообщений из OpenClaw в Max:
- Текстовые сообщения (с форматированием)
- Медиа (фото, файлы)
- Inline-кнопки
- Отправка по chatId

### 4. Normalizer (`normalize.ts`)
Конвертация форматов:
- Max message → OpenClaw ThreadMessage
- OpenClaw response → Max API payload
- Маппинг типов медиа
- Маппинг форматирования (markdown → Max markup)

### 5. Setup (`channel.setup.ts`)
Визард настройки:
- Ввод Bot Token
- Проверка токена (getMe)
- Настройка webhook URL
- Сохранение конфигурации

## Аналоги для изучения

Существующие channel-плагины OpenClaw (как reference):
- `extensions/telegram/` — ближайший аналог (Bot API, webhook, inline keyboards)
- `extensions/whatsapp/` — медиа, форматирование
- `extensions/discord/` — структура каналов

## TODO
- [ ] Изучить dev.max.ru/docs-api детально
- [ ] Зарегистрировать тестового бота (нужно юрлицо)
- [ ] Написать базовый HTTP-клиент
- [ ] Реализовать inbound/outbound
- [ ] Тесты с реальным Max API

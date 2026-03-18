# SaaS-платформа OpenClawMax — Дизайн

## Два режима работы

### Режим 1: Hosted SaaS

Клиент регистрируется → получает свой OpenClaw инстанс → пользуется.
Мы управляем инфраструктурой, обновлениями, мониторингом.

```
Клиент (браузер/Max/Telegram)
       │
       ▼
┌──────────────────┐
│   API Gateway    │  Nginx/Caddy — роутинг по tenant
│   (reverse proxy)│
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Tenant A│ │Tenant B│   Docker контейнеры
│OpenClaw│ │OpenClaw│   с Max + GigaChat плагинами
└───┬────┘ └───┬────┘
    │          │
    ▼          ▼
┌──────────────────┐
│   PostgreSQL     │   Shared DB, schema-per-tenant
│   Redis          │   Sessions, кэш, очереди
└──────────────────┘
```

**Компоненты:**

1. **Control Plane** (NestJS)
   - Регистрация / аутентификация
   - Создание tenant (provision контейнера)
   - Управление подпиской / лимитами
   - Dashboard: статистика, логи, настройки

2. **Data Plane** (Docker + OpenClaw)
   - 1 контейнер = 1 tenant
   - Изолированные данные (schema-per-tenant или DB-per-tenant)
   - Автоскейлинг по нагрузке

3. **Billing**
   - Тарифы: Free (1 бот, лимит сообщений), Pro (без лимитов), Enterprise
   - Интеграция с ЮKassa / CloudPayments
   - Учёт потребления (сообщения, API calls к GigaChat)

### Режим 2: Web Installer

Клиент заходит в визард → вводит данные → мы ставим на его сервер.

**Wizard Flow:**

```
Шаг 1: Что ставим
  ☑ OpenClaw
  ☑ Max Channel Plugin
  ☑ GigaChat Provider
  ☐ Telegram Channel (опционально)

Шаг 2: Ключи и токены
  [GigaChat Client ID    ] [____________]
  [GigaChat Client Secret] [____________]
  [Max Bot Token         ] [____________]

Шаг 3: Сервер
  Вариант A: SSH доступ
    [IP          ] [____________]
    [SSH User    ] [____________]
    [SSH Key     ] [📎 Upload   ]

  Вариант B: Cloud Provider API
    [Hetzner / Selectel / Timeweb]
    [API Token   ] [____________]
    → Автоматически создаём VPS

Шаг 4: Домен (опционально)
  [Домен       ] [____________]
  → Автоматический SSL через Let's Encrypt

Шаг 5: Деплой
  ▶ Подключаемся к серверу
  ▶ Устанавливаем Docker
  ▶ Деплоим docker-compose
  ▶ Конфигурируем OpenClaw + плагины
  ▶ Настраиваем webhook для Max
  ▶ Проверяем health
  ✅ Готово! Ваш бот: https://your-domain.com
```

**Backend деплоя:**

```typescript
// Генерация docker-compose.yml на основе конфига
function generateDockerCompose(config: InstallConfig): string {
  return `
version: '3.8'
services:
  openclaw:
    image: openclawmax/openclaw-ru:latest
    ports:
      - "3000:3000"
    environment:
      - GIGACHAT_CREDENTIALS=${config.gigachatCredentials}
      - MAX_BOT_TOKEN=${config.maxBotToken}
      - WEBHOOK_URL=${config.webhookUrl}
    volumes:
      - openclaw-data:/data
    restart: unless-stopped

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
    restart: unless-stopped

volumes:
  openclaw-data:
  caddy-data:
`;
}
```

## Монетизация

### Hosted SaaS
| Тариф | Цена | Включено |
|-------|------|----------|
| Free | 0 ₽/мес | 1 бот, 100 сообщений/день, GigaChat base |
| Pro | 990 ₽/мес | 5 ботов, безлимит, все модели GigaChat |
| Business | 4990 ₽/мес | 20 ботов, приоритет, кастом домен |
| Enterprise | По запросу | On-premise, SLA, поддержка |

### Web Installer
| Вариант | Цена | Что даём |
|---------|------|----------|
| Разовая установка | 2990 ₽ | Установка + 30 дней поддержки |
| С подпиской | 490 ₽/мес | Авто-обновления, мониторинг, поддержка |

## Технические решения

### Почему Docker, а не Kubernetes
- Целевая аудитория — малый/средний бизнес в РФ
- Docker проще: один VPS за 500-1000 ₽/мес = достаточно
- K8s оправдан только для Enterprise (Phase 3+)

### Почему NestJS
- TypeScript (единый стек с OpenClaw)
- Модульная архитектура (modules, guards, interceptors)
- Хорошо для REST + WebSocket (real-time логи деплоя)

### Хостинг
- Первичный: Selectel или Timeweb Cloud (российские, compliance)
- Альтернатива: Hetzner (EU, дешевле)
- Для enterprise: on-premise

## Конкурентный анализ

На март 2026 — НИКТО не предлагает:
- OpenClaw + Max из коробки
- OpenClaw + GigaChat нативно
- SaaS-установщик OpenClaw для РФ-рынка

Ближайшие конкуренты:
- Статья на Хабре (ручная настройка через skills)
- gigachat-openclaw proxy (не SaaS, нужна ручная настройка)
- Tencent + WeChat (Китай, не РФ)

**Окно возможности: 3-6 месяцев** — пока никто не занял нишу.

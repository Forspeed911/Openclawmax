#!/usr/bin/env bash
# ============================================
# OpenClawMax — Quick Start Install Script
# ============================================
# Запуск: curl -sSL https://raw.githubusercontent.com/Forspeed911/Openclawmax/main/scripts/install.sh | bash
# Или:    bash scripts/install.sh

set -euo pipefail

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
info()  { echo -e "${CYAN}[i]${NC} $1"; }

INSTALL_DIR="${INSTALL_DIR:-$HOME/openclawmax}"
REPO_URL="https://github.com/Forspeed911/Openclawmax.git"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       OpenClawMax — Установка        ║${NC}"
echo -e "${CYAN}║  OpenClaw + GigaChat + Max Messenger  ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# --- Проверка зависимостей ---
check_dep() {
    if ! command -v "$1" &>/dev/null; then
        err "$1 не установлен"
        return 1
    fi
    log "$1 найден: $(command -v "$1")"
}

info "Проверяю зависимости..."
MISSING=0
check_dep "docker" || MISSING=1
check_dep "docker" && {
    if ! docker compose version &>/dev/null && ! docker-compose version &>/dev/null; then
        err "docker compose не найден"
        MISSING=1
    else
        log "docker compose найден"
    fi
}
check_dep "git" || MISSING=1

if [ "$MISSING" -eq 1 ]; then
    echo ""
    err "Установите недостающие зависимости и запустите скрипт снова"
    echo "  Docker: https://docs.docker.com/engine/install/"
    echo "  Git:    sudo apt install git"
    exit 1
fi

echo ""

# --- Клонирование ---
if [ -d "$INSTALL_DIR" ]; then
    warn "Директория $INSTALL_DIR уже существует"
    read -rp "Обновить? (y/n): " UPDATE
    if [ "$UPDATE" = "y" ]; then
        info "Обновляю..."
        cd "$INSTALL_DIR" && git pull origin main
    fi
else
    info "Клонирую репозиторий..."
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
log "Репозиторий готов: $INSTALL_DIR"

echo ""

# --- Конфигурация ---
if [ ! -f .env ]; then
    cp .env.example .env
    log "Создан .env из шаблона"
else
    log ".env уже существует"
fi

echo ""
info "Настройка GigaChat и Max"
echo ""

# GigaChat
if grep -q "^GIGACHAT_CREDENTIALS=$" .env 2>/dev/null; then
    echo -e "${CYAN}GigaChat credentials (Base64 от client_id:client_secret)${NC}"
    echo "  Получить: https://developers.sber.ru → API ключи"
    read -rp "  GIGACHAT_CREDENTIALS: " GIGACHAT_CRED
    if [ -n "$GIGACHAT_CRED" ]; then
        sed -i "s/^GIGACHAT_CREDENTIALS=$/GIGACHAT_CREDENTIALS=$GIGACHAT_CRED/" .env
        log "GigaChat credentials сохранены"
    else
        warn "Пропущено — заполните позже в .env"
    fi
fi

echo ""

# Max Bot Token
if grep -q "^MAX_BOT_TOKEN=$" .env 2>/dev/null; then
    echo -e "${CYAN}Max Bot Token${NC}"
    echo "  Получить: https://dev.max.ru → Создать бота"
    read -rp "  MAX_BOT_TOKEN: " MAX_TOKEN
    if [ -n "$MAX_TOKEN" ]; then
        sed -i "s/^MAX_BOT_TOKEN=$/MAX_BOT_TOKEN=$MAX_TOKEN/" .env
        log "Max Bot Token сохранён"
    else
        warn "Пропущено — заполните позже в .env"
    fi
fi

echo ""

# --- Выбор варианта ---
echo -e "${CYAN}Выберите вариант интеграции GigaChat:${NC}"
echo "  1) Нативный плагин (рекомендуется для продакшн)"
echo "  2) gpt2giga proxy (быстрый старт, покрывает все edge cases)"
echo ""
read -rp "Вариант (1/2): " VARIANT

COMPOSE_FILE="docker-compose.yml"
if [ "$VARIANT" = "2" ]; then
    COMPOSE_FILE="docker-compose.gpt2giga.yml"
    log "Выбран gpt2giga вариант"
else
    log "Выбран нативный плагин"
fi

echo ""

# --- Запуск ---
read -rp "Запустить OpenClawMax? (y/n): " START
if [ "$START" = "y" ]; then
    info "Запускаю..."
    docker compose -f "$COMPOSE_FILE" pull
    docker compose -f "$COMPOSE_FILE" up -d

    echo ""
    log "OpenClawMax запущен!"
    echo ""
    echo -e "  ${GREEN}Web UI:${NC}  http://localhost:${OPENCLAW_PORT:-3000}"
    echo -e "  ${GREEN}Логи:${NC}    docker compose -f $COMPOSE_FILE logs -f"
    echo -e "  ${GREEN}Стоп:${NC}    docker compose -f $COMPOSE_FILE down"
    echo ""

    if [ "$VARIANT" = "2" ]; then
        echo -e "  ${CYAN}gpt2giga:${NC}  http://localhost:8090/docs"
    fi
else
    echo ""
    log "Установка завершена. Запуск:"
    echo "  cd $INSTALL_DIR"
    echo "  docker compose -f $COMPOSE_FILE up -d"
fi

echo ""
info "Документация: $INSTALL_DIR/docs/"
info "Конфиг: $INSTALL_DIR/.env"
echo ""

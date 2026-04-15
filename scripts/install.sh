#!/usr/bin/env bash
# ============================================
# OpenClawMax — Интерактивный установщик
# ============================================
# Запуск:
#   curl -sSL https://raw.githubusercontent.com/user/Openclawmax/main/scripts/install.sh | bash
#   или: bash scripts/install.sh

set -euo pipefail

# --- Цвета ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
info()  { echo -e "${CYAN}[i]${NC} $1"; }
header() { echo -e "\n${BOLD}${CYAN}── $1 ──${NC}\n"; }

INSTALL_DIR="${INSTALL_DIR:-$HOME/openclawmax}"
REPO_URL="https://github.com/Forspeed911/Openclawmax.git"

# ============================================
# Баннер
# ============================================
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         OpenClawMax — Установка          ║${NC}"
echo -e "${CYAN}║   AI-бот: GigaChat + Max / Telegram      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# 1. Проверка и установка зависимостей
# ============================================
header "Проверка зависимостей"

# Определяем пакетный менеджер
detect_pkg_manager() {
    if command -v apt-get &>/dev/null; then
        echo "apt"
    elif command -v dnf &>/dev/null; then
        echo "dnf"
    elif command -v yum &>/dev/null; then
        echo "yum"
    else
        echo ""
    fi
}

PKG_MANAGER=$(detect_pkg_manager)

install_pkg() {
    local pkg="$1"
    if [ -z "$PKG_MANAGER" ]; then
        err "Не удалось определить пакетный менеджер. Установите $pkg вручную"
        exit 1
    fi
    info "Устанавливаю $pkg..."
    case "$PKG_MANAGER" in
        apt)
            sudo apt-get update -qq && sudo apt-get install -y -qq "$pkg"
            ;;
        dnf)
            sudo dnf install -y -q "$pkg"
            ;;
        yum)
            sudo yum install -y -q "$pkg"
            ;;
    esac
}

install_docker() {
    info "Устанавливаю Docker..."
    if [ "$PKG_MANAGER" = "apt" ]; then
        # Официальный способ для Debian/Ubuntu
        sudo apt-get update -qq
        sudo apt-get install -y -qq ca-certificates gnupg
        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
        sudo chmod a+r /etc/apt/keyrings/docker.gpg
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
          $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
          sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update -qq
        sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    elif [ "$PKG_MANAGER" = "dnf" ] || [ "$PKG_MANAGER" = "yum" ]; then
        sudo $PKG_MANAGER install -y -q yum-utils 2>/dev/null || true
        sudo $PKG_MANAGER config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null || \
        sudo $PKG_MANAGER config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo 2>/dev/null || true
        sudo $PKG_MANAGER install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    else
        err "Не удалось установить Docker автоматически"
        echo "  Установите вручную: https://docs.docker.com/engine/install/"
        exit 1
    fi
    sudo systemctl start docker
    sudo systemctl enable docker
    # Добавляем текущего пользователя в группу docker
    if ! groups | grep -q docker; then
        sudo usermod -aG docker "$USER"
        warn "Пользователь добавлен в группу docker. Может потребоваться перелогиниться"
    fi
    log "Docker установлен"
}

# --- curl (нужен первым — для установки Docker) ---
if ! command -v curl &>/dev/null; then
    install_pkg "curl"
fi
log "curl: $(command -v curl)"

# --- git ---
if ! command -v git &>/dev/null; then
    install_pkg "git"
fi
log "git: $(command -v git)"

# --- docker ---
if ! command -v docker &>/dev/null; then
    install_docker
fi
log "docker: $(command -v docker)"

# --- docker compose ---
if ! docker compose version &>/dev/null 2>&1; then
    if docker-compose version &>/dev/null 2>&1; then
        log "docker compose: docker-compose (legacy)"
    else
        warn "docker compose plugin не найден, пробую доустановить..."
        if [ "$PKG_MANAGER" = "apt" ]; then
            sudo apt-get install -y -qq docker-compose-plugin
        elif [ "$PKG_MANAGER" = "dnf" ] || [ "$PKG_MANAGER" = "yum" ]; then
            sudo $PKG_MANAGER install -y -q docker-compose-plugin
        fi
        if ! docker compose version &>/dev/null 2>&1; then
            err "Не удалось установить docker compose"
            exit 1
        fi
    fi
fi
log "docker compose: ✓"

# ============================================
# 2. Клонирование / обновление
# ============================================
header "Репозиторий"

if [ -d "$INSTALL_DIR" ]; then
    warn "Директория $INSTALL_DIR уже существует"
    read -rp "  Обновить? (y/n) [y]: " UPDATE
    UPDATE="${UPDATE:-y}"
    if [ "$UPDATE" = "y" ]; then
        info "Обновляю..."
        cd "$INSTALL_DIR" && git pull origin main
    fi
else
    info "Клонирую репозиторий..."
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
log "Репозиторий: $INSTALL_DIR"

# Клонируем / обновляем исходники OpenClaw
OPENCLAW_REPO="https://github.com/openclaw/openclaw.git"
if [ -d "openclaw-src" ]; then
    info "openclaw-src уже существует, обновляю..."
    cd openclaw-src && git pull origin main && cd ..
else
    info "Клонирую OpenClaw (исходники для Docker-сборки)..."
    git clone --depth 1 "$OPENCLAW_REPO" openclaw-src
fi
log "OpenClaw исходники: $INSTALL_DIR/openclaw-src"

# Создаём .env если нет
if [ ! -f .env ]; then
    cp .env.example .env
    log "Создан .env из шаблона"
fi

# ============================================
# 3. Выбор LLM модели
# ============================================
header "Шаг 1: Выбор LLM модели"

echo -e "  ${BOLD}Доступные провайдеры:${NC}"
echo -e "  ${CYAN}1)${NC} GigaChat (Sber) — российская LLM"
echo ""
read -rp "  Выберите провайдер [1]: " LLM_CHOICE
LLM_CHOICE="${LLM_CHOICE:-1}"

case "$LLM_CHOICE" in
    1)
        log "Выбран: GigaChat (Sber)"
        ;;
    *)
        warn "Неизвестный провайдер, используем GigaChat"
        LLM_CHOICE=1
        ;;
esac

# ============================================
# 4. Выбор подмодели GigaChat
# ============================================
header "Шаг 2: Выбор модели GigaChat"

echo -e "  ${BOLD}Модели GigaChat 2:${NC}"
echo -e "  ${CYAN}1)${NC} GigaChat-2       — Lite (бесплатно, текст)"
echo -e "  ${CYAN}2)${NC} GigaChat-2-Pro   — Pro (текст + картинки)"
echo -e "  ${CYAN}3)${NC} GigaChat-2-Max   — Max (текст + картинки + аудио) ${GREEN}[рекомендуется]${NC}"
echo ""
read -rp "  Выберите модель [3]: " MODEL_CHOICE
MODEL_CHOICE="${MODEL_CHOICE:-3}"

case "$MODEL_CHOICE" in
    1) GIGACHAT_MODEL="GigaChat-2" ;;
    2) GIGACHAT_MODEL="GigaChat-2-Pro" ;;
    3) GIGACHAT_MODEL="GigaChat-2-Max" ;;
    *) GIGACHAT_MODEL="GigaChat-2-Max"; warn "Неизвестная модель, используем GigaChat-2-Max" ;;
esac

log "Модель: $GIGACHAT_MODEL"
sed -i "s/^GIGACHAT_MODEL=.*/GIGACHAT_MODEL=$GIGACHAT_MODEL/" .env

# ============================================
# 5. Реквизиты GigaChat
# ============================================
header "Шаг 3: Реквизиты GigaChat"

# Проверяем, есть ли уже AUTH_KEY
EXISTING_KEY=$(grep "^GIGACHAT_AUTH_KEY=" .env | cut -d'=' -f2-)
if [ -n "$EXISTING_KEY" ]; then
    echo -e "  ${GREEN}AUTH_KEY уже задан${NC} (${EXISTING_KEY:0:10}...)"
    read -rp "  Заменить? (y/n) [n]: " REPLACE_KEY
    REPLACE_KEY="${REPLACE_KEY:-n}"
else
    REPLACE_KEY="y"
fi

if [ "$REPLACE_KEY" = "y" ]; then
    echo ""
    echo -e "  ${BOLD}Как получить:${NC}"
    echo -e "  1. Зайдите на ${CYAN}https://developers.sber.ru${NC}"
    echo -e "  2. Создайте проект → получите Client ID и Client Secret"
    echo -e "  3. Сформируйте Base64: echo -n 'client_id:client_secret' | base64"
    echo ""
    echo -e "  ${YELLOW}Вариант A:${NC} Вставьте готовый Base64-ключ (AUTH_KEY)"
    echo -e "  ${YELLOW}Вариант B:${NC} Введите Client ID и Client Secret отдельно"
    echo ""
    read -rp "  Выберите вариант (a/b) [a]: " AUTH_VARIANT
    AUTH_VARIANT="${AUTH_VARIANT:-a}"

    if [ "$AUTH_VARIANT" = "b" ] || [ "$AUTH_VARIANT" = "B" ]; then
        read -rp "  Client ID: " CLIENT_ID
        read -rsp "  Client Secret: " CLIENT_SECRET
        echo ""
        if [ -n "$CLIENT_ID" ] && [ -n "$CLIENT_SECRET" ]; then
            GIGACHAT_AUTH_KEY=$(echo -n "${CLIENT_ID}:${CLIENT_SECRET}" | base64 -w0)
            log "AUTH_KEY сформирован из Client ID + Secret"
        else
            warn "Пропущено — заполните GIGACHAT_AUTH_KEY в .env позже"
            GIGACHAT_AUTH_KEY=""
        fi
    else
        read -rp "  GIGACHAT_AUTH_KEY: " GIGACHAT_AUTH_KEY
    fi

    if [ -n "$GIGACHAT_AUTH_KEY" ]; then
        sed -i "s|^GIGACHAT_AUTH_KEY=.*|GIGACHAT_AUTH_KEY=$GIGACHAT_AUTH_KEY|" .env
        log "AUTH_KEY сохранён"
    fi
fi

# Scope
echo ""
echo -e "  ${BOLD}API Scope:${NC}"
echo -e "  ${CYAN}1)${NC} GIGACHAT_API_PERS — физлица (бесплатно) ${GREEN}[по умолчанию]${NC}"
echo -e "  ${CYAN}2)${NC} GIGACHAT_API_B2B  — бизнес"
echo -e "  ${CYAN}3)${NC} GIGACHAT_API_CORP — корпоративный"
echo ""
read -rp "  Scope [1]: " SCOPE_CHOICE
SCOPE_CHOICE="${SCOPE_CHOICE:-1}"

case "$SCOPE_CHOICE" in
    1) GIGACHAT_SCOPE="GIGACHAT_API_PERS" ;;
    2) GIGACHAT_SCOPE="GIGACHAT_API_B2B" ;;
    3) GIGACHAT_SCOPE="GIGACHAT_API_CORP" ;;
    *) GIGACHAT_SCOPE="GIGACHAT_API_PERS" ;;
esac

sed -i "s/^GIGACHAT_SCOPE=.*/GIGACHAT_SCOPE=$GIGACHAT_SCOPE/" .env
log "Scope: $GIGACHAT_SCOPE"

# ============================================
# 6. Выбор мессенджера
# ============================================
header "Шаг 4: Выбор мессенджера"

echo -e "  ${BOLD}Куда подключить бота:${NC}"
echo -e "  ${CYAN}1)${NC} Max Messenger (VK) — российский мессенджер"
echo -e "  ${CYAN}2)${NC} Telegram"
echo -e "  ${CYAN}3)${NC} Оба (Max + Telegram)"
echo ""
read -rp "  Выберите [1]: " MSG_CHOICE
MSG_CHOICE="${MSG_CHOICE:-1}"

USE_MAX=false
USE_TELEGRAM=false

case "$MSG_CHOICE" in
    1) USE_MAX=true ;;
    2) USE_TELEGRAM=true ;;
    3) USE_MAX=true; USE_TELEGRAM=true ;;
    *) USE_MAX=true; warn "Используем Max по умолчанию" ;;
esac

# --- Max Bot Token ---
if [ "$USE_MAX" = true ]; then
    echo ""
    EXISTING_MAX=$(grep "^MAX_BOT_TOKEN=" .env | cut -d'=' -f2-)
    if [ -n "$EXISTING_MAX" ]; then
        echo -e "  ${GREEN}Max Bot Token уже задан${NC}"
        read -rp "  Заменить? (y/n) [n]: " REPLACE_MAX
        REPLACE_MAX="${REPLACE_MAX:-n}"
    else
        REPLACE_MAX="y"
    fi

    if [ "$REPLACE_MAX" = "y" ]; then
        echo -e "  ${BOLD}Как получить:${NC}"
        echo -e "  1. Зайдите на ${CYAN}https://dev.max.ru${NC}"
        echo -e "  2. Создайте бота → скопируйте токен"
        echo -e "  ${YELLOW}Важно: нужен аккаунт юрлица или ИП${NC}"
        echo ""
        read -rp "  MAX_BOT_TOKEN: " MAX_TOKEN
        if [ -n "$MAX_TOKEN" ]; then
            sed -i "s|^MAX_BOT_TOKEN=.*|MAX_BOT_TOKEN=$MAX_TOKEN|" .env
            log "Max Bot Token сохранён"
        else
            warn "Пропущено — заполните MAX_BOT_TOKEN в .env позже"
        fi
    fi
fi

# --- Telegram Bot Token ---
if [ "$USE_TELEGRAM" = true ]; then
    echo ""
    EXISTING_TG=$(grep "^TELEGRAM_BOT_TOKEN=" .env | cut -d'=' -f2-)
    if [ -n "$EXISTING_TG" ]; then
        echo -e "  ${GREEN}Telegram Bot Token уже задан${NC}"
        read -rp "  Заменить? (y/n) [n]: " REPLACE_TG
        REPLACE_TG="${REPLACE_TG:-n}"
    else
        REPLACE_TG="y"
    fi

    if [ "$REPLACE_TG" = "y" ]; then
        echo -e "  Создайте бота через ${CYAN}@BotFather${NC} в Telegram"
        echo ""
        read -rp "  TELEGRAM_BOT_TOKEN: " TG_TOKEN
        if [ -n "$TG_TOKEN" ]; then
            sed -i "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TG_TOKEN|" .env
            log "Telegram Bot Token сохранён"
        else
            warn "Пропущено — заполните TELEGRAM_BOT_TOKEN в .env позже"
        fi
    fi
fi

# ============================================
# 7. Итоги конфигурации
# ============================================
header "Конфигурация"

echo -e "  LLM:        ${GREEN}GigaChat${NC} ($GIGACHAT_MODEL)"
echo -e "  Scope:      ${GREEN}$GIGACHAT_SCOPE${NC}"
if [ "$USE_MAX" = true ]; then
    echo -e "  Мессенджер: ${GREEN}Max Messenger${NC}"
fi
if [ "$USE_TELEGRAM" = true ]; then
    echo -e "  Мессенджер: ${GREEN}Telegram${NC}"
fi
echo -e "  Порт:       ${GREEN}${OPENCLAW_PORT:-3000}${NC}"
echo ""

# ============================================
# 8. Сборка и запуск
# ============================================
read -rp "Собрать и запустить OpenClawMax? (y/n) [y]: " START
START="${START:-y}"

if [ "$START" = "y" ]; then
    header "Сборка Docker-образа"
    info "Это может занять 3-10 минут при первой сборке..."
    echo ""

    docker compose build --no-cache 2>&1 | tail -5
    log "Образ собран"

    header "Запуск"
    docker compose up -d

    # Ждём пока сервисы поднимутся
    info "Ожидаю запуск сервисов..."
    RETRIES=0
    MAX_RETRIES=30
    while [ $RETRIES -lt $MAX_RETRIES ]; do
        if docker compose ps --format json 2>/dev/null | grep -q '"running"'; then
            break
        fi
        sleep 2
        RETRIES=$((RETRIES + 1))
    done

    # Проверка статуса
    echo ""
    header "Статус"
    docker compose ps

    # Проверяем gpt2giga health
    echo ""
    RETRIES=0
    info "Проверяю gpt2giga прокси..."
    while [ $RETRIES -lt 15 ]; do
        if curl -sf http://localhost:8090/health &>/dev/null; then
            log "gpt2giga: работает"
            break
        fi
        sleep 3
        RETRIES=$((RETRIES + 1))
    done
    if [ $RETRIES -eq 15 ]; then
        warn "gpt2giga не отвечает — проверьте логи: docker compose logs gpt2giga"
    fi

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       OpenClawMax — Запущен!             ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BOLD}Web UI:${NC}    http://localhost:${OPENCLAW_PORT:-3000}"
    echo -e "  ${BOLD}Логи:${NC}      docker compose logs -f"
    echo -e "  ${BOLD}Стоп:${NC}      docker compose down"
    echo -e "  ${BOLD}Рестарт:${NC}   docker compose restart"
    echo ""
    if [ "$USE_MAX" = true ]; then
        echo -e "  ${CYAN}Откройте Max и напишите боту — он ответит через GigaChat!${NC}"
    fi
    if [ "$USE_TELEGRAM" = true ]; then
        echo -e "  ${CYAN}Откройте Telegram и напишите боту — он ответит через GigaChat!${NC}"
    fi
    echo ""
else
    echo ""
    log "Установка завершена. Для запуска:"
    echo "  cd $INSTALL_DIR"
    echo "  docker compose build"
    echo "  docker compose up -d"
fi

info "Конфиг: $INSTALL_DIR/.env"
info "Документация: $INSTALL_DIR/docs/"
echo ""

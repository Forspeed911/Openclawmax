#!/usr/bin/env bash
set -euo pipefail

# OpenClawMax — Сборка Docker-образа
# Клонирует upstream OpenClaw, копирует наши плагины, собирает образ

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OPENCLAW_REPO="https://github.com/openclaw/openclaw.git"
BUILD_DIR="${REPO_DIR}/openclaw-src"
IMAGE_NAME="${IMAGE_NAME:-openclawmax:latest}"

echo "[build] Repo dir: ${REPO_DIR}"
echo "[build] Image: ${IMAGE_NAME}"

# --- 1. Clone or update openclaw ---
if [ -d "${BUILD_DIR}/.git" ]; then
    echo "[build] Updating openclaw-src..."
    git -C "${BUILD_DIR}" pull --ff-only 2>/dev/null || true
else
    echo "[build] Cloning openclaw..."
    git clone --depth 1 "${OPENCLAW_REPO}" "${BUILD_DIR}"
fi

# --- 2. Copy extensions into openclaw-src ---
echo "[build] Copying extensions..."
mkdir -p "${BUILD_DIR}/extensions"
cp -r "${REPO_DIR}/extensions/gigachat" "${BUILD_DIR}/extensions/gigachat"
cp -r "${REPO_DIR}/extensions/max" "${BUILD_DIR}/extensions/max"

# --- 3. Copy our config ---
cp "${REPO_DIR}/config/openclaw.config.json" "${BUILD_DIR}/openclaw.config.json"

# --- 4. Build Docker image ---
echo "[build] Building Docker image (this may take a while)..."
cd "${BUILD_DIR}"

docker build \
    --build-arg OPENCLAW_EXTENSIONS="gigachat max" \
    -t "${IMAGE_NAME}" \
    -f Dockerfile \
    .

echo "[build] Done! Image: ${IMAGE_NAME}"
docker images "${IMAGE_NAME}"

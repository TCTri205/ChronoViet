#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# ChronoViet — Full Development Stack Starter
# Orchestrates Postgres/Redis + Local AI + Local TTS + Development Workers
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== [ChronoViet] Starting Local Development Stack ==="

# 1. Start Database & Redis via Docker Compose
echo "[Stack] Starting Postgres & Redis infrastructure..."
cd "${ROOT_DIR}"
pnpm stack:infra

# Clean up trap for graceful shutdown
cleanup() {
  echo ""
  echo "=== [ChronoViet] Gracefully shutting down stack... ==="
  if [ -n "${TTS_PID:-}" ]; then
    kill "${TTS_PID}" 2>/dev/null || true
  fi
  if [ -n "${AI_PID:-}" ]; then
    kill "${AI_PID}" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 2. Start TTS Service in background
echo "[Stack] Launching TTS engine..."
"${SCRIPT_DIR}/start-tts-local.sh" &
TTS_PID=$!

# 3. Start Local AI / Check Cloud Gateway
echo "[Stack] Checking AI Gateway / llama-server..."
"${SCRIPT_DIR}/start-local-ai.sh" &
AI_PID=$!

echo "[Stack] Infrastructure and auxiliary services are ready!"
echo "[Stack] You can now run 'pnpm dev' in another terminal to launch Web App & Worker."

# Keep stack running
wait

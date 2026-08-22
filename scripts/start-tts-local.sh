#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# ChronoViet — VieNeu TTS Docker Starter Script
# Starts VieNeu TTS FastAPI ONNX Container (port 8080) via Docker Compose
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== [VieNeu TTS] Starting VieNeu TTS Container (Port 8080) ==="
cd "${ROOT_DIR}"
docker compose --profile tts up -d --build --quiet-pull vieneu-tts-service >/dev/null 2>&1 || docker compose --profile tts up -d vieneu-tts-service

echo "[VieNeu TTS] Waiting for healthcheck..."
for i in {1..30}; do
  if curl -s -f http://localhost:8080/health >/dev/null 2>&1; then
    echo "=== [VieNeu TTS] Container is UP & HEALTHY on http://localhost:8080 ==="
    exit 0
  fi
  sleep 1
done

echo "[VieNeu TTS] Notice: VieNeu TTS container took longer than expected to initialize; continuing with fallback."


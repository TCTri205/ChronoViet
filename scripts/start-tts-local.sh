#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# ChronoViet — VieNeu TTS Docker Starter Script
# Starts VieNeu TTS FastAPI ONNX Container (port 8080) via Docker Compose
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== [VieNeu TTS] Launching Docker Container vieneu-tts-service (Port 8080) ==="
cd "${ROOT_DIR}"
docker compose up -d vieneu-tts-service

echo "[VieNeu TTS] Waiting for healthcheck..."
until docker compose exec -T vieneu-tts-service curl -s -f http://localhost:8080/health >/dev/null 2>&1; do
  sleep 1
done

echo "=== [VieNeu TTS] Container is UP & HEALTHY on http://localhost:8080 ==="


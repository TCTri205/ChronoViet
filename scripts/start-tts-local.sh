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

echo "[VieNeu TTS] Waiting for VieNeu-TTS neural model to load (up to 120s)..."
for i in {1..120}; do
  if curl -s -f http://localhost:8080/health >/dev/null 2>&1; then
    HEALTH_JSON=$(curl -s http://localhost:8080/health)
    if echo "${HEALTH_JSON}" | grep -q "VIENEU_OFFICIAL_V3TURBO"; then
      echo "=== [VieNeu TTS] Official VieNeu-TTS v3turbo is UP & HEALTHY on http://localhost:8080 ==="
      exit 0
    fi
  fi
  if (( i % 10 == 0 )); then
    echo "[VieNeu TTS] Still initializing model weights (${i}s)..."
  fi
  sleep 1
done

echo "❌ [VieNeu TTS] Container failed to become healthy within 120s."
docker logs vieneu_tts_engine --tail 20
exit 1



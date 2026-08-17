#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# ChronoViet — VieNeu TTS Local Starter Script
# Starts VieNeu TTS FastAPI ONNX Engine (port 8080) with automatic Node fallback
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load .env if present
if [ -f "${ROOT_DIR}/.env" ]; then
  # export variables from .env
  set -a
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env"
  set +a
fi

TTS_PORT="${TTS_SERVICE_PORT:-8080}"
HYBRID_DEV="${HYBRID_DEV:-false}"
PYTHON_APP="${ROOT_DIR}/services/vieneu-tts/app.py"

echo "=== [VieNeu TTS] Starting TTS Engine on Port ${TTS_PORT} ==="
echo "Mode: HYBRID_DEV=${HYBRID_DEV}"

# 1. Try Python FastAPI ONNX Engine if Python 3 is available
if command -v python3 >/dev/null 2>&1 && [ -f "${PYTHON_APP}" ]; then
  VENV_DIR="${ROOT_DIR}/services/vieneu-tts/.venv"
  if [ ! -d "${VENV_DIR}" ]; then
    echo "[VieNeu TTS] Creating virtual environment at ${VENV_DIR}..."
    python3 -m venv "${VENV_DIR}" || true
  fi

  if [ -f "${VENV_DIR}/bin/activate" ]; then
    # shellcheck source=/dev/null
    source "${VENV_DIR}/bin/activate"
  fi

  # Check if uvicorn & fastapi are installed
  if python3 -c "import fastapi, uvicorn, soundfile" 2>/dev/null; then
    echo "[VieNeu TTS] Starting Python FastAPI ONNX Service..."
    exec uvicorn --app-dir "${ROOT_DIR}/services/vieneu-tts" app:app --host 0.0.0.0 --port "${TTS_PORT}" --reload
  else
    echo "[VieNeu TTS] FastAPI/soundfile dependencies not found in Python environment."
  fi
fi

# 2. Hybrid Dev Fallback: Node.js Synthetic Wrapper
if [ "${HYBRID_DEV}" = "true" ] || [ "${ENABLE_CLOUD_FALLBACK}" = "true" ]; then
  echo "[VieNeu TTS] [HYBRID_DEV] Falling back to Node.js VieNeu Service wrapper..."
  cd "${ROOT_DIR}"
  exec pnpm --filter @chronoviet/vieneu-tts start
fi

echo "[VieNeu TTS] ERROR: Python ONNX dependencies missing and HYBRID_DEV is false."
echo "Please run: pip install fastapi uvicorn soundfile numpy pydantic onnxruntime"
exit 1

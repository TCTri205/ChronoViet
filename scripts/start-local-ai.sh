#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# ChronoViet — Local AI (LLM & Embedding) Starter Script
# Launches llama-server for Qwen3.5 LLM and Embedding models with Agnes Fallback
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load .env if present
if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env"
  set +a
fi

HYBRID_DEV="${HYBRID_DEV:-false}"
LLM_PORT="${LLM_PORT:-8091}"
EMBEDDING_PORT="${EMBEDDING_PORT:-8090}"
MODEL_DIR="${MODEL_DIR:-${ROOT_DIR}/models}"

echo "=== [Local AI Gateway] Starting AI Infrastructure ==="
echo "Config: LLM_PORT=${LLM_PORT}, EMBEDDING_PORT=${EMBEDDING_PORT}, HYBRID_DEV=${HYBRID_DEV}"

# 1. Check if llama-server CLI is installed
if command -v llama-server >/dev/null 2>&1; then
  LLM_MODEL_PATH="${MODEL_DIR}/qwen3.5-27b-instruct-q4_k_m.gguf"
  EMB_MODEL_PATH="${MODEL_DIR}/qwen3-embedding-0.6b.gguf"

  if [ -f "${LLM_MODEL_PATH}" ]; then
    echo "[Local AI] Starting LLM llama-server on port ${LLM_PORT}..."
    llama-server -m "${LLM_MODEL_PATH}" --port "${LLM_PORT}" --ctx-size 8192 --n-gpu-layers 99 &
    LLM_PID=$!
    echo "[Local AI] LLM server running with PID ${LLM_PID}"
  else
    echo "[Local AI] WARNING: LLM model not found at ${LLM_MODEL_PATH}"
  fi

  if [ -f "${EMB_MODEL_PATH}" ]; then
    echo "[Local AI] Starting Embedding llama-server on port ${EMBEDDING_PORT}..."
    llama-server -m "${EMB_MODEL_PATH}" --port "${EMBEDDING_PORT}" --embedding --ctx-size 4096 &
    EMB_PID=$!
    echo "[Local AI] Embedding server running with PID ${EMB_PID}"
  fi

  trap 'echo "[Local AI] Shutting down..."; kill ${LLM_PID:-} ${EMB_PID:-} 2>/dev/null || true' EXIT
  wait
fi

# 2. Hybrid Dev / Agnes 2.0 Flash Cloud Mode
if [ "${HYBRID_DEV}" = "true" ] || [ -n "${AGNES_API_KEY}" ]; then
  echo "[Local AI] [HYBRID_DEV] Local llama-server not present."
  if [ -n "${AGNES_API_KEY}" ] && [ "${AGNES_API_KEY}" != "your_agnes_api_key_here" ]; then
    echo "[Local AI] ✅ AGNES_API_KEY is configured. System will use Agnes 2.0 Flash for generation."
    exit 0
  else
    echo "[Local AI] ⚠️ AGNES_API_KEY is not configured in .env. Please set AGNES_API_KEY for cloud fallback."
    exit 0
  fi
fi

echo "[Local AI] ERROR: llama-server not found in PATH and AGNES_API_KEY not configured."
echo "Install llama.cpp or set HYBRID_DEV=true and AGNES_API_KEY in .env."
exit 1

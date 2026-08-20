#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# ChronoViet — Local AI (LLM & Embedding) Starter Script
# Launches llama-server for Qwen3.8 LLM and Embedding models with Agnes Fallback
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
MODEL_DIR="${MODEL_DIR:-${ROOT_DIR}/models}"
AGNES_API_KEY="${AGNES_API_KEY:-${AGNES_API_KEYS%%,*}}"

# Auto-derive ports from URL config if not explicitly set
if [ -z "${LLM_PORT:-}" ] && [ -n "${LLM_BASE_URL:-}" ]; then
  PARSED_LLM_PORT=$(echo "${LLM_BASE_URL}" | sed -E 's|^https?://[^:/]+:([0-9]+).*|\1|')
  if [ "${PARSED_LLM_PORT}" != "${LLM_BASE_URL}" ] && [ -n "${PARSED_LLM_PORT}" ]; then
    LLM_PORT="${PARSED_LLM_PORT}"
  fi
fi
LLM_PORT="${LLM_PORT:-8092}"

if [ -z "${EMBEDDING_PORT:-}" ] && [ -n "${EMBEDDING_API_URL:-}" ]; then
  PARSED_EMB_PORT=$(echo "${EMBEDDING_API_URL}" | sed -E 's|^https?://[^:/]+:([0-9]+).*|\1|')
  if [ "${PARSED_EMB_PORT}" != "${EMBEDDING_API_URL}" ] && [ -n "${PARSED_EMB_PORT}" ]; then
    EMBEDDING_PORT="${PARSED_EMB_PORT}"
  fi
fi
EMBEDDING_PORT="${EMBEDDING_PORT:-8090}"

echo "=== [Local AI Gateway] Starting AI Infrastructure ==="
echo "Config: LLM_PORT=${LLM_PORT}, EMBEDDING_PORT=${EMBEDDING_PORT}, HYBRID_DEV=${HYBRID_DEV}"

# 1. Check if llama-server CLI is installed
if command -v llama-server >/dev/null 2>&1; then
  LLM_MODEL_PATH="${MODEL_DIR}/${LOCAL_LLM_PRIMARY_MODEL:-qwen3.8-27b-instruct-q4_k_m}.gguf"
  if [ ! -f "${LLM_MODEL_PATH}" ] && [ -f "${MODEL_DIR}/Qwen3.8-27B-Q4_K_M.gguf" ]; then
    LLM_MODEL_PATH="${MODEL_DIR}/Qwen3.8-27B-Q4_K_M.gguf"
  elif [ ! -f "${LLM_MODEL_PATH}" ] && [ -f "${MODEL_DIR}/qwen3.8-27b-instruct-q4_k_m.gguf" ]; then
    LLM_MODEL_PATH="${MODEL_DIR}/qwen3.8-27b-instruct-q4_k_m.gguf"
  fi
  MMPROJ_PATH="${MODEL_DIR}/qwen3.8-27b-mmproj.gguf"
  
  # Resolve embedding model path
  EMB_MODEL_NAME="${LOCAL_EMBEDDING_MODEL:-${LOCAL_EMBEDDING_DEFAULT:-bge-m3}}"
  EMB_MODEL_PATH="${MODEL_DIR}/${EMB_MODEL_NAME}.gguf"
  if [ ! -f "${EMB_MODEL_PATH}" ] && [ -f "${MODEL_DIR}/bge-m3-q8_0.gguf" ]; then
    EMB_MODEL_PATH="${MODEL_DIR}/bge-m3-q8_0.gguf"
  elif [ ! -f "${EMB_MODEL_PATH}" ] && [ -f "${MODEL_DIR}/bge-m3.gguf" ]; then
    EMB_MODEL_PATH="${MODEL_DIR}/bge-m3.gguf"
  elif [ ! -f "${EMB_MODEL_PATH}" ] && [ -f "${MODEL_DIR}/qwen3-embedding-0.6b.gguf" ]; then
    EMB_MODEL_PATH="${MODEL_DIR}/qwen3-embedding-0.6b.gguf"
  fi

  if [ -f "${LLM_MODEL_PATH}" ]; then
    echo "[Local AI] Starting Unified LLM/VLM llama-server on port ${LLM_PORT} (Flash Attention + Q8_0 KV Cache + Continuous Batching)..."
    EXTRA_ARGS=""
    if [ -f "${MMPROJ_PATH}" ] && echo "${LLM_MODEL_PATH}" | grep -Eqi "([-_]vl[-_.]|qwen.*vl)"; then
      echo "[Local AI] ✅ Multimodal projector found for VL model: ${MMPROJ_PATH}"
      EXTRA_ARGS="--mmproj ${MMPROJ_PATH}"
    fi
    LLM_CTX_SIZE="${LLM_CTX_SIZE:-16384}"
    llama-server \
      -m "${LLM_MODEL_PATH}" \
      --port "${LLM_PORT}" \
      --ctx-size "${LLM_CTX_SIZE}" \
      --n-gpu-layers 99 \
      --flash-attn auto \
      --cache-type-k q8_0 \
      --cache-type-v q8_0 \
      --cont-batching \
      --parallel 2 \
      ${EXTRA_ARGS} ${LLM_EXTRA_ARGS:-} &
    LLM_PID=$!
    echo "[Local AI] LLM/VLM server running with PID ${LLM_PID}"
  else
    echo "[Local AI] WARNING: LLM model not found at ${LLM_MODEL_PATH}"
  fi

  if [ -f "${EMB_MODEL_PATH}" ]; then
    echo "[Local AI] Starting Embedding llama-server on port ${EMBEDDING_PORT} (model: $(basename "${EMB_MODEL_PATH}"))..."
    EMBEDDING_CTX_SIZE="${EMBEDDING_CTX_SIZE:-8192}"
    llama-server \
      -m "${EMB_MODEL_PATH}" \
      --port "${EMBEDDING_PORT}" \
      --embedding \
      --ctx-size "${EMBEDDING_CTX_SIZE}" \
      --batch-size 8192 \
      --ubatch-size 8192 \
      --parallel 4 \
      --cont-batching \
      --n-gpu-layers 99 \
      --flash-attn auto \
      ${EMBEDDING_EXTRA_ARGS:-} &
    EMB_PID=$!
    echo "[Local AI] Embedding server running with PID ${EMB_PID}"
  fi

  # Stage 2 Extraction Server (Port 8094 / Qwen3.5-4B-Instruct)
  EXTRACTION_PORT="${EXTRACTION_PORT:-8094}"
  EXT_MODEL_PATH="${MODEL_DIR}/${LOCAL_LLM_EXTRACTION_MODEL:-qwen3.5-4b-instruct-q4_k_m}.gguf"
  if [ -f "${EXT_MODEL_PATH}" ]; then
    EXTRACTION_CTX_SIZE="${EXTRACTION_CTX_SIZE:-${LOCAL_LLM_EXTRACTION_CTX_SIZE:-8192}}"
    EXTRACTION_PARALLEL="${EXTRACTION_PARALLEL:-${LOCAL_LLM_EXTRACTION_PARALLEL:-4}}"
    EXTRACTION_THREADS="${EXTRACTION_THREADS:-${LOCAL_LLM_EXTRACTION_THREADS:-6}}"
    llama-server \
      -m "${EXT_MODEL_PATH}" \
      --port "${EXTRACTION_PORT}" \
      --ctx-size "${EXTRACTION_CTX_SIZE}" \
      --n-gpu-layers 99 \
      --flash-attn auto \
      --cont-batching \
      --parallel "${EXTRACTION_PARALLEL}" \
      --threads "${EXTRACTION_THREADS}" \
      ${EXTRACTION_EXTRA_ARGS:-} &
    EXT_PID=$!
    echo "[Local AI] Extraction server running with PID ${EXT_PID}"
  fi

  trap 'echo "[Local AI] Shutting down..."; kill ${LLM_PID:-} ${EMB_PID:-} ${EXT_PID:-} 2>/dev/null || true' EXIT
  wait
fi

# 2. Hybrid Dev / Agnes 2.5 Flash Cloud Mode
if [ "${HYBRID_DEV}" = "true" ] || [ -n "${AGNES_API_KEY}" ]; then
  echo "[Local AI] [HYBRID_DEV] Local llama-server not present."
  if [ -n "${AGNES_API_KEY}" ] && [ "${AGNES_API_KEY}" != "your_agnes_api_key_here" ]; then
    echo "[Local AI] ✅ AGNES_API_KEY is configured. System will use Agnes 2.5 Flash for generation."
    exit 0
  else
    echo "[Local AI] ⚠️ AGNES_API_KEY is not configured in .env. Please set AGNES_API_KEY for cloud fallback."
    exit 0
  fi
fi

echo "[Local AI] ERROR: llama-server not found in PATH and AGNES_API_KEY not configured."
echo "Install llama.cpp or set HYBRID_DEV=true and AGNES_API_KEY in .env."
exit 1

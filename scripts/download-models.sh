#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# ChronoViet — Model Weights Downloader & Setup Tool
# Downloads required GGUF weights for Local Dev (macOS) & Production (Linux CUDA)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 1. Load .env if present
if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env"
  set +a
fi

MODEL_DIR="${MODEL_DIR:-${ROOT_DIR}/models}"
HF_AUTH_TOKEN="${HF_TOKEN:-${HUGGINGFACE_HUB_TOKEN:-${HUGGINGFACE_TOKEN:-}}}"

mkdir -p "${MODEL_DIR}"

echo "=============================================================================="
echo " ChronoViet — Model Weights Downloader & Provisioner"
echo " Target Directory: ${MODEL_DIR}"
if [ -n "${HF_AUTH_TOKEN}" ]; then
  echo " HuggingFace Auth: 🔑 Token Detected (Authenticated High-Speed CDN Enabled)"
else
  echo " HuggingFace Auth: ℹ️ Anonymous Mode (Set HF_TOKEN in .env for higher speed)"
fi
echo "=============================================================================="

download_file() {
  local filename="$1"
  local url="$2"
  local target_path="${MODEL_DIR}/${filename}"

  # Mechanism to check existing non-empty model weights and avoid duplicate downloads
  if [ -f "${target_path}" ] && [ -s "${target_path}" ]; then
    echo "✅ [EXISTS] ${filename} ($(du -h "${target_path}" | cut -f1)) — Skipping download."
    return 0
  fi

  echo "⬇️ [DOWNLOADING] ${filename}..."
  echo "   Source URL: ${url}"

  # Multi-connection accelerator (aria2c) if installed, otherwise curl / wget
  if command -v aria2c >/dev/null 2>&1; then
    local aria_auth=()
    if [ -n "${HF_AUTH_TOKEN}" ]; then
      aria_auth=(--header="Authorization: Bearer ${HF_AUTH_TOKEN}")
    fi
    aria2c -x 16 -s 16 -k 1M -c -d "${MODEL_DIR}" -o "${filename}" "${aria_auth[@]}" "${url}"
  elif command -v curl >/dev/null 2>&1; then
    local curl_auth=()
    if [ -n "${HF_AUTH_TOKEN}" ]; then
      curl_auth=(-H "Authorization: Bearer ${HF_AUTH_TOKEN}")
    fi
    curl -L -C - --progress-bar "${curl_auth[@]}" -o "${target_path}" "${url}"
  elif command -v wget >/dev/null 2>&1; then
    local wget_auth=()
    if [ -n "${HF_AUTH_TOKEN}" ]; then
      wget_auth=(--header="Authorization: Bearer ${HF_AUTH_TOKEN}")
    fi
    wget -c "${wget_auth[@]}" -O "${target_path}" "${url}"
  else
    echo "❌ ERROR: Neither aria2c, curl, nor wget found in PATH. Please install one of them."
    exit 1
  fi

  if [ -f "${target_path}" ] && [ -s "${target_path}" ]; then
    echo "✅ [SUCCESS] Downloaded ${filename} successfully."
  else
    echo "❌ [FAILED] Download of ${filename} failed or resulted in empty file."
    rm -f "${target_path}"
    exit 1
  fi
}

echo ""
echo "Select models to download:"
echo "1) Standard Stack: Qwen 3.5 9B (Q4_K_M) + BGE-M3 Embedding + Qwen 3.5 4B Extraction + Qwen 3 Reranker (~9.0 GB)"
echo "2) Lightweight Dev Stack: Qwen 3.5 9B (Q4_K_M) + BGE-M3 Embedding (~6.4 GB)"
echo "3) Embedding Only: BGE-M3 1024d (~605 MB)"
echo "4) Extraction LLM Only: Qwen 3.5 4B (~1.8 GB - Data Ingestion Prep Only)"
echo "5) AI Lite Stack: BGE-M3 + Qwen Extraction LLM (~2.4 GB)"
echo "6) Primary LLM Only: Qwen 3.5 9B (~5.8 GB - Runtime Production)"
echo "7) Reranker Only: Qwen 3 Reranker 0.6B / BGE Reranker v2 (~600-800 MB)"
echo "8) All Models (LLM + VLM Projector + Embedding + Extraction + Reranker + Piper TTS)"
echo "9) VieNeu Piper TTS Only (vi_VN-vivos-medium ONNX + config)"

DOWNLOAD_CHOICE="${1:-1}"

case "${DOWNLOAD_CHOICE}" in
  1|standard)
    echo ">>> Provisioning Standard Production Stack..."
    download_file "bge-m3.gguf" "https://huggingface.co/gpustack/bge-m3-GGUF/resolve/main/bge-m3-Q8_0.gguf"
    download_file "qwen3.5-9b-mmproj.gguf" "https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf"
    download_file "qwen3.5-9b-instruct-q4_k_m.gguf" "https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf"
    download_file "qwen3.5-4b-instruct-q4_k_m.gguf" "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf"
    download_file "qwen3-reranker-0.6b.gguf" "https://huggingface.co/gpustack/bge-reranker-v2-m3-GGUF/resolve/main/bge-reranker-v2-m3-Q8_0.gguf"
    ;;

  2|dev|lightweight)
    echo ">>> Provisioning Lightweight Dev Stack..."
    download_file "bge-m3.gguf" "https://huggingface.co/gpustack/bge-m3-GGUF/resolve/main/bge-m3-Q8_0.gguf"
    download_file "qwen3.5-9b-mmproj.gguf" "https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf"
    download_file "qwen3.5-9b-instruct-q4_k_m.gguf" "https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf"
    ;;

  3|emb|embedding)
    echo ">>> Provisioning Embedding Model Only..."
    download_file "bge-m3.gguf" "https://huggingface.co/gpustack/bge-m3-GGUF/resolve/main/bge-m3-Q8_0.gguf"
    ;;

  4|extract|extraction)
    echo ">>> Provisioning Extraction LLM Model Only (Data Prep)..."
    download_file "qwen3.5-4b-instruct-q4_k_m.gguf" "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf"
    ;;

  5|lite)
    echo ">>> Provisioning AI Lite Stack (BGE-M3 + Extraction LLM)..."
    download_file "bge-m3.gguf" "https://huggingface.co/gpustack/bge-m3-GGUF/resolve/main/bge-m3-Q8_0.gguf"
    download_file "qwen3.5-4b-instruct-q4_k_m.gguf" "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf"
    ;;

  6|llm)
    echo ">>> Provisioning Primary LLM / VLM (Qwen 2.5/3.5 VL 7B/9B)..."
    download_file "qwen3.5-9b-mmproj.gguf" "https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf"
    download_file "qwen3.5-9b-instruct-q4_k_m.gguf" "https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf"
    ;;

  7|rerank|reranker)
    echo ">>> Provisioning Reranker Model Only..."
    download_file "qwen3-reranker-0.6b.gguf" "https://huggingface.co/gpustack/bge-reranker-v2-m3-GGUF/resolve/main/bge-reranker-v2-m3-Q8_0.gguf"
    ;;

  8|all)
    echo ">>> Provisioning All Available Models..."
    download_file "bge-m3.gguf" "https://huggingface.co/gpustack/bge-m3-GGUF/resolve/main/bge-m3-Q8_0.gguf"
    download_file "qwen3.5-9b-mmproj.gguf" "https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf"
    download_file "qwen3.5-9b-instruct-q4_k_m.gguf" "https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf"
    download_file "qwen3.5-4b-instruct-q4_k_m.gguf" "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf"
    download_file "qwen3-reranker-0.6b.gguf" "https://huggingface.co/gpustack/bge-reranker-v2-m3-GGUF/resolve/main/bge-reranker-v2-m3-Q8_0.gguf"
    download_file "vi_VN-vivos-medium.onnx" "https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vivos/medium/vi_VN-vivos-medium.onnx"
    download_file "vi_VN-vivos-medium.onnx.json" "https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vivos/medium/vi_VN-vivos-medium.onnx.json"
    mkdir -p "${ROOT_DIR}/services/vieneu-tts/models"
    cp -f "${MODEL_DIR}/vi_VN-vivos-medium.onnx"* "${ROOT_DIR}/services/vieneu-tts/models/" 2>/dev/null || true
    ;;

  9|tts|piper)
    echo ">>> Provisioning VieNeu Piper Vietnamese TTS Model..."
    download_file "vi_VN-vivos-medium.onnx" "https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vivos/medium/vi_VN-vivos-medium.onnx"
    download_file "vi_VN-vivos-medium.onnx.json" "https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vivos/medium/vi_VN-vivos-medium.onnx.json"
    mkdir -p "${ROOT_DIR}/services/vieneu-tts/models"
    cp -f "${MODEL_DIR}/vi_VN-vivos-medium.onnx"* "${ROOT_DIR}/services/vieneu-tts/models/" 2>/dev/null || true
    ;;

  *)
    echo "Invalid option: ${DOWNLOAD_CHOICE}. Exiting."
    exit 1
    ;;
esac

echo ""
echo "=============================================================================="
echo "✅ All requested model weights are ready in ${MODEL_DIR}"
echo "   - macOS Dev: Run 'pnpm dev:stack' or 'pnpm ai:supervisor'"
echo "   - Linux CUDA: Run 'pnpm stack:prod:all' (or 'pnpm stack:ai')"
echo "=============================================================================="

import os
import time
import math
import wave
import json
import logging
import hashlib
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Initialize Structured Logger
LOG_FORMAT = os.getenv("LOG_FORMAT", "pretty")
SERVICE_NAME = "vieneu-tts-python"
START_TIME = time.time()

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "time": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(record.created)),
            "level": record.levelname.lower(),
            "service": SERVICE_NAME,
            "event": getattr(record, "event", "tts.log"),
            "msg": record.getMessage(),
        }
        if hasattr(record, "extra_fields"):
            log_record.update(record.extra_fields)
        return json.dumps(log_record)

handler = logging.StreamHandler()
if LOG_FORMAT == "json" or os.getenv("NODE_ENV") == "production":
    handler.setFormatter(JsonFormatter())
else:
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-5s [vieneu-tts-python] %(message)s"))

log = logging.getLogger(SERVICE_NAME)
log.setLevel(logging.INFO)
log.addHandler(handler)
log.propagate = False

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "/health" not in record.getMessage()

logging.getLogger("uvicorn.access").addFilter(EndpointFilter())

app = FastAPI(title="VieNeu TTS Microservice & Neural Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Check standard media volume or local media dir
MEDIA_ROOT = os.getenv("MEDIA_DIR", os.path.join(BASE_DIR, "media"))
CACHE_DIR = os.getenv("AUDIO_CACHE_DIR", os.path.join(MEDIA_ROOT, "audio-cache"))
MODELS_DIR = os.getenv("PIPER_MODELS_DIR", os.path.join(BASE_DIR, "models"))
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

app.mount("/static/audio", StaticFiles(directory=CACHE_DIR), name="static_audio")

def ensure_piper_model(target_dir: str) -> tuple[str, str]:
    """Ensure Piper Vietnamese ONNX voice weights and config exist, downloading if needed."""
    os.makedirs(target_dir, exist_ok=True)
    m_path = os.path.join(target_dir, "vi_VN-25hours_single-low.onnx")
    c_path = os.path.join(target_dir, "vi_VN-25hours_single-low.onnx.json")
    base_url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/25hours_single/low"

    if not os.path.exists(m_path):
        try:
            import urllib.request
            log.info(f"Downloading Piper Vietnamese ONNX voice weights to {m_path}...")
            urllib.request.urlretrieve(f"{base_url}/vi_VN-25hours_single-low.onnx", m_path)
            log.info("Downloaded vi_VN-25hours_single-low.onnx successfully.")
        except Exception as err:
            log.warning(f"Failed to auto-download Piper ONNX voice weights: {err}")

    if not os.path.exists(c_path):
        try:
            import urllib.request
            log.info(f"Downloading Piper Vietnamese config to {c_path}...")
            urllib.request.urlretrieve(f"{base_url}/vi_VN-25hours_single-low.onnx.json", c_path)
            log.info("Downloaded vi_VN-25hours_single-low.onnx.json successfully.")
        except Exception as err:
            log.warning(f"Failed to auto-download Piper config: {err}")

    return m_path, c_path

# Initialize Neural Engine or Graceful Fallback
tts_engine = None
engine_type = "SYNTHETIC_FALLBACK_PYTHON"

try:
    from piper import PiperVoice
    
    # Auto-discover any .onnx voice model in MODELS_DIR
    discovered_model = None
    discovered_config = None
    if os.path.exists(MODELS_DIR):
        candidates = [f for f in os.listdir(MODELS_DIR) if f.endswith(".onnx")]
        # Prefer 25hours_single, then vivos, then any onnx
        candidates.sort(key=lambda x: (0 if "25hours" in x else (1 if "vivos" in x else 2)))
        if candidates:
            discovered_model = os.path.join(MODELS_DIR, candidates[0])
            cfg_cand = discovered_model + ".json"
            if os.path.exists(cfg_cand):
                discovered_config = cfg_cand

    default_m = discovered_model or os.path.join(MODELS_DIR, "vi_VN-25hours_single-low.onnx")
    default_c = discovered_config or (default_m + ".json")
    model_path = os.getenv("PIPER_MODEL_PATH", default_m)
    config_path = os.getenv("PIPER_CONFIG_PATH", default_c)

    if not os.path.exists(model_path):
        ensure_piper_model(MODELS_DIR)

    if os.path.exists(model_path):
        log.info(f"Loading Piper ONNX Neural Voice Engine ({model_path})...")
        tts_engine = PiperVoice.load(model_path, config_path=config_path if (config_path and os.path.exists(config_path)) else None)
        engine_type = "PIPER_NEURAL_ONNX"
        log.info(f"Piper ONNX Voice Engine loaded successfully from {model_path}!")
    else:
        raise FileNotFoundError(f"Model weights not found at {model_path}")
except Exception as p_err:
    try:
        from vieneu import Vieneu
        log.info("Loading VieNeu ONNX Neural Engine...")
        tts_engine = Vieneu()
        engine_type = "REAL_NEURAL_ONNX"
        log.info("VieNeu ONNX Neural Engine loaded successfully!")
    except Exception as init_err:
        log.warning(
            f"Neural ONNX voice model not initialized (piper: {p_err}, vieneu: {init_err}). "
            "Operating in resilient Python Synthesizer mode."
        )
        tts_engine = None
        engine_type = "SYNTHETIC_FALLBACK_PYTHON"

class VieNeuRequest(BaseModel):
    text: str
    speakerId: str = "vi_historical_male_1"
    speedRatio: float = 1.0
    sampleRate: int = 24000
    paddingMs: int = 300
    fps: int = 30

def generate_python_pcm16_audio(text: str, duration_ms: float, word_timestamps: list, sample_rate: int = 24000) -> np.ndarray:
    """Generate harmonic audible PCM audio matching word timestamps for local testing."""
    num_samples = int((duration_ms / 1000.0) * sample_rate)
    audio = np.zeros(num_samples, dtype=np.int16)
    base_freq = 440.0

    for i in range(num_samples):
        curr_ms = (i / float(sample_rate)) * 1000.0
        sample_val = 0.0
        for idx, wt in enumerate(word_timestamps):
            if wt["startMs"] <= curr_ms <= wt["endMs"]:
                freq = base_freq + (idx % 6) * 35.0
                t = i / float(sample_rate)
                # Apply envelope to avoid clicking
                time_in_word = curr_ms - wt["startMs"]
                word_dur = max(1.0, wt["endMs"] - wt["startMs"])
                envelope = math.sin(math.pi * (time_in_word / word_dur))
                sample_val = math.sin(2.0 * math.pi * freq * t) * 14000.0 * max(0.0, envelope)
                break
        audio[i] = int(sample_val)

    return audio

@app.get("/health")
def health():
    uptime = int(time.time() - START_TIME)
    cached_count = len(os.listdir(CACHE_DIR)) if os.path.exists(CACHE_DIR) else 0
    return {
        "status": "OK",
        "service": "vieneu-tts-python",
        "engineType": engine_type,
        "uptimeSec": uptime,
        "audioCacheDir": CACHE_DIR,
        "cachedFilesCount": cached_count,
        "neuralModelLoaded": tts_engine is not None,
    }

@app.post("/api/v1/synthesize")
def synthesize(req: VieNeuRequest, request: Request):
    request_id = request.headers.get("x-request-id") or request.headers.get("x-correlation-id") or f"req_{int(time.time()*1000)}"
    text = req.text.strip()
    if not text:
        log.warning("Empty text received in synthesize request", extra={"event": "tts.empty_text", "requestId": request_id})
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    start_time = time.time()
    words = text.split()
    sample_rate = req.sampleRate or 24000

    # Calculate word cadence and timestamps
    word_timestamps = []
    curr_ms = 0.0
    for w in words:
        base_dur = max(180.0, len(w) * 40.0)
        pause = 40.0
        if w.endswith((".", "!", "?")):
            pause = 300.0
        elif w.endswith((",", ";", ":")):
            pause = 180.0
        start_w = int(curr_ms)
        end_w = int(curr_ms + base_dur)
        word_timestamps.append({"word": w, "startMs": start_w, "endMs": end_w})
        curr_ms = end_w + pause

    calculated_duration_ms = int(curr_ms)

    # Hash deterministically for file caching
    file_hash = hashlib.sha256(f"{text}_{req.speakerId}_{req.speedRatio}_{sample_rate}".encode("utf-8")).hexdigest()[:16]
    file_name = f"vieneu_{file_hash}.wav"
    file_path = os.path.join(CACHE_DIR, file_name)

    current_engine = engine_type

    if not os.path.exists(file_path):
        if tts_engine is not None:
            try:
                if engine_type == "PIPER_NEURAL_ONNX":
                    audio_arrays = []
                    for chunk in tts_engine.synthesize(text):
                        if chunk.audio_float_array is not None and len(chunk.audio_float_array) > 0:
                            audio_arrays.append(chunk.audio_float_array)
                    if audio_arrays:
                        full_audio = np.concatenate(audio_arrays)
                        sr = getattr(tts_engine.config, "sample_rate", sample_rate)
                        sf.write(file_path, full_audio, sr, subtype="PCM_16")
                    else:
                        raise RuntimeError("Piper synthesis yielded no audio chunks")
                else:
                    audio_data = tts_engine.infer(text)
                    sr = getattr(tts_engine, "sample_rate", sample_rate)
                    if hasattr(tts_engine, "save") and callable(getattr(tts_engine, "save")):
                        try:
                            tts_engine.save(audio_data, file_path)
                        except Exception:
                            audio_int16 = (audio_data * 32767.0).clip(-32768, 32767).astype(np.int16)
                            sf.write(file_path, audio_int16, sr, subtype="PCM_16")
                    else:
                        audio_int16 = (audio_data * 32767.0).clip(-32768, 32767).astype(np.int16)
                        sf.write(file_path, audio_int16, sr, subtype="PCM_16")
            except Exception as infer_err:
                log.warning(f"Neural inference failed ({infer_err}), falling back to Python PCM synthesizer")
                current_engine = "SYNTHETIC_FALLBACK_PYTHON"
                synth_audio = generate_python_pcm16_audio(text, calculated_duration_ms, word_timestamps, sample_rate)
                sf.write(file_path, synth_audio, sample_rate, subtype="PCM_16")
        else:
            synth_audio = generate_python_pcm16_audio(text, calculated_duration_ms, word_timestamps, sample_rate)
            sf.write(file_path, synth_audio, sample_rate, subtype="PCM_16")

    if not os.path.exists(file_path):
        log.error(f"Failed to create audio file at {file_path}", extra={"event": "tts.file_error", "requestId": request_id})
        raise HTTPException(status_code=500, detail="Failed to synthesize and write audio file")

    # Read actual audio duration from WAV header
    with wave.open(file_path, "rb") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        duration_ms = int((frames / float(rate)) * 1000)

    calculated_frames = math.ceil(((duration_ms + req.paddingMs) / 1000.0) * req.fps)
    elapsed_ms = round((time.time() - start_time) * 1000, 1)

    log.info(
        f"Synthesized {len(words)} words in {elapsed_ms}ms ({duration_ms}ms audio, {calculated_frames} frames)",
        extra={
            "event": "tts.synthesized",
            "requestId": request_id,
            "durationMs": duration_ms,
            "calculatedFrames": calculated_frames,
            "engineType": current_engine,
            "latencyMs": elapsed_ms,
        }
    )

    return {
        "status": "SUCCESS",
        "audioUrl": f"/static/audio/{file_name}",
        "audioDurationMs": duration_ms,
        "calculatedFramesAt30fps": calculated_frames,
        "wordTimestamps": word_timestamps,
        "engineType": current_engine,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)

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

# Initialize Official VieNeu-TTS Engine (v3turbo - vieneu.io) exclusively
try:
    import vieneu
    log.info("Loading Official VieNeu-TTS Engine (v3turbo - vieneu.io)...")
    tts_engine = vieneu.Vieneu(mode="v3turbo")
    engine_type = "VIENEU_OFFICIAL_V3TURBO"
    log.info("VieNeu-TTS Official v3turbo Engine loaded successfully!")
except Exception as v_err:
    log.error(f"Fatal error: failed to initialize VieNeu-TTS v3turbo engine: {v_err}")
    tts_engine = None
    engine_type = "ERROR_UNAVAILABLE"

class VieNeuRequest(BaseModel):
    text: str
    speakerId: str = "vi_historical_male_1"
    speedRatio: float = 1.0
    sampleRate: int = 24000
    paddingMs: int = 300
    fps: int = 30

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

    # Calculate speed scale with safety clamping
    speed_ratio = req.speedRatio if req.speedRatio and req.speedRatio > 0 else 1.0
    speed_scale = 1.0 / speed_ratio
    length_scale = max(0.85, min(1.05, speed_scale))

    # Calculate word cadence and timestamps
    word_timestamps = []
    curr_ms = 0.0
    for w in words:
        base_dur = max(180.0, len(w) * 40.0) * speed_scale
        pause = 40.0 * speed_scale
        if w.endswith((".", "!", "?")):
            pause = 300.0 * speed_scale
        elif w.endswith((",", ";", ":")):
            pause = 180.0 * speed_scale
        start_w = int(curr_ms)
        end_w = int(curr_ms + base_dur)
        word_timestamps.append({"word": w, "startMs": start_w, "endMs": end_w})
        curr_ms = end_w + pause

    calculated_duration_ms = max(1, int(curr_ms))

    # Hash deterministically for file caching
    file_hash = hashlib.sha256(f"{text}_{req.speakerId}_{req.speedRatio}_{sample_rate}".encode("utf-8")).hexdigest()[:16]
    file_name = f"vieneu_{file_hash}.wav"
    file_path = os.path.join(CACHE_DIR, file_name)

    current_engine = engine_type

    if not os.path.exists(file_path):
        if tts_engine is None:
            raise HTTPException(status_code=503, detail="VieNeu TTS model is not available")
        try:
            speaker_name = "Anh Khôi"
            if req.speakerId:
                spk_low = req.speakerId.lower()
                if "female" in spk_low or "truc_ly" in spk_low:
                    speaker_name = "Trúc Ly"
                elif "mai_anh" in spk_low:
                    speaker_name = "Mai Anh"
                elif "south" in spk_low or "thai_son" in spk_low:
                    speaker_name = "Thái Sơn"
                elif "thien_tam" in spk_low:
                    speaker_name = "Thiền Tâm Đức"
                elif "tuyen" in spk_low:
                    speaker_name = "Phạm Tuyên"
                elif "vinh" in spk_low:
                    speaker_name = "Xuân Vĩnh"
                elif hasattr(tts_engine, "list_preset_voices"):
                    presets = [v[1] for v in tts_engine.list_preset_voices()]
                    if req.speakerId in presets:
                        speaker_name = req.speakerId

            voice = tts_engine.get_preset_voice(speaker_name)
            audio_data = tts_engine.infer(text=text, voice=voice)
            sr = getattr(tts_engine, "sample_rate", sample_rate)
            if hasattr(tts_engine, "save") and callable(getattr(tts_engine, "save")):
                try:
                    tts_engine.save(audio_data, file_path)
                except Exception:
                    sf.write(file_path, audio_data, sr, subtype="PCM_16")
            else:
                sf.write(file_path, audio_data, sr, subtype="PCM_16")
        except Exception as infer_err:
            log.error(f"VieNeu inference failed: {infer_err}")
            raise HTTPException(status_code=500, detail=f"VieNeu TTS inference failed: {infer_err}")

    if not os.path.exists(file_path):
        log.error(f"Failed to create audio file at {file_path}", extra={"event": "tts.file_error", "requestId": request_id})
        raise HTTPException(status_code=500, detail="Failed to synthesize and write audio file")

    # Read actual audio duration from WAV header
    with wave.open(file_path, "rb") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        duration_ms = int((frames / float(rate)) * 1000)

    # Scale word timestamps proportionally to match actual WAV duration
    if calculated_duration_ms > 0 and duration_ms > 0:
        time_scale = duration_ms / float(calculated_duration_ms)
        final_word_timestamps = [
            {
                "word": wt["word"],
                "startMs": int(wt["startMs"] * time_scale),
                "endMs": int(wt["endMs"] * time_scale),
            }
            for wt in word_timestamps
        ]
    else:
        final_word_timestamps = word_timestamps

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
        "wordTimestamps": final_word_timestamps,
        "engineType": current_engine,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)

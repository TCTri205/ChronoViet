import os
import time
import math
import wave
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from vieneu import Vieneu

app = FastAPI(title="VieNeu TTS Real Engine Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, "media", "audio-cache")
os.makedirs(CACHE_DIR, exist_ok=True)

app.mount("/static/audio", StaticFiles(directory=CACHE_DIR), name="static_audio")

print("[VieNeu] Loading VieNeu ONNX Neural Engine...")
tts_engine = Vieneu()
print("[VieNeu] VieNeu ONNX Engine ready!")

class VieNeuRequest(BaseModel):
    text: str
    speakerId: str = "vi_historical_male_1"
    speedRatio: float = 1.0
    sampleRate: int = 24000
    paddingMs: int = 300
    fps: int = 30

@app.get("/health")
def health():
    return {"status": "OK", "service": "vieneu-tts-python-onnx", "engine": "VieNeu v3 Turbo"}

@app.post("/api/v1/synthesize")
def synthesize(req: VieNeuRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    import hashlib
    file_hash = hashlib.sha256(f"{text}_{req.speakerId}_{req.speedRatio}_{req.sampleRate}".encode('utf-8')).hexdigest()[:16]
    file_name = f"vieneu_real_{file_hash}.wav"
    file_path = os.path.join(CACHE_DIR, file_name)

    if not os.path.exists(file_path):
        # Synthesize human voice audio using VieNeu v3 Turbo Neural Engine
        audio_data = tts_engine.infer(text)
        sample_rate = getattr(tts_engine, 'sample_rate', req.sampleRate)

        # Try native tts.save if available, otherwise write via soundfile with correct 24kHz PCM_16
        if hasattr(tts_engine, 'save') and callable(getattr(tts_engine, 'save')):
            try:
                tts_engine.save(audio_data, file_path)
            except Exception:
                audio_int16 = (audio_data * 32767.0).clip(-32768, 32767).astype(np.int16)
                sf.write(file_path, audio_int16, sample_rate, subtype='PCM_16')
        else:
            audio_int16 = (audio_data * 32767.0).clip(-32768, 32767).astype(np.int16)
            sf.write(file_path, audio_int16, sample_rate, subtype='PCM_16')

    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="Failed to write audio file")

    with wave.open(file_path, 'rb') as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        duration_ms = int((frames / float(rate)) * 1000)

    calculated_frames = math.ceil(((duration_ms + req.paddingMs) / 1000.0) * req.fps)

    # Proportional word timestamp calculation based on character length & punctuation pauses
    words = text.split()
    word_timestamps = []
    if len(words) > 0:
        weights = []
        for w in words:
            base_weight = max(180, len(w) * 40)
            if w.endswith(('.', '!', '?')):
                base_weight += 300
            elif w.endswith((',', ';', ':')):
                base_weight += 180
            weights.append(base_weight)

        total_weight = sum(weights)
        curr_ms = 0.0
        for i, w in enumerate(words):
            scaled_dur = (weights[i] / total_weight) * duration_ms if total_weight > 0 else (duration_ms / len(words))
            start_ms = int(curr_ms)
            end_ms = int(curr_ms + scaled_dur)
            word_timestamps.append({"word": w, "startMs": start_ms, "endMs": end_ms})
            curr_ms += scaled_dur

    return {
        "status": "SUCCESS",
        "audioUrl": f"/static/audio/{file_name}",
        "audioDurationMs": duration_ms,
        "calculatedFramesAt30fps": calculated_frames,
        "wordTimestamps": word_timestamps,
        "engineType": "REAL_NEURAL_ONNX"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)

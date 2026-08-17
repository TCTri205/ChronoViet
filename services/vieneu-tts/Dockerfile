FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required by soundfile, audio processing, and container health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Copy python dependencies and install
COPY services/vieneu-tts/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI microservice
COPY services/vieneu-tts/app.py ./

# Create persistent audio cache volume directory
RUN mkdir -p /app/media/audio-cache

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=5s --timeout=3s --retries=3 --start-period=5s \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]

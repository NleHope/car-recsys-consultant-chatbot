FROM python:3.11-slim

# OpenMP runtime required by LightGBM and XGBoost at import time.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install torch/torchvision CPU-only FIRST so the (CUDA) wheels in
# requirements.txt are satisfied by the lighter CPU build.
RUN pip install --no-cache-dir torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the third-party DINOv2 weights into the image so the container never
# needs to reach HuggingFace at runtime (main.py calls from_pretrained()).
RUN python -c "from transformers import AutoImageProcessor, AutoModel; AutoImageProcessor.from_pretrained('facebook/dinov2-small'); AutoModel.from_pretrained('facebook/dinov2-small')"

# Copy only what the server needs (NOT dataset / QLora / img_demo).
COPY main.py title_parser.py ./
COPY model_artifacts/ ./model_artifacts/

ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]

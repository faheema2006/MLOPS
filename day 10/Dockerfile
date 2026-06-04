# Use Python 3.10 slim image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt
COPY requirements.txt .

# Install Python dependencies
# Upgrade pip
RUN pip install --upgrade pip

# Install CPU-only PyTorch first
RUN pip install --default-timeout=1000 --index-url https://download.pytorch.org/whl/cpu \
    torch==2.0.1 torchvision==0.15.2

# Install remaining dependencies
RUN pip install --retries 20 --timeout 1000 --no-cache-dir -r requirements.txt
# Copy the model and application files
COPY . .

# Create directories for inputs and outputs
RUN mkdir -p /app/inputs /app/outputs /app/models

# Expose port for API (if using Flask/FastAPI)
EXPOSE 5000

# Default command
CMD ["python", "inference.py"]

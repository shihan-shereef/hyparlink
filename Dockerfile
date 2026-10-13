# ==============================================================================
# HyperFrames Rendering & Backend Container
# Production-ready container pre-installing Node.js, npm, FFmpeg, and FFprobe
# ==============================================================================

FROM node:20-bookworm-slim

# Prevent interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies: FFmpeg, FFprobe, and required media libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    git \
    procps \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Verify system installations inside container build
RUN node --version \
    && npm --version \
    && ffmpeg -version \
    && ffprobe -version

WORKDIR /app

# Copy root configurations
COPY package.json bun.lockb* package-lock.json* ./
COPY ai-composition-generator/package.json ./ai-composition-generator/

# Install Node dependencies
RUN npm install --prefix ai-composition-generator

# Copy backend source files
COPY backend-echo ./backend-echo
COPY ai-composition-generator ./ai-composition-generator
COPY scripts ./scripts

# Build ai-composition-generator
RUN npm --prefix ai-composition-generator run build

# Pre-cache HyperFrames CLI
RUN npx --yes hyperframes@0.8.139 --version

ENV PORT=4000
EXPOSE 4000

# Start backend rendering daemon
CMD ["node", "backend-echo/server.mjs"]

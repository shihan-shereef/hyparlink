#!/bin/bash
# ==============================================================================
# Hyparlink Dashboard & Cloudflare Online Runner
# Runs the full dashboard + backend + Cloudflare Tunnel independently
# Even when Antigravity IDE is completely closed!
# ==============================================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo " Starting Hyparlink Autonomous Dashboard for Online Access"
echo "=========================================================="

# 1. Start Backend API on :4000 if not running
if ! lsof -i :4000 > /dev/null; then
  echo "[1/3] Starting Backend API on :4000..."
  PORT=4000 node backend-echo/server.mjs &
  BACKEND_PID=$!
  echo "Backend started with PID $BACKEND_PID"
else
  echo "[1/3] Backend API already running on :4000."
fi

# 2. Start Next.js App on :3000 if not running
if ! lsof -i :3000 > /dev/null; then
  echo "[2/3] Starting Next.js Dashboard on :3000..."
  bun run --filter @v1/app start -p 3000 &
  APP_PID=$!
  echo "App started with PID $APP_PID"
else
  echo "[2/3] Dashboard App already running on :3000."
fi

# 2.5 Start Cloudflare Tunnel for Studio on :3055 if not already tunneled
mkdir -p logs
if ! pgrep -f "cloudflared tunnel --url http://127.0.0.1:3055" > /dev/null && ! pgrep -f "cloudflared tunnel --url http://localhost:3055" > /dev/null; then
  echo "[2.5/4] Starting Cloudflare Tunnel for HyperFrames Studio (:3055)..."
  "./bin/cloudflared" tunnel --url http://127.0.0.1:3055 > logs/tunnel-studio.log 2>&1 &
fi

# 3. Start Cloudflare Tunnel
echo "[3/3] Launching Cloudflare Tunnel for Internet Access..."
echo "----------------------------------------------------------"
echo "Your public HTTPS link will appear below:"
echo "----------------------------------------------------------"
./bin/cloudflared tunnel --url http://localhost:3000

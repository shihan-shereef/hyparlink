#!/bin/bash
# ==============================================================================
# Ollastar / Hyparlink VM Deploy Script
# Run this on the Ubuntu VM to pull latest changes and restart services
# ==============================================================================
set -e

echo "============================================================"
echo "  Ollastar Production Deploy — $(date)"
echo "============================================================"

if [ -z "$REPO_DIR" ]; then
  if [ -d "$HOME/hyparlink" ]; then
    REPO_DIR="$HOME/hyparlink"
  elif [ -d "/home/shihan/hyparlink" ]; then
    REPO_DIR="/home/shihan/hyparlink"
  elif [ -d "/home/ubuntu/hyparlink" ]; then
    REPO_DIR="/home/ubuntu/hyparlink"
  else
    REPO_DIR="$(pwd)"
  fi
fi
BRANCH="${BRANCH:-main}"

# 1. Pull latest code from GitHub
echo "[1/5] Pulling latest code from GitHub (branch: $BRANCH)..."
cd "$REPO_DIR"
git fetch origin
git reset --hard "origin/$BRANCH"
echo "✓ Code updated to $(git rev-parse --short HEAD)"

# 2. Install dependencies
echo "[2/5] Installing dependencies..."
if command -v bun &> /dev/null; then
  bun install --frozen-lockfile 2>/dev/null || bun install
else
  npm install
fi
echo "✓ Dependencies installed"

# 3. Build the Next.js app
echo "[3/5] Building Next.js app..."
(cd apps/app && (bun run build 2>&1 || npm run build 2>&1 || npx turbo build --filter=@v1/app 2>&1)) | tail -20
echo "✓ Build complete"

# 4. Restart PM2 services (if using PM2)
echo "[4/5] Restarting services..."
if command -v pm2 &> /dev/null; then
  # Restart backend-echo
  pm2 restart backend-echo 2>/dev/null || \
    pm2 start backend-echo/server.mjs --name backend-echo --env production 2>/dev/null || \
    echo "  (backend-echo not in PM2, start manually)"

  # Restart Next.js app (supports nextjs-app, ollastar-app, or all)
  pm2 restart nextjs-app 2>/dev/null || \
    pm2 restart ollastar-app 2>/dev/null || \
    pm2 restart all 2>/dev/null || \
    echo "  (app not in PM2, start manually)"

  pm2 save
  echo "✓ PM2 services restarted"
elif systemctl is-active --quiet hyparlink-app 2>/dev/null; then
  sudo systemctl restart hyparlink-app
  sudo systemctl restart hyparlink-backend 2>/dev/null || true
  echo "✓ Systemd services restarted"
else
  echo "⚠ No PM2 or systemd detected. Restarting manually..."
  # Kill old processes
  pkill -f "backend-echo/server.mjs" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
  sleep 2

  # Start backend-echo
  PORT=4000 node backend-echo/server.mjs >> logs/backend.log 2>&1 &
  echo "  Backend started (PID $!)"

  # Start Next.js
  bun run --filter @v1/app start -p 3000 >> logs/app.log 2>&1 &
  echo "  App started (PID $!)"
fi

# 5. Verify Cloudflare tunnel is running
echo "[5/5] Verifying Cloudflare tunnel..."
if pgrep -f "cloudflared" > /dev/null; then
  echo "✓ Cloudflare tunnel already running"
else
  echo "⚠ Cloudflare tunnel not running — starting it..."
  mkdir -p logs
  ./bin/cloudflared tunnel --url http://localhost:3000 >> logs/tunnel.log 2>&1 &
  echo "  Tunnel started, check logs/tunnel.log for public URL"
fi

echo ""
echo "============================================================"
echo "  Deploy complete! Commit: $(git rev-parse --short HEAD)"
echo "  Public URL: https://burke-parallel-nearest-condo.trycloudflare.com"
echo "  Editor:     https://burke-parallel-nearest-condo.trycloudflare.com/editor/default_reference_video_2"
echo "============================================================"

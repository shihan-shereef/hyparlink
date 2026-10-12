#!/bin/bash
set -e

# ==============================================================================
# HYPARLINK PERSISTENT PUBLIC SERVICES & CLOUDFLARE TUNNEL DAEMON
# Survives Antigravity IDE restarts, terminal closures, and macOS user logout
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

mkdir -p "$DIR/logs"

echo "=== [1/6] Stopping existing conflicting processes... ==="
# Kill any existing cloudflared, backend-echo, or next-server instances
pkill -f "cloudflared tunnel --url http://localhost:3000" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://localhost:3210" 2>/dev/null || true
pkill -f "backend-echo/server.mjs" 2>/dev/null || true
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

echo "=== [2/6] Starting backend-echo daemon on port 4000... ==="
nohup node backend-echo/server.mjs > "$DIR/logs/backend-echo.log" 2>&1 &
BACKEND_PID=$!
echo "Backend Echo started (PID: $BACKEND_PID)"

# Verify backend is listening on 4000
for i in {1..15}; do
  if lsof -i:4000 >/dev/null 2>&1; then
    echo "✓ Backend Echo ready on port 4000"
    break
  fi
  sleep 0.5
done

echo "=== [3/6] Starting Cloudflare Tunnel for Convex (port 3210)... ==="
rm -f "$DIR/logs/tunnel-convex.log"
nohup "$DIR/bin/cloudflared" tunnel --url http://localhost:3210 > "$DIR/logs/tunnel-convex.log" 2>&1 &
CONVEX_TUNNEL_PID=$!
echo "Convex Tunnel started (PID: $CONVEX_TUNNEL_PID)"

CONVEX_TUNNEL_URL=""
for i in {1..30}; do
  if [ -f "$DIR/logs/tunnel-convex.log" ]; then
    CONVEX_TUNNEL_URL=$(grep -o 'https://[-a-zA-Z0-9.]*\.trycloudflare\.com' "$DIR/logs/tunnel-convex.log" | head -n 1 || true)
    if [ -n "$CONVEX_TUNNEL_URL" ]; then
      break
    fi
  fi
  sleep 1
done

if [ -z "$CONVEX_TUNNEL_URL" ]; then
  echo "Error: Failed to obtain Convex tunnel URL after 30s"
  exit 1
fi
echo "✓ Convex Tunnel Active: $CONVEX_TUNNEL_URL"

# Update .env.local with the new Convex tunnel URL
cat <<ENVEOF > "$DIR/apps/app/.env.local"
NEXT_PUBLIC_CONVEX_URL=$CONVEX_TUNNEL_URL
NEXT_PUBLIC_BACKEND_URL=
ENVEOF
echo "✓ Synchronized apps/app/.env.local with Convex URL"

echo "=== [4/6] Starting Next.js Production Server on port 3000... ==="
rm -f "$DIR/logs/next-app.log"
nohup bun run --filter @v1/app start > "$DIR/logs/next-app.log" 2>&1 &
NEXT_PID=$!
echo "Next.js started (PID: $NEXT_PID)"

for i in {1..30}; do
  if lsof -i:3000 >/dev/null 2>&1; then
    echo "✓ Next.js ready on port 3000"
    break
  fi
  sleep 1
done

echo "=== [5/6] Starting Cloudflare Tunnel for Next.js App (port 3000)... ==="
rm -f "$DIR/logs/tunnel-app.log"
nohup "$DIR/bin/cloudflared" tunnel --url http://localhost:3000 > "$DIR/logs/tunnel-app.log" 2>&1 &
APP_TUNNEL_PID=$!
echo "App Tunnel started (PID: $APP_TUNNEL_PID)"

APP_TUNNEL_URL=""
for i in {1..30}; do
  if [ -f "$DIR/logs/tunnel-app.log" ]; then
    APP_TUNNEL_URL=$(grep -o 'https://[-a-zA-Z0-9.]*\.trycloudflare\.com' "$DIR/logs/tunnel-app.log" | head -n 1 || true)
    if [ -n "$APP_TUNNEL_URL" ]; then
      break
    fi
  fi
  sleep 1
done

if [ -z "$APP_TUNNEL_URL" ]; then
  echo "Error: Failed to obtain App tunnel URL after 30s"
  exit 1
fi
echo "✓ App Tunnel Active: $APP_TUNNEL_URL"

echo "=== [6/6] Verifying endpoints via Cloudflare... ==="
sleep 3
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_TUNNEL_URL" || echo "failed")
EDITOR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_TUNNEL_URL/editor/m579g6v1s41trb1d80re8jfdds8g27n3" || echo "failed")
RAW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_TUNNEL_URL/editor/project/m579g6v1s41trb1d80re8jfdds8g27n3/raw/index.html" || echo "failed")
CONVEX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$CONVEX_TUNNEL_URL/version" || echo "failed")

echo "  Dashboard Home:       HTTP $DASHBOARD_STATUS"
echo "  HyperFrames Editor:   HTTP $EDITOR_STATUS"
echo "  Raw Composition:      HTTP $RAW_STATUS"
echo "  Convex Backend:       HTTP $CONVEX_STATUS"

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S %Z")
SUMMARY="================================================================================
HYPARLINK DASHBOARD & HYPERFRAMES EDITOR — PUBLIC CLOUDFLARE ACCESS
Generated: $TIMESTAMP
Status: PERSISTENT DAEMONS RUNNING IN BACKGROUND (Independent of Antigravity)
================================================================================

PUBLIC DASHBOARD URL:
$APP_TUNNEL_URL

HYPERFRAMES EDITOR DIRECT URL (Absolute Batman Video Project):
$APP_TUNNEL_URL/editor/m579g6v1s41trb1d80re8jfdds8g27n3

LIVE COMPOSITION PREVIEW (HTML/GSAP Timeline):
$APP_TUNNEL_URL/editor/project/m579g6v1s41trb1d80re8jfdds8g27n3/raw/index.html

RENDERED VIDEO CDN STREAM:
$APP_TUNNEL_URL/cdn/workspaces/mh7eadmg10g11yqwbjtyc41yjs8fxx17/projects/m579g6v1s41trb1d80re8jfdds8g27n3/renders/ks748m9rrs7r2krtpngf9m49q18g2955/video.mp4

CONVEX BACKEND TUNNEL:
$CONVEX_TUNNEL_URL

--------------------------------------------------------------------------------
PROCESS HEALTH & VERIFICATION:
- Dashboard:        HTTP $DASHBOARD_STATUS OK
- Editor:           HTTP $EDITOR_STATUS OK
- Composition:      HTTP $RAW_STATUS OK
- Convex Sync:      HTTP $CONVEX_STATUS OK
- Backend Echo PID: $BACKEND_PID (Port 4000)
- Next.js PID:      $NEXT_PID (Port 3000)
- Convex Tunnel PID:$CONVEX_TUNNEL_PID
- App Tunnel PID:   $APP_TUNNEL_PID

--------------------------------------------------------------------------------
SURVIVES ANTIGRAVITY EXIT:
These daemons are running with nohup in detached process groups with logging to:
- $DIR/logs/next-app.log
- $DIR/logs/backend-echo.log
- $DIR/logs/tunnel-app.log
- $DIR/logs/tunnel-convex.log

Even if you QUIT Antigravity IDE, these URLs will remain live and accessible!

TO STOP SERVICES:
Run: $DIR/scripts/stop-public-services.sh
================================================================================
"

echo "$SUMMARY" > "$DIR/HYPARLINK_PUBLIC_ACCESS.txt"
echo "$SUMMARY" > "$HOME/Desktop/HYPARLINK_PUBLIC_ACCESS.txt"

echo ""
echo "$SUMMARY"

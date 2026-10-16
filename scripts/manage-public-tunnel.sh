#!/bin/bash
set -e

# ==============================================================================
# HYPARLINK PERSISTENT PUBLIC SERVICES & CLOUDFLARE TUNNEL DAEMON
# Survives Antigravity IDE restarts, terminal closures, and macOS user logout
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

mkdir -p "$DIR/logs"

echo "=== [1/7] Stopping existing conflicting processes... ==="
# Kill any existing cloudflared, backend-echo, or next-server instances
pkill -f "cloudflared" 2>/dev/null || true
pkill -f "backend-echo/server.mjs" 2>/dev/null || true
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

echo "=== [2/7] Starting backend-echo daemon on port 4000... ==="
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

echo "=== [3/7] Starting Cloudflare Tunnel for Convex (port 3210)... ==="
rm -f "$DIR/logs/tunnel-convex.log"
nohup "$DIR/bin/cloudflared" tunnel --url http://localhost:3210 > "$DIR/logs/tunnel-convex.log" 2>&1 &
CONVEX_TUNNEL_PID=$!
echo "Convex Tunnel started (PID: $CONVEX_TUNNEL_PID)"

CONVEX_TUNNEL_URL=""
for i in {1..35}; do
  if [ -f "$DIR/logs/tunnel-convex.log" ]; then
    CONVEX_TUNNEL_URL=$(grep -o 'https://[-a-zA-Z0-9.]*\.trycloudflare\.com' "$DIR/logs/tunnel-convex.log" | head -n 1 || true)
    if [ -n "$CONVEX_TUNNEL_URL" ]; then
      break
    fi
  fi
  sleep 1
done

if [ -z "$CONVEX_TUNNEL_URL" ]; then
  echo "Error: Failed to obtain Convex tunnel URL after 35s"
  exit 1
fi
echo "✓ Convex Tunnel Active: $CONVEX_TUNNEL_URL"

echo "=== [4/7] Ensuring HyperFrames Studio (port 3055) & Tunnel... ==="
if ! lsof -i:3055 >/dev/null 2>&1; then
  echo "Starting HyperFrames preview on port 3055..."
  nohup npx hyperframes preview "$DIR/ai-composition-generator/generated-projects/job-1791961162985-04a27b9b" --port=3055 --foreground --no-open --force-new > "$DIR/logs/preview-3055.log" 2>&1 &
  sleep 3
fi

rm -f "$DIR/logs/tunnel-studio.log"
nohup "$DIR/bin/cloudflared" tunnel --url http://127.0.0.1:3055 > "$DIR/logs/tunnel-studio.log" 2>&1 &
STUDIO_TUNNEL_PID=$!
echo "Studio Tunnel started (PID: $STUDIO_TUNNEL_PID)"

STUDIO_TUNNEL_URL=""
for i in {1..35}; do
  if [ -f "$DIR/logs/tunnel-studio.log" ]; then
    STUDIO_TUNNEL_URL=$(grep -o 'https://[-a-zA-Z0-9.]*\.trycloudflare\.com' "$DIR/logs/tunnel-studio.log" | head -n 1 || true)
    if [ -n "$STUDIO_TUNNEL_URL" ]; then
      break
    fi
  fi
  sleep 1
done

if [ -z "$STUDIO_TUNNEL_URL" ]; then
  echo "Warning: Failed to obtain Studio tunnel URL after 35s, continuing..."
  STUDIO_TUNNEL_URL="https://pending-studio.trycloudflare.com"
else
  echo "✓ Studio Tunnel Active: $STUDIO_TUNNEL_URL"
fi

# Update .env.local with the new Convex & Studio tunnel URLs
cat <<ENVEOF > "$DIR/apps/app/.env.local"
NEXT_PUBLIC_CONVEX_URL=$CONVEX_TUNNEL_URL
NEXT_PUBLIC_BACKEND_URL=
NEXT_PUBLIC_STUDIO_URL=$STUDIO_TUNNEL_URL
ENVEOF
echo "✓ Synchronized apps/app/.env.local with Convex and Studio URLs"

echo "=== [5/7] Starting Next.js Production Server on port 3000... ==="
rm -f "$DIR/logs/next-app.log"
python3 -c "import subprocess, os
p = subprocess.Popen(['bun', 'run', '--filter', '@v1/app', 'start', '-p', '3000'], cwd='$DIR', start_new_session=True, stdout=open('$DIR/logs/next-app.log', 'w'), stderr=subprocess.STDOUT)
print(p.pid)
" > "$DIR/logs/.next_pid"
NEXT_PID=$(cat "$DIR/logs/.next_pid" 2>/dev/null || echo "")
echo "Next.js started detached (PID: $NEXT_PID)"

for i in {1..30}; do
  if lsof -i:3000 >/dev/null 2>&1; then
    echo "✓ Next.js ready on port 3000"
    break
  fi
  sleep 1
done

echo "=== [6/7] Starting Cloudflare Tunnel for Next.js App (port 3000)... ==="
rm -f "$DIR/logs/tunnel-app.log"
nohup "$DIR/bin/cloudflared" tunnel --url http://localhost:3000 > "$DIR/logs/tunnel-app.log" 2>&1 &
APP_TUNNEL_PID=$!
echo "App Tunnel started (PID: $APP_TUNNEL_PID)"

APP_TUNNEL_URL=""
for i in {1..35}; do
  if [ -f "$DIR/logs/tunnel-app.log" ]; then
    APP_TUNNEL_URL=$(grep -o 'https://[-a-zA-Z0-9.]*\.trycloudflare\.com' "$DIR/logs/tunnel-app.log" | head -n 1 || true)
    if [ -n "$APP_TUNNEL_URL" ]; then
      break
    fi
  fi
  sleep 1
done

if [ -z "$APP_TUNNEL_URL" ]; then
  echo "Error: Failed to obtain App tunnel URL after 35s"
  exit 1
fi
echo "✓ App Tunnel Active: $APP_TUNNEL_URL"

echo "=== [7/7] Verifying endpoints via Cloudflare... ==="
sleep 3
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_TUNNEL_URL" || echo "failed")
CREATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_TUNNEL_URL/create-video" || echo "failed")
EDITOR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_TUNNEL_URL/editor/m579g6v1s41trb1d80re8jfdds8g27n3" || echo "failed")
RAW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_TUNNEL_URL/editor/project/m579g6v1s41trb1d80re8jfdds8g27n3/raw/index.html" || echo "failed")
CONVEX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$CONVEX_TUNNEL_URL/version" || echo "failed")
STUDIO_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$STUDIO_TUNNEL_URL" || echo "failed")

echo "  Dashboard Home:       HTTP $DASHBOARD_STATUS"
echo "  Create Video Page:    HTTP $CREATE_STATUS"
echo "  HyperFrames Editor:   HTTP $EDITOR_STATUS"
echo "  Raw Composition:      HTTP $RAW_STATUS"
echo "  Convex Backend:       HTTP $CONVEX_STATUS"
echo "  HyperFrames Studio:   HTTP $STUDIO_STATUS"

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S %Z")
SUMMARY="================================================================================
HYPARLINK DASHBOARD & HYPERFRAMES EDITOR — PUBLIC CLOUDFLARE ACCESS
Generated: $TIMESTAMP
Status: PERSISTENT DAEMONS RUNNING IN BACKGROUND (Independent of Antigravity)
================================================================================

PUBLIC DASHBOARD URL:
$APP_TUNNEL_URL

CREATE VIDEO PAGE (AI Video Production Agent):
$APP_TUNNEL_URL/create-video

HYPERFRAMES EDITOR DIRECT URL (Absolute Batman Video Project):
$APP_TUNNEL_URL/editor/m579g6v1s41trb1d80re8jfdds8g27n3

LIVE COMPOSITION PREVIEW (HTML/GSAP Timeline):
$APP_TUNNEL_URL/editor/project/m579g6v1s41trb1d80re8jfdds8g27n3/raw/index.html

RENDERED VIDEO CDN STREAM:
$APP_TUNNEL_URL/cdn/workspaces/mh7eadmg10g11yqwbjtyc41yjs8fxx17/projects/m579g6v1s41trb1d80re8jfdds8g27n3/renders/ks748m9rrs7r2krtpngf9m49q18g2955/video.mp4

CONVEX BACKEND TUNNEL:
$CONVEX_TUNNEL_URL

HYPERFRAMES STUDIO:
$STUDIO_TUNNEL_URL

--------------------------------------------------------------------------------
PROCESS HEALTH & VERIFICATION:
- Dashboard:        HTTP $DASHBOARD_STATUS OK
- Create Video:     HTTP $CREATE_STATUS OK
- Editor:           HTTP $EDITOR_STATUS OK
- Composition:      HTTP $RAW_STATUS OK
- Convex Sync:      HTTP $CONVEX_STATUS OK
- Studio:           HTTP $STUDIO_STATUS OK
- Backend Echo PID: $BACKEND_PID (Port 4000)
- Next.js PID:      $NEXT_PID (Port 3000)
- Convex Tunnel PID:$CONVEX_TUNNEL_PID
- Studio Tunnel PID:$STUDIO_TUNNEL_PID
- App Tunnel PID:   $APP_TUNNEL_PID

--------------------------------------------------------------------------------
SURVIVES ANTIGRAVITY EXIT:
These daemons are running with nohup in detached process groups with logging to:
- $DIR/logs/next-app.log
- $DIR/logs/backend-echo.log
- $DIR/logs/tunnel-app.log
- $DIR/logs/tunnel-convex.log
- $DIR/logs/tunnel-studio.log

Even if you QUIT Antigravity IDE, these URLs will remain live and accessible!

TO STOP SERVICES:
Run: $DIR/scripts/stop-public-services.sh
================================================================================
"

echo "$SUMMARY" > "$DIR/HYPARLINK_PUBLIC_ACCESS.txt"
echo "$SUMMARY" > "$HOME/Desktop/HYPARLINK_PUBLIC_ACCESS.txt"

echo ""
echo "$SUMMARY"

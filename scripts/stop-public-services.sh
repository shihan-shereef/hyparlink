#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Stopping all Hyparlink services and tunnels..."
pkill -f "cloudflared" 2>/dev/null || true
pkill -f "backend-echo/server.mjs" 2>/dev/null || true
pkill -f "hyperframes preview" 2>/dev/null || true
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3055 | xargs kill -9 2>/dev/null || true

echo "✓ All public services and tunnels stopped."


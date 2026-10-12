#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Stopping all Hyparlink services and tunnels..."
pkill -f "cloudflared tunnel --url http://localhost:3000" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://localhost:3210" 2>/dev/null || true
pkill -f "backend-echo/server.mjs" 2>/dev/null || true
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "✓ All public services and tunnels stopped."

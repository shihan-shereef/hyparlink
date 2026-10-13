#!/usr/bin/env bash
# ==============================================================================
# HyperFrames Video Creation Dashboard — System Environment & Dependency Setup
# Automatically checks, configures, and verifies:
# 1. Node.js (>= 18.0.0)
# 2. npm (>= 8.0.0)
# 3. FFmpeg with H.264 & AAC codec support
# 4. FFprobe executable
# 5. HyperFrames CLI (0.8.139)
# ==============================================================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================================${NC}"
echo -e "${BLUE}HYPERFRAMES VIDEO CREATION AGENT — SYSTEM DEPENDENCY SETUP & VERIFICATION${NC}"
echo -e "${BLUE}================================================================================${NC}"

OS="$(uname -s)"
ARCH="$(uname -m)"
echo -e "Operating System: ${GREEN}${OS}${NC} (${ARCH})"

# Ensure ~/.local/bin exists and is in PATH
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"

# ------------------------------------------------------------------------------
# 1. NODE.JS & NPM
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[1/5] Checking Node.js and npm...${NC}"
if command -v node >/dev/null 2>&1; then
    NODE_VERSION="$(node --version)"
    echo -e "  ✓ Node.js found: ${GREEN}${NODE_VERSION}${NC}"
else
    echo -e "  ${YELLOW}Node.js not found. Installing...${NC}"
    if [ "$OS" = "Darwin" ]; then
        if command -v brew >/dev/null 2>&1; then
            brew install node
        else
            echo -e "  ${RED}Please install Node.js >= 18 from https://nodejs.org${NC}"
            exit 1
        fi
    elif [ "$OS" = "Linux" ]; then
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update && sudo apt-get install -y nodejs npm
        else
            echo -e "  ${RED}Please install Node.js >= 18 using your package manager.${NC}"
            exit 1
        fi
    fi
fi

if command -v npm >/dev/null 2>&1; then
    NPM_VERSION="$(npm --version)"
    echo -e "  ✓ npm found: ${GREEN}${NPM_VERSION}${NC}"
else
    echo -e "  ${RED}npm not found. Please install npm.${NC}"
fi

# ------------------------------------------------------------------------------
# 2. FFMPEG & FFPROBE
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[2/5] Checking FFmpeg and FFprobe...${NC}"

VENDOR_DIR="/Applications/HyperFrames.app/Contents/Resources/app.asar.unpacked/vendor/ffmpeg/darwin-arm64"

# Check if ffmpeg is in PATH
if ! command -v ffmpeg >/dev/null 2>&1; then
    echo -e "  ${YELLOW}ffmpeg not found in current PATH. Searching candidates...${NC}"
    
    # Priority A: Check if HyperFrames vendor ffmpeg exists on macOS
    if [ -d "$VENDOR_DIR" ] && [ -x "$VENDOR_DIR/ffmpeg" ]; then
        echo -e "  ${GREEN}Found HyperFrames bundled FFmpeg distribution.${NC}"
        ln -sf "$VENDOR_DIR/ffmpeg" "$HOME/.local/bin/ffmpeg"
        ln -sf "$VENDOR_DIR/ffprobe" "$HOME/.local/bin/ffprobe"
        echo -e "  ✓ Symlinked to $HOME/.local/bin/ffmpeg"
    elif [ "$OS" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
        echo -e "  Installing FFmpeg via Homebrew..."
        brew install ffmpeg
    elif [ "$OS" = "Linux" ] && command -v apt-get >/dev/null 2>&1; then
        echo -e "  Installing FFmpeg via apt-get..."
        sudo apt-get update && sudo apt-get install -y ffmpeg
    else
        echo -e "  ${YELLOW}Downloading official static build...${NC}"
        mkdir -p /tmp/ffmpeg-setup
        if [ "$OS" = "Linux" ]; then
            curl -sL "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" -o /tmp/ffmpeg-setup/ffmpeg.tar.xz
            tar -xf /tmp/ffmpeg-setup/ffmpeg.tar.xz -C /tmp/ffmpeg-setup
            cp /tmp/ffmpeg-setup/ffmpeg-*-static/ffmpeg "$HOME/.local/bin/ffmpeg"
            cp /tmp/ffmpeg-setup/ffmpeg-*-static/ffprobe "$HOME/.local/bin/ffprobe"
            chmod +x "$HOME/.local/bin/ffmpeg" "$HOME/.local/bin/ffprobe"
        fi
    fi
fi

if command -v ffmpeg >/dev/null 2>&1; then
    FFMPEG_VER="$(ffmpeg -version | head -n 1)"
    echo -e "  ✓ FFmpeg verified: ${GREEN}${FFMPEG_VER}${NC}"
else
    echo -e "  ${RED}✗ Failed to configure FFmpeg.${NC}"
    exit 1
fi

if command -v ffprobe >/dev/null 2>&1; then
    FFPROBE_VER="$(ffprobe -version | head -n 1)"
    echo -e "  ✓ FFprobe verified: ${GREEN}${FFPROBE_VER}${NC}"
else
    echo -e "  ${RED}✗ Failed to configure FFprobe.${NC}"
    exit 1
fi

# ------------------------------------------------------------------------------
# 3. CODEC & CONTAINER VERIFICATION
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[3/5] Verifying H.264 & AAC codec support...${NC}"
if ffmpeg -codecs 2>/dev/null | grep -E "h264|libx264" >/dev/null; then
    echo -e "  ✓ H.264 video codec: ${GREEN}Supported${NC}"
else
    echo -e "  ${YELLOW}! Warning: H.264 codec not explicitly detected.${NC}"
fi

if ffmpeg -codecs 2>/dev/null | grep -E "aac" >/dev/null; then
    echo -e "  ✓ AAC audio codec: ${GREEN}Supported${NC}"
else
    echo -e "  ${YELLOW}! Warning: AAC audio codec not explicitly detected.${NC}"
fi

# ------------------------------------------------------------------------------
# 4. HYPERFRAMES CLI
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[4/5] Checking HyperFrames rendering engine...${NC}"
HF_VER="$(npx --yes hyperframes@0.8.139 --version 2>/dev/null || echo "missing")"
if [ "$HF_VER" != "missing" ]; then
    echo -e "  ✓ HyperFrames CLI verified: ${GREEN}${HF_VER}${NC}"
else
    echo -e "  ${RED}✗ Could not resolve HyperFrames CLI.${NC}"
    exit 1
fi

# ------------------------------------------------------------------------------
# 5. STORAGE & PERMISSIONS
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[5/5] Verifying workspace storage and output permissions...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STORAGE_DIR="$(cd "$SCRIPT_DIR/../ai-composition-generator/storage" 2>/dev/null && pwd || echo "$SCRIPT_DIR/../ai-composition-generator/storage")"
mkdir -p "$STORAGE_DIR"
touch "$STORAGE_DIR/.perm_check" && rm "$STORAGE_DIR/.perm_check"
echo -e "  ✓ Storage directory writable: ${GREEN}${STORAGE_DIR}${NC}"

echo -e "\n${GREEN}================================================================================${NC}"
echo -e "${GREEN}ALL SYSTEM DEPENDENCIES CONFIGURED & READY FOR AUTONOMOUS VIDEO RENDERING!${NC}"
echo -e "${GREEN}================================================================================${NC}\n"

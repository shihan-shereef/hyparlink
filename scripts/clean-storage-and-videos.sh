#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "=== Starting Hyparlink Space Cleanup in: $REPO_ROOT ==="

GEN_PROJECTS="$REPO_ROOT/ai-composition-generator/generated-projects"
KEEP_DIRS=(
  "job-job_code_1792382768219_mbcw4" # London in 3 Days
  "job-job_code_1792579767973_8fodx" # Kerala - God's Own Country
  "job-job_code_1792671313199_tmeo3" # Delhi - The Mughals of Delhi
  "job-job_code_1792406082579_51k52" # Karnataka - A 3-Day Journey
  "job-job_code_1792219404621_iizjt" # Karnataka Reference
)

# 1. Clean generated-projects, keeping only the 4 target projects + reference
echo "1. Cleaning generated projects..."
if [ -d "$GEN_PROJECTS" ]; then
  for dir in "$GEN_PROJECTS"/*; do
    if [ -d "$dir" ]; then
      base="$(basename "$dir")"
      keep=0
      for k in "${KEEP_DIRS[@]}"; do
        if [ "$base" = "$k" ]; then
          keep=1
          break
        fi
      done
      if [ $keep -eq 0 ]; then
        rm -rf "$dir"
      fi
    fi
  done
fi

# 2. Clean root outputs, keeping reference videos
echo "2. Cleaning root outputs/..."
ROOT_OUTPUTS="$REPO_ROOT/outputs"
if [ -d "$ROOT_OUTPUTS" ]; then
  find "$ROOT_OUTPUTS" -type f \( -name "*.mp4" -o -name "*.mov" -o -name "*.webm" \) \
    -not -name "repaired_job-job_code_1792382768219_mbcw4_1792382812142.mp4" \
    -not -name "repaired_job-job_code_1792219404621_iizjt_1792381910438.mp4" \
    -delete || true
fi

# 3. Clean ai-composition-generator/outputs
echo "3. Cleaning ai-composition-generator/outputs/..."
AI_OUTPUTS="$REPO_ROOT/ai-composition-generator/outputs"
if [ -d "$AI_OUTPUTS" ]; then
  find "$AI_OUTPUTS" -type f \( -name "*.mp4" -o -name "*.mov" -o -name "*.webm" \) \
    -not -name "repaired_job-job_code_1792382768219_mbcw4_1792382812142.mp4" \
    -not -name "repaired_job-job_code_1792219404621_iizjt_1792381910438.mp4" \
    -delete || true
fi

# 4. Clean ai-composition-generator/storage
echo "4. Cleaning ai-composition-generator/storage/..."
AI_STORAGE="$REPO_ROOT/ai-composition-generator/storage"
if [ -d "$AI_STORAGE" ]; then
  rm -rf "$AI_STORAGE/heygen"/* || true
  rm -rf "$AI_STORAGE/workspaces"/* || true
  rm -rf "$AI_STORAGE/test-audio"/* || true
  rm -rf "$AI_STORAGE/test-suite-runs"/* || true
fi

# 5. Clean ai-composition-generator/generated-assets/discovered
echo "5. Cleaning ai-composition-generator/generated-assets/discovered/..."
AI_DISCOVERED="$REPO_ROOT/ai-composition-generator/generated-assets/discovered"
if [ -d "$AI_DISCOVERED" ]; then
  rm -rf "$AI_DISCOVERED"/* || true
fi

echo "=== Cleanup completed successfully! ==="

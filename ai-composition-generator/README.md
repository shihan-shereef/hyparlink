# HyperFrames AI Composition Generator Prototype (Phase 5)

A standalone prototype that converts natural-language video prompts into valid, lint-error-free [HyperFrames](https://hyperframes.heygen.com) projects and renders them into MP4 videos.

---

## Architecture Flow

```
USER PROMPT
    ↓
AI MODEL (OpenAI / Anthropic / HuggingFace / Gemini / Deterministic)
    ↓
HTML + CSS + JavaScript / GSAP
    ↓
Isolated HyperFrames Project Directory (job-<timestamp>-<uuid>)
    ↓
HyperFrames Check (npx hyperframes@0.8.139 check --json)
    ↓
[If Failed] Auto-Fix Feedback Loop (Max 3 attempts with AI)
    ↓
HyperFrames Render (npx hyperframes@0.8.139 render --resolution 1080p -o output.mp4)
    ↓
Final MP4 Output (1920x1080)
```

---

## Configuration

The system uses standard environment variables to configure the AI provider:

```bash
# Provider: 'openai' | 'anthropic' | 'huggingface' | 'gemini' | 'deterministic'
AI_PROVIDER=openai

# Model name:
AI_MODEL=gpt-4o

# API Secret (Never exposed to client):
AI_API_KEY=sk-...
```

If `AI_PROVIDER` and `AI_API_KEY` are not set, the prototype falls back to the built-in **Deterministic Engine**, allowing offline, zero-token validation and testing of the complete pipeline.

---

## Running the Prototype

### 1. Run with default test prompt:
```bash
cd ai-composition-generator
npm run test:prompt
```

### 2. Run with custom natural-language prompt:
```bash
cd ai-composition-generator
npx tsx src/index.ts --prompt "Create a 5-second 1080p landscape title card for HyperFrames Studio with a dark background, blue glowing text, a smooth fade-in animation and a camera push effect."
```

---

## HyperFrames Rules Enforced

1. **Paused Timelines**: Every GSAP timeline is created paused (`gsap.timeline({ paused: true })`). The HyperFrames headless renderer drives playback.
2. **Deterministic Playback**: No `Date.now()`, `performance.now()`, `requestAnimationFrame()`, or unseeded `Math.random()`.
3. **Timeline Registry**: Registered on `window.__timelines["scene-timeline"] = tl;`.
4. **Compile-time Durations**: Driven by static `data-start` and `data-duration` attributes.
5. **No CSS Transform Conflicts**: Elements animated by GSAP do not declare conflicting initial CSS `transform` declarations.
6. **Project Isolation**: Every job generates an isolated folder in `generated-projects/job-<id>/` ensuring existing projects are never modified or overwritten.

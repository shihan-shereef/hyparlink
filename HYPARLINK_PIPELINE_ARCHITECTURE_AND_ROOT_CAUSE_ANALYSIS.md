# Hyparlink Architecture, Pipeline Analysis & Root Cause Report
**Document Target**: Engineering Leadership, System Architects & LLM Technical Evaluators (Formatted for ChatGPT / Claude Technical Review)  
**Date**: October 2026  
**System**: Hyparlink HyperFrames Video Generation Engine & Dashboard  

---

## 1. Executive Summary

When users prompted the Hyparlink web dashboard (`/create-video`) to generate video compositions, the resulting videos frequently appeared generic, defaulted to flat single-text slides, or hallucinated irrelevant themes (such as Batman, Superman, Guy Gardner Green Lantern, or generic corporate slogans). Conversely, when connecting an autonomous AI coding agent directly to HyperFrames on a local terminal/IDE, the generated output was stunning, visually rich, structurally dynamic, and strictly tailored to the prompt.

This report explains:
1. **The Core Architectural Disconnect**: Why the local agent and the web dashboard produced completely different outputs.
2. **Root Cause Analysis**: The five fatal architectural bottlenecks that caused the dashboard pipeline to collapse into "demo mode".
3. **The Complete Solution**: The systematic upgrades implemented to transform the dashboard pipeline into a full autonomous AI authoring engine that generates prompt-accurate, production-grade HyperFrames compositions without hallucinating or falling back to defaults.

---

## 2. End-to-End System Architecture & Data Pipeline

The Hyparlink platform consists of four interconnected layers:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           1. CLIENT LAYER (Next.js 15)                          │
│  User Prompt & Duration  ───►  /create-video  ───►  Active Workspace State       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        2. ORCHESTRATION & STATE (Convex)                        │
│  • Mutation: projects.create                                                    │
│  • Record inserted into 'projects' & 'jobs' tables                              │
│  • Scheduler triggers: jobs.processJob                                          │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ HTTP POST /jobs/run
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     3. BACKEND EXECUTION RUNTIME (Node.js)                       │
│  backend-echo/server.mjs                                                        │
│  ├── Dispatches generation to ai-composition-generator                         │
│  ├── Polls & streams pipeline stages back to Convex                             │
│  ├── Orchestrates Headless HyperFrames CLI Render (`npx hyperframes render`)    │
│  └── Encodes HLS & MP4 via FFmpeg and uploads to S3 / Local CDN Storage         │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│               4. AI COMPOSITION ENGINE (ai-composition-generator)               │
│  Stage 1: Writing Composition (LLM Creative Brief & Asset Ingestion)            │
│  Stage 2: Timing Clips (Mathematical Frame-Accurate Timeline Planning)         │
│  Stage 3: Animating Elements (AI Scene HTML/SVG/GSAP Authoring)                 │
│  Stage 4: Checking Composition (HyperFrames Linter & Compliance Audit)         │
│  Stage 5: Rendering Video (Chromium Headless Render @ 1080p 30fps)             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Breakdown:
1. **User Request**: The user enters a prompt (e.g. *"Create a 15-second high-energy sports brand commercial for CyberShoe with neon electric cyan velocity arcs, speed metrics HUD, and bold kinetic typography"*).
2. **Convex Ingestion**: `packages/backend/convex/projects.ts` inserts a project record with initial duration, resolution, and status (`generating`), creates a background job in `jobs`, and invokes `backend-echo:4000/jobs/run`.
3. **Execution Runtime**: `backend-echo/server.mjs` executes `AIGenerator.generateProject()`.
4. **Generation & Verification**: The engine plans the brief, schedules scenes, synthesizes HTML/CSS/GSAP scene files, writes `index.html` and `project.json`, lints the project, and invokes `hyperframes render` to produce the final `.mp4`.
5. **Storage & Feedback**: The output video is uploaded to the storage provider, thumbnails and HLS manifests are created, and Convex updates the project state to `completed`.

---

## 3. Why the Local Device Agent Output and Dashboard Output Were Radically Different

| Dimension | Local Device Agent (HyperFrames Connected Directly) | Legacy Dashboard Pipeline (Prior to Fix) |
| :--- | :--- | :--- |
| **Code Authoring Method** | **Direct HTML/GSAP Authoring**: The agent writes full bespoke HTML, CSS grid/flex layouts, inline SVG vectors, and GSAP timeline animations for every single scene. | **Static TypeScript Templates**: The LLM was only prompted for a JSON summary metadata brief. HTML code was generated by static TypeScript template strings with hardcoded layout rules. |
| **Skill & Knowledge Base** | Uses official HyperFrames skills (`hyperframes-animation`, `hyperframes-creative`), incorporating over 24 animation patterns, kinetic typography rifs, and CSS mesh shaders. | Relied on a rigid, hardcoded `switch(sceneType)` statement in `composition-synthesizer.ts`. Any prompt not matching a known demo fell into `buildDynamicShowcaseScene` (a single bare headline on a flat slide). |
| **Error Handling & Resilience** | Autonomous loop: if a syntax or layout error occurs, the agent inspects the DOM/CLI logs, corrects the error, and iterates until the video renders cleanly. | If the LLM returned a JSON parsing error, the system silently aborted to `synthesizeDefaultBrief()`, overwriting the prompt with mock demo data. |
| **Asset & Theme Dispatch** | Creates custom SVG geometry on the fly (e.g., speed vectors, HUD brackets, custom iconography) matching the exact topic. | Hijacked prompts containing common words (e.g., "tree", "revenue", "hero", "lantern", "batman") into hardcoded comic or demo presets. |
| **Voiceover Narration** | Contextual narration matching the prompt's tone and timing. | Hardcoded comic dialogue ("In brightest day... Guy Gardner") or canned trailer phrases ("Step into an unprecedented cinematic visual journey"). |

---

## 4. Root Cause Breakdown (The 5 Fatal Failure Points)

### Failure Point 1: The LLM Never Wrote Composition Code
- In the dashboard pipeline, the LLM was restricted to generating a JSON `CreativeBrief` object.
- Stage 3 (`CompositionSynthesizer.synthesize`) was a **static TypeScript builder**. It did not invoke an LLM to design the scene HTML, layout, or GSAP code. Instead, it assembled boilerplate template strings. If the prompt was about shoes, coffee, tech, or architecture, it could only render whatever primitive placeholder strings existed in the template.

### Failure Point 2: Silent JSON Parser Crash via Unescaped Control Characters
- When the LLM (e.g. Gemini / Ollima) returned a rich, multi-scene creative brief, it frequently included unescaped newline characters (`\n`), tabs, or trailing commas within JSON property values (e.g. `"visualDescription": "line 1\nline 2"`).
- Standard Node.js `JSON.parse()` crashed on these control characters (`SyntaxError: Bad control character in string literal`).
- The pipeline caught this error in a `catch` block and silently fell back to `this.synthesizeDefaultBrief()`. As a result, the user's prompt was abandoned, and the engine generated a default fallback brief.

### Failure Point 3: Priority Inversion in `ScenePlanner.planTimeline`
- In `scene-planner.ts`, the dispatch loop checked hardcoded scenario flags (`isTreeGrowth`, `isHttpFlow`, `isBatman`, `isSuperman`, `isGreenLantern`) **before** checking if `brief.scenes` existed.
- Even when the LLM generated a custom brief with prompt-tailored scenes, any prompt containing words like "batman", "growth", "light", or "superman" was hijacked by the static comic mock branches.

### Failure Point 4: Hardcoded Comic Voiceover and Preset Overrides in `backend-echo/server.mjs`
- In `server.mjs`, the voiceover narration block (Phase 6B) contained hardcoded scripts for DC characters:
  ```js
  if (isGL) {
    lines = [
      { time: 500, text: "In brightest day, in blackest night..." },
      { time: 6500, text: "He is loud, he is unfiltered... Guy Gardner." }
    ];
  }
  ```
- Furthermore, the project title resolution logic hardcoded project names:
  ```js
  if (pLower.includes("batman")) return "Absolute Batman";
  if (pLower.includes("lantern")) return "DC Lanterns: Guy Gardner";
  if (pLower.includes("ollima")) return "Ollima Commercial";
  ```
- Any general prompt mentioning these terms had its title and audio replaced by comic presets.

### Failure Point 5: Lack of Dynamic Visual Depth in Fallback Layouts
- When the fallback layouts (`kinetic-typography`, `cinematic-hero-intro`, `cinematic-climax-cta`) rendered without pre-existing image assets, they consisted of a single centered `<h1>` on a dark background without visual geometry, SVG speed vectors, badges, or telemetry cards.

---

## 5. The Solution Implemented

### 1. Direct AI Scene Authoring (`CompositionSynthesizer.synthesizeWithAI`)
- Added autonomous scene code generation directly in [composition-synthesizer.ts](file:///Users/apple/Desktop/hyparlink%20dashbord/ai-composition-generator/src/ai/composition-synthesizer.ts).
- For each scene in the planned timeline, the LLM is prompted with the scene's objectives, brand typography, color palette, duration, and visual direction.
- The LLM writes complete, production-grade HyperFrames HTML code with:
  - Custom SVG graphics and visual iconography tailored to the topic.
  - Paused GSAP timelines attached to `window.__timelines[sceneId]` seeking to `0` for deterministic headless rendering.
  - Glowing accents, glassmorphic HUD telemetry cards, and staggered kinetic typography.
- Scene authoring runs in parallel with safety fallbacks to enhanced visual layouts.

### 2. Resilient JSON Parsing with `jsonrepair`
- Installed and integrated `jsonrepair` in [generator.ts](file:///Users/apple/Desktop/hyparlink%20dashbord/ai-composition-generator/src/ai/generator.ts).
- `extractJsonFromText` now cleans comments, normalizes code fences, and repairs unescaped control characters, quotes, and trailing commas.
- LLM creative briefs are parsed reliably on the first attempt without triggering offline default fallbacks.

### 3. Scene Planner Priority Rectification
- In [scene-planner.ts](file:///Users/apple/Desktop/hyparlink%20dashbord/ai-composition-generator/src/ai/scene-planner.ts), `brief.scenes` is now checked **first**.
- If the LLM generates tailored scene plans for the user's prompt, they take immediate precedence over any keyword or fallback logic.

### 4. Removal of Comic and Demo Preset Overrides
- Removed hardcoded Guy Gardner, Superman, and Batman voiceover scripts from [server.mjs](file:///Users/apple/Desktop/hyparlink%20dashbord/backend-echo/server.mjs).
- Voiceover narration is now requested dynamically from the LLM specifically for the user's prompt.
- Cleaned title resolution in [server.mjs](file:///Users/apple/Desktop/hyparlink%20dashbord/backend-echo/server.mjs) and [projects.ts](file:///Users/apple/Desktop/hyparlink%20dashbord/packages/backend/convex/projects.ts), deriving clean titles directly from the user's prompt and generated metadata.

### 5. Upgraded Design System Tokens
- Enhanced the fallback layouts in `composition-synthesizer.ts` with SVG speed accents, glassmorphic metric cards, glowing pill badges, and multi-word kinetic staggered headers so that even offline fallback renders appear as high-production media.

---

## 6. Verification and Test Results

We tested the updated pipeline using a completely new prompt with no pre-existing assets:
> *"Create a 15-second high-energy sports brand commercial for CyberShoe with neon electric cyan velocity arcs, speed metrics HUD, and bold kinetic typography"*

### Execution Results:
1. **Stage 1 (Writing Composition)**:
   - LLM Creative Brief generated and parsed with 0 errors via `jsonrepair`.
   - Title assigned: `"CyberShoe Velocity Commercial"`.
   - Category assigned: `"advertisement"`.
   - Automated AI image generator synthesized 5 bespoke 8K photorealistic product and action images.
2. **Stage 2 (Timing Clips)**:
   - Frame-accurate timeline computed: exactly 450 frames @ 30 fps (15.0 seconds).
   - 3 dynamic scenes scheduled: `Kinetic Intro`, `Metrics HUD Overlay`, and `Climax CTA`.
3. **Stage 3 (Animating Elements)**:
   - Concurrent LLM authoring synthesized bespoke HTML/SVG/GSAP code:
     - `compositions/scene_01.html`: 6,158 bytes
     - `compositions/scene_02.html`: 7,648 bytes
     - `compositions/scene_03.html`: 7,451 bytes
   - Total generated project size: ~38 KB of tailored HyperFrames code.
4. **Zero Fallback & Zero Comic Hijacking**:
   - No Batman, no Superman, no Guy Gardner, and no generic single-text slides.
   - All animations strictly bound to deterministic GSAP timelines seeking to frame 0.

---

## 7. How to Maintain and Extend This Architecture (Guide for LLM Engineers)

When extending the Hyparlink pipeline or integrating new models:
1. **Always Use `jsonrepair` for LLM JSON Responses**: Never pass raw LLM text directly to `JSON.parse()`. LLMs generating multi-paragraph briefs will occasionally leave unescaped quotes or newlines.
2. **Preserve Deterministic Animation Rules**: HyperFrames requires that all CSS animations and GSAP timelines be paused at frame 0 (`tl.pause(0)` and `window.__timelines[sceneId] = tl; tl.seek(0)`). Never use unmetered `requestAnimationFrame`, `setInterval`, or CSS animations with `infinite` iterations without a timeline master.
3. **Prompt Specificity Over Hardcoded Layouts**: Instead of adding new switch cases in `scene-planner.ts`, add layout guidance into `CREATIVE_BRIEF_SYSTEM_PROMPT` and let `CompositionSynthesizer.generateSceneWithAI()` author the DOM elements dynamically.

# How HyperFrames Works: End-to-End Video Generation Architecture

This document provides a comprehensive technical guide explaining how **HyperFrames** generates videos from natural language prompts, how it connects to the system, and how the entire pipeline operates from prompt submission to final MP4 playback.

---

## 1. What is HyperFrames?

[HyperFrames](https://github.com/heygen-com/hyperframes) is an open-source, code-driven video rendering and motion graphics engine created by **HeyGen**. 

Unlike conventional AI video generators that hallucinate pixel grids using diffusion models (which often distort text, warp logos, and lack deterministic precision), HyperFrames creates video compositions using:
* **Standard Web Standards:** HTML5, CSS3, and Scalable Vector Graphics (SVG).
* **Deterministic Animation Timelines:** [GSAP (GreenSock Animation Platform)](https://greensock.com/gsap/) for frame-accurate 60/30fps interpolation.
* **Headless Chromium & Metal GPU Acceleration:** Renders web compositions frame-by-frame with hardware acceleration.
* **FFmpeg Video Encoding:** Compiles rendered frames into H.264/MP4 and WebM videos.

---

## 2. Complete System Architecture & Pipeline Flow

The end-to-end flow consists of 8 interconnected stages:

```
[ User Prompt / Dashboard ]
           │
           ▼
[ 1. Next.js Frontend (apps/app) ]
           │
           ▼
[ 2. Convex Database & Queue ]
           │
           ▼
[ 3. Hybrid Backend (backend-echo/server.mjs) ]
           │
           ▼
[ 4. AI Composition Generator (ai-composition-generator) ]
    ├── Prompt Parser (Extracts duration, colors, subjects, text)
    ├── Asset Resolver (Copies workspace images/logos into project)
    └── Code Synthesizer (Generates index.html, scene_01.html, GSAP)
           │
           ▼
[ 5. HyperFrames Validator & Auto-Correction ]
           │
           ▼
[ 6. HyperFrames Render Engine (npx hyperframes render) ]
    ├── Headless Chrome (Metal GPU Acceleration)
    └── FFmpeg Engine (Encodes into 1080p MP4)
           │
           ▼
[ 7. Cloud Storage & Transcoder (Local/S3 Provider) ]
    ├── 1080p, 720p, 480p Video Profiles
    └── WebP Thumbnail Generation
           │
           ▼
[ 8. Webhook Notification & Realtime Video Player ]
```

---

## 3. Step-by-Step Breakdown of the Pipeline

### Step 1: User Input via Dashboard (`apps/app`)
* On the **Create Video** page (`http://localhost:3000/create-video`), the user inputs:
  * **Video Prompt** (e.g., *"Create a 5-second 1080p cinematic advertisement for Ollasoftware headquarters..."*)
  * **Resolution** (1080p / 720p / 480p)
  * **Duration** (5s, 15s, 30s)
  * **Optional Workspace Assets** (e.g., logos, building images).
* Clicking **Generate Video** calls the Convex mutation `projects:create`.

### Step 2: Job Queuing in Convex (`packages/backend/convex`)
* Convex stores the project record in the `projects` table with status `"generating"`.
* A corresponding job record is inserted into the `jobs` table with kind `"video.generate"`.
* Convex dispatches an asynchronous execution request to the background rendering service.

### Step 3: Backend Dispatcher (`backend-echo/server.mjs`)
* The Node.js service running on port `4000` receives the job via `/jobs/run`.
* It updates the job status to `"validating"` and invokes the `VideoGenerationPipeline`.
* Any workspace assets referenced by the project (such as `ollasoftware-building.jpg`) are resolved from storage.

### Step 4: AI Composition Generator (`ai-composition-generator`)
This component converts natural language into code:
1. **Lexical & Subject Parsing:**
   * **Subject Detection:** Analyzes prompt tokens to detect target visuals:
     * `hasBuilding` (e.g., *building, headquarters, hq, architecture, Ollasoftware*)
     * `hasTree` (e.g., *tree, branches, boughs, leaves, forest, growing*)
     * `hasCar` (e.g., *car, supercar, vehicle, speed*)
   * **Color & Ambience:** Matches background gradients (`#020718`, `#00040f`), glow colors (`#00d4ff`, `#ffd700`), and grid overlays.
   * **Motion Keywords:** Detects camera movements (`zoom in`, `zoom out`, `spin`, `slide`, `dolly`).
2. **Project Bundle Creation:**
   Generates a standalone project folder inside `generated-projects/` containing:
   * `index.html`: Root composition host defining global duration, width, and height.
   * `compositions/scene_01.html`: Complete HTML/SVG scene with GSAP animation timelines.
   * `meta.json`: Timeline metadata (framerate, duration, resolution).
   * `project.json`: HyperFrames project configuration (`version: "0.8.139"`).
   * `assets/`: Linked media files (e.g., `ollasoftware-building.jpg`).

### Step 5: HyperFrames Validation (`validator.ts`)
* Before rendering, the generator invokes HyperFrames validation:
  * Verifies that all elements have valid `data-composition-id` and timeline markers.
  * Ensures timeline durations match across root and child compositions.
  * Verifies asset paths exist on disk.

### Step 6: Rendering with HyperFrames (`renderer.ts`)
The generator runs the official HyperFrames CLI command:
```bash
npx --yes hyperframes@0.8.139 render --resolution 1080p --format mp4 -o "outputs/output-<jobId>.mp4"
```
* **Headless Browser Execution:** Launches Headless Chromium with Metal GPU acceleration on macOS.
* **Frame Step Evaluation:** Steps through the GSAP timeline frame by frame (30 frames per second = 150 frames for a 5-second video).
* **FFmpeg Muxing:** Pipes the rendered canvas frames directly into FFmpeg (`libx264` codec, `yuv420p` pixel format) to generate a high-bitrate MP4 file.

### Step 7: Cloud Storage & Multi-Profile Transcoding
Once HyperFrames finishes rendering:
1. The 1080p master MP4 is uploaded to persistent storage under:
   `workspaces/<workspaceId>/projects/<projectId>/renders/<jobId>/video.mp4`
2. `MediaProcessor` uses FFmpeg to generate optimized renditions:
   * **720p HD profile** (`1280x720`)
   * **480p SD profile** (`854x480`)
   * **WebP Poster Thumbnail** (extracted at 1.0s or 50% timestamp)
3. Direct streaming URLs are assigned.

### Step 8: Webhook & Dashboard Realtime Playback
* The backend posts to Convex: `/backend/webhook` with event `job.completed`.
* Convex updates the project status from `"generating"` to `"completed"`.
* The dashboard page (`/projects/[id]`) reactively refreshes and loads the custom video player with 1080p/720p/480p resolution switching and HTTP 206 Partial Content video streaming.

---

## 4. How Prompts are Translated into Visuals (Deep Dive)

### Why Videos Previously Showed Only Text
Previously, `provider.ts` defaulted to rendering a fallback title card with:
```html
<h1 class="title">HYPERFRAMES STUDIO</h1>
<p class="subtitle">CINEMATIC MOTION GRAPHICS</p>
```
Because it lacked nature, tree, or building detection, entering prompts like *"tree growing"* or *"Ollasoftware headquarters"* caused it to ignore the subject and simply display text on a grid.

### How Subject Visuals Are Rendered Now

#### 1. Nature & Tree Visuals (`hasTree`)
* **Vector Geometry:** Generates a custom SVG (`viewBox="0 0 1000 950"`) with:
  * Radial energy ground pool and roots (`#ffd700`)
  * Rising tapered trunk with luminous central spine
  * 6 spreading branch stems with glowing circuit streams
  * 35+ golden jewel leaves clustered across branch tips
  * 14 floating golden particles with radial glow
* **GSAP Animation Sequence:**
  * `0.0s – 1.2s`: Ground energy pool expands.
  * `0.2s – 1.8s`: Trunk scales upward from the ground (`transformOrigin: "center bottom"`).
  * `1.0s – 2.8s`: Branches unfurl outward.
  * `1.4s – 3.2s`: Energy veins animate using `strokeDashoffset` from `600` to `0`.
  * `1.8s – 3.8s`: Leaves bloom with `back.out(1.8)` stagger.
  * `1.2s – 5.0s`: Golden particles drift gently upwards with sine-wave motion.
  * **Title Card:** Text is automatically suppressed so no intrusive headline blocks the tree visual.

#### 2. Corporate & Architectural Showcases (`hasBuilding`)
* **Layout:** A split-screen landscape composition:
  * **Right Side:** A 3D architectural showcase panel with rounded corners (`border-radius: 24px`), glowing pedestal base, and glass border reflections.
  * **Left Side:** 
    * Enterprise badge: `ENTERPRISE CLOUD HEADQUARTERS`
    * Illuminated title: `OLLASOFTWARE`
    * Subtitle: `NEXT-GENERATION ENTERPRISE ARCHITECTURE`
    * Three performance metric cards: `99.99% UPTIME`, `100+ REGIONS`, `10M+ USERS`
    * Glowing Call-to-Action button: `DISCOVER THE FUTURE →`
* **GSAP Animation Sequence:**
  * `0.1s – 1.6s`: Building scales smoothly up with 3D perspective zoom (`scale: 0.85 -> 1.05`, `y: 50 -> 0`).
  * `0.3s – 1.4s`: Badge and main headline slide in with `back.out(1.4)`.
  * `1.0s – 2.0s`: Metric cards stagger upward into position.
  * `1.4s – 2.4s`: Glowing CTA button scales in.
  * `1.6s – 5.0s`: Continuous subtle camera zoom and breathing light glow.

---

## 5. File & Directory Reference

| Path | Purpose |
| :--- | :--- |
| [ai-composition-generator/src/ai/provider.ts](file:///Users/apple/Desktop/hyparlink%20dashbord/ai-composition-generator/src/ai/provider.ts) | Prompt parsing, color extraction, SVG generation, and GSAP timeline synthesis. |
| [ai-composition-generator/src/pipeline/generate-video.ts](file:///Users/apple/Desktop/hyparlink%20dashbord/ai-composition-generator/src/pipeline/generate-video.ts) | Orchestrates project creation, asset copying, validation, and rendering. |
| [ai-composition-generator/src/hyperframes/renderer.ts](file:///Users/apple/Desktop/hyparlink%20dashbord/ai-composition-generator/src/hyperframes/renderer.ts) | Calls `npx hyperframes render` with FFmpeg and Chromium. |
| [ai-composition-generator/src/hyperframes/validator.ts](file:///Users/apple/Desktop/hyparlink%20dashbord/ai-composition-generator/src/hyperframes/validator.ts) | Validates composition structure, durations, and accessibility. |
| [backend-echo/server.mjs](file:///Users/apple/Desktop/hyparlink%20dashbord/backend-echo/server.mjs) | Hybrid backend listening on port `4000`; handles jobs, storage streaming, and webhooks. |
| [packages/backend/convex/projects.ts](file:///Users/apple/Desktop/hyparlink%20dashbord/packages/backend/convex/projects.ts) | Convex mutations and queries for project records. |
| [packages/backend/convex/assets.ts](file:///Users/apple/Desktop/hyparlink%20dashbord/packages/backend/convex/assets.ts) | Workspace media asset management and AI asset resolution. |
| [apps/app/src/app/[locale]/(dashboard)/create-video/page.tsx](file:///Users/apple/Desktop/hyparlink%20dashbord/apps/app/src/app/%5Blocale%5D/%28dashboard%29/create-video/page.tsx) | Next.js dashboard UI for prompt submission and asset selection. |

---

## 6. How to Create Videos with Prompts and Assets

1. Navigate to **Create Video** on the dashboard (`http://localhost:3000/create-video`).
2. Enter your prompt describing the subject, lighting, background, and motion:
   * **For Architectural / Brand Ads:** Mention the company or building (e.g., *"Create a 5-second 1080p commercial for Ollasoftware headquarters with glowing blue lighting..."*).
   * **For Nature / Organic Animations:** Mention trees or branches (e.g., *"Create a 5-second video of a golden tree growing gracefully from the ground with unfolding leaves..."*).
   * **For Vehicles / Speed Showcases:** Mention supercars or racing (e.g., *"Create a futuristic sports car racing through neon speed lines..."*).
3. Optionally select an asset from your **Workspace Media** library (e.g., `ollasoftware-building.jpg`).
4. Click **Generate Video**. HyperFrames will synthesize the code, validate the animation, render the frames via GPU, and deliver the completed video.

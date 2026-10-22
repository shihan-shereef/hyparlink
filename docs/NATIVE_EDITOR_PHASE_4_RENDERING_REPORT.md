# Native Hyperlink Video Editor — Phase 4: Rendering, Export, and Persistence Report

**Project:** Ollastar / Hyperlink Dashboard  
**Phase:** Phase 4 — Native Video Editor: Rendering, Export, and Persistence  
**Date:** October 19, 2026  
**Status:** Completed & Validated

---

## 1. Existing Rendering Architecture

The Hyperlink video rendering pipeline leverages an orchestrated Node.js backend (`backend-echo/server.mjs`) alongside HyperFrames CLI and FFmpeg for deterministic headless rendering:

```
┌─────────────────────────────────────────────────────────────┐
│                   Native Hyperlink Editor                   │
│   (Interactive Canvas, Property Inspector, Multitrack TL)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /editor/project/:id/render
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Hybrid Backend Service                      │
│                 (backend-echo/server.mjs)                   │
├─────────────────────────────────────────────────────────────┤
│ 1. Project Directory Resolution & Path Traversal Guards     │
│ 2. Active Job Mutex (409 Conflict Duplicate Guard)         │
│ 3. Automated Timestamped Backup (.backups/backup-<time>)    │
│ 4. Pre-render Syntax & Layout Check (Validator.validate)    │
│ 5. HyperFrames Headless Chrome Frame Capture                │
│ 6. FFmpeg Video Stitching & Probe Verification              │
│ 7. Local Storage / CDN Upload & WebP Thumbnail Generation   │
│ 8. Persistent Map Stores (apiJobStore, apiProjectStore)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Output MP4 via HTTP Streaming
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Video Preview Modal & Direct Download           │
│   (HTML5 Native Player with Range Requests & WebP Thumbs)   │
└─────────────────────────────────────────────────────────────┘
```

### Key Components:
1. **Composition Structure:**
   - Compositions reside in `ai-composition-generator/generated-projects/<projectId>/`.
   - Each project contains an entry `index.html`, sub-compositions under `compositions/*.html`, configuration `project.json`, and metadata `meta.json`.
   - Elements carry timing attributes (`data-start`, `data-duration`, `data-composition-id`) and GSAP timelines registered under `window.__timelines[sceneId]`.
2. **Preview Subsystem:**
   - Sandboxed iframe preview served at `GET /editor/project/:projectId/raw/index.html`.
   - Bidirectional postMessage bridge relays visual edits (`HYPERLINK_UPDATE_TEXT`, `HYPERLINK_UPDATE_STYLE`, `HYPERLINK_UPDATE_VARIABLE`, `HYPERLINK_TOGGLE_LAYER`) in real-time.
3. **Headless Renderer:**
   - Invokes `npx --yes hyperframes@0.8.139 render --resolution <res> --format <fmt> -o <path>` via `ai-composition-generator/dist/hyperframes/renderer.js`.
   - Drives headless Chromium (`chrome-headless-shell`) to step through paused timelines frame-by-frame, piping raw frames into FFmpeg.
4. **Encoding & Verification:**
   - FFmpeg encodes frames with `libx264` (`-crf 16 -preset medium -pix_fmt yuv420p`).
   - `ffprobe` probes the resulting MP4 container, verifying width, height, framerate, duration, and codec.
   - `MediaProcessor.generateThumbnail` extracts a high-resolution WebP poster frame from the rendered MP4.

---

## 2. Rendering Integrations Reused

In accordance with strict system guidelines, no redundant rendering engines were created. The implementation directly reuses and elevates the existing production infrastructure:
- **`Validator` (`ai-composition-generator/dist/hyperframes/validator.js`):** Reused for automated pre-flight checks (lint, runtime syntax, layout overflow, motion timeline validation) before launching compute-intensive headless renders.
- **`Renderer` (`ai-composition-generator/dist/hyperframes/renderer.js`):** Reused for headless Chromium frame capture and FFmpeg audio-video multiplexing.
- **`LocalStorageProvider` / CDN (`backend-echo/storage/`):** Reused for artifact storage, persistent keys (`workspaces/<ws>/projects/<proj>/renders/<jobId>/video.mp4`), and byte-range HTTP streaming.
- **`MediaProcessor` (`backend-echo/media/media-processor.mjs`):** Reused for WebP thumbnail extraction.
- **Official HyperFrames Studio & Scene Inspector:** 100% preserved and operational side-by-side with the Native Editor.

---

## 3. Files Changed

| File Path | Description of Changes |
| :--- | :--- |
| [`backend-echo/server.mjs`](file:///Users/apple/Desktop/hyparlink%20dashbord/backend-echo/server.mjs) | Added `activeRenderProjects` concurrency mutex (409 Conflict guard); added dynamic export options parsing (`resolution`, `fps`, `format`, `filename`, `includeAudio`); updated `POST /editor/project/:projectId/render` to record rich job metadata and write `meta.renders` to `meta.json`; added `GET /editor/project/:projectId/renders` endpoint; updated `GET /editor/project/:projectId` to return render history and `isRendering` status. |
| [`apps/app/src/components/native-editor/types.ts`](file:///Users/apple/Desktop/hyparlink%20dashbord/apps/app/src/components/native-editor/types.ts) | Enhanced `RenderJob` interface with `projectId`, `completedAt`, `format`, `fileSizeBytes`, `fileSizeFormatted`, `videoUrl`, `thumbnailUrl`, `renderTimeSeconds`, `error`; defined `ExportSettings` interface. |
| [`apps/app/src/components/native-editor/right-property-panel.tsx`](file:///Users/apple/Desktop/hyparlink%20dashbord/apps/app/src/components/native-editor/right-property-panel.tsx) | Implemented full Export Configuration controls (resolution, framerate, quality preset, audio toggle, custom filename); added real render jobs queue with status badges (`COMPLETED`, `RENDERING`, `FAILED`), metadata pills, in-editor video preview action, direct download link, retry action, and duplicate-safe render triggering. |
| [`apps/app/src/components/native-editor/native-editor-view.tsx`](file:///Users/apple/Desktop/hyparlink%20dashbord/apps/app/src/components/native-editor/native-editor-view.tsx) | Added top status sub-toolbar displaying project metadata chips, dynamic save status badge ("Unsaved Changes" vs "All edits saved"), quick Save button, Watch Video button, and Download MP4 link; added responsive modal for in-editor video preview; wired `renderJobs` state to real backend data. |
| [`apps/app/src/app/[locale]/(dashboard)/editor/[projectId]/page.tsx`](file:///Users/apple/Desktop/hyparlink%20dashbord/apps/app/src/app/%5Blocale%5D/%28dashboard%29/editor/%5BprojectId%5D/page.tsx) | Added `renders` state and parsed `data.renders` from backend; updated `handleSyncAndRender` to pass custom export parameters (`resolution`, `fps`, `format`, `filename`, `includeAudio`); bound `renderedVideoUrl`, `renders`, `hasUnsavedChanges`, and `isSaving` props down to `NativeHyperlinkEditor`. |

---

## 4. Persistence Implementation

The Native Editor implements a robust dual-layer persistence model:

1. **Immediate In-Memory Buffer Synchronization:**
   - Any visual edit made via the canvas or property panel (text, typography, color, background, CSS variables, layer visibility, or timeline scene duration) immediately broadcasts a `postMessage` to the preview iframe.
   - Concurrently, the exact change is parsed and written into the active file's code string (`files[selectedFile]`).
   - `localUnsaved` state is set to `true`, switching the top badge to amber `● Unsaved Changes`.
2. **Atomic Disk Persistence:**
   - Clicking **Save Changes** (in top sub-header or left panel) invokes `POST /editor/project/:projectId/save`.
   - The backend validates all relative paths to prevent directory traversal.
   - An automatic timestamped backup is generated under `.backups/backup-<timestamp>/` before touching active files.
   - Updated composition files and `meta.json` are written atomically to disk.
   - The client confirms save success with a toast, updates `previewKey`, and resets the badge to green `✓ All edits saved`.
3. **Restoration Across Reloads:**
   - On page refresh or project reload, `GET /editor/project/:projectId` reads the saved files and properties from disk, completely preserving all customizations.

---

## 5. Export Functionality

The Export tab in the Right Property Inspector provides configurable controls matching backend capabilities:

- **Output Resolution Presets:**
  - `1080p` (Full HD, 1920 &times; 1080, 16:9)
  - `720p` (HD, 1280 &times; 720, 16:9)
  - `4k` (Ultra HD, 3840 &times; 2160, 16:9)
  - `portrait` (Mobile, 1080 &times; 1920, 9:16)
  - `square` (Social, 1080 &times; 1080, 1:1)
- **Framerate Options:**
  - `30 FPS` (Standard)
  - `60 FPS` (Ultra Smooth)
- **Container Format:**
  - `MP4` (H.264 / AAC)
- **Quality Preset:**
  - `High` (Production, CRF 16)
  - `Standard` (CRF 22)
- **Audio Tracks:**
  - Toggle to include or mute background score and voice narration.
- **Output Filename:**
  - Customizable export filename (sanitized on backend to alphanumeric, hyphen, underscore).
- **Concurrency & Duplicate Prevention:**
  - In-flight render locks (`activeRenderProjects`) immediately return HTTP 409 Conflict if duplicate requests are submitted.
  - The frontend export button enters a disabled spinning state (`Rendering Production MP4...`) while a job is running.

---

## 6. Render-Job Workflow

The complete end-to-end rendering workflow operates as follows:

```
[User Clicks 'Start Production Render']
               │
               ▼
   [Validation Pre-check]
   - Validate composition syntax, CSS, GSAP timelines, layout bounds
   - Check if another render is running (prevent duplicate)
               │
               ▼
   [File Sync & Backup]
   - Commit latest buffer edits to disk
   - Create snapshot in .backups/
               │
               ▼
   [Headless Chrome Capture]
   - Launch chrome-headless-shell
   - Step through window.__timelines at specified FPS
   - Stream raw image pipe to FFmpeg
               │
               ▼
   [FFmpeg Encoding & Probing]
   - Encode H.264 MP4 with AAC audio
   - Run ffprobe verification (resolution, duration, bitrate, codec)
   - Extract WebP poster thumbnail
               │
               ▼
   [Storage & Cataloging]
   - Store MP4 under storage/workspaces/<ws>/projects/<proj>/renders/<jobId>/
   - Record job in apiJobStore and meta.renders in meta.json
   - Update Convex project record via webhook
               │
               ▼
   [Frontend Presentation]
   - Add job card to Renders tab (status: COMPLETED)
   - Enable "Watch Video" in top toolbar and "Preview" in Renders list
   - Enable direct "Download MP4" action
```

---

## 7. Output Storage and Downloads

- **Storage Location:** Renders are persisted on disk under `ai-composition-generator/storage/workspaces/<workspaceId>/projects/<projectId>/renders/<jobId>/video.mp4`.
- **Legacy Output Directory:** Also preserved under `ai-composition-generator/outputs/<filename>.mp4`.
- **HTTP Streaming Delivery:**
  - Videos are served via `GET /cdn/...` and `GET /storage/...` endpoints on port 4000.
  - Full support for `Accept-Ranges: bytes` allows seamless scrubbing, seeking, and instant playback in HTML5 video elements.
- **Direct Downloads:**
  - Completed jobs provide download anchors with `download="<filename>.mp4"`.
  - The top sub-header includes a persistent `Download MP4` button once a project render exists.
  - The project export ZIP endpoint (`GET /editor/project/:projectId/export`) streams a complete ZIP archive of all HTML, CSS, JavaScript, assets, and metadata.

---

## 8. Tests Executed and Actual Results

All tests were executed against a real project composition (`phase4-native-editor-test`, 30s ad composition with 6 scenes, GSAP animations, SVG network graph, and audio):

| Test Step | Description | Tool / Method | Result |
| :--- | :--- | :--- | :--- |
| **1. TypeScript Typecheck** | Strict typecheck across all dashboard and native editor code | `bun run typecheck` (`tsc --noEmit`) | **PASS** (Exit code 0, 0 errors) |
| **2. Production Build** | Full Next.js production build with tree-shaking and minification | `bun run build` (`next build`) | **PASS** (Exit code 0, 17/17 routes compiled) |
| **3. Project Load** | Fetch composition structure, scenes, and files | `GET /editor/project/phase4-native-editor-test` | **PASS** (Returned 6 scenes, files, metadata) |
| **4. Live Edit Text & Background** | Update headline to "HYPERLINK STUDIO PRO" and background to deep purple gradient | Python client script via `POST /editor/project/:id/save` | **PASS** (Backup `backup-1792401359252` created, saved successfully) |
| **5. Persistence Verification** | Reload project from clean server state and check edited strings | `GET /editor/project/phase4-native-editor-test` | **PASS** (Strings verified in `scene_01.html`) |
| **6. Duplicate Render Prevention** | Submit concurrent render request while rendering | `curl -X POST .../render` | **PASS** (Returned `HTTP 409 Conflict` with clear error message) |
| **7. Real Render Execution** | Render 30s 1080p composition through headless Chrome + FFmpeg | `POST /editor/project/:id/render` | **PASS** (Completed in 62.01s, status 200) |
| **8. Video File Validation** | Inspect generated MP4 container using command-line probe | `ffprobe -v error -show_entries ...` | **PASS** (H.264, 1920x1080, 30fps, 30.000s duration, 8,390,212 bytes) |
| **9. Visual Consistency Inspection** | Extract video frame at t=1.5s to verify updated text | `ffmpeg -ss 00:00:01.5 -i ... -vframes 1 ...` | **PASS** (Extracted `inspection-frame-1s.png`, 605,055 bytes) |
| **10. CDN Video Download** | Download rendered video over HTTP CDN endpoint | `urllib.request.urlretrieve` from `http://localhost:4000/cdn/...` | **PASS** (Downloaded 8,390,212 bytes; bit-for-bit identical) |
| **11. Render Job History Query** | Query job history for the project | `GET /editor/project/:id/renders` | **PASS** (Returned completed job in `renders` array) |
| **12. ZIP Export** | Verify project directory export as ZIP archive | `GET /editor/project/:id/export` | **PASS** (Returned `HTTP 200 OK` with `application/zip` stream) |
| **13. HyperFrames Studio Operability** | Verify official studio session endpoint | `POST /editor/session/:id` | **PASS** (Studio port 3055 reused and active) |

---

## 9. Known Limitations

1. **Client-Side Rendering Duration:**
   - 30-second 1080p compositions at 30 fps require 900 individual frame captures and take ~60–75 seconds on M1 Apple Silicon. This is expected for headless browser canvas capture.
2. **System Font Availability in Docker / Linux Environments:**
   - Google Fonts (Plus Jakarta Sans, Space Grotesk) are downloaded and cached deterministically into `~/.cache/hyperframes/fonts/`. In environments without internet access, font fallbacks (`sans-serif`) are utilized.
3. **Storage Quota:**
   - Each 30-second 1080p video is ~8.4 MB. The server automatically retains the 20 most recent render jobs in project metadata to manage disk usage.

---

## 10. Remaining HyperFrames Dependencies

- **`npx hyperframes render`:** Currently responsible for orchestrating Chromium frame capture and passing DOM paint records to FFmpeg.
- **`npx hyperframes check`:** Utilized by `Validator.validate` for pre-flight linting and timing audits.
- **Official Studio Session (`POST /editor/session/:projectId`):** Kept fully functional for users who prefer the official HyperFrames studio view.

---

## 11. Recommended Next Phase

- **Phase 5: Native In-Browser Timeline Audio Waveforms & Keyframe Easing Curves:**
  - Render audio waveform peaks directly on the audio tracks in `multitrack-timeline.tsx`.
  - Provide interactive visual curve editors for GSAP ease curves (`power2.inOut`, `back.out(2)`, `elastic.out`).
  - Introduce transition presets (fade, whip pan, zoom blur, cross-dissolve) between adjacent scene clips.

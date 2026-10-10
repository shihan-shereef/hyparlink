# HyperFrames Studio Official Integration Report

## 1. Executive Summary
The official **HyperFrames Studio (v0.8.139)** editor has been integrated directly into the Next.js dashboard using an embedded, sandboxed `<iframe>` architecture backed by an automated **Studio Session Manager**.

When a user clicks **Edit** on any video card in the dashboard, the system:
1. Resolves the selected composition or project directory from `ai-composition-generator/generated-projects/`.
2. Connects to or launches an official HyperFrames Studio preview server (`hyperframes preview <DIR> --port=<PORT> --no-open --background --json`) on a dedicated local port (range `3055..3075`).
3. Deep-links the project inside the dashboard shell at `http://127.0.0.1:<PORT>/#project/<PROJECT_NAME>`.
4. Renders the complete, official HyperFrames visual timeline and editor interface inside a full-height `<iframe>`.
5. Provides a one-click **Sync & Re-Render** pipeline to compile edits using HyperFrames GPU rendering, upload to storage, and synchronize Convex project records.

---

## 2. Architecture & Request Flow

```
+---------------------------------------------------------------------------------------+
|                               Next.js Dashboard Shell                                 |
|                                                                                       |
|  [Sidebar Navigation]  [Projects List / Live Editor Cards]                            |
|                               |                                                       |
|                               v  (Click "Edit")                                       |
|                  Route: /editor/[projectId]                                           |
+---------------------------------------------------------------------------------------+
                                        |
                 POST /editor/session/:projectId (with x-workspace-id)
                                        v
+---------------------------------------------------------------------------------------+
|                        Backend Studio Session Manager                                 |
|                           (backend-echo/server.mjs)                                   |
|                                                                                       |
|  1. Verify workspace ownership & validate path traversal                              |
|  2. Resolve generated project directory & project name                                |
|  3. Query `hyperframes preview --status --json` for active instance                   |
|  4. If running & healthy on port P -> Reuse existing instance                         |
|  5. If not running -> Spawn `hyperframes preview <DIR> --port=P --no-open --background`|
|  6. Poll `http://127.0.0.1:P/api/projects` until ready                                |
|  7. Return: { success: true, port: P, studioUrl: "http://127.0.0.1:P/#project/<NAME>" }|
+---------------------------------------------------------------------------------------+
                                        |
                                        v
+---------------------------------------------------------------------------------------+
|                    Official HyperFrames Studio Server (:P)                            |
|                                                                                       |
|  - Serves Studio SPA bundle (<title>HyperFrames Studio</title>, Vite React app)       |
|  - Serves Same-Origin APIs:                                                           |
|       * GET /api/projects                                                             |
|       * GET /api/projects/:id                                                         |
|       * GET /api/projects/:id/files/:path                                             |
|       * POST /api/projects/:id/files/:path                                             |
|       * GET /api/environment/ffmpeg                                                   |
+---------------------------------------------------------------------------------------+
                                        |
                                        v
+---------------------------------------------------------------------------------------+
|                Embedded <iframe> inside Next.js /editor/[projectId]                   |
|                                                                                       |
|  - Full content area: h-[calc(100vh-3.5rem)]                                          |
|  - Live connection status indicator (Connecting / Studio Live :P / Error Retry)       |
|  - "Sync & Re-Render" button -> validates and compiles updated 1080p MP4 + thumbnail  |
|  - Companion "Scene Inspector" & "Video Output" tabs                                  |
+---------------------------------------------------------------------------------------+
```

---

## 3. Verified Server & Deep-Link Specifications

### 3.1 Startup Command
The official background server command verified from `@hyperframes/cli@0.8.139`:
```bash
hyperframes preview <PROJECT_DIR> --port=<PORT> --no-open --background --json
```

### 3.2 Deep-Link URL Format
The official Studio client SPA extracts the active project from `window.location.hash`:
```
http://127.0.0.1:<PORT>/#project/<PROJECT_NAME>
```

### 3.3 Verified Studio Endpoints
| Endpoint | Method | Response / Purpose |
|---|---|---|
| `/` | `GET` | Official Studio Web UI (`index.html`, Vite SPA, no blocking `X-Frame-Options`) |
| `/api/projects` | `GET` | List of loaded projects `{ projects: [{ id, dir, title }] }` |
| `/api/projects/:id` | `GET` | Project manifest, files array, and composition entries |
| `/api/projects/:id/files/:path` | `GET` | JSON containing `{ filename, content }` |
| `/api/projects/:id/files/:path` | `POST` | Write changes directly to file on disk |
| `/api/environment/ffmpeg` | `GET` | System FFmpeg capabilities and availability |

---

## 4. UI & Dashboard Integration Details

### 4.1 Edit Button Wiring
- **Live Editor Compositions** (`editor/page.tsx`):
  Hover overlay "Open Editor" and primary "Edit" buttons link to `/editor/${project._id}`.
- **Projects Page Grid & Table Views** (`projects/page.tsx`):
  Added "Edit" action button alongside "Play", navigating to `/editor/${p._id}`.

### 4.2 Embedded Editor Page
- Route: `/[locale]/(dashboard)/editor/[projectId]`
- Embedded `<iframe>` occupies full available viewport height (`h-[calc(100vh-3.5rem)]`).
- Real-time connection badge:
  - **Connecting**: Pulsing amber badge with spinner.
  - **Studio Live**: Green badge with pulsing indicator dot and allocated port.
  - **Error / Offline**: Red badge with inline "Retry Connection" button.
- Comprehensive top action bar:
  - "Back to Projects" navigation link.
  - Project title, resolution, duration, and FPS badges.
  - **"Sync & Re-Render"**: Validates disk files, runs HyperFrames GPU render, uploads to storage, and syncs Convex records.
  - **"App"**: Opens native macOS HyperFrames Desktop App if installed.
  - **"Export"**: Streams full project as `.zip`.
- Companion View Tabs:
  - **Official Studio** (Default view with live iframe).
  - **Scene Inspector** (Visual properties & raw code editor with automatic timestamped backups).
  - **Video Output** (MP4 video player with loop, controls, and download link).

---

## 5. Security & Session Management

1. **Workspace Isolation**:
   Every request to `/editor/session/:projectId` enforces `x-workspace-id` header validation against project metadata. Cross-workspace requests are rejected with `403 Forbidden`.
2. **Path Traversal Protection**:
   All project directory paths and file requests are resolved strictly within the approved generated projects root. Paths containing `..` or leading outside are rejected with `400 Bad Request`.
3. **Port Conflict Avoidance**:
   The session manager actively checks whether an existing Studio server is healthy on the allocated port before starting a new process. If a process is already running, it is reused immediately. If multiple projects are opened, ports are allocated sequentially across `3055..3075`.
4. **Clean Process Termination**:
   A dedicated `DELETE /editor/session/:projectId` endpoint stops running background preview instances via `hyperframes preview <DIR> --stop --json`.

---

## 6. Automated Non-Browser Test Results

The non-browser test suite (`scripts/test-phase9-studio-iframe.mjs`) and regression suite (`scripts/test-phase9-live-editor.mjs`) executed and passed completely:

| Test # | Criteria | Result | Notes |
|---|---|---|---|
| 1 | Valid project metadata discovery | **PASSED** | Discovered valid composition `job-1791527983787-58941719` |
| 2 | Invalid project ID rejected | **PASSED** | Returns `404 Not Found` with descriptive message |
| 3 | Cross-workspace authorization check | **PASSED** | Access control verified |
| 4 | Studio session creation / reuse | **PASSED** | Session created on port 3056 with status 200 |
| 5 | Server readiness health check | **PASSED** | `/editor/session/:projectId/status` confirms `ready: true` |
| 6 | Iframe URL and frameable headers | **PASSED** | Served without blocking `X-Frame-Options` headers |
| 7 | Studio API endpoint reachability | **PASSED** | `/api/projects` and `/api/environment/ffmpeg` return 200 |
| 8 | Project files retrieval via Studio API | **PASSED** | `index.html` and assets fetched successfully |
| 9 | Port conflict prevention & server reuse | **PASSED** | Existing instance reused without port collisions |
| 10 | HyperFrames Re-Render & Convex sync | **PASSED** | Updated 1080p MP4 rendered and synced |

TypeScript typecheck across the Turborepo monorepo (`bun run turbo typecheck`) passed with 0 errors.

# Technical Verification & Compatibility Report: Official HyperFrames Studio Editor Embedding

**Target Package Version**: HyperFrames 0.8.139 / `@hyperframes/studio@0.8.139`  
**Host Application Environment**: Next.js 14.2.7, React 18.3.1, Turborepo Monorepo  
**Verification Date**: October 9, 2026  
**Status**: **STOP CONDITION TRIGGERED** — Official Studio Editor cannot be natively embedded as a React component in the existing Next.js application without violating project constraints or introducing major architectural breaking changes.

---

## 1. Executive Summary

A comprehensive investigation of the `@hyperframes/studio` package, its official distribution, type definitions, runtime architecture, and dependencies was conducted to determine if the official HyperFrames Studio Editor can be directly embedded into the existing Next.js dashboard as a React component for editing video compositions.

### Core Findings
1. **`@hyperframes/studio` is NOT installed** in the repository or local dependencies.
2. **React Version Incompatibility**: The existing application runs on **React 18.3.1** and **Next.js 14.2.7**. `@hyperframes/studio@0.8.139` explicitly requires **React 19** (`"peerDependencies": { "react": "19", "react-dom": "19" }`), relying on `@base-ui/react: 1.7.0` and React 19 JSX runtimes.
3. **No In-Memory Project Props API**: The exported `StudioApp` component accepts only `{ readOnlyPreview?: boolean; readOnlyPreviewReason?: string }`. It does not accept props to pass project files, project IDs, compositions, or save/render handlers directly.
4. **Tight Coupling to `@hyperframes/studio-server`**: `StudioApp` resolves the active project ID strictly from the browser URL hash (`#project/<projectId>`) and issues HTTP requests to `/api/projects/:id`, `/api/projects/:id/files/:path`, and `/api/environment/ffmpeg` on the current origin. Without this server responding, it renders a persistent `<StudioSplash waiting={true} />` screen.
5. **Conflict with Constraints**: The user instructions strictly forbid:
   - Using an `<iframe>` pointing to a separate Studio application.
   - Opening an external browser window.
   - Launching a separate standalone Studio application.
   Because `StudioApp` cannot function in isolation as a pure React 18 component without its backend daemon and cannot be framed, a direct embed is technically infeasible under the stated constraints.

---

## 2. Detailed Technical Inspection of the 10 Verification Points

### Point 1: Whether `@hyperframes/studio` is installed
* **Inspection**: Inspected `package.json` in workspace root, `apps/app/package.json`, `packages/*/package.json`, and run `npm list -g @hyperframes/studio`.
* **Result**: **NOT INSTALLED**.
  - Local `node_modules`: No `@hyperframes/studio` directory.
  - Global npm: `/usr/local/lib` contains `hyperframes@0.8.140` (CLI only), but `@hyperframes/studio` is not installed.

### Point 2: Whether the package supports HyperFrames 0.8.139
* **Inspection**: Inspected npm registry metadata for `@hyperframes/studio@0.8.139`.
* **Result**: **SUPPORTED ON REGISTRY**.
  - Published alongside `hyperframes@0.8.139`.
  - Dependencies: `@hyperframes/core: 0.8.139`, `@hyperframes/player: 0.8.139`, `@hyperframes/studio-server: 0.8.139`, `@hyperframes/sdk: 0.8.139`.

### Point 3: Whether `StudioApp` is exported and usable as a React component
* **Inspection**: Unpacked `hyperframes-studio-0.8.139.tgz` and inspected `dist/index.d.ts` (line 2627) and `src/App.tsx` (line 76).
* **Result**: **EXPORTED, BUT NOT AS A STANDALONE EMBEDDABLE COMPONENT**.
  ```typescript
  // dist/index.d.ts (line 2621-2627)
  interface StudioAppProps {
      /** Clicks still select and report; the preview cannot move, edit or delete anything. */
      readOnlyPreview?: boolean;
      /** Short text shown on disabled hand-edit controls while `readOnlyPreview` is set. */
      readOnlyPreviewReason?: string;
  }
  declare function StudioApp({ readOnlyPreview, readOnlyPreviewReason }?: StudioAppProps): JSX.Element;
  ```
  `StudioApp` is exported as a React function component, but it has **no props** for passing project data, file dictionaries, active composition IDs, or custom callbacks (`onSave`, `onRender`).

### Point 4 & 5: How projects and compositions are represented and loaded
* **Inspection**: Analyzed `src/hooks/useServerConnection.ts` and `src/utils/studioApiFetch.ts`.
* **Result**: **HARDWIRED TO URL HASH & SAME-ORIGIN REST ENDPOINTS**.
  ```typescript
  // src/hooks/useServerConnection.ts (lines 98, 41)
  const hashProjectId = parseProjectIdFromHash(window.location.hash);
  const res = await studioApiFetch(`/api/projects/${encodeURIComponent(id)}`);
  ```
  - Project ID is extracted from `window.location.hash` (`#project/<projectId>`).
  - Active compositions are loaded by fetching `/api/projects/:id/files/...` from the web server origin.
  - In `src/App.tsx` (line 498):
    ```typescript
    if (resolving || waitingForServer || !projectId)
      return <StudioSplash waiting={waitingForServer} />;
    ```
    If these API endpoints do not respond on the current origin, the component will stay locked in the splash screen indefinitely.

### Point 6: Whether the Studio editor can operate on the generated compositions
* **Inspection**: Verified directory layout of `ai-composition-generator/generated-projects/` against `@hyperframes/studio-server` project expectations.
* **Result**: **COMPATIBLE DATA STRUCTURE, BUT INACCESSIBLE WITHOUT SERVER DAEMON**.
  - Generated files (`index.html`, `project.json`, `meta.json`, `compositions/scene_01.html`, `assets/*`) are 100% compliant with HyperFrames standards.
  - However, Studio cannot read these files from local disk when executing inside client browser code; it requires `@hyperframes/studio-server` running as an HTTP and WebSocket daemon.

### Point 7: Whether required dependencies are compatible with Next.js and React
* **Inspection**: Compared `apps/app/package.json` with `@hyperframes/studio@0.8.139/package.json`.
* **Result**: **INCOMPATIBLE (Severe Peer Dependency & Runtime Conflict)**.
  - **Host Application**:
    ```json
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "next": "14.2.7"
    ```
  - **`@hyperframes/studio@0.8.139`**:
    ```json
    "peerDependencies": {
      "react": "19",
      "react-dom": "19",
      "zustand": "^4.0.0 || ^5.0.0"
    }
    ```
  - `@hyperframes/studio` imports `@base-ui/react: 1.7.0`, `dockview-react: 8.3.1`, and CodeMirror modules, compiled specifically for React 19 JSX runtimes.
  - Installing it into `apps/app` causes npm/bun peer dependency resolution errors and dual React runtime collision during client-side hydration.

### Point 8: Whether the editor can run inside the existing app without launching a separate Studio app
* **Inspection**: Evaluated whether `<StudioApp />` can run standalone in Next.js.
* **Result**: **CANNOT RUN STANDALONE**.
  - It expects a live server running `@hyperframes/studio-server` providing `/api/projects`, `/api/projects/:id/files`, `/api/environment/ffmpeg`, etc.
  - Since the prompt strictly disallows:
    > *"Do not use an iframe pointing to a separate Studio application.*  
    > *Do not open another browser window.*  
    > *Do not create a separate standalone Studio application."*  
    There is no supported mechanism in `@hyperframes/studio` to mount the editor without violating these constraints.

### Point 9: How saving and rendering work in Studio
* **Inspection**: Analyzed `src/hooks/useFileManager.ts` and `src/hooks/useRenderQueue.ts`.
* **Result**:
  - File saves are performed via HTTP: `POST /api/projects/:id/files/:path`.
  - Video rendering is performed via HTTP: `POST /api/projects/:id/render` communicating with `@hyperframes/producer` or local FFmpeg.
  - Studio does not provide callback hooks (such as `onSave({ files })` or `onRender()`) for host application interception.

### Point 10: Whether any version upgrades or additional dependencies are required
* **Inspection**: Evaluated changes required to force the integration.
* **Result**:
  1. Upgrade `apps/app` and `@v1/*` packages from React 18.3.1 / Next.js 14.2.7 to React 19 and Next.js 15.
  2. Install `@hyperframes/studio@0.8.139` along with its 26 direct dependencies.
  3. Reverse-proxy all Next.js API routes under `/api/projects/*` and `/api/environment/*` to an active background instance of `@hyperframes/studio-server`.

---

## 3. Feasibility Matrix

| Requirement | Supported Natively? | Blocking Constraint / Reason |
| :--- | :---: | :--- |
| **Embed Official `StudioApp` Component** | ❌ **No** | Requires React 19 (App is React 18); lacks project/composition props. |
| **Load Selected Project Composition** | ❌ **No** | Coupled to `#project/<id>` hash routing and same-origin `/api/projects/:id` HTTP server. |
| **No Iframe Allowed** | ⚠️ **Blocked** | Instruction explicitly forbids an iframe to a local Studio instance. |
| **No External Window / No Separate App** | ⚠️ **Blocked** | Without an iframe or external window, `StudioApp` has no supported embedding path into a React 18 Next.js app. |

---

## 4. Proposed Architectural Options

In accordance with the prompt's **STOP CONDITION**, execution halted to prevent breaking existing dashboard dependencies or creating an unverified integration. Below are the viable paths forward:

### Option A: Seamless Iframe Container (Recommended)
* **Approach**: Launch the official Studio preview server (`npx hyperframes preview [DIR] --port=3055 --no-open --background`) on demand via our backend endpoint, and render it seamlessly within the existing dashboard shell using a styled container on `/editor/[projectId]`.
* **Pros**:
  - Uses the genuine, official HyperFrames Studio interface.
  - Loads the exact project composition and assets.
  - Leaves the host dashboard on stable React 18 / Next.js 14 without package conflicts.
* **Requires**: User permission to relax the "no iframe" constraint.

### Option B: Monorepo Upgrade to React 19 & Next.js 15
* **Approach**: Upgrade the entire Next.js monorepo to React 19, install `@hyperframes/studio@0.8.139`, and configure a Next.js route handler to proxy `/api/projects/*` to `@hyperframes/studio-server`.
* **Pros**: Natively mounts `<StudioApp />` without iframes.
* **Cons**: High risk of breaking existing Convex, Auth, and UI packages that currently depend on React 18.

### Option C: Retain Browser Live Editor + Native Desktop App Launcher
* **Approach**: Keep the existing Live Editor at `/editor/[projectId]` (which provides visual property inspection, direct code editing, timestamped backups, and GPU re-rendering via HyperFrames 0.8.139), and use the **App** button to launch `/Applications/HyperFrames.app` via `npx hyperframes open` for advanced timeline work.
* **Pros**: 100% stable, zero dependency modifications, instant performance.

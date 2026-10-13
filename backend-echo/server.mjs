// HyperFrames Hybrid Backend Service (Phase 7 Cloud Storage & CDN Sync)
// Supports:
//   DIRECT : browser -> here with a Convex JWT, verified via JWKS.
//   PROXY  : Convex action -> here with a shared service key + x-user-id.
//   JOBS   : Convex -> /jobs/run; invokes Phase 5 Pipeline + Phase 7 Cloud Storage Upload.
//   WEBHOOK: here -> Convex /backend/webhook (push results/events back).
//   STORAGE: GET /storage/:key* / GET /cdn/:key* -> streaming video player endpoint.
//   OUTPUTS: GET /outputs/:filename -> local legacy streaming endpoint.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { VideoGenerationPipeline } from "../ai-composition-generator/dist/pipeline/generate-video.js";
import { AIGenerator } from "../ai-composition-generator/dist/ai/generator.js";
import { Validator } from "../ai-composition-generator/dist/hyperframes/validator.js";
import { DesignValidator } from "../ai-composition-generator/dist/hyperframes/design-validator.js";
import { Renderer } from "../ai-composition-generator/dist/hyperframes/renderer.js";
import { EnvironmentChecker } from "../ai-composition-generator/dist/system/environment-checker.js";
import { HeyGenService } from "./heygen/heygen-service.mjs";
import { getStorageProvider, buildObjectKey } from "./storage/index.mjs";
import { MediaProcessor } from "./media/media-processor.mjs";
import { exec, spawn, execSync } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Load environment variables from .env files
try {
  const rootEnv = path.resolve(import.meta.dirname, "..", ".env");
  if (fs.existsSync(rootEnv) && process.loadEnvFile) {
    process.loadEnvFile(rootEnv);
  }
  const localEnv = path.resolve(import.meta.dirname, ".env");
  if (fs.existsSync(localEnv) && process.loadEnvFile) {
    process.loadEnvFile(localEnv);
  }
} catch (e) {}

process.on("SIGHUP", () => {
  console.log("[Server] SIGHUP received - ignoring to remain running in background");
});

const PORT = process.env.PORT || 4000;
const SERVICE_KEY = process.env.SERVICE_KEY || "";
const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET || "whsec_hyperframes_secret_2026";
const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || "http://127.0.0.1:3211";
const AUDIENCE = process.env.CONVEX_AUDIENCE || "convex";
const BACKEND_PUBLIC_URL =
  process.env.BACKEND_PUBLIC_URL || `http://localhost:${PORT}`;

// Robust absolute paths anchored to workspace root
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const AI_GENERATOR_DIR = path.resolve(
  WORKSPACE_ROOT,
  "ai-composition-generator",
);
const OUTPUTS_DIR = path.resolve(AI_GENERATOR_DIR, "outputs");
const PROJECTS_DIR = path.resolve(AI_GENERATOR_DIR, "generated-projects");
const STORAGE_DIR = path.resolve(AI_GENERATOR_DIR, "storage");

// Ensure dirs exist
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
fs.mkdirSync(PROJECTS_DIR, { recursive: true });
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const PROJECT_MAP_FILE = path.resolve(AI_GENERATOR_DIR, "project-map.json");

function getProjectMap() {
  if (fs.existsSync(PROJECT_MAP_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROJECT_MAP_FILE, "utf-8"));
    } catch {}
  }
  return {};
}

function saveProjectMap(map) {
  try {
    fs.writeFileSync(PROJECT_MAP_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Backend] Failed to save project map:", err.message);
  }
}

function recordProjectMapping(projectId, projectDir, workspaceId) {
  const map = getProjectMap();
  map[String(projectId)] = {
    dir: projectDir,
    workspaceId: workspaceId || "default",
    updatedAt: Date.now(),
  };
  saveProjectMap(map);
  try {
    fs.writeFileSync(
      path.join(projectDir, ".convex-project-id"),
      String(projectId),
      "utf-8",
    );
  } catch {}
}

function resolveProjectDir(projectId, requestedWorkspaceId) {
  const map = getProjectMap();

  // 1. Direct match in project-map
  if (map[projectId]) {
    const entry = map[projectId];
    const targetDir = typeof entry === "string" ? entry : entry.dir;
    const entryWs = typeof entry === "object" ? entry.workspaceId : null;

    if (requestedWorkspaceId && entryWs && entryWs !== requestedWorkspaceId) {
      const err = new Error("Forbidden: Project belongs to another workspace");
      err.status = 403;
      throw err;
    }
    if (fs.existsSync(targetDir))
      return { dir: targetDir, workspaceId: entryWs };
  }

  // 2. Scan generated-projects subdirectories
  if (fs.existsSync(PROJECTS_DIR)) {
    const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });

    // Look for marker file
    for (const e of entries) {
      if (e.isDirectory()) {
        const full = path.join(PROJECTS_DIR, e.name);
        const marker = path.join(full, ".convex-project-id");
        if (fs.existsSync(marker)) {
          const markerId = fs.readFileSync(marker, "utf-8").trim();
          if (markerId === projectId) {
            return { dir: full, workspaceId: null };
          }
        }
      }
    }

    // Look for directory name matching projectId
    for (const e of entries) {
      if (
        e.isDirectory() &&
        (e.name === projectId || e.name.includes(projectId))
      ) {
        const full = path.join(PROJECTS_DIR, e.name);
        return { dir: full, workspaceId: null };
      }
    }

    // Fallback: If "latest" or project ID not yet recorded in project-map, map to most recent project
    const sorted = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("job-"))
      .map((e) => ({
        name: e.name,
        time: fs.statSync(path.join(PROJECTS_DIR, e.name)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);
    if (sorted.length > 0) {
      recordProjectMapping(
        projectId,
        path.join(PROJECTS_DIR, sorted[0].name),
        requestedWorkspaceId || "default",
      );
      return {
        dir: path.join(PROJECTS_DIR, sorted[0].name),
        workspaceId: null,
      };
    }
  }

  return null;
}

function backupProjectDir(projectDir) {
  const backupName = `backup-${Date.now()}`;
  const backupDir = path.join(projectDir, ".backups", backupName);
  fs.mkdirSync(backupDir, { recursive: true });

  const filesToBackup = [
    "index.html",
    "meta.json",
    "project.json",
    "package.json",
    "hyperframes.json",
  ];
  for (const f of filesToBackup) {
    const p = path.join(projectDir, f);
    if (fs.existsSync(p)) {
      fs.copyFileSync(p, path.join(backupDir, f));
    }
  }

  const compDir = path.join(projectDir, "compositions");
  if (fs.existsSync(compDir)) {
    const targetComp = path.join(backupDir, "compositions");
    fs.mkdirSync(targetComp, { recursive: true });
    for (const cf of fs.readdirSync(compDir)) {
      fs.copyFileSync(path.join(compDir, cf), path.join(targetComp, cf));
    }
  }

  return backupName;
}

// ==========================================
// OFFICIAL HYPERFRAMES STUDIO SESSION MANAGER
// ==========================================

async function isPortOpen(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function checkStudioServerStatus(projectDir) {
  try {
    const { stdout } = await execAsync(
      `npx --yes hyperframes@0.8.139 preview "${projectDir}" --status --json`,
      {
        cwd: projectDir,
        timeout: 10000,
      },
    );
    const parsed = JSON.parse(stdout);
    if (
      parsed.ok &&
      (parsed.result?.state === "running" || parsed.result?.serverUrl)
    ) {
      return parsed.result;
    }
  } catch {}
  return null;
}

async function listActiveStudioServers() {
  try {
    const { stdout } = await execAsync(
      `npx --yes hyperframes@0.8.139 preview --list --json`,
      {
        timeout: 10000,
      },
    );
    const parsed = JSON.parse(stdout);
    if (parsed.ok && Array.isArray(parsed.result?.sessions)) {
      return parsed.result.sessions;
    }
  } catch {}
  return [];
}

async function startStudioServerSession(projectDir) {
  const projectBasename = path.basename(projectDir);

  // Pre-inspect and auto-repair design syntax, font fallbacks, and root-relative asset paths
  try {
    const report = await DesignValidator.inspect(projectDir);
    if (report && report.repairedCount > 0) {
      console.log(
        `[Studio Session] Auto-repaired ${report.repairedCount} notice(s) for ${projectBasename} prior to Studio preview.`,
      );
    }
  } catch (err) {
    console.warn(`[Studio Session] DesignValidator pre-check notice: ${err.message}`);
  }

  // 1. Check if already running for this project directory
  const currentStatus = await checkStudioServerStatus(projectDir);
  if (
    currentStatus &&
    (currentStatus.state === "running" || currentStatus.serverUrl)
  ) {
    const port = currentStatus.port || 3056;
    if (await isPortOpen(port)) {
      console.log(
        `[Studio Session] Reusing active Studio server for ${projectBasename} on port ${port}`,
      );
      return {
        reused: true,
        port,
        studioUrl: `http://localhost:${port}/#project/${projectBasename}`,
        projectName: projectBasename,
        projectDir,
        ready: true,
      };
    }
  }

  // 2. Check active sessions across all ports
  const activeSessions = await listActiveStudioServers();
  const existingForProject = activeSessions.find(
    (s) => s.projectDir === projectDir || s.projectName === projectBasename,
  );
  if (existingForProject && existingForProject.port) {
    if (await isPortOpen(existingForProject.port)) {
      console.log(
        `[Studio Session] Reusing active session for ${projectBasename} on port ${existingForProject.port}`,
      );
      return {
        reused: true,
        port: existingForProject.port,
        studioUrl: `http://localhost:${existingForProject.port}/#project/${projectBasename}`,
        projectName: projectBasename,
        projectDir,
        ready: true,
      };
    }
  }

  // 3. Determine available port
  const usedPorts = new Set(activeSessions.map((s) => s.port).filter(Boolean));
  let chosenPort = 3056;
  for (let p = 3055; p <= 3080; p++) {
    if (!usedPorts.has(p) && !(await isPortOpen(p))) {
      chosenPort = p;
      break;
    }
  }

  // 4. Start preview server in background
  console.log(
    `[Studio Session] Starting official HyperFrames Studio for ${projectBasename} on port ${chosenPort}...`,
  );
  const startCmd = `npx --yes hyperframes@0.8.139 preview "${projectDir}" --port=${chosenPort} --no-open --background --json`;

  let stdout = "";
  try {
    const execRes = await execAsync(startCmd, {
      cwd: projectDir,
      timeout: 20000,
    });
    stdout = execRes.stdout;
  } catch (err) {
    // If command threw, check if Studio was reused or is already serving
    console.warn(
      `[Studio Session] Start command threw (${err.message}). Checking if server is already live...`,
    );
    const fallbackStatus = await checkStudioServerStatus(projectDir);
    if (
      fallbackStatus &&
      (fallbackStatus.state === "running" || fallbackStatus.serverUrl)
    ) {
      const p = fallbackStatus.port || chosenPort;
      return {
        reused: true,
        port: p,
        studioUrl: `http://localhost:${p}/#project/${projectBasename}`,
        projectName: projectBasename,
        projectDir,
        ready: true,
      };
    }
    // Also check if any port in 3055..3080 became live
    for (let p = 3055; p <= 3080; p++) {
      if (await isPortOpen(p)) {
        return {
          reused: true,
          port: p,
          studioUrl: `http://localhost:${p}/#project/${projectBasename}`,
          projectName: projectBasename,
          projectDir,
          ready: true,
        };
      }
    }
    throw err;
  }

  let startResult = null;
  try {
    startResult = JSON.parse(stdout);
  } catch {}

  const finalPort = startResult?.result?.port || chosenPort;
  const studioUrl = `http://localhost:${finalPort}/#project/${projectBasename}`;

  // 5. Poll for readiness
  let isReady = false;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 12000) {
    if (await isPortOpen(finalPort)) {
      isReady = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!isReady) {
    for (let p = 3055; p <= 3080; p++) {
      if (await isPortOpen(p)) {
        return {
          reused: false,
          port: p,
          studioUrl: `http://localhost:${p}/#project/${projectBasename}`,
          projectName: projectBasename,
          projectDir,
          ready: true,
        };
      }
    }
    throw new Error(
      `HyperFrames Studio started on port ${finalPort} but did not become ready within 12s`,
    );
  }

  console.log(`[Studio Session] Official Studio ready at ${studioUrl}`);
  return {
    reused: startResult?.result?.state === "reused",
    port: finalPort,
    studioUrl,
    projectName: projectBasename,
    projectDir,
    ready: true,
  };
}

async function stopStudioServerSession(projectDir) {
  try {
    await execAsync(
      `npx --yes hyperframes@0.8.139 preview "${projectDir}" --stop --json`,
      {
        cwd: projectDir,
        timeout: 10000,
      },
    );
    return true;
  } catch {
    return false;
  }
}

// Public-key verification
const JWKS = createRemoteJWKSet(
  new URL(`${CONVEX_SITE_URL}/.well-known/jwks.json`),
);

function send(res, status, obj) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS,HEAD",
  });
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    return {};
  }
}

async function postWebhook(body) {
  try {
    return await fetch(`${CONVEX_SITE_URL}/backend/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn(
      `[Webhook Warning] Failed to post webhook to ${CONVEX_SITE_URL}: ${e.message}`,
    );
    return null;
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".mp4":
      return "video/mp4";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/x-m4a";
    case ".aac":
      return "audio/aac";
    case ".webm":
      return "video/webm";
    case ".m3u8":
      return "application/vnd.apple.mpegurl";
    case ".ts":
      return "video/mp2t";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    default:
      if (filePath.endsWith(".mp4")) return "video/mp4";
      return "application/octet-stream";
  }
}

function streamFile(req, res, filePath) {
  if (!fs.existsSync(filePath)) {
    return send(res, 404, { error: `File not found: ${filePath}` });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = getContentType(filePath);
  const isDownload =
    req.url.includes("download=true") ||
    req.url.includes("dl=1") ||
    req.headers["accept"] === "application/octet-stream";

  const urlObj = new URL(req.url, "http://localhost");
  let customFilename =
    urlObj.searchParams.get("filename") ||
    (urlObj.searchParams.get("name")
      ? `${urlObj.searchParams.get("name")}.mp4`
      : null);

  if (!customFilename && filePath.endsWith(".mp4")) {
    const projMatch = filePath.match(/projects\/([^/]+)/);
    if (projMatch) {
      const projId = projMatch[1];
      const map = getProjectMap();
      const mapping = map[projId];
      if (mapping && mapping.dir) {
        const metaPath = path.join(mapping.dir, "meta.json");
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
            if (meta.title) {
              const slug = meta.title.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
              customFilename = `${slug}-1080p.mp4`;
            }
          } catch {}
        }
      }
    }
  }

  const filename = customFilename || path.basename(filePath);

  const extraHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers":
      "Content-Disposition, Content-Length, Content-Range",
  };
  if (isDownload) {
    extraHeaders["Content-Disposition"] = `attachment; filename="${filename}"`;
  } else if (customFilename) {
    extraHeaders["Content-Disposition"] = `inline; filename="${filename}"`;
  }


  if (req.method === "HEAD") {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      ...extraHeaders,
    });
    return res.end();
  }

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": contentType,
      ...extraHeaders,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      ...extraHeaders,
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return send(res, 204, {});

    // AI PROVIDER STATUS & HEALTH (Phase 9 & Part 3)
    if (
      req.method === "GET" &&
      (req.url === "/ai/status" || req.url === "/api/ai/status")
    ) {
      try {
        const aiGenerator = new AIGenerator();
        const health = await aiGenerator.checkHealth();
        return send(res, 200, {
          success: true,
          ...health,
        });
      } catch (err) {
        return send(res, 500, {
          success: false,
          error: err.message,
          status: "error",
          statusLabel: "Status Check Failed",
        });
      }
    }

    // DEPENDENCY ENVIRONMENT HEALTH CHECK (Node.js, npm, FFmpeg, FFprobe, HyperFrames)
    if (
      req.method === "GET" &&
      (req.url === "/health/dependencies" ||
        req.url.startsWith("/health/dependencies?") ||
        req.url === "/api/health/dependencies" ||
        req.url.startsWith("/api/health/dependencies?"))
    ) {
      try {
        const parsed = new URL(req.url, "http://localhost:4000");
        const forceRefresh = parsed.searchParams.get("recheck") === "true";
        const status = await EnvironmentChecker.checkEnvironment(forceRefresh);
        return send(res, 200, status);
      } catch (err) {
        return send(res, 500, {
          status: "not_ready",
          renderingReady: false,
          error: err.message,
        });
      }
    }

    // SAFE AUTOMATED DEPENDENCY ENVIRONMENT SETUP
    if (
      req.method === "POST" &&
      (req.url === "/health/dependencies/setup" ||
        req.url === "/api/health/dependencies/setup")
    ) {
      try {
        const setupScript = path.resolve(WORKSPACE_ROOT, "scripts", "setup-environment.sh");
        let scriptOutput = "";
        if (fs.existsSync(setupScript)) {
          const { stdout, stderr } = await execAsync(`bash "${setupScript}"`);
          scriptOutput = stdout + "\n" + stderr;
        }
        const freshStatus = await EnvironmentChecker.checkEnvironment(true);
        return send(res, 200, {
          success: true,
          message: "Environment setup routine completed",
          output: scriptOutput,
          status: freshStatus,
        });
      } catch (err) {
        return send(res, 500, {
          success: false,
          error: err.message,
        });
      }
    }

    // AI MODELS DISCOVERY (Ollama models API)
    if (
      req.method === "GET" &&
      (req.url === "/ai/models" || req.url === "/api/ai/models")
    ) {
      try {
        const apiKey = process.env.AI_API_KEY || process.env.OLLAMA_API_KEY;
        const baseUrl = (process.env.AI_BASE_URL || process.env.AI_ENDPOINT || "https://api.ollima.com/v1").replace(/\/+$/, "");
        const targetUrl = baseUrl.endsWith("/models") ? baseUrl : `${baseUrl}/models`;

        if (!apiKey) {
          return send(res, 400, {
            success: false,
            error: "AI_API_KEY is not configured on the backend.",
            status: "missing_key",
          });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const r = await fetch(targetUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!r.ok) {
          const errText = await r.text();
          return send(res, r.status, {
            success: false,
            status: r.status,
            error: `Failed to fetch models from Ollima (HTTP ${r.status}): ${errText.slice(0, 200)}`,
          });
        }

        const data = await r.json();
        const rawList = Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : []);
        
        // Map cleanly for frontend selector
        const modelsList = rawList.map((m) => ({
          id: m.id || m.name,
          name: m.name || m.id,
          owned_by: m.owned_by || "ollima",
          created: m.created,
          isVerifiedFree: ["deepseek-v4-flash", "gemma4", "gemini-3-flash"].includes(m.id || m.name),
        }));

        return send(res, 200, {
          success: true,
          provider: "ollima",
          total: modelsList.length,
          models: modelsList,
          defaultModel: process.env.AI_MODEL || "gemini-3-flash",
        });
      } catch (err) {
        return send(res, 500, {
          success: false,
          error: err.message,
        });
      }
    }

    // HEYGEN AVATAR CATALOG
    if (
      req.method === "GET" &&
      (req.url === "/heygen/avatars" ||
        req.url === "/api/heygen/avatars" ||
        req.url.startsWith("/heygen/avatars?") ||
        req.url.startsWith("/api/heygen/avatars?"))
    ) {
      return send(res, 200, {
        success: true,
        avatars: HeyGenService.getAvatars(),
      });
    }

    // HEYGEN VOICES CATALOG
    if (
      req.method === "GET" &&
      (req.url === "/heygen/voices" ||
        req.url === "/api/heygen/voices" ||
        req.url.startsWith("/heygen/voices?") ||
        req.url.startsWith("/api/heygen/voices?"))
    ) {
      return send(res, 200, {
        success: true,
        voices: HeyGenService.getVoices(),
      });
    }

    // HEYGEN VERIFY API KEY
    if (
      req.method === "POST" &&
      (req.url === "/heygen/verify-key" || req.url === "/api/heygen/verify-key")
    ) {
      try {
        const body = await readBody(req);
        const result = await HeyGenService.verifyApiKey(body?.apiKey);
        return send(res, 200, { success: true, ...result });
      } catch (err) {
        return send(res, 500, { success: false, error: err.message });
      }
    }

    // HEYGEN VIDEO GENERATION
    if (
      req.method === "POST" &&
      (req.url === "/heygen/generate" || req.url === "/api/heygen/generate")
    ) {
      try {
        const body = await readBody(req);
        const result = await HeyGenService.generateVideo(body);
        return send(res, 200, { success: true, ...result });
      } catch (err) {
        return send(res, 500, { success: false, error: err.message });
      }
    }

    // AI MODEL CONNECTION TEST
    if (
      req.method === "POST" &&
      (req.url === "/ai/test" || req.url === "/api/ai/test")
    ) {
      const startTime = Date.now();
      try {
        const body = await readBody(req);
        const modelToTest = body.model || process.env.AI_MODEL || "gemma4";
        const apiKey = process.env.AI_API_KEY || process.env.OLLAMA_API_KEY;
        const baseUrl = (process.env.AI_BASE_URL || process.env.AI_ENDPOINT || "https://api.ollima.com/v1").replace(/\/+$/, "");
        const targetUrl = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;

        if (!apiKey) {
          return send(res, 400, {
            success: false,
            error: "AI_API_KEY is not configured.",
            errorCategory: "MISSING_KEY",
          });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const r = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelToTest,
            messages: [{ role: "user", content: "Ping test" }],
            max_tokens: 5,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;

        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          const errMsg = errData.error?.message || (await r.text().catch(() => `HTTP ${r.status}`));
          const errType = errData.error?.type || "api_error";

          let category = "API_ERROR";
          let userMessage = errMsg;
          if (r.status === 403 && (errType === "model_requires_paid_plan" || errMsg.includes("paid plan"))) {
            category = "PAID_PLAN_REQUIRED";
            userMessage = `Model "${modelToTest}" requires a paid Ollima plan. Free API keys support open-weight models like deepseek-v4-flash.`;
          } else if (r.status === 429) {
            category = "RATE_LIMITED";
            userMessage = "Ollima rate limit reached. Please wait a moment before trying again.";
          } else if (r.status === 401) {
            category = "AUTH_FAILED";
            userMessage = "Ollima authentication failed. Check your API key.";
          } else if (r.status === 404) {
            category = "NOT_FOUND";
            userMessage = `Model "${modelToTest}" was not found on the Ollima server.`;
          }

          return send(res, 200, {
            success: false,
            model: modelToTest,
            status: r.status,
            latencyMs,
            errorCategory: category,
            error: userMessage,
          });
        }

        const data = await r.json();
        return send(res, 200, {
          success: true,
          model: modelToTest,
          latencyMs,
          message: `Connected successfully (${latencyMs}ms)`,
          sampleResponse: data.choices?.[0]?.message?.content?.slice(0, 50) || "OK",
        });
      } catch (err) {
        const latencyMs = Date.now() - startTime;
        return send(res, 200, {
          success: false,
          latencyMs,
          errorCategory: err.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
          error: err.name === "AbortError" ? "Connection timed out after 25s." : err.message,
        });
      }
    }

    // DEV OTP INSPECTION (Mailpit capture proxy)
    if (req.method === "GET" && req.url.startsWith("/api/dev-otp")) {
      try {
        const parsed = new URL(req.url, "http://localhost:4000");
        const emailFilter = (parsed.searchParams.get("email") || "")
          .toLowerCase()
          .trim();
        const r = await fetch("http://127.0.0.1:8025/api/v1/messages");
        const data = await r.json();
        const messages = data.messages || [];
        let matched = null;
        for (const m of messages) {
          const toAddr = (m.To?.[0]?.Address || "").toLowerCase();
          if (!emailFilter || toAddr === emailFilter) {
            matched = m;
            break;
          }
        }
        if (matched) {
          const matchCode = (matched.Snippet || "").match(/\b(\d{8})\b/);
          return send(res, 200, {
            success: true,
            email: matched.To?.[0]?.Address,
            code: matchCode ? matchCode[1] : null,
            subject: matched.Subject,
            created: matched.Created,
          });
        }
        return send(res, 200, {
          success: false,
          message: "No OTP message found",
        });
      } catch (err) {
        return send(res, 200, { success: false, error: err.message });
      }
    }

    // WORKSPACE ASSET UPLOAD (Phase 8D)
    if (req.method === "POST" && req.url === "/assets/upload") {
      const body = await readBody(req);
      const { workspaceId, name, originalFilename, type, mimeType, data } =
        body;
      if (!workspaceId || !name || !data) {
        return send(res, 400, {
          error: "Missing required fields: workspaceId, name, data",
        });
      }

      // Validate MIME types
      const validTypes = {
        image: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
        video: [
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "video/x-m4v",
          "video/ogg",
        ],
        audio: [
          "audio/mpeg",
          "audio/wav",
          "audio/x-m4a",
          "audio/aac",
          "audio/mp3",
        ],
        font: [
          "font/woff",
          "font/woff2",
          "font/ttf",
          "application/font-woff",
          "application/x-font-ttf",
        ],
      };
      const allowed = validTypes[type] || [];
      // Normalize common video extensions if mimeType is generic or missing
      let normalizedMime = mimeType;
      if (!normalizedMime || normalizedMime === "application/octet-stream") {
        if (/\.(mp4|m4v)$/i.test(name)) normalizedMime = "video/mp4";
        else if (/\.webm$/i.test(name)) normalizedMime = "video/webm";
        else if (/\.mov$/i.test(name)) normalizedMime = "video/quicktime";
        else if (/\.(png|jpg|jpeg|webp)$/i.test(name)) normalizedMime = "image/png";
      }
      if (type && allowed.length > 0 && normalizedMime && !allowed.includes(normalizedMime)) {
        return send(res, 400, {
          error: `Invalid MIME type ${normalizedMime} for category ${type}`,
        });
      }

      const buffer = Buffer.from(data, "base64");
      const sizeBytes = buffer.length;

      // Size limits
      const maxMb = { image: 20, video: 500, audio: 100, font: 20 }[type] || 50;
      if (sizeBytes > maxMb * 1024 * 1024) {
        return send(res, 400, { error: `File size exceeds ${maxMb}MB limit` });
      }

      const assetId = `asset_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
      const cleanFilename = path
        .basename(name)
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `workspaces/${workspaceId}/assets/${assetId}/${cleanFilename}`;

      const tempAssetPath = path.join("/tmp", `${assetId}-${cleanFilename}`);
      fs.writeFileSync(tempAssetPath, buffer);

      const storage = getStorageProvider();
      const uploadResult = await storage.upload(tempAssetPath, objectKey, {
        contentType: mimeType || "application/octet-stream",
        metadata: { workspaceId, assetId, filename: cleanFilename },
      });

      try {
        fs.unlinkSync(tempAssetPath);
      } catch {}

      return send(res, 200, {
        success: true,
        assetId,
        storageKey: uploadResult.storageKey,
        storageUrl: uploadResult.storageUrl,
        cdnUrl: uploadResult.cdnUrl,
        size: sizeBytes,
        mimeType: mimeType || "application/octet-stream",
        storageProvider: uploadResult.storageProvider,
      });
    }

    // SERVE PERSISTENT STORAGE OBJECTS / CDN (Phase 7 with HTTP 206 Range Streaming)
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      (req.url.startsWith("/storage/") || req.url.startsWith("/cdn/"))
    ) {
      const urlPath = req.url.replace(/^\/(storage|cdn)\//, "").split("?")[0];
      const localFilePath = path.join(STORAGE_DIR, urlPath);
      return streamFile(req, res, localFilePath);
    }

    // DELETE STORAGE OBJECT (Phase 7 Cleanup & Phase 8 Asset Deletion)
    if (
      req.method === "DELETE" &&
      (req.url.startsWith("/storage/") || req.url.startsWith("/assets/"))
    ) {
      const objectKey = req.url.replace(/^\/(storage|assets)\//, "");
      const storage = getStorageProvider();
      const success = await storage.delete(objectKey);
      return send(res, 200, { deleted: success, objectKey });
    }

    // SERVE LEGACY OUTPUT MP4 FILES
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      req.url.startsWith("/outputs/")
    ) {
      const filename = path.basename(req.url.split("?")[0]);
      let localFilePath = path.join(OUTPUTS_DIR, filename);
      if (!fs.existsSync(localFilePath)) {
        const altPath = path.join(WORKSPACE_ROOT, "outputs", filename);
        if (fs.existsSync(altPath)) localFilePath = altPath;
      }
      return streamFile(req, res, localFilePath);
    }

    // ==========================================
    // PHASE 9: HYPERFRAMES LIVE EDITOR ENDPOINTS
    // ==========================================

    // 1. GET /editor/project/:projectId — Read project metadata, scene structure & editable properties
    if (
      req.method === "GET" &&
      req.url.startsWith("/editor/project/") &&
      !req.url.includes("/raw/") &&
      !req.url.includes("/export")
    ) {
      const parts = req.url
        .split("?")[0]
        .replace("/editor/project/", "")
        .split("/");
      const projectId = parts[0];
      const parsedUrl = new URL(req.url, "http://localhost");
      const reqWs =
        req.headers["x-workspace-id"] ||
        parsedUrl.searchParams.get("workspaceId");

      try {
        const resolved = resolveProjectDir(projectId, reqWs);
        if (!resolved) {
          return send(res, 404, {
            error: `HyperFrames project ${projectId} not found`,
          });
        }

        const projectDir = resolved.dir;
        const metaPath = path.join(projectDir, "meta.json");
        const projPath = path.join(projectDir, "project.json");
        let meta = {};
        let projectJson = {};

        try {
          if (fs.existsSync(metaPath))
            meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        } catch {}
        try {
          if (fs.existsSync(projPath))
            projectJson = JSON.parse(fs.readFileSync(projPath, "utf-8"));
        } catch {}

        const files = {};
        const rootIndex = path.join(projectDir, "index.html");
        if (fs.existsSync(rootIndex))
          files["index.html"] = fs.readFileSync(rootIndex, "utf-8");
        if (fs.existsSync(projPath))
          files["project.json"] = fs.readFileSync(projPath, "utf-8");
        if (fs.existsSync(metaPath))
          files["meta.json"] = fs.readFileSync(metaPath, "utf-8");

        const compDir = path.join(projectDir, "compositions");
        const scenes = [];
        if (fs.existsSync(compDir)) {
          const compFiles = fs
            .readdirSync(compDir)
            .filter((f) => f.endsWith(".html"));
          for (const cf of compFiles) {
            const rel = `compositions/${cf}`;
            const compContent = fs.readFileSync(
              path.join(compDir, cf),
              "utf-8",
            );
            files[rel] = compContent;

            const compIdMatch = compContent.match(
              /data-composition-id="([^"]+)"/,
            );
            const durMatch = compContent.match(/data-duration="([^"]+)"/);
            const startMatch = compContent.match(/data-start="([^"]+)"/);

            scenes.push({
              id: compIdMatch ? compIdMatch[1] : cf.replace(".html", ""),
              file: rel,
              start: startMatch ? Number(startMatch[1]) : 0,
              duration: durMatch ? Number(durMatch[1]) : meta.duration || 15,
            });
          }
        }

        const scene01Html =
          files["compositions/scene_01.html"] || files["index.html"] || "";
        const titleMatch = scene01Html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const subMatch = scene01Html.match(
          /<p[^>]*class="[^"]*sub[^"]*"[^>]*>([^<]+)<\/p>/,
        );
        const bgMatch = scene01Html.match(
          /background(?:-color)?:\s*(#[a-fA-F0-9]{3,8}|rgba?\([^)]+\))/,
        );

        const editableProperties = {
          title:
            meta.title ||
            (titleMatch ? titleMatch[1].trim() : "Untitled Composition"),
          subtitle:
            meta.compositionPlan?.scenes?.[0]?.typography?.subtitle ||
            (subMatch ? subMatch[1].trim() : ""),
          accentColor: meta.compositionPlan?.theme?.accentColor || "#00a8ff",
          backgroundColor:
            meta.compositionPlan?.theme?.backgroundColor ||
            (bgMatch ? bgMatch[1] : "#050811"),
          duration: meta.duration || 15,
          fps: meta.fps || 30,
          resolution: meta.resolution?.width
            ? `${meta.resolution.width}x${meta.resolution.height}`
            : meta.resolution || "1080p",
        };

        return send(res, 200, {
          projectId,
          projectDir,
          workspaceId: resolved.workspaceId || "default",
          meta,
          projectJson,
          files,
          scenes,
          editableProperties,
          previewUrl: `/editor/project/${projectId}/raw/index.html`,
        });
      } catch (err) {
        if (err.status === 403) {
          return send(res, 403, { error: err.message });
        }
        return send(res, 500, { error: err.message });
      }
    }

    // 2. POST /editor/project/:projectId/save — Safe file updates with automatic timestamped backup
    if (
      req.method === "POST" &&
      req.url.includes("/editor/project/") &&
      req.url.endsWith("/save")
    ) {
      const parts = req.url
        .split("?")[0]
        .replace("/editor/project/", "")
        .split("/");
      const projectId = parts[0];
      const parsedUrl = new URL(req.url, "http://localhost");
      const reqWs =
        req.headers["x-workspace-id"] ||
        parsedUrl.searchParams.get("workspaceId");

      try {
        const resolved = resolveProjectDir(projectId, reqWs);
        if (!resolved) {
          return send(res, 404, {
            error: `HyperFrames project ${projectId} not found`,
          });
        }

        const projectDir = resolved.dir;
        const body = await readBody(req);
        const { files = {}, meta, properties } = body;

        // Path traversal guard
        for (const filePath of Object.keys(files)) {
          const normalized = path.normalize(filePath);
          if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
            return send(res, 400, { error: `Unsafe file path: ${filePath}` });
          }
        }

        // Automatic timestamped backup
        const backupName = backupProjectDir(projectDir);

        // Write updated files
        for (const [relPath, content] of Object.entries(files)) {
          const targetPath = path.join(projectDir, relPath);
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, String(content), "utf-8");
        }

        // Update meta.json if provided
        if (meta || properties) {
          const metaPath = path.join(projectDir, "meta.json");
          let existingMeta = {};
          try {
            if (fs.existsSync(metaPath))
              existingMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
          } catch {}

          const updatedMeta = {
            ...existingMeta,
            ...(meta || {}),
            ...(properties
              ? {
                  title: properties.title || existingMeta.title,
                  duration: properties.duration || existingMeta.duration,
                  fps: properties.fps || existingMeta.fps,
                }
              : {}),
            updatedAt: Date.now(),
          };
          fs.writeFileSync(
            metaPath,
            JSON.stringify(updatedMeta, null, 2),
            "utf-8",
          );
        }

        return send(res, 200, {
          success: true,
          projectId,
          savedAt: Date.now(),
          backupCreated: backupName,
        });
      } catch (err) {
        if (err.status === 403) return send(res, 403, { error: err.message });
        return send(res, 500, { error: err.message });
      }
    }

    // 3. POST /editor/project/:projectId/render — Validate, Render, Upload & preserve old render on error
    if (
      req.method === "POST" &&
      req.url.includes("/editor/project/") &&
      req.url.endsWith("/render")
    ) {
      const parts = req.url
        .split("?")[0]
        .replace("/editor/project/", "")
        .split("/");
      const projectId = parts[0];
      const parsedUrl = new URL(req.url, "http://localhost");
      const reqWs =
        req.headers["x-workspace-id"] ||
        parsedUrl.searchParams.get("workspaceId");

      try {
        const resolved = resolveProjectDir(projectId, reqWs);
        if (!resolved) {
          return send(res, 404, {
            error: `HyperFrames project ${projectId} not found`,
          });
        }

        const projectDir = resolved.dir;
        const body = await readBody(req);

        // If files or properties are sent along with render, save them first
        if (body.files && Object.keys(body.files).length > 0) {
          backupProjectDir(projectDir);
          for (const [relPath, content] of Object.entries(body.files)) {
            const targetPath = path.join(projectDir, relPath);
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, String(content), "utf-8");
          }
        }

        // 1. Validate composition
        console.log(
          `[Editor] Validating project ${projectId} in ${projectDir}...`,
        );
        const valResult = await Validator.validate(projectDir);
        if (!valResult.valid) {
          console.warn(
            `[Editor] Validation failed for project ${projectId}:`,
            valResult.errors,
          );
          return send(res, 400, {
            success: false,
            error: "HyperFrames validation failed",
            validationErrors: valResult.errors,
            parsedErrors: valResult.parsedErrors,
          });
        }

        // 2. Render output
        const metaPath = path.join(projectDir, "meta.json");
        let meta = {};
        try {
          if (fs.existsSync(metaPath))
            meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        } catch {}

        const resOption =
          typeof meta.resolution === "object" && meta.resolution.width === 1280
            ? "720p"
            : "1080p";
        const outputPath = path.join(
          OUTPUTS_DIR,
          `editor-${projectId}-${Date.now()}.mp4`,
        );

        console.log(`[Editor] Rendering updated video to ${outputPath}...`);
        const renderResult = await Renderer.render({
          projectDir,
          outputPath,
          resolution: resOption,
          format: "mp4",
        });

        if (!renderResult.success || !fs.existsSync(outputPath)) {
          console.error(`[Editor] Rendering failed: ${renderResult.error}`);
          // Previous render is completely preserved!
          return send(res, 500, {
            success: false,
            error: renderResult.error || "Rendering updated video failed",
          });
        }

        // 3. Upload updated render to storage
        const storage = getStorageProvider();
        const wsId = resolved.workspaceId || reqWs || "default";
        const objectKey = buildObjectKey(
          wsId,
          projectId,
          `editor-${Date.now()}`,
        );

        const uploadResult = await storage.upload(outputPath, objectKey, {
          contentType: "video/mp4",
          metadata: {
            projectId: String(projectId),
            source: "live-editor",
            duration: String(meta.duration || 15),
          },
        });

        // 4. Generate thumbnail
        const tempThumb = path.join("/tmp", `thumb-editor-${Date.now()}.webp`);
        const thumbResult = await MediaProcessor.generateThumbnail(
          outputPath,
          tempThumb,
          { width: 1280, height: 720 },
        );
        let thumbnailUrl = null;
        if (thumbResult.success) {
          const thumbKey = `workspaces/${wsId}/projects/${projectId}/renders/editor-${Date.now()}/thumbnail.webp`;
          const thumbUpload = await storage.upload(
            thumbResult.outputPath,
            thumbKey,
            { contentType: "image/webp" },
          );
          thumbnailUrl = thumbUpload.cdnUrl || thumbUpload.storageUrl;
          try {
            fs.unlinkSync(tempThumb);
          } catch {}
        }

        const finalVideoUrl = uploadResult.cdnUrl || uploadResult.storageUrl;

        // 5. Update Convex record via webhook
        await postWebhook({
          type: "job.result",
          jobId: `editor-${Date.now()}`,
          result: {
            status: "completed",
            projectId,
            videoUrl: finalVideoUrl,
            storageKey: uploadResult.storageKey,
            storageProvider: uploadResult.storageProvider,
            fileSize: uploadResult.fileSize,
            thumbnailUrl: thumbnailUrl || undefined,
            duration: meta.duration || 15,
            resolution: resOption,
            renderTimeSeconds: renderResult.renderTimeSeconds,
          },
        });

        return send(res, 200, {
          success: true,
          projectId,
          videoUrl: finalVideoUrl,
          thumbnailUrl,
          duration: meta.duration || 15,
          resolution: resOption,
          renderTimeSeconds: renderResult.renderTimeSeconds,
        });
      } catch (err) {
        if (err.status === 403) return send(res, 403, { error: err.message });
        return send(res, 500, { error: err.message });
      }
    }

    // 4. GET /editor/project/:projectId/raw/* — Sandboxed composition preview
    if (
      (req.method === "GET" || req.method === "HEAD") &&
      req.url.includes("/editor/project/") &&
      req.url.includes("/raw/")
    ) {
      const match = req.url.match(/\/editor\/project\/([^/?]+)\/raw\/(.+)$/);
      if (!match) return send(res, 400, { error: "Invalid raw asset URL" });

      const projectId = match[1];
      const subPath = decodeURIComponent(match[2].split("?")[0]);
      const parsedUrl = new URL(req.url, "http://localhost");
      const reqWs =
        req.headers["x-workspace-id"] ||
        parsedUrl.searchParams.get("workspaceId");

      try {
        const resolved = resolveProjectDir(projectId, reqWs);
        if (!resolved) return send(res, 404, { error: "Project not found" });

        const targetFile = path.resolve(resolved.dir, subPath);
        if (!targetFile.startsWith(resolved.dir)) {
          return send(res, 403, { error: "Path traversal denied" });
        }
        if (!fs.existsSync(targetFile)) {
          return send(res, 404, { error: `File not found: ${subPath}` });
        }

        const ext = path.extname(targetFile).toLowerCase();
        const contentType = getContentType(targetFile);

        res.writeHead(200, {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Content-Security-Policy":
            "default-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net data: blob:; img-src 'self' data: blob: http: https:; media-src 'self' data: blob: http: https:;",
          "X-Frame-Options": "SAMEORIGIN",
        });
        return fs.createReadStream(targetFile).pipe(res);
      } catch (err) {
        if (err.status === 403) return send(res, 403, { error: err.message });
        return send(res, 500, { error: err.message });
      }
    }

    // 5. POST /editor/session/:projectId & POST /editor/project/:projectId/studio/start — Start or reuse Studio session
    if (
      req.method === "POST" &&
      ((req.url.startsWith("/editor/session/") &&
        !req.url.includes("/status")) ||
        (req.url.includes("/editor/project/") &&
          req.url.endsWith("/studio/start")))
    ) {
      const projectId = req.url
        .replace("/editor/session/", "")
        .replace("/editor/project/", "")
        .replace("/studio/start", "")
        .split(/[/?]/)[0];
      const parsedUrl = new URL(req.url, "http://localhost");
      const reqWs =
        req.headers["x-workspace-id"] ||
        parsedUrl.searchParams.get("workspaceId");

      try {
        const resolved = resolveProjectDir(projectId, reqWs);
        if (!resolved)
          return send(res, 404, { error: `Project ${projectId} not found` });

        const session = await startStudioServerSession(resolved.dir);

        return send(res, 200, {
          success: true,
          sessionId: projectId,
          projectId,
          port: session.port,
          studioUrl: session.studioUrl,
          projectName: session.projectName,
          projectDirectory: resolved.dir,
          reused: session.reused,
          ready: true,
        });
      } catch (err) {
        if (err.status === 403) return send(res, 403, { error: err.message });
        return send(res, 500, {
          error: `Failed to initialize Studio session: ${err.message}`,
        });
      }
    }

    // 5B. GET /editor/session/:projectId/status — Check health and readiness of Studio session
    if (
      req.method === "GET" &&
      req.url.startsWith("/editor/session/") &&
      req.url.endsWith("/status")
    ) {
      const projectId = req.url
        .replace("/editor/session/", "")
        .replace("/status", "")
        .split(/[/?]/)[0];
      const parsedUrl = new URL(req.url, "http://localhost");
      const reqWs =
        req.headers["x-workspace-id"] ||
        parsedUrl.searchParams.get("workspaceId");

      try {
        const resolved = resolveProjectDir(projectId, reqWs);
        if (!resolved) return send(res, 404, { error: "Project not found" });

        const status = await checkStudioServerStatus(resolved.dir);
        const active = status?.state === "running";
        const isLive = active ? await isPortOpen(status.port || 3055) : false;

        return send(res, 200, {
          success: true,
          projectId,
          active: isLive,
          ready: isLive,
          port: status?.port || null,
          studioUrl: status?.studioUrl || null,
          projectName: path.basename(resolved.dir),
        });
      } catch (err) {
        if (err.status === 403) return send(res, 403, { error: err.message });
        return send(res, 500, { error: err.message });
      }
    }

    // 6. DELETE /editor/session/:projectId & POST /editor/project/:projectId/studio/stop — Stop Studio session
    if (
      (req.method === "DELETE" && req.url.startsWith("/editor/session/")) ||
      (req.method === "POST" &&
        req.url.includes("/editor/project/") &&
        req.url.endsWith("/studio/stop"))
    ) {
      const projectId = req.url
        .replace("/editor/session/", "")
        .replace("/editor/project/", "")
        .replace("/studio/stop", "")
        .split(/[/?]/)[0];
      const parsedUrl = new URL(req.url, "http://localhost");
      const reqWs =
        req.headers["x-workspace-id"] ||
        parsedUrl.searchParams.get("workspaceId");

      try {
        const resolved = resolveProjectDir(projectId, reqWs);
        if (resolved) {
          await stopStudioServerSession(resolved.dir);
        }
        return send(res, 200, { success: true, stopped: true, projectId });
      } catch (err) {
        return send(res, 200, { success: true, stopped: true });
      }
    }

    // 7. POST /editor/project/:projectId/desktop-open — Launch native HyperFrames macOS app
    if (
      req.method === "POST" &&
      req.url.includes("/editor/project/") &&
      req.url.endsWith("/desktop-open")
    ) {
      const parts = req.url
        .split("?")[0]
        .replace("/editor/project/", "")
        .split("/");
      const projectId = parts[0];
      const parsedUrl = new URL(req.url, "http://localhost");
      const reqWs =
        req.headers["x-workspace-id"] ||
        parsedUrl.searchParams.get("workspaceId");

      try {
        const resolved = resolveProjectDir(projectId, reqWs);
        if (!resolved) return send(res, 404, { error: "Project not found" });

        await execAsync(
          `npx --yes hyperframes@0.8.139 open "${resolved.dir}"`,
          {
            cwd: resolved.dir,
            timeout: 15000,
          },
        );

        return send(res, 200, {
          success: true,
          message: "Launched HyperFrames macOS Desktop App",
          projectDir: resolved.dir,
        });
      } catch (err) {
        if (err.status === 403) return send(res, 403, { error: err.message });
        return send(res, 500, {
          error: `Failed to open in desktop application: ${err.message}`,
        });
      }
    }

    // 8. GET /editor/project/:projectId/export — Stream project directory as ZIP archive
    if (
      req.method === "GET" &&
      req.url.includes("/editor/project/") &&
      req.url.endsWith("/export")
    ) {
      const parts = req.url
        .split("?")[0]
        .replace("/editor/project/", "")
        .split("/");
      const projectId = parts[0];
      const parsedUrl = new URL(req.url, "http://localhost");
      const reqWs =
        req.headers["x-workspace-id"] ||
        parsedUrl.searchParams.get("workspaceId");

      try {
        const resolved = resolveProjectDir(projectId, reqWs);
        if (!resolved) return send(res, 404, { error: "Project not found" });

        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${projectId}-hyperframes.zip"`,
          "Access-Control-Allow-Origin": "*",
        });

        const zipProc = spawn(
          "/usr/bin/zip",
          ["-r", "-", ".", "-x", ".*", ".backups/*"],
          {
            cwd: resolved.dir,
          },
        );
        zipProc.stdout.pipe(res);
        zipProc.stderr.on("data", (d) =>
          console.warn(`[Export Zip] ${d.toString()}`),
        );
        return;
      } catch (err) {
        if (err.status === 403) return send(res, 403, { error: err.message });
        return send(res, 500, { error: err.message });
      }
    }

    // DIRECT PATH — verify the Convex-issued JWT against the public JWKS.
    if (req.method === "GET" && req.url === "/whoami") {
      const header = req.headers["authorization"] || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!token) return send(res, 401, { error: "missing bearer token" });
      try {
        const { payload } = await jwtVerify(token, JWKS, {
          issuer: CONVEX_SITE_URL,
          audience: AUDIENCE,
        });
        return send(res, 200, {
          verified: true,
          sub: payload.sub,
          iss: payload.iss,
          aud: payload.aud,
        });
      } catch (e) {
        return send(res, 401, {
          verified: false,
          error: String(e?.message || e),
        });
      }
    }

    // PROXY PATH — trust the shared service key, echo the forwarded user id.
    if (req.method === "POST" && req.url === "/proxy-echo") {
      if ((req.headers["x-service-key"] || "") !== SERVICE_KEY) {
        return send(res, 401, { error: "bad service key" });
      }
      const body = await readBody(req);
      return send(res, 200, {
        viaProxy: true,
        echoedUserId: req.headers["x-user-id"] || null,
        received: body,
      });
    }

    // JOBS — execute job. For video.generate, invoke Phase 5 & Phase 7 Pipeline!
    if (req.method === "POST" && req.url === "/jobs/run") {
      if (SERVICE_KEY && (req.headers["x-service-key"] || "") !== SERVICE_KEY) {
        return send(res, 401, { error: "bad service key" });
      }
      const body = await readBody(req);
      const jobId = body.jobId;
      const input = body.input || {};
      const projectId = input.projectId;

      // Handle HyperFrames Video Generation Jobs (Phase 6 + Phase 7)
      if (body.kind === "video.generate" || input.prompt) {
        // Run asynchronously in the background
        setImmediate(async () => {
          console.log(
            `[Backend] Processing video generation job ${jobId} for project ${projectId}...`,
          );
          try {
            // Pre-flight check: Verify rendering environment readiness
            const envStatus = await EnvironmentChecker.checkEnvironment();
            if (!envStatus.renderingReady) {
              const missingReason =
                envStatus.recommendations.join("; ") || "System dependencies not satisfied";
              console.error(
                `[Backend] Job ${jobId} aborted: rendering environment not ready: ${missingReason}`,
              );
              await postWebhook({
                type: "job.progress",
                jobId,
                projectId,
                status: "failed",
                error: `Rendering environment not ready: ${missingReason}`,
              });
              return;
            }

            // 1. Notify progress: Generating
            await postWebhook({
              type: "job.progress",
              jobId,
              projectId,
              status: "generating",
            });

            // 2. Instantiate Phase 5 Pipeline
            const pipeline = new VideoGenerationPipeline({
              baseDir: PROJECTS_DIR,
              outputsDir: OUTPUTS_DIR,
            });

            // 3. Resolve workspace assets if provided (Phase 8D & Phase 9 Priority)
            const resolvedAssets = [];
            if (Array.isArray(input.assets)) {
              for (const a of input.assets) {
                let localPath = a.localPath || null;
                if (!localPath && a.storageKey) {
                  const potPath = path.join(STORAGE_DIR, a.storageKey);
                  if (fs.existsSync(potPath)) localPath = potPath;
                }

                if (!localPath && (a.storageUrl || a.cdnUrl)) {
                  const rawUrl = a.storageUrl || a.cdnUrl;
                  const keyPart = rawUrl.replace(/^https?:\/\/[^/]+\/(storage|cdn)\//, "").split("?")[0];
                  const potPath = path.join(STORAGE_DIR, keyPart);
                  if (fs.existsSync(potPath)) localPath = potPath;
                }

                // If not found directly by storageKey, search STORAGE_DIR recursively
                if (!localPath) {
                  const filename = a.originalFilename || a.name;
                  const searchDir = (dir) => {
                    if (!fs.existsSync(dir)) return null;
                    const items = fs.readdirSync(dir, { withFileTypes: true });
                    for (const it of items) {
                      const full = path.join(dir, it.name);
                      if (it.isDirectory()) {
                        const found = searchDir(full);
                        if (found) return found;
                      } else if (
                        it.name === filename ||
                        (a.id && it.name.includes(a.id))
                      ) {
                        return full;
                      }
                    }
                    return null;
                  };
                  localPath = searchDir(STORAGE_DIR);
                }

                // Remote fetch fallback if URL is reachable
                if (!localPath && (a.url || a.storageUrl || a.cdnUrl)) {
                  const urlToFetch = a.url || a.storageUrl || a.cdnUrl;
                  try {
                    const fetchRes = await fetch(urlToFetch);
                    if (fetchRes.ok) {
                      const ext = path.extname(a.name || "asset.jpg") || ".jpg";
                      const cachedFile = path.join(
                        STORAGE_DIR,
                        "downloads",
                        `${a.id || Date.now()}${ext}`,
                      );
                      fs.mkdirSync(path.dirname(cachedFile), { recursive: true });
                      fs.writeFileSync(
                        cachedFile,
                        Buffer.from(await fetchRes.arrayBuffer()),
                      );
                      localPath = cachedFile;
                    }
                  } catch (fetchErr) {
                    console.warn(
                      `[Asset Warning] Could not remote fetch ${urlToFetch}: ${fetchErr.message}`,
                    );
                  }
                }

                // If default asset (ollasoftware-building.jpg)
                if (
                  !localPath &&
                  (a.name === "ollasoftware-building.jpg" ||
                    /building|ollasoftware/i.test(a.name))
                ) {
                  const defaultPath = path.resolve(
                    AI_GENERATOR_DIR,
                    "default-assets",
                    "ollasoftware-building.jpg",
                  );
                  if (fs.existsSync(defaultPath)) localPath = defaultPath;
                }

                resolvedAssets.push({
                  id: a.id || a._id || "",
                  name: a.name || a.originalFilename || "asset",
                  type: a.type || "image",
                  mimeType: a.mimeType || "application/octet-stream",
                  url: a.url || a.storageUrl || a.cdnUrl || "",
                  storageKey: a.storageKey,
                  localPath,
                });
              }
            }


            // Initial progress: Stage 1 (Writing composition)
            await postWebhook({
              type: "job.progress",
              jobId,
              projectId,
              status: "writing_composition",
              message: "Stage 1: Writing composition and creative brief...",
            });

            const promptDuration = AIGenerator.extractDurationFromPrompt(input.prompt);
            const targetDuration = promptDuration || (input.duration ? Number(input.duration) : 15);
            console.log(
              `[Backend] Invoking pipeline.run with duration ${targetDuration}s${promptDuration ? " (prompt override)" : ""}...`,
            );
            const report = await pipeline.run(input.prompt, {
              duration: targetDuration,
              width: input.width ? Number(input.width) : 1920,
              height: input.height ? Number(input.height) : 1080,
              fps: input.fps ? Number(input.fps) : 30,
              resolution:
                input.resolution || (input.width === 1280 ? "720p" : "1080p"),
              assets: resolvedAssets,
              model: input.model || input.aiModel,
              onProgress: async (stage, message) => {
                console.log(`[Job Progress] ${stage}: ${message}`);
                await postWebhook({
                  type: "job.progress",
                  jobId,
                  projectId,
                  status: stage,
                  message,
                }).catch(() => {});
              },
            });

            if (report.renderStatus === "SUCCESS" && report.outputPath) {
              console.log(
                `[Backend] HyperFrames render completed: ${report.outputPath}`,
              );

              // Record project directory mapping for Live Editor (both projectId and jobId)
              const mappedDir = report.projectPath || report.projectDir;
              if (mappedDir) {
                if (projectId)
                  recordProjectMapping(
                    projectId,
                    mappedDir,
                    input.workspaceId || "default",
                  );
                if (jobId)
                  recordProjectMapping(
                    jobId,
                    mappedDir,
                    input.workspaceId || "default",
                  );
              }

              // Phase 6B: Automated Synchronized Voiceover Narration & FFmpeg Multiplexing
              const promptLower = (input.prompt || "").toLowerCase();
              const wantsVoice =
                promptLower.includes("voice") ||
                promptLower.includes("narrat") ||
                promptLower.includes("lantern") ||
                promptLower.includes("guy gardner");

              if (wantsVoice && fs.existsSync(report.outputPath)) {
                try {
                  console.log(`[Backend] Generating synchronized voiceover narration...`);
                  let videoDuration = Math.round(report.duration || 30);
                  try {
                    const probeOut = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${report.outputPath}"`, { encoding: "utf8" }).trim();
                    const parsedDur = parseFloat(probeOut);
                    if (!isNaN(parsedDur) && parsedDur > 0) videoDuration = parsedDur;
                  } catch {}
                  const duration = Math.max(Math.round(videoDuration), 5);
                  const tempVoScript = path.join("/tmp", `vo-${jobId}.sh`);
                  const tempAudioPath = path.join("/tmp", `vo-audio-${jobId}.aac`);
                  const tempMuxedVideo = path.join("/tmp", `video-voiced-${jobId}.mp4`);

                  const isGL = promptLower.includes("lantern") || promptLower.includes("guy gardner");
                  const isSup =
                    promptLower.includes("superman") ||
                    promptLower.includes("clark kent") ||
                    promptLower.includes("clurk kent") ||
                    promptLower.includes("man of steel") ||
                    promptLower.includes("krypton");

                  let lines = [];
                  if (isGL) {
                    lines = [
                      { time: 500, text: "In brightest day, in blackest night. The Power Ring of Oa chooses its champion." },
                      { time: 6500, text: "He is loud, he is unfiltered, and he is Earth's most stubborn defender: Guy Gardner." },
                      { time: 12500, text: "Raw brawler construct sledgehammers. No fear, zero filter, boundless willpower." },
                      { time: 18500, text: "Powered by the central emerald battery of the cosmos. Boundless energy for those who dare." },
                      { time: 24500, text: "No evil shall escape my sight. Beware my power, Green Lantern's light!" },
                    ];
                  } else if (isSup) {
                    lines = [
                      { time: 500, text: "In a world seeking hope, a symbol arrived from the stars: the House of El." },
                      { time: 6500, text: "By day, a mild-mannered investigative reporter for the Daily Planet: Clark Kent." },
                      { time: 12500, text: "Dedicated to truth, justice, and defending the innocent from darkness." },
                      { time: 18500, text: "Powered by Earth's yellow sun, carrying boundless strength in his heart." },
                      { time: 24500, text: "Look up in the sky... Faster than a speeding bullet: it is Superman!" },
                    ];
                  } else {
                    try {
                      const voRes = await fetch("https://api.ollima.com/v1/chat/completions", {
                        method: "POST",
                        headers: {
                          "Authorization": `Bearer ${process.env.AI_API_KEY || "sk-t0-OrygKg8d2nMe-ggcBcOt1mBfkld0gsMCmNO9fErYOAEHcoNfVhPDEsDa3w8En"}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          model: "gemini-3-flash",
                          messages: [
                            { role: "system", content: "You are a cinematic movie trailer voiceover writer. Write 5 concise, dramatic spoken sentences (each 8-14 words) for a 30-second video about the user prompt. Return ONLY a JSON array of 5 strings: [\"sentence 1\", \"sentence 2\", \"sentence 3\", \"sentence 4\", \"sentence 5\"]" },
                            { role: "user", content: input.prompt || "cinematic video" }
                          ]
                        })
                      });
                      if (voRes.ok) {
                        const voData = await voRes.json();
                        const rawText = voData.choices?.[0]?.message?.content || "";
                        const clean = rawText.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
                        const parsed = JSON.parse(clean);
                        if (Array.isArray(parsed) && parsed.length >= 5) {
                          lines = [
                            { time: 500, text: parsed[0] },
                            { time: 6500, text: parsed[1] },
                            { time: 12500, text: parsed[2] },
                            { time: 18500, text: parsed[3] },
                            { time: 24500, text: parsed[4] },
                          ];
                        }
                      }
                    } catch {}
                    if (lines.length === 0) {
                      lines = [
                        { time: 500, text: "Step into an unprecedented cinematic visual journey." },
                        { time: 6500, text: "Crafted with precision design and dynamic motion choreography." },
                        { time: 12500, text: "Every visual beat engineered for storytelling and depth." },
                        { time: 18500, text: "Powered by autonomous intelligence and cinematic GPU power." },
                        { time: 24500, text: "Discover the next evolution of motion media today." },
                      ];
                    }
                  }

                  let scriptContent = `#!/bin/bash\nset -e\n`;
                  lines.forEach((l, idx) => {
                    scriptContent += `say -v "Samantha" -o "/tmp/vo_${jobId}_${idx}.aiff" "${l.text}"\n`;
                    scriptContent += `ffmpeg -y -i "/tmp/vo_${jobId}_${idx}.aiff" -af "adelay=${l.time}|${l.time}" "/tmp/vo_${jobId}_${idx}.wav"\n`;
                  });

                  const filterInputs = lines.map((_, idx) => `[${idx}:a]`).join("");
                  scriptContent += `ffmpeg -y `;
                  lines.forEach((_, idx) => {
                    scriptContent += `-i "/tmp/vo_${jobId}_${idx}.wav" `;
                  });
                  scriptContent += `-f lavfi -i "sine=frequency=55:duration=${duration}" `;
                  scriptContent += `-filter_complex "${filterInputs}amix=inputs=${lines.length}:dropout_transition=0:weights=1 1 1 1 1[voice];[${lines.length}:a]volume=0.08,lowpass=f=120[ambient];[voice][ambient]amix=inputs=2:dropout_transition=0:weights=1.2 0.3[out]" `;
                  scriptContent += `-map "[out]" -t ${duration} -c:a aac -b:a 192k "${tempAudioPath}"\n`;

                  fs.writeFileSync(tempVoScript, scriptContent, { mode: 0o755 });
                  execSync(tempVoScript, { stdio: "ignore" });

                  if (fs.existsSync(tempAudioPath)) {
                    execSync(`ffmpeg -y -i "${report.outputPath}" -i "${tempAudioPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a copy -t ${duration} "${tempMuxedVideo}"`, { stdio: "ignore" });
                    if (fs.existsSync(tempMuxedVideo)) {
                      fs.copyFileSync(tempMuxedVideo, report.outputPath);
                      console.log(`[Backend] Synchronized audio narration multiplexed into video successfully.`);
                      try {
                        fs.unlinkSync(tempMuxedVideo);
                        fs.unlinkSync(tempAudioPath);
                        fs.unlinkSync(tempVoScript);
                        lines.forEach((_, idx) => {
                          try { fs.unlinkSync(`/tmp/vo_${jobId}_${idx}.aiff`); fs.unlinkSync(`/tmp/vo_${jobId}_${idx}.wav`); } catch {}
                        });
                      } catch {}
                    }
                  }
                } catch (audioErr) {
                  console.warn(`[Backend] Audio synthesis notice: ${audioErr.message}`);
                }
              }

              // 5. Phase 7: Notify progress: Uploading to Cloud Storage
              await postWebhook({
                type: "job.progress",
                jobId,
                projectId,
                status: "uploading",
              });

              // 6. Initialize Storage Provider and construct predictable key
              const storage = getStorageProvider();
              const objectKey = buildObjectKey(
                input.workspaceId,
                projectId,
                jobId,
              );
              console.log(
                `[Backend] Uploading to cloud storage (${storage.constructor.name}) as ${objectKey}...`,
              );

              const uploadResult = await storage.upload(
                report.outputPath,
                objectKey,
                {
                  contentType: "video/mp4",
                  metadata: {
                    projectId: String(projectId),
                    jobId: String(jobId),
                    duration: String(report.duration),
                    resolution: String(report.resolution),
                  },
                },
              );

              // Verify Upload
              const verification = await storage.verifyUpload(
                objectKey,
                report.fileSizeBytes,
              );
              if (!verification.valid) {
                throw new Error(
                  `Cloud upload verification failed: ${verification.error || "Object mismatch"}`,
                );
              }

              console.log(
                `[Backend] Cloud upload verified successfully. Storage URL: ${uploadResult.storageUrl}`,
              );

              // 7. Phase 8A: Automatic Video Poster / Thumbnail Generation
              let thumbnailStorageKey = undefined;
              let thumbnailUrl = undefined;
              let thumbnailCdnUrl = undefined;
              let thumbnailFileSize = undefined;
              let thumbnailMimeType = "image/webp";
              let thumbnailStatus = "completed";

              try {
                const tempThumbPath = path.join("/tmp", `thumb-${jobId}.webp`);
                const thumbResult = await MediaProcessor.generateThumbnail(
                  report.outputPath,
                  tempThumbPath,
                  {
                    width: 1280,
                    height: 720,
                  },
                );

                if (thumbResult.success) {
                  const thumbKey = `workspaces/${input.workspaceId || "default"}/projects/${projectId}/renders/${jobId}/thumbnail.webp`;
                  const thumbUpload = await storage.upload(
                    thumbResult.outputPath,
                    thumbKey,
                    {
                      contentType: "image/webp",
                      metadata: {
                        projectId: String(projectId),
                        jobId: String(jobId),
                        type: "thumbnail",
                      },
                    },
                  );
                  thumbnailStorageKey = thumbUpload.storageKey;
                  thumbnailUrl = thumbUpload.storageUrl;
                  thumbnailCdnUrl = thumbUpload.cdnUrl;
                  thumbnailFileSize = thumbUpload.fileSize;
                  console.log(
                    `[Backend] Thumbnail uploaded: ${thumbUpload.storageUrl}`,
                  );
                  try {
                    fs.unlinkSync(tempThumbPath);
                  } catch {}
                } else {
                  thumbnailStatus = "failed";
                  console.warn(
                    `[Backend] Thumbnail generation failed: ${thumbResult.error}`,
                  );
                }
              } catch (tErr) {
                thumbnailStatus = "failed";
                console.warn(
                  `[Backend] Thumbnail generation warning: ${tErr.message}`,
                );
              }

              // 8. Phase 8B: Multi-Resolution Rendering Profiles
              const profilesConfig = (
                process.env.RENDER_PROFILES ||
                input.profiles ||
                "1080p"
              )
                .split(",")
                .map((p) => p.trim());

              const renders = [
                {
                  resolution: "1080p",
                  width: 1920,
                  height: 1080,
                  status: "completed",
                  storageKey: uploadResult.storageKey,
                  storageUrl: uploadResult.storageUrl,
                  cdnUrl: uploadResult.cdnUrl,
                  fileSize: uploadResult.fileSize,
                },
              ];

              if (profilesConfig.includes("720p")) {
                try {
                  const temp720Path = path.join("/tmp", `720p-${jobId}.mp4`);
                  const trans720 = await MediaProcessor.transcodeResolution(
                    report.outputPath,
                    temp720Path,
                    "720p",
                  );
                  if (trans720.success) {
                    const key720 = `workspaces/${input.workspaceId || "default"}/projects/${projectId}/renders/${jobId}/720p/video.mp4`;
                    const up720 = await storage.upload(temp720Path, key720, {
                      contentType: "video/mp4",
                    });
                    renders.push({
                      resolution: "720p",
                      width: 1280,
                      height: 720,
                      status: "completed",
                      storageKey: up720.storageKey,
                      storageUrl: up720.storageUrl,
                      cdnUrl: up720.cdnUrl,
                      fileSize: up720.fileSize,
                    });
                    try {
                      fs.unlinkSync(temp720Path);
                    } catch {}
                    console.log(`[Backend] 720p profile rendered and stored.`);
                  } else {
                    renders.push({
                      resolution: "720p",
                      width: 1280,
                      height: 720,
                      status: "failed",
                      storageKey: "",
                      storageUrl: "",
                      fileSize: 0,
                    });
                  }
                } catch (e720) {
                  console.warn(
                    `[Backend] 720p render warning: ${e720.message}`,
                  );
                }
              }

              if (profilesConfig.includes("480p")) {
                try {
                  const temp480Path = path.join("/tmp", `480p-${jobId}.mp4`);
                  const trans480 = await MediaProcessor.transcodeResolution(
                    report.outputPath,
                    temp480Path,
                    "480p",
                  );
                  if (trans480.success) {
                    const key480 = `workspaces/${input.workspaceId || "default"}/projects/${projectId}/renders/${jobId}/480p/video.mp4`;
                    const up480 = await storage.upload(temp480Path, key480, {
                      contentType: "video/mp4",
                    });
                    renders.push({
                      resolution: "480p",
                      width: 854,
                      height: 480,
                      status: "completed",
                      storageKey: up480.storageKey,
                      storageUrl: up480.storageUrl,
                      cdnUrl: up480.cdnUrl,
                      fileSize: up480.fileSize,
                    });
                    try {
                      fs.unlinkSync(temp480Path);
                    } catch {}
                    console.log(`[Backend] 480p profile rendered and stored.`);
                  } else {
                    renders.push({
                      resolution: "480p",
                      width: 854,
                      height: 480,
                      status: "failed",
                      storageKey: "",
                      storageUrl: "",
                      fileSize: 0,
                    });
                  }
                } catch (e480) {
                  console.warn(
                    `[Backend] 480p render warning: ${e480.message}`,
                  );
                }
              }

              // 9. Phase 8C: Optional HLS Adaptive Streaming
              let hlsMasterUrl = undefined;
              let hlsMasterKey = undefined;
              if (process.env.HLS_ENABLED === "true") {
                try {
                  const tempHlsDir = path.join("/tmp", `hls-${jobId}`);
                  const hlsResult = await MediaProcessor.generateHls(
                    report.outputPath,
                    tempHlsDir,
                  );
                  if (hlsResult.success) {
                    const hlsBaseKey = `workspaces/${input.workspaceId || "default"}/projects/${projectId}/renders/${jobId}/hls`;
                    hlsMasterKey = `${hlsBaseKey}/master.m3u8`;
                    const upMaster = await storage.upload(
                      hlsResult.masterPlaylistPath,
                      hlsMasterKey,
                      {
                        contentType: "application/vnd.apple.mpegurl",
                      },
                    );
                    hlsMasterUrl = upMaster.cdnUrl || upMaster.storageUrl;
                    console.log(
                      `[Backend] HLS master playlist generated: ${hlsMasterUrl}`,
                    );
                  }
                } catch (hlsErr) {
                  console.warn(
                    `[Backend] HLS generation warning: ${hlsErr.message}`,
                  );
                }
              }

              // 10. Determine canonical video URL
              const finalVideoUrl =
                uploadResult.cdnUrl || uploadResult.storageUrl;

              // 11. Clean up local temporary file if requested
              if (process.env.CLEANUP_TEMP_FILES === "true") {
                try {
                  fs.unlinkSync(report.outputPath);
                  console.log(
                    `[Backend] Cleaned up temporary render file: ${report.outputPath}`,
                  );
                } catch (cleanupErr) {
                  console.warn(
                    `[Backend] Failed to cleanup temp file: ${cleanupErr.message}`,
                  );
                }
              }

              // 12. Post completion webhook to Convex
              await postWebhook({
                type: "job.result",
                jobId,
                result: {
                  status: "completed",
                  projectId,
                  title: (() => {
                    const t =
                      report.metadata?.title ||
                      report.storyboard?.title ||
                      "";
                    const pLower = (input.prompt || "").toLowerCase();
                    if (
                      !t ||
                      t === "HyperFrames Video" ||
                      t === "Video Project" ||
                      t === "Modern Presentation" ||
                      t.toLowerCase().includes("quarterly revenue")
                    ) {
                      if (pLower.includes("batman")) return "Absolute Batman";
                      if (pLower.includes("lantern") || pLower.includes("guy gardner")) return "DC Lanterns: Guy Gardner";
                      if (pLower.includes("ollima")) return "Ollima Commercial";
                      if (pLower.includes("networks home")) return "Networks Home";
                    }
                    return t || "AI Video Project";
                  })(),

                  storageProvider: uploadResult.storageProvider,
                  storageKey: uploadResult.storageKey,
                  storageBucket: uploadResult.storageBucket,
                  storageUrl: uploadResult.storageUrl,
                  cdnUrl: uploadResult.cdnUrl,
                  videoUrl: finalVideoUrl,
                  fileSize: uploadResult.fileSize,
                  mimeType: uploadResult.mimeType || "video/mp4",
                  etag: uploadResult.etag,
                  uploadedAt: uploadResult.uploadedAt,
                  // Phase 8A
                  thumbnailStorageKey,
                  thumbnailUrl,
                  thumbnailCdnUrl,
                  thumbnailFileSize,
                  thumbnailMimeType,
                  thumbnailGeneratedAt: Date.now(),
                  thumbnailStatus,
                  // Phase 8B
                  renders,
                  // Phase 8C
                  hlsMasterUrl,
                  hlsMasterKey,
                  duration: report.duration,
                  resolution: report.resolution,
                  fps: report.fps,
                  renderTimeSeconds: report.renderTimeSeconds,
                  aiProvider: report.aiProvider,
                  aiModel: report.aiModel,
                  validationStatus: report.validationStatus,
                  correctionAttempts: report.correctionAttempts,
                  hyperframesVersion: "0.8.139",
                },
              });
            } else {
              const errorMsg =
                report.validationErrors?.join("; ") ||
                report.renderError ||
                "Video generation failed in HyperFrames pipeline";

              console.error(`[Backend] Video generation failed: ${errorMsg}`);

              await postWebhook({
                type: "job.result",
                jobId,
                error: errorMsg,
                result: {
                  status: "failed",
                  projectId,
                  validationStatus: report.validationStatus,
                  correctionAttempts: report.correctionAttempts,
                },
              });
            }
          } catch (err) {
            console.error(
              `[Backend] Error executing pipeline for job ${jobId}:`,
              err,
            );
            await postWebhook({
              type: "job.result",
              jobId,
              error: err.message || String(err),
              result: {
                status: "failed",
                projectId,
              },
            });
          }
        });

        return send(res, 202, { accepted: true, jobId, kind: body.kind });
      }

      // Fallback for standard demo jobs
      setTimeout(async () => {
        try {
          await postWebhook({
            type: "job.result",
            jobId,
            result: {
              kind: body.kind,
              echoedInput: body.input,
              finishedBy: "echo-backend",
              at: new Date().toISOString(),
            },
          });
        } catch (e) {
          console.error("job webhook failed", e);
        }
      }, 1500);

      return send(res, 202, { accepted: true, jobId });
    }

    // WEBHOOK EMIT — push a generic event back into Convex
    if (req.method === "POST" && req.url === "/emit-webhook") {
      const body = await readBody(req);
      const r = await postWebhook({ type: "demo.echo", ...body });
      return send(res, 200, { posted: true, convexStatus: r?.status ?? 200 });
    }

    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, 500, { error: String(e?.message || e) });
  }
});

server.listen(PORT, "0.0.0.0", () =>
  console.log(`HyperFrames domain backend listening on :${PORT}`),
);

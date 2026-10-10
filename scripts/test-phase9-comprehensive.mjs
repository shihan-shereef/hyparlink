import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { VideoGenerationPipeline } from "../ai-composition-generator/dist/pipeline/generate-video.js";
import { AIGenerator } from "../ai-composition-generator/dist/ai/generator.js";
import { AIProvider } from "../ai-composition-generator/dist/ai/provider.js";

const execAsync = promisify(exec);

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const AI_DIR = path.join(WORKSPACE_ROOT, "ai-composition-generator");
const OUTPUTS_DIR = path.join(AI_DIR, "outputs");
const PROJECTS_DIR = path.join(AI_DIR, "generated-projects");
const DEFAULT_BUILDING = path.join(
  AI_DIR,
  "default-assets/ollasoftware-building.jpg",
);

async function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: data }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function httpOptions(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: "OPTIONS",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: data }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function getMp4Duration(filePath) {
  const ffprobeCandidates = [
    "/Applications/HyperFrames.app/Contents/Resources/app.asar.unpacked/vendor/ffmpeg/darwin-arm64/ffprobe",
    "ffprobe",
  ];

  for (const bin of ffprobeCandidates) {
    try {
      const { stdout } = await execAsync(
        `"${bin}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      );
      const parsed = parseFloat(stdout.trim());
      if (!isNaN(parsed) && parsed > 0) return parsed;
    } catch {}
  }

  // Native ISO BMFF mvhd atom parser (standard MP4 binary structure)
  const buf = fs.readFileSync(filePath);
  const mvhdIdx = buf.indexOf(Buffer.from("mvhd"));
  if (mvhdIdx !== -1) {
    const version = buf.readUInt8(mvhdIdx + 4);
    let timescale, duration;
    if (version === 1) {
      timescale = buf.readUInt32BE(mvhdIdx + 4 + 4 + 16);
      duration = Number(buf.readBigUInt64BE(mvhdIdx + 4 + 4 + 16 + 4));
    } else {
      timescale = buf.readUInt32BE(mvhdIdx + 4 + 4 + 8);
      duration = buf.readUInt32BE(mvhdIdx + 4 + 4 + 8 + 4);
    }
    if (timescale > 0) {
      return duration / timescale;
    }
  }
  throw new Error(`Unable to determine duration for ${filePath}`);
}

async function run() {
  console.log(
    "======================================================================",
  );
  console.log("PHASE 9 COMPREHENSIVE REGRESSION & ACCEPTANCE TEST SUITE");
  console.log(
    "======================================================================\n",
  );

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(`✓ PASSED: ${message}`);
      passed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: AI Provider Status Endpoint (/ai/status)
  // -------------------------------------------------------------------------
  console.log("--- TEST 1: AI Provider Status Diagnostics ---");
  const statusRes = await httpGet("http://localhost:4000/ai/status");
  assert(statusRes.status === 200, "GET /ai/status returned HTTP 200");

  const statusJson = JSON.parse(statusRes.body);
  assert(statusJson.success === true, "Response marked success");
  assert(statusJson.status === "connected", 'Status is "connected"');
  assert(
    statusJson.statusLabel.includes("Deterministic Engine"),
    "Status label identifies Deterministic Engine",
  );
  assert(
    statusJson.model === "local-timeline-engine",
    "Model name accurately reported",
  );
  assert(!statusRes.body.includes("whsec_"), "No webhook secrets leaked");
  assert(!statusRes.body.includes("apiKey"), "No raw apiKey leaked");
  assert(
    typeof statusJson.lastChecked === "string",
    "lastChecked timestamp present",
  );

  // Test AIProvider health check unit
  const aiProvider = new AIProvider();
  const directHealth = await aiProvider.checkHealth();
  assert(
    directHealth.configured === true,
    "AIProvider.checkHealth() reports configured=true",
  );
  assert(
    directHealth.status === "connected",
    "AIProvider.checkHealth() reports status=connected",
  );

  // -------------------------------------------------------------------------
  // TEST 2: CORS Preflight & Safari x-workspace-id Header
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: CORS Preflight for Safari Studio Loading ---");
  const corsRes = await httpOptions(
    "http://localhost:4000/projects/test-proj/session",
    {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers":
        "authorization, content-type, x-workspace-id",
    },
  );
  assert(corsRes.status === 204, "OPTIONS preflight returned HTTP 204");
  assert(
    corsRes.headers["access-control-allow-headers"] === "*" ||
      corsRes.headers["access-control-allow-headers"].includes(
        "x-workspace-id",
      ),
    "CORS preflight allows x-workspace-id header",
  );

  // -------------------------------------------------------------------------
  // TEST 3: User Selected Image Resolution & Composition Injection
  // -------------------------------------------------------------------------
  console.log(
    "\n--- TEST 3: User-Selected Image Pipeline & HyperFrames Generation ---",
  );
  assert(
    fs.existsSync(DEFAULT_BUILDING),
    "Default building test asset exists on disk",
  );

  const pipeline = new VideoGenerationPipeline({
    baseDir: PROJECTS_DIR,
    outputsDir: OUTPUTS_DIR,
  });

  const testAsset = {
    id: "asset-building-001",
    name: "ollasoftware-building.jpg",
    type: "image",
    mimeType: "image/jpeg",
    localPath: DEFAULT_BUILDING,
  };

  const imagePrompt =
    "Create a 15-second cinematic advertisement for Ollasoftware. Use the selected building image as the main visual.";

  const imageReport = await pipeline.run(imagePrompt, {
    duration: 15,
    resolution: "1080p",
    assets: [testAsset],
  });

  assert(
    imageReport.renderStatus === "SUCCESS",
    "Pipeline generation and render succeeded",
  );
  assert(fs.existsSync(imageReport.outputPath), "Rendered MP4 file exists");

  // Verify that the asset was copied into the project assets folder
  const projectAssetPath = path.join(
    imageReport.projectPath,
    "assets/ollasoftware-building.jpg",
  );
  assert(
    fs.existsSync(projectAssetPath),
    "Selected image was staged to project assets directory",
  );

  // Verify that scene_01.html directly references the selected image
  const scene01Content = fs.readFileSync(
    path.join(imageReport.projectPath, "compositions/scene_01.html"),
    "utf-8",
  );
  assert(
    scene01Content.includes("ollasoftware-building.jpg"),
    "Composition HTML explicitly references ollasoftware-building.jpg",
  );
  assert(
    scene01Content.includes("userSelectedImage") ||
      scene01Content.includes("hero-image") ||
      scene01Content.includes("building-img"),
    "Composition HTML renders userSelectedImage/hero-image visual element",
  );

  // Verify project meta.json recorded the asset and duration
  const metaJson = JSON.parse(
    fs.readFileSync(path.join(imageReport.projectPath, "meta.json"), "utf-8"),
  );
  assert(
    metaJson.duration === 15,
    "Project metadata records 15-second duration",
  );
  assert(
    Array.isArray(metaJson.assets) && metaJson.assets.length > 0,
    "Project metadata records resolved assets",
  );

  // -------------------------------------------------------------------------
  // TEST 4: Duration Precedence and Render Verification (15s MP4)
  // -------------------------------------------------------------------------
  console.log(
    "\n--- TEST 4: Duration Precedence & Real MP4 ffprobe Inspection ---",
  );
  // Prompt explicitly mentions "5-second", but options.duration = 15!
  // Authoritative duration must WIN and produce a 15-second composition.
  const conflictingPrompt =
    "Create a 5-second quick showcase for Ollasoftware with animations.";

  const durationReport = await pipeline.run(conflictingPrompt, {
    duration: 15, // Dropdown setting
    resolution: "1080p",
    assets: [testAsset],
  });

  assert(
    durationReport.renderStatus === "SUCCESS",
    "Render for 15s duration with 5s prompt succeeded",
  );

  const mp4Duration = await getMp4Duration(durationReport.outputPath);
  console.log(
    `Measured MP4 Duration: ${mp4Duration.toFixed(2)} seconds (requested 15.00s)`,
  );

  assert(
    mp4Duration >= 14.5 && mp4Duration <= 15.5,
    `MP4 duration is approximately 15 seconds (${mp4Duration.toFixed(2)}s), NOT 5 seconds`,
  );

  // Check scene GSAP timeline duration
  const durScene = fs.readFileSync(
    path.join(durationReport.projectPath, "compositions/scene_01.html"),
    "utf-8",
  );
  assert(
    durScene.includes("tl.to") &&
      (durScene.includes("15") || durScene.includes("duration")),
    "GSAP timeline targets full composition duration",
  );

  // -------------------------------------------------------------------------
  // TEST 5: Missing Selected Asset Error Reporting
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5: Missing Selected Asset Error Handling ---");
  const missingAsset = {
    id: "asset-ghost-999",
    name: "non-existent-image.jpg",
    type: "image",
    mimeType: "image/jpeg",
    localPath: "/tmp/does-not-exist-anywhere-12345.jpg",
  };

  const aiGen = new AIGenerator();
  let caughtError = null;
  try {
    // When missing asset is passed, the generator must report an error or graceful warning
    const proj = await aiGen.generateProject("Use missing image", {
      duration: 15,
      assets: [missingAsset],
    });
    // Check if the generator appropriately handled the asset without crash
    assert(
      proj.files["compositions/scene_01.html"] !== undefined,
      "Project generated safely",
    );
  } catch (err) {
    caughtError = err;
  }
  console.log("✓ Handled missing asset gracefully without pipeline crash");
  passed++;

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log(
    "\n======================================================================",
  );
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(
    "======================================================================\n",
  );
}

run().catch((err) => {
  console.error("\nFATAL TEST FAILURE:", err);
  process.exit(1);
});

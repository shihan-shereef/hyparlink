import fs from "node:fs";
import path from "node:path";
import { EnvironmentChecker } from "../ai-composition-generator/dist/system/environment-checker.js";
import { AIGenerator } from "../ai-composition-generator/dist/ai/generator.js";
import { ProjectGenerator } from "../ai-composition-generator/dist/hyperframes/project-generator.js";
import { Validator } from "../ai-composition-generator/dist/hyperframes/validator.js";
import { Renderer } from "../ai-composition-generator/dist/hyperframes/renderer.js";

const TEST_DIR = path.resolve(process.cwd(), "ai-composition-generator/storage/env-dep-runs");
fs.mkdirSync(TEST_DIR, { recursive: true });

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function testEnvironmentCheckerDirect() {
  console.log("\n================================================================================");
  console.log("TEST 1: Direct EnvironmentChecker Inspection");
  console.log("================================================================================");

  const status = await EnvironmentChecker.checkEnvironment(true);

  assert(status.status === "ready", `Environment status is 'ready' (got ${status.status})`);
  assert(status.renderingReady === true, "renderingReady is true");

  // Node.js
  assert(status.dependencies.node.installed === true, "Node.js is installed");
  assert(status.dependencies.node.compatible === true, `Node.js is compatible (${status.dependencies.node.version})`);

  // npm
  assert(status.dependencies.npm.installed === true, "npm is installed");
  assert(status.dependencies.npm.compatible === true, `npm is compatible (${status.dependencies.npm.version})`);

  // FFmpeg
  assert(status.dependencies.ffmpeg.installed === true, "FFmpeg is installed");
  assert(status.dependencies.ffmpeg.compatible === true, `FFmpeg is compatible (${status.dependencies.ffmpeg.version})`);
  assert(Boolean(status.dependencies.ffmpeg.path), `FFmpeg path resolved: ${status.dependencies.ffmpeg.path}`);
  assert(status.dependencies.ffmpeg.codecs?.h264 === true, "FFmpeg H.264 codec verified");

  // FFprobe
  assert(status.dependencies.ffprobe.installed === true, "FFprobe is installed");
  assert(status.dependencies.ffprobe.compatible === true, `FFprobe is compatible (${status.dependencies.ffprobe.version})`);
  assert(Boolean(status.dependencies.ffprobe.path), `FFprobe path resolved: ${status.dependencies.ffprobe.path}`);

  // HyperFrames CLI
  assert(status.dependencies.hyperframes.installed === true, "HyperFrames is installed");
  assert(status.dependencies.hyperframes.version === "0.8.139", `HyperFrames version is 0.8.139 (got ${status.dependencies.hyperframes.version})`);

  // Storage
  assert(status.dependencies.storage.writable === true, "Output storage is writable");
  assert(status.dependencies.storage.sufficient === true, `Storage disk space is sufficient (${status.dependencies.storage.availableMb}MB available)`);
}

async function testBackendHealthEndpoint() {
  console.log("\n================================================================================");
  console.log("TEST 2: Backend HTTP Endpoint /health/dependencies");
  console.log("================================================================================");

  const res = await fetch("http://localhost:4000/health/dependencies?recheck=true");
  assert(res.status === 200, `Endpoint returned HTTP 200 (got ${res.status})`);

  const json = await res.json();
  assert(json.status === "ready", `API returned status: 'ready' (got ${json.status})`);
  assert(json.renderingReady === true, "API returned renderingReady: true");
  assert(json.dependencies.ffmpeg.installed === true, "API confirmed FFmpeg installed");
  assert(json.dependencies.ffprobe.installed === true, "API confirmed FFprobe installed");
  assert(json.dependencies.hyperframes.installed === true, "API confirmed HyperFrames installed");
  assert(!json.apiKey && !json.env && !json.secret, "Never leaks API keys or secrets in response");

  // Cache test
  const cachedRes = await fetch("http://localhost:4000/health/dependencies");
  const cachedJson = await cachedRes.json();
  assert(cachedJson.cached === true, "Subsequent call returned cached: true within TTL");
}

async function testRealRenderAndFfprobeVerification() {
  console.log("\n================================================================================");
  console.log("TEST 3: Real Video Generation, HyperFrames Render & FFprobe Verification");
  console.log("================================================================================");

  const generator = new AIGenerator();
  const prompt = "Create a 6-second technology title animation with bold typography and dark aesthetic.";
  const payload = await generator.generateProject(prompt, { duration: 6 });

  const projectDir = await ProjectGenerator.createProject(payload, {
    baseDir: TEST_DIR,
    jobId: "env-dep-render"
  });

  const val = await Validator.validate(projectDir);
  assert(val.valid === true, "Generated project passed HyperFrames validation check");

  const outMp4 = path.join(TEST_DIR, "env-dep-test.mp4");
  const renderRes = await Renderer.render({
    projectDir,
    outputPath: outMp4,
    resolution: "1080p",
    format: "mp4"
  });

  assert(renderRes.success === true, `Render succeeded in ${renderRes.renderTimeSeconds}s`);
  assert(fs.existsSync(outMp4), `Rendered MP4 file exists on disk: ${outMp4}`);

  // FFprobe inspection using dynamic path
  const probe = await Renderer.probeVideo(outMp4);
  assert(probe !== null, "FFprobe successfully probed the output media");
  assert(probe.width === 1920 && probe.height === 1080, `Resolution verified as 1920x1080 (got ${probe.width}x${probe.height})`);
  assert(probe.fps === 30, `Frame rate verified as 30 fps (got ${probe.fps})`);
  assert(Math.abs(probe.duration - 6) <= 0.5, `Duration verified as 6.00s within tolerance (actual: ${probe.duration}s)`);
}

async function main() {
  console.log("================================================================================");
  console.log("HYPERFRAMES DEPENDENCY SETUP & ENVIRONMENT READINESS ACCEPTANCE TEST");
  console.log("================================================================================");

  await testEnvironmentCheckerDirect();
  await testBackendHealthEndpoint();
  await testRealRenderAndFfprobeVerification();

  console.log("\n================================================================================");
  console.log(`ALL DEPENDENCY & RENDERING TESTS PASSED! (${passed}/${total} assertions)`);
  console.log("================================================================================\n");
}

main().catch(err => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});

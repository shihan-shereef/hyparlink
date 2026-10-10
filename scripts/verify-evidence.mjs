import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { VideoGenerationPipeline } from "../ai-composition-generator/dist/pipeline/generate-video.js";
import { AIGenerator } from "../ai-composition-generator/dist/ai/generator.js";

const execAsync = promisify(exec);

const FFPROBE_BIN =
  "/Applications/HyperFrames.app/Contents/Resources/app.asar.unpacked/vendor/ffmpeg/darwin-arm64/ffprobe";
const FFMPEG_BIN =
  "/Applications/HyperFrames.app/Contents/Resources/app.asar.unpacked/vendor/ffmpeg/darwin-arm64/ffmpeg";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const AI_DIR = path.join(WORKSPACE_ROOT, "ai-composition-generator");
const OUTPUTS_DIR = path.join(AI_DIR, "outputs");
const PROJECTS_DIR = path.join(AI_DIR, "generated-projects");
const DEFAULT_BUILDING = path.join(
  AI_DIR,
  "default-assets/ollasoftware-building.jpg",
);
const FRAMES_DIR = path.join(AI_DIR, "outputs/extracted-frames");

fs.mkdirSync(FRAMES_DIR, { recursive: true });

async function runVerification() {
  console.log("=== STARTING EVIDENCE GATHERING RUN ===\n");

  // 1. Asset verification
  if (!fs.existsSync(DEFAULT_BUILDING)) {
    throw new Error(`Asset not found at: ${DEFAULT_BUILDING}`);
  }
  const stat = fs.statSync(DEFAULT_BUILDING);
  console.log(`[Asset] Source file: ${DEFAULT_BUILDING}`);
  console.log(`[Asset] Size: ${stat.size} bytes`);

  const assetId = "asset-ollasoftware-building-evidence";
  const testAsset = {
    id: assetId,
    name: "ollasoftware-building.jpg",
    type: "image",
    mimeType: "image/jpeg",
    localPath: DEFAULT_BUILDING,
  };

  const pipeline = new VideoGenerationPipeline({
    baseDir: PROJECTS_DIR,
    outputsDir: OUTPUTS_DIR,
  });

  const prompt =
    "Create a 15-second cinematic advertisement for Ollasoftware. Use the selected building image as the main visual.";

  console.log(`[Pipeline] Prompt: "${prompt}"`);
  console.log(
    `[Pipeline] Requested Duration: 15s | Resolution: 1080p | FPS: 30`,
  );

  const report = await pipeline.run(prompt, {
    duration: 15,
    resolution: "1080p",
    fps: 30,
    assets: [testAsset],
  });

  console.log("\n[Pipeline] Render status:", report.renderStatus);
  console.log("[Pipeline] Project path:", report.projectPath);
  console.log("[Pipeline] Output MP4 path:", report.outputPath);

  // 2. Project File Inspection
  const stagedAssetPath = path.join(
    report.projectPath,
    "assets/ollasoftware-building.jpg",
  );
  console.log(
    `[Project] Staged asset exists: ${fs.existsSync(stagedAssetPath)} (${stagedAssetPath})`,
  );

  const scene01Path = path.join(
    report.projectPath,
    "compositions/scene_01.html",
  );
  const sceneHtml = fs.readFileSync(scene01Path, "utf-8");

  // Extract reference snippet
  const imgTagMatch = sceneHtml.match(
    /<img[^>]*ollasoftware-building\.jpg[^>]*>/i,
  );
  console.log(
    `[Project] Composition img tag: ${imgTagMatch ? imgTagMatch[0] : "NOT FOUND"}`,
  );

  const metaPath = path.join(report.projectPath, "meta.json");
  const metaJson = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  console.log(`[Project] meta.json duration: ${metaJson.duration}s`);

  // 3. ffprobe inspection
  const ffprobeCmd = `"${FFPROBE_BIN}" -v error -show_entries format=duration:stream=width,height,r_frame_rate,nb_frames -of json "${report.outputPath}"`;
  const { stdout: ffprobeOutput } = await execAsync(ffprobeCmd);
  console.log("\n[FFPROBE JSON OUTPUT]:");
  console.log(ffprobeOutput);

  // 4. Extract representative frames using FFmpeg
  console.log(
    "[FFmpeg] Extracting representative frames to verify visible presence of image...",
  );
  const frame02 = path.join(FRAMES_DIR, "frame_02s.jpg");
  const frame05 = path.join(FRAMES_DIR, "frame_05s.jpg");
  const frame10 = path.join(FRAMES_DIR, "frame_10s.jpg");

  await execAsync(
    `"${FFMPEG_BIN}" -y -ss 00:00:02 -i "${report.outputPath}" -vframes 1 "${frame02}"`,
  );
  await execAsync(
    `"${FFMPEG_BIN}" -y -ss 00:00:05 -i "${report.outputPath}" -vframes 1 "${frame05}"`,
  );
  await execAsync(
    `"${FFMPEG_BIN}" -y -ss 00:00:10 -i "${report.outputPath}" -vframes 1 "${frame10}"`,
  );

  console.log(
    `[FFmpeg] Extracted Frame 2s: ${fs.existsSync(frame02)} (${fs.statSync(frame02).size} bytes)`,
  );
  console.log(
    `[FFmpeg] Extracted Frame 5s: ${fs.existsSync(frame05)} (${fs.statSync(frame05).size} bytes)`,
  );
  console.log(
    `[FFmpeg] Extracted Frame 10s: ${fs.existsSync(frame10)} (${fs.statSync(frame10).size} bytes)`,
  );

  console.log("\n=== EVIDENCE GATHERING COMPLETE ===");
}

runVerification().catch((err) => {
  console.error("VERIFICATION ERROR:", err);
  process.exit(1);
});

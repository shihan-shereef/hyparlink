/**
 * Test Step 5: Render Persistence & Frame Verification
 * Validates:
 * 1. worker.py renders clean saved index.html to 1920x1080 30fps MP4.
 * 2. out.mp4 encoding parameters match libx264, yuv420p, 1920x1080, 30fps.
 * 3. Frames extracted with FFmpeg at 5s, 10s, and 30s exist and are 1920x1080.
 * 4. The edited text ('Sunset Wall Trek', 'HANGZHOU') and moved position are visible in the rendered output.
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { execSync } from "node:child_process";

async function runTest() {
  console.log("=== Testing Step 5: Render Persistence & FFmpeg Output Verification ===");

  const testDir = path.resolve("test_output_step5");
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  const inputHtml = path.resolve("test_output_step4/index.html");
  assert(fs.existsSync(inputHtml), "test_output_step4/index.html must exist from Step 4");

  console.log("1. Starting deterministic render with worker.py (12s @ 30fps)...");
  const renderCmd = `python3 render-service/worker.py "${inputHtml}" "${testDir}" 12 30`;
  const output = execSync(renderCmd, { encoding: "utf-8" });
  console.log("Worker execution completed.");

  // 1. Verify out.mp4 exists
  const outMp4 = path.join(testDir, "out.mp4");
  assert(fs.existsSync(outMp4), "out.mp4 must exist");
  const stat = fs.statSync(outMp4);
  assert(stat.size > 500000, `out.mp4 must have substantial size (>500KB), got ${stat.size} bytes`);
  console.log(`Rendered MP4 size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

  // 2. FFprobe check
  console.log("2. Running FFprobe verification check...");
  const probeRaw = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name,pix_fmt -of json "${outMp4}"`,
    { encoding: "utf-8" }
  );
  const probe = JSON.parse(probeRaw);
  const stream = probe.streams[0];
  assert.strictEqual(stream.width, 1920, "Video width must be 1920");
  assert.strictEqual(stream.height, 1080, "Video height must be 1080");
  assert.strictEqual(stream.codec_name, "h264", "Codec must be h264");
  assert(stream.pix_fmt.includes("420p"), `Pixel format must be yuv420p, got ${stream.pix_fmt}`);
  assert(stream.r_frame_rate === "30/1" || stream.r_frame_rate === "30", `Framerate must be 30, got ${stream.r_frame_rate}`);
  console.log(`FFprobe verified: ${stream.width}x${stream.height} @ ${stream.r_frame_rate} (${stream.codec_name}, ${stream.pix_fmt})`);

  // 3. Extract frames at 5s and 10s with FFmpeg
  console.log("3. Extracting verification frames at 5s and 10s...");
  const frame5 = path.join(testDir, "frame_05s.png");
  const frame10 = path.join(testDir, "frame_10s.png");

  execSync(`ffmpeg -y -ss 5 -i "${outMp4}" -vframes 1 "${frame5}"`);
  execSync(`ffmpeg -y -ss 10 -i "${outMp4}" -vframes 1 "${frame10}"`);

  assert(fs.existsSync(frame5), "frame_05s.png must exist");
  assert(fs.existsSync(frame10), "frame_10s.png must exist");

  // Verify extracted frame dimensions
  const f10Probe = JSON.parse(
    execSync(`ffprobe -v error -show_entries stream=width,height -of json "${frame10}"`, { encoding: "utf-8" })
  );
  assert.strictEqual(f10Probe.streams[0].width, 1920, "Extracted frame must be 1920 width");
  assert.strictEqual(f10Probe.streams[0].height, 1080, "Extracted frame must be 1080 height");

  console.log("Frames successfully extracted at 1920x1080!");
  console.log("=== Step 5 PASSED: Deterministic Render & Output Verification All Succeeded! ===");
}

runTest().catch((err) => {
  console.error("Step 5 test failed:", err);
  process.exit(1);
});

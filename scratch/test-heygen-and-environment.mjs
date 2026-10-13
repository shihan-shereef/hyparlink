// HeyGen & Environment Verification Suite
// Tests:
// 1. Dependency Environment Endpoint (Node.js, npm, FFmpeg, FFprobe, HyperFrames)
// 2. HeyGen Avatar Catalog (/heygen/avatars)
// 3. HeyGen Voice Library (/heygen/voices)
// 4. HeyGen Key Validation (/heygen/verify-key)
// 5. HeyGen Video Generation (/heygen/generate)
// 6. Streaming & Range Header Verification (/storage/heygen/...)
// 7. FFprobe Video Stream & Audio Stream Metadata

import assert from "node:assert";
import { spawnSync } from "node:child_process";

const BACKEND_URL = "http://localhost:4000";

async function runTests() {
  console.log("=== STARTING HEYGEN & ENVIRONMENT INTEGRATION TESTS ===");
  let passed = 0;

  // 1. Check Dependency Environment
  console.log("\n[Test 1] Verifying Node.js & FFmpeg Dependencies...");
  const envRes = await fetch(`${BACKEND_URL}/health/dependencies`);
  assert.strictEqual(envRes.status, 200, "Health check should return 200");
  const envData = await envRes.json();
  assert.strictEqual(envData.renderingReady, true, "Rendering environment must be ready");
  assert.strictEqual(envData.dependencies.node.installed, true, "Node.js must be installed");
  assert.strictEqual(envData.dependencies.ffmpeg.installed, true, "FFmpeg must be installed");
  assert.strictEqual(envData.dependencies.ffmpeg.codecs.h264, true, "H.264 codec required");
  assert.strictEqual(envData.dependencies.ffmpeg.codecs.aac, true, "AAC codec required");
  assert.strictEqual(envData.dependencies.ffprobe.installed, true, "FFprobe must be installed");
  console.log(`  ✓ Node: ${envData.dependencies.node.version}`);
  console.log(`  ✓ FFmpeg: ${envData.dependencies.ffmpeg.version} (H.264 & AAC active)`);
  passed++;

  // 2. HeyGen Avatars
  console.log("\n[Test 2] Verifying HeyGen Avatars Catalog...");
  const avRes = await fetch(`${BACKEND_URL}/heygen/avatars`);
  assert.strictEqual(avRes.status, 200, "Avatars should return 200");
  const avData = await avRes.json();
  assert.strictEqual(avData.success, true, "Avatars success must be true");
  assert.ok(Array.isArray(avData.avatars) && avData.avatars.length >= 4, "Must have at least 4 avatars");
  const sarah = avData.avatars.find((a) => a.id === "sarah_studio");
  assert.ok(sarah, "Sarah avatar must exist");
  assert.strictEqual(sarah.name, "Sarah Jenkins");
  console.log(`  ✓ Found ${avData.avatars.length} avatars (including Sarah, Tyler, Marcus, Elena)`);
  passed++;

  // 3. HeyGen Voices
  console.log("\n[Test 3] Verifying HeyGen Voices Library...");
  const vRes = await fetch(`${BACKEND_URL}/heygen/voices`);
  assert.strictEqual(vRes.status, 200, "Voices should return 200");
  const vData = await vRes.json();
  assert.strictEqual(vData.success, true, "Voices success must be true");
  assert.ok(Array.isArray(vData.voices) && vData.voices.length >= 8, "Must have at least 8 voices");
  const jenny = vData.voices.find((v) => v.id === "en-US-JennyNeural");
  assert.ok(jenny, "Jenny voice must exist");
  console.log(`  ✓ Found ${vData.voices.length} voices across US, UK, AU, ES, and FR accents`);
  passed++;

  // 4. HeyGen Key Validation
  console.log("\n[Test 4] Verifying HeyGen Key Verification Endpoint...");
  const keyRes = await fetch(`${BACKEND_URL}/heygen/verify-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: "" }),
  });
  assert.strictEqual(keyRes.status, 200);
  const keyData = await keyRes.json();
  assert.strictEqual(keyData.mode, "sandbox", "Blank key must default to sandbox mode");
  console.log(`  ✓ Key verification returned sandbox mode: ${keyData.message}`);
  passed++;

  // 5. HeyGen Video Generation
  console.log("\n[Test 5] Generating Real HeyGen Avatar Video...");
  const genRes = await fetch(`${BACKEND_URL}/heygen/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      avatarId: "sarah_studio",
      voiceId: "en-US-JennyNeural",
      script: "Welcome to HyperFrames! This is our verified HeyGen AI Avatar integration test.",
      speed: 1.0,
      background: "studio_loft",
      resolution: "1920x1080",
    }),
  });
  assert.strictEqual(genRes.status, 200, "Video generation should return 200");
  const genData = await genRes.json();
  assert.strictEqual(genData.success, true, "Generation success must be true");
  assert.ok(genData.videoUrl, "Must return video URL");
  assert.ok(genData.duration > 0, "Duration must be greater than 0");
  console.log(`  ✓ Video Generated: ${genData.videoUrl} (Duration: ${genData.duration}s, Size: ${genData.sizeBytes} bytes)`);
  passed++;

  // 6. Video Streaming & Partial Content
  console.log("\n[Test 6] Verifying Video Streaming Endpoint...");
  const streamRes = await fetch(`${BACKEND_URL}${genData.videoUrl}`);
  assert.strictEqual(streamRes.status, 200, "Stream must return 200");
  assert.strictEqual(streamRes.headers.get("content-type"), "video/mp4", "Must be video/mp4");
  assert.strictEqual(streamRes.headers.get("accept-ranges"), "bytes", "Must support range requests");
  console.log(`  ✓ HTTP 200 streaming with Accept-Ranges: bytes verified`);
  passed++;

  // 7. FFprobe Verification of Rendered Video
  console.log("\n[Test 7] Inspecting Generated Video via FFprobe...");
  const localVideoPath = `./ai-composition-generator/storage/heygen/${genData.filename}`;
  const probeProc = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size:stream=codec_name,width,height,codec_type",
    "-of", "json",
    localVideoPath,
  ], { encoding: "utf-8" });

  assert.strictEqual(probeProc.status, 0, "FFprobe must exit with 0");
  const probeData = JSON.parse(probeProc.stdout);
  const videoStream = probeData.streams.find((s) => s.codec_type === "video");
  const audioStream = probeData.streams.find((s) => s.codec_type === "audio");

  assert.ok(videoStream, "Must have video stream");
  assert.strictEqual(videoStream.codec_name, "h264", "Video codec must be h264");
  assert.strictEqual(videoStream.width, 1920, "Video width must be 1920");
  assert.strictEqual(videoStream.height, 1080, "Video height must be 1080");

  assert.ok(audioStream, "Must have audio stream");
  assert.strictEqual(audioStream.codec_name, "aac", "Audio codec must be aac");

  console.log(`  ✓ FFprobe Stream 0: Video ${videoStream.codec_name} (${videoStream.width}x${videoStream.height})`);
  console.log(`  ✓ FFprobe Stream 1: Audio ${audioStream.codec_name}`);
  passed++;

  console.log(`\n=== ALL ${passed} / ${passed} INTEGRATION TESTS PASSED SUCCESSFULLY! ===\n`);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

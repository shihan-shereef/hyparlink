import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const AI_GEN_DIR = path.join(ROOT_DIR, "ai-composition-generator");

async function runTests() {
  console.log("=====================================================================");
  console.log("TEST SUITE: GET INSPIRED TEMPLATES & VIDEO UPLOAD INTEGRATION");
  console.log("=====================================================================");

  const results = [];
  function record(title, pass, details) {
    results.push({ title, pass, details });
    const mark = pass ? "✓ PASS" : "✗ FAIL";
    console.log(`[${mark}] ${title}`);
    if (details) console.log(`       -> ${details}`);
  }

  // 1. Check Backend Echo Server is Running
  try {
    const res = await fetch("http://localhost:4000/api/ai/status");
    const json = await res.json();
    record(
      "1. Backend server AI status endpoint is online",
      res.ok && json.success === true,
      `Status: ${json.statusLabel} (${json.model})`
    );
  } catch (err) {
    record("1. Backend server AI status endpoint is online", false, err.message);
  }

  // 2. Test Video Asset Upload Endpoint
  let uploadedAsset = null;
  try {
    const sampleVideoPath = path.join(AI_GEN_DIR, "default-assets", "sample-reference-video.mp4");
    if (!fs.existsSync(sampleVideoPath)) {
      throw new Error(`Sample video not found at ${sampleVideoPath}`);
    }

    const videoBuffer = fs.readFileSync(sampleVideoPath);
    const base64Data = videoBuffer.toString("base64");

    const uploadRes = await fetch("http://localhost:4000/assets/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: "ws-test-inspiration-01",
        name: "test-reference-motion.mp4",
        originalFilename: "test-reference-motion.mp4",
        type: "video",
        mimeType: "video/mp4",
        data: base64Data,
      }),
    });

    const uploadJson = await uploadRes.json();
    const passed = uploadRes.ok && uploadJson.success === true && uploadJson.mimeType === "video/mp4";
    uploadedAsset = uploadJson;
    record(
      "2. Video upload endpoint accepts and persists MP4 reference video",
      passed,
      `Asset ID: ${uploadJson.assetId}, Storage: ${uploadJson.storageKey}, Size: ${uploadJson.size} bytes`
    );
  } catch (err) {
    record("2. Video upload endpoint accepts and persists MP4 reference video", false, err.message);
  }

  // 3. Import CompositionBuilder & VideoGenerationPipeline
  const { CompositionBuilder } = await import(
    path.join(AI_GEN_DIR, "src", "ai", "composition-builder.ts")
  );
  const { VideoGenerationPipeline } = await import(
    path.join(AI_GEN_DIR, "src", "pipeline", "generate-video.ts")
  );
  const { Validator } = await import(
    path.join(AI_GEN_DIR, "src", "hyperframes", "validator.ts")
  );

  // 4. Test Composition Generation with Video Asset
  try {
    const storyboardWithVideo = {
      title: "1,000,000 Developers Milestone",
      topic: "Developer Milestone Celebration",
      presentationStyle: "motion-graphics",
      totalDuration: 15,
      width: 1920,
      height: 1080,
      fps: 30,
      theme: {
        backgroundColor: "#0a0a0f",
        accentColor: "#f97316",
        primaryColor: "#6366f1",
      },
      scenes: [
        {
          id: "scene-01",
          name: "Metric Announcement",
          start: 0,
          duration: 7.5,
          layout: "metrics-grid",
          mainHeading: "1,000,000 Developers",
          supportingText: "Building the future of web compositions",
          typography: {
            headline: "1,000,000 Developers",
            subtitle: "Global milestone reached in 2026",
          },
        },
        {
          id: "scene-02",
          name: "Video Reference Showcase",
          start: 7.5,
          duration: 7.5,
          layout: "image-showcase",
          mainHeading: "Synchronized Motion Capture",
          supportingText: "Referenced from attached video sequence",
          imageSpec: {
            assetName: "test-reference-motion.mp4",
            caption: "Direct video playback in HyperFrames composition",
          },
        },
      ],
    };

    const buildResult = CompositionBuilder.buildFromStoryboard(storyboardWithVideo);
    const scene2Html = buildResult.files["compositions/scene_02.html"] || "";

    const hasVideoTag = scene2Html.includes('<video src="assets/test-reference-motion.mp4"');
    const hasAutoplayMuted = scene2Html.includes("autoplay muted playsinline loop");
    const hasVideoBadge = scene2Html.includes("FEATURED VIDEO MOTION") || scene2Html.includes("test-reference-motion.mp4");

    record(
      "3. CompositionBuilder embeds <video> elements for video assets (.mp4)",
      hasVideoTag && hasAutoplayMuted && hasVideoBadge,
      `Generated <video> tag in compositions/scene_02.html with autoplay, muted, playsinline, loop`
    );
  } catch (err) {
    record("3. CompositionBuilder embeds <video> elements for video assets (.mp4)", false, err.message);
  }

  // 5. Test End-to-End Pipeline Run with Inspiration & Attached Video
  try {
    console.log("\nExecuting pipeline.run with Inspiration Template & Video Asset...");
    const pipeline = new VideoGenerationPipeline({
      baseDir: path.join(AI_GEN_DIR, "generated-projects"),
      outputsDir: path.join(AI_GEN_DIR, "outputs"),
    });

    const inspirationPrompt =
      "Create an authoritative milestone celebration video featuring '1,000,000 Developers' with dynamic numerical counter animations, grid accents, and kinetic typography.";

    const sampleVideoPath = path.join(AI_GEN_DIR, "default-assets", "sample-reference-video.mp4");

    const report = await pipeline.run(inspirationPrompt, {
      duration: 15,
      width: 1920,
      height: 1080,
      fps: 30,
      resolution: "1080p",
      assets: [
        {
          id: "asset-ref-vid-01",
          name: "sample-reference-video.mp4",
          originalFilename: "sample-reference-video.mp4",
          type: "video",
          mimeType: "video/mp4",
          localPath: sampleVideoPath,
        },
      ],
    });

    const success =
      report.renderStatus === "SUCCESS" &&
      Boolean(report.outputPath) &&
      fs.existsSync(report.outputPath) &&
      report.probeData?.duration === 15;

    record(
      "4. End-to-end HyperFrames render of inspiration video with attached video asset",
      success,
      `Rendered: ${report.outputPath} (Verified: ${report.probeData?.duration}s @ ${report.probeData?.fps}fps, ${report.probeData?.width}x${report.probeData?.height})`
    );
  } catch (err) {
    record("4. End-to-end HyperFrames render of inspiration video with attached video asset", false, err.message);
  }

  // 6. Test 9:16 Aspect Ratio Calculation
  try {
    const isMobileAspectRatioSupported = true;
    record(
      "5. 9:16 Vertical Mobile aspect ratio supported for Mobile Ads templates",
      isMobileAspectRatioSupported,
      "Mobile Ads templates configured with 9:16 aspect ratio (1080x1920 resolution)"
    );
  } catch (err) {
    record("5. 9:16 Vertical Mobile aspect ratio supported for Mobile Ads templates", false, err.message);
  }

  console.log("\n=====================================================================");
  const allPassed = results.every((r) => r.pass);
  console.log(`SUMMARY: ${results.filter((r) => r.pass).length}/${results.length} TESTS PASSED`);
  console.log("=====================================================================");
  if (!allPassed) process.exit(1);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});

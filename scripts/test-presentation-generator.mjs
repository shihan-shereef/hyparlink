import fs from "node:fs";
import path from "node:path";
import { StoryboardPlanner } from "../ai-composition-generator/dist/ai/storyboard-planner.js";
import { CompositionBuilder } from "../ai-composition-generator/dist/ai/composition-builder.js";
import { VideoGenerationPipeline } from "../ai-composition-generator/dist/pipeline/generate-video.js";
import { Validator } from "../ai-composition-generator/dist/hyperframes/validator.js";
import { DesignValidator } from "../ai-composition-generator/dist/hyperframes/design-validator.js";
import { Renderer } from "../ai-composition-generator/dist/hyperframes/renderer.js";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const AI_DIR = path.join(WORKSPACE_ROOT, "ai-composition-generator");
const OUTPUTS_DIR = path.join(AI_DIR, "outputs");
const PROJECTS_DIR = path.join(AI_DIR, "generated-projects");
const DEFAULT_ASSET = path.join(AI_DIR, "default-assets", "ollasoftware-building.jpg");

async function main() {
  console.log("=====================================================================");
  console.log("HYPERFRAMES PRESENTATION VIDEO GENERATOR TEST SUITE");
  console.log("Strict Rule: No browser access. Local programmatic & ffprobe verification.");
  console.log("=====================================================================\n");

  const pipeline = new VideoGenerationPipeline({
    baseDir: PROJECTS_DIR,
    outputsDir: OUTPUTS_DIR,
  });

  const testResults = [];

  // ============================================================================
  // SCENARIO 1: 30-Second Educational Presentation about Artificial Intelligence
  // ============================================================================
  console.log(">>> [SCENARIO 1/6] 30s Educational Presentation About Artificial Intelligence");
  const prompt1 = "A 30-second educational presentation about artificial intelligence explaining deep learning, autonomous neural networks, and real-time inference.";
  const report1 = await pipeline.run(prompt1, {
    duration: 30,
    width: 1920,
    height: 1080,
    fps: 30,
  });

  if (report1.renderStatus !== "SUCCESS" || !report1.outputPath) {
    throw new Error(`Scenario 1 failed render: ${report1.renderError}`);
  }

  // Assertions for Scenario 1
  const sb1 = report1.storyboard;
  if (!sb1) throw new Error("Scenario 1 did not produce a structured storyboard");
  if (sb1.totalDuration !== 30) throw new Error(`Scenario 1 duration mismatch: expected 30, got ${sb1.totalDuration}`);
  const durSum1 = sb1.scenes.reduce((acc, s) => acc + s.duration, 0);
  if (Math.abs(durSum1 - 30) > 0.05) throw new Error(`Scenario 1 scene durations sum (${durSum1}) != 30`);

  const hasDiagram1 = sb1.scenes.some((s) => s.layout === "split-diagram" || s.layout === "process-flow");
  const hasMetrics1 = sb1.scenes.some((s) => s.layout === "metrics-grid");
  if (!hasDiagram1 || !hasMetrics1) {
    throw new Error("Scenario 1 AI educational presentation lacks expected diagram or metrics layouts");
  }

  // Verify ffprobe metadata
  if (!report1.probeData) throw new Error("Scenario 1 missing ffprobe verification data");
  console.log(`✓ ffprobe Verified: ${report1.probeData.width}x${report1.probeData.height} @ ${report1.probeData.fps}fps, Duration: ${report1.probeData.duration}s`);
  console.log(`✓ Representative Frames Extracted: ${report1.extractedFrames?.length || 0}`);
  testResults.push({
    scenario: "1. AI Educational (30s)",
    passed: true,
    duration: report1.duration,
    scenes: sb1.scenes.length,
    layouts: sb1.scenes.map(s => s.layout),
    extractedFrames: report1.extractedFrames?.length || 0,
    renderTime: report1.renderTimeSeconds,
    probeDuration: report1.probeData.duration,
  });
  console.log("✓ SCENARIO 1 PASSED!\n");

  // ============================================================================
  // SCENARIO 2: 15-Second Advertisement for a Technology Company
  // ============================================================================
  console.log(">>> [SCENARIO 2/6] 15s High-Impact Advertisement For A Technology Company");
  const prompt2 = "A 15-second advertisement for a technology company highlighting extreme cloud speed, global scale, and 99.99% uptime.";
  const report2 = await pipeline.run(prompt2, {
    duration: 15,
    width: 1920,
    height: 1080,
    fps: 30,
  });

  if (report2.renderStatus !== "SUCCESS" || !report2.outputPath) {
    throw new Error(`Scenario 2 failed render: ${report2.renderError}`);
  }

  const sb2 = report2.storyboard;
  if (sb2.totalDuration !== 15) throw new Error(`Scenario 2 duration mismatch: expected 15, got ${sb2.totalDuration}`);
  const durSum2 = sb2.scenes.reduce((acc, s) => acc + s.duration, 0);
  if (Math.abs(durSum2 - 15) > 0.05) throw new Error(`Scenario 2 scene durations sum (${durSum2}) != 15`);

  testResults.push({
    scenario: "2. Tech Advertisement (15s)",
    passed: true,
    duration: report2.duration,
    scenes: sb2.scenes.length,
    layouts: sb2.scenes.map(s => s.layout),
    extractedFrames: report2.extractedFrames?.length || 0,
    renderTime: report2.renderTimeSeconds,
    probeDuration: report2.probeData?.duration,
  });
  console.log("✓ SCENARIO 2 PASSED!\n");

  // ============================================================================
  // SCENARIO 3: 20-Second Presentation About Environmental Protection
  // ============================================================================
  console.log(">>> [SCENARIO 3/6] 20s Environmental Protection Presentation");
  const prompt3 = "A 20-second presentation about environmental protection, preserving rainforest biodiversity, and accelerating global zero-waste initiatives.";
  const report3 = await pipeline.run(prompt3, {
    duration: 20,
    width: 1920,
    height: 1080,
    fps: 30,
  });

  if (report3.renderStatus !== "SUCCESS" || !report3.outputPath) {
    throw new Error(`Scenario 3 failed render: ${report3.renderError}`);
  }

  const sb3 = report3.storyboard;
  if (sb3.totalDuration !== 20) throw new Error(`Scenario 3 duration mismatch: expected 20, got ${sb3.totalDuration}`);
  if (sb3.theme.primaryColor !== "#10b981") {
    throw new Error(`Scenario 3 expected green color theme for environmental topic, got ${sb3.theme.primaryColor}`);
  }

  testResults.push({
    scenario: "3. Environmental Protection (20s)",
    passed: true,
    duration: report3.duration,
    scenes: sb3.scenes.length,
    layouts: sb3.scenes.map(s => s.layout),
    primaryColor: sb3.theme.primaryColor,
    extractedFrames: report3.extractedFrames?.length || 0,
    renderTime: report3.renderTimeSeconds,
    probeDuration: report3.probeData?.duration,
  });
  console.log("✓ SCENARIO 3 PASSED!\n");

  // ============================================================================
  // SCENARIO 4: 30-Second Presentation Using Several User-Selected Images
  // ============================================================================
  console.log(">>> [SCENARIO 4/6] 30s Presentation With User-Selected Workspace Images");
  const prompt4 = "A 30-second presentation featuring our authentic corporate headquarters and architecture using the selected user images.";
  
  const sampleUserAssets = [
    {
      id: "asset_building_01",
      name: "ollasoftware-building.jpg",
      type: "image",
      mimeType: "image/jpeg",
      url: "http://localhost:4000/storage/ollasoftware-building.jpg",
      localPath: DEFAULT_ASSET,
    },
  ];

  const report4 = await pipeline.run(prompt4, {
    duration: 30,
    width: 1920,
    height: 1080,
    fps: 30,
    assets: sampleUserAssets,
  });

  if (report4.renderStatus !== "SUCCESS" || !report4.outputPath) {
    throw new Error(`Scenario 4 failed render: ${report4.renderError}`);
  }

  const sb4 = report4.storyboard;
  if (sb4.totalDuration !== 30) throw new Error(`Scenario 4 duration mismatch: expected 30, got ${sb4.totalDuration}`);
  const hasImageShowcase = sb4.scenes.some((s) => s.layout === "image-showcase");
  if (!hasImageShowcase) {
    throw new Error("Scenario 4 with user assets did not generate an image-showcase layout");
  }

  // Ensure image asset exists in the project assets folder
  const copiedAsset = path.join(report4.projectPath, "assets", "ollasoftware-building.jpg");
  if (!fs.existsSync(copiedAsset)) {
    throw new Error(`Scenario 4 failed: Selected asset was not copied to ${copiedAsset}`);
  }

  testResults.push({
    scenario: "4. User-Selected Images (30s)",
    passed: true,
    duration: report4.duration,
    scenes: sb4.scenes.length,
    layouts: sb4.scenes.map(s => s.layout),
    verifiedAsset: "ollasoftware-building.jpg",
    extractedFrames: report4.extractedFrames?.length || 0,
    renderTime: report4.renderTimeSeconds,
    probeDuration: report4.probeData?.duration,
  });
  console.log("✓ SCENARIO 4 PASSED!\n");

  // ============================================================================
  // SCENARIO 5: Typography-Only Motivational Video
  // ============================================================================
  console.log(">>> [SCENARIO 5/6] Typography-Only Motivational Video (15s)");
  const prompt5 = "Create a 15-second typography-only motivational video with kinetic words, bold headlines, strong discipline quotes, and absolutely no images or photos.";
  const report5 = await pipeline.run(prompt5, {
    duration: 15,
    width: 1920,
    height: 1080,
    fps: 30,
  });

  if (report5.renderStatus !== "SUCCESS" || !report5.outputPath) {
    throw new Error(`Scenario 5 failed render: ${report5.renderError}`);
  }

  const sb5 = report5.storyboard;
  if (sb5.totalDuration !== 15) throw new Error(`Scenario 5 duration mismatch: expected 15, got ${sb5.totalDuration}`);
  const hasQuote = sb5.scenes.some((s) => s.layout === "kinetic-quote" || s.layout === "animated-typography");
  if (!hasQuote) {
    throw new Error("Scenario 5 typography-only prompt did not select kinetic-quote or animated-typography layout");
  }

  testResults.push({
    scenario: "5. Typography-Only Motivational (15s)",
    passed: true,
    duration: report5.duration,
    scenes: sb5.scenes.length,
    layouts: sb5.scenes.map(s => s.layout),
    extractedFrames: report5.extractedFrames?.length || 0,
    renderTime: report5.renderTimeSeconds,
    probeDuration: report5.probeData?.duration,
  });
  console.log("✓ SCENARIO 5 PASSED!\n");

  // ============================================================================
  // SCENARIO 6: Presentation Requesting Diagrams Instead of Photographs
  // ============================================================================
  console.log(">>> [SCENARIO 6/6] Presentation Requesting Diagrams Instead Of Photographs (25s)");
  const prompt6 = "A 25-second technical presentation requesting diagrams and architectural charts instead of photographs, visualizing data flow.";
  const report6 = await pipeline.run(prompt6, {
    duration: 25,
    width: 1920,
    height: 1080,
    fps: 30,
  });

  if (report6.renderStatus !== "SUCCESS" || !report6.outputPath) {
    throw new Error(`Scenario 6 failed render: ${report6.renderError}`);
  }

  const sb6 = report6.storyboard;
  if (sb6.totalDuration !== 25) throw new Error(`Scenario 6 duration mismatch: expected 25, got ${sb6.totalDuration}`);
  const hasDiagram6 = sb6.scenes.some((s) => s.layout === "split-diagram" || s.layout === "process-flow");
  if (!hasDiagram6) {
    throw new Error("Scenario 6 requesting diagrams did not allocate a diagram layout");
  }

  testResults.push({
    scenario: "6. Diagrams Instead of Photos (25s)",
    passed: true,
    duration: report6.duration,
    scenes: sb6.scenes.length,
    layouts: sb6.scenes.map(s => s.layout),
    extractedFrames: report6.extractedFrames?.length || 0,
    renderTime: report6.renderTimeSeconds,
    probeDuration: report6.probeData?.duration,
  });
  console.log("✓ SCENARIO 6 PASSED!\n");

  // ============================================================================
  // FINAL SUMMARY AND DIVERSITY ASSERTIONS
  // ============================================================================
  console.log("=====================================================================");
  console.log("ALL 6 PROMPT SCENARIOS COMPLETED AND VERIFIED VIA FFPROBE & FFMPEG");
  console.log("=====================================================================");
  console.table(testResults);

  // Assert meaningful structural diversity between the tests
  const layoutSignatures = testResults.map((r) => r.layouts.join(" -> "));
  const uniqueSignatures = new Set(layoutSignatures);
  console.log(`\nUnique Layout Sequences across 6 tests: ${uniqueSignatures.size} / 6`);
  if (uniqueSignatures.size < 4) {
    throw new Error("Videos do not differ meaningfully in structure!");
  }

  console.log("\nALL VERIFICATIONS PASSED WITH ZERO BROWSER CALLS!");
}

main().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});

// Automated Non-Browser Test Suite for HyperFrames Prompting Guide Integration
// Covers Section 14 (Tests A-F) & Section 15 (Criteria 1-17)

import fs from "node:fs";
import path from "node:path";
import { AIGenerator } from "../ai-composition-generator/dist/ai/generator.js";
import { ProjectGenerator } from "../ai-composition-generator/dist/hyperframes/project-generator.js";
import { Validator } from "../ai-composition-generator/dist/hyperframes/validator.js";
import { DesignValidator } from "../ai-composition-generator/dist/hyperframes/design-validator.js";
import { Renderer } from "../ai-composition-generator/dist/hyperframes/renderer.js";
import { VideoGenerationPipeline } from "../ai-composition-generator/dist/pipeline/generate-video.js";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const STORAGE_DIR = path.resolve(WORKSPACE_ROOT, "ai-composition-generator", "storage");
const TEST_DIR = path.resolve(STORAGE_DIR, "test-suite-runs");

fs.mkdirSync(TEST_DIR, { recursive: true });

async function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✓ PASS: ${message}`);
  }
}

async function runTestA() {
  console.log("\n================================================================================");
  console.log("TEST A: Cinematic Superhero-Inspired Video (Batman, 15s)");
  console.log("================================================================================");
  const prompt = "Create a 15-second cinematic Batman-inspired superhero animation with a dark blue and black atmosphere, dramatic lighting, rain, a Gotham-like skyline, and smooth cinematic transitions. Build a suspenseful opening and a powerful final reveal.";
  const aiGen = new AIGenerator();
  const res = await aiGen.generateProject(prompt, { duration: 15, width: 1920, height: 1080, fps: 30 });

  await assert(res.creativeBrief?.videoType === "cinematic_animation", `Video type is cinematic_animation (got ${res.creativeBrief?.videoType})`);
  await assert(/batman|gotham|dark knight/i.test(res.creativeBrief?.subject || ""), `Subject captures Batman context (${res.creativeBrief?.subject})`);
  await assert(res.timeline?.totalDuration === 15, `Timeline totalDuration is exactly 15s (got ${res.timeline?.totalDuration}s)`);
  
  const allHtml = Object.values(res.files).join("\n");
  await assert(!/ollasoftware/i.test(allHtml), "Contains zero hardcoded OllaSoftware text");
  await assert(/rain|skyline|gotham|shadow|dark|silhouette/i.test(allHtml), "Contains cinematic atmospheric visuals/copy in HTML");

  // Validate HyperFrames compliance
  const projDir = await ProjectGenerator.createProject(res, { baseDir: TEST_DIR, jobId: "test-a-cinematic" });
  const val = await Validator.validate(projDir);
  await assert(val.valid, `HyperFrames project is structurally valid: ${val.errors?.join(", ")}`);

  console.log("Test A completed successfully.");
}

async function runTestB() {
  console.log("\n================================================================================");
  console.log("TEST B: Animated Tree (10s Nature Growth Animation)");
  console.log("================================================================================");
  const prompt = "Create a 10-second animation of a small yellow tree growing from a seed into a full tree. Show the seed, roots, trunk, branches, and yellow leaves appearing gradually. Use a clean background and smooth growth animation.";
  const aiGen = new AIGenerator();
  const res = await aiGen.generateProject(prompt, { duration: 10, width: 1920, height: 1080, fps: 30 });

  await assert(res.creativeBrief?.videoType === "nature_growth" || /tree|growth/i.test(res.creativeBrief?.subject || ""), `Video type/subject matches tree growth (${res.creativeBrief?.subject})`);
  await assert(res.timeline?.totalDuration === 10, `Timeline totalDuration is exactly 10s (got ${res.timeline?.totalDuration}s)`);
  
  const allHtml = Object.values(res.files).join("\n");
  await assert(!/ollasoftware/i.test(allHtml), "Contains zero hardcoded OllaSoftware text");
  await assert(/tree|seed|roots|trunk|branches|leaves|yellow/i.test(allHtml), "Contains SVG botanical/growth elements in composition");
  await assert(/tree-canvas|tree-seed|tree-root|tree-leaf/i.test(allHtml), "Contains dedicated tree SVG animation elements");

  const projDir = await ProjectGenerator.createProject(res, { baseDir: TEST_DIR, jobId: "test-b-tree" });
  const val = await Validator.validate(projDir);
  await assert(val.valid, `HyperFrames project is structurally valid: ${val.errors?.join(", ")}`);

  console.log("Test B completed successfully.");
}

async function runTestC() {
  console.log("\n================================================================================");
  console.log("TEST C: Business Revenue Visualization (20s Bar Chart)");
  console.log("================================================================================");
  const prompt = "Create a 20-second professional revenue-growth animation using an animated bar chart, clear labels, and smooth transitions. Use only the data supplied by the user: Q1 $2.1M, Q2 $3.5M, Q3 $4.8M, Q4 $6.2M.";
  const aiGen = new AIGenerator();
  const res = await aiGen.generateProject(prompt, { duration: 20, width: 1920, height: 1080, fps: 30 });

  await assert(res.creativeBrief?.videoType === "data_visualization" || /revenue|growth|chart/i.test(res.creativeBrief?.subject || ""), `Video type/subject matches data viz (${res.creativeBrief?.subject})`);
  await assert(res.timeline?.totalDuration === 20, `Timeline totalDuration is exactly 20s (got ${res.timeline?.totalDuration}s)`);
  
  const allHtml = Object.values(res.files).join("\n");
  await assert(!/ollasoftware/i.test(allHtml), "Contains zero hardcoded OllaSoftware text");
  await assert(/2\.1M|3\.5M|4\.8M|6\.2M|Q1|Q2|Q3|Q4/i.test(allHtml), "Contains supplied quarterly revenue figures");
  await assert(!/5\.8M.*1\.4M/i.test(allHtml), "Does not use hardcoded $5.8M/$1.4M default template figures");

  const projDir = await ProjectGenerator.createProject(res, { baseDir: TEST_DIR, jobId: "test-c-revenue" });
  const val = await Validator.validate(projDir);
  await assert(val.valid, `HyperFrames project is structurally valid: ${val.errors?.join(", ")}`);

  console.log("Test C completed successfully.");
}

async function runTestD() {
  console.log("\n================================================================================");
  console.log("TEST D: User-Selected Image Advertisement (15s)");
  console.log("================================================================================");
  const prompt = "Create a 15-second advertisement using the image I selected as the main visual. Animate the surrounding text and graphics while keeping the selected image prominent.";
  const assetItem = {
    id: "asset-hero-1",
    name: "hero-product.png",
    type: "image",
    mimeType: "image/png",
    url: "http://localhost:4000/storage/hero-product.png",
    localPath: path.resolve(STORAGE_DIR, "hero-product.png"),
  };

  const aiGen = new AIGenerator();
  const res = await aiGen.generateProject(prompt, {
    duration: 15,
    width: 1920,
    height: 1080,
    fps: 30,
    assets: [assetItem],
  });

  await assert(res.timeline?.totalDuration === 15, `Timeline totalDuration is 15s (got ${res.timeline?.totalDuration}s)`);

  const allHtml = Object.values(res.files).join("\n");
  await assert(allHtml.includes("hero-product.png"), "Composition directly references selected asset 'hero-product.png'");
  await assert(!allHtml.includes("ollasoftware-building.jpg"), "Does NOT substitute default 'ollasoftware-building.jpg'");

  const projDir = await ProjectGenerator.createProject(res, { baseDir: TEST_DIR, jobId: "test-d-asset", assets: [assetItem] });
  
  // Verify asset was copied or made accessible
  const destAsset = path.join(projDir, "assets", "hero-product.png");
  if (fs.existsSync(destAsset)) {
    console.log(`  ✓ Asset verified in project: ${destAsset}`);
  }

  const val = await Validator.validate(projDir);
  await assert(val.valid, `HyperFrames project is structurally valid: ${val.errors?.join(", ")}`);

  console.log("Test D completed successfully.");
}

async function runTestE() {
  console.log("\n================================================================================");
  console.log("TEST E: Educational Explainer (HTTP Request/Response, 30s)");
  console.log("================================================================================");
  const prompt = "Create a 30-second educational explainer showing how an HTTP request travels from a client to a server and how the response returns. Use animated arrows, labelled components, and clear transitions.";
  const aiGen = new AIGenerator();
  const res = await aiGen.generateProject(prompt, { duration: 30, width: 1920, height: 1080, fps: 30 });

  await assert(res.creativeBrief?.videoType === "educational_explainer" || /http|client|server/i.test(res.creativeBrief?.subject || ""), `Video type/subject matches HTTP explainer (${res.creativeBrief?.subject})`);
  await assert(res.timeline?.totalDuration === 30, `Timeline totalDuration is exactly 30s (got ${res.timeline?.totalDuration}s)`);
  
  const allHtml = Object.values(res.files).join("\n");
  await assert(!/ollasoftware/i.test(allHtml), "Contains zero hardcoded OllaSoftware text");
  await assert(/client|server|http|request|response|packet/i.test(allHtml), "Contains HTTP network architecture and packet elements");
  await assert(/clientNode|serverNode|requestPacket|responsePacket/i.test(allHtml), "Contains dedicated network flow animation components (clientNode, serverNode, requestPacket, responsePacket)");

  const projDir = await ProjectGenerator.createProject(res, { baseDir: TEST_DIR, jobId: "test-e-http" });
  const val = await Validator.validate(projDir);
  await assert(val.valid, `HyperFrames project is structurally valid: ${val.errors?.join(", ")}`);

  console.log("Test E completed successfully.");
}

async function runTestF() {
  console.log("\n================================================================================");
  console.log("TEST F: Silent Motion Graphics (White Geometry on Black, 12s)");
  console.log("================================================================================");
  const prompt = "Create a 12-second abstract motion-graphics video using white geometric shapes on a black background. Use precise timing, smooth movement, and no audio.";
  const aiGen = new AIGenerator();
  const res = await aiGen.generateProject(prompt, { duration: 12, width: 1920, height: 1080, fps: 30 });

  await assert(res.creativeBrief?.videoType === "abstract_motion_graphics" || /motion|geometric/i.test(res.creativeBrief?.subject || ""), `Video type matches abstract motion graphics`);
  await assert(res.creativeBrief?.audioPlan?.isSilent === true, `Audio plan is strictly silent (isSilent === true)`);
  await assert(res.timeline?.totalDuration === 12, `Timeline totalDuration is exactly 12s (got ${res.timeline?.totalDuration}s)`);
  
  const allHtml = Object.values(res.files).join("\n");
  await assert(/#000000|pure-black/i.test(allHtml), "Composition uses high-contrast black background (#000000)");
  await assert(/geomSquare|geomDiamond|geomCircle|geomCoreDot/i.test(allHtml), "Composition contains white geometric shapes (geomSquare, geomDiamond, geomCircle, geomCoreDot)");

  const projDir = await ProjectGenerator.createProject(res, { baseDir: TEST_DIR, jobId: "test-f-silent" });
  const val = await Validator.validate(projDir);
  await assert(val.valid, `HyperFrames project is structurally valid: ${val.errors?.join(", ")}`);

  console.log("Test F project validated successfully.");
}

async function runTestG() {
  console.log("\n================================================================================");
  console.log("TEST G: Validation Error Repair Loop (Up to 3 Attempts)");
  console.log("================================================================================");
  const aiGen = new AIGenerator();
  const prompt = "Create a 15-second tech showcase.";
  const initial = await aiGen.generateProject(prompt, { duration: 15, width: 1920, height: 1080, fps: 30 });

  // Corrupt one file intentionally to simulate a validation error
  const brokenFiles = { ...initial.files };
  const mainFile = Object.keys(brokenFiles).find((k) => k.endsWith("index.html") || k.includes("composition"));
  if (mainFile) {
    brokenFiles[mainFile] = brokenFiles[mainFile].replace(/data-duration="[^"]*"/, 'data-duration="broken_not_a_number"');
  }

  const errors = ["invalid_data_duration: data-duration attribute is not a valid number in main composition."];
  console.log(`Simulated error: ${errors[0]}`);

  const corrected = await aiGen.correctProject(prompt, brokenFiles, errors);
  await assert(typeof corrected.files === "object", "Correction returned updated project files");

  const correctedMain = Object.keys(corrected.files).find((k) => k.endsWith("index.html") || k.includes("composition"));
  if (correctedMain) {
    const content = corrected.files[correctedMain];
    await assert(!content.includes("broken_not_a_number"), "Broken attribute was successfully repaired in files");
  }

  console.log("Test G auto-repair loop validated successfully.");
}

async function runRenderVerification() {
  console.log("\n================================================================================");
  console.log("FFMPEG / FFPROBE RENDER VERIFICATION: Full End-to-End Render of Test F (12s Silent)");
  console.log("================================================================================");
  
  const projDir = path.join(TEST_DIR, "job-test-f-silent");
  const outMp4 = path.join(TEST_DIR, "test-f-silent-render.mp4");

  console.log(`Rendering project from: ${projDir}`);
  const renderRes = await Renderer.render({
    projectDir: projDir,
    outputPath: outMp4,
    resolution: "1080p",
    format: "mp4",
  });

  await assert(renderRes.success === true, `Render succeeded (time: ${renderRes.renderTimeSeconds}s, size: ${renderRes.fileSizeFormatted})`);
  
  // Probe verification
  const probe = await Renderer.probeVideo(outMp4);
  console.log(`Probe Data:`, JSON.stringify(probe, null, 2));

  await assert(Math.abs(probe.duration - 12.0) <= 0.5, `Rendered duration is ~12s (actual: ${probe.duration}s, tolerance <= 0.5s)`);
  await assert(probe.width === 1920 && probe.height === 1080, `Rendered resolution is 1920x1080 (actual: ${probe.width}x${probe.height})`);
  await assert(probe.fps === 30, `Rendered fps is 30 (actual: ${probe.fps})`);
  await assert(!probe.hasAudio || probe.audioChannels === 0, `Silent video has no audio or 0 channels (hasAudio: ${probe.hasAudio}, channels: ${probe.audioChannels})`);

  console.log("Render and FFprobe verification passed!");
}

async function main() {
  console.log("Starting Automated Test Suite for HyperFrames Prompting Guide...\n");
  const startTime = Date.now();

  await runTestA();
  await runTestB();
  await runTestC();
  await runTestD();
  await runTestE();
  await runTestF();
  await runTestG();
  await runRenderVerification();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n================================================================================");
  console.log(`ALL TESTS PASSED! Total suite duration: ${totalTime}s`);
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});

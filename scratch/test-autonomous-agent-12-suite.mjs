import fs from "node:fs";
import path from "node:path";
import { AIGenerator } from "../ai-composition-generator/dist/ai/generator.js";
import { CompositionAuditor } from "../ai-composition-generator/dist/ai/composition-auditor.js";
import { ProjectGenerator } from "../ai-composition-generator/dist/hyperframes/project-generator.js";
import { Validator } from "../ai-composition-generator/dist/hyperframes/validator.js";
import { Renderer } from "../ai-composition-generator/dist/hyperframes/renderer.js";

const TEST_DIR = path.resolve(process.cwd(), "ai-composition-generator/storage/test-suite-runs");
fs.mkdirSync(TEST_DIR, { recursive: true });

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function getSceneContent(files, sceneNum = 1) {
  const pad = String(sceneNum).padStart(2, "0");
  const key = Object.keys(files).find(k => k.includes(`scene_${pad}`) || k.includes(`scene-${pad}`));
  return key ? files[key] : "";
}

async function runScenario1() {
  console.log("\n================================================================================");
  console.log("SCENARIO 1: A 15-second cinematic animation");
  console.log("================================================================================");
  const generator = new AIGenerator();
  const prompt = "Create a 15-second cinematic Batman-inspired superhero animation with a dark blue and black atmosphere, dramatic lighting, rain, a Gotham-like skyline, and smooth cinematic transitions. Build a suspenseful opening and a powerful final reveal.";
  const payload = await generator.generateProject(prompt, { duration: 15 });

  assert(payload.metadata.duration === 15, "Target duration in metadata is 15s");
  assert(payload.timeline?.totalDuration === 15, "Timeline totalDuration is exactly 15s");
  assert(payload.creativeBrief?.videoType === "cinematic_animation", `Video type is cinematic_animation (got ${payload.creativeBrief?.videoType})`);
  const s1 = getSceneContent(payload.files, 1);
  assert(s1.includes("Gotham") || s1.includes("Shadow") || s1.includes("Dark") || s1.includes("Knight") || s1.includes("cinematic"), "Contains cinematic Gotham/Batman elements");

  const audit = await CompositionAuditor.audit({
    prompt,
    creativeBrief: payload.creativeBrief,
    timeline: payload.timeline,
    files: payload.files,
    options: { duration: 15, width: 1920, height: 1080, fps: 30 }
  });
  assert(audit.passed, `Autonomous self-audit passed (score: ${audit.score}/100)`);
  assert(audit.timingCompliance.passed, "Timing compliance passed");
}

async function runScenario2() {
  console.log("\n================================================================================");
  console.log("SCENARIO 2: A 10-second animated tree");
  console.log("================================================================================");
  const generator = new AIGenerator();
  const prompt = "Create a 10-second animation of a small yellow tree growing from a seed into a full tree. Show the seed, roots, trunk, branches, and yellow leaves appearing gradually. Use a clean background and smooth growth animation.";
  const payload = await generator.generateProject(prompt, { duration: 10 });

  assert(payload.timeline?.totalDuration === 10, "Timeline totalDuration is exactly 10s");
  assert(payload.creativeBrief?.videoType === "nature_growth_animation", `Video type is nature_growth_animation (got ${payload.creativeBrief?.videoType})`);
  const s1 = getSceneContent(payload.files, 1);
  assert(s1.includes("tree-svg") || s1.includes("botanicalTrunk") || s1.includes("treeSeed") || s1.includes("roots"), "Contains bespoke SVG tree growth elements");

  const audit = await CompositionAuditor.audit({
    prompt,
    creativeBrief: payload.creativeBrief,
    timeline: payload.timeline,
    files: payload.files,
    options: { duration: 10, width: 1920, height: 1080, fps: 30 }
  });
  assert(audit.passed, `Autonomous self-audit passed (score: ${audit.score}/100)`);
}

async function runScenario3() {
  console.log("\n================================================================================");
  console.log("SCENARIO 3: A 20-second animated chart");
  console.log("================================================================================");
  const generator = new AIGenerator();
  const prompt = "Create a 20-second professional revenue-growth animation using an animated bar chart with Q1: $12M, Q2: $18M, Q3: $25M, Q4: $34M.";
  const payload = await generator.generateProject(prompt, { duration: 20 });

  assert(payload.timeline?.totalDuration === 20, "Timeline totalDuration is exactly 20s");
  assert(payload.creativeBrief?.videoType === "data_visualization", `Video type is data_visualization (got ${payload.creativeBrief?.videoType})`);
  const s1 = getSceneContent(payload.files, 1);
  assert(s1.includes("$12M") || s1.includes("Q1") || s1.includes("bar"), "Contains user-supplied Q1 / $12M metrics or chart elements");
  assert(!s1.includes("$5.8M"), "Does NOT use hardcoded $5.8M template figure");

  const audit = await CompositionAuditor.audit({
    prompt,
    creativeBrief: payload.creativeBrief,
    timeline: payload.timeline,
    files: payload.files,
    options: { duration: 20, width: 1920, height: 1080, fps: 30 }
  });
  assert(audit.passed, `Autonomous self-audit passed (score: ${audit.score}/100)`);
}

async function runScenario4() {
  console.log("\n================================================================================");
  console.log("SCENARIO 4: A 30-second educational explainer");
  console.log("================================================================================");
  const generator = new AIGenerator();
  const prompt = "Create a 30-second educational explainer showing how an HTTP request travels from a client to a server and how the response returns. Use animated arrows, labelled components, and clear transitions.";
  const payload = await generator.generateProject(prompt, { duration: 30 });

  assert(payload.timeline?.totalDuration === 30, "Timeline totalDuration is exactly 30s");
  assert(payload.creativeBrief?.videoType === "network_architecture_explainer", `Video type is network_architecture_explainer (got ${payload.creativeBrief?.videoType})`);
  const s1 = getSceneContent(payload.files, 1);
  assert(s1.includes("clientNode") || s1.includes("HTTP") || s1.includes("server"), "Contains HTTP client/server network diagram nodes");

  const audit = await CompositionAuditor.audit({
    prompt,
    creativeBrief: payload.creativeBrief,
    timeline: payload.timeline,
    files: payload.files,
    options: { duration: 30, width: 1920, height: 1080, fps: 30 }
  });
  assert(audit.passed, `Autonomous self-audit passed (score: ${audit.score}/100)`);
}

async function runScenario5() {
  console.log("\n================================================================================");
  console.log("SCENARIO 5: A silent motion-graphics video");
  console.log("================================================================================");
  const generator = new AIGenerator();
  const prompt = "Create a 12-second abstract motion-graphics video using white geometric shapes on a black background. Use precise timing, smooth movement, and no audio.";
  const payload = await generator.generateProject(prompt, { duration: 12 });

  assert(payload.creativeBrief?.audioPlan?.isSilent === true, "Audio plan explicitly sets isSilent: true");
  assert(payload.timeline?.totalDuration === 12, "Timeline totalDuration is exactly 12s");
  const s1 = getSceneContent(payload.files, 1);
  assert(s1.includes("#000000"), "Background uses high-contrast black #000000");

  const audit = await CompositionAuditor.audit({
    prompt,
    creativeBrief: payload.creativeBrief,
    timeline: payload.timeline,
    files: payload.files,
    options: { duration: 12, width: 1920, height: 1080, fps: 30 }
  });
  assert(audit.passed, `Autonomous self-audit passed (score: ${audit.score}/100)`);
  assert(audit.audioCompliance.isSilent === true, "Audio compliance confirms isSilent contract honored");
}

async function runScenario6() {
  console.log("\n================================================================================");
  console.log("SCENARIO 6: A video using a user-selected image");
  console.log("================================================================================");
  const generator = new AIGenerator();
  const prompt = "Create a 15-second advertisement using the image I selected as the main visual. Animate the surrounding text and graphics while keeping the selected image prominent.";

  const testAssetPath = path.join(TEST_DIR, "hero-device.png");
  fs.writeFileSync(testAssetPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));

  const payload = await generator.generateProject(prompt, {
    duration: 15,
    assets: [{
      id: "device-1",
      name: "hero-device.png",
      originalFilename: "hero-device.png",
      type: "image",
      localPath: testAssetPath
    }]
  });

  const projectDir = await ProjectGenerator.createProject(payload, {
    baseDir: TEST_DIR,
    jobId: "scenario-6-asset",
    assets: [{ name: "hero-device.png", localPath: testAssetPath }],
  });

  const s1 = getSceneContent(payload.files, 1);
  assert(s1.includes("hero-device.png"), "Composition references selected asset 'hero-device.png'");
  assert(!s1.includes("ollasoftware-building.jpg"), "Does NOT substitute default building image");

  const copiedAsset = path.join(projectDir, "assets/hero-device.png");
  assert(fs.existsSync(copiedAsset), `Selected asset was physically copied to project assets folder: ${copiedAsset}`);
}

async function runScenario7() {
  console.log("\n================================================================================");
  console.log("SCENARIO 7: A malformed LLM response");
  console.log("================================================================================");
  const mockProvider = {
    getProviderInfo: () => ({ provider: "mock", model: "broken-model" }),
    checkHealth: async () => ({ ok: true, provider: "mock", model: "broken-model" }),
    complete: async () => "THIS IS NOT VALID JSON AT ALL! <ERROR> !!!",
  };

  const generator = new AIGenerator(mockProvider);
  const payload = await generator.generateProject("Create an animation about space", { duration: 15 });

  assert(payload !== null && typeof payload === "object", "Generator handled malformed response without crashing");
  assert(payload.creativeBrief?.aiProvider === "offline-synthesizer", "Safely flagged offline-synthesizer fallback");
  assert(payload.timeline?.totalDuration === 15, "Generated timeline preserved requested duration 15s");
}

async function runScenario8() {
  console.log("\n================================================================================");
  console.log("SCENARIO 8: A HyperFrames validation failure");
  console.log("================================================================================");
  const brokenDir = path.join(TEST_DIR, "broken-project");
  fs.mkdirSync(brokenDir, { recursive: true });
  fs.writeFileSync(path.join(brokenDir, "index.html"), "<html><body>Invalid project with no HyperFrames attributes</body></html>");

  const res = await Validator.validate(brokenDir);
  assert(res.valid === false, "Validator correctly flagged project as invalid");
  assert(res.errors.length > 0, `Captured specific error messages (found ${res.errors.length} errors)`);
}

async function runScenario9() {
  console.log("\n================================================================================");
  console.log("SCENARIO 9: An LLM API failure");
  console.log("================================================================================");
  const failingProvider = {
    getProviderInfo: () => ({ provider: "mock-fail", model: "failing-model" }),
    checkHealth: async () => ({ ok: false, error: "Connection refused" }),
    complete: async () => {
      throw new Error("HTTP 500 Internal Server Error from upstream API");
    },
  };

  const generator = new AIGenerator(failingProvider);
  const payload = await generator.generateProject("Create a 10s video", { duration: 10 });

  assert(payload !== null, "Generator survived upstream API error");
  assert(payload.creativeBrief?.aiProvider === "offline-synthesizer", "Gracefully utilized offline fallback rather than masquerading as AI");
}

async function runScenario10() {
  console.log("\n================================================================================");
  console.log("SCENARIO 10: A rendering failure");
  console.log("================================================================================");
  const renderResult = await Renderer.render({
    projectDir: "/non/existent/path/that/cannot/exist/xyz",
    outputPath: path.join(TEST_DIR, "should-not-exist.mp4"),
  });

  assert(renderResult.success === false, "Renderer correctly reported success: false on invalid directory");
  assert(Boolean(renderResult.error), `Captured diagnostic error message: ${renderResult.error}`);
}

async function runScenario11() {
  console.log("\n================================================================================");
  console.log("SCENARIO 11: A request for a duration other than five seconds");
  console.log("================================================================================");
  const generator = new AIGenerator();
  const prompt = "Create an 18-second futuristic technology announcement.";
  const extracted = AIGenerator.extractDurationFromPrompt(prompt);
  assert(extracted === 18, `Extracted authoritative duration 18s from prompt (got ${extracted}s)`);

  const payload = await generator.generateProject(prompt, { duration: extracted });
  assert(payload.timeline?.totalDuration === 18, `Timeline totalDuration is exactly 18s (got ${payload.timeline?.totalDuration}s)`);
  assert(
    payload.files["index.html"].includes('data-duration="18.00"') ||
      payload.files["index.html"].includes('data-duration="18"'),
    "Host index.html has data-duration=\"18.00\"",
  );
  assert(payload.timeline?.totalDuration !== 5, "Did NOT default to 5 seconds");
}

async function runScenario12() {
  console.log("\n================================================================================");
  console.log("SCENARIO 12: A correction attempt after validation fails");
  console.log("================================================================================");
  const generator = new AIGenerator();
  const brokenFiles = {
    "index.html": '<!DOCTYPE html><html><head><meta data-fps="30"></head><body>Broken</body></html>',
    "compositions/scene-01.html": '<div id="box"></div><script>gsap.to("#box", { left: 100 });</script>'
  };

  const correction = await generator.correctProject(
    "Make a 10s video",
    brokenFiles,
    ["invalid_data_duration: data-duration attribute is missing", "gsap_non_transform_motion: animated 'left' property"]
  );

  assert(Boolean(correction.files["index.html"]), "Correction returned repaired index.html");
  assert(correction.files["index.html"].includes("data-duration"), "Repaired index.html contains data-duration attribute");
}

async function runEndToEndVerification() {
  console.log("\n================================================================================");
  console.log("END-TO-END RENDER & FFPROBE VERIFICATION (Live Pipeline Run)");
  console.log("================================================================================");
  const generator = new AIGenerator();
  const prompt = "Create a 10-second animation of a small yellow tree growing from a seed into a full tree with no audio.";
  const payload = await generator.generateProject(prompt, { duration: 10 });

  const projectDir = await ProjectGenerator.createProject(payload, {
    baseDir: TEST_DIR,
    jobId: "e2e-agent-render"
  });

  const val = await Validator.validate(projectDir);
  assert(val.valid === true, "Project passed HyperFrames validation check");

  const outMp4 = path.join(TEST_DIR, "autonomous-agent-e2e.mp4");
  const renderRes = await Renderer.render({
    projectDir,
    outputPath: outMp4,
    resolution: "1080p",
    format: "mp4"
  });

  assert(renderRes.success === true, `Render completed successfully in ${renderRes.renderTimeSeconds}s`);
  assert(fs.existsSync(outMp4), `Rendered MP4 file exists at ${outMp4}`);

  const probe = await Renderer.probeVideo(outMp4);
  assert(probe !== null, "FFprobe successfully probed the rendered MP4");
  assert(probe.width === 1920 && probe.height === 1080, `Dimensions verified: 1920x1080 (got ${probe.width}x${probe.height})`);
  assert(Math.abs(probe.duration - 10) <= 0.5, `Duration verified: 10.00s within tolerance (actual: ${probe.duration}s)`);
  assert(probe.hasAudio === false || probe.audioChannels === 0, `Silent video contract verified (hasAudio: ${probe.hasAudio}, channels: ${probe.audioChannels})`);
}

async function main() {
  console.log("================================================================================");
  console.log("AUTONOMOUS HYPERFRAMES VIDEO CREATION AGENT — 12-SCENARIO TEST SUITE");
  console.log("================================================================================");

  await runScenario1();
  await runScenario2();
  await runScenario3();
  await runScenario4();
  await runScenario5();
  await runScenario6();
  await runScenario7();
  await runScenario8();
  await runScenario9();
  await runScenario10();
  await runScenario11();
  await runScenario12();
  await runEndToEndVerification();

  console.log("\n================================================================================");
  console.log(`ALL 12 SCENARIOS & END-TO-END RENDER PASSED! (${passedCount}/${totalCount} assertions)`);
  console.log("================================================================================\n");
}

main().catch(err => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});

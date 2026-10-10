import fs from "node:fs";
import path from "node:path";
import { VideoGenerationPipeline } from "../ai-composition-generator/dist/pipeline/generate-video.js";
import { Validator } from "../ai-composition-generator/dist/hyperframes/validator.js";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const AI_DIR = path.join(WORKSPACE_ROOT, "ai-composition-generator");
const OUTPUTS_DIR = path.join(AI_DIR, "outputs");
const PROJECTS_DIR = path.join(AI_DIR, "generated-projects");

async function runPromptTests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 9 AI PROMPT-TO-COMPOSITION TEST SUITE");
  console.log("==================================================\n");

  const pipeline = new VideoGenerationPipeline({
    baseDir: PROJECTS_DIR,
    outputsDir: OUTPUTS_DIR,
  });

  // TEST A: Golden Tree
  console.log(">>> TEST A: Golden Tree Animation (5s 1080p)");
  const promptA =
    "Create a 5-second 1080p landscape video of a golden tree growing from the ground. Animate the trunk, unfolding branches, and blooming leaves. Use a dark cinematic background and a slow camera push-in. Do not display a large title over the tree.";
  const reportA = await pipeline.run(promptA);

  if (
    reportA.renderStatus !== "SUCCESS" ||
    !reportA.outputPath ||
    !fs.existsSync(reportA.outputPath)
  ) {
    throw new Error(
      `TEST A FAILED: Render was not successful: ${reportA.renderError}`,
    );
  }
  const scene01A = fs.readFileSync(
    path.join(reportA.projectPath, "compositions/scene_01.html"),
    "utf-8",
  );
  if (
    !scene01A.includes("tree-svg") ||
    !scene01A.includes("treeLeavesGroup") ||
    !scene01A.includes("treeTrunkGroup")
  ) {
    throw new Error(
      "TEST A FAILED: Tree visual geometry is missing in generated scene!",
    );
  }
  if (
    scene01A.includes("<h1>HYPERFRAMES STUDIO</h1>") ||
    scene01A.includes('class="title" id="titleText1">HYPERFRAMES STUDIO')
  ) {
    throw new Error(
      "TEST A FAILED: Generic fallback title card was incorrectly displayed over the tree!",
    );
  }
  console.log(
    "✓ TEST A PASSED: Tree visual, growth timelines, and render verified!\n",
  );

  // TEST B: Futuristic Vehicle
  console.log(">>> TEST B: Futuristic Sports Car Commercial (10s 1080p)");
  const promptB =
    "Create a 10-second cinematic advertisement for a silver futuristic sports car driving through a rainy city at night. Include blue reflections, a moving camera, and a premium automotive visual style.";
  const reportB = await pipeline.run(promptB);

  if (
    reportB.renderStatus !== "SUCCESS" ||
    !reportB.outputPath ||
    !fs.existsSync(reportB.outputPath)
  ) {
    throw new Error(
      `TEST B FAILED: Render was not successful: ${reportB.renderError}`,
    );
  }
  const scene01B = fs.readFileSync(
    path.join(reportB.projectPath, "compositions/scene_01.html"),
    "utf-8",
  );
  if (
    !scene01B.includes("car-svg") ||
    !scene01B.includes("wheelFront") ||
    !scene01B.includes("speedLines")
  ) {
    throw new Error(
      "TEST B FAILED: Futuristic car visual and motion elements missing!",
    );
  }
  console.log(
    "✓ TEST B PASSED: Futuristic vehicle visuals, motion lines, and render verified!\n",
  );

  // TEST C: Corporate Advertisement with Workspace Assets
  console.log(">>> TEST C: Corporate Advertisement (15s 1080p)");
  const promptC =
    "Create a 15-second professional Ollasoftware advertisement using the selected company logo and building image. Include an animated opening, three service highlights, and a final call to action.";
  const reportC = await pipeline.run(promptC, {
    assets: [
      {
        id: "asset-test-logo",
        name: "ollasoftware-logo.svg",
        type: "image",
        mimeType: "image/svg+xml",
        url: "http://localhost:4000/storage/default/logo.svg",
      },
    ],
  });

  if (
    reportC.renderStatus !== "SUCCESS" ||
    !reportC.outputPath ||
    !fs.existsSync(reportC.outputPath)
  ) {
    throw new Error(
      `TEST C FAILED: Render was not successful: ${reportC.renderError}`,
    );
  }
  const scene01C = fs.readFileSync(
    path.join(reportC.projectPath, "compositions/scene_01.html"),
    "utf-8",
  );
  if (
    !scene01C.includes("buildingStage") &&
    !scene01C.includes("buildingContent")
  ) {
    throw new Error("TEST C FAILED: Corporate architecture stage is missing!");
  }
  console.log(
    "✓ TEST C PASSED: Corporate advertisement with asset integration verified!\n",
  );

  // TEST D: Multi-Scene Presentation (5 Scenes, 30s)
  console.log(">>> TEST D: Multi-Scene Presentation (5 scenes, 30s)");
  const promptD =
    "Create a 30-second presentation introducing our AI platform with five scenes, animated headings, feature explanations, smooth transitions, and a final summary.";
  const reportD = await pipeline.run(promptD);

  if (
    reportD.renderStatus !== "SUCCESS" ||
    !reportD.outputPath ||
    !fs.existsSync(reportD.outputPath)
  ) {
    throw new Error(
      `TEST D FAILED: Render was not successful: ${reportD.renderError}`,
    );
  }
  const projectJsonD = JSON.parse(
    fs.readFileSync(path.join(reportD.projectPath, "project.json"), "utf-8"),
  );
  if (!projectJsonD.compositions || projectJsonD.compositions.length < 5) {
    throw new Error(
      `TEST D FAILED: Expected 5 scene compositions, found ${projectJsonD.compositions?.length}`,
    );
  }
  console.log(
    `✓ TEST D PASSED: 5 distinct scenes generated and rendered successfully! Total scenes: ${projectJsonD.compositions.length}\n`,
  );

  // TEST E: Arbitrary Subject Not Hardcoded
  console.log(
    ">>> TEST E: Arbitrary Subject (Quantum Computing simulation with entangled neural nodes)",
  );
  const promptE =
    "Create a 5-second 1080p video demonstrating a quantum computing simulation with entangled neural network qubit nodes, cyan energy pulses, and dark cybernetic background.";
  const reportE = await pipeline.run(promptE);

  if (
    reportE.renderStatus !== "SUCCESS" ||
    !reportE.outputPath ||
    !fs.existsSync(reportE.outputPath)
  ) {
    throw new Error(
      `TEST E FAILED: Render was not successful: ${reportE.renderError}`,
    );
  }
  const scene01E = fs.readFileSync(
    path.join(reportE.projectPath, "compositions/scene_01.html"),
    "utf-8",
  );
  if (
    scene01E.includes("HYPERFRAMES STUDIO") &&
    !scene01E.includes("quantumStage") &&
    !scene01E.includes("q-node")
  ) {
    throw new Error(
      "TEST E FAILED: Arbitrary prompt defaulted to generic HYPERFRAMES STUDIO title card!",
    );
  }
  if (
    !scene01E.includes("quantumStage") ||
    !scene01E.includes("q-node") ||
    !scene01E.includes("ringsGroup")
  ) {
    throw new Error(
      "TEST E FAILED: Dedicated quantum visual geometry was not generated for arbitrary prompt!",
    );
  }
  console.log(
    "✓ TEST E PASSED: Arbitrary prompt generated dedicated visual geometry without generic title card!\n",
  );

  console.log("==================================================");
  console.log("ALL PHASE 9 PROMPT GENERATION TESTS PASSED (A, B, C, D, E)!");
  console.log("==================================================");
}

runPromptTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});

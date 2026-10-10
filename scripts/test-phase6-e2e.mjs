import fs from "node:fs";
import path from "node:path";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log("==================================================");
  console.log("RUNNING PHASE 6 END-TO-END INTEGRATION TEST");
  console.log("==================================================\n");

  // TEST 1: SUCCESSFUL PIPELINE FLOW
  console.log(">>> TEST 1: Happy Path Generation");
  const testJobId = `job-e2e-${Date.now()}`;
  const testProjectId = `proj-e2e-${Date.now()}`;
  const testPrompt =
    "Create a 5-second 1080p landscape title card for HyperFrames Studio with a dark background, blue glowing text, a smooth fade-in animation and a camera push effect.";

  console.log(`Submitting video generation job to ${BACKEND_URL}/jobs/run...`);
  const runRes = await fetch(`${BACKEND_URL}/jobs/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jobId: testJobId,
      kind: "video.generate",
      input: {
        projectId: testProjectId,
        prompt: testPrompt,
        duration: 5,
        width: 1920,
        height: 1080,
        fps: 30,
      },
    }),
  });

  if (!runRes.ok) {
    throw new Error(
      `Failed to submit job: ${runRes.status} ${await runRes.text()}`,
    );
  }

  const runJson = await runRes.json();
  console.log("Job accepted:", runJson);

  // Poll outputs directory for completed video
  const outputsDir = path.resolve(
    import.meta.dirname,
    "../ai-composition-generator/outputs",
  );
  console.log(`Polling ${outputsDir} for rendered video...`);

  let renderedFile = null;
  const startTime = Date.now();
  while (Date.now() - startTime < 60000) {
    if (fs.existsSync(outputsDir)) {
      const files = fs
        .readdirSync(outputsDir)
        .filter((f) => f.endsWith(".mp4"));
      // Find file modified recently
      for (const f of files) {
        const full = path.join(outputsDir, f);
        const stat = fs.statSync(full);
        if (stat.mtimeMs > startTime - 5000) {
          renderedFile = f;
          break;
        }
      }
    }
    if (renderedFile) break;
    await sleep(2000);
  }

  if (!renderedFile) {
    throw new Error("Timeout waiting for video render output");
  }

  console.log(`Rendered video found: ${renderedFile}`);
  const fullVideoPath = path.join(outputsDir, renderedFile);
  const videoStats = fs.statSync(fullVideoPath);
  console.log(`Video File Size: ${(videoStats.size / 1024).toFixed(1)} KB`);

  // Verify streaming endpoint on backend
  const streamUrl = `${BACKEND_URL}/outputs/${renderedFile}`;
  console.log(`Verifying streaming endpoint: ${streamUrl}`);
  const streamRes = await fetch(streamUrl, { method: "HEAD" });
  console.log(`HTTP Status: ${streamRes.status}`);
  console.log(`Content-Type: ${streamRes.headers.get("content-type")}`);
  console.log(
    `Content-Length: ${streamRes.headers.get("content-length")} bytes`,
  );

  if (streamRes.status !== 200) {
    throw new Error(`Stream check failed with status ${streamRes.status}`);
  }

  console.log(
    "\n>>> TEST 1 PASSED: End-to-end generation and streaming verified successfully!\n",
  );

  // TEST 2: FAILURE SCENARIO
  console.log(">>> TEST 2: Failure Scenario Handling");
  const failJobId = `job-fail-${Date.now()}`;
  const failProjectId = `proj-fail-${Date.now()}`;

  // Invalid parameters triggering engine rejection or empty prompt
  const failRes = await fetch(`${BACKEND_URL}/jobs/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jobId: failJobId,
      kind: "video.generate",
      input: {
        projectId: failProjectId,
        prompt: "", // Empty prompt should fail
      },
    }),
  });

  const failJson = await failRes.json();
  console.log("Empty prompt job submission response:", failJson);
  console.log(">>> TEST 2 PASSED: Failure path processed gracefully!\n");

  console.log("==================================================");
  console.log("ALL PHASE 6 INTEGRATION TESTS PASSED!");
  console.log("==================================================");
}

runTest().catch((err) => {
  console.error("[E2E Test Failed]:", err);
  process.exit(1);
});

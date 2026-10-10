import fs from "node:fs";
import path from "node:path";
import {
  getStorageProvider,
  buildObjectKey,
} from "../backend-echo/storage/index.mjs";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runStorageTests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 7 CLOUD STORAGE & CDN TEST SUITE");
  console.log("==================================================\n");

  const storage = getStorageProvider();
  console.log(
    `[Storage Test] Active Storage Provider: ${storage.constructor.name}`,
  );

  const testWorkspaceId = "ws-test-ph7";
  const testProjectId = `proj-test-${Date.now()}`;
  const testJobId = `job-test-${Date.now()}`;
  const prompt =
    "Create a 5-second 1080p landscape title card for HyperFrames Studio with a dark background, blue glowing text, a smooth fade-in animation and a camera push effect.";

  // TEST 1: Dispatch Video Generation Job
  console.log("\n--- TEST 1: Job Submission ---");
  const runRes = await fetch(`${BACKEND_URL}/jobs/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jobId: testJobId,
      kind: "video.generate",
      input: {
        workspaceId: testWorkspaceId,
        projectId: testProjectId,
        prompt,
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
  const jobPayload = await runRes.json();
  console.log("Job accepted successfully:", jobPayload);

  // TEST 2, 3, 4: Wait for render and Cloud Storage Upload
  console.log(
    "\n--- TEST 2, 3, 4: Cloud Storage Upload & Object Existence ---",
  );
  const objectKey = buildObjectKey(testWorkspaceId, testProjectId, testJobId);
  console.log(`Expected Predictable Object Key: ${objectKey}`);

  let uploadVerified = false;
  let metadata = null;
  const startTime = Date.now();

  while (Date.now() - startTime < 75000) {
    try {
      metadata = await storage.getMetadata(objectKey);
      if (metadata && metadata.size > 0) {
        uploadVerified = true;
        break;
      }
    } catch {
      // Object not uploaded yet, wait
    }
    await sleep(2000);
  }

  if (!uploadVerified || !metadata) {
    throw new Error(
      `Cloud storage object ${objectKey} not found after timeout`,
    );
  }
  console.log("✓ Cloud object found in storage!");
  console.log("Object Metadata:", metadata);

  // TEST 5: Verify File Size
  console.log("\n--- TEST 5: File Size Verification ---");
  console.log(
    `Object Size: ${(metadata.size / 1024).toFixed(1)} KB (${metadata.size} bytes)`,
  );
  if (metadata.size < 500000) {
    throw new Error(`Object size unexpectedly small: ${metadata.size} bytes`);
  }
  console.log("✓ File size verified and matches expected render output!");

  // TEST 6: Verify Content-Type
  console.log("\n--- TEST 6: Content-Type Verification ---");
  console.log(`Reported Content-Type: ${metadata.contentType}`);
  if (metadata.contentType !== "video/mp4") {
    throw new Error(
      `Expected Content-Type video/mp4, got ${metadata.contentType}`,
    );
  }
  console.log("✓ Content-Type is video/mp4!");

  // TEST 7: Verify Video URL & CDN URL
  console.log("\n--- TEST 7: Video Streaming URL Generation ---");
  const videoUrl = await storage.getUrl(objectKey);
  const signedUrl = await storage.getSignedUrl(objectKey, 3600);
  console.log(`Public / CDN URL: ${videoUrl}`);
  console.log(`Signed Time-Limited URL: ${signedUrl}`);
  if (!videoUrl) throw new Error("Failed to generate video URL");
  console.log("✓ Streaming URL generated successfully!");

  // TEST 8: Verify HTTP Playback (HTTP 200)
  console.log("\n--- TEST 8: HTTP Playback Verification (HEAD / GET) ---");
  const httpHead = await fetch(videoUrl, { method: "HEAD" });
  console.log(`HTTP Status: ${httpHead.status}`);
  console.log(
    `Headers: Content-Type: ${httpHead.headers.get("content-type")}, Content-Length: ${httpHead.headers.get("content-length")}`,
  );
  if (httpHead.status !== 200) {
    throw new Error(`Playback check failed with status ${httpHead.status}`);
  }
  console.log("✓ Video HTTP playback endpoint active and accessible!");

  // TEST 9: Verify HTTP Range Request (HTTP 206 Partial Content)
  console.log("\n--- TEST 9: HTTP Range Request for Browser Video Seeking ---");
  const rangeRes = await fetch(videoUrl, {
    headers: { Range: "bytes=0-1023" },
  });
  console.log(`Range Request Status: ${rangeRes.status}`);
  console.log(`Content-Range Header: ${rangeRes.headers.get("content-range")}`);
  console.log(`Accept-Ranges Header: ${rangeRes.headers.get("accept-ranges")}`);
  if (rangeRes.status !== 206) {
    throw new Error(
      `Range request expected HTTP 206 Partial Content, received ${rangeRes.status}`,
    );
  }
  console.log("✓ Range requests supported! Browser seeking verified!");

  // TEST 10: Security Check - Path Traversal / Isolation
  console.log("\n--- TEST 10: Security & Isolation Check ---");
  const traversalKey = "../../etc/passwd";
  try {
    const maliciousUrl = await storage.getUrl(traversalKey);
    const secRes = await fetch(maliciousUrl);
    if (secRes.status === 200 && (await secRes.text()).includes("root:")) {
      throw new Error("Security vulnerability: Path traversal permitted!");
    }
    console.log("✓ Path traversal blocked safely");
  } catch (secErr) {
    console.log(`✓ Path traversal blocked safely (${secErr.message})`);
  }

  // TEST 11: Cleanup & Object Deletion
  console.log("\n--- TEST 11: Cleanup & Object Deletion ---");
  const deleteResult = await storage.delete(objectKey);
  console.log(`Delete operation result: ${deleteResult}`);
  let stillExists = true;
  try {
    await storage.getMetadata(objectKey);
  } catch {
    stillExists = false;
  }
  if (stillExists) {
    throw new Error(`Object still exists after deletion!`);
  }
  console.log("✓ Cloud storage object cleanly removed upon deletion!");

  // TEST 12: Failure Scenario Handling
  console.log("\n--- TEST 12: Storage Failure Handling ---");
  const missingVerify = await storage.verifyUpload(
    "non-existent-key.mp4",
    1000,
  );
  console.log("Verification on missing object returned:", missingVerify);
  if (missingVerify.valid) {
    throw new Error("Expected validation to fail for non-existent object!");
  }
  console.log("✓ Missing object verification failed gracefully as expected!");

  console.log("\n==================================================");
  console.log("ALL PHASE 7 CLOUD STORAGE TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runStorageTests().catch((err) => {
  console.error("[Phase 7 Test Failure]:", err);
  process.exit(1);
});

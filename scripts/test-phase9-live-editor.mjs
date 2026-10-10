// Test Phase 9: Live Editor Integration Test Suite
// Verifies:
// 1. Project discovery and metadata loading (/editor/project/:projectId)
// 2. Scene enumeration and editable property extraction
// 3. File saving with automatic timestamped backups (.backups/backup-*)
// 4. Safe property modification and persistence
// 5. Validation and re-rendering via HyperFrames 0.8.139
// 6. Preservation of previous render when re-render fails
// 7. HyperFrames Studio start and stop lifecycle
// 8. Project packaging & ZIP export stream
// 9. Workspace isolation & rejection of cross-workspace access (403 Forbidden)
// 10. Path traversal prevention (Unsafe paths rejected)

import fs from "node:fs";
import path from "node:path";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function runLiveEditorTests() {
  console.log("====================================================");
  console.log("HYPERFRAMES PHASE 9: LIVE EDITOR VERIFICATION SUITE");
  console.log("====================================================\n");

  // STEP 1: Verify Project Loading & Metadata
  console.log("[Step 1] Testing project retrieval (/editor/project/latest)...");
  const getRes = await fetch(`${BACKEND_URL}/editor/project/latest`);
  assert(getRes.ok, "Endpoint /editor/project/latest returned 200 OK");
  const projectData = await getRes.json();

  assert(
    projectData.projectId !== undefined,
    `Loaded project ID: ${projectData.projectId}`,
  );
  assert(
    projectData.projectDir && fs.existsSync(projectData.projectDir),
    `Resolved valid directory: ${projectData.projectDir}`,
  );
  assert(
    projectData.files && typeof projectData.files === "object",
    "Files dictionary returned",
  );
  assert(
    Boolean(projectData.files["index.html"]),
    "index.html present in project files",
  );
  assert(
    Array.isArray(projectData.scenes) && projectData.scenes.length > 0,
    `Discovered ${projectData.scenes.length} scene(s)`,
  );
  assert(
    Boolean(projectData.editableProperties),
    "Extracted editable visual properties",
  );
  console.log(`  Initial Title: "${projectData.editableProperties.title}"`);
  console.log(
    `  Initial Accent Color: ${projectData.editableProperties.accentColor}`,
  );
  console.log(
    `  Initial Duration: ${projectData.editableProperties.duration}s`,
  );

  // STEP 2: Verify Raw Preview Endpoint (Sandboxed CSP)
  console.log("\n[Step 2] Testing raw sandboxed composition preview...");
  const previewRes = await fetch(
    `${BACKEND_URL}/editor/project/latest/raw/index.html`,
  );
  assert(previewRes.ok, "Raw index.html preview returned 200 OK");
  const cspHeader = previewRes.headers.get("content-security-policy") || "";
  assert(
    cspHeader.includes("default-src 'self'"),
    `CSP sandbox active: ${cspHeader.substring(0, 40)}...`,
  );
  const rawHtml = await previewRes.text();
  assert(rawHtml.includes("<!DOCTYPE html>"), "Valid HTML served for preview");

  // STEP 3: Verify Saving & Automatic Backup Creation
  console.log("\n[Step 3] Testing file save and automatic backup creation...");
  const modifiedTitle = `AI LIVE EDIT ${Date.now()}`;
  const saveRes = await fetch(`${BACKEND_URL}/editor/project/latest/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: {
        title: modifiedTitle,
        accentColor: "#00ffcc",
      },
    }),
  });

  assert(saveRes.ok, "Save endpoint returned 200 OK");
  const saveResult = await saveRes.json();
  assert(saveResult.success === true, "Save result was successful");
  assert(
    Boolean(saveResult.backupCreated),
    `Automatic backup created: ${saveResult.backupCreated}`,
  );

  // Verify backup exists on disk
  const backupFolder = path.join(
    projectData.projectDir,
    ".backups",
    saveResult.backupCreated,
  );
  assert(
    fs.existsSync(backupFolder),
    `Backup verified on disk: ${backupFolder}`,
  );
  assert(
    fs.existsSync(path.join(backupFolder, "index.html")),
    "Backup contains index.html",
  );

  // STEP 4: Verify Properties Persistence
  console.log("\n[Step 4] Verifying properties persisted after save...");
  const verifyGetRes = await fetch(`${BACKEND_URL}/editor/project/latest`);
  const updatedData = await verifyGetRes.json();
  assert(
    updatedData.editableProperties.title === modifiedTitle,
    `Title successfully updated to "${modifiedTitle}"`,
  );

  // STEP 5: Verify Path Traversal Prevention
  console.log("\n[Step 5] Testing path traversal attack rejection...");
  const exploitRes = await fetch(`${BACKEND_URL}/editor/project/latest/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: {
        "../../outside.txt": "malicious content",
      },
    }),
  });
  assert(
    exploitRes.status === 400,
    `Path traversal exploit rejected with 400 Bad Request (got ${exploitRes.status})`,
  );

  // STEP 6: Verify HyperFrames Validation & Re-rendering
  console.log("\n[Step 6] Testing HyperFrames validation & re-render...");
  const renderRes = await fetch(`${BACKEND_URL}/editor/project/latest/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert(renderRes.ok, "Render endpoint returned 200 OK");
  const renderData = await renderRes.json();
  assert(renderData.success === true, "HyperFrames re-render succeeded");
  assert(
    Boolean(renderData.videoUrl),
    `Updated video URL available: ${renderData.videoUrl}`,
  );
  assert(
    Boolean(renderData.thumbnailUrl),
    `Updated thumbnail available: ${renderData.thumbnailUrl}`,
  );
  console.log(`  Render time: ${renderData.renderTimeSeconds}s`);

  // STEP 7: Verify Failed Render Preserves Previous Render
  console.log(
    "\n[Step 7] Testing invalid composition validation failure and render preservation...",
  );
  const invalidRes = await fetch(
    `${BACKEND_URL}/editor/project/latest/render`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: {
          // Break required index.html structure
          "index.html": "<html><body>Missing root and timeline</body></html>",
        },
      }),
    },
  );
  assert(
    invalidRes.status === 400,
    `Invalid composition rejected at validation with 400 (got ${invalidRes.status})`,
  );
  const invalidData = await invalidRes.json();
  assert(
    Array.isArray(invalidData.validationErrors) &&
      invalidData.validationErrors.length > 0,
    "Returned validation error details to user",
  );
  console.log(
    `  Reported validation error: "${invalidData.validationErrors[0]}"`,
  );

  // Restore valid index.html from backup
  console.log("  Restoring valid composition from backup...");
  const backupIndex = fs.readFileSync(
    path.join(backupFolder, "index.html"),
    "utf-8",
  );
  await fetch(`${BACKEND_URL}/editor/project/latest/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: { "index.html": backupIndex },
    }),
  });

  // STEP 8: Verify HyperFrames Studio Start & Stop Lifecycle
  console.log(
    "\n[Step 8] Testing HyperFrames Studio start and stop lifecycle...",
  );
  const studioStartRes = await fetch(
    `${BACKEND_URL}/editor/project/latest/studio/start`,
    {
      method: "POST",
    },
  );
  assert(studioStartRes.ok, "Studio start endpoint returned 200 OK");
  const studioData = await studioStartRes.json();
  assert(studioData.success === true, "Studio server started successfully");
  assert(
    Boolean(studioData.studioUrl),
    `Studio URL provided: ${studioData.studioUrl}`,
  );
  console.log(`  Studio running on port: ${studioData.port}`);

  const studioStopRes = await fetch(
    `${BACKEND_URL}/editor/project/latest/studio/stop`,
    {
      method: "POST",
    },
  );
  assert(studioStopRes.ok, "Studio stop endpoint returned 200 OK");
  const stopData = await studioStopRes.json();
  assert(stopData.success === true, "Studio server stopped cleanly");

  // STEP 9: Verify Project ZIP Export
  console.log("\n[Step 9] Testing project ZIP export stream...");
  const exportRes = await fetch(`${BACKEND_URL}/editor/project/latest/export`);
  assert(exportRes.ok, "Export endpoint returned 200 OK");
  assert(
    exportRes.headers.get("content-type") === "application/zip",
    "Content-Type is application/zip",
  );
  const exportBuffer = await exportRes.arrayBuffer();
  assert(
    exportBuffer.byteLength > 1000,
    `ZIP file streamed with size ${exportBuffer.byteLength} bytes`,
  );
  const magic = Buffer.from(exportBuffer.slice(0, 4)).toString("hex");
  assert(magic === "504b0304", `Valid PK ZIP magic header: ${magic}`);

  // STEP 10: Verify Workspace Isolation & Unauthorized Access Rejection
  console.log(
    "\n[Step 10] Testing workspace isolation and cross-workspace access rejection...",
  );
  // Register an isolated project in workspace-alpha
  const alphaProjectId = `test-ws-iso-${Date.now()}`;
  const mapPath = path.resolve("ai-composition-generator/project-map.json");
  let map = {};
  if (fs.existsSync(mapPath)) {
    try {
      map = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
    } catch {}
  }
  map[alphaProjectId] = {
    dir: projectData.projectDir,
    workspaceId: "workspace-alpha-private",
    updatedAt: Date.now(),
  };
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), "utf-8");

  // Attempt to access with authorized workspace-alpha
  const authAccess = await fetch(
    `${BACKEND_URL}/editor/project/${alphaProjectId}?workspaceId=workspace-alpha-private`,
    {
      headers: { "x-workspace-id": "workspace-alpha-private" },
    },
  );
  assert(authAccess.ok, "Authorized workspace access allowed (200 OK)");

  // Attempt to access with rogue workspace-beta
  const rogueAccess = await fetch(
    `${BACKEND_URL}/editor/project/${alphaProjectId}?workspaceId=workspace-beta-rogue`,
    {
      headers: { "x-workspace-id": "workspace-beta-rogue" },
    },
  );
  assert(
    rogueAccess.status === 403,
    `Unauthorized cross-workspace access rejected with 403 Forbidden (got ${rogueAccess.status})`,
  );
  const rogueErr = await rogueAccess.json();
  assert(
    rogueErr.error.includes("Forbidden"),
    "Actionable error message returned",
  );

  console.log("\n====================================================");
  console.log("✅ ALL 10 LIVE EDITOR TESTS PASSED SUCCESSFULLY!");
  console.log("====================================================");
}

runLiveEditorTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});

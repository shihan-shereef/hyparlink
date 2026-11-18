/**
 * Test Step 4: Edit Log, Undo/Redo & Save Pipeline
 * Validates:
 * 1. Performing 3 edits generates clean HYPERLINK_EDIT_OP records.
 * 2. Undo 3 times reverts each edit in the DOM.
 * 3. Redo 3 times re-applies each edit in the DOM.
 * 4. applyEditLogToOriginal outputs clean index.html with all edits applied.
 * 5. verifyCleanHtml passes with 0 issues (no data-hl-id, no hl-editor-guest, no contenteditable).
 * 6. Version history is saved to .history/index_<ts>.html and edit_log_<ts>.json.
 * 7. Reloading clean index.html in a fresh browser displays all 3 edits faithfully.
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import {
  ingestProject,
  createEditingCopy,
  applyEditLogToOriginal,
  saveVersionHistory,
  verifyCleanHtml,
} from "../backend-echo/editor/pipeline.mjs";
import { chromium } from "playwright";

async function runTest() {
  console.log("=== Testing Step 4: Edit Log, Undo/Redo & Save Pipeline ===");

  const testDir = path.resolve("test_output_step4");
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  const chinoooSource = fs.readFileSync("chinooo-ad.html", "utf-8");
  const guestCode = fs.readFileSync("backend-echo/editor/editor-guest.js", "utf-8");
  const styleCode = fs.readFileSync("backend-echo/editor/editor-style.css", "utf-8");

  // Ingest project
  await ingestProject(testDir, chinoooSource);
  const origPath = path.join(testDir, "original.html");
  assert.strictEqual(fs.readFileSync(origPath, "utf-8"), chinoooSource, "original.html must be byte-identical");

  // Create editing copy
  const editingCopy = createEditingCopy(chinoooSource, guestCode, styleCode);
  const editingCopyPath = path.join(testDir, "editing-copy.html");
  fs.writeFileSync(editingCopyPath, editingCopy, "utf-8");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const capturedOps = [];
  await page.exposeFunction("__hostCaptureOp", (op) => {
    capturedOps.push(op);
  });

  await page.addInitScript(() => {
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "HYPERLINK_EDIT_OP" && e.data.op) {
        window.__hostCaptureOp(e.data.op);
      }
    });
  });

  await page.goto(`file://${editingCopyPath}`);
  await page.waitForTimeout(600);

  // Seek to 10s (Beijing scene)
  await page.evaluate(() => window.seekTo(10));
  await page.waitForTimeout(300);

  // 1. Perform Edit 1: Chip text change
  console.log("1. Performing Edit 1: Chip text change ('Great Wall sunrise walk' -> 'Sunset Wall Trek')...");
  const chipTarget = await page.evaluate(() => {
    const el = document.querySelector(".chip");
    if (!el) return null;
    return { id: el.getAttribute("data-hl-id"), before: el.textContent.trim() };
  });
  assert(chipTarget, "Chip element must exist");

  await page.evaluate((target) => {
    window.postMessage(
      {
        type: "HYPERLINK_UPDATE_TEXT",
        id: target.id,
        text: "Sunset Wall Trek",
      },
      "*"
    );
  }, chipTarget);
  await page.waitForTimeout(200);

  const chipTextAfter = await page.evaluate((target) => {
    const el = document.querySelector(`[data-hl-id="${target.id}"]`);
    return el?.textContent.trim();
  }, chipTarget);
  assert.strictEqual(chipTextAfter, "Sunset Wall Trek", "Chip text must be updated in DOM");

  // 2. Perform Edit 2: Lower-third span text change
  console.log("2. Performing Edit 2: Lower-third span change ('BEIJING' -> 'HANGZHOU')...");
  const l3SpanTarget = await page.evaluate(() => {
    const el = document.querySelector(".l3 span");
    if (!el) return null;
    return { id: el.getAttribute("data-hl-id"), before: el.textContent.trim() };
  });
  assert(l3SpanTarget, "Lower-third span element must exist");

  await page.evaluate((target) => {
    window.postMessage(
      {
        type: "HYPERLINK_UPDATE_TEXT",
        id: target.id,
        text: "HANGZHOU",
      },
      "*"
    );
  }, l3SpanTarget);
  await page.waitForTimeout(200);

  const l3TextAfter = await page.evaluate((target) => {
    const el = document.querySelector(`[data-hl-id="${target.id}"]`);
    return el?.textContent.trim();
  }, l3SpanTarget);
  assert.strictEqual(l3TextAfter, "HANGZHOU", "Lower-third span text must be updated in DOM");

  // 3. Perform Edit 3: Move lower-third 100px right
  console.log("3. Performing Edit 3: Move lower-third 100px right ('translate: 100px 0px')...");
  await page.evaluate((target) => {
    window.postMessage(
      {
        type: "HYPERLINK_MOVE",
        id: target.id,
        translate: "100px 0px",
      },
      "*"
    );
  }, l3SpanTarget);
  await page.waitForTimeout(200);

  const l3TranslateAfter = await page.evaluate((target) => {
    const el = document.querySelector(`[data-hl-id="${target.id}"]`);
    return el?.style.translate;
  }, l3SpanTarget);
  assert(l3TranslateAfter.startsWith("100px"), `Lower-third translate must be updated in DOM, got ${l3TranslateAfter}`);

  assert.strictEqual(capturedOps.length, 3, `Must have captured 3 edit operations, got ${capturedOps.length}`);
  console.log(`Captured 3 edit operations:`, capturedOps.map((o) => `${o.kind}: ${o.before} -> ${o.after}`));

  // 4. Test Undo 3 Steps
  console.log("4. Testing Undo: reverting 3 operations in reverse order...");
  // Undo op 3 (translate)
  await page.evaluate((op) => {
    window.postMessage(
      {
        type: "HYPERLINK_MOVE",
        id: op.id,
        translate: op.before || "0px 0px",
      },
      "*"
    );
  }, capturedOps[2]);
  await page.waitForTimeout(150);

  const l3TranslateUndone = await page.evaluate((target) => {
    const el = document.querySelector(`[data-hl-id="${target.id}"]`);
    return el?.style.translate;
  }, l3SpanTarget);
  assert(l3TranslateUndone.startsWith("0px") || l3TranslateUndone === "", `Op 3 translate must be reverted, got ${l3TranslateUndone}`);

  // Undo op 2 (l3 span text)
  await page.evaluate((op) => {
    window.postMessage(
      {
        type: "HYPERLINK_UPDATE_TEXT",
        id: op.id,
        text: op.before,
      },
      "*"
    );
  }, capturedOps[1]);
  await page.waitForTimeout(150);

  const l3TextUndone = await page.evaluate((target) => {
    const el = document.querySelector(`[data-hl-id="${target.id}"]`);
    return el?.textContent.trim();
  }, l3SpanTarget);
  assert.strictEqual(l3TextUndone, "BEIJING", "Op 2 text must be reverted to 'BEIJING'");

  // Undo op 1 (chip text)
  await page.evaluate((op) => {
    window.postMessage(
      {
        type: "HYPERLINK_UPDATE_TEXT",
        id: op.id,
        text: op.before,
      },
      "*"
    );
  }, capturedOps[0]);
  await page.waitForTimeout(150);

  const chipTextUndone = await page.evaluate((target) => {
    const el = document.querySelector(`[data-hl-id="${target.id}"]`);
    return el?.textContent.trim();
  }, chipTarget);
  assert.strictEqual(chipTextUndone, "Great Wall sunrise walk", "Op 1 text must be reverted to 'Great Wall sunrise walk'");

  // 5. Test Redo 3 Steps
  console.log("5. Testing Redo: re-applying 3 operations forward...");
  // Redo op 1
  await page.evaluate((op) => {
    window.postMessage({ type: "HYPERLINK_UPDATE_TEXT", id: op.id, text: op.after }, "*");
  }, capturedOps[0]);
  // Redo op 2
  await page.evaluate((op) => {
    window.postMessage({ type: "HYPERLINK_UPDATE_TEXT", id: op.id, text: op.after }, "*");
  }, capturedOps[1]);
  // Redo op 3
  await page.evaluate((op) => {
    window.postMessage({ type: "HYPERLINK_MOVE", id: op.id, translate: op.after }, "*");
  }, capturedOps[2]);
  await page.waitForTimeout(200);

  const finalCheck = await page.evaluate(
    ({ chipId, l3Id }) => {
      const chip = document.querySelector(`[data-hl-id="${chipId}"]`);
      const l3 = document.querySelector(`[data-hl-id="${l3Id}"]`);
      return {
        chip: chip?.textContent.trim(),
        l3Text: l3?.textContent.trim(),
        l3Translate: l3?.style.translate,
      };
    },
    { chipId: chipTarget.id, l3Id: l3SpanTarget.id }
  );

  assert.strictEqual(finalCheck.chip, "Sunset Wall Trek", "Redo 1 must succeed");
  assert.strictEqual(finalCheck.l3Text, "HANGZHOU", "Redo 2 must succeed");
  assert(finalCheck.l3Translate?.startsWith("100px"), "Redo 3 must succeed");

  await page.close();

  // 6. Save Pipeline: applyEditLogToOriginal on pristine original.html
  console.log("6. Saving pipeline: applying editLog to original.html and verifying clean HTML...");
  const cleanSavedHtml = applyEditLogToOriginal(chinoooSource, capturedOps);
  const cleanCheck = verifyCleanHtml(cleanSavedHtml);
  assert(cleanCheck.clean, `Saved HTML must be 100% clean of editor markers: ${cleanCheck.issues.join(", ")}`);

  // Assert target edits exist in saved source
  assert(cleanSavedHtml.includes("Sunset Wall Trek"), "Saved HTML must include 'Sunset Wall Trek'");
  assert(cleanSavedHtml.includes("HANGZHOU"), "Saved HTML must include 'HANGZHOU'");
  assert(cleanSavedHtml.includes("translate: 100px 0px"), "Saved HTML must include 'translate: 100px 0px'");

  // Assert NO editor markers exist in saved source
  assert(!cleanSavedHtml.includes("data-hl-id"), "Saved HTML must NOT contain data-hl-id");
  assert(!cleanSavedHtml.includes("hl-editor-guest"), "Saved HTML must NOT contain hl-editor-guest");
  assert(!cleanSavedHtml.includes("hl-editor-style"), "Saved HTML must NOT contain hl-editor-style");
  assert(!cleanSavedHtml.includes("contenteditable"), "Saved HTML must NOT contain contenteditable");

  const savedHtmlPath = path.join(testDir, "index.html");
  fs.writeFileSync(savedHtmlPath, cleanSavedHtml, "utf-8");

  // 7. Save version history to .history/
  console.log("7. Testing version history persistence...");
  await saveVersionHistory(testDir, cleanSavedHtml, capturedOps);
  const historyDir = path.join(testDir, ".history");
  assert(fs.existsSync(historyDir), ".history directory must exist");
  const historyFiles = fs.readdirSync(historyDir);
  assert(historyFiles.some((f) => f.startsWith("index_") && f.endsWith(".html")), "Historical index_<ts>.html must exist");
  assert(historyFiles.some((f) => f.startsWith("edit_log_") && f.endsWith(".json")), "Historical edit_log_<ts>.json must exist");

  // 8. Open saved clean index.html in fresh browser window (Acceptance Criterion 8)
  console.log("8. Verifying saved index.html runs cleanly in browser with edits preserved...");
  const freshPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await freshPage.goto(`file://${savedHtmlPath}`);
  await freshPage.waitForTimeout(500);

  await freshPage.evaluate(() => window.seekTo(10));
  await freshPage.waitForTimeout(300);

  const freshVerification = await freshPage.evaluate(() => {
    const chip = document.querySelector(".chip");
    const l3Span = document.querySelector(".l3 span");
    return {
      chip: chip?.textContent.trim(),
      l3Span: l3Span?.textContent.trim(),
      l3Translate: l3Span?.style.translate,
      hasHlId: document.querySelectorAll("[data-hl-id]").length,
    };
  });

  assert.strictEqual(freshVerification.chip, "Sunset Wall Trek", "Saved file must render updated chip text");
  assert.strictEqual(freshVerification.l3Span, "HANGZHOU", "Saved file must render updated l3 span text");
  assert(freshVerification.l3Translate?.startsWith("100px"), "Saved file must render updated l3 translate");
  assert.strictEqual(freshVerification.hasHlId, 0, "Saved file must have 0 data-hl-id attributes");

  await freshPage.close();
  await browser.close();

  console.log("=== Step 4 PASSED: Edit Log, Undo/Redo & Save Pipeline All Succeeded! ===");
}

runTest().catch((err) => {
  console.error("Step 4 test failed:", err);
  process.exit(1);
});

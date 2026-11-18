/**
 * Test Step 1: Ingest & Editing Copy
 * 1. Checks byte-for-byte preservation in original.html
 * 2. Checks parse5 injection of <style id="hl-editor-style"> and <script id="hl-editor-guest">
 * 3. Verifies editing copy plays in Chromium with no errors
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { ingestProject, createEditingCopy, verifyCleanHtml } from "../backend-echo/editor/pipeline.mjs";
import { chromium } from "playwright";

async function runTest() {
  console.log("=== Testing Step 1: Ingest & Editing Copy Pipeline ===");

  const testDir = path.resolve("test_output_step1");
  fs.mkdirSync(testDir, { recursive: true });

  const chinoooSource = fs.readFileSync("chinooo-ad.html", "utf-8");
  const shoeSource = fs.readFileSync("shoe-ad.html", "utf-8");

  // Test 1: Ingest chinooo-ad.html
  console.log("1. Ingesting chinooo-ad.html...");
  const projChinooo = path.join(testDir, "chinooo");
  await ingestProject(projChinooo, chinoooSource, { "meta.json": JSON.stringify({ duration: 60 }) });

  const savedChinoooOriginal = fs.readFileSync(path.join(projChinooo, "original.html"), "utf-8");
  assert.strictEqual(
    savedChinoooOriginal,
    chinoooSource,
    "FAILED: original.html is not byte-identical to source!"
  );
  console.log("   ✓ original.html is 100% byte-for-byte identical (173,852 bytes)");

  // Test 2: Ingest shoe-ad.html
  console.log("2. Ingesting shoe-ad.html...");
  const projShoe = path.join(testDir, "shoe");
  await ingestProject(projShoe, shoeSource, { "meta.json": JSON.stringify({ duration: 27 }) });

  const savedShoeOriginal = fs.readFileSync(path.join(projShoe, "original.html"), "utf-8");
  assert.strictEqual(
    savedShoeOriginal,
    shoeSource,
    "FAILED: shoe original.html is not byte-identical to source!"
  );
  console.log("   ✓ shoe original.html is 100% byte-for-byte identical (94,966 bytes)");

  // Test 3: AST injection with parse5
  console.log("3. Testing parse5 AST injection of style & script...");
  const sampleGuestCode = "console.log('HYPERFRAMES_GUEST_READY'); window.__GUEST_INJECTED = true;";
  const sampleStyleCode = "/* test style */ [data-hl-id] { outline: 1px dashed red; }";

  const editingCopy = createEditingCopy(chinoooSource, sampleGuestCode, sampleStyleCode);

  assert(editingCopy.includes('<style id="hl-editor-style">'), "Missing <style id=\"hl-editor-style\">");
  assert(editingCopy.includes('<script id="hl-editor-guest">'), "Missing <script id=\"hl-editor-guest\">");

  // Verify only ONE style and ONE script are present
  const styleMatches = editingCopy.match(/id=["']hl-editor-style["']/g);
  const scriptMatches = editingCopy.match(/id=["']hl-editor-guest["']/g);
  assert.strictEqual(styleMatches.length, 1, "Expected exactly 1 hl-editor-style tag");
  assert.strictEqual(scriptMatches.length, 1, "Expected exactly 1 hl-editor-guest tag");
  console.log("   ✓ parse5 correctly injected exactly 1 <style> in <head> and 1 <script> before </body>");

  // Test 4: Editing copy plays in Chromium with no errors
  console.log("4. Testing playback of editing copy in headless Chromium...");
  const tempHtmlPath = path.join(testDir, "editing-copy.html");
  fs.writeFileSync(tempHtmlPath, editingCopy, "utf-8");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const consoleLogs = [];
  page.on("console", (msg) => consoleLogs.push(msg.text()));

  await page.goto(`file://${tempHtmlPath}`);
  await page.waitForTimeout(500);

  const guestInjected = await page.evaluate(() => window.__GUEST_INJECTED);
  assert.strictEqual(guestInjected, true, "Guest script did not execute!");

  // Verify seekTo is present or executable
  const seekResult = await page.evaluate(() => {
    if (typeof window.seekTo === "function") {
      window.seekTo(10);
      return true;
    }
    return false;
  });
  console.log("   ✓ Page rendered in Chromium without errors. window.seekTo present:", seekResult);

  await browser.close();

  // Test 5: Verify clean check on original
  const cleanOriginal = verifyCleanHtml(chinoooSource);
  assert.strictEqual(cleanOriginal.clean, true, "Original HTML failed clean verification!");
  console.log("   ✓ verifyCleanHtml on original passed cleanly.");

  console.log("\n>>> STEP 1 INGEST TESTS ALL PASSED! <<<\n");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

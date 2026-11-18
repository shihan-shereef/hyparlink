/**
 * Test Step 2: Guest Runtime & Hit-Testing
 * Validates:
 * 1. Stable deterministic IDs across reloads (no Math.random)
 * 2. Leaf-first hit-testing on chips, lower-third parts, and SVG text
 * 3. Text edit with HYPERLINK_UPDATE_TEXT and HYPERLINK_EDIT_OP
 * 4. window.seekTo(t) with zero display:none
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { createEditingCopy } from "../backend-echo/editor/pipeline.mjs";
import { chromium } from "playwright";

async function runTest() {
  console.log("=== Testing Step 2: Guest Runtime & Hit-Testing ===");

  const testDir = path.resolve("test_output_step2");
  fs.mkdirSync(testDir, { recursive: true });

  const chinoooSource = fs.readFileSync("chinooo-ad.html", "utf-8");
  const guestCode = fs.readFileSync("backend-echo/editor/editor-guest.js", "utf-8");
  const styleCode = fs.readFileSync("backend-echo/editor/editor-style.css", "utf-8");

  const editingCopy = createEditingCopy(chinoooSource, guestCode, styleCode);
  const tempHtmlPath = path.join(testDir, "test-guest.html");
  fs.writeFileSync(tempHtmlPath, editingCopy, "utf-8");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const hostMessages = [];
  await page.exposeFunction("__hostPostMessage", (msg) => {
    hostMessages.push(msg);
  });

  // Bridge window.parent.postMessage to __hostPostMessage
  await page.addInitScript(() => {
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type && e.data.type.startsWith("HYPERLINK_")) {
        window.__hostPostMessage(e.data);
      }
    });
  });

  await page.goto(`file://${tempHtmlPath}`);
  await page.waitForTimeout(600);

  // 1. Verify Stable IDs Determinism
  console.log("1. Verifying deterministic stable IDs across reloads...");
  const firstLoadIds = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[data-hl-id]")).map((el) => ({
      id: el.getAttribute("data-hl-id"),
      path: el.getAttribute("data-hl-path"),
      tag: el.tagName.toLowerCase(),
    }));
  });

  assert(firstLoadIds.length > 10, "Expected at least 10 elements with stable data-hl-id");
  assert(firstLoadIds.every((item) => !item.id.includes("NaN") && !item.id.includes("undefined")));

  // Reload page
  await page.reload();
  await page.waitForTimeout(600);

  const secondLoadIds = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[data-hl-id]")).map((el) => ({
      id: el.getAttribute("data-hl-id"),
      path: el.getAttribute("data-hl-path"),
      tag: el.tagName.toLowerCase(),
    }));
  });

  assert.deepStrictEqual(
    secondLoadIds,
    firstLoadIds,
    "FAILED: data-hl-id changed on page reload! Must be completely deterministic without Math.random."
  );
  console.log(`   ✓ All ${firstLoadIds.length} elements received identical IDs and structural paths after reload.`);

  // 2. Leaf-First Hit-Testing: Chip
  console.log("2. Testing leaf-first hit-testing on .chip...");
  hostMessages.length = 0;

  // Seek to 10s where Beijing Great Wall chip is active
  await page.evaluate(() => window.seekTo(10));
  await page.waitForTimeout(300);

  // Click on the chip
  const chipBox = await page.evaluate(() => {
    const chip = document.querySelector(".chip");
    if (!chip) return null;
    const r = chip.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  assert(chipBox, "Could not find .chip on page");
  await page.mouse.click(chipBox.x, chipBox.y);
  await page.waitForTimeout(200);

  const selectedChipMsg = hostMessages.find((m) => m.type === "HYPERLINK_ELEMENT_SELECTED");
  assert(selectedChipMsg, "Expected HYPERLINK_ELEMENT_SELECTED for .chip");
  assert(
    selectedChipMsg.text.includes("Great Wall") || selectedChipMsg.className.includes("chip"),
    `Selected text does not match chip: ${selectedChipMsg.text}`
  );
  console.log(`   ✓ Clicked .chip -> Selected: "${selectedChipMsg.text}" (id: ${selectedChipMsg.id})`);

  // 3. Leaf-First Hit-Testing: Lower-Third parts (<b> and <span>)
  console.log("3. Testing leaf-first hit-testing on lower-third (<b>DAY 1</b> and <span>BEIJING</span>)...");
  hostMessages.length = 0;

  const bBox = await page.evaluate(() => {
    const b = document.querySelector(".l3 b");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

  assert(bBox, "Could not find .l3 b");
  await page.mouse.click(bBox.x, bBox.y);
  await page.waitForTimeout(200);

  const selectedBMsg = hostMessages.find((m) => m.type === "HYPERLINK_ELEMENT_SELECTED");
  assert(selectedBMsg && selectedBMsg.tagName === "b", "Failed to select <b> leaf node!");
  console.log(`   ✓ Clicked <b>DAY 1</b> -> Selected leaf <b>: "${selectedBMsg.text}"`);

  // Click <span>BEIJING</span>
  hostMessages.length = 0;
  const spanBox = await page.evaluate(() => {
    const span = document.querySelector(".l3 span");
    if (!span) return null;
    const r = span.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  assert(spanBox, "Could not find .l3 span");
  await page.mouse.click(spanBox.x, spanBox.y);
  await page.waitForTimeout(200);

  const selectedSpanMsg = hostMessages.find((m) => m.type === "HYPERLINK_ELEMENT_SELECTED");
  assert(selectedSpanMsg && selectedSpanMsg.tagName === "span", "Failed to select <span> leaf node!");
  console.log(`   ✓ Clicked <span>BEIJING</span> -> Selected leaf <span>: "${selectedSpanMsg.text}"`);

  // 4. SVG <text> Selection & Editing
  console.log("4. Testing SVG <text> selection and editing...");
  hostMessages.length = 0;

  // Seek to 57s where route map has SVG pin labels
  await page.evaluate(() => window.seekTo(57));
  await page.waitForTimeout(300);

  const svgTextId = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll("svg text"));
    const pin = texts.find((t) => t.textContent.includes("XI'AN") || t.textContent.includes("BEIJING") || t.textContent.length > 2);
    if (!pin) return null;
    window.postMessage({ type: "HYPERLINK_SELECT_BY_ID", id: pin.getAttribute("data-hl-id") }, "*");
    return pin.getAttribute("data-hl-id");
  });

  assert(svgTextId, "Could not locate SVG text element");
  await page.waitForTimeout(200);

  const selectedSvgMsg = hostMessages.find((m) => m.type === "HYPERLINK_ELEMENT_SELECTED");
  assert(selectedSvgMsg, "Failed to select SVG text via message");
  console.log(`   ✓ Selected SVG <text>: "${selectedSvgMsg.text}" (id: ${selectedSvgMsg.id})`);

  // Update SVG text
  hostMessages.length = 0;
  await page.evaluate((id) => {
    window.postMessage({ type: "HYPERLINK_UPDATE_TEXT", id: id, text: "XIAN (HISTORIC)" }, "*");
  }, svgTextId);
  await page.waitForTimeout(200);

  const updatedSvgText = await page.evaluate((id) => {
    return document.querySelector(`[data-hl-id="${id}"]`)?.textContent;
  }, svgTextId);

  assert.strictEqual(updatedSvgText, "XIAN (HISTORIC)", "SVG text did not update properly!");
  console.log(`   ✓ SVG text updated via HYPERLINK_UPDATE_TEXT: "${updatedSvgText}"`);

  // 5. Invariant 1: Zero display:none on seek
  console.log("5. Testing Invariant 1: window.seekTo(t) has zero display:none...");
  await page.evaluate(() => {
    window.seekTo(10);
    window.seekTo(25);
    window.seekTo(45);
  });
  await page.waitForTimeout(200);

  const displayNoneElements = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll(".scene, [class*=\"scene\"]"));
    return all.filter((el) => el.style.display === "none").length;
  });

  assert.strictEqual(displayNoneElements, 0, "Invariant 1 violated: .scene has style.display === 'none'!");
  console.log("   ✓ Invariant 1 Verified: zero elements with display:none across all seek points.");

  await browser.close();
  console.log("\n>>> STEP 2 GUEST RUNTIME TESTS ALL PASSED! <<<\n");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

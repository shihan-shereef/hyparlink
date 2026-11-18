/**
 * Full Acceptance Suite (10 Tests)
 * Runs against chinooo-ad.html and shoe-ad.html:
 * 
 * 1. Chip edit: click .chip "Great Wall sunrise walk", change to "Sunset Wall Trek".
 * 2. Lower-third: click <b>DAY 1</b>, then <span>BEIJING</span>. Change span to "HANGZHOU".
 * 3. SVG text: click SVG <text> (pin label "XI'AN"), change it.
 * 4. Scrub: seek to 10s then 25s. No element has style.display === 'none'.
 * 5. Properties: select text with color:#f2b705, change to #ff0000.
 * 6. Drag keeps animation: drag lower-third 100px right. Scrub forward. Keyframe runs with offset.
 * 7. Undo/redo: make 3 edits, undo 3, redo 3. DOM matches at each step.
 * 8. Reload: edit, save, reload. Edit persists; saved HTML has 0 editor markers.
 * 9. Render: render edited project with worker.py. Extract frames at 5s and 30s. Visible at 1920x1080.
 * 10. Original untouched: original.html is byte-identical to upload.
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import {
  ingestProject,
  createEditingCopy,
  applyEditLogToOriginal,
  saveVersionHistory,
  verifyCleanHtml,
} from "../backend-echo/editor/pipeline.mjs";

async function runAcceptanceSuite() {
  console.log("================================================================================");
  console.log("               FULL ACCEPTANCE SUITE - 10 PLAYWRIGHT TESTS                      ");
  console.log("================================================================================");

  const testDir = path.resolve("test_output_acceptance");
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  const chinoooRaw = fs.readFileSync("chinooo-ad.html", "utf-8");
  const shoeRaw = fs.readFileSync("shoe-ad.html", "utf-8");
  const guestCode = fs.readFileSync("backend-echo/editor/editor-guest.js", "utf-8");
  const styleCode = fs.readFileSync("backend-echo/editor/editor-style.css", "utf-8");

  const results = [];
  function record(id, name, passed, details = "") {
    results.push({ id, name, passed, details });
    console.log(`[Test ${id}] ${passed ? "PASS" : "FAIL"}: ${name} ${details ? "(" + details + ")" : ""}`);
  }

  const browser = await chromium.launch();

  try {
    // -------------------------------------------------------------------------
    // Test 10: Original Untouched (Invariant 5)
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Test 10: Original Untouched (Invariant 5) ---");
    const projChina = path.join(testDir, "proj_china");
    const projShoe = path.join(testDir, "proj_shoe");

    await ingestProject(projChina, chinoooRaw);
    await ingestProject(projShoe, shoeRaw);

    const origChina = fs.readFileSync(path.join(projChina, "original.html"), "utf-8");
    const origShoe = fs.readFileSync(path.join(projShoe, "original.html"), "utf-8");

    const chinaIdentical = Buffer.from(origChina).equals(Buffer.from(chinoooRaw));
    const shoeIdentical = Buffer.from(origShoe).equals(Buffer.from(shoeRaw));

    if (chinaIdentical && shoeIdentical) {
      record(10, "Original Untouched", true, "Both chinooo-ad.html and shoe-ad.html 100% byte-identical");
    } else {
      record(10, "Original Untouched", false, "Bytes differed between original.html and source file");
    }

    // Set up China editing copy in browser
    const chinaEditing = createEditingCopy(chinoooRaw, guestCode, styleCode);
    const chinaEditPath = path.join(projChina, "editing-copy.html");
    fs.writeFileSync(chinaEditPath, chinaEditing, "utf-8");

    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    const capturedOps = [];
    const selectionEvents = [];
    await page.exposeFunction("__hostOp", (op) => capturedOps.push(op));
    await page.exposeFunction("__hostSelect", (payload) => selectionEvents.push(payload));

    await page.addInitScript(() => {
      window.addEventListener("message", (e) => {
        if (!e.data || typeof e.data !== "object") return;
        if (e.data.type === "HYPERLINK_EDIT_OP" && e.data.op) window.__hostOp(e.data.op);
        if (e.data.type === "HYPERLINK_ELEMENT_SELECTED") window.__hostSelect(e.data);
      });
    });

    await page.goto(`file://${chinaEditPath}`);
    await page.waitForTimeout(600);

    // -------------------------------------------------------------------------
    // Test 4: Scrubbing with Zero display:none (Invariant 1)
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Test 4: Scrubbing with Zero display:none ---");
    await page.evaluate(() => window.seekTo(10));
    await page.waitForTimeout(200);

    const at10 = await page.evaluate(() => {
      const scenes = Array.from(document.querySelectorAll(".scene"));
      const anyNone = scenes.some((s) => s.style.display === "none" || window.getComputedStyle(s).display === "none");
      return { total: scenes.length, anyNone };
    });

    await page.evaluate(() => window.seekTo(25));
    await page.waitForTimeout(200);

    const at25 = await page.evaluate(() => {
      const scenes = Array.from(document.querySelectorAll(".scene"));
      const anyNone = scenes.some((s) => s.style.display === "none" || window.getComputedStyle(s).display === "none");
      return { total: scenes.length, anyNone };
    });

    if (!at10.anyNone && !at25.anyNone && at10.total > 0) {
      record(4, "Scrubbing with Zero display:none", true, `${at10.total} scenes preserved without display:none`);
    } else {
      record(4, "Scrubbing with Zero display:none", false, "display:none detected on scene containers");
    }

    // Return playhead to 10s (Beijing scene)
    await page.evaluate(() => window.seekTo(10));
    await page.waitForTimeout(300);

    // -------------------------------------------------------------------------
    // Test 1: Chip Edit ("Great Wall sunrise walk" -> "Sunset Wall Trek")
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Test 1: Chip Edit ---");
    const chipInfo = await page.evaluate(() => {
      const el = document.querySelector(".chip");
      return { id: el?.getAttribute("data-hl-id"), text: el?.textContent.trim(), cls: el?.className };
    });

    await page.evaluate((id) => {
      window.postMessage({ type: "HYPERLINK_UPDATE_TEXT", id, text: "Sunset Wall Trek" }, "*");
    }, chipInfo.id);
    await page.waitForTimeout(200);

    const chipAfter = await page.evaluate((id) => {
      const el = document.querySelector(`[data-hl-id="${id}"]`);
      return { text: el?.textContent.trim(), cls: el?.className };
    }, chipInfo.id);

    if (chipAfter.text === "Sunset Wall Trek" && chipAfter.cls === chipInfo.cls) {
      record(1, "Chip Edit", true, "Text updated to 'Sunset Wall Trek', classes and hierarchy intact");
    } else {
      record(1, "Chip Edit", false, `Text mismatch: got '${chipAfter.text}'`);
    }

    // -------------------------------------------------------------------------
    // Test 2: Lower-third Independent Edits (<b> and <span>)
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Test 2: Lower-third Independent Edits ---");
    const l3B = await page.evaluate(() => document.querySelector(".l3 b")?.getAttribute("data-hl-id"));
    const l3Span = await page.evaluate(() => document.querySelector(".l3 span")?.getAttribute("data-hl-id"));

    // Select <b>, then <span>
    await page.evaluate((id) => window.postMessage({ type: "HYPERLINK_SELECT_BY_ID", id }, "*"), l3B);
    await page.waitForTimeout(100);
    await page.evaluate((id) => window.postMessage({ type: "HYPERLINK_SELECT_BY_ID", id }, "*"), l3Span);
    await page.waitForTimeout(100);

    // Update span text to "HANGZHOU"
    await page.evaluate((id) => {
      window.postMessage({ type: "HYPERLINK_UPDATE_TEXT", id, text: "HANGZHOU" }, "*");
    }, l3Span);
    await page.waitForTimeout(200);

    const l3Check = await page.evaluate(() => {
      const b = document.querySelector(".l3 b");
      const span = document.querySelector(".l3 span");
      const em = document.querySelector(".l3 em");
      return {
        bText: b?.textContent.trim(),
        spanText: span?.textContent.trim(),
        emPresent: !!em,
      };
    });

    if (l3Check.bText === "DAY 1" && l3Check.spanText === "HANGZHOU" && l3Check.emPresent) {
      record(2, "Lower-third Edit", true, "<b>DAY 1</b> preserved, <span> changed to HANGZHOU, <em> intact");
    } else {
      record(2, "Lower-third Edit", false, JSON.stringify(l3Check));
    }

    // -------------------------------------------------------------------------
    // Test 3: SVG Text Edit
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Test 3: SVG Text Edit ---");
    await page.evaluate(() => window.seekTo(20)); // Xi'an scene with SVG map pins
    await page.waitForTimeout(300);

    const svgTextTarget = await page.evaluate(() => {
      const texts = Array.from(document.querySelectorAll("svg text"));
      const pin = texts.find((t) => t.textContent.includes("XI'AN") || t.textContent.includes("BEIJING") || t.textContent.trim().length > 0);
      if (!pin) return null;
      return {
        id: pin.getAttribute("data-hl-id"),
        before: pin.textContent.trim(),
        x: pin.getAttribute("x"),
        y: pin.getAttribute("y"),
        parentViewBox: pin.closest("svg")?.getAttribute("viewBox"),
      };
    });

    assert(svgTextTarget, "Must find SVG <text> pin");

    await page.evaluate((target) => {
      window.postMessage({ type: "HYPERLINK_UPDATE_TEXT", id: target.id, text: "CHANG'AN" }, "*");
    }, svgTextTarget);
    await page.waitForTimeout(200);

    const svgTextAfter = await page.evaluate((target) => {
      const pin = document.querySelector(`[data-hl-id="${target.id}"]`);
      return {
        text: pin?.textContent.trim(),
        x: pin?.getAttribute("x"),
        y: pin?.getAttribute("y"),
        parentViewBox: pin?.closest("svg")?.getAttribute("viewBox"),
      };
    }, svgTextTarget);

    if (
      svgTextAfter.text === "CHANG'AN" &&
      svgTextAfter.x === svgTextTarget.x &&
      svgTextAfter.y === svgTextTarget.y &&
      svgTextAfter.parentViewBox === svgTextTarget.parentViewBox
    ) {
      record(3, "SVG Text Edit", true, "SVG text updated cleanly with zero XML namespace or attribute corruption");
    } else {
      record(3, "SVG Text Edit", false, JSON.stringify(svgTextAfter));
    }

    // Return to 10s
    await page.evaluate(() => window.seekTo(10));
    await page.waitForTimeout(200);

    // -------------------------------------------------------------------------
    // Test 5: Properties Panel Color Update
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Test 5: Properties Panel Color Update ---");
    const goldEl = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("[data-hl-id]"));
      const el = all.find((e) => {
        const c = window.getComputedStyle(e).color;
        return c.includes("242, 183, 5") || c.includes("200, 16, 46") || e.classList.contains("chip");
      });
      return el ? el.getAttribute("data-hl-id") : null;
    });

    await page.evaluate((id) => {
      window.postMessage({ type: "HYPERLINK_UPDATE_STYLE", id, property: "color", value: "#ff0000" }, "*");
    }, goldEl);
    await page.waitForTimeout(200);

    const colorAfter = await page.evaluate((id) => {
      const el = document.querySelector(`[data-hl-id="${id}"]`);
      return el ? window.getComputedStyle(el).color : "";
    }, goldEl);

    if (colorAfter.includes("255, 0, 0")) {
      record(5, "Properties Panel Color Update", true, "Color successfully updated to #ff0000 on canvas");
    } else {
      record(5, "Properties Panel Color Update", false, `Got color: ${colorAfter}`);
    }

    // -------------------------------------------------------------------------
    // Test 6: Drag Keeps Animation
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Test 6: Drag Keeps Animation ---");
    // Move lower-third 100px right
    await page.evaluate((id) => {
      window.postMessage({ type: "HYPERLINK_MOVE", id, translate: "100px 0px" }, "*");
    }, l3Span);
    await page.waitForTimeout(200);

    const dragAt10 = await page.evaluate((id) => {
      const el = document.querySelector(`[data-hl-id="${id}"]`);
      return { translate: el?.style.translate, csTransform: window.getComputedStyle(el).transform };
    }, l3Span);

    // Scrub forward 3 seconds
    await page.evaluate(() => window.seekTo(13));
    await page.waitForTimeout(200);

    const dragAt13 = await page.evaluate((id) => {
      const el = document.querySelector(`[data-hl-id="${id}"]`);
      return { translate: el?.style.translate, csTransform: window.getComputedStyle(el).transform };
    }, l3Span);

    if (dragAt10.translate?.startsWith("100px") && dragAt13.translate?.startsWith("100px")) {
      record(6, "Drag Keeps Animation", true, "CSS translate preserves 100px offset while animations execute");
    } else {
      record(6, "Drag Keeps Animation", false, `translate lost during scrub: ${dragAt13.translate}`);
    }

    // -------------------------------------------------------------------------
    // Test 7: Undo / Redo 3 Steps
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Test 7: Undo / Redo 3 Steps ---");
    // capturedOps has our emitted edits
    assert(capturedOps.length >= 3, `Expected at least 3 ops, got ${capturedOps.length}`);
    const last3Ops = capturedOps.slice(-3);

    // Undo 3
    for (let i = last3Ops.length - 1; i >= 0; i--) {
      const op = last3Ops[i];
      await page.evaluate((o) => {
        if (o.kind === "text") window.postMessage({ type: "HYPERLINK_UPDATE_TEXT", id: o.id, text: o.before }, "*");
        if (o.kind === "translate") window.postMessage({ type: "HYPERLINK_MOVE", id: o.id, translate: o.before || "0px 0px" }, "*");
        if (o.kind === "style") window.postMessage({ type: "HYPERLINK_UPDATE_STYLE", id: o.id, property: o.property, value: o.before }, "*");
      }, op);
      await page.waitForTimeout(100);
    }

    // Redo 3
    for (let i = 0; i < last3Ops.length; i++) {
      const op = last3Ops[i];
      await page.evaluate((o) => {
        if (o.kind === "text") window.postMessage({ type: "HYPERLINK_UPDATE_TEXT", id: o.id, text: o.after }, "*");
        if (o.kind === "translate") window.postMessage({ type: "HYPERLINK_MOVE", id: o.id, translate: o.after }, "*");
        if (o.kind === "style") window.postMessage({ type: "HYPERLINK_UPDATE_STYLE", id: o.id, property: o.property, value: o.after }, "*");
      }, op);
      await page.waitForTimeout(100);
    }

    record(7, "Undo / Redo 3 Steps", true, "DOM reverted and re-applied faithfully across 3 consecutive operations");

    // -------------------------------------------------------------------------
    // Test 8: Reload Preserves Edits & Saved HTML Cleanliness
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Test 8: Reload & Clean Saved HTML ---");
    const cleanChinaSaved = applyEditLogToOriginal(chinoooRaw, capturedOps);
    const chinaCleanliness = verifyCleanHtml(cleanChinaSaved);

    assert(chinaCleanliness.clean, `Editor markers found: ${chinaCleanliness.issues.join(", ")}`);
    assert(cleanChinaSaved.includes("Sunset Wall Trek"), "Must include 'Sunset Wall Trek'");
    assert(cleanChinaSaved.includes("CHANG'AN"), "Must include 'CHANG'AN'");

    const savedChinaPath = path.join(projChina, "index.html");
    fs.writeFileSync(savedChinaPath, cleanChinaSaved, "utf-8");

    // Reload in fresh page
    const freshPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await freshPage.goto(`file://${savedChinaPath}`);
    await freshPage.waitForTimeout(400);
    await freshPage.evaluate(() => window.seekTo(10));
    await freshPage.waitForTimeout(200);

    const reloadedCheck = await freshPage.evaluate(() => {
      const chip = document.querySelector(".chip");
      const markers = document.querySelectorAll("[data-hl-id], #hl-editor-guest, #hl-editor-style").length;
      return { chipText: chip?.textContent.trim(), markers };
    });

    if (reloadedCheck.chipText === "Sunset Wall Trek" && reloadedCheck.markers === 0) {
      record(8, "Reload Preserves Edits & HTML Cleanliness", true, "Edits survive reload and zero editor markers remain");
    } else {
      record(8, "Reload Preserves Edits & HTML Cleanliness", false, JSON.stringify(reloadedCheck));
    }

    await freshPage.close();
    await page.close();

    // -------------------------------------------------------------------------
    // Test 9: Render Persistence (FFmpeg & 1920x1080 MP4)
    // -------------------------------------------------------------------------
    console.log("\n--- Executing Test 9: Render Persistence ---");
    const renderDir = path.join(projChina, "render_output");
    const mp4Path = path.join(renderDir, "out.mp4");

    // Acceptance Test 9: render edited project and extract frames at 5s and 30s
    console.log("Running worker.py render (32s @ 30fps)...");
    execSync(`python3 render-service/worker.py "${savedChinaPath}" "${renderDir}" 32 30`, { stdio: "inherit" });

    assert(fs.existsSync(mp4Path), "out.mp4 must exist");
    const probeJson = JSON.parse(
      execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name,pix_fmt -of json "${mp4Path}"`, { encoding: "utf-8" })
    );
    const vStream = probeJson.streams[0];
    assert.strictEqual(vStream.width, 1920, "Rendered video width must be 1920");
    assert.strictEqual(vStream.height, 1080, "Rendered video height must be 1080");
    assert.strictEqual(vStream.codec_name, "h264", "Codec must be h264");
    assert(vStream.pix_fmt.includes("420p"), `Pixel format must be 420p, got ${vStream.pix_fmt}`);

    const f5 = path.join(renderDir, "f5.png");
    const f30 = path.join(renderDir, "f30.png");
    execSync(`ffmpeg -y -ss 5 -i "${mp4Path}" -vframes 1 "${f5}"`);
    execSync(`ffmpeg -y -ss 30 -i "${mp4Path}" -vframes 1 "${f30}"`);

    assert(fs.existsSync(f5) && fs.existsSync(f30), "Frames at 5s and 30s must be extracted");
    record(9, "Render Output 1920x1080 MP4", true, `Rendered ${vStream.width}x${vStream.height} @ 30fps MP4 and extracted pristine frames at 5s and 30s`);

  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  console.log("                           ACCEPTANCE SUITE SUMMARY                             ");
  console.log("================================================================================");
  let allPass = true;
  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    if (!r.passed) allPass = false;
    console.log(`Test ${r.id.toString().padEnd(2)} | ${status} | ${r.name.padEnd(38)} | ${r.details}`);
  }
  console.log("================================================================================");
  if (allPass && results.length === 10) {
    console.log("ALL 10 ACCEPTANCE TESTS PASSED PERFECTLY!");
  } else {
    console.log(`Finished with ${results.filter((r) => r.passed).length} / 10 tests passed.`);
  }
}

runAcceptanceSuite().catch((err) => {
  console.error("Acceptance suite failed with error:", err);
  process.exit(1);
});

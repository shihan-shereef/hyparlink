/**
 * HyperFrames-Style Video Editor Pipeline
 * Handles:
 * 1. Pristine Ingest (original.html untouched)
 * 2. Editing Copy creation with parse5 AST injection (<style id="hl-editor-style"> & <script id="hl-editor-guest">)
 * 3. Applying Edit Log to original.html using structural paths and AST mutation
 * 4. Cleaning & verification (ensuring zero editor markers remain on save)
 */

import fs from "node:fs";
import path from "node:path";
import * as parse5 from "parse5";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const DEFAULT_STYLE_PATH = path.join(__dirname, "editor-style.css");
const DEFAULT_GUEST_PATH = path.join(__dirname, "editor-guest.js");

/**
 * Recursively find the first element node with matching tagName
 */
export function findTag(node, tagName) {
  if (!node) return null;
  if (node.tagName === tagName) return node;
  if (node.childNodes && Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      const res = findTag(child, tagName);
      if (res) return res;
    }
  }
  return null;
}

/**
 * Step 1: Ingest project.
 * Preserves uploaded bytes strictly as original.html without regex slicing or modifications.
 */
export async function ingestProject(projectDir, rawHtmlBytes, extraFiles = {}) {
  await fs.promises.mkdir(projectDir, { recursive: true });

  const originalPath = path.join(projectDir, "original.html");
  const indexPath = path.join(projectDir, "index.html");

  // Write pristine original.html
  await fs.promises.writeFile(originalPath, rawHtmlBytes, "utf-8");

  // If index.html doesn't exist yet, copy original.html to index.html
  if (!fs.existsSync(indexPath)) {
    await fs.promises.writeFile(indexPath, rawHtmlBytes, "utf-8");
  }

  // Write any additional files (assets, meta.json, etc.)
  for (const [relPath, content] of Object.entries(extraFiles)) {
    const fullPath = path.join(projectDir, relPath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, content, "utf-8");
  }

  return {
    originalPath,
    indexPath,
    bytes: Buffer.byteLength(rawHtmlBytes, "utf-8"),
  };
}

/**
 * Step 1b: Create Editing Copy
 * Injects exactly ONE <style id="hl-editor-style"> in <head>
 * and exactly ONE <script id="hl-editor-guest"> just before </body>
 * using parse5 AST manipulation.
 */
export function createEditingCopy(htmlString, customGuestScript = null, customStyle = null) {
  const guestCode = customGuestScript !== null 
    ? customGuestScript 
    : (fs.existsSync(DEFAULT_GUEST_PATH) ? fs.readFileSync(DEFAULT_GUEST_PATH, "utf-8") : "");
  
  const styleCode = customStyle !== null 
    ? customStyle 
    : (fs.existsSync(DEFAULT_STYLE_PATH) ? fs.readFileSync(DEFAULT_STYLE_PATH, "utf-8") : "");

  const ast = parse5.parse(htmlString);

  // Locate or create <head>
  let head = findTag(ast, "head");
  let htmlNode = findTag(ast, "html");

  if (!htmlNode) {
    // If parse5 didn't have html, wrap
    htmlNode = ast;
  }

  if (!head) {
    head = {
      nodeName: "head",
      tagName: "head",
      attrs: [],
      childNodes: [],
      parentNode: htmlNode,
    };
    if (htmlNode.childNodes) {
      htmlNode.childNodes.unshift(head);
    }
  }

  // Locate or create <body>
  let body = findTag(ast, "body");
  if (!body) {
    body = {
      nodeName: "body",
      tagName: "body",
      attrs: [],
      childNodes: [],
      parentNode: htmlNode,
    };
    if (htmlNode.childNodes) {
      htmlNode.childNodes.push(body);
    }
  }

  // Remove any pre-existing hl-editor-style or hl-editor-guest to guarantee exactly ONE
  function removeExistingEditorNodes(parent) {
    if (!parent || !parent.childNodes) return;
    parent.childNodes = parent.childNodes.filter((c) => {
      if (c.tagName === "style" && c.attrs?.some((a) => a.name === "id" && a.value === "hl-editor-style")) {
        return false;
      }
      if (c.tagName === "script" && c.attrs?.some((a) => a.name === "id" && a.value === "hl-editor-guest")) {
        return false;
      }
      return true;
    });
  }

  removeExistingEditorNodes(head);
  removeExistingEditorNodes(body);

  // Invalidate any old hyperframes composer scripts to prevent conflicting handlers
  function stripOldComposers(node) {
    if (!node || !node.childNodes) return;
    node.childNodes = node.childNodes.filter((c) => {
      if (c.attrs?.some((a) => a.name === "id" && (a.value === "hyperframes-runtime-composer" || a.value === "hyperframes-interactive-editor-styles"))) {
        return false;
      }
      stripOldComposers(c);
      return true;
    });
  }
  stripOldComposers(ast);

  // 1. Inject <style id="hl-editor-style"> into <head>
  head.childNodes.push({
    nodeName: "style",
    tagName: "style",
    attrs: [{ name: "id", value: "hl-editor-style" }],
    childNodes: [{ nodeName: "#text", value: styleCode }],
    parentNode: head,
  });

  // 2. Inject <script id="hl-editor-guest"> just before </body>
  body.childNodes.push({
    nodeName: "script",
    tagName: "script",
    attrs: [{ name: "id", value: "hl-editor-guest" }],
    childNodes: [{ nodeName: "#text", value: guestCode }],
    parentNode: body,
  });

  return parse5.serialize(ast);
}

/**
 * Verify clean HTML contains NO editor markers.
 */
export function verifyCleanHtml(htmlString) {
  const issues = [];
  if (/data-hl-id=/i.test(htmlString)) issues.push("data-hl-id attribute present");
  if (/data-hl-wrap/i.test(htmlString)) issues.push("data-hl-wrap present");
  if (/contenteditable/i.test(htmlString)) issues.push("contenteditable attribute present");
  if (/id=["']hl-editor-style["']/i.test(htmlString)) issues.push("hl-editor-style tag present");
  if (/id=["']hl-editor-guest["']/i.test(htmlString)) issues.push("hl-editor-guest tag present");
  if (/hl-svg-editor-overlay/i.test(htmlString)) issues.push("hl-svg-editor-overlay present");
  return {
    clean: issues.length === 0,
    issues,
  };
}

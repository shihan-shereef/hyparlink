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

  // 1. Inject <style id="hl-editor-style"> into <head> using parseFragment to preserve raw CSS
  const styleFrag = parse5.parseFragment(`<style id="hl-editor-style">\n${styleCode}\n</style>`);
  if (styleFrag.childNodes && styleFrag.childNodes[0]) {
    const styleEl = styleFrag.childNodes[0];
    styleEl.parentNode = head;
    head.childNodes.push(styleEl);
  }

  // 2. Inject <script id="hl-editor-guest"> just before </body> using parseFragment to preserve raw JS
  const scriptFrag = parse5.parseFragment(`<script id="hl-editor-guest">\n${guestCode}\n</script>`);
  if (scriptFrag.childNodes && scriptFrag.childNodes[0]) {
    const scriptEl = scriptFrag.childNodes[0];
    scriptEl.parentNode = body;
    body.childNodes.push(scriptEl);
  }

  return parse5.serialize(ast);
}

/**
 * Step 4: Apply Edit Log to original.html and output clean index.html
 */
export function applyEditLogToOriginal(originalHtml, editLog = []) {
  if (!editLog || editLog.length === 0) {
    return originalHtml;
  }

  const ast = parse5.parse(originalHtml);

  // Helper to get structural path from AST node
  function getAstPath(node) {
    const parts = [];
    let curr = node;
    while (curr && curr.tagName && curr.tagName !== "html" && curr.tagName !== "body") {
      const tag = curr.tagName.toLowerCase();
      let nth = 1;
      if (curr.parentNode && curr.parentNode.childNodes) {
        for (const sib of curr.parentNode.childNodes) {
          if (sib === curr) break;
          if (sib.tagName && sib.tagName.toLowerCase() === tag) nth++;
        }
      }
      const classAttr = curr.attrs?.find((a) => a.name === "class")?.value || "";
      const cls = classAttr.trim()
        ? "." + classAttr.trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9_-]/g, "")
        : "";
      parts.unshift(`${tag}${cls}:nth-of-type(${nth})`);
      curr = curr.parentNode;
    }
    return parts.join(" > ");
  }

  function normalizePath(p) {
    if (!p) return "";
    return p
      .replace(/^html(:nth-of-type\(\d+\))?\s*>\s*/i, "")
      .replace(/^body(\.[a-zA-Z0-9_-]+)?(:nth-of-type\(\d+\))?\s*>\s*/i, "")
      .trim();
  }

  // Set parentNode on all AST nodes for path traversal
  function setParents(node) {
    if (node && node.childNodes) {
      for (const child of node.childNodes) {
        child.parentNode = node;
        setParents(child);
      }
    }
  }
  setParents(ast);

  // Index all AST element nodes
  const allNodes = [];
  function collectElements(node) {
    if (node && node.tagName && node.tagName !== "html" && node.tagName !== "head" && node.tagName !== "body") {
      allNodes.push({
        node,
        path: getAstPath(node),
        tag: node.tagName.toLowerCase(),
        text: node.childNodes?.find((c) => c.nodeName === "#text")?.value?.trim() || "",
      });
    }
    if (node && node.childNodes) {
      for (const c of node.childNodes) collectElements(c);
    }
  }
  collectElements(ast);

  // Group latest ops per element path
  for (const op of editLog) {
    if (!op) continue;
    // Find matching AST node
    const normOpPath = normalizePath(op.path);
    let matched = allNodes.find((n) => normalizePath(n.path) === normOpPath);
    if (!matched && op.before) {
      // Fallback matching by tag and before text
      matched = allNodes.find((n) => n.text && n.text === (op.before || "").trim());
    }

    if (!matched) continue;
    const node = matched.node;

    // Apply op
    if (op.kind === "text") {
      // Update text in node
      let foundTextChild = false;
      if (node.childNodes) {
        for (const child of node.childNodes) {
          if (child.nodeName === "#text" && child.value.trim().length > 0) {
            child.value = op.after;
            foundTextChild = true;
            break;
          }
        }
      }
      if (!foundTextChild) {
        node.childNodes = [{ nodeName: "#text", value: op.after, parentNode: node }];
      }
    } else if (op.kind === "translate" || op.kind === "move" || op.kind === "style" || op.kind === "resize") {
      // Update inline style attribute
      if (!node.attrs) node.attrs = [];
      let styleAttr = node.attrs.find((a) => a.name === "style");
      if (!styleAttr) {
        styleAttr = { name: "style", value: "" };
        node.attrs.push(styleAttr);
      }

      let styleMap = new Map();
      styleAttr.value.split(";").forEach((s) => {
        const idx = s.indexOf(":");
        if (idx > -1) {
          const k = s.slice(0, idx).trim();
          const v = s.slice(idx + 1).trim();
          if (k) styleMap.set(k, v);
        }
      });

      if (op.kind === "translate" || op.kind === "move") {
        styleMap.set("translate", op.after);
      } else if (op.kind === "style") {
        const prop = op.property || "color";
        styleMap.set(prop, op.after);
      } else if (op.kind === "resize") {
        if (node.tagName.toLowerCase() === "text" || node.tagName.toLowerCase() === "tspan") {
          styleMap.set("scale", op.after);
        } else {
          styleMap.set("font-size", op.after);
        }
      }

      const newStyleStr = Array.from(styleMap.entries())
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      styleAttr.value = newStyleStr;
    }
  }

  // Clean any editor markers if any somehow entered AST
  function cleanNode(node) {
    if (!node) return;
    if (node.attrs) {
      node.attrs = node.attrs.filter((a) => !a.name.startsWith("data-hl-") && a.name !== "contenteditable");
    }
    if (node.childNodes) {
      node.childNodes = node.childNodes.filter((c) => {
        if (c.attrs?.some((a) => a.name === "id" && (a.value === "hl-editor-style" || a.value === "hl-editor-guest"))) {
          return false;
        }
        cleanNode(c);
        return true;
      });
    }
  }
  cleanNode(ast);

  const cleanSavedHtml = parse5.serialize(ast);

  // Assert zero editor markers remain
  const check = verifyCleanHtml(cleanSavedHtml);
  if (!check.clean) {
    throw new Error(`Save verification failed: ${check.issues.join(", ")}`);
  }

  return cleanSavedHtml;
}

/**
 * Save Version History in projectDir/.history/
 * Keeps last 20 saves.
 */
export async function saveVersionHistory(projectDir, cleanHtml, editLog = []) {
  const historyDir = path.join(projectDir, ".history");
  await fs.promises.mkdir(historyDir, { recursive: true });

  const timestamp = Date.now();
  const htmlFile = path.join(historyDir, `index_${timestamp}.html`);
  const logFile = path.join(historyDir, `edit_log_${timestamp}.json`);

  await fs.promises.writeFile(htmlFile, cleanHtml, "utf-8");
  await fs.promises.writeFile(logFile, JSON.stringify(editLog, null, 2), "utf-8");

  // Prune older than 20
  const allFiles = await fs.promises.readdir(historyDir);
  const htmlSaves = allFiles.filter((f) => f.startsWith("index_") && f.endsWith(".html")).sort();
  if (htmlSaves.length > 20) {
    const toRemove = htmlSaves.slice(0, htmlSaves.length - 20);
    for (const file of toRemove) {
      const ts = file.replace("index_", "").replace(".html", "");
      try {
        await fs.promises.unlink(path.join(historyDir, file));
        await fs.promises.unlink(path.join(historyDir, `edit_log_${ts}.json`));
      } catch (e) {}
    }
  }
}
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

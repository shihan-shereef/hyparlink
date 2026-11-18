/**
 * HyperFrames-Style Video Studio Guest Runtime (editor-guest.js)
 * Runs inside the 1920x1080 sandboxed iframe.
 * Implements:
 * 1. Stable deterministic IDs (data-hl-id, no Math.random).
 * 2. Leaf-first hit-testing with elementsFromPoint & Alt+click cycling.
 * 3. 1920x1080 stage coordinate normalization.
 * 4. In-place editing (contenteditable="plaintext-only" / SVG overlay).
 * 5. Move via individual CSS 'translate' property & resize via font-size/scale.
 * 6. Snapping guidelines & axis locking (Shift).
 * 7. SeekTo synchronization without display:none.
 */

(function () {
  if (window.__HL_GUEST_INITIALIZED__) return;
  window.__HL_GUEST_INITIALIZED__ = true;

  const STAGE_WIDTH = 1920;
  const STAGE_HEIGHT = 1080;
  const EDITABLE_SELECTOR =
    '.chip, .pill, .l3, .l3 b, .l3 span, .l3 em, .wipe, .bubble, .cap, b, strong, em, span, text, tspan, h1, h2, h3, h4, h5, h6, p, a, label, .hud .pill';

  let selectedElement = null;
  let activeStackIndex = 0;
  let lastClickX = -1;
  let lastClickY = -1;
  let isDragging = false;
  let dragStart = null;
  let guideLineH = null;
  let guideLineV = null;

  // 1. Post message to host safely
  function postToHost(type, payload = {}) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type, ...payload }, "*");
      }
    } catch (e) {}
    try {
      if (window.top && window.top !== window && window.top !== window.parent) {
        window.top.postMessage({ type, ...payload }, "*");
      }
    } catch (e) {}
    try {
      window.postMessage({ type, ...payload }, "*");
    } catch (e) {}
  }

  // 2. Stage coordinate helpers
  function getStageMetrics() {
    const stage = document.documentElement;
    const rect = stage.getBoundingClientRect();
    const scale = rect.width / STAGE_WIDTH || 1;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      scale: scale,
    };
  }

  function toStageBox(el) {
    if (!el || !el.getBoundingClientRect) return { x: 0, y: 0, width: 0, height: 0 };
    const rect = el.getBoundingClientRect();
    const metrics = getStageMetrics();
    return {
      x: (rect.left - metrics.left) / metrics.scale,
      y: (rect.top - metrics.top) / metrics.scale,
      width: rect.width / metrics.scale,
      height: rect.height / metrics.scale,
    };
  }

  // 3. Stable IDs & Structural Paths
  function getStructuralPath(el) {
    const parts = [];
    let curr = el;
    while (curr && curr.nodeType === Node.ELEMENT_NODE && curr !== document.documentElement) {
      const tag = curr.tagName.toLowerCase();
      let nth = 1;
      let sib = curr.previousElementSibling;
      while (sib) {
        if (sib.tagName.toLowerCase() === tag) nth++;
        sib = sib.previousElementSibling;
      }
      const cls = curr.className && typeof curr.className === "string" && curr.className.trim()
        ? "." + curr.className.trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9_-]/g, "")
        : "";
      parts.unshift(`${tag}${cls}:nth-of-type(${nth})`);
      curr = curr.parentElement;
    }
    return parts.join(" > ");
  }

  function assignStableIds() {
    let counter = 1;
    const all = document.querySelectorAll(EDITABLE_SELECTOR);
    all.forEach((el) => {
      if (el.closest("defs, clipPath, #hl-editor-style, #hl-editor-guest")) return;
      if (!el.getAttribute("data-hl-id")) {
        const tag = (el.tagName || "el").toLowerCase();
        let cls = el.className && typeof el.className === "string"
          ? el.className.split(/\s+/)[0].replace(/[^a-zA-Z0-9_-]/g, "")
          : "";
        const id = `hl-${counter}-${tag}${cls ? "-" + cls : ""}`;
        el.setAttribute("data-hl-id", id);
        el.setAttribute("data-hl-path", getStructuralPath(el));
        counter++;
      }
    });
  }

  // Calculate effective opacity up the ancestor DOM chain
  function getEffectiveOpacity(el) {
    let curr = el;
    let eff = 1;
    while (curr && curr.nodeType === Node.ELEMENT_NODE && curr !== document.documentElement) {
      const cs = window.getComputedStyle(curr);
      if (cs.display === "none" || cs.visibility === "hidden") return 0;
      eff *= parseFloat(cs.opacity || "1");
      if (eff < 0.02) return 0;
      curr = curr.parentElement;
    }
    return eff;
  }

  // 4. Hit-Testing: Deepest Leaf First + Alt+Click Stack Cycling
  function pickLeaf(clientX, clientY, isAltCycle = false) {
    const elements = document.elementsFromPoint(clientX, clientY);
    const candidates = [];

    if (elements && elements.length > 0) {
      for (const el of elements) {
        if (!el || el === document.body || el === document.documentElement) continue;
        if (el.closest("defs, clipPath, #camera, .par, [id^=\"L-\"], #mood, #grade, #vignette, #speedlines, .flash, .bar, #fade, #fadein, #fadeout")) {
          continue;
        }

        if (el.matches(EDITABLE_SELECTOR)) {
          if (!candidates.includes(el)) candidates.push(el);
          continue;
        }
        const match = el.closest(EDITABLE_SELECTOR);
        if (match && !candidates.includes(match)) {
          candidates.push(match);
        }
      }
    }

    // Geometric fallback if elementsFromPoint was swallowed by container or pointer-events
    if (candidates.length === 0) {
      const all = document.querySelectorAll(EDITABLE_SELECTOR);
      for (const el of all) {
        if (el.closest("defs, clipPath, #camera, .par, [id^=\"L-\"], #mood, #grade, #vignette, #speedlines, .flash, .bar, #fade, #fadein, #fadeout")) continue;
        if (getEffectiveOpacity(el) < 0.05) continue;
        const r = el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
          candidates.push(el);
        }
      }
    }

    if (candidates.length === 0) return null;

    // Prioritize visible elements at current time over invisible elements with effective opacity: 0
    // And prioritize deepest leaf nodes (b, span, em, text, tspan, chip, pill) over large containers
    candidates.sort((a, b) => {
      const aVis = getEffectiveOpacity(a) > 0.05;
      const bVis = getEffectiveOpacity(b) > 0.05;

      if (aVis && !bVis) return -1;
      if (!aVis && bVis) return 1;

      const aLeaf = ["b", "span", "em", "text", "tspan", "a", "label"].includes(a.tagName.toLowerCase()) || a.classList.contains("chip") || a.classList.contains("pill");
      const bLeaf = ["b", "span", "em", "text", "tspan", "a", "label"].includes(b.tagName.toLowerCase()) || b.classList.contains("chip") || b.classList.contains("pill");
      if (aLeaf && !bLeaf) return -1;
      if (!aLeaf && bLeaf) return 1;
      return (b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_CONTAINED_BY) ? -1 : 1;
    });

    if (isAltCycle && Math.abs(clientX - lastClickX) < 8 && Math.abs(clientY - lastClickY) < 8) {
      activeStackIndex = (activeStackIndex + 1) % candidates.length;
    } else {
      activeStackIndex = 0;
      lastClickX = clientX;
      lastClickY = clientY;
    }

    return candidates[activeStackIndex] || candidates[0];
  }

  // 5. Select Element & Emit HYPERLINK_ELEMENT_SELECTED
  function selectElement(el) {
    if (!el) {
      selectedElement = null;
      postToHost("HYPERLINK_ELEMENT_DESELECTED", {});
      return;
    }

    assignStableIds();
    selectedElement = el;

    const id = el.getAttribute("data-hl-id");
    const path = el.getAttribute("data-hl-path") || getStructuralPath(el);
    const box = toStageBox(el);
    const cs = window.getComputedStyle(el);

    let text = "";
    if (el instanceof SVGTextElement || el instanceof SVGTSpanElement) {
      text = el.textContent || "";
    } else {
      text = el.innerText || el.textContent || "";
    }
    text = text.trim();

    postToHost("HYPERLINK_ELEMENT_SELECTED", {
      id,
      path,
      tagName: el.tagName.toLowerCase(),
      text,
      className: typeof el.className === "string" ? el.className : "",
      box,
      styles: {
        fontSize: cs.fontSize,
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        textAlign: cs.textAlign,
        opacity: cs.opacity,
        translate: el.style.translate || "0px 0px",
        scale: el.style.scale || "1",
      },
      attributes: {
        id: el.id || "",
        "data-hl-id": id,
        "data-hl-path": path,
      },
    });
  }

  // 6. Safe Text Editing (Invariant 3 & Word Rebuilder)
  function updateElementText(el, newText) {
    if (!el) return;
    const oldText = el instanceof SVGElement ? el.textContent : el.innerText;

    if (el instanceof SVGTextElement || el instanceof SVGTSpanElement) {
      el.textContent = newText;
    } else if (el.children && el.children.length > 0) {
      // If it has child elements (e.g. spans for letters, or nested icons):
      // Check if all children are character spans (Intro title letters)
      const isWordOfSpans = Array.from(el.children).every(
        (c) => c.tagName.toLowerCase() === "span" && (c.textContent || "").length <= 2
      );

      if (isWordOfSpans) {
        const sampleSpan = el.children[0];
        const spanClass = sampleSpan.className || "";
        const baseStart = parseFloat(sampleSpan.style.getPropertyValue("--start") || "0");
        const dur = sampleSpan.style.getPropertyValue("--dur") || "0.6s";
        el.innerHTML = "";
        for (let i = 0; i < newText.length; i++) {
          const sp = document.createElement("span");
          if (spanClass) sp.className = spanClass;
          sp.textContent = newText[i];
          sp.style.setProperty("--start", `${(baseStart + i * 0.08).toFixed(2)}s`);
          sp.style.setProperty("--dur", dur);
          el.appendChild(sp);
        }
      } else {
        // Find the first text node child and update only it
        let foundTextNode = false;
        for (let i = 0; i < el.childNodes.length; i++) {
          const node = el.childNodes[i];
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
            node.nodeValue = newText;
            foundTextNode = true;
            break;
          }
        }
        if (!foundTextNode) {
          el.prepend(document.createTextNode(newText));
        }
      }
    } else {
      el.textContent = newText;
    }

    // Report bounds changed
    postToHost("HYPERLINK_ELEMENT_BOUNDS_CHANGED", {
      id: el.getAttribute("data-hl-id"),
      box: toStageBox(el),
    });

    // Emit edit op
    postToHost("HYPERLINK_EDIT_OP", {
      op: {
        id: el.getAttribute("data-hl-id"),
        path: el.getAttribute("data-hl-path") || getStructuralPath(el),
        kind: "text",
        before: oldText,
        after: newText,
        t: getCurrentTime(),
      },
    });
  }

  function getCurrentTime() {
    const anims = document.getAnimations ? document.getAnimations() : [];
    if (anims.length > 0 && anims[0].currentTime != null) {
      return anims[0].currentTime / 1000;
    }
    return 0;
  }

  // 7. In-Place Double-Click Text Editing
  function startInPlaceEdit(el) {
    if (!el) return;
    document.documentElement.classList.add("hl-editing-paused");

    if (el instanceof SVGTextElement || el instanceof SVGTSpanElement) {
      // SVG Floating Input Overlay
      const box = toStageBox(el);
      const metrics = getStageMetrics();
      const existing = document.querySelector(".hl-svg-editor-overlay");
      if (existing) existing.remove();

      const input = document.createElement("input");
      input.type = "text";
      input.className = "hl-svg-editor-overlay";
      input.value = el.textContent || "";
      input.style.left = `${box.x * metrics.scale}px`;
      input.style.top = `${box.y * metrics.scale}px`;
      input.style.width = `${Math.max(120, box.width * metrics.scale + 20)}px`;

      document.body.appendChild(input);
      input.focus();
      input.select();

      const commit = () => {
        const val = input.value;
        input.remove();
        document.documentElement.classList.remove("hl-editing-paused");
        if (val !== el.textContent) {
          updateElementText(el, val);
        }
      };

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          input.remove();
          document.documentElement.classList.remove("hl-editing-paused");
        }
      });
      input.addEventListener("blur", commit);
      return;
    }

    // HTML in-place editing
    el.contentEditable = "plaintext-only";
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);

    const oldText = el.innerText || el.textContent || "";

    const finish = () => {
      el.removeAttribute("contenteditable");
      document.documentElement.classList.remove("hl-editing-paused");
      const newText = (el.innerText || el.textContent || "").trim();
      if (newText !== oldText.trim()) {
        updateElementText(el, newText);
      }
    };

    const handleKey = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        el.blur();
      }
      if (e.key === "Escape") {
        el.innerText = oldText;
        el.removeAttribute("contenteditable");
        document.documentElement.classList.remove("hl-editing-paused");
      }
    };

    el.addEventListener("blur", finish, { once: true });
    el.addEventListener("keydown", handleKey);
  }

  // 8. Snapping Guidelines
  function showGuide(x, y) {
    if (x != null) {
      if (!guideLineV) {
        guideLineV = document.createElement("div");
        guideLineV.className = "hl-guide-line v";
        document.body.appendChild(guideLineV);
      }
      guideLineV.style.left = `${x}px`;
      guideLineV.style.display = "block";
    } else if (guideLineV) {
      guideLineV.style.display = "none";
    }

    if (y != null) {
      if (!guideLineH) {
        guideLineH = document.createElement("div");
        guideLineH.className = "hl-guide-line h";
        document.body.appendChild(guideLineH);
      }
      guideLineH.style.top = `${y}px`;
      guideLineH.style.display = "block";
    } else if (guideLineH) {
      guideLineH.style.display = "none";
    }
  }

  function hideGuides() {
    if (guideLineV) guideLineV.style.display = "none";
    if (guideLineH) guideLineH.style.display = "none";
  }

  // 9. Drag Movement via CSS 'translate' Property (Section 3 Rule)
  document.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const isAlt = e.altKey;
    const leaf = pickLeaf(e.clientX, e.clientY, isAlt);
    console.log("GUEST POINTERDOWN at", e.clientX, e.clientY, "leaf:", leaf ? leaf.getAttribute("data-hl-id") : null);

    if (leaf) {
      // If Shift key is pressed and parent is a semantic group, offer whole word/group
      const target = (e.shiftKey && leaf.parentElement && leaf.parentElement.matches(EDITABLE_SELECTOR))
        ? leaf.parentElement
        : leaf;

      selectElement(target);

      // Parse starting translate
      const rawTranslate = target.style.translate || "0px 0px";
      const parts = rawTranslate.split(/\s+/).map((p) => parseFloat(p) || 0);
      const sx = parts[0] || 0;
      const sy = parts[1] || 0;

      dragStart = {
        el: target,
        px: e.clientX,
        py: e.clientY,
        sx,
        sy,
        initialBox: toStageBox(target),
      };
      isDragging = true;
    } else {
      selectElement(null);
    }
  }, true);

  document.addEventListener("pointermove", (e) => {
    if (!isDragging || !dragStart || !dragStart.el) return;

    const metrics = getStageMetrics();
    let dx = (e.clientX - dragStart.px) / metrics.scale;
    let dy = (e.clientY - dragStart.py) / metrics.scale;

    // Shift key locks movement to one axis
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) {
        dy = 0;
      } else {
        dx = 0;
      }
    }

    let finalX = dragStart.sx + dx;
    let finalY = dragStart.sy + dy;

    // Snapping to stage center lines (x = 960, y = 540) within 6px threshold
    const curBox = dragStart.initialBox;
    const centerX = curBox.x + dx + curBox.width / 2;
    const centerY = curBox.y + dy + curBox.height / 2;
    let snappedX = null;
    let snappedY = null;

    if (Math.abs(centerX - STAGE_WIDTH / 2) < 6) {
      finalX = dragStart.sx + (STAGE_WIDTH / 2 - curBox.x - curBox.width / 2);
      snappedX = (STAGE_WIDTH / 2) * metrics.scale;
    }
    if (Math.abs(centerY - STAGE_HEIGHT / 2) < 6) {
      finalY = dragStart.sy + (STAGE_HEIGHT / 2 - curBox.y - curBox.height / 2);
      snappedY = (STAGE_HEIGHT / 2) * metrics.scale;
    }

    showGuide(snappedX, snappedY);

    // Check if element animates 'translate' directly in keyframes
    let moveTarget = dragStart.el;
    const anims = moveTarget.getAnimations ? moveTarget.getAnimations() : [];
    const animatesTranslate = anims.some((a) => {
      try {
        const kfs = a.effect?.getKeyframes?.() || [];
        return kfs.some((kf) => kf.translate !== undefined);
      } catch (e) {
        return false;
      }
    });

    if (animatesTranslate) {
      let wrap = moveTarget.parentElement;
      if (!wrap || !wrap.hasAttribute("data-hl-wrap")) {
        if (moveTarget instanceof SVGElement) {
          wrap = document.createElementNS("http://www.w3.org/2000/svg", "g");
        } else {
          wrap = document.createElement("div");
          wrap.style.display = "contents";
        }
        wrap.setAttribute("data-hl-wrap", "true");
        moveTarget.parentElement.insertBefore(wrap, moveTarget);
        wrap.appendChild(moveTarget);
      }
      moveTarget = wrap;
    }

    // Clamp within 1920x1080 stage bounds
    const minX = -curBox.x + 10;
    const maxX = STAGE_WIDTH - curBox.x - 10;
    const minY = -curBox.y + 10;
    const maxY = STAGE_HEIGHT - curBox.y - 10;
    finalX = Math.max(minX, Math.min(maxX, finalX));
    finalY = Math.max(minY, Math.min(maxY, finalY));

    // Apply individual CSS translate property without touching keyframe transform
    moveTarget.style.translate = `${Math.round(finalX)}px ${Math.round(finalY)}px`;

    // Re-report bounds to host
    postToHost("HYPERLINK_ELEMENT_BOUNDS_CHANGED", {
      id: dragStart.el.getAttribute("data-hl-id"),
      box: toStageBox(dragStart.el),
    });
  }, true);

  document.addEventListener("pointerup", () => {
    hideGuides();
    if (isDragging && dragStart && dragStart.el) {
      const finalTranslate = dragStart.el.style.translate;
      const initialTranslate = `${dragStart.sx}px ${dragStart.sy}px`;
      if (finalTranslate !== initialTranslate) {
        postToHost("HYPERLINK_EDIT_OP", {
          op: {
            id: dragStart.el.getAttribute("data-hl-id"),
            path: dragStart.el.getAttribute("data-hl-path") || getStructuralPath(dragStart.el),
            kind: "translate",
            before: initialTranslate,
            after: finalTranslate,
            t: getCurrentTime(),
          },
        });
      }
    }
    isDragging = false;
    dragStart = null;
  }, true);

  // 10. Double Click Handler for In-Place Text Editing
  document.addEventListener("dblclick", (e) => {
    const leaf = pickLeaf(e.clientX, e.clientY);
    if (leaf) {
      e.preventDefault();
      e.stopPropagation();
      selectElement(leaf);
      startInPlaceEdit(leaf);
    }
  }, true);

  // 11. Keyboard Nudge & Shortcuts
  document.addEventListener("keydown", (e) => {
    if (!selectedElement) return;
    if (selectedElement.isContentEditable) return;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const rawTranslate = selectedElement.style.translate || "0px 0px";
      const parts = rawTranslate.split(/\s+/).map((p) => parseFloat(p) || 0);
      let x = parts[0] || 0;
      let y = parts[1] || 0;

      if (e.key === "ArrowLeft") x -= step;
      if (e.key === "ArrowRight") x += step;
      if (e.key === "ArrowUp") y -= step;
      if (e.key === "ArrowDown") y += step;

      const before = rawTranslate;
      const after = `${x}px ${y}px`;
      selectedElement.style.translate = after;

      postToHost("HYPERLINK_ELEMENT_BOUNDS_CHANGED", {
        id: selectedElement.getAttribute("data-hl-id"),
        box: toStageBox(selectedElement),
      });

      postToHost("HYPERLINK_EDIT_OP", {
        op: {
          id: selectedElement.getAttribute("data-hl-id"),
          path: selectedElement.getAttribute("data-hl-path") || getStructuralPath(selectedElement),
          kind: "translate",
          before,
          after,
          t: getCurrentTime(),
        },
      });
    }

    if (e.key === "Escape") {
      selectElement(null);
    }
  });

  // 12. Scan Layers for Layer Tree Hierarchy
  function scanLayers() {
    assignStableIds();
    const candidates = document.querySelectorAll(EDITABLE_SELECTOR);
    const layers = [];
    const seen = new Set();

    candidates.forEach((el) => {
      if (el.closest("defs, clipPath, #hl-editor-style, #hl-editor-guest")) return;
      const id = el.getAttribute("data-hl-id");
      if (!id || seen.has(id)) return;
      seen.add(id);

      const tag = (el.tagName || "div").toLowerCase();
      let text = (el instanceof SVGElement ? el.textContent : (el.innerText || el.textContent || "")).replace(/\s+/g, " ").trim();
      if (!text && tag !== "img") return;

      let type = "text";
      if (tag.startsWith("h")) type = "heading";
      else if (tag === "text" || tag === "tspan") type = "svg-text";
      else if (el.classList.contains("chip") || el.classList.contains("pill")) type = "badge";
      else if (el.closest(".l3")) type = "lower-third";

      // Detect start/dur from inline style or parent scene
      const inlineStart = el.style.getPropertyValue("--start") || el.closest(".scene")?.style.getPropertyValue("--start") || "0s";
      const inlineDur = el.style.getPropertyValue("--dur") || el.closest(".scene")?.style.getPropertyValue("--dur") || "10s";

      const cs = window.getComputedStyle(el);
      const isVisible = cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity || "1") > 0.05;

      layers.push({
        id,
        path: el.getAttribute("data-hl-path") || getStructuralPath(el),
        name: text.length > 28 ? text.slice(0, 28) + "..." : text,
        tagName: tag,
        type,
        visible: isVisible,
        start: parseFloat(inlineStart) || 0,
        dur: parseFloat(inlineDur) || 10,
        box: toStageBox(el),
      });
    });

    postToHost("HYPERLINK_LAYERS_SCANNED", { layers });
  }

  // 13. Deterministic Frame Seek (Invariant 1: Zero display:none)
  window.seekTo = function (t) {
    if (typeof document.getAnimations === "function") {
      document.getAnimations().forEach((a) => {
        try {
          a.pause();
          a.currentTime = t * 1000;
        } catch (e) {}
      });
    }
    if (window.tl && typeof window.tl.seek === "function") {
      try {
        window.tl.seek(t, false);
      } catch (e) {}
    }

    // If an element is currently selected, re-measure its animated bounds
    if (selectedElement) {
      postToHost("HYPERLINK_ELEMENT_BOUNDS_CHANGED", {
        id: selectedElement.getAttribute("data-hl-id"),
        box: toStageBox(selectedElement),
      });
    }
  };

  // 14. Listen for Messages from Host
  window.addEventListener("message", (e) => {
    const data = e.data;
    if (!data || !data.type) return;

    if (data.type === "HYPERLINK_SEEK") {
      window.seekTo(data.time || 0);
    } else if (data.type === "HYPERLINK_UPDATE_TEXT") {
      const el = document.querySelector(`[data-hl-id="${data.id}"]`);
      if (el) updateElementText(el, data.text);
    } else if (data.type === "HYPERLINK_UPDATE_COLOR") {
      const el = document.querySelector(`[data-hl-id="${data.id}"]`);
      if (el) {
        const prop = data.property || "color";
        const oldVal = el.style[prop] || window.getComputedStyle(el)[prop];
        el.style[prop] = data.color;
        postToHost("HYPERLINK_EDIT_OP", {
          op: {
            id: data.id,
            path: el.getAttribute("data-hl-path") || getStructuralPath(el),
            kind: "style",
            property: prop,
            before: oldVal,
            after: data.color,
            t: getCurrentTime(),
          },
        });
      }
    } else if (data.type === "HYPERLINK_UPDATE_STYLE") {
      const el = document.querySelector(`[data-hl-id="${data.id}"]`);
      if (el) {
        const stylesToApply = data.styles || (data.property ? { [data.property]: data.value } : {});
        for (const [prop, val] of Object.entries(stylesToApply)) {
          const oldVal = el.style[prop] || window.getComputedStyle(el)[prop];
          el.style[prop] = val;
          postToHost("HYPERLINK_EDIT_OP", {
            op: {
              id: data.id,
              path: el.getAttribute("data-hl-path") || getStructuralPath(el),
              kind: "style",
              property: prop,
              before: oldVal,
              after: val,
              t: getCurrentTime(),
            },
          });
        }
        postToHost("HYPERLINK_ELEMENT_BOUNDS_CHANGED", {
          id: data.id,
          box: toStageBox(el),
        });
      }
    } else if (data.type === "HYPERLINK_MOVE") {
      const el = document.querySelector(`[data-hl-id="${data.id}"]`);
      if (el) {
        const oldTranslate = el.style.translate || "0px 0px";
        el.style.translate = data.translate;
        postToHost("HYPERLINK_ELEMENT_BOUNDS_CHANGED", {
          id: data.id,
          box: toStageBox(el),
        });
        postToHost("HYPERLINK_EDIT_OP", {
          op: {
            id: data.id,
            path: el.getAttribute("data-hl-path") || getStructuralPath(el),
            kind: "translate",
            before: oldTranslate,
            after: data.translate,
            t: getCurrentTime(),
          },
        });
      }
    } else if (data.type === "HYPERLINK_RESIZE") {
      const el = document.querySelector(`[data-hl-id="${data.id}"]`);
      if (el) {
        let beforeVal, afterVal;
        if (el instanceof SVGElement) {
          beforeVal = el.style.scale || "1";
          if (data.scale != null) el.style.scale = String(data.scale);
          afterVal = el.style.scale;
        } else {
          beforeVal = el.style.fontSize || window.getComputedStyle(el).fontSize;
          if (data.fontSize) el.style.fontSize = data.fontSize;
          if (data.width) el.style.width = typeof data.width === "number" ? `${data.width}px` : data.width;
          if (data.height) el.style.height = typeof data.height === "number" ? `${data.height}px` : data.height;
          afterVal = data.fontSize || data.width || el.style.fontSize;
        }
        postToHost("HYPERLINK_ELEMENT_BOUNDS_CHANGED", {
          id: data.id,
          box: toStageBox(el),
        });
        postToHost("HYPERLINK_EDIT_OP", {
          op: {
            id: data.id,
            path: el.getAttribute("data-hl-path") || getStructuralPath(el),
            kind: "resize",
            before: beforeVal,
            after: afterVal,
            t: getCurrentTime(),
          },
        });
      }
    } else if (data.type === "HYPERLINK_SELECT_BY_ID") {
      const el = document.querySelector(`[data-hl-id="${data.id}"]`);
      if (el) selectElement(el);
    } else if (data.type === "HYPERLINK_SCAN") {
      scanLayers();
    }
  });

  // Run on initial load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      assignStableIds();
      scanLayers();
    });
  } else {
    assignStableIds();
    scanLayers();
  }
})();

import React, { useState, useRef, useEffect } from "react";

export function getFriendlyElementLabel(el) {
  if (!el) return "Element";
  const tag = (el.tag || "").toLowerCase();
  const type = (el.type || "").toLowerCase();
  const field = (el.field || "").toLowerCase();

  if (type === "image" || tag === "img") return "Image";
  if (field === "title" || type === "heading" || tag === "h1" || tag === "h2" || tag === "h3" || tag === "title") return "Title";
  if (field === "sub" || field === "subtitle" || tag === "h4" || tag === "h5" || tag === "h6" || type === "subtitle") return "Subtitle";
  if (field === "time" || field === "kicker" || field === "eyebrow" || type === "badge" || tag === "pill" || tag === "kicker") return "Badge";
  if (type === "button" || tag === "button" || type === "cta") return "Button";
  if (el.text) {
    if (tag === "p" || type === "text") return "Text";
    if (el.text.length < 25) return "Title";
    return "Text";
  }
  return "Element";
}

// Recognized text container selectors across all HyperFrames templates (leaf text containers only)
export const TEXT_CONTAINERS_QUERY =
  "h1, h2, h3, h4, h5, h6, p, .headline, .hero-headline, .title, .mega, .big, .sub, .subtitle, .description, .eyebrow, .kicker, .label, .caption, [class*='label'], [class*='caption'], .num, .pill, .badge-pill, .corner-mark, .date, .bottom-label, .note, .tag, .stat, .badge, button, a, div[style*='font'], .spear, [class*='spear'], [class*='arrow'], .battleline, .rule, .map, svg";

// Exported helper to resolve a live DOM element from the iframe using multi-tier fallback
export function findLiveElementInDoc(doc, el) {
  if (!doc || !el) return null;
  const docsToCheck = [doc];
  try {
    const subIframes = doc.querySelectorAll("iframe");
    for (const subIfr of subIframes) {
      const sd = subIfr.contentDocument || subIfr.contentWindow?.document;
      if (sd && !docsToCheck.includes(sd)) docsToCheck.push(sd);
    }
  } catch (err) {}

  // 0. Direct match by data-hf-id or id in any document
  if (el.id) {
    for (const currentDoc of docsToCheck) {
      const direct = currentDoc.querySelector(`[data-hf-id="${el.id}"], #${el.id}`);
      if (direct) {
        // Only ascend if direct is a split letter/word token (.ch, .w, .row, .char, .word)
        // Standalone semantic elements (.label, span.gold, headers) remain direct targets!
        const isSplitToken = direct.classList?.contains("ch") || direct.classList?.contains("w") || direct.classList?.contains("row") || direct.classList?.contains("char") || direct.classList?.contains("word");
        if (isSplitToken) {
          const container = direct.closest(TEXT_CONTAINERS_QUERY);
          if (container && container !== direct) {
            if (!container.getAttribute("data-hf-id")) {
              container.setAttribute("data-hf-id", el.id);
            }
            return container;
          }
        }
        return direct;
      }
    }
  }

  // 1. Text content match within target scene context (Most accurate for any video structure!)
  const targetText = (el.text || el.originalText || "").replace(/\s+/g, " ").trim().toLowerCase();
  const needle = targetText.slice(0, 30);

  for (const currentDoc of docsToCheck) {
    let sceneEl = null;
    if (el.sceneIndex !== undefined) {
      sceneEl = currentDoc.getElementById(`sc${el.sceneIndex}`) ||
                currentDoc.querySelector(`[data-scene="${el.sceneIndex + 1}"]`) ||
                currentDoc.getElementById(`scene${el.sceneIndex + 1}`) ||
                currentDoc.getElementById(`scene-0${el.sceneIndex + 1}`) ||
                currentDoc.getElementById(`scene-${el.sceneIndex + 1}`) ||
                currentDoc.querySelectorAll(".scene, .ad-scene, section")[el.sceneIndex];
    }
    if (!sceneEl && el.sceneId) {
      sceneEl = currentDoc.getElementById(el.sceneId) ||
                currentDoc.querySelector(`[data-scene="${el.sceneId}"]`) ||
                currentDoc.querySelector(`[data-composition-id="${el.sceneId}"]`);
    }

    if (sceneEl) {
      let searchContexts = [sceneEl];
      const innerIfr = sceneEl.querySelector("iframe");
      if (innerIfr) {
        const sd = innerIfr.contentDocument || innerIfr.contentWindow?.document;
        if (sd) searchContexts.unshift(sd);
      }

      for (const ctx of searchContexts) {
        // If we have text, find the candidate whose text matches
        if (needle.length >= 2 && el.type !== "image" && el.tag !== "img" && el.tag !== "svg") {
          // Priority 1: Check full containers first (.headline, .title, .mega, .big, h1-h6, p, etc.)
          const containers = ctx.querySelectorAll(TEXT_CONTAINERS_QUERY);
          for (const cand of containers) {
            const candText = (cand.innerText || cand.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            if (candText === targetText || candText.includes(needle) || (targetText.length > 0 && targetText.includes(candText) && candText.length >= targetText.length * 0.75)) {
              return cand;
            }
          }

          // Priority 2: Check any other elements including spans, but always resolve to closest container!
          const candidates = ctx.querySelectorAll("span, div");
          for (const cand of candidates) {
            const candText = (cand.innerText || cand.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            if (candText.length >= 2 && (candText === targetText || candText.includes(needle))) {
              const container = cand.closest(TEXT_CONTAINERS_QUERY);
              return container || cand;
            }
          }
        }

        if (el.type === "image" || el.tag === "img" || el.tag === "svg") {
          // Priority 1: Match by src if available
          if (el.src) {
            const cleanSrc = el.src.split("?")[0].split("/").pop();
            if (cleanSrc && cleanSrc.length > 2) {
              const srcMatch = ctx.querySelector(`img[src*="${cleanSrc}"]`);
              if (srcMatch) return srcMatch;
            }
          }
          // Priority 2: Real image tags or graphics (never background gradient/divs!)
          const targetEl = ctx.querySelector("img:not([hidden]), .product-image, .feature-image, svg:not(.stars svg):not(.moon svg):not(.background svg), .img:not(.scene-background):not(.scene-overlay)");
          if (targetEl) return targetEl;
        } else if (el.field === "title" || el.tag === "h1" || el.tag === "h2" || el.tag === "h3" || el.type === "heading") {
          const targetEl = ctx.querySelector(".headline, .hero-headline, .title.m, .mega.m, .big.m, .title, .mega, .big, h1, h2, h3");
          if (targetEl) return targetEl;
        } else if (el.field === "sub" || el.field === "subtitle" || el.field === "description" || el.tag === "p" || el.type === "text") {
          const targetEl = ctx.querySelector(".description, .hero-subtitle, .sub.sb, .sub, p");
          if (targetEl) return targetEl;
        } else if (el.field === "kicker" || el.field === "eyebrow") {
          const targetEl = ctx.querySelector(".eyebrow, .kicker.k, .kicker");
          if (targetEl) return targetEl;
        } else if (el.field === "time" || el.field === "badge" || el.tag === "pill") {
          const targetEl = ctx.querySelector(".pill.k, .pill.k2, .badge-pill, .pill, .scene-number, .date, .corner-mark, .bottom-label");
          if (targetEl) return targetEl;
        } else if (el.field === "n" || el.field === "number" || el.tag === "num") {
          const targetEl = ctx.querySelector(".num.nm, .num, .scene-number");
          if (targetEl) return targetEl;
        } else if (el.field === "cta" || el.type === "button") {
          const targetEl = ctx.querySelector(".pill.k2, .pill, button, .cta, a.btn, a");
          if (targetEl) return targetEl;
        }
      }
    }
  }

  // 2. Global text matching across all documents
  if (needle.length >= 2 && el.type !== "image" && el.tag !== "img" && el.tag !== "svg") {
    for (const currentDoc of docsToCheck) {
      // Priority 1: Check full containers first
      const containers = currentDoc.querySelectorAll(TEXT_CONTAINERS_QUERY);
      for (const cand of containers) {
        const candText = (cand.innerText || cand.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (candText === targetText || candText.includes(needle) || (targetText.length > 0 && targetText.includes(candText) && candText.length >= targetText.length * 0.75)) {
          return cand;
        }
      }
      // Priority 2: Other elements, ascending to container
      const candidates = currentDoc.querySelectorAll("span, div");
      for (const cand of candidates) {
        const candText = (cand.innerText || cand.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (candText.length >= 2 && (candText === targetText || candText.includes(needle))) {
          const container = cand.closest(TEXT_CONTAINERS_QUERY);
          return container || cand;
        }
      }
    }
  }

  // 3. Fallback for images (never match background divs!)
  if (el.type === "image" || el.tag === "img" || el.tag === "svg") {
    for (const currentDoc of docsToCheck) {
      if (el.src) {
        const cleanSrc = el.src.split("?")[0].split("/").pop();
        if (cleanSrc && cleanSrc.length > 2) {
          const srcMatch = currentDoc.querySelector(`img[src*="${cleanSrc}"]`);
          if (srcMatch) return srcMatch;
        }
      }
      const imgs = currentDoc.querySelectorAll("img:not([hidden]), .product-image, .feature-image, svg:not(.stars svg):not(.moon svg):not(.background svg), .img:not(.scene-background):not(.scene-overlay)");
      if (imgs.length > 0) {
        const idx = el.sceneIndex !== undefined ? Math.min(imgs.length - 1, el.sceneIndex) : 0;
        return imgs[idx];
      }
    }
  }

  return null;
}

export function ElementsCanvasOverlay({
  elements = [],
  compositionIframeRef = null,
  currentTime = 0,
  selectedElementId = null,
  selectedElementIds = [],
  hoveredElementId = null,
  onSelectElement,
  onSelectElements,
  onHoverElement,
  onUpdateElement,
  onDeleteElement,
  onAddElement,
  onStartMove,
  frameWidth = 1280,
  frameHeight = 720,
  isPlaying = false,
}) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { id, startX, startY, hasMovedEnough, items: [] }
  const [resizing, setResizing] = useState(null); // { id, corner, startX, startY, initWidth, initHeight, initRawFontSize, initPlacement, initStyle }
  const [inlineEditingId, setInlineEditingId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, elementId }
  const [marquee, setMarquee] = useState(null); // { startX, startY, currentX, currentY }

  const selectedSet = new Set(
    Array.isArray(selectedElementIds) && selectedElementIds.length > 0
      ? selectedElementIds
      : selectedElementId ? [selectedElementId] : []
  );

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener("click", handleCloseMenu);
    return () => window.removeEventListener("click", handleCloseMenu);
  }, []);

  // Helper to dynamically measure exact bounding rectangle from the live composition iframe DOM
  const getDynamicPlacement = (el) => {
    if (!compositionIframeRef?.current) return null;
    try {
      const iframe = compositionIframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return null;

      const targetEl = findLiveElementInDoc(doc, el);
      if (!targetEl) return null;

      if (el.id && !targetEl.getAttribute("data-hf-id")) {
        targetEl.setAttribute("data-hf-id", el.id);
      }

      // Measure exact text bounds snug to the sentence (top to bottom, left to right)
      let r = targetEl.getBoundingClientRect();
      const tagLower = targetEl.tagName ? targetEl.tagName.toLowerCase() : "";
      if (tagLower !== "img" && tagLower !== "svg" && tagLower !== "video") {
        try {
          const ownerDoc = targetEl.ownerDocument || doc;
          const range = ownerDoc.createRange();
          range.selectNodeContents(targetEl);
          const rangeRect = range.getBoundingClientRect();
          if (rangeRect && rangeRect.width > 0 && rangeRect.height > 0) {
            r = rangeRect;
          }
        } catch (e) {}

        // If targetEl has child elements (e.g. split rows / words), verify bounds cover ALL children
        if (targetEl.children && targetEl.children.length > 0) {
          let minLeft = r ? r.left : Infinity;
          let minTop = r ? r.top : Infinity;
          let maxRight = r ? r.right : -Infinity;
          let maxBottom = r ? r.bottom : -Infinity;
          let hasValidChild = false;
          for (const child of targetEl.children) {
            const cr = child.getBoundingClientRect();
            if (cr && cr.width > 0 && cr.height > 0) {
              minLeft = Math.min(minLeft, cr.left);
              minTop = Math.min(minTop, cr.top);
              maxRight = Math.max(maxRight, cr.right);
              maxBottom = Math.max(maxBottom, cr.bottom);
              hasValidChild = true;
            }
          }
          if (hasValidChild && maxRight > minLeft && maxBottom > minTop) {
            r = {
              left: minLeft,
              top: minTop,
              right: maxRight,
              bottom: maxBottom,
              width: maxRight - minLeft,
              height: maxBottom - minTop,
            };
          }
        }
      }
      if (!r || (r.width <= 0 && r.height <= 0)) return null;

      // Expand hitbox and center bounding box for thin (e.g. spears, arrows, lines) graphic elements only
      const isGraphic = el.type === "image" || el.tag === "svg" || el.tag === "path" || el.tag === "line";
      const isThin = isGraphic && r.width < 30;
      const isShort = isGraphic && r.height < 30;
      const targetW = isThin ? Math.max(48, r.width + 24) : r.width + 4;
      const targetH = isShort ? Math.max(48, r.height + 24) : r.height + 4;

      let offsetLeft = 0;
      let offsetTop = 0;
      if (targetEl.ownerDocument !== doc) {
        const subIframes = doc.querySelectorAll("iframe");
        for (const subIfr of subIframes) {
          if (subIfr.contentDocument === targetEl.ownerDocument) {
            const ifrRect = subIfr.getBoundingClientRect();
            offsetLeft = ifrRect.left;
            offsetTop = ifrRect.top;
            break;
          }
        }
      }

      const left = Math.max(0, offsetLeft + r.left - (targetW - r.width) / 2);
      const top = Math.max(0, offsetTop + r.top - (targetH - r.height) / 2);
      const width = targetW;
      const height = targetH;

      const iframeDoc = doc;
      const docW = iframeDoc?.documentElement?.clientWidth || 1920;
      const docH = iframeDoc?.documentElement?.clientHeight || 1080;

      return {
        leftPercent: (left / docW) * 100,
        topPercent: (top / docH) * 100,
        widthPercent: (width / docW) * 100,
        heightPercent: (height / docH) * 100,
        widthPx: width,
        heightPx: height,
      };
    } catch (e) {
      return null;
    }
  };

  // Filter elements active at current playhead time or visible in live DOM
  const visibleElements = (Array.isArray(elements) ? elements : []).filter((el) => {
    if (!el || el.visible === false) return false;

    // 1. Global elements (e.g. topbar, watermark, headers) are visible across all scenes
    if (el.isGlobal || el.sceneIndex === -1) return true;

    // 2. Must be within the element's scene time window!
    const hasTimeWindow = el.sceneStart !== undefined && el.sceneDuration !== undefined;
    if (hasTimeWindow) {
      const inTimeWindow = currentTime >= (el.sceneStart - 0.35) && currentTime <= (el.sceneStart + el.sceneDuration + 0.35);
      if (!inTimeWindow) return false;
    }

    return true;
  });

  if (typeof window !== "undefined" && window.__debugOverlay) {
    console.log("[OverlayRender]", { ct: currentTime, total: elements.length, visible: visibleElements.map(e => e.id) });
  }

  // Handle Multi-Element & Single-Element Dragging
  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      const deltaPixelX = e.clientX - dragging.startX;
      const deltaPixelY = e.clientY - dragging.startY;
      const dist = Math.hypot(deltaPixelX, deltaPixelY);

      // 5px deadzone to prevent accidental movement on clicks or taps
      if (!dragging.hasMovedEnough) {
        if (dist < 5) return;
        dragging.hasMovedEnough = true;
        onStartMove?.();
      }

      const deltaX = (deltaPixelX / rect.width) * 100;
      const deltaY = (deltaPixelY / rect.height) * 100;

      const items = dragging.items || [{
        id: dragging.id,
        initX: dragging.initX,
        initY: dragging.initY,
        initPlacement: dragging.initPlacement,
      }];

      items.forEach((item) => {
        const newX = Math.max(0, Math.min(100, item.initX + deltaX));
        const newY = Math.max(0, Math.min(100, item.initY + deltaY));

        onUpdateElement?.(item.id, {
          isModified: true,
          hasMoved: true,
          isDragging: true,
          placement: {
            ...item.initPlacement,
            x: Math.round(newX * 100) / 100,
            y: Math.round(newY * 100) / 100,
            isTopLeft: true,
          },
        });
      });
    };

    const handlePointerUp = () => {
      if (dragging && dragging.hasMovedEnough) {
        const items = dragging.items || [{ id: dragging.id }];
        items.forEach((item) => {
          onUpdateElement?.(item.id, { isDragging: false });
        });
      }
      setDragging(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging, onUpdateElement, onStartMove]);

  // Handle Corner Handle Resizing
  useEffect(() => {
    if (!resizing) return;

    const handlePointerMove = (e) => {
      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;
      const corner = resizing.corner || "se";

      let factorX = deltaX;
      let factorY = deltaY;
      if (corner.includes("w")) factorX = -deltaX;
      if (corner.includes("n")) factorY = -deltaY;

      const rect = containerRef.current?.getBoundingClientRect();
      const canvasScale = (rect && rect.width > 0) ? (rect.width / 1920) : 0.5;

      const initDiag = Math.hypot(resizing.initWidth, resizing.initHeight) || 200;
      const scaleDelta = ((factorX + factorY) / 2) / Math.max(0.1, canvasScale);
      const scaleFactor = Math.max(0.1, Math.min(5, (initDiag + scaleDelta) / initDiag));

      if (resizing.type === "image") {
        const newWidth = Math.max(40, Math.min(1920, Math.round(resizing.initWidth * scaleFactor)));
        const newHeight = Math.max(30, Math.min(1080, Math.round(resizing.initHeight * scaleFactor)));
        onUpdateElement?.(resizing.id, {
          placement: { ...resizing.initPlacement, width: newWidth, height: newHeight },
          hasMoved: true,
          isDragging: true,
        });
      } else {
        const newFontSize = Math.max(10, Math.min(600, Math.round(resizing.initRawFontSize * scaleFactor)));
        onUpdateElement?.(resizing.id, {
          style: { ...resizing.initStyle, fontSize: newFontSize },
          placement: { ...resizing.initPlacement, width: "fit-content" },
          hasMoved: true,
          isDragging: true,
        });
      }
    };

    const handlePointerUp = () => {
      if (resizing) {
        onUpdateElement?.(resizing.id, { isDragging: false });
      }
      setResizing(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [resizing, onUpdateElement]);

  // Handle Marquee Drag Selection on Canvas
  useEffect(() => {
    if (!marquee) return;

    const handlePointerMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      const curX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const curY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      setMarquee((prev) => (prev ? { ...prev, currentX: curX, currentY: curY } : null));

      const mLeft = Math.min(marquee.startX, curX);
      const mTop = Math.min(marquee.startY, curY);
      const mRight = Math.max(marquee.startX, curX);
      const mBottom = Math.max(marquee.startY, curY);

      const newlySelected = [];
      visibleElements.forEach((el) => {
        const dyn = getDynamicPlacement(el);
        if (!dyn) return;
        const elLeft = (dyn.leftPercent / 100) * rect.width;
        const elTop = (dyn.topPercent / 100) * rect.height;
        const elRight = elLeft + (dyn.widthPercent / 100) * rect.width;
        const elBottom = elTop + (dyn.heightPercent / 100) * rect.height;

        const intersects = !(elRight < mLeft || elLeft > mRight || elBottom < mTop || elTop > mBottom);
        if (intersects) {
          newlySelected.push(el.id);
        }
      });

      if (newlySelected.length > 0) {
        onSelectElements?.(newlySelected);
        onSelectElement?.(newlySelected[0]);
      }
    };

    const handlePointerUp = () => {
      setMarquee(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [marquee, visibleElements, onSelectElement, onSelectElements]);

  const handleLayerChange = (elId, action) => {
    const target = (elements || []).find((e) => e.id === elId);
    if (!target) return;
    const currentZ = parseInt(target.style?.zIndex, 10) || 10;
    let newZ = currentZ;
    if (action === "front") newZ = 100;
    else if (action === "forward") newZ = currentZ + 1;
    else if (action === "backward") newZ = Math.max(1, currentZ - 1);
    else if (action === "back") newZ = 1;

    onUpdateElement?.(elId, {
      style: {
        ...(target.style || {}),
        zIndex: newZ,
      },
      isModified: true,
    });
    setContextMenu(null);
  };

  return (
    <div
      ref={containerRef}
      className="elements-canvas-overlay"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: isPlaying ? "none" : "auto",
        zIndex: 40,
        overflow: "hidden",
      }}
      onPointerDown={(e) => {
        if (e.target === containerRef.current) {
          // Check if user clicked on any element (text, symbol, image) inside the live iframe
          if (compositionIframeRef?.current) {
            try {
              const iframe = compositionIframeRef.current;
              const doc = iframe.contentDocument || iframe.contentWindow?.document;
              const iframeDoc = doc;
              const docW = iframeDoc?.documentElement?.clientWidth || 1920;
              const docH = iframeDoc?.documentElement?.clientHeight || 1080;
              const rect = containerRef.current.getBoundingClientRect();
              const clickX = ((e.clientX - rect.left) / rect.width) * docW;
              const clickY = ((e.clientY - rect.top) / rect.height) * docH;

              let targetDoc = doc;
              let targetWin = iframe.contentWindow;
              let localClickX = clickX;
              let localClickY = clickY;
              let activeSubIframe = null;

              // Check if click coordinates fall inside an active sub-iframe (subcomposition)
              const subIframes = Array.from(doc.querySelectorAll("iframe"));
              for (const subIfr of subIframes) {
                try {
                  const sRect = subIfr.getBoundingClientRect();
                  const sStyle = subIfr.ownerDocument.defaultView?.getComputedStyle(subIfr);
                  const parentStyle = subIfr.parentElement ? subIfr.ownerDocument.defaultView?.getComputedStyle(subIfr.parentElement) : null;
                  const isVisible = sStyle?.visibility !== "hidden" && sStyle?.opacity !== "0" && sStyle?.display !== "none" &&
                    parentStyle?.visibility !== "hidden" && parentStyle?.opacity !== "0" && parentStyle?.display !== "none";
                  if (isVisible && clickX >= sRect.left && clickX <= sRect.right && clickY >= sRect.top && clickY <= sRect.bottom) {
                    const sDoc = subIfr.contentDocument || subIfr.contentWindow?.document;
                    if (sDoc) {
                      targetDoc = sDoc;
                      targetWin = subIfr.contentWindow;
                      localClickX = clickX - sRect.left;
                      localClickY = clickY - sRect.top;
                      activeSubIframe = subIfr;
                      break;
                    }
                  }
                } catch (err) {}
              }

              // Fallback: if top-level elementFromPoint hits an iframe, pierce it
              if (targetDoc === doc) {
                const topHit = doc.elementFromPoint ? doc.elementFromPoint(clickX, clickY) : null;
                if (topHit && topHit.tagName?.toLowerCase() === "iframe") {
                  try {
                    const sDoc = topHit.contentDocument || topHit.contentWindow?.document;
                    if (sDoc) {
                      const sRect = topHit.getBoundingClientRect();
                      targetDoc = sDoc;
                      targetWin = topHit.contentWindow;
                      localClickX = clickX - sRect.left;
                      localClickY = clickY - sRect.top;
                      activeSubIframe = topHit;
                    }
                  } catch (err) {}
                }
              }

              const isIgnored = (el) => {
                if (!el || !el.tagName) return true;
                const tag = el.tagName.toLowerCase();
                if (["html", "body", "main", "video", "iframe"].includes(tag)) return true;
                if (["composition", "root", "scenes", "hud", "barTop", "barBot", "flare"].includes(el.id)) return true;
                const cls = typeof el.className === "string" ? el.className.toLowerCase() : (typeof el.className === "object" && el.className?.baseVal ? el.className.baseVal.toLowerCase() : "");
                if (cls.includes("scene-background") || cls.includes("grid-overlay") || cls.includes("film-grain") || cls.includes("grain") || cls.includes("scene-overlay") || cls.includes("progress-track") || cls.includes("progress-bar") || cls.includes("flare") || cls.includes("ambient-glow-orb")) return true;
                return false;
              };

              // TIER 1: Exact direct hit at (localClickX, localClickY)
              const directHit = targetDoc.elementFromPoint ? targetDoc.elementFromPoint(localClickX, localClickY) : null;
              if (directHit && !isIgnored(directHit)) {
                // 1a. Check exact match by data-hf-id or id on directHit or its closest ancestor
                const directTarget = directHit.closest?.("[data-hf-id], [id]");
                const directId = directHit.getAttribute?.("data-hf-id") || directHit.id || directTarget?.getAttribute?.("data-hf-id") || directTarget?.id;
                if (directId) {
                  const directMatch = (elements || []).find((el) => el.id === directId);
                  if (directMatch) {
                    e.stopPropagation();
                    onSelectElement?.(directMatch.id);
                    onSelectElements?.([directMatch.id]);
                    return;
                  }
                }

                // 1b. If directHit is a container (e.g. .panel, .columns, .card), find child element closest to (localClickX, localClickY)
                const cardContainer = directHit.closest?.(".panel, .card, .columns, [class*='panel'], [class*='card']");
                if (cardContainer) {
                  const candidateChildren = Array.from(cardContainer.querySelectorAll("[data-hf-id], h1, h2, h3, h4, h5, h6, p, .label, .caption, span"));
                  let closestEl = null;
                  let closestDist = Infinity;
                  for (const child of candidateChildren) {
                    const cId = child.getAttribute("data-hf-id") || child.id;
                    const matchedEl = cId ? (elements || []).find((el) => el.id === cId) : null;
                    if (matchedEl) {
                      const cr = child.getBoundingClientRect();
                      const centerX = cr.left + cr.width / 2;
                      const centerY = cr.top + cr.height / 2;
                      const dist = Math.hypot(localClickX - centerX, localClickY - centerY);
                      if (dist < closestDist) {
                        closestDist = dist;
                        closestEl = matchedEl;
                      }
                    }
                  }
                  if (closestEl && closestDist < 350) {
                    e.stopPropagation();
                    onSelectElement?.(closestEl.id);
                    onSelectElements?.([closestEl.id]);
                    return;
                  }
                }
              }

              // TIER 2: Multi-point probing for thin, rotated, or small elements
              const probeOffsets = [
                [0, 0],
                [-12, 0], [12, 0], [0, -12], [0, 12],
                [-20, 0], [20, 0], [0, -20], [0, 20],
                [-15, -15], [15, 15], [-15, 15], [15, -15],
                [-30, 0], [30, 0]
              ];
              const hitSet = new Set();
              const hits = [];
              for (const [ox, oy] of probeOffsets) {
                const px = localClickX + ox;
                const py = localClickY + oy;
                const ptHits = targetDoc.elementsFromPoint ? targetDoc.elementsFromPoint(px, py) : [targetDoc.elementFromPoint(px, py)].filter(Boolean);
                for (const h of ptHits) {
                  if (h && !hitSet.has(h)) {
                    hitSet.add(h);
                    hits.push(h);
                  }
                }
              }
              // If targetDoc is sub-iframe, also probe main doc for global elements (topbar, watermark)
              if (targetDoc !== doc) {
                for (const [ox, oy] of probeOffsets) {
                  const px = clickX + ox;
                  const py = clickY + oy;
                  const topHits = doc.elementsFromPoint ? doc.elementsFromPoint(px, py) : [doc.elementFromPoint(px, py)].filter(Boolean);
                  for (const h of topHits) {
                    if (h && h.tagName?.toLowerCase() !== "iframe" && !hitSet.has(h)) {
                      hitSet.add(h);
                      hits.push(h);
                    }
                  }
                }
              }

              // Check if any hit matches an extracted element by exact ID first
              for (const h of hits) {
                if (isIgnored(h)) continue;
                const hId = h.getAttribute?.("data-hf-id") || h.id;
                if (hId) {
                  const matchById = (elements || []).find((el) => el.id === hId);
                  if (matchById) {
                    e.stopPropagation();
                    onSelectElement?.(matchById.id);
                    onSelectElements?.([matchById.id]);
                    return;
                  }
                }
              }

              // Check if hit is inside an SVG (prioritize child shapes with data-hf-id!)
              for (const h of hits) {
                if (isIgnored(h)) continue;
                const svgParent = h.closest?.("svg");
                if (svgParent) {
                  // Check child shape first
                  const childShape = h.closest?.("[data-hf-id]");
                  const childId = childShape?.getAttribute("data-hf-id");
                  if (childId) {
                    const matchChild = (elements || []).find((el) => el.id === childId);
                    if (matchChild) {
                      e.stopPropagation();
                      onSelectElement?.(matchChild.id);
                      onSelectElements?.([matchChild.id]);
                      return;
                    }
                  }
                  // Fall back to parent SVG
                  const svgId = svgParent.getAttribute("data-hf-id") || svgParent.id;
                  const matchedSvg = (elements || []).find((el) => svgId && el.id === svgId);
                  if (matchedSvg) {
                    e.stopPropagation();
                    onSelectElement?.(matchedSvg.id);
                    onSelectElements?.([matchedSvg.id]);
                    return;
                  }
                }
              }

              // Check text match strictly on leaf text elements (never layout sections / columns / cards!)
              for (const h of hits) {
                if (isIgnored(h)) continue;
                const tag = h.tagName.toLowerCase();
                if (["section", "main", "body", "html", "svg"].includes(tag) || h.classList?.contains("columns") || h.classList?.contains("scene") || h.classList?.contains("panel")) continue;

                const container = h.closest?.(TEXT_CONTAINERS_QUERY) || h;
                const targetH = isIgnored(container) ? h : container;
                const targetTag = targetH.tagName.toLowerCase();
                if (["section", "main", "body", "html", "svg"].includes(targetTag) || targetH.classList?.contains("columns") || targetH.classList?.contains("scene") || targetH.classList?.contains("panel")) continue;

                const hId = targetH.getAttribute("data-hf-id") || targetH.id || h.getAttribute("data-hf-id") || h.id;
                const hText = (targetH.textContent || h.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
                const matched = (elements || []).find((el) => {
                  if (hId && el.id === hId) return true;
                  if (hText && el.text) {
                    const et = el.text.replace(/\s+/g, " ").trim().toLowerCase();
                    if (et === hText) return true;
                    if (et.length >= 6 && hText === et) return true;
                  }
                  return false;
                });
                if (matched) {
                  e.stopPropagation();
                  onSelectElement?.(matched.id);
                  onSelectElements?.([matched.id]);
                  return;
                }
              }

              // Look for Illustrations, Shapes, Symbols, Glyphs, Icons
              let symbolEl = null;
              for (const h of hits) {
                if (isIgnored(h)) continue;
                const t = h.tagName.toLowerCase();
                const cls = typeof h.className === "string" ? h.className.toLowerCase() : "";
                const isSymbol = cls.includes("glyph") || cls.includes("symbol") || cls.includes("icon") || cls.includes("orbit") || cls.includes("visual") || cls.includes("spear") || cls.includes("battleline") || cls.includes("rule") || cls.includes("map") || (t === "svg" && !cls.includes("skyline") && !cls.includes("background"));
                if (isSymbol) {
                  symbolEl = h;
                  break;
                }
              }

              if (symbolEl && onAddElement) {
                e.stopPropagation();
                const symRect = symbolEl.getBoundingClientRect();
                const targetHfId = symbolEl.getAttribute("data-hf-id") || symbolEl.id;
                const newId = targetHfId || `el-sym-${Date.now()}`;
                if (!symbolEl.getAttribute("data-hf-id")) symbolEl.setAttribute("data-hf-id", newId);
                const symCls = typeof symbolEl.className === "string" ? symbolEl.className : "";
                const symLabel = symCls.includes("spear") ? `Spear (${symCls.includes("left") ? "Left" : "Right"})` : symCls.includes("battleline") ? "Battleline" : symCls.includes("rule") ? "Accent Rule" : symCls.includes("map") ? "Map Graphic" : (symbolEl.textContent?.trim() || "Illustration");
                const newEl = {
                  id: newId,
                  sceneStart: Math.max(0, currentTime - 1),
                  sceneDuration: 12,
                  tag: symbolEl.tagName.toLowerCase(),
                  type: "image",
                  name: `Graphic: ${symLabel.slice(0, 18)}`,
                  text: symLabel,
                  originalText: symLabel,
                  isModified: false,
                  style: {
                    color: "#e8c27a",
                    textAlign: "center",
                  },
                  placement: {
                    x: symRect ? (symRect.left / docW) * 100 : (clickX / docW) * 100,
                    y: symRect ? (symRect.top / docH) * 100 : (clickY / docH) * 100,
                    width: symRect ? Math.max(40, symRect.width) : 60,
                    height: symRect ? Math.max(20, symRect.height) : 60,
                    isTopLeft: true,
                  },
                  visible: true,
                };
                onAddElement(newEl);
                onSelectElement?.(newId);
                onSelectElements?.([newId]);
                return;
              }

              // Check for real image or SVG graphics (never match background gradient/containers!)
              let imgEl = null;
              for (const h of hits) {
                if (isIgnored(h)) continue;
                const t = h.tagName.toLowerCase();
                const cls = typeof h.className === "string" ? h.className.toLowerCase() : "";
                const svgParent = h.closest?.("svg");
                if (svgParent && !isIgnored(svgParent)) {
                  imgEl = svgParent;
                  break;
                }
                if (t === "img" || cls.includes("product-image") || cls.includes("feature-image") || (cls.includes("img") && !cls.includes("scene-background")) || (t === "svg" && !cls.includes("background"))) {
                  imgEl = h;
                  break;
                }
              }

              // Handle Image/SVG selection
              if (imgEl && onAddElement) {
                e.stopPropagation();
                const targetSrc = imgEl.getAttribute("src") || "";
                const targetHfId = imgEl.getAttribute("data-hf-id") || imgEl.id;
                const imgRect = imgEl.getBoundingClientRect();
                const newId = targetHfId || `el-img-${Date.now()}`;
                if (!imgEl.getAttribute("data-hf-id")) imgEl.setAttribute("data-hf-id", newId);
                const isSvg = imgEl.tagName.toLowerCase() === "svg";
                const newEl = {
                  id: newId,
                  sceneStart: Math.max(0, currentTime - 1),
                  sceneDuration: 6,
                  tag: isSvg ? "svg" : "img",
                  type: "image",
                  name: isSvg ? "Graphic: Skyline" : `Image: ${imgEl.alt || "Visual"}`,
                  src: targetSrc,
                  isModified: false,
                  style: { objectFit: "contain" },
                  placement: {
                    x: (imgRect.left / docW) * 100,
                    y: (imgRect.top / docH) * 100,
                    width: imgRect.width || 400,
                    height: imgRect.height || 250,
                    isTopLeft: true,
                  },
                  visible: true,
                };
                onAddElement(newEl);
                onSelectElement?.(newId);
                onSelectElements?.([newId]);
                return;
              }

              // Look for text elements (h1-h6, p, span, button, a, or class-based text)
                let textEl = null;
                for (const h of hits) {
                  if (isIgnored(h)) continue;
                  // Ascend to the highest recognized text container!
                  const container = h.closest?.(TEXT_CONTAINERS_QUERY);
                  const cand = container && !isIgnored(container) ? container : h;
                  const t = cand.tagName.toLowerCase();
                  const cls = typeof cand.className === "string" ? cand.className.toLowerCase() : "";
                  const isTextTag = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "button", "a", "div", "span"].includes(t);
                  const isTextCls = cls.includes("headline") || cls.includes("title") || cls.includes("description") || cls.includes("eyebrow") || cls.includes("kicker") || cls.includes("scene-number") || cls.includes("num") || cls.includes("pill") || cls.includes("big") || cls.includes("mega");
                  const candText = cand.textContent?.replace(/\s+/g, " ").trim() || "";
                  if ((isTextTag || isTextCls) && candText.length > 0 && candText.length < 500) {
                    textEl = cand;
                    break;
                  }
                }

                // Handle Text selection
                if (textEl && textEl.textContent && textEl.textContent.trim().length > 0 && onAddElement) {
                  const clickedText = textEl.textContent.replace(/\s+/g, " ").trim();
                  const targetHfId = textEl.getAttribute("data-hf-id") || textEl.id;
                  const tag = textEl.tagName ? textEl.tagName.toLowerCase() : "p";
                  e.stopPropagation();
                  const newId = targetHfId || `el-detected-${Date.now()}`;
                  if (!textEl.getAttribute("data-hf-id")) textEl.setAttribute("data-hf-id", newId);
                  const cls = typeof textEl.className === "string" ? textEl.className.toLowerCase() : "";
                  const isH = tag.startsWith("h") || cls.includes("headline") || cls.includes("title") || cls.includes("big") || cls.includes("mega");
                  const isPill = cls.includes("eyebrow") || cls.includes("kicker") || cls.includes("scene-number") || cls.includes("badge") || cls.includes("pill");
                  const isStat = cls.includes("metric") || cls.includes("stat") || cls.includes("value") || cls.includes("display-font");
                  const newType = isH ? "heading" : isPill ? "badge" : "text";
                  const friendlyLabel = isH ? "Title" : isPill ? "Badge" : isStat ? "Metric" : "Text";
                  const tRect = textEl.getBoundingClientRect();

                  const subHost = activeSubIframe?.parentElement;
                  const subFile = activeSubIframe?.getAttribute("src") || subHost?.getAttribute("data-composition-src") || "index.html";
                  const subId = subHost?.id || subHost?.getAttribute("data-composition-id") || "scene-1";
                  const subStart = parseFloat(subHost?.getAttribute("data-start") || "0") || Math.max(0, currentTime - 1);
                  const subDur = parseFloat(subHost?.getAttribute("data-duration") || "10") || 10;
                  const sRect = activeSubIframe ? activeSubIframe.getBoundingClientRect() : null;

                  const posX = tRect ? (( (sRect ? sRect.left : 0) + tRect.left) / 1920) * 100 : (clickX / 1920) * 100;
                  const posY = tRect ? (( (sRect ? sRect.top : 0) + tRect.top) / 1080) * 100 : (clickY / 1080) * 100;

                  const newEl = {
                    id: newId,
                    sceneId: subId,
                    file: subFile,
                    sceneStart: subStart,
                    sceneDuration: subDur,
                    tag,
                    type: newType,
                    name: `${friendlyLabel}: ${clickedText.slice(0, 20)}`,
                    text: clickedText,
                    originalText: clickedText,
                    isModified: false,
                    style: {
                      fontFamily: isH ? "Georgia, 'Times New Roman', serif" : "'Inter', sans-serif",
                      fontSize: isH ? 48 : isStat ? 32 : 24,
                      color: "#ffffff",
                      textAlign: "left",
                    },
                    placement: {
                      x: Math.max(0, Math.min(95, posX)),
                      y: Math.max(0, Math.min(95, posY)),
                      width: tRect ? Math.max(60, tRect.width) : 300,
                      height: tRect ? Math.max(24, tRect.height) : 40,
                      isTopLeft: true,
                    },
                    visible: true,
                  };
                  onAddElement(newEl);
                  onSelectElement?.(newId);
                  onSelectElements?.([newId]);
                  return;
                }
            } catch (err) {
              console.warn("Error picking element from point:", err);
            }
          }

          // Clicking empty canvas: start rubber-band / marquee drag selection
          const rect = containerRef.current.getBoundingClientRect();
          const sx = Math.max(0, e.clientX - rect.left);
          const sy = Math.max(0, e.clientY - rect.top);
          setMarquee({ startX: sx, startY: sy, currentX: sx, currentY: sy });
          onSelectElement?.(null);
          onSelectElements?.([]);
          setInlineEditingId(null);
        }
      }}
    >
      {visibleElements.map((el) => {
        const isSelected = selectedSet.has(el.id);
        const isHovered = el.id === hoveredElementId;
        const dynamic = getDynamicPlacement(el);

        const posX = dynamic ? dynamic.leftPercent : (el.placement?.x ?? 50);
        const posY = dynamic ? dynamic.topPercent : (el.placement?.y ?? 50);

        const isHeading = el.type === "heading" || el.tag === "h1" || el.tag === "h2" || el.tag === "h3";
        const isImage = el.type === "image" || el.tag === "img" || el.tag === "svg" || el.field === "image";
        const isButton = el.type === "button" || el.tag === "button" || el.type === "cta";
        const isBackgroundVisual = isImage || el.tag === "svg" || el.field === "image" || (el.id && el.id.includes("visual"));

        const scale = frameWidth > 0 ? frameWidth / 1920 : 1;
        const rawFontSize = el.style?.fontSize || (isHeading ? 48 : 24);
        const fontSize = Math.max(14, Math.round(rawFontSize * scale));
        const fontFamily = el.style?.fontFamily || (isHeading ? "'Cinzel', serif" : "'Outfit', sans-serif");
        const color = el.style?.color || (isHeading ? "#ffffff" : "#e2e8f0");
        const textAlign = el.style?.textAlign || (isHeading ? "center" : "left");
        const opacity = el.style?.opacity ?? 1;

        const boxLeft = `${posX}%`;
        const boxTop = `${posY}%`;
        const boxWidth = dynamic
          ? `${dynamic.widthPercent}%`
          : (isImage && el.placement?.width ? `${Math.min(95, (el.placement.width / 1920) * 100)}%` : (isImage ? "auto" : "fit-content"));
        const boxHeight = dynamic
          ? `${dynamic.heightPercent}%`
          : (isImage && el.placement?.height ? `${Math.min(95, (el.placement.height / 1080) * 100)}%` : "auto");

        return (
          <React.Fragment key={el.id}>
            <div
              data-element-id={el.id}
              data-is-selected={isSelected ? "true" : undefined}
              onMouseEnter={() => onHoverElement?.(el.id)}
              onMouseLeave={() => onHoverElement?.(null)}
              onPointerDown={(e) => {
                if (inlineEditingId === el.id) return;

                // If clicking inside a smaller nested element at these coordinates, prioritize the smaller element
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  const clickX = e.clientX;
                  const clickY = e.clientY;
                  const myArea = (dynamic?.widthPx || 100) * (dynamic?.heightPx || 100);
                  const smallerCandidate = visibleElements.find((other) => {
                    if (other.id === el.id) return false;
                    const otherBox = containerRef.current?.querySelector(`[data-element-id="${other.id}"]`);
                    if (!otherBox) return false;
                    const or = otherBox.getBoundingClientRect();
                    if (clickX >= or.left && clickX <= or.right && clickY >= or.top && clickY <= or.bottom) {
                      const otherArea = or.width * or.height;
                      return otherArea < myArea;
                    }
                    return false;
                  });
                  if (smallerCandidate) {
                    e.stopPropagation();
                    onSelectElement?.(smallerCandidate.id);
                    onSelectElements?.([smallerCandidate.id]);
                    return;
                  }
                }

                e.stopPropagation();
                onSelectElement?.(el.id);
                const isMulti = selectedSet.has(el.id) && selectedSet.size > 1;
                if (!isMulti) {
                  onSelectElements?.([el.id]);
                }

                const itemsToMove = isMulti
                  ? Array.from(selectedSet).map((id) => {
                      const itemEl = (elements || []).find((x) => x.id === id);
                      const dyn = itemEl ? getDynamicPlacement(itemEl) : null;
                      return {
                        id,
                        initX: dyn ? dyn.leftPercent : (itemEl?.placement?.x ?? 50),
                        initY: dyn ? dyn.topPercent : (itemEl?.placement?.y ?? 50),
                        initPlacement: {
                          ...itemEl?.placement,
                          width: itemEl?.placement?.width || dyn?.widthPx,
                          height: itemEl?.placement?.height || dyn?.heightPx,
                          isTopLeft: true,
                        },
                      };
                    })
                  : [{
                      id: el.id,
                      initX: dynamic ? dynamic.leftPercent : posX,
                      initY: dynamic ? dynamic.topPercent : posY,
                      initPlacement: {
                        ...el.placement,
                        width: el.placement?.width || dynamic?.widthPx,
                        height: el.placement?.height || dynamic?.heightPx,
                        isTopLeft: true,
                      },
                    }];

                setDragging({
                  id: el.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  hasMovedEnough: false,
                  items: itemsToMove,
                });
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!isImage) {
                  setInlineEditingId(el.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelectElement?.(el.id);
                const rect = containerRef.current?.getBoundingClientRect();
                const pX = e.clientX - (rect?.left || 0);
                const pY = e.clientY - (rect?.top || 0);
                setContextMenu({
                  x: Math.min(pX, (rect?.width || 800) - 180),
                  y: Math.min(pY, (rect?.height || 500) - 220),
                  elementId: el.id,
                });
              }}
              style={{
                position: "absolute",
                left: boxLeft,
                top: boxTop,
                width: boxWidth,
                height: boxHeight,
                minWidth: "auto",
                minHeight: "auto",
                transform: "none",
                cursor: isSelected ? "move" : "pointer",
                userSelect: "none",
                pointerEvents: "auto",
                background: "rgba(0, 0, 0, 0.001)",
                zIndex: isSelected ? 35 : isHovered ? (isBackgroundVisual ? 14 : 25) : (isBackgroundVisual ? 5 : 15),
                maxWidth: "96%",
                boxSizing: "border-box",
                outline: isSelected
                  ? "2px solid #38bdf8"
                  : isHovered
                  ? "2px dashed #00f0ff"
                  : "none",
                outlineOffset: "3px",
                boxShadow: isSelected
                  ? "0 0 16px rgba(56, 189, 248, 0.6), inset 0 0 0 1px rgba(255,255,255,0.4)"
                  : isHovered
                  ? "0 0 12px rgba(0, 240, 255, 0.4)"
                  : "none",
                borderRadius: "3px",
                padding: "0px",
                transition: isSelected || dragging ? "none" : "outline 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              {/* Tag badge floating above element on hover or selection */}
              {(isSelected || isHovered) && (
                <div
                  style={{
                    position: "absolute",
                    ...(posY < 26 ? { top: "calc(100% + 6px)" } : { bottom: "100%", marginBottom: "4px" }),
                    left: "0",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: isSelected ? "#0284c7" : "#0f172a",
                    color: "#ffffff",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    zIndex: 40,
                    maxWidth: "max(120px, 100%)",
                    pointerEvents: "none",
                  }}
                >
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {getFriendlyElementLabel(el)}
                  </span>
                  {isSelected && !isImage && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineEditingId(el.id);
                      }}
                      title="Edit text content"
                      style={{
                        pointerEvents: "auto",
                        background: "rgba(255,255,255,0.25)",
                        border: "none",
                        color: "#fff",
                        borderRadius: "3px",
                        padding: "1px 5px",
                        fontSize: "9px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        flexShrink: 0,
                      }}
                    >
                      ✎ Edit
                    </button>
                  )}
                  {isSelected && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteElement?.(el.id);
                      }}
                      title="Delete element"
                      style={{
                        pointerEvents: "auto",
                        background: "rgba(239,68,68,0.85)",
                        border: "none",
                        color: "#fff",
                        borderRadius: "3px",
                        padding: "1px 5px",
                        fontSize: "9px",
                        fontWeight: 700,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      ✕ Del
                    </button>
                  )}
                </div>
              )}

              {/* Content rendering based on type */}
              {isImage ? null : isButton || el.tag === "pill" ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: el.tag === "pill" ? "8px 24px" : "10px 24px",
                    background: "transparent",
                    border: "none",
                    color: inlineEditingId === el.id ? (el.style?.color || "#e8c27a") : "transparent",
                    fontFamily,
                    fontSize: `${fontSize}px`,
                    fontWeight: 700,
                    borderRadius: el.tag === "pill" ? "50px" : "30px",
                    boxShadow: "none",
                    letterSpacing: el.tag === "pill" ? "0.2em" : "0.02em",
                    textTransform: el.tag === "pill" ? "uppercase" : "none",
                  }}
                >
                  {inlineEditingId === el.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={el.text || ""}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdateElement?.(el.id, { text: e.target.value, isModified: true })}
                      onBlur={() => setInlineEditingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setInlineEditingId(null);
                        if (e.key === "Escape") setInlineEditingId(null);
                      }}
                      style={{
                        background: "rgba(11, 13, 20, 0.95)",
                        color: el.tag === "pill" ? "#e8c27a" : "#ffffff",
                        font: "inherit",
                        border: "2px solid #38bdf8",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        outline: "none",
                        width: "100%",
                        height: "100%",
                        boxSizing: "border-box",
                        boxShadow: "0 0 16px rgba(56, 189, 248, 0.6)",
                      }}
                    />
                  ) : (
                    el.text || (el.tag === "pill" ? "6:30 PM" : "Click Here")
                  )}
                </div>
              ) : (
                // Headings and Text Elements
                <div
                  style={{
                    fontFamily,
                    fontSize: `${fontSize}px`,
                    color: inlineEditingId === el.id ? color : "transparent",
                    textAlign,
                    opacity,
                    fontWeight: isHeading ? 700 : 400,
                    lineHeight: 1.15,
                    letterSpacing: isHeading ? "-0.01em" : "normal",
                    textShadow: "none",
                    background: "transparent",
                    backdropFilter: "none",
                    borderRadius: "4px",
                    padding: "0px",
                    boxShadow: "none",
                    whiteSpace: "pre-wrap",
                    width: "100%",
                    height: "100%",
                    minHeight: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  {inlineEditingId === el.id ? (
                    <textarea
                      autoFocus
                      rows={Math.max(2, (el.text || "").split("\n").length + 1)}
                      value={el.text || ""}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdateElement?.(el.id, { text: e.target.value, isModified: true })}
                      onBlur={() => setInlineEditingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          setInlineEditingId(null);
                        }
                        if (e.key === "Escape") {
                          setInlineEditingId(null);
                        }
                      }}
                      style={{
                        background: "rgba(11, 13, 20, 0.95)",
                        color: "#ffffff",
                        fontFamily: "inherit",
                        fontSize: `${fontSize}px`,
                        fontWeight: isHeading ? 700 : 400,
                        lineHeight: 1.15,
                        textAlign,
                        border: "2px solid #38bdf8",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        outline: "none",
                        width: "100%",
                        minWidth: "100%",
                        height: "100%",
                        minHeight: "100%",
                        boxSizing: "border-box",
                        resize: "both",
                        boxShadow: "0 0 16px rgba(56, 189, 248, 0.6)",
                      }}
                    />
                  ) : (
                    el.text || ""
                  )}
                </div>
              )}

            {/* Resize Handles (Only shown when selected) */}
            {isSelected && !isPlaying && (
              <>
                {/* 4 Corner Resize Handles */}
                {["nw", "ne", "se", "sw"].map((corner) => (
                  <div
                    key={corner}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onStartMove?.();
                      const dyn = getDynamicPlacement(el);
                      let liveComputedFontSize = rawFontSize;
                      try {
                        const iframe = compositionIframeRef?.current;
                        const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
                        if (doc) {
                          const liveEl = findLiveElementInDoc(doc, el);
                          if (liveEl) {
                            const win = doc.defaultView || iframe.contentWindow;
                            const fs = parseFloat(win.getComputedStyle(liveEl).fontSize);
                            if (Number.isFinite(fs) && fs > 0) liveComputedFontSize = fs;
                          }
                        }
                      } catch (err) {}

                      setResizing({
                        id: el.id,
                        corner,
                        type: isImage ? "image" : "text",
                        startX: e.clientX,
                        startY: e.clientY,
                        initWidth: dyn?.widthPx || el.placement?.width || 200,
                        initHeight: dyn?.heightPx || el.placement?.height || 60,
                        initRawFontSize: liveComputedFontSize,
                        initPlacement: {
                          ...el.placement,
                          x: (typeof el.placement?.x === "number" && !isNaN(el.placement.x)) ? el.placement.x : (dyn?.leftPercent ?? 0),
                          y: (typeof el.placement?.y === "number" && !isNaN(el.placement.y)) ? el.placement.y : (dyn?.topPercent ?? 0),
                          width: dyn?.widthPx || el.placement?.width || 200,
                          height: dyn?.heightPx || el.placement?.height || 60,
                          isTopLeft: true,
                        },
                        initStyle: el.style || {},
                      });
                    }}
                    style={{
                      position: "absolute",
                      width: "10px",
                      height: "10px",
                      background: "#38bdf8",
                      border: "2px solid #ffffff",
                      borderRadius: "2px",
                      top: corner.includes("n") ? "-6px" : "calc(100% - 4px)",
                      left: corner.includes("w") ? "-6px" : "calc(100% - 4px)",
                      cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
                      zIndex: 45,
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </React.Fragment>
      );
    })}

      {/* Marquee Drag Selection Box */}
      {marquee && (
        <div
          style={{
            position: "absolute",
            left: `${Math.min(marquee.startX, marquee.currentX)}px`,
            top: `${Math.min(marquee.startY, marquee.currentY)}px`,
            width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
            height: `${Math.abs(marquee.currentY - marquee.startY)}px`,
            border: "1.5px dashed #38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            pointerEvents: "none",
            zIndex: 50,
          }}
        />
      )}

      {contextMenu && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            background: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "8px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255,255,255,0.3)",
            padding: "6px",
            zIndex: 100,
            minWidth: "175px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <div
            style={{
              padding: "4px 8px 6px 8px",
              fontSize: "10px",
              fontWeight: 700,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              marginBottom: "3px",
            }}
          >
            Layer & Order
          </div>
          <button
            type="button"
            onClick={() => handleLayerChange(contextMenu.elementId, "front")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              fontSize: "12px",
              color: "#f8fafc",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(56, 189, 248, 0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: "14px" }}>⇪</span>
            <span>Bring to Front</span>
          </button>
          <button
            type="button"
            onClick={() => handleLayerChange(contextMenu.elementId, "forward")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              fontSize: "12px",
              color: "#f8fafc",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(56, 189, 248, 0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: "14px" }}>↑</span>
            <span>Bring Forward</span>
          </button>
          <button
            type="button"
            onClick={() => handleLayerChange(contextMenu.elementId, "backward")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              fontSize: "12px",
              color: "#f8fafc",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(56, 189, 248, 0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: "14px" }}>↓</span>
            <span>Send Backward</span>
          </button>
          <button
            type="button"
            onClick={() => handleLayerChange(contextMenu.elementId, "back")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              fontSize: "12px",
              color: "#f8fafc",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(56, 189, 248, 0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: "14px" }}>⇩</span>
            <span>Send to Back</span>
          </button>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />

          <button
            type="button"
            onClick={() => {
              setInlineEditingId(contextMenu.elementId);
              setContextMenu(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              fontSize: "12px",
              color: "#38bdf8",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(56, 189, 248, 0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span>✎</span>
            <span>Edit Text</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onDeleteElement?.(contextMenu.elementId);
              setContextMenu(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 10px",
              fontSize: "12px",
              color: "#f87171",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span>✕</span>
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

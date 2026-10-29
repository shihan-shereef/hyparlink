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
  const [dragging, setDragging] = useState(null); // { id, startX, startY, items: [] }
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
  // Helper to dynamically measure exact bounding rectangle from the live composition iframe DOM
  const getDynamicPlacement = (el) => {
    if (!compositionIframeRef?.current) return null;
    try {
      const iframe = compositionIframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return null;

      let targetEl = null;

      // Collect all documents to search (root doc and any subcomposition iframes)
      const docsToCheck = [doc];
      try {
        const subIframes = doc.querySelectorAll("iframe");
        for (const subIfr of subIframes) {
          const sd = subIfr.contentDocument || subIfr.contentWindow?.document;
          if (sd && !docsToCheck.includes(sd)) docsToCheck.push(sd);
        }
      } catch (err) {}

      // 0. Priority: Direct match by data-hf-id or id in any document
      if (el.id) {
        for (const currentDoc of docsToCheck) {
          const direct = currentDoc.querySelector(`[data-hf-id="${el.id}"], #${el.id}`);
          if (direct) {
            targetEl = direct;
            break;
          }
        }
      }

      // 1. Try matching by sceneIndex or sceneId
      if (!targetEl) {
        let sceneEl = null;
        if (el.sceneIndex !== undefined) {
          sceneEl = doc.getElementById(`sc${el.sceneIndex}`) ||
                    doc.querySelector(`[data-scene="${el.sceneIndex + 1}"]`) ||
                    doc.getElementById(`scene${el.sceneIndex + 1}`) ||
                    doc.getElementById(`scene-0${el.sceneIndex + 1}`) ||
                    doc.getElementById(`scene-${el.sceneIndex + 1}`) ||
                    doc.querySelectorAll(".scene, .ad-scene, section")[el.sceneIndex];
        }
        if (!sceneEl && el.sceneId) {
          sceneEl = doc.getElementById(el.sceneId) ||
                    doc.querySelector(`[data-scene="${el.sceneId}"]`) ||
                    doc.querySelector(`[data-composition-id="${el.sceneId}"]`);
        }

        if (sceneEl) {
          let searchContexts = [sceneEl];
          const innerIfr = sceneEl.querySelector("iframe");
          if (innerIfr) {
            const sd = innerIfr.contentDocument || innerIfr.contentWindow?.document;
            if (sd) searchContexts.unshift(sd);
          }

          for (const ctx of searchContexts) {
            if (el.type === "image" || el.tag === "img") {
              targetEl = ctx.querySelector("img, .product-image, .feature-image, .scene-background");
            } else if (el.field === "title" || el.tag === "h1" || el.tag === "h2" || el.tag === "h3" || el.type === "heading") {
              targetEl = ctx.querySelector(".headline, .hero-headline, .title.m, .mega.m, .big.m, .title, h1, h2, h3");
            } else if (el.field === "sub" || el.field === "subtitle" || el.field === "description" || el.tag === "p" || el.type === "text") {
              targetEl = ctx.querySelector(".description, .hero-subtitle, .sub.sb, .sub, p");
            } else if (el.field === "kicker" || el.field === "eyebrow") {
              targetEl = ctx.querySelector(".eyebrow, .kicker.k, .kicker");
            } else if (el.field === "time" || el.field === "badge" || el.tag === "pill") {
              targetEl = ctx.querySelector(".pill.k, .pill.k2, .badge-pill, .pill, .scene-number, .date, .corner-mark, .bottom-label");
            } else if (el.field === "n" || el.field === "number" || el.tag === "num") {
              targetEl = ctx.querySelector(".num.nm, .num, .scene-number");
            } else if (el.field === "cta" || el.type === "button") {
              targetEl = ctx.querySelector(".pill.k2, .pill, button, .cta, a.btn, a");
            }
            if (targetEl) break;
          }
        }
      }

      // 2. If not found in specific scene, check active/visible scene in all documents
      if (!targetEl) {
        for (const currentDoc of docsToCheck) {
          const scenes = currentDoc.querySelectorAll(".scene, .ad-scene, [data-composition-id], section");
          for (const scene of scenes) {
            const win = currentDoc.defaultView || iframe.contentWindow;
            const style = win?.getComputedStyle(scene);
            if (!style || style.display !== "none") {
              let candidate = null;
              if (el.type === "image" || el.tag === "img") {
                candidate = scene.querySelector("img, .product-image, .feature-image, .scene-background");
              } else if (el.field === "title" || el.tag === "h1" || el.type === "heading") {
                candidate = scene.querySelector(".headline, .hero-headline, .title.m, .mega.m, .big.m, .title, h1, h2, h3");
              } else if (el.field === "sub" || el.field === "description" || el.tag === "p") {
                candidate = scene.querySelector(".description, .hero-subtitle, .sub.sb, .sub, p");
              } else if (el.field === "kicker" || el.field === "eyebrow") {
                candidate = scene.querySelector(".eyebrow, .kicker.k, .kicker");
              } else if (el.field === "time" || el.field === "badge" || el.tag === "pill") {
                candidate = scene.querySelector(".pill.k, .pill.k2, .badge-pill, .pill, .scene-number, .date, .corner-mark, .bottom-label");
              }
              if (candidate) {
                targetEl = candidate;
                break;
              }
            }
          }
          if (targetEl) break;
        }
      }

      // 2b. Fallback image search across documents
      if (!targetEl && (el.type === "image" || el.tag === "img")) {
        for (const currentDoc of docsToCheck) {
          const imgs = currentDoc.querySelectorAll("img:not([hidden]), .product-image, .feature-image");
          if (imgs.length > 0) {
            const idx = el.sceneIndex !== undefined ? Math.min(imgs.length - 1, el.sceneIndex) : 0;
            targetEl = imgs[idx];
            break;
          }
        }
      }

      // 3. Fallback: match by text content in all documents
      if (!targetEl && el.text) {
        const needle = el.text.trim().toLowerCase();
        const shortNeedle = needle.slice(0, 15);
        if (shortNeedle.length >= 2) {
          for (const currentDoc of docsToCheck) {
            const candidates = currentDoc.querySelectorAll(".headline, .hero-headline, .title, .mega, .big, .description, .hero-subtitle, .sub, .eyebrow, .kicker, .scene-number, .num, .corner-mark, .date, .bottom-label, .pill, .badge-pill, h1, h2, h3, h4, p, span, button, a");
            for (const cand of candidates) {
              const candText = (cand.textContent || "").trim().toLowerCase();
              if (candText.includes(shortNeedle)) {
                targetEl = cand;
                break;
              }
            }
            if (targetEl) break;
          }
        }
      }

      if (!targetEl) return null;

      // Measure exact text bounds snug to the sentence (top to bottom, left to right)
      let r = null;
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
      }
      if (!r) {
        r = targetEl.getBoundingClientRect();
      }
      if (!r || r.width <= 0) return null;

      const left = Math.max(0, r.left - 2);
      const top = Math.max(0, r.top - 2);
      const width = Math.max(24, r.width + 4);
      const height = Math.max(16, (r.height > 0 ? r.height : 24) + 4);

      return {
        leftPercent: (left / 1920) * 100,
        topPercent: (top / 1080) * 100,
        widthPercent: (width / 1920) * 100,
        heightPercent: (height / 1080) * 100,
        widthPx: width,
        heightPx: height,
      };
    } catch (e) {
      return null;
    }
  };

  // Filter elements active at current playhead time
  const visibleElements = elements.filter((el) => {
    if (el.visible === false) return false;
    if (el.sceneStart === undefined || el.sceneDuration === undefined) return true;
    const end = el.sceneStart + el.sceneDuration + 0.3;
    return currentTime >= el.sceneStart && currentTime < end;
  });

  // Handle Multi-Element & Single-Element Dragging
  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      const deltaX = ((e.clientX - dragging.startX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragging.startY) / rect.height) * 100;

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
      if (dragging) {
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
  }, [dragging, onUpdateElement]);

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

      const combinedDelta = (factorX + factorY) / 2;
      const baseDim = resizing.initWidth || 200;
      const scaleFactor = Math.max(0.2, (baseDim + combinedDelta * 1.5) / baseDim);

      if (resizing.type === "image") {
        const newWidth = Math.max(40, Math.min(1920, Math.round(resizing.initWidth * scaleFactor)));
        const newHeight = Math.max(30, Math.min(1080, Math.round(resizing.initHeight * scaleFactor)));
        onUpdateElement?.(resizing.id, {
          placement: { ...resizing.initPlacement, width: newWidth, height: newHeight },
          hasMoved: true,
          isDragging: true,
        });
      } else {
        const newFontSize = Math.max(12, Math.min(160, Math.round(resizing.initRawFontSize * scaleFactor)));
        const newWidth = Math.max(40, Math.round(resizing.initWidth * scaleFactor));
        onUpdateElement?.(resizing.id, {
          style: { ...resizing.initStyle, fontSize: newFontSize },
          placement: { ...resizing.initPlacement, width: newWidth },
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
    const target = elements.find((e) => e.id === elId);
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
        pointerEvents: "none",
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
              if (doc) {
                const rect = containerRef.current.getBoundingClientRect();
                const clickX = ((e.clientX - rect.left) / rect.width) * 1920;
                const clickY = ((e.clientY - rect.top) / rect.height) * 1080;
                const hits = doc.elementsFromPoint ? doc.elementsFromPoint(clickX, clickY) : [doc.elementFromPoint(clickX, clickY)].filter(Boolean);

                const isIgnored = (el) => {
                  if (!el || !el.tagName) return true;
                  const tag = el.tagName.toLowerCase();
                  if (["html", "body", "main", "video"].includes(tag)) return true;
                  if (["composition", "root", "scenes", "hud", "barTop", "barBot", "flare"].includes(el.id)) return true;
                  const cls = typeof el.className === "string" ? el.className.toLowerCase() : "";
                  if (cls.includes("grid-overlay") || cls.includes("film-grain") || cls.includes("grain") || cls.includes("scene-background") || cls.includes("bg-") || cls.includes("scene-overlay") || cls.includes("progress-track") || cls.includes("progress-bar") || cls.includes("flare")) return true;
                  return false;
                };

                // Check if any hit matches an already extracted element
                for (const h of hits) {
                  if (isIgnored(h)) continue;
                  const hId = h.getAttribute("data-hf-id") || h.id;
                  const hText = h.textContent?.trim().toLowerCase();
                  const hSrc = h.getAttribute("src");
                  const matched = elements.find((el) => {
                    if (hId && el.id === hId) return true;
                    if (hSrc && el.src && (el.src.includes(hSrc) || hSrc.includes(el.src))) return true;
                    if (hText && el.text) {
                      const et = el.text.trim().toLowerCase();
                      return et === hText || et.includes(hText) || hText.includes(et);
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

                // Look for Symbols / Glyphs / Icons
                let symbolEl = null;
                for (const h of hits) {
                  if (isIgnored(h)) continue;
                  const t = h.tagName.toLowerCase();
                  const cls = typeof h.className === "string" ? h.className.toLowerCase() : "";
                  const isSymbol = cls.includes("glyph") || cls.includes("symbol") || cls.includes("icon") || cls.includes("orbit") || cls.includes("visual") || t === "svg";
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
                  const symText = symbolEl.textContent?.trim() || "◇";
                  const newEl = {
                    id: newId,
                    sceneStart: Math.max(0, currentTime - 1),
                    sceneDuration: 6,
                    tag: symbolEl.tagName.toLowerCase(),
                    type: "symbol",
                    name: `Symbol: ${symText.slice(0, 15)}`,
                    text: symText,
                    originalText: symText,
                    isModified: false,
                    style: {
                      fontSize: 28,
                      color: "#38bdf8",
                      textAlign: "center",
                    },
                    placement: {
                      x: symRect ? (symRect.left / 1920) * 100 : (clickX / 1920) * 100,
                      y: symRect ? (symRect.top / 1080) * 100 : (clickY / 1080) * 100,
                      width: symRect ? Math.max(30, symRect.width) : 50,
                      height: symRect ? Math.max(30, symRect.height) : 50,
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
                  const t = h.tagName.toLowerCase();
                  const cls = typeof h.className === "string" ? h.className.toLowerCase() : "";
                  const isTextTag = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "button", "a", "div"].includes(t);
                  const isTextCls = cls.includes("headline") || cls.includes("title") || cls.includes("description") || cls.includes("eyebrow") || cls.includes("kicker") || cls.includes("scene-number") || cls.includes("num") || cls.includes("pill");
                  if ((isTextTag || isTextCls) && h.textContent && h.textContent.trim().length > 0 && h.textContent.trim().length < 300) {
                    textEl = h;
                    break;
                  }
                }

                // Check for image element
                let imgEl = null;
                if (!textEl) {
                  for (const h of hits) {
                    if (isIgnored(h)) continue;
                    if (h.tagName === "IMG" || (typeof h.className === "string" && (h.className.includes("product-image") || h.className.includes("feature-image")))) {
                      imgEl = h;
                      break;
                    }
                  }
                }

                // Handle Image selection
                if (imgEl && onAddElement) {
                  e.stopPropagation();
                  const targetSrc = imgEl.getAttribute("src") || "";
                  const targetHfId = imgEl.getAttribute("data-hf-id") || imgEl.id;
                  const imgRect = imgEl.getBoundingClientRect();
                  const newId = targetHfId || `el-img-${Date.now()}`;
                  if (!imgEl.getAttribute("data-hf-id")) imgEl.setAttribute("data-hf-id", newId);
                  const newEl = {
                    id: newId,
                    sceneStart: Math.max(0, currentTime - 1),
                    sceneDuration: 6,
                    tag: "img",
                    type: "image",
                    name: `Image: ${imgEl.alt || "Visual"}`,
                    src: targetSrc,
                    isModified: false,
                    style: { objectFit: "contain" },
                    placement: {
                      x: (imgRect.left / 1920) * 100,
                      y: (imgRect.top / 1080) * 100,
                      width: imgRect.width || 300,
                      height: imgRect.height || 200,
                      isTopLeft: true,
                    },
                    visible: true,
                  };
                  onAddElement(newEl);
                  onSelectElement?.(newId);
                  onSelectElements?.([newId]);
                  return;
                }

                // Handle Text selection
                if (textEl && textEl.textContent && textEl.textContent.trim().length > 0 && onAddElement) {
                  const clickedText = textEl.textContent.trim();
                  const targetHfId = textEl.getAttribute("data-hf-id") || textEl.id;
                  const tag = textEl.tagName ? textEl.tagName.toLowerCase() : "p";
                  e.stopPropagation();
                  const newId = targetHfId || `el-detected-${Date.now()}`;
                  if (!textEl.getAttribute("data-hf-id")) textEl.setAttribute("data-hf-id", newId);
                  const cls = typeof textEl.className === "string" ? textEl.className.toLowerCase() : "";
                  const isH = tag.startsWith("h") || cls.includes("headline") || cls.includes("title");
                  const isPill = cls.includes("eyebrow") || cls.includes("kicker") || cls.includes("scene-number") || cls.includes("badge");
                  const newType = isH ? "heading" : isPill ? "badge" : "text";
                  const friendlyLabel = isH ? "Title" : isPill ? "Badge" : "Text";
                  const tRect = textEl.getBoundingClientRect();
                  const newEl = {
                    id: newId,
                    sceneStart: Math.max(0, currentTime - 1),
                    sceneDuration: 6,
                    tag,
                    type: newType,
                    name: `${friendlyLabel}: ${clickedText.slice(0, 20)}`,
                    text: clickedText,
                    originalText: clickedText,
                    isModified: false,
                    style: {
                      fontFamily: isH ? "Georgia, 'Times New Roman', serif" : "'Inter', sans-serif",
                      fontSize: isH ? 48 : 24,
                      color: "#ffffff",
                      textAlign: "left",
                    },
                    placement: {
                      x: tRect ? (tRect.left / 1920) * 100 : (clickX / 1920) * 100,
                      y: tRect ? (tRect.top / 1080) * 100 : (clickY / 1080) * 100,
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
        const isImage = el.type === "image" || el.tag === "img";
        const isButton = el.type === "button" || el.tag === "button" || el.type === "cta";

        const scale = frameWidth > 0 ? frameWidth / 1920 : 1;
        const rawFontSize = el.style?.fontSize || (isHeading ? 48 : 24);
        const fontSize = Math.max(14, Math.round(rawFontSize * scale));
        const fontFamily = el.style?.fontFamily || (isHeading ? "'Cinzel', serif" : "'Outfit', sans-serif");
        const color = el.style?.color || (isHeading ? "#ffffff" : "#e2e8f0");
        const textAlign = el.style?.textAlign || (isHeading ? "center" : "left");
        const opacity = el.style?.opacity ?? 1;

        const boxLeft = `${posX}%`;
        const boxTop = `${posY}%`;
        const boxWidth = isImage
          ? (el.placement?.width ? `${Math.min(95, (el.placement.width / 1920) * 100)}%` : (dynamic ? `${dynamic.widthPercent}%` : "auto"))
          : (dynamic ? `${dynamic.widthPercent}%` : "fit-content");
        const boxHeight = isImage
          ? (el.placement?.height ? `${Math.min(95, (el.placement.height / 1080) * 100)}%` : (dynamic ? `${dynamic.heightPercent}%` : "auto"))
          : (dynamic ? `${dynamic.heightPercent}%` : "auto");

        return (
          <React.Fragment key={el.id}>
            <div
              data-element-id={el.id}
              onMouseEnter={() => onHoverElement?.(el.id)}
              onMouseLeave={() => onHoverElement?.(null)}
              onPointerDown={(e) => {
                if (inlineEditingId === el.id) return;
                e.stopPropagation();
                onSelectElement?.(el.id);
                const isMulti = selectedSet.has(el.id) && selectedSet.size > 1;
                if (!isMulti) {
                  onSelectElements?.([el.id]);
                }
                onStartMove?.();

                const itemsToMove = isMulti
                  ? Array.from(selectedSet).map((id) => {
                      const itemEl = elements.find((x) => x.id === id);
                      const dyn = itemEl ? getDynamicPlacement(itemEl) : null;
                      return {
                        id,
                        initX: dyn ? dyn.leftPercent : (itemEl?.placement?.x ?? 50),
                        initY: dyn ? dyn.topPercent : (itemEl?.placement?.y ?? 50),
                        initPlacement: itemEl?.placement || {},
                      };
                    })
                  : [{
                      id: el.id,
                      initX: dynamic ? dynamic.leftPercent : posX,
                      initY: dynamic ? dynamic.topPercent : posY,
                      initPlacement: el.placement || {},
                    }];

                setDragging({
                  id: el.id,
                  startX: e.clientX,
                  startY: e.clientY,
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
                zIndex: isSelected ? 30 : isHovered ? 20 : 10,
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
                    bottom: "100%",
                    left: "0",
                    marginBottom: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: isSelected ? "#0284c7" : "#0f172a",
                    color: "#ffffff",
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
                    whiteSpace: "nowrap",
                    zIndex: 40,
                  }}
                >
                  <span>{getFriendlyElementLabel(el)}</span>
                  {el.text && (
                    <span style={{ fontWeight: 400, opacity: 0.9, maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      : {el.text.slice(0, 20)}
                    </span>
                  )}
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
                        background: "rgba(255,255,255,0.2)",
                        border: "none",
                        color: "#fff",
                        borderRadius: "3px",
                        padding: "1px 6px",
                        fontSize: "10px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        marginLeft: "4px",
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
                      title="Delete element (or press Del)"
                      style={{
                        background: "rgba(239,68,68,0.85)",
                        border: "none",
                        color: "#fff",
                        borderRadius: "3px",
                        padding: "1px 6px",
                        fontSize: "10px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        marginLeft: "2px",
                      }}
                    >
                      ✕ Del
                    </button>
                  )}
                </div>
              )}

              {/* Content rendering based on type */}
              {isImage ? (
                <img
                  src={el.src}
                  alt={el.name || "Element"}
                  style={{
                    width: `${el.placement?.width || 200}px`,
                    height: "auto",
                    display: "block",
                    opacity,
                    pointerEvents: "none",
                    borderRadius: el.style?.borderRadius || "4px",
                  }}
                />
              ) : isButton || el.tag === "pill" ? (
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
                      setResizing({
                        id: el.id,
                        corner,
                        type: isImage ? "image" : "text",
                        startX: e.clientX,
                        startY: e.clientY,
                        initWidth: dyn?.widthPx || el.placement?.width || 200,
                        initHeight: dyn?.heightPx || el.placement?.height || 60,
                        initRawFontSize: rawFontSize,
                        initPlacement: el.placement || {},
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

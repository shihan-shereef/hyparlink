import React, { useState, useRef, useEffect } from "react";

export function ElementsCanvasOverlay({
  elements = [],
  compositionIframeRef = null,
  currentTime = 0,
  selectedElementId = null,
  hoveredElementId = null,
  onSelectElement,
  onHoverElement,
  onUpdateElement,
  onDeleteElement,
  onAddElement,
  frameWidth = 1280,
  frameHeight = 720,
  isPlaying = false,
}) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { id, startX, startY, initX, initY, isTopLeft }
  const [resizing, setResizing] = useState(null); // { id, corner, startX, startY, initWidth, initFontSize }
  const [inlineEditingId, setInlineEditingId] = useState(null);

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

      // 1. Try matching by sceneIndex or sceneId
      let sceneEl = null;
      if (el.sceneIndex !== undefined) {
        sceneEl = doc.getElementById(`sc${el.sceneIndex}`) ||
                  doc.querySelector(`[data-scene="${el.sceneIndex + 1}"]`) ||
                  doc.getElementById(`scene${el.sceneIndex + 1}`) ||
                  doc.getElementById(`scene-0${el.sceneIndex + 1}`) ||
                  doc.getElementById(`scene-${el.sceneIndex + 1}`) ||
                  doc.querySelectorAll(".scene")[el.sceneIndex];
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
          if (el.field === "title" || el.tag === "h1" || el.tag === "h2" || el.tag === "h3" || el.type === "heading") {
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

      // 2. If not found in specific scene, check active/visible scene in all documents
      if (!targetEl) {
        for (const currentDoc of docsToCheck) {
          const scenes = currentDoc.querySelectorAll(".scene, [data-composition-id], section");
          for (const scene of scenes) {
            const win = currentDoc.defaultView || iframe.contentWindow;
            const style = win?.getComputedStyle(scene);
            if (!style || style.display !== "none") {
              let candidate = null;
              if (el.field === "title" || el.tag === "h1" || el.type === "heading") {
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

      const r = targetEl.getBoundingClientRect();
      if (!r || r.width <= 0) return null;

      const padX = 8;
      const padY = 4;
      const left = Math.max(0, r.left - padX);
      const top = Math.max(0, r.top - padY);
      const width = Math.max(80, r.width + padX * 2);
      const height = Math.max(30, (r.height > 0 ? r.height : 40) + padY * 2);

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

  // Handle Dragging / Repositioning
  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      const deltaX = ((e.clientX - dragging.startX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragging.startY) / rect.height) * 100;

      const newX = Math.max(0, Math.min(100, dragging.initX + deltaX));
      const newY = Math.max(0, Math.min(100, dragging.initY + deltaY));

      onUpdateElement?.(dragging.id, {
        isModified: true,
        hasMoved: true,
        placement: {
          ...dragging.initPlacement,
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
          isTopLeft: dragging.isTopLeft,
        },
      });
    };

    const handlePointerUp = () => {
      setDragging(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging, onUpdateElement]);

  // Handle Resizing
  useEffect(() => {
    if (!resizing) return;

    const handlePointerMove = (e) => {
      const deltaX = e.clientX - resizing.startX;
      const scaleFactor = 1 + deltaX / (resizing.initWidth || 200);

      if (resizing.type === "image") {
        const newWidth = Math.max(40, Math.min(1200, Math.round(resizing.initWidth * scaleFactor)));
        onUpdateElement?.(resizing.id, {
          placement: { ...resizing.initPlacement, width: newWidth },
        });
      } else {
        const newFontSize = Math.max(12, Math.min(120, Math.round(resizing.initFontSize * scaleFactor)));
        onUpdateElement?.(resizing.id, {
          style: { ...resizing.initStyle, fontSize: newFontSize },
        });
      }
    };

    const handlePointerUp = () => {
      setResizing(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [resizing, onUpdateElement]);

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
          // Check if user clicked on any text inside the live iframe
          if (compositionIframeRef?.current) {
            try {
              const iframe = compositionIframeRef.current;
              const doc = iframe.contentDocument || iframe.contentWindow?.document;
              if (doc) {
                const rect = containerRef.current.getBoundingClientRect();
                const clickX = ((e.clientX - rect.left) / rect.width) * 1920;
                const clickY = ((e.clientY - rect.top) / rect.height) * 1080;
                const hit = doc.elementFromPoint(clickX, clickY);

                if (hit) {
                  const textEl = hit.closest("h1, h2, h3, h4, p, span, .headline, .title, .mega, .big, .description, .sub, .eyebrow, .kicker, .scene-number, .num, .corner-mark, .date, .bottom-label, .pill, button, a") ||
                    (hit.textContent?.trim() ? hit : null);

                  if (textEl && textEl.textContent?.trim()) {
                    const clickedText = textEl.textContent.trim();
                    // Find if any element matches
                    const matched = elements.find((el) => {
                      if (!el.text) return false;
                      const a = el.text.trim().toLowerCase();
                      const b = clickedText.toLowerCase();
                      return a === b || a.includes(b) || b.includes(a);
                    });

                    if (matched) {
                      e.stopPropagation();
                      onSelectElement?.(matched.id);
                      return;
                    }

                    // If not found in pre-extracted elements, dynamically register and select it
                    if (onAddElement) {
                      e.stopPropagation();
                      const newId = `el-detected-${Date.now()}`;
                      const tag = textEl.tagName ? textEl.tagName.toLowerCase() : "div";
                      const isH = tag.startsWith("h") || textEl.classList?.contains("headline") || textEl.classList?.contains("title");
                      const newEl = {
                        id: newId,
                        sceneStart: Math.max(0, currentTime - 1),
                        sceneDuration: 6,
                        tag,
                        type: isH ? "heading" : "text",
                        name: `${isH ? "Title" : "Text"}: ${clickedText.slice(0, 20)}`,
                        text: clickedText,
                        originalText: clickedText,
                        isModified: false,
                        style: {
                          fontFamily: "'Inter', sans-serif",
                          fontSize: isH ? 48 : 24,
                          color: "#ffffff",
                          textAlign: "left",
                        },
                        placement: {
                          x: (clickX / 1920) * 100,
                          y: (clickY / 1080) * 100,
                          width: 400,
                          height: 60,
                          isTopLeft: true,
                        },
                        visible: true,
                      };
                      onAddElement(newEl);
                      onSelectElement?.(newId);
                      return;
                    }
                  }
                }
              }
            } catch (err) {
              console.warn("Error picking element from point:", err);
            }
          }

          // Clicking empty canvas deselects element
          onSelectElement?.(null);
          setInlineEditingId(null);
        }
      }}
    >
      {visibleElements.map((el) => {
        const isSelected = el.id === selectedElementId;
        const isHovered = el.id === hoveredElementId;
        const dynamic = !el.hasMoved ? getDynamicPlacement(el) : null;

        const posX = el.placement?.x ?? 50;
        const posY = el.placement?.y ?? 50;
        const isTopLeft = dynamic ? true : Boolean(el.placement?.isTopLeft);

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

        const boxLeft = dynamic ? `${dynamic.leftPercent}%` : `${posX}%`;
        const boxTop = dynamic ? `${dynamic.topPercent}%` : `${posY}%`;
        const boxWidth = dynamic
          ? `${dynamic.widthPercent}%`
          : (el.placement?.width ? `${Math.min(95, (el.placement.width / 1920) * 100)}%` : "auto");
        const boxHeight = dynamic
          ? `${dynamic.heightPercent}%`
          : (el.placement?.height ? `${Math.min(95, (el.placement.height / 1080) * 100)}%` : "auto");
        const boxTransform = isTopLeft ? "none" : "translate(-50%, -50%)";

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
                // Start drag
                setDragging({
                  id: el.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  initX: dynamic ? dynamic.leftPercent : posX,
                  initY: dynamic ? dynamic.topPercent : posY,
                  isTopLeft,
                  initPlacement: el.placement || {},
                });
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!isImage) {
                  setInlineEditingId(el.id);
                }
              }}
              style={{
                position: "absolute",
                left: boxLeft,
                top: boxTop,
                width: boxWidth,
                minWidth: "80px",
                minHeight: boxHeight && boxHeight !== "auto" ? boxHeight : "32px",
                transform: boxTransform,
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
                outlineOffset: "4px",
                boxShadow: isSelected
                  ? "0 0 16px rgba(56, 189, 248, 0.6), inset 0 0 0 1px rgba(255,255,255,0.4)"
                  : isHovered
                  ? "0 0 12px rgba(0, 240, 255, 0.4)"
                  : "none",
                borderRadius: "4px",
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
                  <span>{el.tag || el.type}</span>
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
                      setResizing({
                        id: el.id,
                        corner,
                        type: isImage ? "image" : "text",
                        startX: e.clientX,
                        startY: e.clientY,
                        initWidth: el.placement?.width || 200,
                        initFontSize: fontSize,
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
                      zIndex: 35,
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </React.Fragment>
      );
    })}
    </div>
  );
}

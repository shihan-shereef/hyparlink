import React, { useState, useRef, useEffect } from "react";

export function ElementsCanvasOverlay({
  elements = [],
  currentTime = 0,
  selectedElementId = null,
  hoveredElementId = null,
  onSelectElement,
  onHoverElement,
  onUpdateElement,
  onDeleteElement,
  frameWidth = 1280,
  frameHeight = 720,
  isPlaying = false,
}) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { id, startX, startY, initX, initY }
  const [resizing, setResizing] = useState(null); // { id, corner, startX, startY, initWidth, initFontSize }
  const [inlineEditingId, setInlineEditingId] = useState(null);

  // Filter elements active at current playhead time
  const visibleElements = elements.filter((el) => {
    if (el.visible === false) return false;
    if (el.sceneStart === undefined || el.sceneDuration === undefined) return true;
    const end = el.sceneStart + el.sceneDuration;
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
        placement: {
          ...dragging.initPlacement,
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
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
        pointerEvents: isPlaying ? "none" : "auto",
        zIndex: 40,
        overflow: "hidden",
      }}
      onPointerDown={(e) => {
        // Clicking empty canvas deselects element
        if (e.target === containerRef.current) {
          onSelectElement?.(null);
          setInlineEditingId(null);
        }
      }}
    >
      {visibleElements.map((el) => {
        const isSelected = el.id === selectedElementId;
        const isHovered = el.id === hoveredElementId;
        const posX = el.placement?.x ?? 50;
        const posY = el.placement?.y ?? 50;

        const isHeading = el.type === "heading" || el.tag === "h1" || el.tag === "h2" || el.tag === "h3";
        const isImage = el.type === "image" || el.tag === "img";
        const isButton = el.type === "button" || el.tag === "button" || el.type === "cta";

        const fontSize = el.style?.fontSize || (isHeading ? 48 : 24);
        const fontFamily = el.style?.fontFamily || (isHeading ? "'Cinzel', serif" : "'Outfit', sans-serif");
        const color = el.style?.color || (isHeading ? "#ffffff" : "#e2e8f0");
        const textAlign = el.style?.textAlign || (isHeading ? "center" : "left");
        const opacity = el.style?.opacity ?? 1;

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
                  initX: posX,
                  initY: posY,
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
                left: `${posX}%`,
                top: `${posY}%`,
                transform: "translate(-50%, -50%)",
                cursor: isSelected ? "move" : "pointer",
                userSelect: "none",
                zIndex: isSelected ? 30 : isHovered ? 20 : 10,
                maxWidth: "90%",
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
                padding: "2px 6px",
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
                    minWidth: "60px",
                  }}
                >
                  {inlineEditingId === el.id ? (
                    <textarea
                      autoFocus
                      rows={3}
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
                        font: "inherit",
                        border: "2px solid #38bdf8",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        outline: "none",
                        width: "100%",
                        minWidth: "260px",
                        minHeight: "70px",
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

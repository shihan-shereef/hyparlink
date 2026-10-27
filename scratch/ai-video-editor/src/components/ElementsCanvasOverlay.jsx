import React, { useState, useRef, useEffect } from "react";

export function ElementsCanvasOverlay({
  elements = [],
  currentTime = 0,
  selectedElementId = null,
  hoveredElementId = null,
  onSelectElement,
  onHoverElement,
  onUpdateElement,
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
          <div
            key={el.id}
            data-element-id={el.id}
            onMouseEnter={() => onHoverElement?.(el.id)}
            onMouseLeave={() => onHoverElement?.(null)}
            onPointerDown={(e) => {
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
                  gap: "4px",
                  background: isSelected ? "#0284c7" : "#0f172a",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  zIndex: 40,
                }}
              >
                <span>{el.tag || el.type}</span>
                {el.text && (
                  <span style={{ fontWeight: 400, opacity: 0.85, maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    : {el.text.slice(0, 24)}
                  </span>
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
            ) : isButton ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 24px",
                  background: el.style?.backgroundColor || "linear-gradient(135deg, #0ea5e9, #6366f1)",
                  color: color,
                  fontFamily,
                  fontSize: `${fontSize}px`,
                  fontWeight: 700,
                  borderRadius: "30px",
                  boxShadow: "0 10px 25px rgba(14, 165, 233, 0.4)",
                  letterSpacing: "0.02em",
                }}
              >
                {el.text || "Click Here"}
              </div>
            ) : (
              // Headings and Text Elements
              <div
                style={{
                  fontFamily,
                  fontSize: `${fontSize}px`,
                  color,
                  textAlign,
                  opacity,
                  fontWeight: isHeading ? 800 : 500,
                  lineHeight: 1.25,
                  letterSpacing: isHeading ? "0.02em" : "normal",
                  textShadow: "0 2px 10px rgba(0,0,0,0.85), 0 0 20px rgba(0,0,0,0.4)",
                  whiteSpace: "pre-wrap",
                  minWidth: "60px",
                }}
              >
                {inlineEditingId === el.id ? (
                  <input
                    type="text"
                    autoFocus
                    value={el.text || ""}
                    onChange={(e) => onUpdateElement?.(el.id, { text: e.target.value })}
                    onBlur={() => setInlineEditingId(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setInlineEditingId(null);
                    }}
                    style={{
                      background: "rgba(0,0,0,0.8)",
                      color: "#ffffff",
                      font: "inherit",
                      border: "1px solid #38bdf8",
                      borderRadius: "4px",
                      padding: "2px 6px",
                      outline: "none",
                    }}
                  />
                ) : (
                  el.text || "Sample Text"
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
        );
      })}
    </div>
  );
}

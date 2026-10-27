import { useEffect, useMemo, useRef, useState } from "react";

import { ensureCaptionFontLoaded } from "../lib/captionFonts.js";
import { drawCaptionLayout, getCaptionTextLayout } from "../lib/captionLayout.js";

const FALLBACK_PREVIEW_FRAME = { width: 640, height: 360 };

function getCaptionRasterScale() {
  if (typeof window === "undefined") return 2;
  return Math.max(2, Math.min(4, Number(window.devicePixelRatio) || 1));
}

function snapToPhysicalPixel(value, devicePixelRatio) {
  const ratio = Math.max(1, Number(devicePixelRatio) || 1);
  return Math.round(value * ratio) / ratio;
}

const FONT_FAMILY_MAP = {
  "cinzel": "'Cinzel', serif",
  "playfair-display": "'Playfair Display', serif",
  "bebas-neue": "'Bebas Neue', sans-serif",
  "montserrat": "'Montserrat', sans-serif",
  "outfit": "'Outfit', sans-serif",
  "inter": "'Inter', sans-serif",
  "syne": "'Syne', sans-serif",
  "space-grotesk": "'Space Grotesk', sans-serif",
  "orbitron": "'Orbitron', sans-serif",
  "plus-jakarta-sans": "'Plus Jakarta Sans', sans-serif",
  "georgia": "Georgia, serif",
};

export function CaptionOverlay({
  captionId,
  text,
  captionSize,
  captionStyle,
  placement,
  frameSize,
  isSelected = false,
  onSelect,
  onUpdateFont,
  onUpdateSize,
  onUpdateColor,
  onUpdateText,
  onDelete,
  onPointerDown,
  onDoubleClick,
}) {
  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const [fontRevision, setFontRevision] = useState(0);
  const [fontStatus, setFontStatus] = useState("ready");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);

  useEffect(() => { setEditText(text); }, [text]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const renderFrame = frameSize?.width > 0 && frameSize?.height > 0 ? frameSize : FALLBACK_PREVIEW_FRAME;

  useEffect(() => {
    let canceled = false;
    const fontId = captionStyle?.fontId || "default";
    if (fontId === "default") { setFontStatus("ready"); return undefined; }
    setFontStatus("loading");
    ensureCaptionFontLoaded(captionStyle?.fontId, text)
      .then(() => { if (!canceled) { setFontStatus("ready"); setFontRevision((v) => v + 1); } })
      .catch(() => { if (!canceled) { setFontStatus("failed"); setFontRevision((v) => v + 1); } });
    return () => { canceled = true; };
  }, [captionStyle?.fontId, text]);

  const layout = useMemo(() => {
    void fontRevision;
    return getCaptionTextLayout({ text: editText || text, captionSize, captionStyle, referenceFrame: renderFrame, renderFrame });
  }, [captionSize, captionStyle, fontRevision, renderFrame, editText, text]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout.width || !layout.height || isEditing) return;
    const rasterScale = getCaptionRasterScale();
    canvas.width = Math.max(1, Math.round(layout.width * rasterScale));
    canvas.height = Math.max(1, Math.round(layout.height * rasterScale));
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    ctx.setTransform(canvas.width / layout.width, 0, 0, canvas.height / layout.height, 0, 0);
    if ("fontKerning" in ctx) ctx.fontKerning = "normal";
    if ("textRendering" in ctx) ctx.textRendering = "optimizeLegibility";
    drawCaptionLayout(ctx, layout);
  }, [layout, isEditing]);

  const dpr = typeof window === "undefined" ? 1 : Math.max(1, Number(window.devicePixelRatio) || 1);
  const pX = Number(placement?.x);
  const pY = Number(placement?.y);
  const left = Number.isFinite(pX) ? `${snapToPhysicalPixel((renderFrame.width * pX) / 100, dpr)}px` : `${pX || 50}%`;
  const top = Number.isFinite(pY) ? `${snapToPhysicalPixel((renderFrame.height * pY) / 100, dpr)}px` : `${pY || 78}%`;
  const alignTransform = placement?.align === "left" ? "translate(0%, -50%)" : placement?.align === "right" ? "translate(-100%, -50%)" : "translate(-50%, -50%)";
  const resolvedFont = FONT_FAMILY_MAP[captionStyle?.fontId] || "sans-serif";
  const textColor = captionStyle?.textColor || "#ffffff";

  return (
    <div
      className={`caption-overlay ${fontStatus === "loading" ? "is-font-loading" : ""} ${isSelected ? "is-selected-caption" : ""}`}
      style={{
        position: "absolute",
        width: isEditing ? `${Math.max(200, layout.width + 40)}px` : `${Math.max(80, layout.width)}px`,
        height: isEditing ? `${Math.max(50, layout.height + 10)}px` : `${Math.max(30, layout.height)}px`,
        borderRadius: isEditing ? "8px" : `${layout.metrics?.radius ?? 0}px`,
        left, top,
        transform: alignTransform,
        zIndex: isSelected ? 40 : 10,
        outline: isSelected ? "2px solid #38bdf8" : "none",
        outlineOffset: "4px",
        boxShadow: isSelected ? "0 0 20px rgba(56,189,248,0.5)" : "none",
        cursor: isEditing ? "text" : "move",
        userSelect: "none",
        transition: "outline-color 0.15s ease, width 0.1s ease, height 0.1s ease",
      }}
      title={isEditing ? "" : "Tap to edit text directly on video"}
      onPointerDown={(e) => { onSelect?.(); onPointerDown?.(e); }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isEditing) { setIsEditing(true); onDoubleClick?.(e); }
      }}
    >
      {isSelected && !isEditing && (
        <>
          <span style={{ position:"absolute", top:-5, left:-5, width:10, height:10, background:"#38bdf8", border:"1px solid #fff", borderRadius:"2px", pointerEvents:"none" }} />
          <span style={{ position:"absolute", top:-5, right:-5, width:10, height:10, background:"#38bdf8", border:"1px solid #fff", borderRadius:"2px", pointerEvents:"none" }} />
          <span style={{ position:"absolute", bottom:-5, left:-5, width:10, height:10, background:"#38bdf8", border:"1px solid #fff", borderRadius:"2px", pointerEvents:"none" }} />
          <span style={{ position:"absolute", bottom:-5, right:-5, width:10, height:10, background:"#38bdf8", border:"1px solid #fff", borderRadius:"2px", pointerEvents:"none" }} />
        </>
      )}

      {isSelected && (
        <div
          className="in-video-typography-bar"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position:"absolute", bottom:"calc(100% + 14px)", left:"50%", transform:"translateX(-50%)",
            display:"flex", alignItems:"center", gap:"7px",
            background:"rgba(15,23,42,0.95)", border:"1px solid rgba(56,189,248,0.5)",
            boxShadow:"0 10px 30px rgba(0,0,0,0.75)", borderRadius:"10px",
            padding:"6px 12px", zIndex:100, whiteSpace:"nowrap", backdropFilter:"blur(16px)",
          }}
        >
          <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
            <span style={{ fontSize:"11px", color:"#38bdf8", fontWeight:700, letterSpacing:"0.5px" }}>FONT:</span>
            <select
              style={{ background:"#1e293b", color:"#f8fafc", border:"1px solid #475569", borderRadius:"6px", padding:"4px 8px", fontSize:"12px", fontWeight:600, cursor:"pointer", outline:"none" }}
              value={captionStyle?.fontId || "default"}
              onChange={(e) => { e.stopPropagation(); onUpdateFont?.(e.target.value); }}
            >
              <option value="cinzel">🏛️ Cinzel (Classic)</option>
              <option value="playfair-display">📜 Playfair Display</option>
              <option value="bebas-neue">⚡ Bebas Neue (Bold)</option>
              <option value="montserrat">💎 Montserrat</option>
              <option value="outfit">✨ Outfit (Tech)</option>
              <option value="inter">🎯 Inter (UI)</option>
              <option value="syne">🎨 Syne (Artistic)</option>
              <option value="space-grotesk">🚀 Space Grotesk</option>
              <option value="orbitron">🛸 Orbitron (Sci-Fi)</option>
              <option value="plus-jakarta-sans">🏢 Plus Jakarta Sans</option>
              <option value="georgia">📖 Georgia</option>
              <option value="default">Default Sans</option>
            </select>
          </div>

          <div style={{ width:"1px", height:"18px", background:"rgba(255,255,255,0.2)" }} />

          <div style={{ display:"flex", alignItems:"center", gap:"3px" }}>
            <button type="button"
              style={{ background:"#1e293b", color:"#fff", border:"1px solid #475569", borderRadius:"4px", width:"24px", height:"24px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:"11px", fontWeight:"bold" }}
              onClick={(e) => { e.stopPropagation(); onUpdateSize?.(-4); }} title="Decrease font size"
            >A-</button>
            <span style={{ fontSize:"11px", color:"#e2e8f0", minWidth:"32px", textAlign:"center", fontWeight:600 }}>{captionSize || 28}px</span>
            <button type="button"
              style={{ background:"#1e293b", color:"#fff", border:"1px solid #475569", borderRadius:"4px", width:"24px", height:"24px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:"11px", fontWeight:"bold" }}
              onClick={(e) => { e.stopPropagation(); onUpdateSize?.(4); }} title="Increase font size"
            >A+</button>
          </div>

          <div style={{ width:"1px", height:"18px", background:"rgba(255,255,255,0.2)" }} />

          <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
            {[
              { color:"#ffffff", title:"White" },
              { color:"#e5c07b", title:"Gold" },
              { color:"#ffd700", title:"Yellow" },
              { color:"#38bdf8", title:"Cyan" },
              { color:"#f87171", title:"Coral" },
              { color:"#c084fc", title:"Purple" },
            ].map((sw) => (
              <button key={sw.color} type="button" title={sw.title}
                style={{ width:"16px", height:"16px", borderRadius:"50%", background:sw.color, padding:0, cursor:"pointer",
                  border: textColor.toLowerCase() === sw.color.toLowerCase() ? "2px solid #fff" : "1px solid rgba(0,0,0,0.6)",
                  boxShadow: textColor.toLowerCase() === sw.color.toLowerCase() ? "0 0 6px #fff" : "none",
                }}
                onClick={(e) => { e.stopPropagation(); onUpdateColor?.(sw.color); }}
              />
            ))}
          </div>

          <div style={{ width:"1px", height:"18px", background:"rgba(255,255,255,0.2)" }} />

          <button type="button"
            style={{ background: isEditing ? "#38bdf8" : "#1e293b", color: isEditing ? "#0f172a" : "#38bdf8", border:"1px solid #38bdf8", borderRadius:"5px", padding:"3px 9px", fontSize:"11px", fontWeight:700, cursor:"pointer" }}
            onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
          >
            {isEditing ? "✓ Done" : "✏️ Edit Text"}
          </button>

          {onDelete && (
            <button type="button"
              style={{ background:"transparent", color:"#ef4444", border:"none", fontSize:"14px", cursor:"pointer", padding:"0 4px", lineHeight:1 }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete text"
            >✕</button>
          )}
        </div>
      )}

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => { setEditText(e.target.value); onUpdateText?.(e.target.value); }}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setIsEditing(false); }}
          style={{
            width:"100%", height:"100%", minWidth:"140px",
            background:"rgba(0,0,0,0.5)",
            border:"2px solid #38bdf8", borderRadius:"6px",
            color: textColor,
            fontFamily: resolvedFont,
            fontSize:`${Math.min(captionSize || 28, 56)}px`,
            fontWeight: captionStyle?.fontWeight || "bold",
            textAlign: captionStyle?.textAlign || "center",
            padding:"4px 12px", outline:"none", boxSizing:"border-box",
            backdropFilter:"blur(2px)", WebkitBackdropFilter:"blur(2px)",
            letterSpacing:"0.02em", textShadow:"0 2px 8px rgba(0,0,0,0.8)",
            caretColor:"#38bdf8",
          }}
          autoFocus
          placeholder="Type your text..."
        />
      ) : (
        <canvas ref={canvasRef} aria-hidden="true" style={{ display:"block", width:"100%", height:"100%", pointerEvents:"none" }} />
      )}

      {fontStatus === "loading" ? <span className="caption-font-loading-indicator" aria-hidden="true" /> : null}
    </div>
  );
}

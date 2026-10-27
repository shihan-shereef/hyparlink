import React, { useState } from "react";
import {
  BoundingBox,
  TextT,
  ImageSquare,
  Sparkle,
  Trash,
  Copy,
  Eye,
  EyeSlash,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  Plus,
  ArrowCounterClockwise,
  Sliders,
  Palette,
  CornersOut,
  CaretRight,
  CaretDown,
} from "@phosphor-icons/react";

const GOOGLE_FONTS = [
  { id: "Cinzel", label: "Cinzel (Cinematic Serif)", font: "'Cinzel', serif" },
  { id: "Outfit", label: "Outfit (Modern Sans)", font: "'Outfit', sans-serif" },
  { id: "Inter", label: "Inter (Clean Grotesk)", font: "'Inter', sans-serif" },
  { id: "Montserrat", label: "Montserrat (Punchy Geometric)", font: "'Montserrat', sans-serif" },
  { id: "Playfair Display", label: "Playfair Display (Editorial Luxury)", font: "'Playfair Display', serif" },
  { id: "Space Grotesk", label: "Space Grotesk (Tech Monospace)", font: "'Space Grotesk', sans-serif" },
  { id: "Bebas Neue", label: "Bebas Neue (Impact Headline)", font: "'Bebas Neue', sans-serif" },
  { id: "Plus Jakarta Sans", label: "Plus Jakarta Sans (Contemporary)", font: "'Plus Jakarta Sans', sans-serif" },
];

const PRESET_COLORS = [
  "#ffffff",
  "#fff8e7",
  "#00a8ff",
  "#38bdf8",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#e2e8f0",
  "#030712",
];

export function ElementsInspector({
  elements = [],
  selectedElementId = null,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onAddElement,
  hoveredElementId = null,
  onHoverElement,
  currentTime = 0,
  onSeekTo,
  scenes = [],
}) {
  const [filterScene, setFilterScene] = useState("all");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState({});

  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const selectedElement = elements.find((el) => el.id === selectedElementId);

  // Filter elements by scene if selected
  const filteredElements = elements.filter((el) => {
    if (filterScene === "all") return true;
    return el.sceneId === filterScene;
  });

  // Categorize elements
  const headings = filteredElements.filter((el) => el.type === "heading" || el.tag === "h1" || el.tag === "h2" || el.tag === "h3");
  const textElements = filteredElements.filter((el) => (el.type === "text" || el.tag === "p" || el.tag === "span") && !headings.includes(el));
  const images = filteredElements.filter((el) => el.type === "image" || el.tag === "img" || el.tag === "svg");
  const buttons = filteredElements.filter((el) => el.type === "button" || el.tag === "button" || el.type === "cta");
  const backgrounds = filteredElements.filter((el) => el.type === "background" || el.tag === "background" || el.type === "container");

  const categories = [
    { id: "headings", label: "Headings & Titles", icon: TextT, items: headings, tagColor: "#38bdf8" },
    { id: "text", label: "Paragraphs & Text", icon: TextT, items: textElements, tagColor: "#a855f7" },
    { id: "images", label: "Images & Graphics", icon: ImageSquare, items: images, tagColor: "#10b981" },
    { id: "buttons", label: "Buttons & CTAs", icon: Sparkle, items: buttons, tagColor: "#f59e0b" },
    { id: "backgrounds", label: "Backgrounds & Themes", icon: BoundingBox, items: backgrounds, tagColor: "#ec4899" },
  ].filter((cat) => cat.items.length > 0);

  return (
    <div className="elements-inspector-wrapper" style={{ display: "flex", flexDirection: "column", height: "100%", color: "#e2e8f0" }}>
      {/* Top Controls Bar */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(15,23,42,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BoundingBox size={18} color="#38bdf8" weight="bold" />
            <span style={{ fontWeight: 700, fontSize: "14px", letterSpacing: "0.02em" }}>Video Elements</span>
            <span style={{ fontSize: "11px", background: "rgba(56,189,248,0.15)", color: "#38bdf8", padding: "1px 7px", borderRadius: "10px", fontWeight: 600 }}>
              {elements.length}
            </span>
          </div>

          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
                border: "none",
                borderRadius: "6px",
                padding: "5px 10px",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Plus size={14} weight="bold" />
              <span>Add</span>
            </button>

            {showAddMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: "6px",
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.7)",
                  zIndex: 50,
                  width: "160px",
                  overflow: "hidden",
                }}
              >
                {[
                  { type: "heading", label: "Heading (H1)", icon: TextT },
                  { type: "text", label: "Subtitle Text", icon: TextT },
                  { type: "image", label: "Graphic / Image", icon: ImageSquare },
                  { type: "button", label: "Button CTA", icon: Sparkle },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      onAddElement?.(item.type);
                      setShowAddMenu(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      width: "100%",
                      padding: "8px 12px",
                      background: "none",
                      border: "none",
                      color: "#cbd5e1",
                      fontSize: "12px",
                      textAlign: "left",
                      cursor: "pointer",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(56,189,248,0.15)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <item.icon size={15} color="#38bdf8" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scene filter pills */}
        {scenes && scenes.length > 0 && (
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
            <button
              type="button"
              onClick={() => setFilterScene("all")}
              style={{
                padding: "3px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: filterScene === "all" ? "#38bdf8" : "rgba(255,255,255,0.06)",
                color: filterScene === "all" ? "#0f172a" : "#94a3b8",
                whiteSpace: "nowrap",
              }}
            >
              All Scenes
            </button>
            {scenes.map((sc, i) => (
              <button
                key={sc.id || i}
                type="button"
                onClick={() => {
                  setFilterScene(sc.id || `scene-${i + 1}`);
                  if (typeof onSeekTo === "function") {
                    onSeekTo(sc.start);
                  }
                }}
                style={{
                  padding: "3px 8px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: filterScene === (sc.id || `scene-${i + 1}`) ? "#38bdf8" : "rgba(255,255,255,0.06)",
                  color: filterScene === (sc.id || `scene-${i + 1}`) ? "#0f172a" : "#94a3b8",
                  whiteSpace: "nowrap",
                }}
              >
                Scene {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {/* If an element is selected, show its full property editor at top */}
        {selectedElement ? (
          <div
            style={{
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "16px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(56, 189, 248, 0.2)",
                    color: "#38bdf8",
                  }}
                >
                  {selectedElement.tag || selectedElement.type}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>
                  Edit Element
                </span>
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => onDuplicateElement?.(selectedElement.id)}
                  title="Duplicate Element"
                  style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#94a3b8", borderRadius: "4px", padding: "4px 6px", cursor: "pointer" }}
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteElement?.(selectedElement.id)}
                  title="Delete Element"
                  style={{ background: "rgba(239,68,68,0.15)", border: "none", color: "#f87171", borderRadius: "4px", padding: "4px 6px", cursor: "pointer" }}
                >
                  <Trash size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectElement?.(null)}
                  title="Done"
                  style={{ background: "rgba(56,189,248,0.2)", border: "none", color: "#38bdf8", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
            </div>

            {/* Text Editor (for text/heading/button) */}
            {selectedElement.type !== "image" && selectedElement.type !== "background" && (
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}>
                    Text Content
                  </label>
                  <span style={{ fontSize: "10px", color: "#38bdf8", fontWeight: 500 }}>
                    Live in video
                  </span>
                </div>
                <textarea
                  value={selectedElement.text || ""}
                  onChange={(e) => onUpdateElement?.(selectedElement.id, { text: e.target.value, isModified: true })}
                  rows={3}
                  style={{
                    width: "100%",
                    background: "#090d16",
                    border: "1px solid rgba(56,189,248,0.3)",
                    borderRadius: "6px",
                    color: "#f8fafc",
                    padding: "8px 10px",
                    fontSize: "13px",
                    fontFamily: selectedElement.style?.fontFamily || "inherit",
                    resize: "vertical",
                  }}
                  placeholder="Enter text..."
                />
              </div>
            )}

            {/* Typography Controls */}
            {selectedElement.type !== "image" && selectedElement.type !== "background" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>
                    Font Family
                  </label>
                  <select
                    value={selectedElement.style?.fontFamily || "Cinzel"}
                    onChange={(e) =>
                      onUpdateElement?.(selectedElement.id, {
                        style: { ...selectedElement.style, fontFamily: e.target.value },
                      })
                    }
                    style={{
                      width: "100%",
                      background: "#090d16",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "6px",
                      color: "#f8fafc",
                      padding: "6px 10px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {GOOGLE_FONTS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Font Size & Alignment */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>
                      Font Size ({selectedElement.style?.fontSize || 38}px)
                    </label>
                    <input
                      type="range"
                      min={14}
                      max={96}
                      value={selectedElement.style?.fontSize || 38}
                      onChange={(e) =>
                        onUpdateElement?.(selectedElement.id, {
                          style: { ...selectedElement.style, fontSize: parseInt(e.target.value, 10) },
                        })
                      }
                      style={{ width: "100%", accentColor: "#38bdf8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>
                      Alignment
                    </label>
                    <div style={{ display: "flex", background: "#090d16", borderRadius: "6px", padding: "2px", border: "1px solid rgba(255,255,255,0.12)" }}>
                      {["left", "center", "right"].map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() =>
                            onUpdateElement?.(selectedElement.id, {
                              style: { ...selectedElement.style, textAlign: align },
                            })
                          }
                          style={{
                            flex: 1,
                            background: selectedElement.style?.textAlign === align ? "#38bdf8" : "none",
                            color: selectedElement.style?.textAlign === align ? "#0f172a" : "#94a3b8",
                            border: "none",
                            borderRadius: "4px",
                            padding: "4px 0",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {align === "left" ? <TextAlignLeft size={14} /> : align === "center" ? <TextAlignCenter size={14} /> : <TextAlignRight size={14} />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Text Color Picker */}
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>
                    Text Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <input
                      type="color"
                      value={selectedElement.style?.color || "#ffffff"}
                      onChange={(e) =>
                        onUpdateElement?.(selectedElement.id, {
                          style: { ...selectedElement.style, color: e.target.value },
                        })
                      }
                      style={{ width: "28px", height: "28px", padding: 0, border: "none", borderRadius: "4px", cursor: "pointer", background: "none" }}
                    />
                    <input
                      type="text"
                      value={selectedElement.style?.color || "#ffffff"}
                      onChange={(e) =>
                        onUpdateElement?.(selectedElement.id, {
                          style: { ...selectedElement.style, color: e.target.value },
                        })
                      }
                      style={{
                        width: "80px",
                        background: "#090d16",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "4px",
                        color: "#f8fafc",
                        fontSize: "11px",
                        padding: "4px 6px",
                      }}
                    />
                    <div style={{ display: "flex", gap: "4px" }}>
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            onUpdateElement?.(selectedElement.id, {
                              style: { ...selectedElement.style, color: c },
                            })
                          }
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            background: c,
                            border: selectedElement.style?.color === c ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.2)",
                            cursor: "pointer",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Image Properties */}
            {selectedElement.type === "image" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>
                    Image Preview
                  </label>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {selectedElement.src && (
                      <img
                        src={selectedElement.src}
                        alt="Preview"
                        style={{ width: "64px", height: "64px", objectFit: "cover", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)" }}
                      />
                    )}
                    <label
                      style={{
                        padding: "6px 12px",
                        background: "rgba(56,189,248,0.2)",
                        color: "#38bdf8",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Replace Image
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              onUpdateElement?.(selectedElement.id, { src: reader.result, name: file.name });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>
                      Width ({selectedElement.placement?.width || 200}px)
                    </label>
                    <input
                      type="range"
                      min={40}
                      max={800}
                      value={selectedElement.placement?.width || 200}
                      onChange={(e) =>
                        onUpdateElement?.(selectedElement.id, {
                          placement: { ...selectedElement.placement, width: parseInt(e.target.value, 10) },
                        })
                      }
                      style={{ width: "100%", accentColor: "#38bdf8" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>
                      Opacity ({Math.round((selectedElement.style?.opacity ?? 1) * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((selectedElement.style?.opacity ?? 1) * 100)}
                      onChange={(e) =>
                        onUpdateElement?.(selectedElement.id, {
                          style: { ...selectedElement.style, opacity: parseInt(e.target.value, 10) / 100 },
                        })
                      }
                      style={{ width: "100%", accentColor: "#38bdf8" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Position Coordinates */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>
                  Position X ({Math.round(selectedElement.placement?.x ?? 50)}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selectedElement.placement?.x ?? 50)}
                  onChange={(e) =>
                    onUpdateElement?.(selectedElement.id, {
                      placement: { ...selectedElement.placement, x: parseInt(e.target.value, 10) },
                    })
                  }
                  style={{ width: "100%", accentColor: "#38bdf8" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>
                  Position Y ({Math.round(selectedElement.placement?.y ?? 50)}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selectedElement.placement?.y ?? 50)}
                  onChange={(e) =>
                    onUpdateElement?.(selectedElement.id, {
                      placement: { ...selectedElement.placement, y: parseInt(e.target.value, 10) },
                    })
                  }
                  style={{ width: "100%", accentColor: "#38bdf8" }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* Categories of Video Elements */}
        {categories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b" }}>
            <BoundingBox size={36} color="#334155" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: "13px", fontWeight: 500, margin: 0 }}>No elements in this scene</p>
            <p style={{ fontSize: "11px", margin: "4px 0 12px" }}>Add text, graphics or switch scenes</p>
            <button
              type="button"
              onClick={() => onAddElement?.("heading")}
              style={{
                background: "rgba(56,189,248,0.2)",
                color: "#38bdf8",
                border: "1px solid rgba(56,189,248,0.4)",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Add Heading
            </button>
          </div>
        ) : (
          categories.map((cat) => {
            const isCollapsed = collapsedCategories[cat.id];
            return (
              <div key={cat.id} style={{ marginBottom: "16px" }}>
                <div
                  onClick={() => toggleCategory(cat.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    userSelect: "none",
                    marginBottom: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {isCollapsed ? <CaretRight size={13} color="#94a3b8" /> : <CaretDown size={13} color="#94a3b8" />}
                    <cat.icon size={15} color={cat.tagColor} />
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1" }}>{cat.label}</span>
                    <span style={{ fontSize: "10px", color: "#64748b" }}>({cat.items.length})</span>
                  </div>
                </div>

                {!isCollapsed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "4px" }}>
                    {cat.items.map((el) => {
                      const isSelected = el.id === selectedElementId;
                      const isHovered = el.id === hoveredElementId;
                      return (
                        <div
                          key={el.id}
                          onClick={() => {
                            onSelectElement?.(el.id);
                            if (typeof onSeekTo === "function" && el.sceneStart !== undefined) {
                              onSeekTo(el.sceneStart);
                            }
                          }}
                          onMouseEnter={() => onHoverElement?.(el.id)}
                          onMouseLeave={() => onHoverElement?.(null)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            background: isSelected
                              ? "rgba(56, 189, 248, 0.2)"
                              : isHovered
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(15, 23, 42, 0.5)",
                            border: isSelected
                              ? "1px solid #38bdf8"
                              : isHovered
                              ? "1px solid rgba(56, 189, 248, 0.4)"
                              : "1px solid rgba(255,255,255,0.06)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                            <span
                              style={{
                                fontSize: "9px",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                padding: "2px 5px",
                                borderRadius: "4px",
                                background: `${cat.tagColor}22`,
                                color: cat.tagColor,
                                shrink: 0,
                              }}
                            >
                              {el.tag || el.type}
                            </span>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                color: isSelected ? "#ffffff" : "#e2e8f0",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {el.text || el.name || "Untitled Element"}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => onUpdateElement?.(el.id, { visible: el.visible === false ? true : false })}
                              style={{ background: "none", border: "none", color: el.visible === false ? "#64748b" : "#94a3b8", cursor: "pointer", padding: "2px" }}
                              title={el.visible === false ? "Show on canvas" : "Hide from canvas"}
                            >
                              {el.visible === false ? <EyeSlash size={14} /> : <Eye size={14} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteElement?.(el.id)}
                              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "2px" }}
                              title="Delete element"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

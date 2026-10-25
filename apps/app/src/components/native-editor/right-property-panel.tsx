"use client";

import React, { useState } from "react";
import { 
  Palette, 
  Layers, 
  Film, 
  Sliders, 
  Type, 
  Square, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Play,
  Download,
  RotateCcw,
  FileVideo,
  Settings,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Gauge
} from "lucide-react";
import { SelectedElement, RenderJob, CompositionLayer, ExportSettings, CompositionScene } from "./types";
import { toast } from "sonner";

interface RightPropertyPanelProps {
  activeTab?: "design" | "layers" | "renders" | "variables";
  onTabChange?: (tab: "design" | "layers" | "renders" | "variables") => void;
  selectedElement: SelectedElement | null;
  onUpdateStyle: (elementId: string, property: string, value: string) => void;
  onUpdateText: (elementId: string, text: string) => void;
  layers: CompositionLayer[];
  onToggleLayer: (layerId: string, action: "visibility" | "lock") => void;
  onSelectLayer: (layerId: string) => void;
  variables: Record<string, string>;
  onUpdateVariable: (key: string, value: string) => void;
  renders: RenderJob[];
  onTriggerRender: (settings?: Partial<ExportSettings>) => void;
  isRendering: boolean;
  onSelectPreviewVideo?: (videoUrl: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  playbackSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  activeScene?: CompositionScene;
  onSetSceneSpeed?: (sceneId: string, speedMultiplier: number) => void;
}

export const RightPropertyPanel: React.FC<RightPropertyPanelProps> = ({
  activeTab: controlledActiveTab,
  onTabChange,
  selectedElement,
  onUpdateStyle,
  onUpdateText,
  layers,
  onToggleLayer,
  onSelectLayer,
  variables,
  onUpdateVariable,
  renders,
  onTriggerRender,
  isRendering,
  onSelectPreviewVideo,
  isCollapsed = false,
  onToggleCollapse,
  playbackSpeed = 1,
  onSpeedChange,
  activeScene,
  onSetSceneSpeed,
}) => {
  const [internalTab, setInternalTab] = useState<"design" | "layers" | "renders" | "variables">("design");
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;
  const setActiveTab = (tab: "design" | "layers" | "renders" | "variables") => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  React.useEffect(() => {
    if (selectedElement) {
      setActiveTab("design");
    }
  }, [selectedElement]);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    resolution: "1080p",
    fps: 30,
    format: "mp4",
    quality: "high",
    includeAudio: true,
    filename: "",
  });

  // Collapsed Rail View (Icons Only)
  if (isCollapsed) {
    return (
      <aside className="w-12 shrink-0 bg-white border-l border-gray-200 flex flex-col items-center py-2 text-gray-700 select-none z-10 shadow-xs">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 mb-3 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition"
          title="Expand Property Inspector"
        >
          <ChevronLeft className="w-4 h-4 text-purple-600" />
        </button>

        <div className="flex flex-col gap-2 w-full px-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab("design");
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-full aspect-square rounded-md flex items-center justify-center transition ${
              activeTab === "design"
                ? "bg-purple-100 text-purple-900 border border-purple-200 font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Design Properties"
          >
            <Palette className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("layers");
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-full aspect-square rounded-md flex items-center justify-center transition ${
              activeTab === "layers"
                ? "bg-purple-100 text-purple-900 border border-purple-200 font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Composition Layers"
          >
            <Layers className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("renders");
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-full aspect-square rounded-md flex items-center justify-center transition ${
              activeTab === "renders"
                ? "bg-purple-100 text-purple-900 border border-purple-200 font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Render Queue"
          >
            <Film className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("variables");
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-full aspect-square rounded-md flex items-center justify-center transition ${
              activeTab === "variables"
                ? "bg-purple-100 text-purple-900 border border-purple-200 font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Template Variables"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 md:w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col text-gray-800 select-none min-h-0 z-10 shadow-xs">
      {/* 4 Header Tabs with Collapse Button (Matching HyperFrames Light Theme) */}
      <div className="h-10 bg-[#f9fafb] border-b border-gray-200 flex items-center px-2 gap-1 shrink-0">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-900 transition mr-1"
            title="Collapse Inspector"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="flex-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("design")}
            className={`flex-1 py-1.5 text-[11px] rounded transition flex items-center justify-center gap-1.5 ${
              activeTab === "design"
                ? "bg-white text-gray-900 border border-gray-300/80 font-bold shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 font-medium"
            }`}
          >
            <Palette className="w-3.5 h-3.5" /> Design
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("layers")}
            className={`flex-1 py-1.5 text-[11px] rounded transition flex items-center justify-center gap-1.5 ${
              activeTab === "layers"
                ? "bg-white text-gray-900 border border-gray-300/80 font-bold shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 font-medium"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Layers
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("renders")}
            className={`flex-1 py-1.5 text-[11px] rounded transition flex items-center justify-center gap-1.5 ${
              activeTab === "renders"
                ? "bg-white text-gray-900 border border-gray-300/80 font-bold shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 font-medium"
            }`}
          >
            <Film className="w-3.5 h-3.5" /> Renders
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("variables")}
            className={`flex-1 py-1.5 text-[11px] rounded transition flex items-center justify-center gap-1.5 ${
              activeTab === "variables"
                ? "bg-white text-gray-900 border border-gray-300/80 font-bold shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 font-medium"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Vars
          </button>
        </div>
      </div>

      {/* TAB 1: DESIGN PROPERTIES (HyperFrames Light Theme) */}
      {activeTab === "design" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white text-gray-800">
          {selectedElement ? (
            <>
              {/* Selected Element Header */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900 block">
                    {selectedElement.type.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                    #{selectedElement.id}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-900">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" className="p-1 hover:bg-red-50 rounded text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Text Content Editor (supports any text-capable element: h1-h6, p, span, div, label, etc.) */}
              {(selectedElement.type === "heading" ||
                selectedElement.type === "text" ||
                ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "div", "label", "button", "a", "em", "strong"].includes(selectedElement.tag?.toLowerCase() || "") ||
                (typeof selectedElement.text === "string" && selectedElement.text.trim().length > 0)) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-700">Text Content</label>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {selectedElement.text?.length || 0} chars
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={selectedElement.text || ""}
                    onChange={(e) => onUpdateText(selectedElement.id, e.target.value)}
                    placeholder="Enter element text..."
                    className="w-full bg-white border border-gray-300 rounded-md p-2.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-sans shadow-xs transition"
                  />
                </div>
              )}

              {/* Typography Properties */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-bold block">
                  Typography
                </span>

                {/* Font Family Selector */}
                <div>
                  <label className="text-[11px] text-gray-600 font-medium block mb-1">Font Family</label>
                  <select
                    value={selectedElement.styles.fontFamily || "Inter, sans-serif"}
                    onChange={(e) => onUpdateStyle(selectedElement.id, "fontFamily", e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer shadow-xs"
                  >
                    <optgroup label="Popular Display & Sans Fonts">
                      <option value="Inter, sans-serif">Inter</option>
                      <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
                      <option value="Poppins, sans-serif">Poppins</option>
                      <option value="Outfit, sans-serif">Outfit</option>
                      <option value="Roboto, sans-serif">Roboto</option>
                      <option value="'Plus Jakarta Sans', sans-serif">Plus Jakarta Sans</option>
                      <option value="Montserrat, sans-serif">Montserrat</option>
                      <option value="Syne, sans-serif">Syne</option>
                      <option value="'DM Sans', sans-serif">DM Sans</option>
                      <option value="Oswald, sans-serif">Oswald</option>
                      <option value="Geist, sans-serif">Geist</option>
                    </optgroup>
                    <optgroup label="Serif & Editorial Fonts">
                      <option value="'Playfair Display', serif">Playfair Display</option>
                      <option value="Cinzel, serif">Cinzel</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="'Times New Roman', serif">Times New Roman</option>
                    </optgroup>
                    <optgroup label="Monospace & Code Fonts">
                      <option value="'Fira Code', monospace">Fira Code</option>
                      <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                      <option value="monospace">Standard Monospace</option>
                    </optgroup>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-600 font-medium">Font Size</label>
                    <input
                      type="text"
                      value={selectedElement.styles.fontSize || "24px"}
                      onChange={(e) => onUpdateStyle(selectedElement.id, "fontSize", e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs transition"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-600 font-medium">Font Weight</label>
                    <select
                      value={selectedElement.styles.fontWeight || "600"}
                      onChange={(e) => onUpdateStyle(selectedElement.id, "fontWeight", e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer shadow-xs"
                    >
                      <option value="300">300 (Light)</option>
                      <option value="400">400 (Regular)</option>
                      <option value="500">500 (Medium)</option>
                      <option value="600">600 (Semibold)</option>
                      <option value="700">700 (Bold)</option>
                      <option value="800">800 (Extra Bold)</option>
                      <option value="900">900 (Black)</option>
                    </select>
                  </div>
                </div>

                {/* Text Alignment & Letter Spacing */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-600 font-medium block mb-1">Align</label>
                    <div className="flex bg-white border border-gray-300 rounded-md overflow-hidden shadow-xs">
                      <button
                        type="button"
                        onClick={() => onUpdateStyle(selectedElement.id, "textAlign", "left")}
                        className={`flex-1 py-1.5 flex items-center justify-center hover:bg-gray-100 transition ${
                          selectedElement.styles.textAlign === "left" ? "bg-indigo-50 text-indigo-700 font-bold" : "text-gray-600"
                        }`}
                        title="Left"
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateStyle(selectedElement.id, "textAlign", "center")}
                        className={`flex-1 py-1.5 flex items-center justify-center hover:bg-gray-100 transition ${
                          selectedElement.styles.textAlign === "center" ? "bg-indigo-50 text-indigo-700 font-bold" : "text-gray-600"
                        }`}
                        title="Center"
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateStyle(selectedElement.id, "textAlign", "right")}
                        className={`flex-1 py-1.5 flex items-center justify-center hover:bg-gray-100 transition ${
                          selectedElement.styles.textAlign === "right" ? "bg-indigo-50 text-indigo-700 font-bold" : "text-gray-600"
                        }`}
                        title="Right"
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-600 font-medium">Letter Spacing</label>
                    <input
                      type="text"
                      value={selectedElement.styles.letterSpacing || "normal"}
                      onChange={(e) => onUpdateStyle(selectedElement.id, "letterSpacing", e.target.value)}
                      placeholder="e.g. 0.05em"
                      className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs transition"
                    />
                  </div>
                </div>

                {/* Color Swatch */}
                <div>
                  <label className="text-[11px] text-gray-600 font-medium">Text Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={selectedElement.styles.color?.startsWith("#") ? selectedElement.styles.color : "#000000"}
                      onChange={(e) => onUpdateStyle(selectedElement.id, "color", e.target.value)}
                      className="w-7 h-7 rounded border border-gray-300 bg-white cursor-pointer"
                    />
                    <input
                      type="text"
                      value={selectedElement.styles.color || "#000000"}
                      onChange={(e) => onUpdateStyle(selectedElement.id, "color", e.target.value)}
                      className="flex-1 bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition"
                    />
                  </div>
                </div>
              </div>

              {/* Dimensions, Alignment & Background */}
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-bold block">
                  Transform &amp; Layout
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-600 font-medium">Opacity</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      defaultValue="1"
                      onChange={(e) => onUpdateStyle(selectedElement.id, "opacity", e.target.value)}
                      className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg mt-2"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-600 font-medium">Border Radius</label>
                    <input
                      type="text"
                      defaultValue={selectedElement.styles.borderRadius || "0px"}
                      onChange={(e) => onUpdateStyle(selectedElement.id, "borderRadius", e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition"
                    />
                  </div>
                </div>

                {/* Background Styling */}
                <div>
                  <label className="text-[11px] text-gray-600 font-medium">Background / Fill</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      defaultValue="#ffffff"
                      onChange={(e) => onUpdateStyle(selectedElement.id, "backgroundColor", e.target.value)}
                      className="w-7 h-7 rounded border border-gray-300 bg-white cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="e.g. #ffffff or rgba(...)"
                      defaultValue={selectedElement.styles.backgroundColor || ""}
                      onChange={(e) => onUpdateStyle(selectedElement.id, "background", e.target.value)}
                      className="flex-1 bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition"
                    />
                  </div>
                </div>
              </div>

              {/* Animation Tweens & Motion Presets */}
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 font-bold block flex items-center justify-between">
                  <span>Motion &amp; Animations</span>
                  <span className="text-[9px] text-gray-400">GSAP 3</span>
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-600 font-medium">Entrance</label>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "fade") onUpdateStyle(selectedElement.id, "animation", "fadeIn 0.8s ease forwards");
                        else if (val === "slide-up") onUpdateStyle(selectedElement.id, "animation", "slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards");
                        else if (val === "scale") onUpdateStyle(selectedElement.id, "animation", "scaleIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards");
                      }}
                      className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition cursor-pointer"
                    >
                      <option value="none">None / Default</option>
                      <option value="fade">Fade In</option>
                      <option value="slide-up">Slide Up</option>
                      <option value="scale">Scale Pop</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-600 font-medium">Easing</label>
                    <select
                      className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition cursor-pointer"
                      defaultValue="power3.out"
                    >
                      <option value="power1.out">power1.out (Smooth)</option>
                      <option value="power2.out">power2.out (Medium)</option>
                      <option value="power3.out">power3.out (Cinematic)</option>
                      <option value="back.out(1.7)">back.out (Elastic)</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-6 px-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-col items-center">
                <div className="w-9 h-9 rounded-full bg-gray-200/60 flex items-center justify-center mb-2.5 text-gray-500">
                  <Square className="w-4 h-4 text-gray-500" />
                </div>
                <span className="text-xs font-semibold text-gray-900 block">Nothing selected</span>
                <p className="text-[11px] text-gray-500 mt-1 max-w-[200px] leading-relaxed">
                  Click any element on the canvas to edit it, or pick from the Layers tab.
                </p>

                {/* Hotkey Quick Action Buttons */}
                <div className="w-full mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => toast.info("Gesture recording ready. Drag or scale element on canvas to capture.")}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-700 transition shadow-xs group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span>Record a gesture</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 group-hover:text-gray-700">
                      R
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toast.info("Agent prompt: Describe your change in chat.")}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-700 transition shadow-xs group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✦</span>
                      <span>Describe a change to the agent</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 group-hover:text-gray-700">
                      ⌘K
                    </span>
                  </button>
                </div>
              </div>

              {/* Scene-level background editing */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-bold block">
                  Scene Canvas Color &amp; Gradients
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    defaultValue="#071426"
                    onChange={(e) => onUpdateStyle("root", "background", e.target.value)}
                    className="w-8 h-8 rounded border border-gray-300 bg-white cursor-pointer"
                  />
                  <input
                    type="text"
                    defaultValue="#071426"
                    placeholder="Hex or CSS gradient..."
                    onChange={(e) => onUpdateStyle("root", "background", e.target.value)}
                    className="flex-1 bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs transition"
                  />
                </div>
              </div>

              {/* Video Speed & Timing Properties */}
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-purple-600" />
                    Video Speed &amp; Playback Rate
                  </span>
                  <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    {playbackSpeed}x Speed
                  </span>
                </div>

                {/* Global Playback Speed Preset Buttons */}
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-600 font-medium">Global Playback Speed</label>
                  <div className="grid grid-cols-5 gap-1">
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4].slice(0, 5).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => onSpeedChange?.(spd)}
                        className={`py-1.5 text-xs font-mono font-bold rounded-md border transition ${
                          playbackSpeed === spd
                            ? "bg-purple-600 border-purple-600 text-white shadow-xs"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-1 mt-1">
                    {[1.5, 1.75, 2, 2.5, 4].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => onSpeedChange?.(spd)}
                        className={`py-1.5 text-xs font-mono font-bold rounded-md border transition ${
                          playbackSpeed === spd
                            ? "bg-purple-600 border-purple-600 text-white shadow-xs"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Clip Speed Multiplier */}
                {activeScene && onSetSceneSpeed && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-gray-600 font-medium truncate">
                        Clip Speed: <span className="text-gray-900 font-semibold">{activeScene.name || "Active Scene"}</span>
                      </label>
                      <span className="text-[10px] font-mono text-gray-500">
                        {activeScene.duration.toFixed(2)}s
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[0.5, 1, 1.5, 2].map((spd) => {
                        const isCurrent = (activeScene as any).speed === spd || (!((activeScene as any).speed) && spd === 1);
                        return (
                          <button
                            key={spd}
                            type="button"
                            onClick={() => onSetSceneSpeed(activeScene.id, spd)}
                            className={`py-1 text-[11px] font-mono font-bold rounded border transition ${
                              isCurrent
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-emerald-50 hover:border-emerald-300"
                            }`}
                          >
                            {spd}x
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 block leading-tight">
                      Adjusting clip speed automatically recalculates timeline duration.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LAYERS LIST (MATCHING OFFICIAL HYPERFRAMES LIGHT THEME IN SCREENSHOT 5) */}
      {activeTab === "layers" && (
        <div className="flex-1 overflow-y-auto flex flex-col bg-white text-gray-800">
          {/* Header count like Screenshot 5: "36 layers" */}
          <div className="px-4 py-2 text-xs text-gray-500 font-normal border-b border-gray-200 bg-gray-50/50 flex items-center justify-between shrink-0">
            <span>{layers.length} layers</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {layers.length > 0 ? (
              layers.map((layer, idx) => {
                const isSelected = selectedElement?.id === layer.id;
                
                // Format clean layer name matching Screenshot 5
                let formattedName = layer.name || "";
                formattedName = formattedName.replace(/^[.#]/, "").replace(/\s*\([a-z0-9]+\)$/i, "");
                if (layer.text && layer.text.trim().length > 0 && layer.text.trim().length < 24) {
                  formattedName = layer.text.trim();
                } else {
                  formattedName = formattedName
                    .split(/[-_]/)
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ") || "Layer";
                }

                const isContainer = layer.type === "container";
                const isText = layer.type === "heading" || layer.type === "text";
                const isImage = layer.type === "image";
                const isVideo = layer.type === "video";

                return (
                  <div
                    key={layer.id}
                    onClick={() => {
                      onSelectLayer(layer.id);
                      setActiveTab("design");
                    }}
                    className={`px-3 py-1.5 flex items-center justify-between text-xs cursor-pointer transition select-none ${
                      isSelected
                        ? "bg-[#eff6ff] text-[#1d4ed8] font-semibold border-l-2 border-[#3b82f6]"
                        : "hover:bg-gray-100 text-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {/* Chevron / tree indicator */}
                      {isContainer ? (
                        <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                      ) : (
                        <span className="w-3 shrink-0" />
                      )}

                      {/* Icon matching Screenshot 5 */}
                      {isText ? (
                        <span className="text-[11px] font-bold text-indigo-600 font-serif w-3.5 text-center shrink-0">
                          T
                        </span>
                      ) : isImage ? (
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : isVideo ? (
                        <Film className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      )}

                      <span className="truncate">{formattedName}</span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Track index badge matching Screenshot 5 */}
                      <span className="text-[11px] font-mono text-gray-400 font-normal">
                        {(layer as any).trackIndex !== undefined ? (layer as any).trackIndex : (idx + 1)}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLayer(layer.id, "visibility");
                        }}
                        className="p-0.5 text-gray-400 hover:text-gray-800 transition"
                        title={layer.visible ? "Hide Layer" : "Show Layer"}
                      >
                        {layer.visible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400 text-xs">
                Loading composition hierarchy...
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RENDERS & EXPORT WORKSPACE */}
      {activeTab === "renders" && (
        <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden gap-3 bg-white text-gray-800">
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Section 1: Export Controls */}
            <div className="space-y-2.5 p-3 rounded-lg border border-purple-200 bg-purple-50/50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-3 h-3 text-purple-600" /> Export Configuration
                </span>
                <span className="text-[10px] font-mono text-purple-700">MP4 / H.264</span>
              </div>

              {/* Resolution Setting */}
              <div>
                <label className="text-[10px] text-gray-600 font-medium block mb-1">Output Resolution</label>
                <select
                  value={exportSettings.resolution}
                  onChange={(e) => setExportSettings((prev) => ({ ...prev, resolution: e.target.value }))}
                  disabled={isRendering}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-800 disabled:opacity-50 shadow-xs"
                >
                  <option value="1080p">1080p Full HD (1920 &times; 1080, 16:9)</option>
                  <option value="720p">720p HD (1280 &times; 720, 16:9)</option>
                  <option value="4k">4K Ultra HD (3840 &times; 2160, 16:9)</option>
                  <option value="portrait">Portrait Mobile (1080 &times; 1920, 9:16)</option>
                  <option value="square">Square Social (1080 &times; 1080, 1:1)</option>
                </select>
              </div>

              {/* Frame Rate & Quality */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-600 font-medium block mb-1">Frame Rate</label>
                  <select
                    value={exportSettings.fps}
                    onChange={(e) => setExportSettings((prev) => ({ ...prev, fps: Number(e.target.value) }))}
                    disabled={isRendering}
                    className="w-full bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 disabled:opacity-50 shadow-xs"
                  >
                    <option value="30">30 FPS (Standard)</option>
                    <option value="60">60 FPS (Ultra Smooth)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-gray-600 font-medium block mb-1">Quality Preset</label>
                  <select
                    value={exportSettings.quality}
                    onChange={(e) => setExportSettings((prev) => ({ ...prev, quality: e.target.value as any }))}
                    disabled={isRendering}
                    className="w-full bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 disabled:opacity-50 shadow-xs"
                  >
                    <option value="high">Production (CRF 16)</option>
                    <option value="standard">Standard (CRF 22)</option>
                  </select>
                </div>
              </div>

              {/* Audio Inclusion Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-700 flex items-center gap-1.5 font-medium">
                  {exportSettings.includeAudio ? (
                    <Volume2 className="w-3 h-3 text-purple-600" />
                  ) : (
                    <VolumeX className="w-3 h-3 text-gray-400" />
                  )}
                  Include Audio Tracks
                </span>
                <input
                  type="checkbox"
                  checked={exportSettings.includeAudio}
                  onChange={(e) => setExportSettings((prev) => ({ ...prev, includeAudio: e.target.checked }))}
                  disabled={isRendering}
                  className="rounded border-gray-300 accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Custom Filename */}
              <div>
                <label className="text-[10px] text-gray-600 font-medium block mb-1">Output Filename (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. final-commercial-cut"
                  value={exportSettings.filename || ""}
                  onChange={(e) => setExportSettings((prev) => ({ ...prev, filename: e.target.value }))}
                  disabled={isRendering}
                  className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 font-mono placeholder:text-gray-400 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-xs transition"
                />
              </div>

              {/* Start Render Button with Duplicate Protection */}
              <button
                type="button"
                onClick={() => onTriggerRender(exportSettings)}
                disabled={isRendering}
                className="w-full mt-2 py-2 px-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs"
              >
                {isRendering ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-200" /> Rendering Production MP4...
                  </>
                ) : (
                  <>
                    <Film className="w-3.5 h-3.5" /> Start Production Render
                  </>
                )}
              </button>
            </div>

            {/* Section 2: Real Render Jobs Queue */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Render Jobs &amp; Outputs ({renders.length})
                </span>
                {renders.length > 0 && (
                  <span className="text-[10px] font-mono text-emerald-700 font-medium">
                    Latest: {renders[0]?.resolution || "1080p"}
                  </span>
                )}
              </div>

              {/* Active Render Progress Card */}
              {isRendering && (
                <div className="p-3 rounded-lg border border-purple-300 bg-purple-50 space-y-2 animate-pulse">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-purple-900 flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3 animate-spin text-purple-600" /> Active Render in Progress
                    </span>
                    <span className="text-[10px] text-purple-700 font-mono font-medium">RENDERING</span>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Puppeteer frame capture and FFmpeg {exportSettings.resolution} encoding...
                  </p>
                  <div className="w-full bg-purple-200 rounded-full h-1 overflow-hidden">
                    <div className="bg-purple-600 h-full w-2/3 animate-[pulse_1.5s_infinite]"></div>
                  </div>
                </div>
              )}

              {renders.length === 0 && !isRendering ? (
                <div className="text-center py-6 px-3 border border-dashed border-gray-300 rounded-lg text-gray-500 text-xs bg-gray-50">
                  <FileVideo className="w-6 h-6 mx-auto mb-2 opacity-40 text-gray-400" />
                  No render jobs yet. Configure settings above and click Start Production Render.
                </div>
              ) : (
                renders.map((job) => {
                  const isCompleted = job.status === "completed";
                  const isFailed = job.status === "failed";
                  const isJobRendering = job.status === "rendering";
                  const downloadUrl = job.outputUrl || job.videoUrl;

                  return (
                    <div
                      key={job.id}
                      className={`p-3 rounded-lg border text-xs space-y-2 transition ${
                        isCompleted
                          ? "border-emerald-200 bg-emerald-50/50 text-gray-800"
                          : isFailed
                          ? "border-red-200 bg-red-50/50 text-gray-800"
                          : "border-purple-200 bg-purple-50/50 text-gray-800"
                      }`}
                    >
                      {/* Job Header */}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <FileVideo className="w-3.5 h-3.5 text-purple-600" />
                          Production MP4
                        </span>
                        <span
                          className={`flex items-center gap-1 text-[10px] font-medium ${
                            isCompleted
                              ? "text-emerald-700"
                              : isFailed
                              ? "text-red-600"
                              : "text-purple-700"
                          }`}
                        >
                          {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                          {isFailed && <AlertCircle className="w-3 h-3" />}
                          {isJobRendering && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {job.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Job Metadata */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-500 font-mono">
                        <span>{job.resolution}</span>
                        <span>&bull;</span>
                        <span>{job.fps}fps</span>
                        {job.duration && (
                          <>
                            <span>&bull;</span>
                            <span>{job.duration}s</span>
                          </>
                        )}
                        {job.fileSizeFormatted && (
                          <>
                            <span>&bull;</span>
                            <span className="text-gray-700 font-medium">{job.fileSizeFormatted}</span>
                          </>
                        )}
                      </div>

                      <div className="text-[9px] text-gray-400 font-mono">
                        {job.createdAt}
                      </div>

                      {/* Error details if failed */}
                      {isFailed && job.error && (
                        <div className="p-2 rounded bg-red-100 border border-red-200 text-[10px] text-red-700">
                          {job.error}
                        </div>
                      )}

                      {/* Action Links */}
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
                        {isCompleted && downloadUrl && (
                          <>
                            {onSelectPreviewVideo && (
                              <button
                                type="button"
                                onClick={() => onSelectPreviewVideo(downloadUrl)}
                                className="flex-1 py-1 px-2 rounded bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 text-[11px] font-medium flex items-center justify-center gap-1 transition shadow-xs"
                              >
                                <Play className="w-3 h-3 fill-current" /> Preview
                              </button>
                            )}

                            <a
                              href={downloadUrl}
                              download={`render-${job.id}.mp4`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-1 px-2 rounded bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 text-[11px] font-medium flex items-center justify-center gap-1 transition text-center shadow-xs"
                            >
                              <Download className="w-3 h-3" /> Download
                            </a>
                          </>
                        )}

                        {isFailed && (
                          <button
                            type="button"
                            onClick={() => onTriggerRender(exportSettings)}
                            disabled={isRendering}
                            className="flex-1 py-1 px-2 rounded bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 text-[11px] font-medium flex items-center justify-center gap-1 transition shadow-xs"
                          >
                            <RotateCcw className="w-3 h-3" /> Retry Render
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COMPOSITION VARIABLES */}
      {activeTab === "variables" && (
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-white text-gray-800">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
            Exposed Template Variables
          </span>

          {Object.entries(variables).map(([key, val]) => (
            <div key={key} className="space-y-1.5">
              <label className="text-[10px] text-gray-600 font-mono font-medium">{key}</label>
              <input
                type="text"
                value={val}
                onChange={(e) => onUpdateVariable(key, e.target.value)}
                className="w-full bg-[#f9fafb] border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-xs transition"
              />
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

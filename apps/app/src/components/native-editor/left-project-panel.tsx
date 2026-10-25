"use client";

import React, { useState, useMemo, useRef } from "react";
import { 
  Folder, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Type, 
  Code2, 
  Layers, 
  Plus, 
  Search, 
  Copy, 
  Trash2,
  FileCode,
  Sparkles,
  Palette,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  FolderPlus,
  FilePlus,
  Maximize2,
  X,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  File,
  Film,
  Zap,
  Play,
  Upload,
  Bot,
  GripVertical,
  Clock
} from "lucide-react";
import { CompositionScene, CompositionLayer, SelectedElement, AssetItem } from "./types";
import { AIAgentPanel } from "./ai-agent-panel";
import { CATALOG_ITEMS, CATALOG_CATEGORIES, CatalogItem } from "./catalog-data";
import { AnimationLibraryPanel, LottieItem, AnimationPresetItem } from "./animation-library-panel";
import { toast } from "sonner";

interface LeftProjectPanelProps {
  scenes: CompositionScene[];
  activeSceneId: string;
  onSelectScene: (sceneId: string) => void;
  onAddScene: () => void;
  files: Record<string, string>;
  selectedFile: string;
  onSelectFile: (fileName: string) => void;
  onCodeChange: (newCode: string) => void;
  onSaveCode: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  currentTime?: number;
  layers?: CompositionLayer[];
  selectedElement?: SelectedElement | null;
  onClearSelectedElement?: () => void;
  projectId?: string;
  onDropAssetToTimeline?: (asset: AssetItem, targetTime?: number, trackType?: "visual" | "audio" | "scene") => void;
  onInsertLottie?: (animation: LottieItem) => void;
  onApplyPreset?: (preset: AnimationPresetItem) => void;
}

export const LeftProjectPanel: React.FC<LeftProjectPanelProps> = ({
  scenes,
  activeSceneId,
  onSelectScene,
  onAddScene,
  files,
  selectedFile,
  onSelectFile,
  onCodeChange,
  onSaveCode,
  currentTime = 0,
  layers = [],
  isCollapsed = false,
  onToggleCollapse,
  selectedElement = null,
  onClearSelectedElement,
  projectId,
  onDropAssetToTimeline,
  onInsertLottie,
  onApplyPreset,
}) => {
  const [activeTab, setActiveTab] = useState<"compositions" | "assets" | "agent" | "code" | "catalog" | "animations">("compositions");
  const [searchQuery, setSearchQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState<string>("All");
  const [assetFilter, setAssetFilter] = useState<"all" | "image" | "audio" | "video">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default Lottie Insertion Handler (embeds dotlottie into active composition)
  const handleDefaultInsertLottie = (anim: LottieItem) => {
    const lottieScript = `<script type="module" src="https://unpkg.com/@dotlottie/player-component@latest/dist/dotlottie-player.mjs"></script>`;
    const lottieTag = `<!-- FreeCut Lottie: ${anim.name} -->
<dotlottie-player src="${anim.lottieUrl}" class="clip lottie-animation" data-start="${Math.round(currentTime)}" data-duration="5" background="transparent" speed="1" style="position: absolute; width: 320px; height: 320px; top: 25%; left: 35%; z-index: 1000;" loop autoplay></dotlottie-player>`;

    const currentCode = files[selectedFile] || files["index.html"] || "";
    let updatedCode = currentCode;
    if (!updatedCode.includes("@dotlottie/player-component") && updatedCode.includes("</head>")) {
      updatedCode = updatedCode.replace("</head>", `  ${lottieScript}\n</head>`);
    }
    if (updatedCode.includes("</body>")) {
      updatedCode = updatedCode.replace("</body>", `  ${lottieTag}\n</body>`);
    } else {
      updatedCode = updatedCode + "\n\n" + lottieTag;
    }
    onCodeChange(updatedCode);
    toast.success(`Inserted "${anim.name}" Lottie animation into composition!`);
  };

  // Default Motion Preset Handler (applies keyframes to active element/scene)
  const handleDefaultApplyPreset = (preset: AnimationPresetItem) => {
    const targetSelector = selectedElement ? `#${selectedElement.id}` : ".scene-root";
    const cssRule = `\n/* FreeCut Motion Preset: ${preset.name} */\n${preset.cssKeyframes}\n${targetSelector} {\n  animation: ${preset.cssAnimation};\n}\n`;

    const currentCode = files[selectedFile] || files["index.html"] || "";
    let updatedCode = currentCode;
    if (updatedCode.includes("</style>")) {
      updatedCode = updatedCode.replace("</style>", `${cssRule}</style>`);
    } else if (updatedCode.includes("</head>")) {
      updatedCode = updatedCode.replace("</head>", `  <style>${cssRule}</style>\n</head>`);
    } else {
      updatedCode = updatedCode + `\n<style>${cssRule}</style>`;
    }
    onCodeChange(updatedCode);
    toast.success(`Applied "${preset.name}" motion preset to ${selectedElement ? selectedElement.id : "scene"}!`);
  };

  const [assets, setAssets] = useState<AssetItem[]>([
    { id: "asset-1", name: "karnataka-intro.jpg", type: "image", url: "assets/karnataka-intro.jpg", size: "680 KB" },
    { id: "asset-2", name: "karnataka-coorg.jpg", type: "image", url: "assets/karnataka-coorg.jpg", size: "680 KB" },
    { id: "asset-3", name: "karnataka-mysuru.jpg", type: "image", url: "assets/karnataka-mysuru.jpg", size: "680 KB" },
    { id: "asset-4", name: "karnataka-bengaluru.jpg", type: "image", url: "assets/karnataka-bengaluru.jpg", size: "680 KB" },
    { id: "asset-5", name: "karnataka-finale.jpg", type: "image", url: "assets/karnataka-finale.jpg", size: "680 KB" },
    { id: "asset-6", name: "kerala-backwaters.jpg", type: "image", url: "assets/kerala-backwaters.jpg", size: "478 KB" },
    { id: "asset-7", name: "kerala-coast.jpg", type: "image", url: "assets/kerala-coast.jpg", size: "297 KB" },
    { id: "asset-8", name: "kerala-culture.jpg", type: "image", url: "assets/kerala-culture.jpg", size: "794 KB" },
    { id: "asset-9", name: "kerala-intro.jpg", type: "image", url: "assets/kerala-intro.jpg", size: "680 KB" },
    { id: "asset-10", name: "kerala-mountains.jpg", type: "image", url: "assets/kerala-mountains.jpg", size: "1.4 MB" },
    { id: "asset-11", name: "logo.png", type: "image", url: "assets/logo.png", size: "48 KB" },
    { id: "asset-12", name: "bgm.mp3", type: "audio", url: "assets/bgm.mp3", size: "3.2 MB" },
  ]);

  const [copiedPromptModal, setCopiedPromptModal] = useState<{
    open: boolean;
    title: string;
    prompt: string;
  } | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    ".backups": false,
    "assets": false,
    "inspect": false,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Available files list derived from files prop with defaults
  const fileKeys = useMemo(() => {
    const defaultList = [
      "index.html",
      ".convex-project-id",
      "hyperframes.json",
      "meta.json",
      "styles.css",
      "script.js",
    ];
    const set = new Set([...Object.keys(files), ...defaultList]);
    return Array.from(set).filter((f) => !f.startsWith(".backups/") && !f.startsWith("assets/") && !f.startsWith("inspect/"));
  }, [files]);

  // Filter catalog items across all 448 items and 10 categories
  const filteredCatalog = useMemo(() => {
    return CATALOG_ITEMS.filter((item) => {
      const matchesCategory = catalogCategory === "All" || item.category === catalogCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [catalogCategory, searchQuery]);

  // Generate Prompt and copy to clipboard for "Ask agent" (matching official HyperFrames Studio)
  const handleCopyPrompt = async (item: CatalogItem) => {
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    const categoryDirectives: Record<string, string> = {
      Captions:
        "Transcribe the audio with /media-use, then wire the transcript into this caption component. Match the font colors and animation timing to my composition's design tokens. Place it as an overlay above the main content with the highest z-index.",
      VFX:
        "This is a WebGL effect that requires chrome://flags/#html-in-canvas. Layer it on top of all content, adjust the shader uniforms and color palette to complement my scene, and set the duration to match the composition.",
      Transitions:
        "Place this transition at the cut point between the current scene and the next. Set the duration to 0.5 to 1s, position it at the scene boundary on the timeline, and make sure the z-index is above the transitioning scenes.",
      Effects:
        "Layer this on top of the current content. Adjust the opacity, colors, and animation timing to enhance the scene without obscuring the primary message.",
      "Code Animations":
        "Place this component into the composition. Customize the code syntax, typing speed, and color theme to match my design system.",
      "Text Effects":
        "Place this kinetic text animation into my composition. Match font styles, colors, and timing to my design tokens.",
      Social:
        "Replace the placeholder text, handle, and avatar with my actual content. Match the typography and colors to my brand. Adjust timing to fit the overall narrative.",
      Data:
        "Replace the placeholder data with my actual values and labels. Adjust the color scale, animation stagger timing, and typography to fit the composition.",
      Scenes:
        "Replace all placeholder text, images, and content with my actual material. Match fonts, colors, and layout to my existing design tokens.",
    };

    const directive = categoryDirectives[item.category] || "Customize it to match my composition's design and timeline.";

    const categoryNameInPrompt =
      item.category === "Captions" ? "caption style" :
      item.category === "VFX" ? "VFX" :
      item.category === "Transitions" ? "transition" :
      item.category === "Effects" ? "effect" :
      item.category === "Code Animations" ? "code animation" :
      item.category === "Text Effects" ? "text effect" :
      item.category === "Social" ? "template" :
      item.category === "Data" ? "visualization" : "scene";

    let prompt = `Using /hyperframes, add the "${item.name}" ${categoryNameInPrompt} (registry: ${item.id}) to my composition.\n\n`;
    if (item.description) {
      prompt += `${item.description}\n\n`;
    }
    prompt += `${directive}\n\n`;
    prompt += `## Current composition state\n\n`;
    prompt += `Playback time: ${formattedTime}\n`;
    prompt += `Active composition: ${selectedFile || "index.html"}\n`;
    prompt += `Dimensions: 1920x1080\n\n`;

    if (layers && layers.length > 0) {
      prompt += `Elements visible at ${formattedTime}:\n`;
      layers.forEach((l, idx) => {
        prompt += `- ${l.name} (track ${idx}, 00:00–00:40)\n`;
      });
      prompt += `\nHighest track index: ${Math.max(layers.length - 1, 0)}\n`;
    } else {
      prompt += `Elements visible at ${formattedTime}:\n`;
      prompt += `- Scene Background (track 0, 00:00–00:40)\n`;
      prompt += `- Scene Content (track 1, 00:00–00:40)\n`;
      prompt += `\nHighest track index: 1\n`;
    }

    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(`Copied "${item.name}" AI prompt to clipboard!`, {
        description: `Ready to paste to your AI assistant.`,
      });
    } catch {
      // Fallback modal opens
    }
    setCopiedPromptModal({ open: true, title: item.name, prompt });
  };

  // Insert catalog item snippet directly into composition file
  const handleInsertCatalogItem = (item: CatalogItem) => {
    let snippet = "";
    if (item.category === "Captions") {
      snippet = `<!-- HyperFrames: ${item.id} -->
<div id="${item.id}" class="clip caption-${item.id}" data-composition-id="${item.id}" data-start="0" data-duration="40" style="position: absolute; inset: 0; z-index: 99999; pointer-events: none;">
  <div style="position: absolute; bottom: 12%; left: 0; width: 100%; display: flex; justify-content: center; gap: 14px; text-align: center;">
    <span style="font-family: 'Poppins', sans-serif; font-weight: 800; font-size: 46px; color: #fff8e9; text-transform: uppercase; letter-spacing: 0.05em; text-shadow: 0 4px 16px rgba(0,0,0,0.7);">${item.name.toUpperCase()}</span>
  </div>
</div>`;
    } else if (item.category === "Code Animations") {
      snippet = `<!-- HyperFrames: ${item.id} -->
<div id="${item.id}" class="clip code-animation-block" style="position: absolute; top: 15%; right: 8%; width: 520px; background: rgba(13,17,23,0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 18px; font-family: monospace; font-size: 14px; color: #38bdf8; z-index: 900; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
  <div style="display: flex; gap: 6px; margin-bottom: 12px;">
    <span style="width: 10px; height: 10px; border-radius: 50%; background: #ff5f56;"></span>
    <span style="width: 10px; height: 10px; border-radius: 50%; background: #ffbd2e;"></span>
    <span style="width: 10px; height: 10px; border-radius: 50%; background: #27c93f;"></span>
  </div>
  <code>$ hyperframes add ${item.id}</code>
</div>`;
    } else if (item.category === "VFX") {
      snippet = `<!-- HyperFrames: ${item.id} -->
<div id="${item.id}" class="clip vfx-overlay-layer" data-vfx="${item.id}" style="position: absolute; inset: 0; pointer-events: none; z-index: 9500; mix-blend-mode: screen; opacity: 0.85;">
  <canvas style="width: 100%; height: 100%; display: block;"></canvas>
</div>`;
    } else if (item.category === "Transitions") {
      snippet = `<!-- HyperFrames: ${item.id} -->
<div id="${item.id}" class="clip transition-layer" style="position: absolute; inset: 0; pointer-events: none; z-index: 9800; background: radial-gradient(circle, rgba(229,199,123,0.3) 0%, rgba(7,20,14,0.95) 75%); opacity: 0.9;"></div>`;
    } else if (item.category === "Social") {
      snippet = `<!-- HyperFrames: ${item.id} -->
<div id="${item.id}" class="clip social-card-overlay" style="position: absolute; top: 10%; right: 8%; z-index: 8500; background: rgba(22,27,34,0.92); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 16px 20px; box-shadow: 0 16px 36px rgba(0,0,0,0.5); font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
  <div style="display: flex; align-items: center; gap: 12px;">
    <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #a855f7, #6366f1); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 16px;">★</div>
    <div>
      <div style="font-size: 14px; font-weight: 700; color: #fff;">${item.name}</div>
      <div style="font-size: 11px; color: rgba(255,255,255,0.6);">@brand · 2m ago</div>
    </div>
  </div>
</div>`;
    } else if (item.category === "Data") {
      snippet = `<!-- HyperFrames: ${item.id} -->
<div id="${item.id}" class="clip data-viz-block" style="position: absolute; bottom: 15%; left: 8%; z-index: 8000; background: rgba(15,23,42,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; min-width: 320px;">
  <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 6px;">${item.name}</div>
  <div style="font-size: 36px; font-weight: 800; color: #e5c77b;">+148% <span style="font-size: 14px; font-weight: 500; color: #10b981;">↑ YoY Growth</span></div>
</div>`;
    } else {
      snippet = `<!-- HyperFrames: ${item.id} -->
<div id="${item.id}" class="clip scene-component-${item.id}" style="position: absolute; inset: 0; z-index: 7000; pointer-events: none;">
  <!-- ${item.name} (${item.category}) -->
</div>`;
    }

    const currentCode = files[selectedFile] || "";
    let updatedCode = currentCode;
    if (currentCode.includes("</body>")) {
      updatedCode = currentCode.replace("</body>", `  ${snippet}\n</body>`);
    } else {
      updatedCode = currentCode + "\n\n" + snippet;
    }
    onCodeChange(updatedCode);
    toast.success(`Added "${item.name}" component to ${selectedFile}!`);
  };

  // Add Asset directly to scene composition HTML
  const handleAddAssetToScene = (asset: AssetItem) => {
    let snippet = "";
    if (asset.type === "image") {
      snippet = `<!-- Injected Asset: ${asset.name} -->
<img src="${asset.url}" class="clip scene-asset" data-start="0" data-duration="40" style="position: absolute; width: 480px; height: auto; top: 22%; left: 32%; border-radius: 12px; box-shadow: 0 16px 36px rgba(0,0,0,0.5); z-index: 1000;" alt="${asset.name}" />`;
    } else if (asset.type === "audio") {
      snippet = `<!-- Injected Audio: ${asset.name} -->
<audio src="${asset.url}" class="clip audio-track" data-start="0" data-duration="40" preload="auto"></audio>`;
    } else if (asset.type === "video") {
      snippet = `<!-- Injected Video: ${asset.name} -->
<video src="${asset.url}" class="clip video-track" data-start="0" data-duration="15" autoplay muted loop playsinline style="position: absolute; width: 560px; height: auto; top: 20%; left: 25%; border-radius: 12px; z-index: 1000;"></video>`;
    }

    const currentCode = files[selectedFile] || files["index.html"] || "";
    let updatedCode = currentCode;
    if (currentCode.includes("</body>")) {
      updatedCode = currentCode.replace("</body>", `  ${snippet}\n</body>`);
    } else {
      updatedCode = currentCode + "\n\n" + snippet;
    }
    onCodeChange(updatedCode);
    toast.success(`Added "${asset.name}" to composition scene!`);
  };

  // Handle User Uploading Real Media Files
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const newAssetsList: AssetItem[] = [];
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      if (!file) continue;
      const isAudio = file.type.startsWith("audio");
      const isVideo = file.type.startsWith("video");
      const type: "image" | "audio" | "video" = isAudio ? "audio" : isVideo ? "video" : "image";
      const objectUrl = URL.createObjectURL(file);
      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${Math.round(file.size / 1024)} KB`;
      newAssetsList.push({
        id: `upload-${Date.now()}-${i}`,
        name: file.name,
        type,
        url: objectUrl,
        size: sizeStr,
      });
    }
    setAssets((prev) => [...newAssetsList, ...prev]);
    toast.success(`Uploaded ${uploadedFiles.length} file(s) to project assets!`);
  };

  // Compute line count and line numbers for code editor
  const codeContent = files[selectedFile] || "";
  const lines = useMemo(() => codeContent.split("\n"), [codeContent]);

  // Collapsed Rail View (Icons Only)
  if (isCollapsed) {
    return (
      <aside className="w-12 shrink-0 bg-white border-r border-gray-200 flex flex-col items-center py-2 text-gray-700 select-none z-10 shadow-xs">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 mb-3 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition"
          title="Expand Project Panel"
        >
          <ChevronRight className="w-4 h-4 text-purple-600" />
        </button>

        <div className="flex flex-col gap-2 w-full px-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab("compositions");
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-full aspect-square rounded-md flex items-center justify-center transition ${
              activeTab === "compositions"
                ? "bg-purple-50 text-purple-700 border border-purple-200 font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Compositions"
          >
            <Folder className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("assets");
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-full aspect-square rounded-md flex items-center justify-center transition ${
              activeTab === "assets"
                ? "bg-purple-50 text-purple-700 border border-purple-200 font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Media Assets"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("agent");
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-full aspect-square rounded-md flex items-center justify-center transition ${
              activeTab === "agent"
                ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-bold shadow-xs"
                : "text-purple-600 hover:bg-purple-50 hover:text-purple-900"
            }`}
            title="Ollama AI Video Agent"
          >
            <Bot className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("code");
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-full aspect-square rounded-md flex items-center justify-center transition ${
              activeTab === "code"
                ? "bg-purple-50 text-purple-700 border border-purple-200 font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Source Code"
          >
            <Code2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("catalog");
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-full aspect-square rounded-md flex items-center justify-center transition ${
              activeTab === "catalog"
                ? "bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="Component Catalog"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("animations");
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-full aspect-square rounded-md flex items-center justify-center transition ${
              activeTab === "animations"
                ? "bg-purple-50 text-purple-700 border border-purple-200 font-bold"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
            title="FreeCut Animations & Lottie"
          >
            <Zap className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`${
        activeTab === "code"
          ? "w-[580px] xl:w-[680px]"
          : activeTab === "catalog" || activeTab === "animations"
          ? "w-80 md:w-[420px]"
          : activeTab === "agent"
          ? "w-80 md:w-[380px]"
          : "w-64 md:w-72"
      } shrink-0 bg-white border-r border-gray-200 flex flex-col text-gray-800 select-none min-h-0 z-10 transition-all duration-200 shadow-xs`}
    >
      {/* Navigation Tabs Header with Collapse & Window Controls */}
      <div className="h-10 bg-[#f9fafb] border-b border-gray-200 flex items-center px-2.5 gap-1 shrink-0 justify-between">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("compositions")}
            className={`px-2 py-1 text-[11px] rounded transition flex items-center gap-1.5 ${
              activeTab === "compositions"
                ? "bg-white text-gray-900 border border-gray-300 font-bold shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 font-medium"
            }`}
          >
            <Folder className="w-3.5 h-3.5" /> Compositions
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            className={`px-2 py-1 text-[11px] rounded transition flex items-center gap-1.5 ${
              activeTab === "assets"
                ? "bg-white text-gray-900 border border-gray-300 font-bold shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 font-medium"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Assets
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("animations")}
            className={`px-2 py-1 text-[11px] rounded transition flex items-center gap-1.5 ${
              activeTab === "animations"
                ? "bg-white text-purple-900 border border-purple-300 font-bold shadow-xs"
                : "text-purple-700 hover:text-purple-900 hover:bg-purple-50 font-semibold"
            }`}
            title="FreeCut Animation Assets & Lottie Library"
          >
            <Zap className="w-3.5 h-3.5 text-purple-600" /> Animations
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("agent")}
            className={`px-2 py-1 text-[11px] rounded transition flex items-center gap-1.5 ${
              activeTab === "agent"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-xs"
                : "text-purple-700 hover:text-purple-900 hover:bg-purple-50 font-semibold"
            }`}
            title="Ollama AI Video Agent"
          >
            <Bot className={`w-3.5 h-3.5 ${activeTab === "agent" ? "text-white" : "text-purple-600"}`} /> Agent
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("code")}
            className={`px-2 py-1 text-[11px] rounded transition flex items-center gap-1.5 ${
              activeTab === "code"
                ? "bg-white text-gray-900 border border-gray-300 font-bold shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 font-medium"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> Code
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`px-2 py-1 text-[11px] rounded transition flex items-center gap-1.5 ${
              activeTab === "catalog"
                ? "bg-white text-gray-900 border border-gray-300 font-bold shadow-xs"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 font-medium"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-600" /> Catalog
          </button>
        </div>

        {/* Panel controls */}
        <div className="flex items-center gap-1 text-gray-400">
          <button
            type="button"
            className="p-1 rounded hover:bg-gray-100 hover:text-gray-700 transition"
            title="Options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-gray-100 hover:text-gray-700 transition"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: COMPOSITIONS */}
      {activeTab === "compositions" && (
        <div className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden bg-white">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Scenes ({scenes.length})
            </span>
            <button
              type="button"
              onClick={onAddScene}
              className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 text-xs rounded flex items-center gap-1 transition shadow-xs font-medium"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {scenes.map((s, idx) => {
              const isSelected = s.id === activeSceneId;
              return (
                <div
                  key={s.id}
                  onClick={() => onSelectScene(s.id)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition flex flex-col ${
                    isSelected
                      ? "bg-purple-50 border-purple-400 text-purple-900 shadow-xs font-semibold"
                      : "bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-900">Scene {idx + 1}</span>
                    <span className="text-[10px] font-mono text-purple-700 font-bold bg-purple-100/60 px-1.5 py-0.2 rounded">{s.duration}s</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-400 truncate mt-1">
                    {s.file}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: ASSETS LIBRARY */}
      {activeTab === "assets" && (
        <div className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden">
          {/* Hidden File Input for Real Uploads */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/*,audio/*,video/*"
            className="hidden"
          />

          {/* Search Assets */}
          <div className="relative mb-2 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f9fafb] border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 focus:bg-white transition"
            />
          </div>

          {/* Type Filter Chips */}
          <div className="flex items-center gap-1 mb-2.5 shrink-0 overflow-x-auto no-scrollbar">
            {(["all", "image", "audio", "video"] as const).map((filterType) => (
              <button
                key={filterType}
                type="button"
                onClick={() => setAssetFilter(filterType)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider transition ${
                  assetFilter === filterType
                    ? "bg-purple-50 text-purple-700 border border-purple-200 font-bold"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {filterType === "all" ? "All" : `${filterType}s`}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
            {/* Upload Media Button Card */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-gray-300 hover:border-purple-500 rounded-lg p-3.5 text-center hover:bg-purple-50/20 cursor-pointer transition bg-gray-50/50 group"
            >
              <div className="w-8 h-8 rounded-full bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center mx-auto mb-1 text-purple-700 transition">
                <Upload className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-gray-800 group-hover:text-purple-700 transition">
                Upload Media
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">Click to choose Images, Audio, MP4, SVGs</p>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 rounded-lg p-2.5 flex items-center gap-2 text-purple-900 text-[11px] leading-tight shadow-2xs">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0 animate-pulse" />
              <span><strong>Drag &amp; Drop</strong> any media directly onto the <strong>Timeline lanes</strong> or <strong>Canvas</strong>!</span>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 uppercase tracking-wider">
              <span>Project Assets ({assets.length})</span>
            </div>

            {/* Asset Cards Grid */}
            <div className="grid grid-cols-2 gap-2">
              {assets
                .filter((a) => {
                  const matchesFilter = assetFilter === "all" || a.type === assetFilter;
                  const q = searchQuery.toLowerCase().trim();
                  const matchesQuery = q === "" || a.name.toLowerCase().includes(q);
                  return matchesFilter && matchesQuery;
                })
                .map((asset) => {
                  const isImg = asset.type === "image";
                  const isAud = asset.type === "audio";
                  const isVid = asset.type === "video";

                  return (
                    <div
                      key={asset.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify(asset));
                        e.dataTransfer.setData("text/plain", asset.url);
                        e.dataTransfer.effectAllowed = "copyMove";
                      }}
                      className="bg-white border border-gray-200 hover:border-purple-400 hover:shadow-md rounded-lg p-2 flex flex-col justify-between group transition shadow-2xs cursor-grab active:cursor-grabbing"
                      title="Drag onto Timeline or Canvas"
                    >
                      {/* Asset Preview Thumbnail */}
                      <div className="w-full h-18 bg-gray-100 rounded-md overflow-hidden relative mb-1.5 flex items-center justify-center border border-gray-200">
                        {isImg ? (
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200 pointer-events-none"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : isAud ? (
                          <div className="flex flex-col items-center justify-center gap-1 text-emerald-600 pointer-events-none">
                            <Music className="w-5 h-5" />
                            <span className="text-[9px] font-mono text-emerald-700 font-bold">AUDIO</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 text-indigo-600 pointer-events-none">
                            <Video className="w-5 h-5" />
                            <span className="text-[9px] font-mono text-indigo-700 font-bold">VIDEO</span>
                          </div>
                        )}

                        {/* Drag Handle Overlay */}
                        <div className="absolute top-1 left-1 p-0.5 rounded bg-black/60 text-white/90 opacity-75 group-hover:opacity-100 transition" title="Drag to Timeline">
                          <GripVertical className="w-3 h-3" />
                        </div>

                        <span className="absolute top-1 right-1 text-[8px] font-bold px-1 py-0.2 rounded bg-black/60 text-white">
                          {asset.type.toUpperCase()}
                        </span>
                      </div>

                      {/* Asset Details */}
                      <div className="mb-1.5">
                        <span className="text-[11px] font-semibold text-gray-800 truncate block" title={asset.name}>
                          {asset.name}
                        </span>
                        {asset.size && (
                          <span className="text-[10px] text-gray-400 font-mono block">
                            {asset.size}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons: Add to Scene & Add to Timeline */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddAssetToScene(asset);
                          }}
                          className="flex-1 py-1 px-1 rounded bg-cyan-500 hover:bg-cyan-400 text-black text-[10px] font-bold flex items-center justify-center gap-1 shadow-xs transition"
                          title="Add asset directly into composition"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Scene</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onDropAssetToTimeline) {
                              onDropAssetToTimeline(asset, currentTime, asset.type === "audio" ? "audio" : "visual");
                            } else {
                              handleAddAssetToScene(asset);
                            }
                          }}
                          className="flex-1 py-1 px-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center gap-1 shadow-xs transition"
                          title={`Insert into Timeline at playhead (${currentTime.toFixed(1)}s)`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>Timeline</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SOURCE CODE (FILES LIST + LIVE CODE EDITOR SPLIT VIEW, MATCHING SCREENSHOT 2) */}
      {activeTab === "code" && (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Column: FILES TREE */}
          <div className="w-48 shrink-0 bg-[#f9fafb] border-r border-gray-200 flex flex-col p-2.5">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200 text-gray-600">
              <span className="text-[11px] font-bold tracking-wider text-gray-700">FILES</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toast.info("Create new file...")}
                  className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-800 transition"
                  title="New File"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toast.info("Create new folder...")}
                  className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-800 transition"
                  title="New Folder"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* File List Tree */}
            <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px]">
              {/* index.html with Orange Lint Badge */}
              <div
                onClick={() => onSelectFile("index.html")}
                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition ${
                  selectedFile === "index.html"
                    ? "bg-purple-50 border border-purple-300 text-purple-900 font-semibold"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <FileCode className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">index.html</span>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-sans font-semibold px-1.5 py-0.2 rounded-full border border-amber-300">
                  16
                </span>
              </div>

              {/* Collapsible Folders */}
              {[".backups", "assets", "inspect"].map((folderName) => (
                <div key={folderName}>
                  <div
                    onClick={() =>
                      setExpandedFolders((prev) => ({
                        ...prev,
                        [folderName]: !prev[folderName],
                      }))
                    }
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 cursor-pointer transition"
                  >
                    <ChevronRight
                      className={`w-3 h-3 transition-transform ${
                        expandedFolders[folderName] ? "rotate-90 text-purple-600" : ""
                      }`}
                    />
                    <Folder className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>{folderName}</span>
                  </div>
                  {expandedFolders[folderName] && (
                    <div className="pl-6 py-0.5 space-y-1 text-gray-400">
                      <span className="block text-[10px] italic">folder contents</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Other Root Project Files */}
              {fileKeys
                .filter((f) => f !== "index.html")
                .map((fileName) => {
                  const isSelected = selectedFile === fileName;
                  return (
                    <div
                      key={fileName}
                      onClick={() => onSelectFile(fileName)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition ${
                        isSelected
                          ? "bg-purple-50 border border-purple-300 text-purple-900 font-semibold"
                          : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                      }`}
                    >
                      <File className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{fileName}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Right Column: LIVE CODE EDITOR WITH LINE NUMBERS */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white">
            {/* Active file top sub-bar */}
            <div className="h-8 bg-[#f9fafb] border-b border-gray-200 px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-mono font-medium text-gray-800">{selectedFile}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSaveCode}
                  className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded transition shadow-xs"
                  title="Save file edits"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Code View Area: Line Numbers + Textarea */}
            <div className="flex-1 min-h-0 flex overflow-hidden relative font-mono text-[11px] leading-[18px]">
              {/* Line Numbers Gutter */}
              <div className="w-10 shrink-0 bg-[#f9fafb] border-r border-gray-200 py-2 text-right pr-2 select-none text-gray-400 overflow-hidden">
                {lines.slice(0, 150).map((_, i) => (
                  <div key={i} className="h-[18px] flex items-center justify-end gap-1">
                    {/* Fold icon on some tag lines */}
                    {(i === 1 || i === 2 || i === 9 || i === 10) && (
                      <ChevronDown className="w-2.5 h-2.5 text-gray-400" />
                    )}
                    <span>{i + 1}</span>
                  </div>
                ))}
              </div>

              {/* Code Textarea with Highlighting appearance */}
              <textarea
                ref={textareaRef}
                value={codeContent}
                onChange={(e) => onCodeChange(e.target.value)}
                spellCheck={false}
                className="flex-1 min-w-0 h-full bg-white p-2 text-gray-900 resize-none focus:outline-none overflow-y-auto leading-[18px] selection:bg-purple-100"
              />
            </div>

            {/* Bottom Status Bar: Lint Badge (matching Screenshot 2) */}
            <div className="h-7 bg-[#f9fafb] border-t border-gray-200 px-3 flex items-center justify-between text-[11px] shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-gray-600">
                  <CheckCircle2 className="w-3 h-3 text-gray-400" />
                  <span>Lint</span>
                </span>
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full font-sans">
                  16
                </span>
              </div>

              <div className="flex items-center gap-3 text-gray-500 text-[10px]">
                <span>UTF-8</span>
                <span>{lines.length} lines</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COMPONENT CATALOG (MATCHING OFFICIAL HYPERFRAMES STUDIO) */}
      {activeTab === "catalog" && (
        <div className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden bg-white">
          {/* Top Search Bar */}
          <div className="relative mb-2.5 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, category, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f9fafb] border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition shadow-xs"
            />
          </div>

          {/* Category Filter Pills (All 10 Categories matching official studio) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 shrink-0">
            {CATALOG_CATEGORIES.map((cat) => {
              const isSelected = catalogCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCatalogCategory(cat)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition whitespace-nowrap ${
                    isSelected
                      ? "bg-cyan-600 text-white shadow-xs font-semibold"
                      : "bg-[#f9fafb] border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Item count header */}
          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5 px-0.5 shrink-0">
            <span>Showing {filteredCatalog.length} items</span>
            <span className="text-cyan-700 font-medium">{catalogCategory}</span>
          </div>

          {/* Catalog Cards Grid (2 columns matching official studio) */}
          <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-2.5 pr-1 py-1">
            {filteredCatalog.map((item) => {
              const catColor = 
                item.category === "Captions" ? "#0284c7" :
                item.category === "Code Animations" ? "#059669" :
                item.category === "VFX" ? "#9333ea" :
                item.category === "Transitions" ? "#d97706" :
                item.category === "Effects" ? "#e11d48" :
                item.category === "Text Effects" ? "#4f46e5" :
                item.category === "Social" ? "#2563eb" :
                item.category === "Data" ? "#0d9488" : "#64748b";

              return (
                <div
                  key={item.id}
                  className="group p-2 rounded-lg border border-gray-200 bg-white hover:border-cyan-400 hover:shadow-xs transition flex flex-col justify-between relative"
                >
                  {/* Visual Thumbnail */}
                  <div className="w-full h-18 rounded bg-[#f1f5f9] border border-gray-100 flex flex-col justify-between p-1.5 mb-2 relative overflow-hidden group-hover:scale-[1.01] transition">
                    {/* Top Badges (Duration, WebGL) */}
                    <div className="flex items-center justify-end gap-1 z-10">
                      {item.isWebGL && (
                        <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-[#9333ea] text-white leading-tight">
                          WebGL
                        </span>
                      )}
                      {item.duration && (
                        <span className="px-1 py-0.2 rounded text-[9px] font-medium bg-black/70 text-white font-mono leading-tight">
                          {item.duration}
                        </span>
                      )}
                    </div>

                    {/* Center Preview Typography */}
                    <div className="flex-1 flex items-center justify-center text-center px-1">
                      {item.category === "Captions" ? (
                        <span className="text-[11px] font-black tracking-wider text-cyan-700 uppercase block">
                          CAPTIONS
                        </span>
                      ) : item.category === "Code Animations" ? (
                        <span className="text-[10px] font-mono text-emerald-700 block truncate">
                          &lt;Code /&gt;
                        </span>
                      ) : item.category === "VFX" ? (
                        <span className="text-[11px] font-extrabold tracking-wider text-purple-700 uppercase">
                          VFX
                        </span>
                      ) : item.category === "Transitions" ? (
                        <span className="text-[10px] font-bold tracking-wider text-amber-700 uppercase">
                          TRANSITION
                        </span>
                      ) : item.category === "Data" ? (
                        <span className="text-[10px] font-bold text-teal-700">
                          📊 DATA
                        </span>
                      ) : item.category === "Social" ? (
                        <span className="text-[10px] font-medium text-blue-700">
                          @social
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-gray-700 block truncate">
                          {item.name}
                        </span>
                      )}
                    </div>

                    {/* Action buttons row directly on card */}
                    <div className="flex items-center gap-1 z-10 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyPrompt(item);
                        }}
                        className="flex-1 py-1 px-1 rounded bg-white hover:bg-cyan-50 hover:text-cyan-800 border border-gray-200 text-[10px] font-medium text-gray-700 flex items-center justify-center gap-1 transition shadow-xs"
                        title="Copy AI Prompt"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-cyan-600" />
                        <span>Ask agent</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInsertCatalogItem(item);
                        }}
                        className="py-1 px-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold flex items-center justify-center gap-0.5 transition shadow-xs"
                        title="Insert to composition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Title & Category Tag */}
                  <div className="px-0.5">
                    <span 
                      className="text-xs font-semibold text-gray-900 group-hover:text-cyan-700 transition block truncate"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }}></span>
                      <span className="text-[10px] text-gray-500 font-medium truncate">{item.category}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ask Agent Prompt Copied Modal Dialog (Ultra High Visibility & Contrast) */}
          {copiedPromptModal?.open && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 shadow-xs">
                      <Sparkles className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900 tracking-wide">
                        Ask Agent: <span className="text-cyan-700 underline decoration-cyan-300">{copiedPromptModal.title}</span>
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied to clipboard! Ready to paste into Antigravity Chat.</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCopiedPromptModal(null)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Helper notice */}
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-3.5 py-2 text-xs text-cyan-900 flex items-center justify-between">
                  <span>💡 Press <strong className="text-gray-900 font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">⌘V / Ctrl+V</strong> in Antigravity Chat to paste this instruction.</span>
                </div>

                {/* Prompt Preview Code Box */}
                <div className="flex-1 overflow-y-auto">
                  <pre className="bg-[#f8fafc] border border-gray-200 rounded-xl p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap select-all leading-relaxed shadow-inner max-h-[46vh] overflow-y-auto">
                    {copiedPromptModal.prompt}
                  </pre>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-cyan-500/30">
                  <button
                    type="button"
                    onClick={() => {
                      // Find item and add to scene directly
                      const item = CATALOG_ITEMS.find((c) => c.name === copiedPromptModal.title);
                      if (item) {
                        handleInsertCatalogItem(item);
                        setCopiedPromptModal(null);
                      } else {
                        toast.info("Item snippet added to active composition!");
                        setCopiedPromptModal(null);
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Insert to Composition</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(copiedPromptModal.prompt);
                        toast.success("Copied prompt again!");
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 text-xs font-extrabold rounded-lg flex items-center gap-1.5 shadow-[0_0_20px_rgba(34,211,238,0.5)] transition"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy Again</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCopiedPromptModal(null)}
                      className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white text-xs font-semibold rounded-lg transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: OLLAMA AI AGENT */}
      {activeTab === "agent" && (
        <AIAgentPanel
          selectedElement={selectedElement || null}
          onClearSelectedElement={onClearSelectedElement}
          selectedFile={selectedFile}
          files={files}
          onCodeChange={onCodeChange}
          onSaveCode={onSaveCode}
          scenes={scenes}
          activeSceneId={activeSceneId}
          projectId={projectId}
        />
      )}

      {/* TAB: ANIMATION ASSETS & LOTTIE LIBRARY PANEL (FREECUT INTEGRATION) */}
      {activeTab === "animations" && (
        <AnimationLibraryPanel
          onInsertLottie={onInsertLottie || handleDefaultInsertLottie}
          onApplyPreset={onApplyPreset || handleDefaultApplyPreset}
          selectedElement={selectedElement}
          currentTime={currentTime}
        />
      )}
    </aside>
  );
};


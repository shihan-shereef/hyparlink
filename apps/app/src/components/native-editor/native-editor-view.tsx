"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { LeftProjectPanel } from "./left-project-panel";
import { InteractiveCanvas } from "./interactive-canvas";
import { RightPropertyPanel } from "./right-property-panel";
import { MultitrackTimeline } from "./multitrack-timeline";
import { SelectedElement, CompositionScene, RenderJob, CompositionLayer, ExportSettings, AssetItem } from "./types";
import { toast } from "sonner";
import { 
  Save, 
  Download, 
  Play, 
  Film, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Sparkles, 
  X, 
  FileVideo,
  Maximize2,
  Minimize2
} from "lucide-react";

interface NativeHyperlinkEditorProps {
  projectId: string;
  projectTitle: string;
  duration: number;
  fps: number;
  resolution: string;
  scenes: { id: string; file: string; start: number; duration: number }[];
  onUpdateScenes?: (updater: (prev: { id: string; file: string; start: number; duration: number }[]) => { id: string; file: string; start: number; duration: number }[]) => void;
  files: Record<string, string>;
  selectedFile: string;
  onSelectFile: (file: string) => void;
  onCodeChange: (code: string) => void;
  onSaveProject: () => Promise<void>;
  onSyncAndRender: (settings?: Partial<ExportSettings>) => Promise<void>;
  isRendering: boolean;
  previewSrc: string;
  renderedVideoUrl?: string | null;
  renders?: RenderJob[];
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const NativeHyperlinkEditor: React.FC<NativeHyperlinkEditorProps> = ({
  projectId,
  projectTitle,
  duration,
  fps,
  resolution,
  scenes,
  onUpdateScenes,
  files,
  selectedFile,
  onSelectFile,
  onCodeChange,
  onSaveProject,
  onSyncAndRender,
  isRendering,
  previewSrc,
  renderedVideoUrl,
  renders = [],
  hasUnsavedChanges = false,
  isSaving = false,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const [activeSceneId, setActiveSceneId] = useState<string>(scenes[0]?.id || "scene-01");
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [layers, setLayers] = useState<CompositionLayer[]>([]);
  const [localUnsaved, setLocalUnsaved] = useState<boolean>(false);
  const [previewingVideoUrl, setPreviewingVideoUrl] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({
    "--brand-name": "NETWORKERS HOME",
    "--primary-accent": "#00e5ff",
    "--bg-dark": "#071426",
  });
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(Date.now());

  // Render jobs queue synchronized with real backend data
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>(renders);

  useEffect(() => {
    if (renders && renders.length > 0) {
      setRenderJobs(renders);
    } else if (renderedVideoUrl) {
      setRenderJobs([
        {
          id: "render-latest",
          projectId,
          status: "completed",
          progress: 100,
          createdAt: "Latest Production Output",
          duration,
          resolution,
          fps,
          format: "mp4",
          outputUrl: renderedVideoUrl,
          videoUrl: renderedVideoUrl,
        },
      ]);
    } else {
      setRenderJobs([]);
    }
  }, [renders, renderedVideoUrl, projectId, duration, resolution, fps]);

  // Composition scenes adapter with robust fallback
  const compScenes: CompositionScene[] = scenes.length > 0
    ? scenes.map((s, idx) => ({
        id: s.id,
        name: `Scene ${idx + 1}`,
        file: s.file,
        start: s.start,
        duration: s.duration,
      }))
    : [
        {
          id: "scene_01",
          name: "Scene 1 (Main)",
          file: selectedFile || "index.html",
          start: 0,
          duration: duration || 40,
        },
      ];

  // Playback timer loop
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = Date.now();
      const tick = () => {
        const now = Date.now();
        const delta = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;

        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });

        animationFrameRef.current = requestAnimationFrame(tick);
      };

      animationFrameRef.current = requestAnimationFrame(tick);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, duration]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Global editor shortcuts (e.g., F for fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) return;

      if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (onToggleFullscreen) {
          e.preventDefault();
          onToggleFullscreen();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleFullscreen]);

  // Update selected element visual style live and persist to file buffer
  const handleUpdateStyle = useCallback((elementId: string, property: string, value: string) => {
    if (selectedElement) {
      setSelectedElement((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          styles: {
            ...prev.styles,
            [property]: value,
          },
        };
      });
    }

    // Broadcast postMessage directly to preview canvas iframe
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      iframe.contentWindow?.postMessage(
        {
          type: "HYPERLINK_UPDATE_STYLE",
          elementId,
          property,
          value,
        },
        "*"
      );
    });

    // Mirror style change into active file code buffer for persistent saves
    const currentCode = files[selectedFile];
    if (currentCode && selectedElement) {
      let updated = currentCode;
      const targetId = selectedElement.id;
      const targetTag = selectedElement.tag || "(?:[a-zA-Z0-9]+)";

      const cssPropMap: Record<string, string> = {
        fontFamily: "font-family",
        fontSize: "font-size",
        fontWeight: "font-weight",
        textAlign: "text-align",
        letterSpacing: "letter-spacing",
        lineHeight: "line-height",
        color: "color",
        background: "background",
        backgroundColor: "background-color",
        borderRadius: "border-radius",
        opacity: "opacity",
      };
      const cssProp = cssPropMap[property] || property;

      // Build list of all matching selectors for this element
      const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const idConditions: string[] = [];

      if (targetId) {
        idConditions.push(`id=["']${escapeRegex(targetId)}["']`);
        idConditions.push(`data-hf-id=["']${escapeRegex(targetId)}["']`);
        idConditions.push(`data-hf-layer-id=["']${escapeRegex(targetId)}["']`);
        idConditions.push(`class=["'][^"']*?\\b${escapeRegex(targetId)}\\b[^"']*?`);

        // If targetId is e.g. "layer-3-headline", extract class "headline"
        const parts = targetId.split("-");
        if (parts.length >= 3) {
          const suffix = parts.slice(2).join("-");
          if (suffix && !["container", "text", "heading"].includes(suffix)) {
            idConditions.push(`class=["'][^"']*?\\b${escapeRegex(suffix)}\\b[^"']*?`);
          }
        }
      }

      if (selectedElement.attributes?.["data-hf-id"]) {
        idConditions.push(`data-hf-id=["']${escapeRegex(selectedElement.attributes["data-hf-id"])}["']`);
      }

      if (selectedElement.classes && Array.isArray(selectedElement.classes)) {
        selectedElement.classes.forEach((c) => {
          if (c && !c.startsWith("layer-") && !["active", "clip"].includes(c)) {
            idConditions.push(`class=["'][^"']*?\\b${escapeRegex(c)}\\b[^"']*?`);
          }
        });
      }

      const tagRegex = new RegExp(
        `(<${targetTag}[^>]*?(?:${idConditions.join("|")})[^>]*?>)`,
        "i"
      );
      const match = updated.match(tagRegex);

      if (match && match[1]) {
        const fullTag = match[1];
        let newTag = fullTag;
        if (/style=["'][^"']*["']/i.test(newTag)) {
          newTag = newTag.replace(/style=(["'])([^"']*)\1/i, (_, quote, styleStr) => {
            const propRegex = new RegExp(`${cssProp}:\\s*[^;]+;?`, "i");
            let cleanStyles = styleStr;
            if (propRegex.test(cleanStyles)) {
              cleanStyles = cleanStyles.replace(propRegex, `${cssProp}: ${value};`);
            } else {
              cleanStyles = cleanStyles.trim();
              if (cleanStyles && !cleanStyles.endsWith(";")) cleanStyles += ";";
              cleanStyles += ` ${cssProp}: ${value};`;
            }
            return `style=${quote}${cleanStyles.trim()}${quote}`;
          });
        } else {
          newTag = newTag.replace(/>$/, ` style="${cssProp}: ${value};">`);
        }
        updated = updated.replace(fullTag, newTag);
      } else {
        // Fallback for global property replacement if element specific match not found
        if (cssProp === "font-family") {
          updated = updated.replace(/(font-family:\s*)([^;]+);/i, `$1${value};`);
        } else if (cssProp === "color") {
          updated = updated.replace(/(color:\s*)(#[a-fA-F0-9]{3,8}|rgba?\([^)]+\))/i, `$1${value}`);
        }
      }

      // If font family changed to Google Font, inject stylesheet link into head if missing
      if (cssProp === "font-family") {
        const cleanFont = value.replace(/['",]|sans-serif|serif|monospace/gi, "").trim();
        if (cleanFont && !updated.includes(cleanFont)) {
          const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(cleanFont).replace(/%20/g, "+")}:wght@300;400;500;600;700;800;900&display=swap`;
          const fontLink = `  <link rel="stylesheet" href="${fontUrl}">\n`;
          if (updated.includes("</head>")) {
            updated = updated.replace("</head>", `${fontLink}</head>`);
          }
        }
      }

      if (updated !== currentCode) {
        onCodeChange(updated);
      }
    }
  }, [selectedElement, files, selectedFile, onCodeChange]);

  // Update text content live and persist to file buffer
  const handleUpdateText = useCallback((elementId: string, text: string) => {
    if (selectedElement) {
      setSelectedElement((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          text,
        };
      });
    }

    // Broadcast postMessage to preview canvas iframe
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      iframe.contentWindow?.postMessage(
        {
          type: "HYPERLINK_UPDATE_TEXT",
          elementId,
          text,
        },
        "*"
      );
    });

    // Mirror text change into active file code buffer for persistent saves
    const currentCode = files[selectedFile];
    if (currentCode && selectedElement) {
      const targetId = selectedElement.id;
      const targetTag = selectedElement.tag || "(?:h[1-6]|p|span|div|a|button|label)";
      const escapeRegex = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

      const idConditions: string[] = [];
      if (targetId) {
        idConditions.push(`id=["']${escapeRegex(targetId)}["']`);
        idConditions.push(`data-hf-id=["']${escapeRegex(targetId)}["']`);
        idConditions.push(`data-hf-layer-id=["']${escapeRegex(targetId)}["']`);
        idConditions.push(`class=["'][^"']*?\\b${escapeRegex(targetId)}\\b[^"']*?`);

        const parts = targetId.split("-");
        if (parts.length >= 3) {
          const suffix = parts.slice(2).join("-");
          if (suffix && !["container", "text", "heading"].includes(suffix)) {
            idConditions.push(`class=["'][^"']*?\\b${escapeRegex(suffix)}\\b[^"']*?`);
          }
        }
      }

      if (selectedElement.attributes?.["data-hf-id"]) {
        idConditions.push(`data-hf-id=["']${escapeRegex(selectedElement.attributes["data-hf-id"])}["']`);
      }

      if (selectedElement.classes && Array.isArray(selectedElement.classes)) {
        selectedElement.classes.forEach((c) => {
          if (c && !c.startsWith("layer-") && !["active", "clip"].includes(c)) {
            idConditions.push(`class=["'][^"']*?\\b${escapeRegex(c)}\\b[^"']*?`);
          }
        });
      }

      // Match element containing target id, data-hf-id, or class name
      const specificRegex = new RegExp(
        `(<${targetTag}[^>]*?(?:${idConditions.join("|")})[^>]*?>)([\\s\\S]*?)(<\\/${targetTag}>)`,
        "i"
      );

      let updated = currentCode;
      if (specificRegex.test(updated)) {
        updated = updated.replace(specificRegex, `$1${text}$3`);
      } else if (selectedElement.tag) {
        const fallbackRegex = new RegExp(
          `(<${selectedElement.tag}[^>]*>)([\\s\\S]*?)(<\\/${selectedElement.tag}>)`,
          "i"
        );
        if (fallbackRegex.test(updated)) {
          updated = updated.replace(fallbackRegex, `$1${text}$3`);
        }
      }

      if (updated !== currentCode) {
        onCodeChange(updated);
      }
    }
  }, [selectedElement, files, selectedFile, onCodeChange]);

  // Toggle layer visibility or lock
  const handleToggleLayer = useCallback((layerId: string, action: "visibility" | "lock") => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === layerId) {
          const nextVal = action === "visibility" ? !l.visible : !l.locked;
          // Notify iframe
          const iframes = document.querySelectorAll("iframe");
          iframes.forEach((iframe) => {
            iframe.contentWindow?.postMessage(
              {
                type: "HYPERLINK_TOGGLE_LAYER",
                elementId: layerId,
                action,
                value: nextVal,
              },
              "*"
            );
          });
          return action === "visibility"
            ? { ...l, visible: nextVal }
            : { ...l, locked: nextVal };
        }
        return l;
      })
    );
  }, []);

  // Update CSS variable live
  const handleUpdateVariable = useCallback((key: string, value: string) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      iframe.contentWindow?.postMessage(
        {
          type: "HYPERLINK_UPDATE_VARIABLE",
          variable: key,
          value,
        },
        "*"
      );
    });
  }, []);

  // Select layer from hierarchy with real geometry
  const handleSelectLayer = useCallback((layerId: string) => {
    const found = layers.find((l) => l.id === layerId);
    if (found) {
      const realRect = found.rect || { top: 120, left: 160, width: 600, height: 80 };
      setSelectedElement({
        id: found.id,
        tag: found.tag,
        type: found.type,
        classes: [],
        text: found.text || found.name,
        rect: realRect,
        styles: (found.styles as any) || { color: "#ffffff", fontSize: "28px", fontWeight: "600" },
        attributes: {},
      });
    }

    // Broadcast message to iframe to query exact live frame coordinates
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      iframe.contentWindow?.postMessage(
        {
          type: "HYPERLINK_SELECT_LAYER",
          layerId,
        },
        "*"
      );
    });
  }, [layers]);

  // Adjust scene duration from timeline dragging
  const handleUpdateSceneDuration = useCallback((sceneId: string, deltaSeconds: number) => {
    setLocalUnsaved(true);
    if (!onUpdateScenes) return;
    onUpdateScenes((prev) => {
      let cumulativeStart = 0;
      return prev.map((s) => {
        let newDuration = s.duration;
        if (s.id === sceneId) {
          newDuration = Math.max(1, Math.round((s.duration + deltaSeconds) * 10) / 10);
        }
        const updatedScene = { ...s, start: cumulativeStart, duration: newDuration };
        cumulativeStart += newDuration;
        return updatedScene;
      });
    });
  }, [onUpdateScenes]);

  // Drop media asset from left panel or file picker directly into timeline or active canvas
  const handleDropAssetToTimeline = useCallback(
    (asset: AssetItem, targetTime?: number, trackType: "visual" | "audio" | "scene" = "visual") => {
      setLocalUnsaved(true);
      const activeFile = selectedFile || "index.html";
      const currentCode = files[activeFile] || files["index.html"] || "";

      const timeVal = typeof targetTime === "number" ? Math.max(0, Math.round(targetTime * 10) / 10) : Math.max(0, Math.round(currentTime * 10) / 10);
      const clipDuration = 8;

      if (trackType === "scene" && (asset.type === "image" || asset.type === "video")) {
        // If dropped onto scene lane, see if there is a scene-background image to replace
        if (currentCode.includes("scene-background")) {
          const updated = currentCode.replace(
            /(class=["'][^"']*scene-background[^"']*["'][^>]*src=["'])[^"']*["']/,
            `$1${asset.url}"`
          );
          onCodeChange(updated);
          toast.success(`Updated scene background to ${asset.name}!`);
          return;
        }
      }

      let snippet = "";
      if (asset.type === "audio" || trackType === "audio") {
        snippet = `\n    <!-- Timeline Audio Track: ${asset.name} -->\n    <audio class="clip audio-track" src="${asset.url}" data-start="${timeVal}" data-duration="15" preload="auto"></audio>`;
      } else if (asset.type === "video") {
        snippet = `\n    <!-- Timeline Video Track: ${asset.name} -->\n    <video class="clip video-track" src="${asset.url}" data-start="${timeVal}" data-duration="${clipDuration}" autoplay muted loop playsinline style="position: absolute; width: 640px; height: 360px; top: 15%; left: 15%; border-radius: 12px; z-index: 50;"></video>`;
      } else {
        snippet = `\n    <!-- Timeline Visual Track: ${asset.name} -->\n    <img class="clip scene-asset" src="${asset.url}" data-start="${timeVal}" data-duration="${clipDuration}" alt="${asset.name}" style="position: absolute; width: 500px; height: auto; top: 18%; left: 20%; border-radius: 12px; box-shadow: 0 16px 36px rgba(0,0,0,0.35); z-index: 50;" />`;
      }

      let updatedCode = currentCode;
      if (updatedCode.includes("</main>")) {
        updatedCode = updatedCode.replace("</main>", `${snippet}\n  </main>`);
      } else if (updatedCode.includes("</body>")) {
        updatedCode = updatedCode.replace("</body>", `${snippet}\n</body>`);
      } else {
        updatedCode = updatedCode + snippet;
      }

      onCodeChange(updatedCode);
      toast.success(`Added ${asset.name} to ${trackType} track at ${timeVal}s!`);
    },
    [selectedFile, files, currentTime, onCodeChange]
  );

  const handleSave = async () => {
    try {
      await onSaveProject();
      setLocalUnsaved(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save project");
    }
  };

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col w-full h-full bg-[#f8fafc] overflow-hidden select-none text-gray-900">
      {/* Top Native Editor Sub-Header Toolbar (HyperFrames Light Theme) */}
      <div className="h-10 px-4 bg-white border-b border-gray-200 flex items-center justify-between text-xs z-10 shrink-0 text-gray-800 shadow-xs">
        <div className="flex items-center gap-2.5">
          <img
            src="/ollastar-logo.png"
            alt="Ollastar"
            className="h-6 w-6 rounded-full border border-gray-200 object-contain shadow-xs shrink-0 bg-white"
          />
          <span className="font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
            {projectTitle}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-600 font-mono hidden sm:inline font-medium">
            {duration}s &bull; {resolution} &bull; {fps}fps
          </span>
        </div>

        {/* Center: Save Status Indicator */}
        <div className="flex items-center gap-2">
          {hasUnsavedChanges || localUnsaved ? (
            <span className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-semibold shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Unsaved Changes
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> All edits saved
            </span>
          )}
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium transition shadow-xs disabled:opacity-50"
            title="Save composition edits to backend disk"
          >
            {isSaving ? (
              <RefreshCw className="w-3 h-3 animate-spin text-purple-600" />
            ) : (
              <Save className="w-3 h-3 text-purple-600" />
            )}
            Save Changes
          </button>

          {renderedVideoUrl && (
            <button
              type="button"
              onClick={() => setPreviewingVideoUrl(renderedVideoUrl)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold transition shadow-xs"
              title="Watch latest rendered production video"
            >
              <Play className="w-3 h-3 fill-current" /> Watch Video
            </button>
          )}

          {renderedVideoUrl && (
            <a
              href={renderedVideoUrl}
              download={`${projectId}-final.mp4`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium transition shadow-xs hidden md:flex"
              title="Download rendered MP4 video"
            >
              <Download className="w-3 h-3 text-gray-500" /> Download MP4
            </a>
          )}

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-medium transition shadow-xs ${
                isFullscreen
                  ? "bg-purple-600 hover:bg-purple-700 border-purple-500 text-white shadow-purple-900/30"
                  : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
              }`}
              title={isFullscreen ? "Exit Full Screen (Esc / F)" : "Full Screen (F)"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-white" />
                  <span>Exit Full Screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>Full Screen</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 3-Column Studio Workspace Area */}
      <div className="flex-1 min-w-0 min-h-0 flex overflow-hidden relative">
        {/* Column 1: Left Project & Media Navigation */}
        <LeftProjectPanel
          scenes={compScenes}
          activeSceneId={activeSceneId}
          onSelectScene={(id) => {
            setActiveSceneId(id);
            const found = compScenes.find((s) => s.id === id);
            if (found) onSelectFile(found.file);
          }}
          onAddScene={() => toast.info("Creating new scene sequence...")}
          files={files}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          onCodeChange={(code) => {
            setLocalUnsaved(true);
            onCodeChange(code);
          }}
          onSaveCode={handleSave}
          isCollapsed={isLeftCollapsed}
          onToggleCollapse={() => setIsLeftCollapsed((prev) => !prev)}
          currentTime={currentTime}
          layers={layers}
          selectedElement={selectedElement}
          onClearSelectedElement={() => setSelectedElement(null)}
          projectId={projectId}
          onDropAssetToTimeline={handleDropAssetToTimeline}
        />

        {/* Column 2: Center Interactive Canvas */}
        <InteractiveCanvas
          previewSrc={previewSrc}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onTimeUpdate={(t) => setCurrentTime(t)}
          onPlayPauseToggle={handlePlayPause}
          selectedElement={selectedElement}
          onSelectElement={(el) => setSelectedElement(el)}
          onUpdateElementStyle={(id, prop, val) => {
            setLocalUnsaved(true);
            handleUpdateStyle(id, prop, val);
          }}
          onLayersLoaded={(loaded) => setLayers(loaded)}
          onDropAsset={handleDropAssetToTimeline}
        />

        {/* Column 3: Right Visual Property Inspector */}
        <RightPropertyPanel
          selectedElement={selectedElement}
          onUpdateStyle={(id, prop, val) => {
            setLocalUnsaved(true);
            handleUpdateStyle(id, prop, val);
          }}
          onUpdateText={(id, txt) => {
            setLocalUnsaved(true);
            handleUpdateText(id, txt);
          }}
          layers={layers}
          onToggleLayer={(id, act) => {
            setLocalUnsaved(true);
            handleToggleLayer(id, act);
          }}
          onSelectLayer={handleSelectLayer}
          variables={variables}
          onUpdateVariable={(k, v) => {
            setLocalUnsaved(true);
            handleUpdateVariable(k, v);
          }}
          renders={renderJobs}
          onTriggerRender={onSyncAndRender}
          isRendering={isRendering}
          onSelectPreviewVideo={(url) => setPreviewingVideoUrl(url)}
          isCollapsed={isRightCollapsed}
          onToggleCollapse={() => setIsRightCollapsed((prev) => !prev)}
        />
      </div>

      {/* Bottom Area: Multitrack Timeline */}
      <MultitrackTimeline
        projectId={projectId}
        projectTitle={projectTitle}
        duration={duration}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onTimeChange={(t) => setCurrentTime(t)}
        onPlayPauseToggle={handlePlayPause}
        scenes={compScenes}
        activeSceneId={activeSceneId}
        onSelectScene={(id) => {
          setActiveSceneId(id);
          const found = compScenes.find((s) => s.id === id);
          if (found) onSelectFile(found.file);
        }}
        onUpdateSceneDuration={handleUpdateSceneDuration}
        onUpdateScenes={(timelineUpdater) => {
          setLocalUnsaved(true);
          if (onUpdateScenes) {
            onUpdateScenes((prev) => {
              const compPrev: CompositionScene[] = prev.map((s, idx) => ({
                id: s.id,
                name: `Scene ${idx + 1}`,
                file: s.file,
                start: s.start,
                duration: s.duration,
              }));
              const updatedComp = timelineUpdater(compPrev);
              return updatedComp.map((s) => ({
                id: s.id,
                file: s.file,
                start: s.start,
                duration: s.duration,
              }));
            });
          }
        }}
        selectedElementId={selectedElement?.id}
        onSelectElementId={(id) => {
          if (!id) {
            setSelectedElement(null);
          } else {
            handleSelectLayer(id);
          }
        }}
        onOpenPropertiesTab={() => {
          setIsRightCollapsed(false);
        }}
        onDropAsset={handleDropAssetToTimeline}
      />

      {/* Video Preview Modal */}
      {previewingVideoUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e1424] border border-white/20 rounded-xl shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">
                  Production Video Preview &bull; {projectTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingVideoUrl(null)}
                className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player */}
            <div className="p-4 bg-black flex items-center justify-center">
              <video
                src={previewingVideoUrl}
                controls
                autoPlay
                muted
                playsInline
                preload="metadata"
                className="w-full max-h-[60vh] rounded bg-black shadow-lg"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-[#0a0f1d] border-t border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-white/60 font-mono">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready for distribution
                </span>
                <span>&bull;</span>
                <span>{resolution}</span>
                <span>&bull;</span>
                <span>{fps}fps</span>
                <span>&bull;</span>
                <span>{duration}s</span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewingVideoUrl}
                  download={`${projectId}-final.mp4`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium flex items-center gap-1.5 transition shadow"
                >
                  <Download className="w-3.5 h-3.5" /> Download Video File
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewingVideoUrl(null)}
                  className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-medium transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

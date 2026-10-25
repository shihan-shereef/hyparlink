"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { LeftProjectPanel } from "./left-project-panel";
import { InteractiveCanvas } from "./interactive-canvas";
import { RightPropertyPanel } from "./right-property-panel";
import { FreeCutTimeline } from "./freecut-timeline";
import { SelectedElement, CompositionScene, RenderJob, CompositionLayer, ExportSettings, AssetItem, TimelineClip } from "./types";
import { toast } from "sonner";
import Link from "next/link";
import { 
  ArrowLeft,
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
  onUpdateDuration?: (newDuration: number) => void;
  fps: number;
  resolution?: string;
  scenes: (CompositionScene | { id: string; file: string; start: number; duration: number; [key: string]: any })[];
  onUpdateScenes?: (updater: (prev: any[]) => any[]) => void;
  files: Record<string, string>;
  selectedFile: string;
  onSelectFile: (file: string) => void;
  onCodeChange: (code: string, targetFile?: string) => void;
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
  hideHeader?: boolean;
  editorMode?: "native" | "studio";
  onEditorModeChange?: (mode: "native" | "studio") => void;
  studioPort?: number;
}

export const NativeHyperlinkEditor: React.FC<NativeHyperlinkEditorProps> = ({
  projectId,
  projectTitle,
  duration,
  onUpdateDuration,
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
  hideHeader = false,
  editorMode = "native",
  onEditorModeChange,
  studioPort,
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
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
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
          resolution: resolution || "1080p",
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

  const [propertyPanelTab, setPropertyPanelTab] = useState<"design" | "layers" | "renders" | "variables">("design");
  const handleOpenPropertiesTab = useCallback((tab: "design" | "layers" | "renders" | "variables") => {
    setPropertyPanelTab(tab);
  }, []);

  const [visualClips, setVisualClips] = useState<TimelineClip[]>([]);

  // Composition scenes adapter with robust media offset preservation
  const compScenes: CompositionScene[] = (scenes || []).map((s: any, idx) => ({
    ...s,
    name: s.name || `Scene ${idx + 1}`,
    mediaOffset: s.mediaOffset !== undefined ? s.mediaOffset : (idx === 0 ? 0 : s.start),
  }));

  // Synthesize complete composition layer hierarchy (Scenes, Headlines, Subtitles, Visual Overlays, Audio)
  useEffect(() => {
    const generatedLayers: CompositionLayer[] = [];
    compScenes.forEach((s, idx) => {
      generatedLayers.push({
        id: `layer-scene-${s.id}`,
        name: `${s.name || `Scene ${idx + 1}`} (${s.duration.toFixed(1)}s)`,
        tag: "div",
        type: "container",
        visible: true,
        locked: false,
      });

      let parsedHead = "";
      let parsedSub = "";
      const fileContent = (s.file && files[s.file]) || files["index.html"] || "";
      if (fileContent) {
        const h1Match = fileContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (h1Match && h1Match[1]) parsedHead = h1Match[1].replace(/<[^>]+>/g, "").trim();
        const pMatch = fileContent.match(/<p\b[^>]*class=["'][^"']*sub[^"']*["'][^>]*>([\s\S]*?)<\/p>/i) ||
          fileContent.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i) ||
          fileContent.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
        if (pMatch && pMatch[1]) parsedSub = pMatch[1].replace(/<[^>]+>/g, "").trim();
      }

      const headText = s.headline || parsedHead || "";
      if (headText) {
        generatedLayers.push({
          id: `layer-text-head-${s.id}`,
          name: `Headline: ${headText.length > 30 ? headText.slice(0, 30) + "..." : headText}`,
          tag: "h1",
          type: "heading",
          visible: true,
          locked: false,
          text: headText,
          rect: { top: 180, left: 60, width: 600, height: 60 },
          styles: {
            color: "#FFFFFF",
            fontFamily: "'Playfair Display', serif",
            fontSize: "38px",
            fontWeight: "800",
            textAlign: "left",
          },
        });
      }

      const subText = s.subtitle || parsedSub || "";
      if (subText) {
        generatedLayers.push({
          id: `layer-text-sub-${s.id}`,
          name: `Subtitle: ${subText.length > 30 ? subText.slice(0, 30) + "..." : subText}`,
          tag: "p",
          type: "text",
          visible: true,
          locked: false,
          text: subText,
          rect: { top: 250, left: 60, width: 500, height: 40 },
          styles: {
            color: "rgba(255, 255, 255, 0.85)",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px",
            fontWeight: "400",
            textAlign: "left",
          },
        });
      }
    });

    visualClips.forEach((c) => {
      if (c.sourceUrl || (c as any).assetUrl) {
        generatedLayers.push({
          id: c.id,
          name: `${c.name} (${(c.type || "media").toUpperCase()})`,
          tag: c.type === "video" ? "video" : "img",
          type: c.type === "video" ? "video" : "image",
          visible: true,
          locked: false,
          rect: { top: 120, left: 180, width: 480, height: 270 },
          styles: { opacity: "1", borderRadius: "12px" },
        });
      }
    });

    generatedLayers.push({
      id: "layer-audio-main",
      name: "Video Composition (Stereo Audio Bed)",
      tag: "audio",
      type: "audio" as any,
      visible: true,
      locked: false,
    });

    setLayers(generatedLayers);
  }, [compScenes, visualClips]);

  // Playback timer loop across all composition content with strict NLE scene sync & cut gap handling
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = Date.now();
      const tick = () => {
        const now = Date.now();
        const delta = ((now - lastTimeRef.current) / 1000) * playbackSpeed;
        lastTimeRef.current = now;

        const maxSceneEnd = compScenes.length > 0
          ? compScenes.reduce((m, s) => Math.max(m, s.start + s.duration), 0)
          : 0;
        const maxClipEnd = visualClips.length > 0
          ? visualClips.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
          : 0;
        const maxContentEnd = Math.max(maxSceneEnd, maxClipEnd);

        if (maxContentEnd <= 0) {
          setIsPlaying(false);
          setCurrentTime(0);
          return;
        }

        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= maxContentEnd) {
            setIsPlaying(false);
            return 0;
          }

          // If next is in a cut gap between scenes, immediately jump over the gap to the next scene's start
          if (compScenes.length > 0) {
            const inScene = compScenes.some((s) => next >= s.start && next < (s.start + s.duration));
            if (!inScene) {
              const upcoming = compScenes.filter((s) => s.start > next).sort((a, b) => a.start - b.start);
              if (upcoming.length > 0 && upcoming[0]) {
                return upcoming[0].start;
              } else {
                setIsPlaying(false);
                return 0;
              }
            }
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
  }, [isPlaying, playbackSpeed, compScenes, visualClips]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Add new scene sequence to composition
  const handleAddScene = useCallback(() => {
    if (!onUpdateScenes) return;
    setLocalUnsaved(true);
    let targetFileName = "index.html";
    let newSceneId = "";
    onUpdateScenes((prev) => {
      let totalStart = 0;
      prev.forEach((s) => {
        totalStart = Math.max(totalStart, s.start + s.duration);
      });
      const newSceneNum = prev.length + 1;
      newSceneId = `scene_${String(newSceneNum).padStart(2, "0")}`;
      const usesCompositionsFolder = Object.keys(files).some((f) => f.startsWith("compositions/"));
      targetFileName = usesCompositionsFolder
        ? `compositions/scene_${String(newSceneNum).padStart(2, "0")}.html`
        : "index.html";

      const newScene = {
        id: newSceneId,
        name: `Scene ${newSceneNum}`,
        file: targetFileName,
        start: totalStart,
        duration: 5,
        mediaOffset: totalStart,
      };

      if (!files[targetFileName] && targetFileName !== "index.html") {
        const starterTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw;
      height: 100vh;
      background: #071426;
      color: #ffffff;
      font-family: 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      text-align: center;
      padding: 40px;
    }
    h1 {
      font-size: 52px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 16px;
      color: #ffffff;
    }
    p {
      font-size: 22px;
      color: rgba(255, 255, 255, 0.75);
      max-width: 600px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div id="scene-${newSceneNum}">
    <h1 class="headline">Scene ${newSceneNum}</h1>
    <p class="sub">Add your title, visuals, and animations</p>
  </div>
</body>
</html>`;
        onCodeChange(starterTemplate, targetFileName);
      }

      toast.success(`Added Scene ${newSceneNum} (5s) at ${totalStart}s`);
      return [...prev, newScene];
    });

    if (newSceneId) {
      setActiveSceneId(newSceneId);
      if (targetFileName) onSelectFile(targetFileName);
    }
  }, [onUpdateScenes, files, onCodeChange, onSelectFile]);

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

    if (elementId.startsWith("layer-text-head-") || elementId.startsWith("layer-text-sub-")) {
      const sId = elementId.replace(/layer-text-(?:head|sub)-/, "");
      if (onUpdateScenes) {
        onUpdateScenes((prev) => prev.map((s) => s.id === sId ? { ...s, fontFamily: value } : s));
      }
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

    if (elementId.startsWith("layer-text-head-")) {
      const sId = elementId.replace("layer-text-head-", "");
      if (onUpdateScenes) {
        onUpdateScenes((prev) => prev.map((s) => s.id === sId ? { ...s, headline: text } : s));
      }
    } else if (elementId.startsWith("layer-text-sub-")) {
      const sId = elementId.replace("layer-text-sub-", "");
      if (onUpdateScenes) {
        onUpdateScenes((prev) => prev.map((s) => s.id === sId ? { ...s, subtitle: text } : s));
      }
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
      let matched = false;

      if (specificRegex.test(updated)) {
        updated = updated.replace(specificRegex, `$1${text}$3`);
        matched = true;
      } else if (selectedElement.tag) {
        const fallbackRegex = new RegExp(
          `(<${selectedElement.tag}[^>]*>)([\\s\\S]*?)(<\\/${selectedElement.tag}>)`,
          "i"
        );
        if (fallbackRegex.test(updated)) {
          updated = updated.replace(fallbackRegex, `$1${text}$3`);
          matched = true;
        }
      }

      // If no tag match was made, or for JavaScript data literals (e.g. title: 'Buckingham Palace')
      const oldText = (selectedElement.text || "").trim();
      if (!matched && oldText && oldText !== text.trim()) {
        if (updated.includes(oldText)) {
          updated = updated.split(oldText).join(text);
          matched = true;
        } else {
          // Check other files, e.g. index.html if selectedFile is something else
          Object.keys(files).forEach((fName) => {
            if (fName !== selectedFile && files[fName]?.includes(oldText)) {
              const fileUpdated = files[fName].split(oldText).join(text);
              onCodeChange(fileUpdated, fName);
            }
          });
        }
      }

      if (updated !== currentCode) {
        onCodeChange(updated, selectedFile);
      }
    }
  }, [selectedElement, files, selectedFile, onCodeChange, onUpdateScenes]);

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

  // Adjust clip/scene speed multiplier (e.g. 1.5x, 2x, 0.5x)
  const handleSetSceneSpeed = useCallback((sceneId: string, speedMultiplier: number) => {
    setLocalUnsaved(true);
    if (!onUpdateScenes) return;
    onUpdateScenes((prev) => {
      let cumulativeStart = 0;
      return prev.map((s) => {
        let newDuration = s.duration;
        if (s.id === sceneId) {
          const baseDuration = (s as any).originalDuration || s.duration;
          newDuration = Math.max(0.5, Math.round((baseDuration / speedMultiplier) * 100) / 100);
          return {
            ...s,
            speed: speedMultiplier,
            originalDuration: baseDuration,
            start: cumulativeStart,
            duration: newDuration,
          };
        }
        const updated = { ...s, start: cumulativeStart };
        cumulativeStart += updated.duration;
        return updated;
      });
    });
    toast.success(`Set scene speed to ${speedMultiplier}x`);
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

      const newVisualClip: TimelineClip = {
        id: `clip-vis-${Date.now().toString(36)}`,
        trackId: trackType === "audio" ? "track-audio" : "track-visuals",
        trackType: trackType === "audio" ? "audio" : "visual",
        name: asset.name,
        start: timeVal,
        duration: clipDuration,
        color: asset.type === "video" ? "purple" : "blue",
        type: asset.type,
        sourceUrl: asset.url,
      };
      (newVisualClip as any).assetUrl = asset.url;
      setVisualClips((prev) => [...prev, newVisualClip]);

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
      {!hideHeader && (
        <div className="h-10 px-4 bg-white border-b border-gray-200 flex items-center justify-between text-xs z-10 shrink-0 text-gray-800 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Link
              href="/projects"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium mr-0.5"
              title="Back to Projects"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Projects</span>
            </Link>
            <div className="h-3.5 w-px bg-gray-200" />
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

          {/* Center: Editor Mode Switch & Save Status Indicator */}
          <div className="flex items-center gap-3">
            {onEditorModeChange && (
              <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => onEditorModeChange("native")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                    editorMode === "native"
                      ? "bg-white text-gray-900 shadow-xs"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Native Editor
                </button>
                <button
                  type="button"
                  onClick={() => onEditorModeChange("studio")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                    editorMode === "studio"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <span>HyperFrames Studio</span>
                  {studioPort && (
                    <span className="text-[10px] bg-purple-700 text-white px-1 py-0.2 rounded font-mono">
                      {studioPort}
                    </span>
                  )}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200/80 text-purple-900 text-xs font-bold shadow-2xs">
              <Film className="w-3.5 h-3.5 text-purple-600" />
              <span>Composition View</span>
            </div>

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
      )}

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
              onAddScene={handleAddScene}
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
              renderedVideoUrl={previewingVideoUrl || renderedVideoUrl}
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
              scenes={compScenes}
              visualClips={visualClips}
              projectTitle={projectTitle}
              onOpenPropertiesTab={handleOpenPropertiesTab}
              playbackSpeed={playbackSpeed}
              onSpeedChange={(spd) => setPlaybackSpeed(spd)}
            />

            {/* Column 3: Right Visual Property Inspector */}
            <RightPropertyPanel
              activeTab={propertyPanelTab}
              onTabChange={setPropertyPanelTab}
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
              playbackSpeed={playbackSpeed}
              onSpeedChange={(spd) => setPlaybackSpeed(spd)}
              activeScene={compScenes.find((s) => s.id === activeSceneId) || compScenes[0]}
              onSetSceneSpeed={handleSetSceneSpeed}
            />
          </div>

          {/* Bottom Area: FreeCut Professional Multitrack Timeline */}
          <FreeCutTimeline
            projectId={projectId}
            projectTitle={projectTitle}
            duration={duration}
            onUpdateDuration={onUpdateDuration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            onSpeedChange={(spd) => setPlaybackSpeed(spd)}
            onTimeChange={(t) => setCurrentTime(t)}
            onPlayPauseToggle={handlePlayPause}
            scenes={compScenes}
            activeSceneId={activeSceneId}
            onSelectScene={(id) => {
              setActiveSceneId(id);
              const found = compScenes.find((s) => s.id === id);
              if (found) onSelectFile(found.file);
            }}
            onAddScene={handleAddScene}
            onUpdateSceneDuration={handleUpdateSceneDuration}
            onSetSceneSpeed={handleSetSceneSpeed}
            onUpdateScenes={(timelineUpdater) => {
              setLocalUnsaved(true);
              if (onUpdateScenes) {
                onUpdateScenes((prev) => {
                  const compPrev: CompositionScene[] = prev.map((s, idx) => ({
                    ...s,
                    name: s.name || `Scene ${idx + 1}`,
                    mediaOffset: s.mediaOffset !== undefined ? s.mediaOffset : (idx === 0 ? 0 : s.start),
                  }));
                  return timelineUpdater(compPrev);
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

"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Scissors, 
  Pointer, 
  MousePointer, 
  ChevronsLeft, 
  ChevronsRight, 
  Link as LinkIcon, 
  Unlink, 
  Magnet, 
  Diamond, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  Volume2, 
  VolumeX, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Trash2, 
  Copy, 
  Edit3, 
  Sparkles, 
  Layers, 
  Film, 
  Plus,
  Merge
} from "lucide-react";
import { 
  CompositionScene, 
  TimelineTrack, 
  TimelineClip, 
  TimelineTool, 
  TimelineKeyframe, 
  TimelineHistoryEntry,
  AssetItem
} from "./types";
import { 
  timeToPixel, 
  pixelToTime, 
  formatTimecode, 
  formatClockTime, 
  splitClip, 
  splitScene, 
  moveClipWithSnapping, 
  resizeClipWithSnapping, 
  moveLinkedClips, 
  selectClipsDirectional, 
  findNearestKeyframe 
} from "./timeline-utils";
import { toast } from "sonner";

interface MultitrackTimelineProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeChange: (time: number) => void;
  onPlayPauseToggle: () => void;
  scenes: CompositionScene[];
  activeSceneId: string;
  onSelectScene: (sceneId: string) => void;
  onUpdateSceneDuration?: (sceneId: string, deltaSeconds: number) => void;
  onUpdateScenes?: (updater: (prev: CompositionScene[]) => CompositionScene[]) => void;
  onReorderScenes?: (fromIndex: number, toIndex: number) => void;
  onAddScene?: () => void;
  onSplitAtPlayhead?: () => void;
  selectedElementId?: string;
  onSelectElementId?: (id: string | null) => void;
  onOpenPropertiesTab?: (tab: "visual" | "layers" | "renders" | "vars") => void;
  projectTitle?: string;
  projectId?: string;
  onDropAsset?: (asset: AssetItem, targetTime: number, trackType: "visual" | "audio" | "scene") => void;
}

export const MultitrackTimeline: React.FC<MultitrackTimelineProps> = ({
  duration,
  currentTime,
  isPlaying,
  onTimeChange,
  onPlayPauseToggle,
  scenes,
  activeSceneId,
  onSelectScene,
  onUpdateSceneDuration,
  onUpdateScenes,
  onReorderScenes,
  onAddScene,
  onSplitAtPlayhead,
  selectedElementId,
  onSelectElementId,
  onOpenPropertiesTab,
  projectTitle,
  projectId,
  onDropAsset,
}) => {
  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Tools and Modes
  const [activeTool, setActiveTool] = useState<TimelineTool>("select");
  const [isToolDropdownOpen, setIsToolDropdownOpen] = useState<boolean>(false);
  const [isSnappingEnabled, setIsSnappingEnabled] = useState<boolean>(true);
  const [zoomScale, setZoomScale] = useState<number>(32); // pixels per second (10 - 100)

  // Selection
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([activeSceneId]);

  // Scrubbing & Dragging States
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragInitialClipStart, setDragInitialClipStart] = useState<number>(0);

  // Trimming Edge Handle States
  const [trimmingClipId, setTrimmingClipId] = useState<string | null>(null);
  const [trimEdge, setTrimEdge] = useState<"left" | "right">("right");
  const [trimStartX, setTrimStartX] = useState<number>(0);
  const [trimInitialStart, setTrimInitialStart] = useState<number>(0);
  const [trimInitialDuration, setTrimInitialDuration] = useState<number>(0);

  // Snapping visual guide line (X position in pixels)
  const [activeSnapGuide, setActiveSnapGuide] = useState<number | null>(null);

  // Track settings (Mute, Lock, Visibility)
  const [trackVisibility, setTrackVisibility] = useState<Record<string, boolean>>({
    scenes: true,
    visuals: true,
    audio: true,
    keyframes: true,
  });
  const [trackLocks, setTrackLocks] = useState<Record<string, boolean>>({
    scenes: false,
    visuals: false,
    audio: false,
    keyframes: false,
  });
  const [trackMuted, setTrackMuted] = useState<Record<string, boolean>>({
    audio: false,
  });

  // Drag and drop asset state from LeftProjectPanel onto timeline lanes
  const [dropHoverState, setDropHoverState] = useState<{
    lane: "scene" | "visual" | "audio";
    x: number;
    time: number;
  } | null>(null);

  const handleLaneDragOver = (e: React.DragEvent, lane: "scene" | "visual" | "audio") => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    const time = pixelToTime(x, zoomScale);
    setDropHoverState({ lane, x, time });
  };

  const handleLaneDragLeave = () => {
    setDropHoverState(null);
  };

  const handleLaneDrop = (e: React.DragEvent, lane: "scene" | "visual" | "audio") => {
    e.preventDefault();
    setDropHoverState(null);

    try {
      const dataStr = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      let asset: AssetItem;
      if (dataStr.startsWith("{")) {
        asset = JSON.parse(dataStr);
      } else {
        asset = {
          id: `drop-${Date.now()}`,
          name: dataStr.split("/").pop() || "Media Asset",
          type: dataStr.endsWith(".mp3") || dataStr.endsWith(".wav") ? "audio" : dataStr.endsWith(".mp4") ? "video" : "image",
          url: dataStr,
        };
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, e.clientX - rect.left);
      const targetTime = pixelToTime(x, zoomScale);

      if (onDropAsset) {
        onDropAsset(asset, targetTime, lane);
      }
    } catch (err) {
      console.error("[Timeline] drop error:", err);
    }
  };

  // Dynamic Project Track Generators
  const generateVisualClips = useCallback((currScenes: CompositionScene[], title: string, dur: number) => {
    if (!currScenes || currScenes.length === 0) {
      return [
        {
          id: "clip-vis-hero",
          trackId: "track-visuals",
          trackType: "visual" as const,
          name: `${title || "Project"} Titles & Overlay`,
          start: 0,
          duration: Math.max(4, Math.round(dur * 0.4 * 10) / 10),
          color: "blue",
          elementId: "heading",
        },
      ];
    }
    return currScenes.map((s, idx) => ({
      id: `clip-vis-${s.id || idx}`,
      trackId: "track-visuals",
      trackType: "visual" as const,
      name: `${s.name || `Scene ${idx + 1}`} Typography & Graphics`,
      start: s.start,
      duration: s.duration,
      color: idx % 2 === 0 ? "blue" : "indigo",
      elementId: s.id,
    }));
  }, []);

  const generateAudioClips = useCallback((title: string, dur: number) => {
    const cleanTitle = title && title.trim() ? title.trim() : "Master Soundtrack";
    return [
      {
        id: "clip-audio-master",
        trackId: "track-audio",
        trackType: "audio" as const,
        name: `${cleanTitle} (Stereo Audio Bed)`,
        start: 0,
        duration: dur,
        color: "emerald",
        muted: false,
      },
    ];
  }, []);

  const generateKeyframes = useCallback((currScenes: CompositionScene[], dur: number) => {
    const markers: TimelineKeyframe[] = [
      { id: "kf-intro", time: 0.2, property: "opacity", value: 1, ease: "power3.out" },
    ];
    if (currScenes && currScenes.length > 0) {
      currScenes.forEach((s, idx) => {
        if (s.start > 0 && s.start < dur) {
          markers.push({
            id: `kf-cut-${idx}`,
            time: Math.round(s.start * 100) / 100,
            property: "sceneTransition",
            value: 1,
            ease: "power2.inOut",
          });
        }
      });
    }
    if (dur > 2) {
      markers.push({
        id: "kf-outro",
        time: Math.round((dur - 0.5) * 100) / 100,
        property: "opacity",
        value: 0,
        ease: "power2.in",
      });
    }
    return markers;
  }, []);

  // Local Visual & Audio Elements Tracks
  const [visualClips, setVisualClips] = useState<TimelineClip[]>(() =>
    generateVisualClips(scenes, projectTitle || "", duration)
  );

  const [audioClips, setAudioClips] = useState<TimelineClip[]>(() =>
    generateAudioClips(projectTitle || "", duration)
  );

  // Keyframes Track Data
  const [keyframes, setKeyframes] = useState<TimelineKeyframe[]>(() =>
    generateKeyframes(scenes, duration)
  );

  // Dynamic synchronization when project, scenes, or duration change
  useEffect(() => {
    setVisualClips(generateVisualClips(scenes, projectTitle || "", duration));
    setAudioClips(generateAudioClips(projectTitle || "", duration));
    setKeyframes(generateKeyframes(scenes, duration));
  }, [projectId, scenes, duration, projectTitle, generateVisualClips, generateAudioClips, generateKeyframes]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    clipId: string;
    trackType: "scene" | "visual" | "audio" | "keyframe";
  } | null>(null);

  // Undo / Redo History Stack
  const [historyStack, setHistoryStack] = useState<TimelineHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Helper to compile all clips currently on the timeline
  const allCurrentClips: TimelineClip[] = useMemo(() => {
    const sceneClips: TimelineClip[] = scenes.map((s) => ({
      id: s.id,
      trackId: "track-scenes",
      trackType: "scene",
      name: s.name || `Scene ${s.id}`,
      start: s.start,
      duration: s.duration,
      color: "purple",
    }));
    return [...sceneClips, ...visualClips, ...audioClips];
  }, [scenes, visualClips, audioClips]);

  // Synchronize initial snapshot for undo/redo
  useEffect(() => {
    if (historyStack.length === 0 && scenes.length > 0) {
      const initialEntry: TimelineHistoryEntry = {
        description: "Initial timeline state",
        timestamp: Date.now(),
        scenes: JSON.parse(JSON.stringify(scenes)),
        clips: JSON.parse(JSON.stringify([...visualClips, ...audioClips])),
        duration,
      };
      setHistoryStack([initialEntry]);
      setHistoryIndex(0);
    }
  }, [scenes, visualClips, audioClips, duration, historyStack.length]);

  // Record an action in the undo/redo history
  const pushHistory = useCallback(
    (description: string, nextScenes?: CompositionScene[], nextClips?: TimelineClip[]) => {
      const entry: TimelineHistoryEntry = {
        description,
        timestamp: Date.now(),
        scenes: JSON.parse(JSON.stringify(nextScenes || scenes)),
        clips: JSON.parse(JSON.stringify(nextClips || [...visualClips, ...audioClips])),
        duration,
      };

      setHistoryStack((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, entry];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [scenes, visualClips, audioClips, duration, historyIndex]
  );

  // Undo Action
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const target = historyStack[historyIndex - 1];
      if (target) {
        if (onUpdateScenes) {
          onUpdateScenes(() => JSON.parse(JSON.stringify(target.scenes)));
        }
        const visuals = target.clips.filter((c) => c.trackType === "visual");
        const audios = target.clips.filter((c) => c.trackType === "audio");
        setVisualClips(visuals);
        setAudioClips(audios);
        setHistoryIndex(historyIndex - 1);
        toast.info(`Undo: ${target.description}`);
      }
    }
  }, [historyIndex, historyStack, onUpdateScenes]);

  // Redo Action
  const handleRedo = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const target = historyStack[historyIndex + 1];
      if (target) {
        if (onUpdateScenes) {
          onUpdateScenes(() => JSON.parse(JSON.stringify(target.scenes)));
        }
        const visuals = target.clips.filter((c) => c.trackType === "visual");
        const audios = target.clips.filter((c) => c.trackType === "audio");
        setVisualClips(visuals);
        setAudioClips(audios);
        setHistoryIndex(historyIndex + 1);
        toast.info(`Redo: ${target.description}`);
      }
    }
  }, [historyIndex, historyStack, onUpdateScenes]);

  // Total Timeline Pixel Width
  const totalTimelineWidth = Math.max(1200, Math.round(duration * zoomScale) + 300);

  // Time Scrubbing via Ruler
  const handleTimelineScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(duration, pixelToTime(clickX, zoomScale)));
    onTimeChange(Math.round(newTime * 100) / 100);
  };

  // 1. Tool: Split Clip / Scene at Playhead
  const executeSplit = useCallback(
    (targetClipId?: string, atTime?: number) => {
      const splitPosition = atTime !== undefined ? atTime : currentTime;
      let targetId = targetClipId || selectedClipIds[0] || activeSceneId;

      // If specified target is not under playhead, prioritize the clip directly under the playhead
      const underPlayhead = allCurrentClips.find(
        (c) => splitPosition > c.start + 0.15 && splitPosition < c.start + c.duration - 0.15
      );
      if (!targetClipId && underPlayhead) {
        targetId = underPlayhead.id;
      }

      // Check if target is a scene
      const sceneIndex = scenes.findIndex((s) => s.id === targetId);
      if (sceneIndex !== -1) {
        const targetScene = scenes[sceneIndex];
        if (!targetScene) return;
        const splitResult = splitScene(targetScene, splitPosition);
        if (!splitResult) {
          toast.info("Cannot split scene: playhead must be at least 0.15s inside clip");
          return;
        }

        const [leftScene, rightScene] = splitResult;
        if (onUpdateScenes) {
          onUpdateScenes((prev) => {
            const next = [...prev];
            next.splice(sceneIndex, 1, leftScene, rightScene);
            pushHistory(`Split scene ${targetScene.name || targetScene.id}`, next);
            return next;
          });
          setSelectedClipIds([rightScene.id]);
          onSelectScene(rightScene.id);
          toast.success(`Split scene at ${formatClockTime(splitPosition)}s`);
        }
        return;
      }

      // Check if target is a visual clip
      const visIndex = visualClips.findIndex((c) => c.id === targetId);
      if (visIndex !== -1) {
        const targetVis = visualClips[visIndex];
        if (!targetVis) return;
        const splitResult = splitClip(targetVis, splitPosition);
        if (!splitResult) {
          toast.warning("Cannot split visual clip: position is too close to edge (min 0.5s required)");
          return;
        }

        const [leftClip, rightClip] = splitResult;
        const nextVisuals = [...visualClips];
        nextVisuals.splice(visIndex, 1, leftClip, rightClip);
        setVisualClips(nextVisuals);
        pushHistory(`Split visual clip ${targetVis.name}`, undefined, [...nextVisuals, ...audioClips]);
        setSelectedClipIds([rightClip.id]);
        toast.success(`Split visual clip at ${formatClockTime(splitPosition)}s`);
        return;
      }

      // Check if target is an audio clip
      const audioIndex = audioClips.findIndex((c) => c.id === targetId);
      if (audioIndex !== -1) {
        const targetAudio = audioClips[audioIndex];
        if (!targetAudio) return;
        const splitResult = splitClip(targetAudio, splitPosition);
        if (!splitResult) {
          toast.warning("Cannot split audio clip: position is too close to edge (min 0.5s required)");
          return;
        }

        const [leftClip, rightClip] = splitResult;
        const nextAudio = [...audioClips];
        nextAudio.splice(audioIndex, 1, leftClip, rightClip);
        setAudioClips(nextAudio);
        pushHistory(`Split audio clip ${targetAudio.name}`, undefined, [...visualClips, ...nextAudio]);
        setSelectedClipIds([rightClip.id]);
        toast.success(`Split audio clip at ${formatClockTime(splitPosition)}s`);
        return;
      }

      toast.info("Position playhead over a clip or click a clip with the Split Tool");
    },
    [currentTime, selectedClipIds, activeSceneId, allCurrentClips, scenes, visualClips, audioClips, onUpdateScenes, onSelectScene, pushHistory]
  );

  // 1b. Tool: Join / Merge Selected or Adjacent Clips
  const executeJoin = useCallback(() => {
    // Case 1: Multiple clips selected
    if (selectedClipIds.length >= 2) {
      // Check scenes
      const selectedScenes = scenes.filter((s) => selectedClipIds.includes(s.id));
      if (selectedScenes.length >= 2) {
        const sorted = [...selectedScenes].sort((a, b) => a.start - b.start);
        const primary = sorted[0];
        const last = sorted[sorted.length - 1];
        if (primary && last) {
          const newDuration = Math.round(((last.start + last.duration) - primary.start) * 100) / 100;
          const mergedScene: CompositionScene = {
            ...primary,
            duration: newDuration,
            name: `${primary.name || "Scene"} (Joined)`,
          };

          if (onUpdateScenes) {
            onUpdateScenes((prev) => {
              const next = prev.filter((s) => !sorted.some((sel) => sel.id === s.id));
              const insertIndex = prev.findIndex((s) => s.id === primary.id);
              next.splice(insertIndex === -1 ? 0 : insertIndex, 0, mergedScene);
              pushHistory(`Joined ${sorted.length} scenes`, next);
              return next;
            });
            setSelectedClipIds([mergedScene.id]);
            onSelectScene(mergedScene.id);
            toast.success(`Joined ${sorted.length} scenes (${newDuration}s)`);
            return;
          }
        }
      }

      // Check visual clips
      const selectedVis = visualClips.filter((c) => selectedClipIds.includes(c.id));
      if (selectedVis.length >= 2) {
        const sorted = [...selectedVis].sort((a, b) => a.start - b.start);
        const primary = sorted[0];
        const last = sorted[sorted.length - 1];
        if (primary && last) {
          const newDuration = Math.round(((last.start + last.duration) - primary.start) * 100) / 100;
          const mergedVis: TimelineClip = {
            ...primary,
            duration: newDuration,
            name: `${primary.name} (Joined)`,
          };
          const nextVisuals = visualClips.filter((c) => !sorted.some((sel) => sel.id === c.id));
          const insertIdx = visualClips.findIndex((c) => c.id === primary.id);
          nextVisuals.splice(insertIdx === -1 ? 0 : insertIdx, 0, mergedVis);
          setVisualClips(nextVisuals);
          pushHistory(`Joined visual clips`, undefined, [...nextVisuals, ...audioClips]);
          setSelectedClipIds([mergedVis.id]);
          toast.success(`Joined ${sorted.length} visual clips`);
          return;
        }
      }

      // Check audio clips
      const selectedAud = audioClips.filter((c) => selectedClipIds.includes(c.id));
      if (selectedAud.length >= 2) {
        const sorted = [...selectedAud].sort((a, b) => a.start - b.start);
        const primary = sorted[0];
        const last = sorted[sorted.length - 1];
        if (primary && last) {
          const newDuration = Math.round(((last.start + last.duration) - primary.start) * 100) / 100;
          const mergedAud: TimelineClip = {
            ...primary,
            duration: newDuration,
            name: `${primary.name} (Joined)`,
          };
          const nextAud = audioClips.filter((c) => !sorted.some((sel) => sel.id === c.id));
          const insertIdx = audioClips.findIndex((c) => c.id === primary.id);
          nextAud.splice(insertIdx === -1 ? 0 : insertIdx, 0, mergedAud);
          setAudioClips(nextAud);
          pushHistory(`Joined audio clips`, undefined, [...visualClips, ...nextAud]);
          setSelectedClipIds([mergedAud.id]);
          toast.success(`Joined ${sorted.length} audio clips`);
          return;
        }
      }
    }

    // Case 2: Single clip selected -> join with next adjacent clip on the same track
    const singleId = selectedClipIds[0] || activeSceneId;
    const sceneIdx = scenes.findIndex((s) => s.id === singleId);
    if (sceneIdx !== -1 && sceneIdx < scenes.length - 1) {
      const curScene = scenes[sceneIdx];
      const nextScene = scenes[sceneIdx + 1];
      if (curScene && nextScene) {
        const newDur = Math.round((curScene.duration + nextScene.duration) * 100) / 100;
        const merged: CompositionScene = {
          ...curScene,
          duration: newDur,
          name: `${curScene.name || "Scene"} + Next`,
        };
        if (onUpdateScenes) {
          onUpdateScenes((prev) => {
            const next = [...prev];
            next.splice(sceneIdx, 2, merged);
            pushHistory(`Joined adjacent scenes`, next);
            return next;
          });
          setSelectedClipIds([merged.id]);
          onSelectScene(merged.id);
          toast.success(`Joined with next scene (${newDur}s)`);
          return;
        }
      }
    }

    const visIdx = visualClips.findIndex((c) => c.id === singleId);
    if (visIdx !== -1 && visIdx < visualClips.length - 1) {
      const curVis = visualClips[visIdx];
      const nextVis = visualClips[visIdx + 1];
      if (curVis && nextVis) {
        const newDur = Math.round(((nextVis.start + nextVis.duration) - curVis.start) * 100) / 100;
        const merged: TimelineClip = {
          ...curVis,
          duration: newDur,
          name: `${curVis.name} (Joined)`,
        };
        const nextVisuals = [...visualClips];
        nextVisuals.splice(visIdx, 2, merged);
        setVisualClips(nextVisuals);
        pushHistory(`Joined adjacent visual clips`, undefined, [...nextVisuals, ...audioClips]);
        setSelectedClipIds([merged.id]);
        toast.success(`Joined with next visual clip`);
        return;
      }
    }

    toast.info("Select 2 clips or an adjacent clip to join (Hold Shift to select multiple clips)");
  }, [selectedClipIds, activeSceneId, scenes, visualClips, audioClips, onUpdateScenes, onSelectScene, pushHistory]);

  // 2. Tool: Select Directional (Leftward / Rightward)
  const handleSelectDirectional = (direction: "left" | "right") => {
    const ids = selectClipsDirectional(allCurrentClips, currentTime, direction);
    if (ids.length > 0) {
      setSelectedClipIds(ids);
      toast.info(`Selected ${ids.length} clip${ids.length === 1 ? "" : "s"} ${direction}ward`);
    } else {
      toast.info(`No clips found ${direction} of playhead (${formatClockTime(currentTime)}s)`);
    }
  };

  // 3. Tool: Link / Unlink Selected Clips
  const handleToggleLink = () => {
    if (selectedClipIds.length < 2) {
      toast.info("Select 2 or more clips to link them together (Hold Shift to multi-select)");
      return;
    }

    const isAlreadyLinked = selectedClipIds.every((id) => {
      const clip = allCurrentClips.find((c) => c.id === id);
      return clip?.linkedClipIds && clip.linkedClipIds.length > 0;
    });

    if (isAlreadyLinked) {
      // Unlink
      setVisualClips((prev) =>
        prev.map((c) => (selectedClipIds.includes(c.id) ? { ...c, linkedClipIds: [] } : c))
      );
      toast.success("Unlinked selected clips");
    } else {
      // Link together
      setVisualClips((prev) =>
        prev.map((c) =>
          selectedClipIds.includes(c.id)
            ? { ...c, linkedClipIds: selectedClipIds.filter((other) => other !== c.id) }
            : c
        )
      );
      toast.success(`Linked ${selectedClipIds.length} clips together in lockstep`);
    }
  };

  // 4. Tool: Add Keyframe at Playhead
  const handleAddKeyframe = () => {
    const newKf: TimelineKeyframe = {
      id: `kf-${Date.now().toString(36)}`,
      time: Math.round(currentTime * 100) / 100,
      property: selectedElementId ? "transform" : "opacity",
      value: 1,
      ease: "power2.out",
    };

    setKeyframes((prev) => {
      const filtered = prev.filter((k) => Math.abs(k.time - newKf.time) > 0.05);
      const next = [...filtered, newKf].sort((a, b) => a.time - b.time);
      return next;
    });

    toast.success(`Keyframe added at ${formatClockTime(currentTime)}s`);
  };

  // 5. Tool: Navigate Keyframes
  const handleNavigateKeyframe = (direction: "prev" | "next") => {
    const target = findNearestKeyframe(keyframes, currentTime, direction);
    if (target) {
      onTimeChange(target.time);
      toast.info(`Jumped to keyframe at ${formatClockTime(target.time)}s`);
    } else {
      toast.info(`No ${direction} keyframe found`);
    }
  };

  // 6. Tool: Fit Timeline Zoom
  const handleFitTimeline = () => {
    if (!scrollContainerRef.current) return;
    const availWidth = scrollContainerRef.current.clientWidth - 40;
    const computedScale = Math.max(10, Math.min(100, Math.floor(availWidth / Math.max(1, duration))));
    setZoomScale(computedScale);
    toast.info(`Timeline zoom fitted to composition: ${computedScale}px/s`);
  };

  // Delete Selected Clips
  const handleDeleteSelected = useCallback(() => {
    if (selectedClipIds.length === 0) return;

    // Filter scenes
    if (scenes.some((s) => selectedClipIds.includes(s.id))) {
      if (scenes.length <= 1) {
        toast.warning("Cannot delete the only remaining scene in the composition");
        return;
      }
      if (onUpdateScenes) {
        onUpdateScenes((prev) => {
          let runningStart = 0;
          const next = prev
            .filter((s) => !selectedClipIds.includes(s.id))
            .map((s) => {
              const res = { ...s, start: runningStart };
              runningStart += s.duration;
              return res;
            });
          pushHistory("Delete timeline scene(s)", next);
          return next;
        });
      }
    }

    // Filter visual clips
    if (visualClips.some((c) => selectedClipIds.includes(c.id))) {
      const nextVisuals = visualClips.filter((c) => !selectedClipIds.includes(c.id));
      setVisualClips(nextVisuals);
      pushHistory("Delete visual clip(s)", undefined, [...nextVisuals, ...audioClips]);
    }

    setSelectedClipIds([]);
    toast.success("Deleted selected clip(s)");
  }, [selectedClipIds, scenes, visualClips, audioClips, onUpdateScenes, pushHistory]);

  // Duplicate Selected Clip
  const handleDuplicateSelected = useCallback(() => {
    const primaryId = selectedClipIds[0];
    if (!primaryId) return;

    const vis = visualClips.find((c) => c.id === primaryId);
    if (vis) {
      const copy: TimelineClip = {
        ...vis,
        id: `clip-vis-copy-${Date.now().toString(36)}`,
        name: `${vis.name} (Copy)`,
        start: Math.round((vis.start + vis.duration + 0.5) * 100) / 100,
      };
      const nextVisuals = [...visualClips, copy];
      setVisualClips(nextVisuals);
      setSelectedClipIds([copy.id]);
      pushHistory(`Duplicate ${vis.name}`, undefined, [...nextVisuals, ...audioClips]);
      toast.success(`Duplicated clip to ${formatClockTime(copy.start)}s`);
    }
  }, [selectedClipIds, visualClips, audioClips, pushHistory]);

  // Global Timeline Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept if user is typing in form inputs or textareas
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // Space: Play / Pause
      if (e.code === "Space") {
        e.preventDefault();
        onPlayPauseToggle();
        return;
      }

      // V: Select Tool
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        setActiveTool("select");
        toast.info("Tool: Select (V)");
        return;
      }

      // B: Split Tool
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setActiveTool("split");
        toast.info("Tool: Split / Razor (B)");
        return;
      }

      // J: Join / Merge Selected Clips
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        executeJoin();
        return;
      }

      // [: Select Leftward
      if (e.key === "[") {
        e.preventDefault();
        handleSelectDirectional("left");
        toast.info("Select Leftward ([)");
        return;
      }

      // ]: Select Rightward
      if (e.key === "]") {
        e.preventDefault();
        handleSelectDirectional("right");
        toast.info("Select Rightward (])");
        return;
      }

      // L: Link / Unlink Selected
      if ((e.key === "l" || e.key === "L") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleToggleLink();
        return;
      }

      // K: Add Keyframe at Playhead
      if ((e.key === "k" || e.key === "K") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleAddKeyframe();
        return;
      }

      // S: Toggle Snapping
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setIsSnappingEnabled((prev) => {
          const next = !prev;
          toast.info(`Snapping: ${next ? "Enabled" : "Disabled"}`);
          return next;
        });
        return;
      }

      // Delete / Backspace: Delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      // Cmd+Z / Ctrl+Z: Undo
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Cmd+Shift+Z / Ctrl+Y: Redo
      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "z" || e.key === "Z")) ||
        ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y"))
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Left Arrow: Step 1 frame back (1/30s)
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 1 / 30;
        onTimeChange(Math.max(0, Math.round((currentTime - step) * 100) / 100));
        return;
      }

      // Right Arrow: Step 1 frame forward (1/30s)
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 1 / 30;
        onTimeChange(Math.min(duration, Math.round((currentTime + step) * 100) / 100));
        return;
      }

      // Home: Seek to 00:00
      if (e.key === "Home") {
        e.preventDefault();
        onTimeChange(0);
        return;
      }

      // End: Seek to composition end
      if (e.key === "End") {
        e.preventDefault();
        onTimeChange(duration);
        return;
      }

      // + or =: Zoom in
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoomScale((prev) => Math.min(100, prev + 6));
        return;
      }

      // -: Zoom out
      if (e.key === "-") {
        e.preventDefault();
        setZoomScale((prev) => Math.max(10, prev - 6));
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onPlayPauseToggle,
    handleDeleteSelected,
    handleUndo,
    handleRedo,
    currentTime,
    duration,
    onTimeChange,
  ]);

  // Dragging and Trimming Global Mouse Event Listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 1. Scrubbing Playhead
      if (isScrubbing && rulerRef.current) {
        const rect = rulerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const newTime = Math.max(0, Math.min(duration, pixelToTime(clickX, zoomScale)));
        onTimeChange(Math.round(newTime * 100) / 100);
        return;
      }

      // 2. Dragging Clip horizontally (Move)
      if (draggingClipId && rulerRef.current) {
        const deltaPx = e.clientX - dragStartX;
        const rawNewStart = dragInitialClipStart + pixelToTime(deltaPx, zoomScale);

        // Find dragged clip
        const targetClip = allCurrentClips.find((c) => c.id === draggingClipId);
        if (targetClip) {
          const { start: snappedStart, snappedGuide } = moveClipWithSnapping(
            targetClip,
            rawNewStart,
            allCurrentClips,
            currentTime,
            0.25,
            isSnappingEnabled
          );

          setActiveSnapGuide(snappedGuide !== null ? timeToPixel(snappedGuide, zoomScale) : null);

          // Update visual clips
          if (targetClip.trackType === "visual") {
            setVisualClips((prev) =>
              prev.map((c) => (c.id === draggingClipId ? { ...c, start: snappedStart } : c))
            );
          } else if (targetClip.trackType === "audio") {
            setAudioClips((prev) =>
              prev.map((c) => (c.id === draggingClipId ? { ...c, start: snappedStart } : c))
            );
          } else if (targetClip.trackType === "scene" && onUpdateScenes) {
            onUpdateScenes((prev) =>
              prev.map((s) => (s.id === draggingClipId ? { ...s, start: snappedStart } : s))
            );
          }
        }
        return;
      }

      // 3. Trimming Clip Handle
      if (trimmingClipId) {
        const deltaPx = e.clientX - trimStartX;
        const targetClip = allCurrentClips.find((c) => c.id === trimmingClipId);
        if (targetClip) {
          const newEdgeTime =
            trimEdge === "right"
              ? trimInitialStart + trimInitialDuration + pixelToTime(deltaPx, zoomScale)
              : trimInitialStart + pixelToTime(deltaPx, zoomScale);

          const { start: resStart, duration: resDur, snappedGuide } = resizeClipWithSnapping(
            targetClip,
            trimEdge,
            newEdgeTime,
            allCurrentClips,
            currentTime,
            0.5,
            isSnappingEnabled
          );

          setActiveSnapGuide(snappedGuide !== null ? timeToPixel(snappedGuide, zoomScale) : null);

          if (targetClip.trackType === "scene" && onUpdateScenes) {
            onUpdateScenes((prev) =>
              prev.map((s) => (s.id === trimmingClipId ? { ...s, start: resStart, duration: resDur } : s))
            );
          } else if (targetClip.trackType === "visual") {
            setVisualClips((prev) =>
              prev.map((c) => (c.id === trimmingClipId ? { ...c, start: resStart, duration: resDur } : c))
            );
          } else if (targetClip.trackType === "audio") {
            setAudioClips((prev) =>
              prev.map((c) => (c.id === trimmingClipId ? { ...c, start: resStart, duration: resDur } : c))
            );
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (draggingClipId) {
        pushHistory("Move timeline clip");
        setDraggingClipId(null);
      }
      if (trimmingClipId) {
        pushHistory(`Trim ${trimEdge} clip handle`);
        setTrimmingClipId(null);
      }
      setIsScrubbing(false);
      setActiveSnapGuide(null);
    };

    if (isScrubbing || draggingClipId || trimmingClipId) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isScrubbing,
    draggingClipId,
    dragStartX,
    dragInitialClipStart,
    trimmingClipId,
    trimEdge,
    trimStartX,
    trimInitialStart,
    trimInitialDuration,
    zoomScale,
    duration,
    currentTime,
    isSnappingEnabled,
    allCurrentClips,
    onTimeChange,
    onUpdateScenes,
    pushHistory,
  ]);

  // Close context menu on outside click or Escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (contextMenu) setContextMenu(null);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", handleOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("click", handleOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [contextMenu]);

  // Generate Adaptive Ruler Tick Marks
  const rulerTicks = useMemo(() => {
    const ticks: { time: number; label?: string; isMajor: boolean }[] = [];
    const step = zoomScale >= 40 ? 0.5 : zoomScale >= 20 ? 1 : 2;
    const labelStep = zoomScale >= 40 ? 1 : zoomScale >= 20 ? 2 : 5;

    for (let t = 0; t <= duration + 1; t += step) {
      const isMajor = Math.round(t % labelStep) === 0;
      ticks.push({
        time: t,
        label: isMajor ? `${t}s` : undefined,
        isMajor,
      });
    }
    return ticks;
  }, [duration, zoomScale]);

  return (
    <div
      ref={containerRef}
      className="h-[275px] shrink-0 bg-white border-t border-gray-200 flex flex-col select-none relative z-10"
    >
      {/* 1. PROFESSIONAL TIMELINE TOOLBAR */}
      <div className="h-10 bg-[#f9fafb] border-b border-gray-200 px-3 flex items-center justify-between text-xs text-gray-700 shrink-0 gap-3">
        {/* Left Section: Playback Controls & Timecode */}
        <div className="flex items-center gap-2">
          {/* Play / Pause Button */}
          <button
            type="button"
            onClick={onPlayPauseToggle}
            className={`flex items-center gap-1.5 px-3 py-1 font-semibold rounded text-xs transition shadow-xs ${
              isPlaying
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* Rewind to 0 */}
          <button
            type="button"
            onClick={() => onTimeChange(0)}
            className="p-1.5 hover:bg-gray-200 rounded transition text-gray-600 hover:text-gray-900"
            title="Rewind to start (Home)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Step 1 frame back */}
          <button
            type="button"
            onClick={() => onTimeChange(Math.max(0, Math.round((currentTime - 1 / 30) * 100) / 100))}
            className="p-1 hover:bg-gray-200 rounded transition text-gray-600 hover:text-gray-900"
            title="Step back 1 frame (Left Arrow)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Step 1 frame forward */}
          <button
            type="button"
            onClick={() => onTimeChange(Math.min(duration, Math.round((currentTime + 1 / 30) * 100) / 100))}
            className="p-1 hover:bg-gray-200 rounded transition text-gray-600 hover:text-gray-900"
            title="Step forward 1 frame (Right Arrow)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* SMPTE Professional Timecode Display */}
          <div className="font-mono text-xs flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-gray-200 shadow-xs ml-1">
            <span className="text-emerald-700 font-bold tracking-wider">
              {formatTimecode(currentTime, 30)}
            </span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-500 font-medium">
              {formatTimecode(duration, 30)}
            </span>
          </div>
        </div>

        {/* Center Section: Professional Editing Tools with Screenshot 1 Dropdown */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-xs relative">
          {/* Tool Dropdown Selector (Matching Screenshot 1) */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => setActiveTool("select")}
              className={`p-1.5 rounded-l transition flex items-center gap-1 ${
                activeTool === "select"
                  ? "bg-purple-100 text-purple-900 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
              title="Select Tool [V]"
            >
              <MousePointer className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsToolDropdownOpen((prev) => !prev)}
              className={`p-1 rounded-r border-l border-gray-200 transition ${
                isToolDropdownOpen ? "bg-gray-150 text-gray-900" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              }`}
              title="Tool Switcher"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {/* Dropdown Menu Popup (Matching Screenshot 1) */}
            {isToolDropdownOpen && (
              <div
                className="absolute top-full left-0 mt-1.5 min-w-[190px] bg-white border border-gray-200 rounded-lg shadow-xl py-1 text-xs text-gray-800 z-50 divide-y divide-gray-100 backdrop-blur-md animate-in fade-in duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTool("select");
                      setIsToolDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between transition ${
                      activeTool === "select" ? "bg-purple-50 text-purple-900 font-semibold" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MousePointer className="w-3.5 h-3.5 text-purple-600" />
                      <span>Select</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 py-0.2 rounded">V</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTool("split");
                      executeSplit();
                      setIsToolDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between transition ${
                      activeTool === "split" ? "bg-amber-50 text-amber-900 font-semibold" : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Scissors className="w-3.5 h-3.5 text-amber-600" />
                      <span>Split</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 py-0.2 rounded">B</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSelectDirectional("left");
                      setIsToolDropdownOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-gray-50 text-gray-700 flex items-center justify-between transition"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronsLeft className="w-3.5 h-3.5 text-blue-600" />
                      <span>Select leftward</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 py-0.2 rounded">[</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSelectDirectional("right");
                      setIsToolDropdownOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-gray-50 text-gray-700 flex items-center justify-between transition"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronsRight className="w-3.5 h-3.5 text-blue-600" />
                      <span>Select rightward</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 py-0.2 rounded">]</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Split Tool / Razor (B) */}
          <button
            type="button"
            onClick={() => {
              setActiveTool("split");
              executeSplit();
            }}
            className={`p-1.5 rounded transition flex items-center gap-1 ${
              activeTool === "split"
                ? "bg-amber-100 text-amber-900 font-semibold"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
            title="Split Clip at Playhead [B]"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-600" />
          </button>

          {/* 2b. Join / Merge Adjacent Clips (J) */}
          <button
            type="button"
            onClick={executeJoin}
            className="p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition flex items-center gap-1"
            title="Join / Merge Adjacent Clips [J]"
          >
            <Merge className="w-3.5 h-3.5 text-amber-600" />
          </button>

          <div className="h-4 w-px bg-gray-200 mx-0.5" />

          {/* 3. Select Leftward ([) */}
          <button
            type="button"
            onClick={() => handleSelectDirectional("left")}
            className="p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
            title="Select Leftward Clips [[]"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* 4. Select Rightward (]) */}
          <button
            type="button"
            onClick={() => handleSelectDirectional("right")}
            className="p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
            title="Select Rightward Clips []]"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-gray-200 mx-0.5" />

          {/* 5. Link / Unlink Clips (L) */}
          <button
            type="button"
            onClick={handleToggleLink}
            className={`p-1.5 rounded transition ${
              selectedClipIds.length >= 2
                ? "text-blue-600 bg-blue-50"
                : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            }`}
            title="Link / Unlink Selected Clips [L]"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>

          {/* 6. Snapping Toggle (S) */}
          <button
            type="button"
            onClick={() => setIsSnappingEnabled((prev) => !prev)}
            className={`p-1.5 rounded transition flex items-center gap-1 ${
              isSnappingEnabled
                ? "text-emerald-700 bg-emerald-50 border border-emerald-300 font-semibold"
                : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            }`}
            title={`Toggle Snapping [S] • Currently ${isSnappingEnabled ? "ON" : "OFF"}`}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-gray-200 mx-0.5" />

          {/* 7. Add Keyframe (K) */}
          <button
            type="button"
            onClick={handleAddKeyframe}
            className="p-1.5 rounded text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition flex items-center gap-1"
            title="Add Animation Keyframe at Playhead [K]"
          >
            <Diamond className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* 8. Prev Keyframe */}
          <button
            type="button"
            onClick={() => handleNavigateKeyframe("prev")}
            className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition"
            title="Previous Keyframe"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>

          {/* 9. Next Keyframe */}
          <button
            type="button"
            onClick={() => handleNavigateKeyframe("next")}
            className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition"
            title="Next Keyframe"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Right Section: Undo/Redo & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Undo */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Undo (Cmd+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Redo */}
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex >= historyStack.length - 1}
            className="p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Redo (Cmd+Shift+Z)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-gray-200 mx-1" />

          {/* Fit Timeline */}
          <button
            type="button"
            onClick={handleFitTimeline}
            className="p-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition"
            title="Fit Entire Timeline to Width"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => setZoomScale((prev) => Math.max(10, prev - 6))}
            className="p-1 rounded text-gray-600 hover:text-gray-900 transition"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Slider */}
          <input
            type="range"
            min="10"
            max="100"
            value={zoomScale}
            onChange={(e) => setZoomScale(Number(e.target.value))}
            className="w-20 accent-purple-600 cursor-pointer h-1 bg-gray-200 rounded-lg"
            title={`Timeline Zoom: ${zoomScale}px/sec`}
          />

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => setZoomScale((prev) => Math.min(100, prev + 6))}
            className="p-1 rounded text-gray-600 hover:text-gray-900 transition"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono text-[10px] text-gray-500 w-8 text-right font-medium">
            {zoomScale}x
          </span>
        </div>
      </div>

      {/* 2. MULTITRACK WORKSPACE AREA */}
      <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">
        {/* Track Headers (Left Sidebar) */}
        <div className="w-48 shrink-0 bg-[#f9fafb] border-r border-gray-200 flex flex-col text-xs text-gray-700 min-h-0 z-20">
          <div className="h-7 border-b border-gray-200 px-3 flex items-center justify-between font-mono text-[10px] text-gray-500 uppercase tracking-wider shrink-0 bg-[#f3f4f6]">
            <span>Tracks</span>
            <span className="text-[9px] text-purple-700 font-bold">4 LANES</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100">
            {/* Track 1: Scene Sequences */}
            <div className="h-[52px] px-3 flex items-center justify-between bg-white hover:bg-gray-50 transition">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0"></span>
                <span className="font-medium text-gray-800 truncate text-[11px]">Scene Sequence</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <button
                  type="button"
                  onClick={() => setTrackVisibility((p) => ({ ...p, scenes: !p.scenes }))}
                  title="Toggle track visibility"
                >
                  {trackVisibility.scenes ? (
                    <Eye className="w-3 h-3 hover:text-gray-700 cursor-pointer" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-gray-300 hover:text-gray-700 cursor-pointer" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTrackLocks((p) => ({ ...p, scenes: !p.scenes }))}
                  title="Toggle track lock"
                >
                  {trackLocks.scenes ? (
                    <Lock className="w-3 h-3 text-amber-600 cursor-pointer" />
                  ) : (
                    <Unlock className="w-3 h-3 hover:text-gray-700 cursor-pointer" />
                  )}
                </button>
              </div>
            </div>

            {/* Track 2: Visual Elements */}
            <div className="h-[52px] px-3 flex items-center justify-between bg-white hover:bg-gray-50 transition">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                <span className="font-medium text-gray-800 truncate text-[11px]">Visual Elements</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <button
                  type="button"
                  onClick={() => setTrackVisibility((p) => ({ ...p, visuals: !p.visuals }))}
                  title="Toggle track visibility"
                >
                  {trackVisibility.visuals ? (
                    <Eye className="w-3 h-3 hover:text-gray-700 cursor-pointer" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-gray-300 hover:text-gray-700 cursor-pointer" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTrackLocks((p) => ({ ...p, visuals: !p.visuals }))}
                  title="Toggle track lock"
                >
                  {trackLocks.visuals ? (
                    <Lock className="w-3 h-3 text-amber-600 cursor-pointer" />
                  ) : (
                    <Unlock className="w-3 h-3 hover:text-gray-700 cursor-pointer" />
                  )}
                </button>
              </div>
            </div>

            {/* Track 3: Audio & Voiceover */}
            <div className="h-[52px] px-3 flex items-center justify-between bg-white hover:bg-gray-50 transition">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                <span className="font-medium text-gray-800 truncate text-[11px]">Audio &amp; Voice</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <button
                  type="button"
                  onClick={() => setTrackMuted((p) => ({ ...p, audio: !p.audio }))}
                  title={trackMuted.audio ? "Unmute audio track" : "Mute audio track"}
                >
                  {trackMuted.audio ? (
                    <VolumeX className="w-3 h-3 text-red-500 cursor-pointer" />
                  ) : (
                    <Volume2 className="w-3 h-3 hover:text-gray-700 cursor-pointer" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTrackLocks((p) => ({ ...p, audio: !p.audio }))}
                  title="Toggle track lock"
                >
                  {trackLocks.audio ? (
                    <Lock className="w-3 h-3 text-amber-600 cursor-pointer" />
                  ) : (
                    <Unlock className="w-3 h-3 hover:text-gray-700 cursor-pointer" />
                  )}
                </button>
              </div>
            </div>

            {/* Track 4: Keyframes Track */}
            <div className="h-[40px] px-3 flex items-center justify-between bg-[#fafafa] hover:bg-gray-50 transition">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                <span className="font-medium text-gray-800 truncate text-[11px]">Keyframes &amp; FX</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <Diamond className="w-3 h-3 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tracks Timeline Grid and Scrubbing Ruler */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 min-h-0 min-w-0 overflow-x-auto relative flex flex-col bg-white"
        >
          {/* Time Ruler (Seconds and Sub-second ticks) */}
          <div
            ref={rulerRef}
            onClick={handleTimelineScrub}
            onMouseDown={() => setIsScrubbing(true)}
            style={{ width: `${totalTimelineWidth}px` }}
            className="h-7 border-b border-gray-200 relative cursor-pointer bg-[#f9fafb] select-none shrink-0"
          >
            {rulerTicks.map((tick) => (
              <div
                key={tick.time}
                style={{ left: `${tick.time * zoomScale}px` }}
                className="absolute top-0 bottom-0 border-l border-gray-200 flex flex-col justify-between pl-1 pointer-events-none"
              >
                {tick.label && (
                  <span className="text-[9px] font-mono text-gray-500 font-medium">
                    {tick.label}
                  </span>
                )}
                <div
                  className={`w-px ${tick.isMajor ? "h-2 bg-gray-400" : "h-1 bg-gray-300"}`}
                ></div>
              </div>
            ))}

            {/* Snapping Guide Line Indicator */}
            {activeSnapGuide !== null && (
              <div
                style={{ left: `${activeSnapGuide}px` }}
                className="absolute top-0 bottom-0 w-px border-l border-dashed border-cyan-500 z-50 pointer-events-none"
              />
            )}

            {/* Red Playhead Needle Head */}
            <div
              style={{ left: `${currentTime * zoomScale}px` }}
              className="absolute top-0 -translate-x-1/2 cursor-ew-resize z-40 group"
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsScrubbing(true);
              }}
            >
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[9px] border-t-red-600 drop-shadow"></div>
              {/* Floating current time tag during scrubbing */}
              {isScrubbing && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap">
                  {formatClockTime(currentTime)}s
                </div>
              )}
            </div>
          </div>

          {/* Timeline Lanes Canvas */}
          <div
            style={{ width: `${totalTimelineWidth}px` }}
            className="flex-1 relative divide-y divide-gray-100 bg-white"
          >
            {/* Playhead Vertical Line extending down all lanes */}
            <div
              style={{ left: `${currentTime * zoomScale}px` }}
              className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)]"
            />

            {/* Snapping Guide Line on Tracks Canvas */}
            {activeSnapGuide !== null && (
              <div
                style={{ left: `${activeSnapGuide}px` }}
                className="absolute top-0 bottom-0 w-px border-l border-dashed border-cyan-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(6,182,212,0.5)]"
              />
            )}

            {/* Lane 1: Scene Sequences */}
            <div 
              onDragOver={(e) => handleLaneDragOver(e, "scene")}
              onDragLeave={handleLaneDragLeave}
              onDrop={(e) => handleLaneDrop(e, "scene")}
              className={`h-[52px] relative flex items-center px-1 transition ${
                dropHoverState?.lane === "scene" ? "bg-purple-100/70 ring-2 ring-purple-500 ring-inset" : "bg-white"
              }`}
            >
              {/* Drop target preview indicator */}
              {dropHoverState?.lane === "scene" && (
                <div 
                  style={{ left: `${dropHoverState.x}px` }} 
                  className="absolute top-0 bottom-0 w-0.5 bg-purple-600 z-30 pointer-events-none shadow-[0_0_8px_rgba(168,85,247,0.8)]"
                >
                  <div className="absolute -top-6 -translate-x-1/2 bg-purple-700 text-white text-[9px] font-mono px-2 py-0.5 rounded shadow whitespace-nowrap z-40">
                    Drop Scene at {formatTimecode(dropHoverState.time)}
                  </div>
                </div>
              )}

              {trackVisibility.scenes &&
                scenes.map((scene, idx) => {
                  const isSelected = selectedClipIds.includes(scene.id) || scene.id === activeSceneId;
                  const leftPos = timeToPixel(scene.start, zoomScale);
                  const clipWidth = Math.max(30, timeToPixel(scene.duration, zoomScale));

                  return (
                    <div
                      key={scene.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Always select clicked scene
                        setSelectedClipIds([scene.id]);
                        onSelectScene(scene.id);

                        if (activeTool === "split") {
                          if (currentTime > scene.start + 0.15 && currentTime < scene.start + scene.duration - 0.15) {
                            executeSplit(scene.id);
                          }
                        } else {
                          if (e.shiftKey) {
                            setSelectedClipIds((prev) =>
                              prev.includes(scene.id) ? prev.filter((id) => id !== scene.id) : [...prev, scene.id]
                            );
                          }
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          clipId: scene.id,
                          trackType: "scene",
                        });
                      }}
                      onMouseDown={(e) => {
                        if (activeTool === "select" && !trackLocks.scenes) {
                          setDraggingClipId(scene.id);
                          setDragStartX(e.clientX);
                          setDragInitialClipStart(scene.start);
                        }
                      }}
                      style={{
                        left: `${leftPos}px`,
                        width: `${clipWidth}px`,
                      }}
                      className={`absolute h-10 rounded-md px-2.5 flex items-center justify-between text-xs font-medium cursor-pointer transition shadow-xs border ${
                        isSelected
                          ? "bg-[#1e293b] border-purple-500 text-white ring-2 ring-purple-400 shadow-md"
                          : "bg-[#1e293b] border-slate-700/80 hover:border-slate-500 text-white/95"
                      }`}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (!trackLocks.scenes) {
                            setTrimmingClipId(scene.id);
                            setTrimEdge("left");
                            setTrimStartX(e.clientX);
                            setTrimInitialStart(scene.start);
                            setTrimInitialDuration(scene.duration);
                          }
                        }}
                        className="absolute left-0 top-0 bottom-0 w-2.5 hover:bg-purple-400/80 cursor-ew-resize rounded-l z-20 flex items-center justify-center opacity-40 hover:opacity-100"
                        title="Trim Scene Start"
                      >
                        <div className="w-0.5 h-3 bg-white"></div>
                      </div>

                      {/* Clip Content Label */}
                      <div className="truncate flex items-center gap-1.5 z-10 select-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                        <span className="truncate text-[11px] font-semibold tracking-wide text-white">
                          {scene.name || `Scene ${idx + 1}`}
                        </span>
                      </div>

                      {/* Duration Tag */}
                      <span className="text-[10px] font-mono text-white/60 shrink-0 z-10 select-none ml-1">
                        {scene.duration}s
                      </span>

                      {/* Right Trim Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (!trackLocks.scenes) {
                            setTrimmingClipId(scene.id);
                            setTrimEdge("right");
                            setTrimStartX(e.clientX);
                            setTrimInitialStart(scene.start);
                            setTrimInitialDuration(scene.duration);
                          }
                        }}
                        className="absolute right-0 top-0 bottom-0 w-2.5 hover:bg-purple-400/80 cursor-ew-resize rounded-r z-20 flex items-center justify-center opacity-40 hover:opacity-100"
                        title="Trim Scene Duration"
                      >
                        <div className="w-0.5 h-3 bg-white"></div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Lane 2: Visual Elements */}
            <div 
              onDragOver={(e) => handleLaneDragOver(e, "visual")}
              onDragLeave={handleLaneDragLeave}
              onDrop={(e) => handleLaneDrop(e, "visual")}
              className={`h-[52px] relative flex items-center px-1 transition ${
                dropHoverState?.lane === "visual" ? "bg-blue-100/70 ring-2 ring-blue-500 ring-inset" : "bg-[#fafafa]"
              }`}
            >
              {/* Drop target preview indicator */}
              {dropHoverState?.lane === "visual" && (
                <div 
                  style={{ left: `${dropHoverState.x}px` }} 
                  className="absolute top-0 bottom-0 w-0.5 bg-blue-600 z-30 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                >
                  <div className="absolute -top-6 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-mono px-2 py-0.5 rounded shadow whitespace-nowrap z-40">
                    Drop Visual at {formatTimecode(dropHoverState.time)}
                  </div>
                </div>
              )}

              {trackVisibility.visuals &&
                visualClips.map((clip) => {
                  const isSelected = selectedClipIds.includes(clip.id);
                  const leftPos = timeToPixel(clip.start, zoomScale);
                  const clipWidth = Math.max(30, timeToPixel(clip.duration, zoomScale));

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeTool === "split") {
                          executeSplit(clip.id);
                        } else {
                          if (e.shiftKey) {
                            setSelectedClipIds((prev) =>
                              prev.includes(clip.id) ? prev.filter((id) => id !== clip.id) : [...prev, clip.id]
                            );
                          } else {
                            setSelectedClipIds([clip.id]);
                            if (clip.elementId && onSelectElementId) {
                              onSelectElementId(clip.elementId);
                            }
                          }
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          clipId: clip.id,
                          trackType: "visual",
                        });
                      }}
                      onMouseDown={(e) => {
                        if (activeTool === "select" && !trackLocks.visuals) {
                          setDraggingClipId(clip.id);
                          setDragStartX(e.clientX);
                          setDragInitialClipStart(clip.start);
                        }
                      }}
                      style={{
                        left: `${leftPos}px`,
                        width: `${clipWidth}px`,
                      }}
                      className={`absolute h-9 rounded-md px-2.5 flex items-center justify-between text-xs font-medium cursor-pointer transition shadow-xs border ${
                        isSelected
                          ? "bg-[#0f172a] border-blue-500 text-white ring-2 ring-blue-400 shadow-md"
                          : "bg-[#1e293b] border-blue-900/60 hover:border-blue-700 text-blue-100"
                      }`}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (!trackLocks.visuals) {
                            setTrimmingClipId(clip.id);
                            setTrimEdge("left");
                            setTrimStartX(e.clientX);
                            setTrimInitialStart(clip.start);
                            setTrimInitialDuration(clip.duration);
                          }
                        }}
                        className="absolute left-0 top-0 bottom-0 w-2.5 hover:bg-blue-400 cursor-ew-resize rounded-l z-20 flex items-center justify-center opacity-30 hover:opacity-100"
                        title="Trim Element Start"
                      >
                        <div className="w-0.5 h-3 bg-white"></div>
                      </div>

                      <div className="truncate flex items-center gap-1.5 z-10 select-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>
                        <span className="truncate text-[11px] font-mono text-white">{clip.name}</span>
                      </div>

                      <span className="text-[10px] font-mono text-blue-200/70 shrink-0 z-10 select-none ml-1">
                        {clip.duration}s
                      </span>

                      {/* Right Trim Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (!trackLocks.visuals) {
                            setTrimmingClipId(clip.id);
                            setTrimEdge("right");
                            setTrimStartX(e.clientX);
                            setTrimInitialStart(clip.start);
                            setTrimInitialDuration(clip.duration);
                          }
                        }}
                        className="absolute right-0 top-0 bottom-0 w-2.5 hover:bg-blue-400 cursor-ew-resize rounded-r z-20 flex items-center justify-center opacity-30 hover:opacity-100"
                        title="Trim Element Duration"
                      >
                        <div className="w-0.5 h-3 bg-white"></div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Lane 3: Audio & Voiceover Track */}
            <div 
              onDragOver={(e) => handleLaneDragOver(e, "audio")}
              onDragLeave={handleLaneDragLeave}
              onDrop={(e) => handleLaneDrop(e, "audio")}
              className={`h-[52px] relative flex items-center px-1 transition ${
                dropHoverState?.lane === "audio" ? "bg-emerald-100/70 ring-2 ring-emerald-500 ring-inset" : "bg-white"
              }`}
            >
              {/* Drop target preview indicator */}
              {dropHoverState?.lane === "audio" && (
                <div 
                  style={{ left: `${dropHoverState.x}px` }} 
                  className="absolute top-0 bottom-0 w-0.5 bg-emerald-600 z-30 pointer-events-none shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                >
                  <div className="absolute -top-6 -translate-x-1/2 bg-emerald-700 text-white text-[9px] font-mono px-2 py-0.5 rounded shadow whitespace-nowrap z-40">
                    Drop Audio at {formatTimecode(dropHoverState.time)}
                  </div>
                </div>
              )}

              {trackVisibility.audio &&
                audioClips.map((clip) => {
                  const isSelected = selectedClipIds.includes(clip.id);
                  const leftPos = timeToPixel(clip.start, zoomScale);
                  const clipWidth = Math.max(30, timeToPixel(clip.duration, zoomScale));

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeTool === "split") {
                          executeSplit(clip.id);
                        } else {
                          setSelectedClipIds([clip.id]);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          clipId: clip.id,
                          trackType: "audio",
                        });
                      }}
                      onMouseDown={(e) => {
                        if (activeTool === "select" && !trackLocks.audio) {
                          setDraggingClipId(clip.id);
                          setDragStartX(e.clientX);
                          setDragInitialClipStart(clip.start);
                        }
                      }}
                      style={{
                        left: `${leftPos}px`,
                        width: `${clipWidth}px`,
                      }}
                      className={`absolute h-9 rounded-md px-2.5 flex items-center justify-between text-xs font-medium cursor-pointer transition shadow-xs border ${
                        isSelected
                          ? "bg-[#022c22] border-emerald-500 text-white ring-2 ring-emerald-400 shadow-md"
                          : "bg-[#064e3b] border-emerald-900/60 hover:border-emerald-700 text-emerald-100"
                      }`}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (!trackLocks.audio) {
                            setTrimmingClipId(clip.id);
                            setTrimEdge("left");
                            setTrimStartX(e.clientX);
                            setTrimInitialStart(clip.start);
                            setTrimInitialDuration(clip.duration);
                          }
                        }}
                        className="absolute left-0 top-0 bottom-0 w-2.5 hover:bg-emerald-400 cursor-ew-resize rounded-l z-20 flex items-center justify-center opacity-30 hover:opacity-100"
                        title="Trim Audio Start"
                      >
                        <div className="w-0.5 h-3 bg-white"></div>
                      </div>

                      <div className="truncate flex items-center gap-1.5 z-10 select-none">
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate text-[11px] font-mono text-white">{clip.name}</span>
                      </div>

                      <span className="text-[10px] font-mono text-emerald-200/70 shrink-0 z-10 select-none ml-1">
                        {clip.duration}s
                      </span>

                      {/* Right Trim Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (!trackLocks.audio) {
                            setTrimmingClipId(clip.id);
                            setTrimEdge("right");
                            setTrimStartX(e.clientX);
                            setTrimInitialStart(clip.start);
                            setTrimInitialDuration(clip.duration);
                          }
                        }}
                        className="absolute right-0 top-0 bottom-0 w-2.5 hover:bg-emerald-400 cursor-ew-resize rounded-r z-20 flex items-center justify-center opacity-30 hover:opacity-100"
                        title="Trim Audio Duration"
                      >
                        <div className="w-0.5 h-3 bg-white"></div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Lane 4: Keyframes Track */}
            <div className="h-[40px] relative flex items-center px-1 bg-[#fafafa]">
              {trackVisibility.keyframes && (
                <div className="w-full h-full relative">
                  {keyframes.map((kf) => {
                    const leftPos = timeToPixel(kf.time, zoomScale);
                    const isNearPlayhead = Math.abs(currentTime - kf.time) <= 0.1;

                    return (
                      <div
                        key={kf.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTimeChange(kf.time);
                          toast.info(`Keyframe: ${kf.property} = ${kf.value} @ ${formatClockTime(kf.time)}s`);
                        }}
                        style={{ left: `${leftPos}px` }}
                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-xs rotate-45 cursor-pointer transition shadow-xs z-20 flex items-center justify-center ${
                          isNearPlayhead
                            ? "bg-amber-500 ring-2 ring-amber-400 scale-125"
                            : "bg-amber-400 hover:bg-amber-500"
                        }`}
                        title={`Keyframe: ${kf.property} at ${formatClockTime(kf.time)}s`}
                      >
                        <div className="w-1.5 h-1.5 bg-black/50 rounded-full"></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. CLIP CONTEXT MENU (Boundary-aware positioning so it never cuts off at bottom) */}
      {contextMenu && (() => {
        const menuHeight = 350;
        const menuWidth = 230;
        const windowHeight = typeof window !== "undefined" ? window.innerHeight : 900;
        const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1400;

        // Position upwards if it would overflow the bottom of the viewport
        let topPos = contextMenu.y;
        if (topPos + menuHeight > windowHeight - 15) {
          topPos = Math.max(15, contextMenu.y - menuHeight);
        }
        if (topPos + menuHeight > windowHeight - 15) {
          topPos = Math.max(15, windowHeight - menuHeight - 15);
        }

        let leftPos = contextMenu.x;
        if (leftPos + menuWidth > windowWidth - 20) {
          leftPos = Math.max(10, windowWidth - menuWidth - 20);
        }

        return (
          <div
            style={{ 
              top: `${topPos}px`, 
              left: `${leftPos}px`, 
              maxHeight: "min(360px, calc(100vh - 30px))" 
            }}
            className="fixed z-50 min-w-[210px] bg-white border border-gray-200 rounded-lg shadow-xl py-1 text-xs text-gray-800 backdrop-blur-md animate-in fade-in duration-100 divide-y divide-gray-100 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
          <div className="py-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveTool("select");
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center justify-between transition text-gray-700"
            >
              <div className="flex items-center gap-2">
                <MousePointer className="w-3.5 h-3.5 text-purple-600" />
                <span>Select</span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">V</span>
            </button>

            <button
              type="button"
              onClick={() => {
                executeSplit(contextMenu.clipId);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center justify-between transition text-gray-700"
            >
              <div className="flex items-center gap-2">
                <Scissors className="w-3.5 h-3.5 text-amber-600" />
                <span>Split</span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">B</span>
            </button>

            <button
              type="button"
              onClick={() => {
                executeJoin();
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center justify-between transition text-gray-700"
            >
              <div className="flex items-center gap-2">
                <Merge className="w-3.5 h-3.5 text-amber-600" />
                <span>Join / Merge</span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">J</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleSelectDirectional("left");
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center justify-between transition text-gray-700"
            >
              <div className="flex items-center gap-2">
                <ChevronsLeft className="w-3.5 h-3.5 text-blue-600" />
                <span>Select leftward</span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">[</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleSelectDirectional("right");
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center justify-between transition text-gray-700"
            >
              <div className="flex items-center gap-2">
                <ChevronsRight className="w-3.5 h-3.5 text-blue-600" />
                <span>Select rightward</span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">]</span>
            </button>
          </div>

          <div className="py-0.5">
            <button
              type="button"
              onClick={() => {
                handleDuplicateSelected();
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center justify-between transition text-gray-700"
            >
              <div className="flex items-center gap-2">
                <Copy className="w-3.5 h-3.5 text-blue-600" />
                <span>Duplicate Clip</span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">⌘D</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleToggleLink();
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center justify-between transition text-gray-700"
            >
              <div className="flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5 text-purple-600" />
                <span>Link / Unlink Clip</span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">L</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpenPropertiesTab) onOpenPropertiesTab("visual");
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center justify-between transition text-gray-700"
            >
              <div className="flex items-center gap-2">
                <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Open Properties</span>
              </div>
            </button>
          </div>

          <div className="py-0.5">
            <button
              type="button"
              onClick={() => {
                handleDeleteSelected();
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>Delete Clip</span>
              </div>
              <span className="text-[10px] font-mono text-red-400">Del</span>
            </button>
          </div>
        </div>
      );
    })()}
    </div>
  );
};

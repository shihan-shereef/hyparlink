"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type AssetItem, type CompositionScene, TimelineClip } from "../types";
import { FreeCutPlayhead } from "./components/freecut-playhead";
import { FreeCutTimeRuler } from "./components/freecut-time-ruler";
import { FreeCutTimelineHeader } from "./components/freecut-timeline-header";
import { FreeCutTimelineTrack } from "./components/freecut-timeline-track";
import { FreeCutTrackHeader } from "./components/freecut-track-header";
import {
  DEFAULT_FPS,
  adaptFreeCutToOllastarScenes,
  adaptOllastarToFreeCut,
  findSnapPoint,
} from "./freecut-adapter";
import {
  type FreeCutHistoryEntry,
  FreeCutTimelineItem,
  type FreeCutTool,
  type FreeCutTimelineTrack as FreeCutTrackType,
} from "./types";
import "./theme.css";

export interface FreeCutTimelineProps {
  duration: number;
  onUpdateDuration?: (newDuration: number) => void;
  currentTime: number;
  isPlaying: boolean;
  onTimeChange: (time: number) => void;
  onPlayPauseToggle: () => void;
  scenes: CompositionScene[];
  activeSceneId: string;
  onSelectScene: (sceneId: string) => void;
  onUpdateSceneDuration?: (sceneId: string, deltaSeconds: number) => void;
  onUpdateScenes?: (
    updater: (prev: CompositionScene[]) => CompositionScene[],
  ) => void;
  onReorderScenes?: (fromIndex: number, toIndex: number) => void;
  onAddScene?: () => void;
  onSplitAtPlayhead?: () => void;
  selectedElementId?: string;
  onSelectElementId?: (id: string | null) => void;
  onOpenPropertiesTab?: (tab: "visual" | "layers" | "renders" | "vars") => void;
  projectTitle?: string;
  projectId?: string;
  onDropAsset?: (
    asset: AssetItem,
    targetTime: number,
    trackType: "visual" | "audio" | "scene",
  ) => void;
  playbackSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  onSetSceneSpeed?: (sceneId: string, speedMultiplier: number) => void;
}

export const FreeCutTimeline: React.FC<FreeCutTimelineProps> = ({
  duration,
  onUpdateDuration,
  currentTime,
  isPlaying,
  onTimeChange,
  onPlayPauseToggle,
  scenes,
  activeSceneId,
  onSelectScene,
  onUpdateSceneDuration,
  onUpdateScenes,
  onAddScene,
  selectedElementId,
  onSelectElementId,
  onOpenPropertiesTab,
  onDropAsset,
  playbackSpeed = 1,
  onSpeedChange,
  onSetSceneSpeed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // FreeCut Editor Tool & Zoom Settings
  const [activeTool, setActiveTool] = useState<FreeCutTool>("select");
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(36); // px per second
  const [scrollLeft, setScrollLeft] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  // Selection state
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([
    activeSceneId,
  ]);

  // Dragging & Trimming interactions
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragInitialStart, setDragInitialStart] = useState<number>(0);

  const [trimmingId, setTrimmingId] = useState<string | null>(null);
  const [trimEdge, setTrimEdge] = useState<"left" | "right">("right");
  const [trimStartX, setTrimStartX] = useState<number>(0);
  const [trimInitialStart, setTrimInitialStart] = useState<number>(0);
  const [trimInitialDuration, setTrimInitialDuration] = useState<number>(0);

  // Active snap guide line (X position in px)
  const [snapGuideX, setSnapGuideX] = useState<number | null>(null);

  // History stack for Undo/Redo
  const [history, setHistory] = useState<FreeCutHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Local tracks state derived from Ollastar scenes
  const [tracks, setTracks] = useState<FreeCutTrackType[]>(() =>
    adaptOllastarToFreeCut(scenes, [], DEFAULT_FPS),
  );

  // Re-synchronize when scenes prop changes externally
  useEffect(() => {
    setTracks((prev) => {
      const freshTracks = adaptOllastarToFreeCut(scenes, [], DEFAULT_FPS);
      // Preserve track lock, mute, visibility settings
      return freshTracks.map((fresh) => {
        const existing = prev.find((p) => p.id === fresh.id);
        if (existing) {
          return {
            ...fresh,
            locked: existing.locked,
            visible: existing.visible,
            muted: existing.muted,
          };
        }
        return fresh;
      });
    });
  }, [scenes]);

  // Keep selected clip synced with activeSceneId or selectedElementId
  useEffect(() => {
    if (selectedElementId) {
      setSelectedItemIds([selectedElementId]);
    } else if (activeSceneId) {
      setSelectedItemIds([activeSceneId]);
    }
  }, [activeSceneId, selectedElementId]);

  // Measure container width for ruler and timeline rendering
  useEffect(() => {
    const updateSize = () => {
      if (scrollContainerRef.current) {
        setContainerWidth(scrollContainerRef.current.clientWidth);
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Compute snap candidates (clip start & end times, playhead)
  const snapCandidates = useMemo(() => {
    const candidates = new Set<number>([0, currentTime]);
    tracks.forEach((tr) => {
      tr.items.forEach((it) => {
        candidates.add(it.startSec);
        candidates.add(it.startSec + it.durationSec);
      });
    });
    return Array.from(candidates);
  }, [tracks, currentTime]);

  // Push state to Undo History
  const pushHistory = useCallback(
    (description: string, newTracks: FreeCutTrackType[]) => {
      setHistory((prev) => {
        const upToCurrent = prev.slice(0, historyIndex + 1);
        return [
          ...upToCurrent,
          {
            description,
            timestamp: Date.now(),
            tracks: newTracks,
            durationSec: duration,
          },
        ];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex, duration],
  );

  // Clip selection
  const handleSelectClip = useCallback(
    (clipId: string, e: React.MouseEvent | React.PointerEvent) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        setSelectedItemIds((prev) =>
          prev.includes(clipId)
            ? prev.filter((id) => id !== clipId)
            : [...prev, clipId],
        );
      } else {
        setSelectedItemIds([clipId]);
      }

      // Check if this is a scene
      const sceneFound = scenes.find((s) => s.id === clipId);
      if (sceneFound) {
        onSelectScene(clipId);
        if (onSelectElementId) onSelectElementId(null);
      } else if (onSelectElementId) {
        onSelectElementId(clipId);
      }
    },
    [scenes, onSelectScene, onSelectElementId],
  );

  // Start clip dragging (moving)
  const handleStartMoveClip = useCallback(
    (clipId: string, clientX: number, itemStartSec: number) => {
      setDraggingId(clipId);
      setDragStartX(clientX);
      setDragInitialStart(itemStartSec);
    },
    [],
  );

  // Start clip trimming
  const handleStartTrimClip = useCallback(
    (
      clipId: string,
      edge: "left" | "right",
      clientX: number,
      startSec: number,
      durationSec: number,
    ) => {
      setTrimmingId(clipId);
      setTrimEdge(edge);
      setTrimStartX(clientX);
      setTrimInitialStart(startSec);
      setTrimInitialDuration(durationSec);
    },
    [],
  );

  // Global PointerMove handler for clip drag and trim gestures
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // 1. Moving a clip
      if (draggingId) {
        const deltaX = e.clientX - dragStartX;
        const deltaSec = deltaX / zoom;
        let newStartSec = Math.max(0, dragInitialStart + deltaSec);

        if (snapEnabled) {
          const snap = findSnapPoint(newStartSec, snapCandidates, zoom);
          if (snap.didSnap) {
            newStartSec = snap.snappedTimeSec;
            setSnapGuideX(snap.snapGuideX);
          } else {
            setSnapGuideX(null);
          }
        }

        setTracks((prev) =>
          prev.map((tr) => ({
            ...tr,
            items: tr.items.map((it) =>
              it.id === draggingId
                ? {
                    ...it,
                    startSec: Number(newStartSec.toFixed(3)),
                    from: Math.round(newStartSec * DEFAULT_FPS),
                  }
                : it,
            ),
          })),
        );
      }

      // 2. Trimming a clip
      if (trimmingId) {
        const deltaX = e.clientX - trimStartX;
        const deltaSec = deltaX / zoom;

        if (trimEdge === "right") {
          let newDurationSec = Math.max(0.3, trimInitialDuration + deltaSec);
          const targetEnd = trimInitialStart + newDurationSec;

          if (snapEnabled) {
            const snap = findSnapPoint(targetEnd, snapCandidates, zoom);
            if (snap.didSnap) {
              newDurationSec = Math.max(
                0.3,
                snap.snappedTimeSec - trimInitialStart,
              );
              setSnapGuideX(snap.snapGuideX);
            } else {
              setSnapGuideX(null);
            }
          }

          setTracks((prev) =>
            prev.map((tr) => ({
              ...tr,
              items: tr.items.map((it) =>
                it.id === trimmingId
                  ? {
                      ...it,
                      durationSec: Number(newDurationSec.toFixed(3)),
                      durationInFrames: Math.round(
                        newDurationSec * DEFAULT_FPS,
                      ),
                    }
                  : it,
              ),
            })),
          );
        } else {
          // Trimming left edge
          let newStartSec = Math.max(0, trimInitialStart + deltaSec);
          let newDurationSec = Math.max(
            0.3,
            trimInitialDuration - (newStartSec - trimInitialStart),
          );

          if (snapEnabled) {
            const snap = findSnapPoint(newStartSec, snapCandidates, zoom);
            if (snap.didSnap) {
              newStartSec = snap.snappedTimeSec;
              newDurationSec = Math.max(
                0.3,
                trimInitialDuration - (newStartSec - trimInitialStart),
              );
              setSnapGuideX(snap.snapGuideX);
            } else {
              setSnapGuideX(null);
            }
          }

          setTracks((prev) =>
            prev.map((tr) => ({
              ...tr,
              items: tr.items.map((it) =>
                it.id === trimmingId
                  ? {
                      ...it,
                      startSec: Number(newStartSec.toFixed(3)),
                      from: Math.round(newStartSec * DEFAULT_FPS),
                      durationSec: Number(newDurationSec.toFixed(3)),
                      durationInFrames: Math.round(
                        newDurationSec * DEFAULT_FPS,
                      ),
                    }
                  : it,
              ),
            })),
          );
        }
      }
    };

    const handlePointerUp = () => {
      if (draggingId || trimmingId) {
        setSnapGuideX(null);

        // Sync final positions back to Ollastar model
        setTracks((currentTracks) => {
          const sceneTrack = currentTracks.find(
            (tr) => tr.id === "track-scenes",
          );
          if (sceneTrack && onUpdateScenes) {
            const updatedScenes = adaptFreeCutToOllastarScenes(
              sceneTrack.items,
              scenes,
              DEFAULT_FPS,
            );
            onUpdateScenes(() => updatedScenes);

            // Update project duration if scenes extend beyond
            const maxEnd = updatedScenes.reduce(
              (m, s) => Math.max(m, s.start + s.duration),
              0,
            );
            if (onUpdateDuration && maxEnd > duration) {
              onUpdateDuration(Math.ceil(maxEnd));
            }
          }
          pushHistory("Edit Clip", currentTracks);
          return currentTracks;
        });

        setDraggingId(null);
        setTrimmingId(null);
      }
    };

    if (draggingId || trimmingId) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    draggingId,
    trimmingId,
    dragStartX,
    dragInitialStart,
    trimStartX,
    trimInitialStart,
    trimInitialDuration,
    trimEdge,
    zoom,
    snapEnabled,
    snapCandidates,
    scenes,
    onUpdateScenes,
    onUpdateDuration,
    duration,
    pushHistory,
  ]);

  // Split selected clip at playhead
  const handleSplitAtPlayhead = useCallback(() => {
    if (selectedItemIds.length === 0) {
      toast.info("Select a clip to split at playhead");
      return;
    }

    const targetId = selectedItemIds[0];
    const sceneToSplit = scenes.find((s) => s.id === targetId);

    if (sceneToSplit && onUpdateScenes) {
      const splitTime = currentTime;
      if (
        splitTime <= sceneToSplit.start ||
        splitTime >= sceneToSplit.start + sceneToSplit.duration
      ) {
        toast.error("Playhead must be inside the selected clip to split");
        return;
      }

      onUpdateScenes((prev) => {
        const idx = prev.findIndex((s) => s.id === targetId);
        if (idx === -1) return prev;

        const original = prev[idx];
        if (!original) return prev;

        const firstDuration = Number((splitTime - original.start).toFixed(2));
        const secondDuration = Number(
          (original.duration - firstDuration).toFixed(2),
        );

        const part1: CompositionScene = {
          ...original,
          id: original.id,
          file: original.file || "index.html",
          start: original.start,
          duration: firstDuration,
        };

        const newSceneNum = prev.length + 1;
        const part2: CompositionScene = {
          ...original,
          id: `scene_${String(newSceneNum).padStart(2, "0")}`,
          name: `${original.name || "Scene"} (Part 2)`,
          file: original.file || "index.html",
          start: splitTime,
          duration: secondDuration,
          mediaOffset: (original.mediaOffset ?? original.start) + firstDuration,
        };

        const next = [...prev];
        next.splice(idx, 1, part1, part2);
        toast.success(
          `Split ${original.name || "clip"} at ${splitTime.toFixed(1)}s`,
        );
        return next;
      });
    }
  }, [selectedItemIds, scenes, currentTime, onUpdateScenes]);

  // Duplicate selected clip
  const handleDuplicateSelected = useCallback(() => {
    if (selectedItemIds.length === 0) return;
    const targetId = selectedItemIds[0];
    const targetScene = scenes.find((s) => s.id === targetId);

    if (targetScene && onUpdateScenes) {
      onUpdateScenes((prev) => {
        let maxEnd = 0;
        for (const s of prev) {
          maxEnd = Math.max(maxEnd, s.start + s.duration);
        }

        const newNum = prev.length + 1;
        const dup: CompositionScene = {
          ...targetScene,
          id: `scene_${String(newNum).padStart(2, "0")}`,
          name: `${targetScene.name || "Scene"} (Copy)`,
          start: maxEnd,
        };

        toast.success(`Duplicated ${targetScene.name || "scene"}`);
        return [...prev, dup];
      });
    }
  }, [selectedItemIds, scenes, onUpdateScenes]);

  // Delete selected clip
  const handleDeleteSelected = useCallback(() => {
    if (selectedItemIds.length === 0) return;
    if (scenes.length <= 1) {
      toast.error("Cannot delete the only scene in the composition");
      return;
    }

    const deleteIds = new Set(selectedItemIds);
    if (onUpdateScenes) {
      onUpdateScenes((prev) => {
        const remaining = prev.filter((s) => !deleteIds.has(s.id));
        toast.success("Deleted selected clip(s)");
        return remaining;
      });
      setSelectedItemIds([]);
    }
  }, [selectedItemIds, scenes, onUpdateScenes]);

  // Adjust scene playback speed
  const handleSetClipSpeed = useCallback(
    (clipId: string, speedMultiplier: number) => {
      if (onSetSceneSpeed) {
        onSetSceneSpeed(clipId, speedMultiplier);
      } else if (onUpdateScenes) {
        onUpdateScenes((prev) =>
          prev.map((s) =>
            s.id === clipId ? { ...s, speed: speedMultiplier } : s,
          ),
        );
      }
      toast.success(`Set speed to ${speedMultiplier}x`);
    },
    [onSetSceneSpeed, onUpdateScenes],
  );

  // Zoom to fit entire project into current timeline width
  const handleZoomToFit = useCallback(() => {
    const totalContentSec = Math.max(
      duration,
      scenes.reduce((m, s) => Math.max(m, s.start + s.duration), 0),
      5,
    );
    const availableWidth = containerWidth - 220; // minus track headers
    const calculatedZoom = Math.max(
      12,
      Math.min(100, availableWidth / totalContentSec),
    );
    setZoom(Math.round(calculatedZoom));
  }, [duration, scenes, containerWidth]);

  // Timeline Markers state & handlers
  const [markers, setMarkers] = useState<number[]>([]);

  const handleAddMarker = useCallback(() => {
    const rounded = Math.round(currentTime * 100) / 100;
    setMarkers((prev) => {
      if (prev.includes(rounded)) {
        toast.info(`Marker already exists at ${rounded.toFixed(2)}s`);
        return prev;
      }
      const next = [...prev, rounded].sort((a, b) => a - b);
      toast.success(`Flagged timeline marker at ${rounded.toFixed(2)}s`);
      return next;
    });
  }, [currentTime]);

  const handleClearMarkers = useCallback(() => {
    setMarkers([]);
    toast.success("Cleared all timeline markers");
  }, []);

  // Ripple close gaps between scenes
  const handleCloseGaps = useCallback(() => {
    if (!onUpdateScenes) return;
    onUpdateScenes((prev) => {
      let cursor = 0;
      const sorted = [...prev].sort((a, b) => a.start - b.start);
      const closed = sorted.map((s) => {
        const updated = { ...s, start: cursor };
        cursor += s.duration;
        return updated;
      });
      toast.success("Closed timeline gaps (ripple delete)");
      return closed;
    });
  }, [onUpdateScenes]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevEntry = history[historyIndex - 1];
      if (prevEntry?.scenes && onUpdateScenes) {
        onUpdateScenes(() => prevEntry.scenes!);
        setHistoryIndex(historyIndex - 1);
        toast.info(`Undo: ${prevEntry.description}`);
      }
    }
  }, [history, historyIndex, onUpdateScenes]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextEntry = history[historyIndex + 1];
      if (nextEntry?.scenes && onUpdateScenes) {
        onUpdateScenes(() => nextEntry.scenes!);
        setHistoryIndex(historyIndex + 1);
        toast.info(`Redo: ${nextEntry.description}`);
      }
    }
  }, [history, historyIndex, onUpdateScenes]);

  // Keyboard navigation and shortcuts (NLE standard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) return;

      // Space: Play / Pause
      if (e.code === "Space") {
        e.preventDefault();
        onPlayPauseToggle();
      }

      // C: Razor tool or Split at playhead
      if (e.key === "c" || e.key === "C") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleSplitAtPlayhead();
        } else {
          setActiveTool((prev) => (prev === "split" ? "select" : "split"));
        }
      }

      // V: Pointer / Select tool
      if (e.key === "v" || e.key === "V") {
        setActiveTool("select");
      }

      // H: Hand tool
      if (e.key === "h" || e.key === "H") {
        setActiveTool("hand");
      }

      // S: Toggle Snap
      if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey) {
        setSnapEnabled((prev) => !prev);
        toast.info(snapEnabled ? "Snapping disabled" : "Snapping enabled");
      }

      // Backspace / Delete: Delete selected clip
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
      }

      // Cmd+D: Duplicate selected
      if ((e.key === "d" || e.key === "D") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleDuplicateSelected();
      }

      // Left / Right arrow navigation
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 1 / DEFAULT_FPS;
        onTimeChange(Math.max(0, currentTime - step));
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 1 / DEFAULT_FPS;
        onTimeChange(Math.min(duration, currentTime + step));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onPlayPauseToggle,
    handleSplitAtPlayhead,
    handleDuplicateSelected,
    handleDeleteSelected,
    snapEnabled,
    currentTime,
    duration,
    onTimeChange,
  ]);

  const timelineCanvasHeight = tracks.reduce((h, tr) => h + tr.height, 0);

  return (
    <div
      ref={containerRef}
      className="h-72 w-full bg-[#0d1017] border-t border-[#222736] flex flex-col select-none overflow-hidden text-gray-200 shrink-0 shadow-2xl freecut-timeline-root"
    >
      {/* 1. FreeCut Timeline Top Header Bar */}
      <FreeCutTimelineHeader
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        isPlaying={isPlaying}
        onPlayPauseToggle={onPlayPauseToggle}
        currentTimeSec={currentTime}
        totalDurationSec={duration}
        fps={DEFAULT_FPS}
        zoom={zoom}
        onZoomChange={setZoom}
        onZoomToFit={handleZoomToFit}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled((prev) => !prev)}
        onSplitAtPlayhead={handleSplitAtPlayhead}
        onDeleteSelected={handleDeleteSelected}
        onDuplicateSelected={handleDuplicateSelected}
        onAddScene={onAddScene || (() => {})}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        markers={markers}
        onAddMarker={handleAddMarker}
        onClearMarkers={handleClearMarkers}
        onCloseGaps={handleCloseGaps}
        hasSelectedClips={selectedItemIds.length > 0}
        playbackSpeed={playbackSpeed}
        onSpeedChange={onSpeedChange || (() => {})}
        onSeek={onTimeChange}
      />

      {/* 2. Main Timeline Body (Track Headers on Left, Canvas on Right) */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Left Column: Fixed Track Headers */}
        <div className="w-48 shrink-0 flex flex-col bg-[#11141c] border-r border-[#222736] z-10 shadow-md">
          {/* Header spacer to match ruler height */}
          <div className="h-7 bg-[#0c0f16] border-b border-[#222736] px-3 flex items-center justify-between text-[10px] font-mono font-semibold text-gray-400">
            <span>TRACKS</span>
            <span className="text-gray-500">{tracks.length}</span>
          </div>

          {/* Vertical Track Headers */}
          <div className="flex-1 overflow-hidden">
            {tracks.map((tr) => (
              <FreeCutTrackHeader
                key={tr.id}
                track={tr}
                onToggleLock={(id) =>
                  setTracks((prev) =>
                    prev.map((t) =>
                      t.id === id ? { ...t, locked: !t.locked } : t,
                    ),
                  )
                }
                onToggleVisibility={(id) =>
                  setTracks((prev) =>
                    prev.map((t) =>
                      t.id === id ? { ...t, visible: !t.visible } : t,
                    ),
                  )
                }
                onToggleMute={(id) =>
                  setTracks((prev) =>
                    prev.map((t) =>
                      t.id === id ? { ...t, muted: !t.muted } : t,
                    ),
                  )
                }
              />
            ))}
          </div>
        </div>

        {/* Right Column: Scrollable Ruler & Track Lanes */}
        <div
          ref={scrollContainerRef}
          onScroll={(e) => setScrollLeft((e.target as HTMLElement).scrollLeft)}
          className={`flex-1 overflow-x-auto overflow-y-auto relative bg-[#090b10] freecut-timeline-canvas ${
            activeTool === "split"
              ? "fc-cursor-scissors"
              : activeTool === "hand"
                ? "fc-cursor-grab"
                : ""
          }`}
        >
          {/* Top Time Ruler */}
          <FreeCutTimeRuler
            totalDurationSec={duration}
            currentTimeSec={currentTime}
            zoom={zoom}
            fps={DEFAULT_FPS}
            onSeek={onTimeChange}
            scrollLeft={scrollLeft}
            containerWidth={containerWidth}
            markers={markers}
            onAddMarker={(t) => {
              setMarkers((prev) => [...prev, Math.round(t * 100) / 100].sort((a, b) => a - b));
            }}
          />

          {/* Interactive Playhead Needle */}
          <FreeCutPlayhead
            currentTimeSec={currentTime}
            zoom={zoom}
            totalDurationSec={duration}
            onSeek={onTimeChange}
            timelineHeight={timelineCanvasHeight + 28}
          />

          {/* Magnetic Snap Guide Line */}
          {snapGuideX !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)] pointer-events-none z-20"
              style={{ left: `${snapGuideX}px` }}
            />
          )}

          {/* Multitrack Rows */}
          <div className="relative">
            {tracks.map((tr) => (
              <FreeCutTimelineTrack
                key={tr.id}
                track={tr}
                zoom={zoom}
                totalDurationSec={duration}
                selectedItemIds={selectedItemIds}
                activeTool={activeTool}
                onSelectClip={handleSelectClip}
                onStartMoveClip={handleStartMoveClip}
                onStartTrimClip={handleStartTrimClip}
                onSplitClip={() => handleSplitAtPlayhead()}
                onDeleteClip={() => handleDeleteSelected()}
                onDuplicateClip={() => handleDuplicateSelected()}
                onSetClipSpeed={handleSetClipSpeed}
                onDropAsset={onDropAsset}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

"use client";

import {
  BetweenHorizontalEnd,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flag,
  FlagOff,
  Gauge,
  Hand,
  Magnet,
  Maximize2,
  Pause,
  Play,
  Plus,
  Pointer,
  RotateCcw,
  RotateCw,
  Scissors,
  Sliders,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type React from "react";
import { formatClockTime, formatSMPTETimecode } from "../freecut-adapter";
import type { FreeCutTool } from "../types";
import { AudioMasterMeter } from "./audio-master-meter";

interface FreeCutTimelineHeaderProps {
  activeTool: FreeCutTool;
  onSelectTool: (tool: FreeCutTool) => void;
  isPlaying: boolean;
  onPlayPauseToggle: () => void;
  currentTimeSec: number;
  totalDurationSec: number;
  fps: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onZoomToFit: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  onSplitAtPlayhead: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onAddScene: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  hasSelectedClips: boolean;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  onSeek: (timeSec: number) => void;
  markers?: number[];
  onAddMarker?: () => void;
  onClearMarkers?: () => void;
  onCloseGaps?: () => void;
}

export const FreeCutTimelineHeader: React.FC<FreeCutTimelineHeaderProps> = ({
  activeTool,
  onSelectTool,
  isPlaying,
  onPlayPauseToggle,
  currentTimeSec,
  totalDurationSec,
  fps,
  zoom,
  onZoomChange,
  onZoomToFit,
  snapEnabled,
  onToggleSnap,
  onSplitAtPlayhead,
  onDeleteSelected,
  onDuplicateSelected,
  onAddScene,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  hasSelectedClips,
  playbackSpeed,
  onSpeedChange,
  onSeek,
  markers = [],
  onAddMarker,
  onClearMarkers,
  onCloseGaps,
}) => {
  return (
    <div className="h-10 px-3 bg-[#11141c] border-b border-[#242b3d] flex items-center justify-between text-xs text-gray-300 select-none z-20 shrink-0 gap-2">
      {/* Left: FreeCut Core Editing Tools & Track Modifiers */}
      <div className="flex items-center gap-1 min-w-0">
        {/* Selection Tool (V) */}
        <button
          type="button"
          onClick={() => onSelectTool("select")}
          className={`h-7 px-2 rounded flex items-center gap-1.5 transition text-[11px] font-medium ${
            activeTool === "select"
              ? "bg-purple-600/30 text-purple-300 border border-purple-500/50"
              : "hover:bg-[#1f2637] text-gray-400 hover:text-gray-200"
          }`}
          title="Selection Tool (V)"
        >
          <Pointer className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Select</span>
        </button>

        {/* Razor / Split Tool (C) */}
        <button
          type="button"
          onClick={() => onSelectTool("split")}
          className={`h-7 px-2 rounded flex items-center gap-1.5 transition text-[11px] font-medium ${
            activeTool === "split"
              ? "bg-amber-600/30 text-amber-300 border border-amber-500/50"
              : "hover:bg-[#1f2637] text-gray-400 hover:text-gray-200"
          }`}
          title="Razor / Cut Tool (C)"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cut</span>
        </button>

        {/* Hand / Pan Tool (H) */}
        <button
          type="button"
          onClick={() => onSelectTool("hand")}
          className={`h-7 px-2 rounded flex items-center gap-1.5 transition text-[11px] font-medium ${
            activeTool === "hand"
              ? "bg-blue-600/30 text-blue-300 border border-blue-500/50"
              : "hover:bg-[#1f2637] text-gray-400 hover:text-gray-200"
          }`}
          title="Hand Tool / Pan (H)"
        >
          <Hand className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-[#262f44] mx-0.5" />

        {/* Split at Playhead */}
        <button
          type="button"
          onClick={onSplitAtPlayhead}
          className="h-7 px-2 rounded hover:bg-[#1f2637] text-gray-300 hover:text-white flex items-center gap-1 text-[11px] font-medium transition"
          title="Split Selected Clip at Playhead (Ctrl+B / C)"
        >
          <Scissors className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Split</span>
        </button>

        {/* Duplicate Clip */}
        <button
          type="button"
          onClick={onDuplicateSelected}
          disabled={!hasSelectedClips}
          className="h-7 px-2 rounded hover:bg-[#1f2637] text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1 text-[11px] font-medium transition"
          title="Duplicate Selected Clip (Cmd+D)"
        >
          <Copy className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden lg:inline">Duplicate</span>
        </button>

        {/* Delete Clip */}
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={!hasSelectedClips}
          className="h-7 px-2 rounded hover:bg-rose-950/40 text-gray-400 hover:text-rose-300 disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1 text-[11px] font-medium transition"
          title="Delete Clip (Backspace / Delete)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Snapping Magnet */}
        <button
          type="button"
          onClick={onToggleSnap}
          className={`h-7 px-2 rounded flex items-center gap-1 text-[11px] font-medium transition ${
            snapEnabled
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
              : "hover:bg-[#1f2637] text-gray-500"
          }`}
          title={snapEnabled ? "Snapping Enabled (S)" : "Snapping Disabled (S)"}
        >
          <Magnet className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Snap</span>
        </button>

        {/* Add Marker / Flag */}
        {onAddMarker && (
          <button
            type="button"
            onClick={onAddMarker}
            className="h-7 px-2 rounded hover:bg-[#1f2637] text-gray-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] font-medium transition"
            title="Add Marker at Playhead (M)"
          >
            <Flag className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xl:inline">Marker</span>
          </button>
        )}

        {/* Ripple / Close Gaps */}
        {onCloseGaps && (
          <button
            type="button"
            onClick={onCloseGaps}
            className="h-7 px-2 rounded hover:bg-[#1f2637] text-gray-400 hover:text-indigo-300 flex items-center gap-1 text-[11px] font-medium transition"
            title="Close All Gaps on Track (Ripple)"
          >
            <BetweenHorizontalEnd className="w-3.5 h-3.5 text-indigo-400" />
          </button>
        )}

        <div className="h-4 w-px bg-[#262f44] mx-0.5" />

        {/* Undo / Redo */}
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="h-7 w-7 rounded hover:bg-[#1f2637] text-gray-400 hover:text-gray-200 disabled:opacity-30 flex items-center justify-center transition"
            title="Undo (Cmd+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        {onRedo && (
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="h-7 w-7 rounded hover:bg-[#1f2637] text-gray-400 hover:text-gray-200 disabled:opacity-30 flex items-center justify-center transition"
            title="Redo (Cmd+Shift+Z)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Add Scene */}
        <button
          type="button"
          onClick={onAddScene}
          className="h-7 px-2.5 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 flex items-center gap-1 text-[11px] font-semibold transition ml-0.5"
          title="Add New HTML Scene Sequence (+)"
        >
          <Plus className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">Add Scene</span>
        </button>
      </div>

      {/* Center: Precision Playback Transport & SMPTE Timecode */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Step back 1 frame */}
        <button
          type="button"
          onClick={() => onSeek(Math.max(0, currentTimeSec - 1 / fps))}
          className="h-7 w-7 rounded hover:bg-[#1f2637] text-gray-400 hover:text-gray-200 flex items-center justify-center transition"
          title="Step Backward 1 Frame (Left Arrow)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Play / Pause Primary Button */}
        <button
          type="button"
          onClick={onPlayPauseToggle}
          className="h-7 px-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center gap-1.5 shadow-md shadow-purple-900/30 text-xs font-semibold transition"
          title="Play / Pause (Space)"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span>Play</span>
            </>
          )}
        </button>

        {/* Step forward 1 frame */}
        <button
          type="button"
          onClick={() =>
            onSeek(Math.min(totalDurationSec, currentTimeSec + 1 / fps))
          }
          className="h-7 w-7 rounded hover:bg-[#1f2637] text-gray-400 hover:text-gray-200 flex items-center justify-center transition"
          title="Step Forward 1 Frame (Right Arrow)"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* SMPTE Timecode Display */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0a0d14] border border-[#242b3d] font-mono text-[11px] text-gray-200">
          <span className="text-amber-400 font-semibold">
            {formatSMPTETimecode(currentTimeSec, fps)}
          </span>
          <span className="text-gray-600">/</span>
          <span className="text-gray-400">
            {formatSMPTETimecode(totalDurationSec, fps)}
          </span>
        </div>

        {/* Playback Speed Multiplier */}
        <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#181d2a] border border-[#262f44] text-[10px]">
          <Gauge className="w-3 h-3 text-purple-400" />
          <select
            value={playbackSpeed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="bg-transparent text-gray-300 font-medium cursor-pointer focus:outline-none"
            title="Playback Speed"
          >
            <option value={0.5} className="bg-[#11141c]">
              0.5x
            </option>
            <option value={0.75} className="bg-[#11141c]">
              0.75x
            </option>
            <option value={1} className="bg-[#11141c]">
              1.0x
            </option>
            <option value={1.25} className="bg-[#11141c]">
              1.25x
            </option>
            <option value={1.5} className="bg-[#11141c]">
              1.5x
            </option>
            <option value={2} className="bg-[#11141c]">
              2.0x
            </option>
          </select>
        </div>
      </div>

      {/* Right: Audio Master Meter & Zoom Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Real Audio Master Level Meter (Component 9) */}
        <AudioMasterMeter isPlaying={isPlaying} />

        <div className="h-4 w-px bg-[#262f44]" />

        {/* Zoom Out Button */}
        <button
          type="button"
          onClick={() => onZoomChange(Math.max(12, zoom - 8))}
          className="h-6 w-6 rounded hover:bg-[#1f2637] text-gray-400 hover:text-gray-200 flex items-center justify-center transition"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-3 h-3" />
        </button>

        {/* Zoom Range Slider */}
        <input
          type="range"
          min={12}
          max={150}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="w-16 sm:w-20 md:w-24 h-1.5 bg-[#262f44] rounded-lg appearance-none cursor-pointer accent-purple-500"
          title={`Zoom: ${Math.round(zoom)} px/s`}
        />

        {/* Zoom In Button */}
        <button
          type="button"
          onClick={() => onZoomChange(Math.min(150, zoom + 8))}
          className="h-6 w-6 rounded hover:bg-[#1f2637] text-gray-400 hover:text-gray-200 flex items-center justify-center transition"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-3 h-3" />
        </button>

        {/* Zoom to fit Viewport */}
        <button
          type="button"
          onClick={onZoomToFit}
          className="h-6 px-1.5 rounded hover:bg-[#1f2637] text-gray-400 hover:text-gray-200 text-[10px] font-medium flex items-center gap-1 transition"
          title="Fit Timeline to Viewport (Shift+Z)"
        >
          <Maximize2 className="w-3 h-3" />
          <span className="hidden sm:inline">Fit</span>
        </button>
      </div>
    </div>
  );
};

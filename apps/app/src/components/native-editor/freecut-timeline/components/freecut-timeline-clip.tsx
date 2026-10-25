"use client";

import React, { useState, memo } from "react";
import {
  Copy,
  Film,
  Gauge,
  Image as ImageIcon,
  Layers,
  MoreVertical,
  Scissors,
  Sparkles,
  Trash2,
  Type,
  Volume2,
  VolumeX,
} from "lucide-react";
import { formatClockTime } from "../freecut-adapter";
import type { FreeCutTimelineItem, FreeCutTool } from "../types";

interface FreeCutTimelineClipProps {
  item: FreeCutTimelineItem;
  zoom: number; // px per second
  isSelected: boolean;
  activeTool: FreeCutTool;
  trackLocked: boolean;
  onSelect: (itemId: string, e: React.MouseEvent | React.PointerEvent) => void;
  onStartMove: (
    itemId: string,
    initialClientX: number,
    itemStartSec: number
  ) => void;
  onStartTrim: (
    itemId: string,
    edge: "left" | "right",
    initialClientX: number,
    startSec: number,
    durationSec: number
  ) => void;
  onSplitAtPlayhead?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
  onDuplicate?: (itemId: string) => void;
  onSetSpeed?: (itemId: string, speed: number) => void;
}

export const FreeCutTimelineClip: React.FC<FreeCutTimelineClipProps> = memo(
  function FreeCutTimelineClip({
    item,
    zoom,
    isSelected,
    activeTool,
    trackLocked,
    onSelect,
    onStartMove,
    onStartTrim,
    onSplitAtPlayhead,
    onDelete,
    onDuplicate,
    onSetSpeed,
  }) {
    const [contextMenuOpen, setContextMenuOpen] = useState(false);
    const [contextPos, setContextPos] = useState({ x: 0, y: 0 });

    const clipLeft = item.startSec * zoom;
    const clipWidth = Math.max(18, item.durationSec * zoom);

    const getItemStyles = () => {
      switch (item.type) {
        case "scene":
          return {
            bg: "bg-[#0f172a]/90",
            border: isSelected
              ? "border-orange-400 ring-2 ring-orange-400/40"
              : "border-blue-500/40 hover:border-blue-400",
            accent: "bg-blue-600",
            text: "text-blue-100",
            icon: <Film className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
          };
        case "video":
          return {
            bg: "bg-[#1e1035]/90",
            border: isSelected
              ? "border-orange-400 ring-2 ring-orange-400/40"
              : "border-purple-500/40 hover:border-purple-400",
            accent: "bg-purple-600",
            text: "text-purple-100",
            icon: <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />,
          };
        case "audio":
          return {
            bg: "bg-[#062419]/90",
            border: isSelected
              ? "border-orange-400 ring-2 ring-orange-400/40"
              : "border-emerald-500/40 hover:border-emerald-400",
            accent: "bg-emerald-600",
            text: "text-emerald-100",
            icon: <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
          };
        case "text":
          return {
            bg: "bg-[#27101f]/90",
            border: isSelected
              ? "border-orange-400 ring-2 ring-orange-400/40"
              : "border-pink-500/40 hover:border-pink-400",
            accent: "bg-pink-600",
            text: "text-pink-100",
            icon: <Type className="w-3.5 h-3.5 text-pink-400 shrink-0" />,
          };
        default:
          return {
            bg: "bg-[#0c2333]/90",
            border: isSelected
              ? "border-orange-400 ring-2 ring-orange-400/40"
              : "border-cyan-500/40 hover:border-cyan-400",
            accent: "bg-cyan-600",
            text: "text-cyan-100",
            icon: <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />,
          };
      }
    };

    const styling = getItemStyles();

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (trackLocked) return;
      if (e.button !== 0) return;
      e.stopPropagation();

      onSelect(item.id, e);

      if (activeTool === "select" || activeTool === "hand") {
        onStartMove(item.id, e.clientX, item.startSec);
      }
    };

    const handleTrimLeft = (e: React.PointerEvent<HTMLDivElement>) => {
      if (trackLocked) return;
      e.stopPropagation();
      onSelect(item.id, e);
      onStartTrim(item.id, "left", e.clientX, item.startSec, item.durationSec);
    };

    const handleTrimRight = (e: React.PointerEvent<HTMLDivElement>) => {
      if (trackLocked) return;
      e.stopPropagation();
      onSelect(item.id, e);
      onStartTrim(item.id, "right", e.clientX, item.startSec, item.durationSec);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(item.id, e);
      setContextPos({ x: e.clientX, y: e.clientY });
      setContextMenuOpen(true);
    };

    // Synthesize SVG waveform bars for audio clips
    const renderWaveform = () => {
      const barCount = Math.max(8, Math.floor(clipWidth / 5));
      const bars = [];
      for (let i = 0; i < barCount; i++) {
        const heightPercent = 20 + Math.sin(i * 0.7) * 35 + Math.cos(i * 1.3) * 25;
        bars.push(
          <div
            key={i}
            className="w-0.5 bg-emerald-400/50 rounded-full"
            style={{ height: `${Math.max(15, Math.min(90, heightPercent))}%` }}
          />
        );
      }
      return (
        <div className="flex items-center justify-between w-full h-4 overflow-hidden px-1">
          {bars}
        </div>
      );
    };

    return (
      <>
        <div
          onPointerDown={handlePointerDown}
          onContextMenu={handleContextMenu}
          className={`absolute top-1 bottom-1 rounded-md border flex flex-col justify-between overflow-hidden cursor-pointer select-none transition-shadow shadow-xs ${
            styling.bg
          } ${styling.border} ${trackLocked ? "opacity-60 cursor-not-allowed" : ""}`}
          style={{
            left: `${clipLeft}px`,
            width: `${clipWidth}px`,
          }}
          title={`${item.label} (${item.durationSec.toFixed(1)}s)`}
        >
          {/* Top Header Strip inside Clip */}
          <div className="px-2 py-0.5 flex items-center justify-between text-xs overflow-hidden gap-1.5 border-b border-white/5 bg-black/20">
            <div className="flex items-center gap-1.5 min-w-0">
              {styling.icon}
              <span
                className={`font-semibold truncate text-[11px] ${styling.text}`}
              >
                {item.label}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0 font-mono text-[9px] text-gray-400">
              {item.speed && item.speed !== 1 && (
                <span className="px-1 rounded bg-purple-500/20 text-purple-300 font-bold">
                  {item.speed}x
                </span>
              )}
              <span>{item.durationSec.toFixed(1)}s</span>
            </div>
          </div>

          {/* Clip Body Preview (Waveform for audio, headline for scene, filmstrip for video) */}
          <div className="px-2 py-0.5 flex-1 flex items-center justify-between text-[10px] text-gray-400 truncate opacity-85 min-h-0 overflow-hidden">
            {item.type === "audio" ? (
              renderWaveform()
            ) : item.headline ? (
              <span className="truncate italic text-gray-300">
                "{item.headline}"
              </span>
            ) : item.thumbnailUrl ? (
              <div className="flex items-center gap-1.5 w-full">
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className="w-8 h-5 object-cover rounded-xs border border-white/10 shrink-0"
                />
                <span className="font-mono text-[9px] text-gray-400 truncate">
                  {item.file || item.label}
                </span>
              </div>
            ) : item.file ? (
              <span className="font-mono text-[9px] opacity-60 truncate">
                {item.file}
              </span>
            ) : null}
          </div>

          {/* Left Trim Handle */}
          {!trackLocked && (
            <div
              onPointerDown={handleTrimLeft}
              className="absolute left-0 top-0 bottom-0 w-2.5 hover:w-3.5 bg-white/0 hover:bg-white/20 cursor-ew-resize group flex items-center justify-center transition-all z-10"
              title="Trim In Point"
            >
              <div className="w-0.5 h-3 bg-white/40 rounded group-hover:bg-white" />
            </div>
          )}

          {/* Right Trim Handle */}
          {!trackLocked && (
            <div
              onPointerDown={handleTrimRight}
              className="absolute right-0 top-0 bottom-0 w-2.5 hover:w-3.5 bg-white/0 hover:bg-white/20 cursor-ew-resize group flex items-center justify-center transition-all z-10"
              title="Trim Out Point"
            >
              <div className="w-0.5 h-3 bg-white/40 rounded group-hover:bg-white" />
            </div>
          )}
        </div>

        {/* Right-Click Context Menu */}
        {contextMenuOpen && (
          <div
            role="menu"
            tabIndex={-1}
            className="fixed z-50 bg-[#161a26] border border-[#2b3348] rounded-lg shadow-2xl py-1 text-xs text-gray-200 min-w-[170px] animate-in fade-in zoom-in-95"
            style={{ top: `${contextPos.y}px`, left: `${contextPos.x}px` }}
            onClick={(e) => {
              e.stopPropagation();
              setContextMenuOpen(false);
            }}
          >
            <div className="px-3 py-1 font-semibold text-[10px] text-gray-400 uppercase tracking-wider border-b border-[#2b3348]">
              {item.label}
            </div>

            {onSplitAtPlayhead && (
              <button
                type="button"
                onClick={() => onSplitAtPlayhead(item.id)}
                className="w-full px-3 py-1.5 text-left hover:bg-[#252c40] flex items-center gap-2 text-amber-300"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Split at Playhead (C)</span>
              </button>
            )}

            {onDuplicate && (
              <button
                type="button"
                onClick={() => onDuplicate(item.id)}
                className="w-full px-3 py-1.5 text-left hover:bg-[#252c40] flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5 text-blue-400" />
                <span>Duplicate (Cmd+D)</span>
              </button>
            )}

            {onSetSpeed && (
              <div className="px-3 py-1.5 border-t border-[#2b3348] flex items-center justify-between text-[11px]">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-purple-400" /> Speed
                </span>
                <div className="flex gap-1">
                  {[0.5, 1, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => onSetSpeed(item.id, spd)}
                      className={`px-1 rounded text-[10px] font-mono ${
                        (item.speed || 1) === spd
                          ? "bg-purple-600 text-white font-bold"
                          : "bg-[#252c40] text-gray-300 hover:text-white"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="w-full px-3 py-1.5 text-left hover:bg-rose-950/60 text-rose-400 flex items-center gap-2 border-t border-[#2b3348]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Clip</span>
              </button>
            )}
          </div>
        )}
      </>
    );
  }
);

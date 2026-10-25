"use client";

import {
  Eye,
  EyeOff,
  Film,
  Layers,
  Lock,
  Radio,
  Type,
  Unlock,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import React, { memo } from "react";
import type { FreeCutTimelineTrack } from "../types";

interface FreeCutTrackHeaderProps {
  track: FreeCutTimelineTrack;
  onToggleLock: (trackId: string) => void;
  onToggleVisibility: (trackId: string) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo?: (trackId: string) => void;
}

export const FreeCutTrackHeader: React.FC<FreeCutTrackHeaderProps> = memo(
  function FreeCutTrackHeader({
    track,
    onToggleLock,
    onToggleVisibility,
    onToggleMute,
    onToggleSolo,
  }) {
    const getTrackIcon = () => {
      switch (track.kind) {
        case "scene":
          return <Film className="w-3.5 h-3.5 text-blue-400" />;
        case "video":
          return <Video className="w-3.5 h-3.5 text-purple-400" />;
        case "overlay":
          return <Layers className="w-3.5 h-3.5 text-purple-400" />;
        case "audio":
          return <Volume2 className="w-3.5 h-3.5 text-emerald-400" />;
        case "text":
          return <Type className="w-3.5 h-3.5 text-pink-400" />;
        default:
          return <Film className="w-3.5 h-3.5 text-gray-400" />;
      }
    };

    return (
      <div
        className={`w-48 shrink-0 px-2.5 py-1.5 border-b border-r border-[#222736] flex items-center justify-between select-none transition ${
          track.locked
            ? "bg-[#10131c] opacity-65"
            : "bg-[#141824] hover:bg-[#181d2c]"
        }`}
        style={{ height: `${track.height}px` }}
      >
        {/* Track Title and Kind Icon */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-[#1e2333] border border-white/5 shrink-0">
            {getTrackIcon()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-gray-200 truncate leading-tight">
              {track.name}
            </span>
            <span className="text-[9px] text-gray-500 font-mono leading-none">
              {track.items.length} {track.items.length === 1 ? "clip" : "clips"}
            </span>
          </div>
        </div>

        {/* Track Control Buttons (Mute, Solo, Lock, Visibility) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Solo Button */}
          {onToggleSolo && (
            <button
              type="button"
              onClick={() => onToggleSolo(track.id)}
              className={`px-1 py-0.5 rounded text-[9px] font-bold transition font-mono ${
                track.solo
                  ? "bg-amber-500 text-black shadow-xs"
                  : "text-gray-500 hover:text-gray-300 hover:bg-[#252c40]"
              }`}
              title={track.solo ? "Disable Solo" : "Solo Track (S)"}
            >
              S
            </button>
          )}

          {/* Audio Mute Button (Audio tracks) */}
          {track.kind === "audio" && (
            <button
              type="button"
              onClick={() => onToggleMute(track.id)}
              className={`p-1 rounded transition text-xs ${
                track.muted
                  ? "bg-rose-500/20 text-rose-400 font-bold"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#252c40]"
              }`}
              title={track.muted ? "Unmute Track (M)" : "Mute Track (M)"}
            >
              {track.muted ? (
                <VolumeX className="w-3 h-3 text-rose-400" />
              ) : (
                <Volume2 className="w-3 h-3 text-emerald-400" />
              )}
            </button>
          )}

          {/* Visibility / Disable Toggle Button */}
          <button
            type="button"
            onClick={() => onToggleVisibility(track.id)}
            className={`p-1 rounded transition text-xs ${
              !track.visible
                ? "bg-amber-500/20 text-amber-400"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#252c40]"
            }`}
            title={track.visible ? "Hide / Disable Track" : "Show Track"}
          >
            {track.visible ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3 text-amber-400" />
            )}
          </button>

          {/* Lock / Unlock Toggle Button */}
          <button
            type="button"
            onClick={() => onToggleLock(track.id)}
            className={`p-1 rounded transition text-xs ${
              track.locked
                ? "bg-rose-500/20 text-rose-400"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#252c40]"
            }`}
            title={track.locked ? "Unlock Track" : "Lock Track"}
          >
            {track.locked ? (
              <Lock className="w-3 h-3 text-rose-400" />
            ) : (
              <Unlock className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    );
  }
);

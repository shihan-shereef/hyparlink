"use client";

import type React from "react";
import { useState } from "react";
import type { AssetItem } from "../../types";
import type {
  FreeCutTool,
  FreeCutTimelineTrack as FreeCutTrackType,
} from "../types";
import { FreeCutTimelineClip } from "./freecut-timeline-clip";

interface FreeCutTimelineTrackProps {
  track: FreeCutTrackType;
  zoom: number; // px per sec
  totalDurationSec: number;
  selectedItemIds: string[];
  activeTool: FreeCutTool;
  onSelectClip: (
    clipId: string,
    e: React.MouseEvent | React.PointerEvent,
  ) => void;
  onStartMoveClip: (
    clipId: string,
    initialClientX: number,
    itemStartSec: number,
  ) => void;
  onStartTrimClip: (
    clipId: string,
    edge: "left" | "right",
    initialClientX: number,
    startSec: number,
    durationSec: number,
  ) => void;
  onSplitClip?: (clipId: string) => void;
  onDeleteClip?: (clipId: string) => void;
  onDuplicateClip?: (clipId: string) => void;
  onSetClipSpeed?: (clipId: string, speed: number) => void;
  onDropAsset?: (
    asset: AssetItem,
    targetTimeSec: number,
    trackType: "visual" | "audio" | "scene",
  ) => void;
}

export const FreeCutTimelineTrack: React.FC<FreeCutTimelineTrackProps> = ({
  track,
  zoom,
  totalDurationSec,
  selectedItemIds,
  activeTool,
  onSelectClip,
  onStartMoveClip,
  onStartTrimClip,
  onSplitClip,
  onDeleteClip,
  onDuplicateClip,
  onSetClipSpeed,
  onDropAsset,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const totalWidth = Math.max(totalDurationSec + 10, 30) * zoom;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetTimeSec = Math.max(0, clickX / zoom);

    try {
      const assetData =
        e.dataTransfer.getData("application/json") ||
        e.dataTransfer.getData("text/plain");
      if (assetData) {
        const parsed = JSON.parse(assetData);
        if (parsed && onDropAsset) {
          const kind =
            track.kind === "audio"
              ? "audio"
              : track.kind === "scene"
                ? "scene"
                : "visual";
          onDropAsset(parsed, targetTimeSec, kind);
        }
      }
    } catch (_) {}
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-b border-[#202534] select-none transition-colors ${
        track.locked
          ? "bg-[#0d1017] pointer-events-none"
          : isDragOver
            ? "bg-purple-950/20"
            : "bg-[#11141c]/80 hover:bg-[#141824]/60"
      }`}
      style={{
        height: `${track.height}px`,
        width: `${totalWidth}px`,
      }}
    >
      {/* Subtle track background grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2536_1px,transparent_1px)] bg-[size:100px_100%] pointer-events-none opacity-20" />

      {/* Render clips on this track */}
      {track.visible &&
        track.items.map((item) => (
          <FreeCutTimelineClip
            key={item.id}
            item={item}
            zoom={zoom}
            isSelected={selectedItemIds.includes(item.id)}
            activeTool={activeTool}
            trackLocked={track.locked}
            onSelect={onSelectClip}
            onStartMove={onStartMoveClip}
            onStartTrim={onStartTrimClip}
            onSplitAtPlayhead={onSplitClip}
            onDelete={onDeleteClip}
            onDuplicate={onDuplicateClip}
            onSetSpeed={onSetClipSpeed}
          />
        ))}
    </div>
  );
};

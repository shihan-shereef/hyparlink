"use client";

import React, { useRef, useState, memo } from "react";
import { formatSMPTETimecode } from "../freecut-adapter";

interface FreeCutPlayheadProps {
  currentTimeSec: number;
  zoom: number;
  totalDurationSec: number;
  fps?: number;
  onSeek: (timeSec: number) => void;
  timelineHeight: number;
}

export const FreeCutPlayhead: React.FC<FreeCutPlayheadProps> = memo(
  function FreeCutPlayhead({
    currentTimeSec,
    zoom,
    totalDurationSec,
    fps = 30,
    onSeek,
    timelineHeight,
  }) {
    const [isDragging, setIsDragging] = useState(false);
    const playheadX = currentTimeSec * zoom;

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const parentContainer = (e.target as HTMLElement).closest(
        ".freecut-timeline-canvas"
      );
      if (parentContainer) {
        const rect = parentContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const targetTime = Math.max(0, Math.min(totalDurationSec, clickX / zoom));
        onSeek(targetTime);
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDragging) {
        setIsDragging(false);
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    };

    return (
      <div
        className="absolute top-0 bottom-0 pointer-events-none z-30"
        style={{
          left: `${playheadX}px`,
          transform: "translateX(-50%)",
        }}
      >
        {/* Top Scrubber Cap & Diamond Handle (Interactive) */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="pointer-events-auto cursor-ew-resize relative flex flex-col items-center group -top-1"
          title={`Playhead: ${formatSMPTETimecode(currentTimeSec, fps)}`}
        >
          {/* FreeCut Playhead Badge / Marker */}
          <div className="w-3.5 h-4 bg-gradient-to-b from-amber-400 to-orange-500 rounded-t-sm shadow-md flex items-center justify-center transition-transform group-hover:scale-110">
            <div className="w-1 h-2 bg-white/90 rounded-full" />
          </div>
          {/* Pointy bottom triangle */}
          <div className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[7px] border-t-orange-500 -mt-0.5" />

          {/* Floating SMPTE timecode bubble on hover/drag */}
          <div className="absolute -top-6 px-1.5 py-0.5 rounded bg-orange-600 text-[9px] font-mono font-bold text-white shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-50 pointer-events-none border border-orange-400/40">
            {formatSMPTETimecode(currentTimeSec, fps)}
          </div>
        </div>

        {/* Vertical needle line spanning all tracks */}
        <div
          className="w-px bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)] pointer-events-none"
          style={{ height: `${timelineHeight}px` }}
        />
      </div>
    );
  }
);

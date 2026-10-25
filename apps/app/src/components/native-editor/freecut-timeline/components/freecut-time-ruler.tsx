"use client";

import React, { useCallback, useRef, useState, memo } from "react";
import { formatSMPTETimecode } from "../freecut-adapter";

interface FreeCutTimeRulerProps {
  totalDurationSec: number;
  currentTimeSec: number;
  zoom: number; // pixels per second
  fps: number;
  onSeek: (timeSec: number) => void;
  scrollLeft: number;
  containerWidth: number;
  markers?: number[];
  onAddMarker?: (timeSec: number) => void;
}

export const FreeCutTimeRuler: React.FC<FreeCutTimeRulerProps> = memo(
  function FreeCutTimeRuler({
    totalDurationSec,
    currentTimeSec,
    zoom,
    fps,
    onSeek,
    scrollLeft,
    containerWidth,
    markers = [],
    onAddMarker,
  }) {
    const rulerRef = useRef<HTMLDivElement>(null);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [hoverTimeSec, setHoverTimeSec] = useState<number | null>(null);

    // FreeCut tick interval algorithm based on zoom level
    const getTickInterval = () => {
      if (zoom >= 120) return { major: 1, minor: 1 / fps, labelFormat: "frames" };
      if (zoom >= 75) return { major: 1, minor: 0.2, labelFormat: "seconds" };
      if (zoom >= 40) return { major: 2, minor: 0.5, labelFormat: "seconds" };
      if (zoom >= 20) return { major: 5, minor: 1, labelFormat: "seconds" };
      return { major: 10, minor: 2, labelFormat: "seconds" };
    };

    const { major: majorInterval, minor: minorInterval } = getTickInterval();
    const maxTime = Math.max(totalDurationSec + 15, 30);
    const totalRulerWidth = maxTime * zoom;

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsScrubbing(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      if (rulerRef.current) {
        const rect = rulerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const targetTime = Math.max(0, Math.min(totalDurationSec, clickX / zoom));
        onSeek(targetTime);
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!rulerRef.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const t = Math.max(0, Math.min(maxTime, clickX / zoom));

      if (isScrubbing) {
        onSeek(Math.min(totalDurationSec, t));
      } else {
        setHoverTimeSec(t);
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (isScrubbing) {
        setIsScrubbing(false);
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    };

    const handlePointerLeave = () => {
      if (!isScrubbing) {
        setHoverTimeSec(null);
      }
    };

    // Viewport-culled ticks generation
    const startSec = Math.max(0, (scrollLeft - 100) / zoom);
    const endSec = Math.min(maxTime, (scrollLeft + containerWidth + 200) / zoom);

    const majorTicks: number[] = [];
    const firstMajor = Math.floor(startSec / majorInterval) * majorInterval;
    for (let t = firstMajor; t <= endSec; t += majorInterval) {
      if (t >= 0) majorTicks.push(t);
    }

    const minorTicks: number[] = [];
    const firstMinor = Math.floor(startSec / minorInterval) * minorInterval;
    for (let t = firstMinor; t <= endSec; t += minorInterval) {
      if (t >= 0 && Math.abs(t % majorInterval) > 0.01) {
        minorTicks.push(t);
      }
    }

    return (
      <div
        ref={rulerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="h-7 bg-[#0c0f16] border-b border-[#222736] relative cursor-pointer select-none overflow-hidden"
        style={{ width: `${totalRulerWidth}px` }}
      >
        {/* Minor Ticks */}
        {minorTicks.map((time) => {
          const x = time * zoom;
          return (
            <div
              key={`minor-${time.toFixed(3)}`}
              className="absolute bottom-0 w-px bg-[#262c3d]"
              style={{
                left: `${x}px`,
                height: "5px",
              }}
            />
          );
        })}

        {/* Major Ticks with Precision SMPTE Timecode Labels */}
        {majorTicks.map((time) => {
          const x = time * zoom;
          return (
            <div
              key={`major-${time}`}
              className="absolute bottom-0 pointer-events-none"
              style={{ left: `${x}px` }}
            >
              <div className="w-px h-3 bg-[#424d68]" />
              <span className="absolute -top-6 left-1 text-[9px] font-mono font-medium text-gray-400 select-none whitespace-nowrap">
                {formatSMPTETimecode(time, fps)}
              </span>
            </div>
          );
        })}

        {/* Marker Flags on Ruler */}
        {markers.map((mTime, idx) => {
          const mX = mTime * zoom;
          return (
            <div
              key={`marker-${idx}`}
              className="absolute top-0 w-2.5 h-full pointer-events-none z-20 flex flex-col items-center"
              style={{ left: `${mX - 5}px` }}
              title={`Marker: ${formatSMPTETimecode(mTime, fps)}`}
            >
              <div className="w-2.5 h-2.5 bg-cyan-400 rounded-xs shadow-sm flex items-center justify-center">
                <div className="w-1 h-1 bg-neutral-900 rounded-full" />
              </div>
              <div className="w-px flex-1 bg-cyan-400/60" />
            </div>
          );
        })}

        {/* Hover Time Indicator Needle */}
        {hoverTimeSec !== null && !isScrubbing && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-10"
            style={{ left: `${hoverTimeSec * zoom}px` }}
          >
            <div className="w-px h-full bg-purple-400/50" />
            <div className="absolute top-0.5 -left-7 px-1 py-0.2 bg-purple-900/90 text-purple-200 text-[8px] font-mono rounded border border-purple-500/40">
              {formatSMPTETimecode(hoverTimeSec, fps)}
            </div>
          </div>
        )}
      </div>
    );
  }
);

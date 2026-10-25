/**
 * FreeCut <-> Ollastar Composition Bidirectional Adapter
 * Translates between FreeCut's multitrack timeline model and Ollastar's HTML video scenes/clips.
 * MIT License - Walter Low / FreeCut
 */

import type { CompositionScene, TimelineClip } from "../types";
import type { FreeCutTimelineItem, FreeCutTimelineTrack } from "./types";

export const DEFAULT_FPS = 30;

/**
 * Convert seconds to frames based on project FPS
 */
export function secToFrame(sec: number, fps: number = DEFAULT_FPS): number {
  return Math.max(0, Math.round(sec * fps));
}

/**
 * Convert frames to seconds based on project FPS
 */
export function frameToSec(frame: number, fps: number = DEFAULT_FPS): number {
  return Math.max(0, Number((frame / fps).toFixed(3)));
}

/**
 * Format time in SMPTE format (HH:MM:SS:FF)
 */
export function formatSMPTETimecode(
  seconds: number,
  fps: number = DEFAULT_FPS,
): string {
  const totalFrames = Math.max(0, Math.floor(seconds * fps));
  const f = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

/**
 * Format time as MM:SS.d
 */
export function formatClockTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

/**
 * Convert Ollastar scenes and clips into FreeCut tracks and items
 */
export function adaptOllastarToFreeCut(
  scenes: CompositionScene[],
  visualClips: TimelineClip[] = [],
  fps: number = DEFAULT_FPS,
): FreeCutTimelineTrack[] {
  // 1. Primary Scene Track (HTML composition sequences)
  const sceneItems: FreeCutTimelineItem[] = (scenes || []).map((s, idx) => {
    const startSec = s.start ?? 0;
    const durationSec = Math.max(0.2, s.duration ?? 5);
    const from = secToFrame(startSec, fps);
    const durationInFrames = secToFrame(durationSec, fps);

    return {
      id: s.id,
      trackId: "track-scenes",
      type: "scene",
      label: s.name || `Scene ${idx + 1}`,
      from,
      durationInFrames,
      startSec,
      durationSec,
      file: s.file,
      mediaOffset: s.mediaOffset ?? (idx === 0 ? 0 : s.start),
      speed: (s as CompositionScene & { speed?: number }).speed ?? 1,
      sceneId: s.id,
      headline: s.headline,
      subtitle: s.subtitle,
      thumbnailUrl: s.thumbnail,
      color: "#3b82f6", // Royal blue
    };
  });

  // 2. Visual Overlays / Media Track (Images, Videos, Canvas overlays)
  const visualItems: FreeCutTimelineItem[] = (visualClips || [])
    .filter((c) => c.trackType !== "audio" && c.type !== "audio")
    .map((c) => {
      const startSec = c.start ?? 0;
      const durationSec = Math.max(0.2, c.duration ?? 3);
      const from = secToFrame(startSec, fps);
      const durationInFrames = secToFrame(durationSec, fps);

      return {
        id: c.id,
        trackId: "track-visuals",
        type:
          c.type === "video" ? "video" : c.type === "text" ? "text" : "image",
        label: c.name || "Visual Element",
        from,
        durationInFrames,
        startSec,
        durationSec,
        src:
          c.sourceUrl || (c as TimelineClip & { assetUrl?: string }).assetUrl,
        elementId: c.elementId,
        color:
          c.type === "video"
            ? "#8b5cf6"
            : c.type === "text"
              ? "#ec4899"
              : "#06b6d4",
      };
    });

  // 3. Audio Bed Track
  const audioItems: FreeCutTimelineItem[] = (visualClips || [])
    .filter((c) => c.trackType === "audio" || c.type === "audio")
    .map((c) => {
      const startSec = c.start ?? 0;
      const durationSec = Math.max(0.2, c.duration ?? 5);
      const from = secToFrame(startSec, fps);
      const durationInFrames = secToFrame(durationSec, fps);

      return {
        id: c.id,
        trackId: "track-audio",
        type: "audio",
        label: c.name || "Audio Track",
        from,
        durationInFrames,
        startSec,
        durationSec,
        src:
          c.sourceUrl || (c as TimelineClip & { assetUrl?: string }).assetUrl,
        color: "#10b981", // Emerald
      };
    });

  // Assemble full multitrack layout in FreeCut order
  const tracks: FreeCutTimelineTrack[] = [
    {
      id: "track-visuals",
      name: "V2 Overlays & Graphics",
      kind: "overlay",
      height: 48,
      order: 0,
      locked: false,
      visible: true,
      muted: false,
      solo: false,
      items: visualItems,
    },
    {
      id: "track-scenes",
      name: "V1 HTML Video Scenes",
      kind: "scene",
      height: 64,
      order: 1,
      locked: false,
      visible: true,
      muted: false,
      solo: false,
      items: sceneItems,
    },
    {
      id: "track-audio",
      name: "A1 Master Audio Bed",
      kind: "audio",
      height: 46,
      order: 2,
      locked: false,
      visible: true,
      muted: false,
      solo: false,
      items: audioItems,
    },
  ];

  return tracks;
}

/**
 * Convert updated FreeCut scene items back into Ollastar's CompositionScene[]
 */
export function adaptFreeCutToOllastarScenes(
  items: FreeCutTimelineItem[],
  previousScenes: CompositionScene[] = [],
  fps: number = DEFAULT_FPS,
): CompositionScene[] {
  const sceneItems = items.filter(
    (it) => it.trackId === "track-scenes" || it.type === "scene",
  );

  // Sort scenes chronologically by start frame
  const sorted = [...sceneItems].sort((a, b) => a.from - b.from);

  return sorted.map((it, idx) => {
    const existing = previousScenes.find((s) => s.id === it.id);
    const startSec = frameToSec(it.from, fps);
    const durationSec = frameToSec(it.durationInFrames, fps);

    return {
      ...(existing || {}),
      id: it.id,
      name: it.label || existing?.name || `Scene ${idx + 1}`,
      file:
        it.file ||
        existing?.file ||
        (idx === 0
          ? "index.html"
          : `compositions/scene_${String(idx + 1).padStart(2, "0")}.html`),
      start: startSec,
      duration: durationSec,
      mediaOffset:
        it.mediaOffset !== undefined
          ? it.mediaOffset
          : existing?.mediaOffset ?? startSec,
      speed:
        it.speed ??
        (existing as CompositionScene & { speed?: number })?.speed ??
        1,
      headline: it.headline || existing?.headline,
      subtitle: it.subtitle || existing?.subtitle,
      thumbnail: it.thumbnailUrl || existing?.thumbnail,
    };
  });
}

/**
 * Magnetic snap detector: finds closest snap point within threshold (pixels)
 */
export function findSnapPoint(
  targetTimeSec: number,
  snapCandidatesSec: number[],
  zoomPixelsPerSec: number,
  thresholdPixels = 10,
): { snappedTimeSec: number; didSnap: boolean; snapGuideX: number | null } {
  let closestPoint = targetTimeSec;
  let minDistancePx = Number.POSITIVE_INFINITY;

  for (const candidate of snapCandidatesSec) {
    const distancePx = Math.abs(candidate - targetTimeSec) * zoomPixelsPerSec;
    if (distancePx <= thresholdPixels && distancePx < minDistancePx) {
      minDistancePx = distancePx;
      closestPoint = candidate;
    }
  }

  const didSnap = minDistancePx <= thresholdPixels;
  const snapGuideX = didSnap ? closestPoint * zoomPixelsPerSec : null;

  return {
    snappedTimeSec: closestPoint,
    didSnap,
    snapGuideX,
  };
}

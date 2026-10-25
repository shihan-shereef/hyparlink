// Mathematical, transformation, and validation utilities for Professional Video Timeline Editing

import { TimelineClip, CompositionScene, TimelineKeyframe } from "./types";

/**
 * Convert time in seconds to horizontal pixel offset based on zoom scale.
 */
export function timeToPixel(time: number, zoomScale: number): number {
  return Math.max(0, time * zoomScale);
}

/**
 * Convert horizontal pixel offset to time in seconds based on zoom scale.
 */
export function pixelToTime(pixels: number, zoomScale: number): number {
  if (zoomScale <= 0) return 0;
  return Math.max(0, pixels / zoomScale);
}

/**
 * Format seconds into standard SMPTE / video timecode (MM:SS.f or MM:SS:FF)
 */
export function formatTimecode(seconds: number, fps: number = 30): string {
  const safeSeconds = Math.max(0, seconds || 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  const frames = Math.floor((safeSeconds % 1) * fps);

  const mm = mins.toString().padStart(2, "0");
  const ss = secs.toString().padStart(2, "0");
  const ff = frames.toString().padStart(2, "0");

  return `${mm}:${ss}:${ff}`;
}

/**
 * Format seconds into standard user-facing clock time (MM:SS.s)
 */
export function formatClockTime(seconds: number): string {
  const safeSeconds = Math.max(0, seconds || 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  const msTenth = Math.floor((safeSeconds % 1) * 10);

  const mm = mins.toString().padStart(2, "0");
  const ss = secs.toString().padStart(2, "0");

  return `${mm}:${ss}.${msTenth}`;
}

/**
 * Splits an eligible timeline clip into two distinct clips at the given splitTime.
 * Returns [leftClip, rightClip] or null if splitTime is outside valid clip range.
 */
export function splitClip(
  clip: TimelineClip,
  splitTime: number,
  minDuration: number = 0.15
): [TimelineClip, TimelineClip] | null {
  const clipStart = clip.start;
  const clipEnd = clip.start + clip.duration;

  // Split position must be strictly inside the clip boundaries respecting minDuration
  if (splitTime <= clipStart + minDuration || splitTime >= clipEnd - minDuration) {
    return null;
  }

  const leftDuration = Math.round((splitTime - clipStart) * 100) / 100;
  const rightDuration = Math.round((clipEnd - splitTime) * 100) / 100;

  if (leftDuration < minDuration || rightDuration < minDuration) {
    return null;
  }

  const currentOffset = (clip as any).mediaOffset !== undefined ? (clip as any).mediaOffset : ((clip as any).sourceIn || 0);
  const speed = (clip as any).speed || 1;

  const leftClip: TimelineClip = {
    ...clip,
    id: `${clip.id}_part1`,
    duration: leftDuration,
    name: `${clip.name} (Part 1)`,
    mediaOffset: currentOffset,
  };

  const rightClip: TimelineClip = {
    ...clip,
    id: `${clip.id}_part2_${Date.now().toString(36)}`,
    start: Math.round(splitTime * 100) / 100,
    duration: rightDuration,
    name: `${clip.name} (Part 2)`,
    mediaOffset: Math.round((currentOffset + leftDuration * speed) * 100) / 100,
  };

  return [leftClip, rightClip];
}

/**
 * Splits a scene into two scenes at the given splitTime.
 */
export function splitScene(
  scene: CompositionScene,
  splitTime: number,
  minDuration: number = 0.15
): [CompositionScene, CompositionScene] | null {
  const sceneStart = scene.start;
  const sceneEnd = scene.start + scene.duration;

  if (splitTime <= sceneStart + minDuration || splitTime >= sceneEnd - minDuration) {
    return null;
  }

  const leftDuration = Math.round((splitTime - sceneStart) * 100) / 100;
  const rightDuration = Math.round((sceneEnd - splitTime) * 100) / 100;

  if (leftDuration < minDuration || rightDuration < minDuration) {
    return null;
  }

  const currentOffset = scene.mediaOffset !== undefined ? scene.mediaOffset : sceneStart;
  const speed = (scene as any).speed || 1;

  const leftScene: CompositionScene = {
    ...scene,
    id: `${scene.id}_a`,
    name: `${scene.name || "Scene"} (Part 1)`,
    duration: leftDuration,
    mediaOffset: currentOffset,
  };

  const rightScene: CompositionScene = {
    ...scene,
    id: `${scene.id}_b_${Date.now().toString(36).slice(-4)}`,
    name: `${scene.name || "Scene"} (Part 2)`,
    start: Math.round(splitTime * 100) / 100,
    duration: rightDuration,
    mediaOffset: Math.round((currentOffset + leftDuration * speed) * 100) / 100,
  };

  return [leftScene, rightScene];
}

/**
 * Computes snapped start position for a clip being moved.
 */
export function moveClipWithSnapping(
  clip: TimelineClip,
  targetStart: number,
  allClips: TimelineClip[],
  playheadTime: number,
  snappingThreshold: number = 0.2, // seconds
  isSnappingEnabled: boolean = true
): { start: number; snappedGuide: number | null } {
  const boundedStart = Math.max(0, Math.round(targetStart * 100) / 100);

  if (!isSnappingEnabled) {
    return { start: boundedStart, snappedGuide: null };
  }

  const clipDuration = clip.duration;
  const targetEnd = boundedStart + clipDuration;

  // Potential snapping anchor targets: 0s, playhead, and edges of other clips
  const snapTargets: number[] = [0, playheadTime];

  allClips.forEach((other) => {
    if (other.id !== clip.id) {
      snapTargets.push(other.start);
      snapTargets.push(other.start + other.duration);
    }
  });

  let bestDelta = Infinity;
  let bestStart = boundedStart;
  let activeGuide: number | null = null;

  for (const target of snapTargets) {
    // 1. Check clip start aligning to snap target
    const deltaStart = Math.abs(boundedStart - target);
    if (deltaStart <= snappingThreshold && deltaStart < bestDelta) {
      bestDelta = deltaStart;
      bestStart = target;
      activeGuide = target;
    }

    // 2. Check clip end aligning to snap target
    const deltaEnd = Math.abs(targetEnd - target);
    if (deltaEnd <= snappingThreshold && deltaEnd < bestDelta) {
      bestDelta = deltaEnd;
      bestStart = Math.max(0, target - clipDuration);
      activeGuide = target;
    }
  }

  return {
    start: Math.round(bestStart * 100) / 100,
    snappedGuide: activeGuide,
  };
}

/**
 * Computes resized clip timing when dragging either the left or right trim handle.
 */
export function resizeClipWithSnapping(
  clip: TimelineClip,
  edge: "left" | "right",
  newEdgeTime: number,
  allClips: TimelineClip[],
  playheadTime: number,
  minDuration: number = 0.5,
  isSnappingEnabled: boolean = true,
  snappingThreshold: number = 0.2
): { start: number; duration: number; mediaOffset: number; snappedGuide: number | null } {
  let candidateTime = Math.max(0, newEdgeTime);
  let activeGuide: number | null = null;

  if (isSnappingEnabled) {
    const snapTargets: number[] = [0, playheadTime];
    allClips.forEach((other) => {
      if (other.id !== clip.id) {
        snapTargets.push(other.start);
        snapTargets.push(other.start + other.duration);
      }
    });

    let bestDelta = Infinity;
    for (const target of snapTargets) {
      const delta = Math.abs(candidateTime - target);
      if (delta <= snappingThreshold && delta < bestDelta) {
        bestDelta = delta;
        candidateTime = target;
        activeGuide = target;
      }
    }
  }

  candidateTime = Math.round(candidateTime * 100) / 100;
  const currentOffset = (clip as any).mediaOffset !== undefined ? (clip as any).mediaOffset : (clip.trackType === "scene" ? clip.start : 0);
  const speed = (clip as any).speed || 1;

  if (edge === "right") {
    // Adjust duration while keeping start and in-point fixed
    const newDuration = Math.max(minDuration, Math.round((candidateTime - clip.start) * 100) / 100);
    return {
      start: clip.start,
      duration: newDuration,
      mediaOffset: currentOffset,
      snappedGuide: activeGuide,
    };
  } else {
    // Adjust start and in-point while keeping end fixed
    const originalEnd = clip.start + clip.duration;
    const maxAllowedStart = originalEnd - minDuration;
    const newStart = Math.min(maxAllowedStart, Math.max(0, candidateTime));
    const newDuration = Math.max(minDuration, Math.round((originalEnd - newStart) * 100) / 100);
    const newOffset = Math.max(0, Math.round((currentOffset + (newStart - clip.start) * speed) * 100) / 100);

    return {
      start: newStart,
      duration: newDuration,
      mediaOffset: newOffset,
      snappedGuide: activeGuide,
    };
  }
}

/**
 * Move linked clips in lockstep with the primary dragged clip.
 */
export function moveLinkedClips(
  allClips: TimelineClip[],
  draggedClipId: string,
  deltaTime: number
): TimelineClip[] {
  const dragged = allClips.find((c) => c.id === draggedClipId);
  if (!dragged) return allClips;

  const linkedIds = new Set<string>(dragged.linkedClipIds || []);
  linkedIds.add(draggedClipId);

  // If there are other clips that list the dragged clip in their linkedClipIds, include them
  allClips.forEach((c) => {
    if (c.linkedClipIds && c.linkedClipIds.includes(draggedClipId)) {
      linkedIds.add(c.id);
    }
  });

  return allClips.map((clip) => {
    if (linkedIds.has(clip.id)) {
      const newStart = Math.max(0, Math.round((clip.start + deltaTime) * 100) / 100);
      return { ...clip, start: newStart };
    }
    return clip;
  });
}

/**
 * Select all clips strictly to the left or right of reference time.
 */
export function selectClipsDirectional(
  clips: TimelineClip[],
  referenceTime: number,
  direction: "left" | "right"
): string[] {
  return clips
    .filter((clip) => {
      if (direction === "left") {
        return clip.start < referenceTime;
      } else {
        return clip.start >= referenceTime;
      }
    })
    .map((c) => c.id);
}

/**
 * Navigates to the nearest keyframe preceding or following current time.
 */
export function findNearestKeyframe(
  keyframes: TimelineKeyframe[],
  currentTime: number,
  direction: "prev" | "next"
): TimelineKeyframe | null {
  if (!keyframes || keyframes.length === 0) return null;

  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  if (direction === "prev") {
    const prevs = sorted.filter((k) => k.time < currentTime - 0.05);
    return prevs.length > 0 ? (prevs[prevs.length - 1] ?? null) : null;
  } else {
    const nexts = sorted.filter((k) => k.time > currentTime + 0.05);
    return nexts.length > 0 ? (nexts[0] ?? null) : null;
  }
}

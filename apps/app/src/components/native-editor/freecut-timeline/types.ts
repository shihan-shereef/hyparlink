/**
 * FreeCut Timeline Types adapted for Ollastar HTML Video Architecture
 * MIT License - Walter Low / FreeCut (adapted for Hyperlink Video Editor)
 */

export type FreeCutItemType =
  | "composition"
  | "scene"
  | "video"
  | "audio"
  | "text"
  | "image"
  | "shape"
  | "adjustment";

export type FreeCutTool = "select" | "split" | "hand" | "slip" | "ripple";

export interface FreeCutKeyframe {
  id: string;
  frame: number;
  timeSec: number;
  property: string;
  value: string | number;
  ease?: string;
}

export interface FreeCutTimelineItem {
  id: string;
  trackId: string;
  type: FreeCutItemType;
  label: string;
  from: number; // start frame
  durationInFrames: number; // duration in frames
  startSec: number; // start in seconds
  durationSec: number; // duration in seconds

  // Media / source references
  file?: string;
  src?: string;
  mediaOffset?: number; // source trim start in seconds
  speed?: number; // playback speed multiplier (default 1)

  // Element linkage for bidirectional selection
  elementId?: string;
  sceneId?: string;
  headline?: string;
  subtitle?: string;
  thumbnailUrl?: string;

  // Audio properties
  volume?: number; // in dB or 0-1
  muted?: boolean;

  // Visual / state properties
  color?: string;
  locked?: boolean;
  keyframes?: FreeCutKeyframe[];

  // Linkages for paired video/audio
  linkedGroupId?: string;
}

export interface FreeCutTimelineTrack {
  id: string;
  name: string;
  kind: "video" | "audio" | "overlay" | "scene" | "text";
  height: number;
  order: number;
  locked: boolean;
  visible: boolean;
  muted: boolean;
  solo: boolean;
  items: FreeCutTimelineItem[];
}

export interface FreeCutTimelineState {
  tracks: FreeCutTimelineTrack[];
  fps: number;
  totalDurationSec: number;
  totalFrames: number;
  currentFrame: number;
  currentTimeSec: number;
  zoom: number; // pixels per second
  snapEnabled: boolean;
  selectedItemIds: string[];
  activeTool: FreeCutTool;
}

import type { CompositionScene } from "../types";

export interface FreeCutHistoryEntry {
  description: string;
  timestamp: number;
  tracks: FreeCutTimelineTrack[];
  scenes?: CompositionScene[];
  durationSec: number;
}

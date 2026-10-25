// Types for the Native Hyperlink Video Editor

export interface CompositionScene {
  id: string;
  name?: string;
  file: string;
  start: number;
  duration: number;
  mediaOffset?: number;
  headline?: string;
  subtitle?: string;
  thumbnail?: string;
}

export type ElementType = "text" | "heading" | "image" | "video" | "shape" | "background" | "container" | "unknown";

export interface SelectedElement {
  id: string;
  tag: string;
  type: ElementType;
  classes: string[];
  text?: string;
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  styles: {
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontWeight?: string;
    fontFamily?: string;
    textAlign?: string;
    lineHeight?: string;
    letterSpacing?: string;
    opacity?: string;
    borderRadius?: string;
    transform?: string;
    zIndex?: string;
    padding?: string;
    margin?: string;
    border?: string;
  };
  attributes: Record<string, string>;
}

export type TimelineTool = "select" | "split" | "select-left" | "select-right";

export interface TimelineKeyframe {
  id: string;
  time: number; // in seconds relative to timeline start
  property: string;
  value: string | number;
  ease?: string;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: "scene" | "text" | "media" | "audio" | "animation";
  muted?: boolean;
  locked?: boolean;
  visible?: boolean;
  clips: TimelineClip[];
}

export interface TimelineClip {
  id: string;
  trackId: string;
  name: string;
  start: number;     // in seconds
  duration: number;  // in seconds
  color?: string;
  elementId?: string;
  linkedClipIds?: string[];
  trackType?: "scene" | "visual" | "audio" | "animation";
  type?: "scene" | "text" | "image" | "audio" | "video";
  locked?: boolean;
  muted?: boolean;
  keyframes?: TimelineKeyframe[];
  sourceUrl?: string;
  mediaOffset?: number;
  speed?: number;
}

export interface TimelineHistoryEntry {
  description: string;
  timestamp: number;
  scenes: CompositionScene[];
  clips: TimelineClip[];
  duration: number;
}

export interface ExportSettings {
  resolution: string;
  fps: number;
  format: "mp4" | "webm";
  quality: "standard" | "high";
  includeAudio: boolean;
  filename?: string;
}

export interface RenderJob {
  id: string;
  projectId?: string;
  status: "queued" | "rendering" | "completed" | "failed";
  progress?: number;
  createdAt: string;
  completedAt?: string;
  duration: number;
  resolution: string;
  fps: number;
  format?: string;
  fileSizeBytes?: number;
  fileSizeFormatted?: string;
  outputUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  renderTimeSeconds?: number;
  error?: string;
}

export interface AssetMediaItem {
  id: string;
  name: string;
  type: "image" | "video" | "audio" | "font";
  url: string;
  thumbnailUrl?: string;
  size?: number;
  duration?: number;
}

export interface CompositionLayer {
  id: string;
  name: string;
  tag: string;
  type: ElementType;
  visible: boolean;
  locked: boolean;
  text?: string;
  rect?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  styles?: Record<string, string>;
}

export interface AssetItem {
  id: string;
  name: string;
  type: "image" | "audio" | "video";
  url: string;
  size?: string;
}


/**
 * Core Types for Intelligent Open-Web Image Discovery and Asset Integration
 */

export type ImageSourceProvider =
  | "workspace"
  | "wikimedia"
  | "pexels"
  | "unsplash"
  | "ai_generated";

export type ImageType =
  | "historical_photograph"
  | "product_shot"
  | "lifestyle_photography"
  | "landscape"
  | "architecture"
  | "document_illustration"
  | "abstract_texture"
  | "vector_graphic";

export type CameraMotionStyle =
  | "ken_burns_zoom_in"
  | "ken_burns_zoom_out"
  | "slow_pan_horizontal"
  | "parallax_depth"
  | "split_reveal"
  | "static_crisp";

export interface ImageLicenseInfo {
  name: string; // e.g. "Public Domain", "CC BY-SA 4.0", "Pexels License", "Unsplash License"
  url?: string;
  commercialSafe: boolean;
  attributionRequired: boolean;
  attributionText: string;
  authorName: string;
  authorUrl?: string;
  sourceUrl: string;
  usageRestrictions?: string;
}

export interface ImageCandidate {
  id: string;
  title: string;
  description?: string;
  provider: ImageSourceProvider;
  url: string; // High-resolution direct image URL
  thumbnailUrl: string;
  sourcePageUrl: string;
  width: number;
  height: number;
  aspectRatio: string; // "16:9", "4:3", "1:1", "9:16", etc.
  mimeType: string;
  license: ImageLicenseInfo;
  rankingScore?: number;
  rankingReason?: string;
  scoreBreakdown?: {
    subjectRelevance: number;
    sceneMatch: number;
    visualQuality: number;
    resolution: number;
    aspectRatio: number;
    negativeSpace: number;
    animationFit: number;
    historicalAccuracy: number;
    licensingCompliance: number;
    sourceReliability: number;
    totalScore: number;
  };
  localPath?: string;
  downloadedBytes?: number;
  retrievedAt?: number;
}

export interface SceneVisualRequirement {
  sceneIndex: number;
  sceneName: string;
  purpose: string;
  visualSubject: string;
  imageType: ImageType;
  requiresImage: boolean;
  preferredSource: ImageSourceProvider;
  searchQueries: string[];
  compositionStyle: "fullscreen_hero" | "split_screen" | "framed_card" | "background_texture";
  orientation: "landscape" | "portrait" | "square";
  historicalAccuracyRequired: boolean;
  cameraMotion: CameraMotionStyle;
  visualTreatment: string; // e.g. "Warm sepia grading, subtle parallax depth"
  selectedAsset?: ImageCandidate;
}

export interface VisualAssetPlan {
  videoSubject: string;
  totalScenes: number;
  scenesWithImages: number;
  sceneRequirements: SceneVisualRequirement[];
  historicalAccuracyRequired: boolean;
  summary: string;
  rawExplanation?: string;
}

export interface ImageProviderSettings {
  wikimediaEnabled: boolean;
  pexelsEnabled: boolean;
  pexelsApiKey?: string;
  unsplashEnabled: boolean;
  unsplashAccessKey?: string;
  workspaceEnabled: boolean;
  aiFallbackEnabled: boolean;
  imageReviewMode: "auto" | "review";
  searchPriority: ImageSourceProvider[];
  maxImagesPerVideo: number;
  requireLicenseVerification: boolean;
  displayAttribution: boolean;
}

export interface ImageSearchOptions {
  query: string;
  limit?: number;
  orientation?: "landscape" | "portrait" | "square";
  imageType?: ImageType;
  minWidth?: number;
  minHeight?: number;
  historicalOnly?: boolean;
}

export interface IImageProvider {
  readonly id: ImageSourceProvider;
  readonly name: string;
  isEnabled(settings: ImageProviderSettings): boolean;
  searchImages(
    options: ImageSearchOptions,
    settings: ImageProviderSettings
  ): Promise<ImageCandidate[]>;
  testConnection(settings: ImageProviderSettings): Promise<{
    success: boolean;
    message: string;
    sampleCount?: number;
  }>;
}

export interface DiscoveredAssetReport {
  visualAssetPlan: VisualAssetPlan;
  selectedAssets: ImageCandidate[];
  attributions: {
    sceneIndex: number;
    assetTitle: string;
    author: string;
    provider: ImageSourceProvider;
    license: string;
    attributionText: string;
    sourceUrl: string;
  }[];
  totalDiscovered: number;
  workspaceAssetsUsed: number;
  externalAssetsUsed: number;
  aiGeneratedUsed: number;
}

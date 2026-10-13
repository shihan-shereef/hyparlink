import fs from "node:fs";
import path from "node:path";
import { CreativeBrief } from "./creative-brief.js";

export interface AnalyzedAsset {
  id: string;
  name: string;
  originalFilename: string;
  type: string;
  mimeType: string;
  localPath?: string;
  url?: string;
  storageKey?: string;
  role:
    | "fullscreen-hero-background"
    | "split-hero"
    | "architectural-showcase"
    | "product-ui"
    | "accent-badge";
  textPlacement: "top-left" | "bottom-left" | "left-half" | "right-half" | "bottom-center";
  scrimGradient: string;
  cameraMovement: "subtle-zoom-in" | "slow-pan" | "static-crisp";
  dimensions?: { width: number; height: number; aspectRatio: string };
}

export class AssetAnalyzer {
  /**
   * Analyzes workspace assets in the context of the user's prompt and Creative Brief.
   */
  public static analyzeAssets(
    assets: any[] | undefined,
    brief: CreativeBrief,
    prompt: string,
  ): AnalyzedAsset[] {
    if (!assets || assets.length === 0) {
      return [];
    }

    const promptLower = prompt.toLowerCase();
    const briefCategory = brief.category;

    return assets.map((rawAsset, index) => {
      const filename = rawAsset.name || rawAsset.originalFilename || "asset.jpg";
      const nameLower = filename.toLowerCase();
      const isPrimary = index === 0;

      // 1. Determine visual role
      let role: AnalyzedAsset["role"] = "fullscreen-hero-background";
      let textPlacement: AnalyzedAsset["textPlacement"] = "bottom-left";
      let cameraMovement: AnalyzedAsset["cameraMovement"] = "subtle-zoom-in";
      let scrimGradient =
        "linear-gradient(180deg, rgba(7,20,38,0.7) 0%, rgba(7,20,38,0.3) 40%, rgba(7,20,38,0.92) 100%)";

      if (
        nameLower.includes("batman") ||
        promptLower.includes("batman") ||
        briefCategory === "cinematic-trailer"
      ) {
        // Batman cinematic: full-screen background with character preserved
        role = "fullscreen-hero-background";
        textPlacement = "bottom-left";
        cameraMovement = "subtle-zoom-in";
        scrimGradient =
          "linear-gradient(180deg, rgba(5,5,8,0.75) 0%, rgba(5,5,8,0.2) 35%, rgba(5,5,8,0.4) 65%, rgba(5,5,8,0.95) 100%)";
      } else if (
        nameLower.includes("building") ||
        nameLower.includes("architect") ||
        promptLower.includes("architect") ||
        briefCategory === "architectural-showcase"
      ) {
        // Architectural showcase: full-screen hero with crisp blueprints & details
        role = "architectural-showcase";
        textPlacement = "top-left";
        cameraMovement = "subtle-zoom-in";
        scrimGradient =
          "linear-gradient(90deg, rgba(10,15,25,0.92) 0%, rgba(10,15,25,0.7) 45%, rgba(10,15,25,0.2) 100%)";
      } else if (
        nameLower.includes("product") ||
        nameLower.includes("app") ||
        nameLower.includes("dashboard") ||
        briefCategory === "product-showcase"
      ) {
        role = isPrimary ? "split-hero" : "product-ui";
        textPlacement = "left-half";
        cameraMovement = "static-crisp";
        scrimGradient =
          "radial-gradient(circle at center, transparent 30%, rgba(6,11,20,0.85) 100%)";
      } else {
        // Default high-impact presentation: full-screen backdrop with balanced scrim
        role = "fullscreen-hero-background";
        textPlacement = "bottom-left";
        cameraMovement = "subtle-zoom-in";
        scrimGradient =
          "linear-gradient(180deg, rgba(10,10,15,0.8) 0%, rgba(10,10,15,0.25) 40%, rgba(10,10,15,0.92) 100%)";
      }

      // Check local dimensions if available
      let dimensions: { width: number; height: number; aspectRatio: string } | undefined = undefined;
      if (rawAsset.width && rawAsset.height) {
        dimensions = {
          width: rawAsset.width,
          height: rawAsset.height,
          aspectRatio: `${rawAsset.width}:${rawAsset.height}`,
        };
      } else if (nameLower.includes("3840x2160")) {
        dimensions = { width: 3840, height: 2160, aspectRatio: "16:9" };
      } else if (nameLower.includes("1920x1080")) {
        dimensions = { width: 1920, height: 1080, aspectRatio: "16:9" };
      }

      return {
        id: rawAsset.id || rawAsset._id || `asset-${index}`,
        name: filename,
        originalFilename: filename,
        type: rawAsset.type || (filename.match(/\.(mp4|webm|mov)$/i) ? "video" : "image"),
        mimeType: rawAsset.mimeType || "image/jpeg",
        localPath: rawAsset.localPath,
        url: rawAsset.url || rawAsset.storageUrl || rawAsset.cdnUrl,
        storageKey: rawAsset.storageKey,
        role,
        textPlacement,
        scrimGradient,
        cameraMovement,
        dimensions,
      };
    });
  }
}

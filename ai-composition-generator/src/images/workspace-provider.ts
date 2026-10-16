import fs from "node:fs";
import path from "node:path";
import {
  IImageProvider,
  ImageCandidate,
  ImageProviderSettings,
  ImageSearchOptions,
  ImageLicenseInfo,
} from "./types.js";

export class WorkspaceProvider implements IImageProvider {
  readonly id = "workspace";
  readonly name = "Workspace Asset Library";

  private userAssets: any[] = [];

  constructor(userAssets: any[] = []) {
    this.userAssets = Array.isArray(userAssets) ? userAssets : [];
  }

  public setUserAssets(assets: any[]) {
    this.userAssets = Array.isArray(assets) ? assets : [];
  }

  isEnabled(settings: ImageProviderSettings): boolean {
    return settings.workspaceEnabled !== false;
  }

  async searchImages(
    options: ImageSearchOptions,
    settings: ImageProviderSettings
  ): Promise<ImageCandidate[]> {
    if (!this.isEnabled(settings)) {
      return [];
    }

    const { query } = options;
    const candidates: ImageCandidate[] = [];
    const queryLower = (query || "").toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(Boolean);

    for (let i = 0; i < this.userAssets.length; i++) {
      const asset = this.userAssets[i];
      const name = asset.name || asset.originalFilename || `workspace_asset_${i + 1}`;
      const nameLower = name.toLowerCase();

      // Resolve localPath and URL
      const localPath = asset.localPath;
      const assetUrl = asset.url || (localPath ? `file://${localPath}` : `workspace://${name}`);

      // Check keyword overlap
      let matchScore = 0;
      for (const token of queryTokens) {
        if (nameLower.includes(token)) matchScore += 2;
      }
      if (nameLower.includes(queryLower)) matchScore += 5;

      // If user specifically passed assets, all user assets are eligible candidates
      const licenseInfo: ImageLicenseInfo = {
        name: "User Owned / Authorized Workspace Asset",
        commercialSafe: true,
        attributionRequired: false,
        attributionText: "Authorized Workspace Media",
        authorName: "Workspace Owner",
        sourceUrl: asset.url || "workspace://assets",
      };

      candidates.push({
        id: asset.id || `ws_${i}_${path.basename(name, path.extname(name))}`,
        title: name,
        description: `Workspace Asset: ${name}`,
        provider: "workspace",
        url: assetUrl,
        thumbnailUrl: assetUrl,
        sourcePageUrl: "workspace://assets",
        width: asset.width || 1920,
        height: asset.height || 1080,
        aspectRatio: "16:9",
        mimeType: asset.mimeType || (name.endsWith(".png") ? "image/png" : "image/jpeg"),
        license: licenseInfo,
        localPath: localPath,
        rankingScore: 95 + Math.min(matchScore, 5), // Workspace assets receive maximum priority!
        rankingReason: "User-provided workspace asset (Top Priority)",
        retrievedAt: Date.now(),
      });
    }

    return candidates;
  }

  async testConnection(settings: ImageProviderSettings): Promise<{
    success: boolean;
    message: string;
    sampleCount?: number;
  }> {
    return {
      success: true,
      message: `Workspace library active. ${this.userAssets.length} workspace asset(s) registered.`,
      sampleCount: this.userAssets.length,
    };
  }
}

import {
  IImageProvider,
  ImageCandidate,
  ImageProviderSettings,
  ImageSearchOptions,
  ImageLicenseInfo,
} from "./types.js";

export class PexelsProvider implements IImageProvider {
  readonly id = "pexels";
  readonly name = "Pexels Stock Photography";

  isEnabled(settings: ImageProviderSettings): boolean {
    const hasKey = Boolean(
      settings.pexelsApiKey || process.env.PEXELS_API_KEY
    );
    return settings.pexelsEnabled !== false && hasKey;
  }

  private getApiKey(settings: ImageProviderSettings): string {
    return (
      settings.pexelsApiKey || process.env.PEXELS_API_KEY || ""
    ).trim();
  }

  async searchImages(
    options: ImageSearchOptions,
    settings: ImageProviderSettings
  ): Promise<ImageCandidate[]> {
    if (!this.isEnabled(settings)) {
      return [];
    }

    const apiKey = this.getApiKey(settings);
    if (!apiKey) return [];

    const { query, limit = 8, orientation = "landscape" } = options;
    if (!query || !query.trim()) return [];

    try {
      const sanitizedQuery = query.replace(/[^\w\s-]/g, " ").trim();
      const apiUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        sanitizedQuery
      )}&per_page=${Math.min(limit, 15)}&orientation=${orientation}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[PexelsProvider] API returned HTTP ${response.status}`);
        return [];
      }

      const data: any = await response.json();
      const photos = data?.photos;
      if (!Array.isArray(photos)) return [];

      const candidates: ImageCandidate[] = [];

      for (const photo of photos) {
        const width = Number(photo.width) || 1920;
        const height = Number(photo.height) || 1080;
        const photographer = photo.photographer || "Pexels Creator";

        const licenseInfo: ImageLicenseInfo = {
          name: "Pexels License (Free Commercial Use)",
          url: "https://www.pexels.com/license/",
          commercialSafe: true,
          attributionRequired: false,
          attributionText: `Photo by ${photographer} on Pexels`,
          authorName: photographer,
          authorUrl: photo.photographer_url,
          sourceUrl: photo.url || `https://www.pexels.com/photo/${photo.id}/`,
        };

        const aspectNum = width / (height || 1);
        let aspectRatio = "16:9";
        if (aspectNum > 1.5) aspectRatio = "16:9";
        else if (aspectNum > 1.2) aspectRatio = "4:3";
        else if (aspectNum > 0.85) aspectRatio = "1:1";
        else aspectRatio = "9:16";

        candidates.push({
          id: `pexels_${photo.id}`,
          title: photo.alt || `${sanitizedQuery} photography`,
          description: photo.alt,
          provider: "pexels",
          url: photo.src?.large2x || photo.src?.original || photo.src?.large,
          thumbnailUrl: photo.src?.medium || photo.src?.small || photo.src?.large,
          sourcePageUrl: photo.url,
          width,
          height,
          aspectRatio,
          mimeType: "image/jpeg",
          license: licenseInfo,
          retrievedAt: Date.now(),
        });

        if (candidates.length >= limit) break;
      }

      return candidates;
    } catch (err: any) {
      console.warn(`[PexelsProvider] Search error: ${err.message}`);
      return [];
    }
  }

  async testConnection(settings: ImageProviderSettings): Promise<{
    success: boolean;
    message: string;
    sampleCount?: number;
  }> {
    const apiKey = this.getApiKey(settings);
    if (!apiKey) {
      return {
        success: false,
        message: "Pexels API Key is not configured. Please enter your API key in settings.",
      };
    }

    try {
      const response = await fetch("https://api.pexels.com/v1/curated?per_page=1", {
        headers: {
          Authorization: apiKey,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data: any = await response.json();
        return {
          success: true,
          message: "Pexels API authentication verified successfully.",
          sampleCount: data.photos?.length || 1,
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          message: "Pexels API Key is invalid or unauthorized.",
        };
      }

      return {
        success: false,
        message: `Pexels API returned HTTP error ${response.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Pexels connection test failed: ${err.message}`,
      };
    }
  }
}

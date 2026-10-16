import {
  IImageProvider,
  ImageCandidate,
  ImageProviderSettings,
  ImageSearchOptions,
  ImageLicenseInfo,
} from "./types.js";

export class UnsplashProvider implements IImageProvider {
  readonly id = "unsplash";
  readonly name = "Unsplash Professional Photography";

  isEnabled(settings: ImageProviderSettings): boolean {
    const hasKey = Boolean(
      settings.unsplashAccessKey || process.env.UNSPLASH_ACCESS_KEY
    );
    return settings.unsplashEnabled !== false && hasKey;
  }

  private getAccessKey(settings: ImageProviderSettings): string {
    return (
      settings.unsplashAccessKey || process.env.UNSPLASH_ACCESS_KEY || ""
    ).trim();
  }

  async searchImages(
    options: ImageSearchOptions,
    settings: ImageProviderSettings
  ): Promise<ImageCandidate[]> {
    if (!this.isEnabled(settings)) {
      return [];
    }

    const accessKey = this.getAccessKey(settings);
    if (!accessKey) return [];

    const { query, limit = 8, orientation = "landscape" } = options;
    if (!query || !query.trim()) return [];

    try {
      const sanitizedQuery = query.replace(/[^\w\s-]/g, " ").trim();
      const apiUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        sanitizedQuery
      )}&per_page=${Math.min(limit, 15)}&orientation=${orientation}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          Accept: "application/json",
          "Accept-Version": "v1",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[UnsplashProvider] API returned HTTP ${response.status}`);
        return [];
      }

      const data: any = await response.json();
      const results = data?.results;
      if (!Array.isArray(results)) return [];

      const candidates: ImageCandidate[] = [];

      for (const item of results) {
        const width = Number(item.width) || 1920;
        const height = Number(item.height) || 1080;
        const creatorName = item.user?.name || "Unsplash Photographer";

        // Trigger official Unsplash download endpoint if present (as required by Unsplash API terms)
        if (item.links?.download_location) {
          fetch(`${item.links.download_location}?client_id=${accessKey}`).catch(() => {});
        }

        const licenseInfo: ImageLicenseInfo = {
          name: "Unsplash License (Free Commercial Use)",
          url: "https://unsplash.com/license",
          commercialSafe: true,
          attributionRequired: false,
          attributionText: `Photo by ${creatorName} on Unsplash`,
          authorName: creatorName,
          authorUrl: item.user?.links?.html,
          sourceUrl: item.links?.html || `https://unsplash.com/photos/${item.id}`,
        };

        const aspectNum = width / (height || 1);
        let aspectRatio = "16:9";
        if (aspectNum > 1.5) aspectRatio = "16:9";
        else if (aspectNum > 1.2) aspectRatio = "4:3";
        else if (aspectNum > 0.85) aspectRatio = "1:1";
        else aspectRatio = "9:16";

        candidates.push({
          id: `unsplash_${item.id}`,
          title: item.alt_description || item.description || `${sanitizedQuery} photo`,
          description: item.description || item.alt_description,
          provider: "unsplash",
          url: item.urls?.regular || item.urls?.full,
          thumbnailUrl: item.urls?.small || item.urls?.thumb,
          sourcePageUrl: item.links?.html || `https://unsplash.com/photos/${item.id}`,
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
      console.warn(`[UnsplashProvider] Search error: ${err.message}`);
      return [];
    }
  }

  async testConnection(settings: ImageProviderSettings): Promise<{
    success: boolean;
    message: string;
    sampleCount?: number;
  }> {
    const accessKey = this.getAccessKey(settings);
    if (!accessKey) {
      return {
        success: false,
        message: "Unsplash Access Key is not configured. Please enter your Access Key in settings.",
      };
    }

    try {
      const response = await fetch("https://api.unsplash.com/photos?per_page=1", {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          Accept: "application/json",
          "Accept-Version": "v1",
        },
      });

      if (response.ok) {
        return {
          success: true,
          message: "Unsplash API authentication verified successfully.",
          sampleCount: 1,
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          message: "Unsplash Access Key is invalid or unauthorized.",
        };
      }

      return {
        success: false,
        message: `Unsplash API returned HTTP error ${response.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Unsplash connection test failed: ${err.message}`,
      };
    }
  }
}

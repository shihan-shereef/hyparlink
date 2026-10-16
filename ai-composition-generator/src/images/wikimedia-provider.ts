import {
  IImageProvider,
  ImageCandidate,
  ImageProviderSettings,
  ImageSearchOptions,
  ImageLicenseInfo,
} from "./types.js";

function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export class WikimediaProvider implements IImageProvider {
  readonly id = "wikimedia";
  readonly name = "Wikimedia Commons";

  private userAgent =
    "HyparlinkVideoStudio/1.0 (https://hyparlink.app; contact@hyparlink.app)";

  isEnabled(settings: ImageProviderSettings): boolean {
    return settings.wikimediaEnabled !== false;
  }

  async searchImages(
    options: ImageSearchOptions,
    settings: ImageProviderSettings
  ): Promise<ImageCandidate[]> {
    if (!this.isEnabled(settings)) {
      return [];
    }

    const { query, limit = 8 } = options;
    if (!query || !query.trim()) return [];

    try {
      const sanitizedQuery = query.replace(/[^\w\s-]/g, " ").trim();
      const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        sanitizedQuery
      )}&gsrnamespace=6&gsrlimit=${Math.min(
        limit * 2,
        20
      )}&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&origin=*`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[WikimediaProvider] API returned HTTP ${response.status}`);
        return [];
      }

      const data: any = await response.json();
      let pages = data?.query?.pages;
      
      // If no results, retry with simplified core keywords
      if (!pages || typeof pages !== "object") {
        const stopWords = new Set(["the", "and", "for", "with", "from", "into", "interior", "counter", "view", "shot"]);
        const tokens = sanitizedQuery.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
        if (tokens.length >= 2) {
          const fallbackQuery = tokens.slice(0, 3).join(" ");
          const fallbackUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
            fallbackQuery
          )}&gsrnamespace=6&gsrlimit=${Math.min(limit * 2, 20)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&origin=*`;
          try {
            const fbRes = await fetch(fallbackUrl, {
              headers: { "User-Agent": this.userAgent, Accept: "application/json" },
              signal: AbortSignal.timeout(8000),
            });
            if (fbRes.ok) {
              const fbData: any = await fbRes.json();
              if (fbData?.query?.pages && typeof fbData.query.pages === "object") {
                pages = fbData.query.pages;
              }
            }
          } catch {}
        }
      }

      if (!pages || typeof pages !== "object") {
        return [];
      }

      const candidates: ImageCandidate[] = [];

      for (const pageId of Object.keys(pages)) {
        const page = pages[pageId];
        const imageInfo = page?.imageinfo?.[0];
        if (!imageInfo) continue;

        const mime = (imageInfo.mime || "").toLowerCase();
        // Only accept supported web image formats
        if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
          continue;
        }

        const width = Number(imageInfo.width) || 0;
        const height = Number(imageInfo.height) || 0;

        // Skip tiny thumbnails
        if (width < 600 || height < 400) {
          continue;
        }

        const extmeta = imageInfo.extmetadata || {};
        const title =
          stripHtml(extmeta.ObjectName?.value) ||
          page.title.replace(/^File:/i, "").replace(/\.[^.]+$/, "");
        const description = stripHtml(extmeta.ImageDescription?.value) || title;
        const rawArtist = stripHtml(extmeta.Artist?.value) || "Unknown / Historical Archive";
        const rawLicense = extmeta.LicenseShortName?.value || "Public domain";
        const licenseUrl = extmeta.LicenseUrl?.value || "https://creativecommons.org/publicdomain/mark/1.0/";
        const usageTerms = stripHtml(extmeta.UsageTerms?.value) || "";

        // Check commercial safety
        const licenseLower = rawLicense.toLowerCase();
        const usageTermsLower = usageTerms.toLowerCase();
        const isNonCommercial =
          licenseLower.includes("-nc") ||
          licenseLower.includes("nc-") ||
          usageTermsLower.includes("non-commercial") ||
          usageTermsLower.includes("noncommercial");

        if (settings.requireLicenseVerification && isNonCommercial) {
          // Reject non-commercial restrictions for professional production
          continue;
        }

        const isPublicDomain =
          licenseLower.includes("public domain") ||
          licenseLower.includes("pd") ||
          licenseLower.includes("cc0");

        const attributionRequired = !isPublicDomain;
        const attributionText = attributionRequired
          ? `Photo by ${rawArtist} via Wikimedia Commons (${rawLicense})`
          : `Historical archive via Wikimedia Commons (Public Domain)`;

        const licenseInfo: ImageLicenseInfo = {
          name: rawLicense,
          url: licenseUrl,
          commercialSafe: !isNonCommercial,
          attributionRequired,
          attributionText,
          authorName: rawArtist,
          sourceUrl: imageInfo.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
          usageRestrictions: isNonCommercial ? "Non-Commercial Only" : undefined,
        };

        const aspectNum = width / (height || 1);
        let aspectRatio = "16:9";
        if (aspectNum > 1.5) aspectRatio = "16:9";
        else if (aspectNum > 1.2) aspectRatio = "4:3";
        else if (aspectNum > 0.85) aspectRatio = "1:1";
        else aspectRatio = "9:16";

        candidates.push({
          id: `wikimedia_${page.pageid}`,
          title,
          description: description.slice(0, 200),
          provider: "wikimedia",
          url: imageInfo.url,
          thumbnailUrl: imageInfo.thumburl || imageInfo.url,
          sourcePageUrl: licenseInfo.sourceUrl,
          width,
          height,
          aspectRatio,
          mimeType: mime,
          license: licenseInfo,
          retrievedAt: Date.now(),
        });

        if (candidates.length >= limit) break;
      }

      return candidates;
    } catch (err: any) {
      console.warn(`[WikimediaProvider] Search error: ${err.message}`);
      return [];
    }
  }

  async testConnection(settings: ImageProviderSettings): Promise<{
    success: boolean;
    message: string;
    sampleCount?: number;
  }> {
    try {
      const sample = await this.searchImages({ query: "architecture landmark", limit: 3 }, settings);
      if (sample.length > 0) {
        return {
          success: true,
          message: `Wikimedia Commons connected successfully. Retrieved ${sample.length} high-resolution candidates.`,
          sampleCount: sample.length,
        };
      }
      return {
        success: false,
        message: "Wikimedia Commons returned zero results for connectivity test.",
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Wikimedia Commons connection failed: ${err.message}`,
      };
    }
  }
}

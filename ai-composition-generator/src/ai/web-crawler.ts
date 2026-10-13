import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ScrapedWebAsset {
  id: string;
  name: string;
  originalFilename: string;
  localPath: string;
  type: string;
  mimeType: string;
  url: string;
}

export interface WebCrawlResult {
  sourceUrl?: string;
  title: string;
  summary: string;
  headings: string[];
  keyFacts: string[];
  assets: ScrapedWebAsset[];
}

export class WebCrawler {
  private static cacheDir = path.resolve(__dirname, "../../generated-assets/web-crawler");

  /**
   * Intelligently crawls a URL or searches the web for a topic,
   * gathers real facts, and downloads real images directly.
   */
  public static async enrichFromWeb(
    prompt: string,
    onProgress?: (stage: string, message: string) => void | Promise<void>,
  ): Promise<WebCrawlResult | null> {
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/i);
    const targetUrl = urlMatch ? urlMatch[0] : null;

    if (targetUrl) {
      console.log(`[WebCrawler] URL detected in prompt: ${targetUrl}`);
      if (onProgress) {
        await onProgress("web_crawling", `Crawling website ${targetUrl} for real data & images...`);
      }
      return await this.crawlUrl(targetUrl, onProgress);
    }

    // If no explicit URL, extract topic to search the web
    const topic = this.extractSearchTopic(prompt);
    if (topic && topic.length > 2) {
      console.log(`[WebCrawler] Searching the web for real facts & photos of: "${topic}"...`);
      if (onProgress) {
        await onProgress("web_crawling", `Searching the web for real media & data on "${topic}"...`);
      }
      return await this.searchWebTopic(topic, onProgress);
    }

    return null;
  }

  /**
   * Crawls a direct URL, parses its content, and downloads real photos/logos.
   */
  public static async crawlUrl(
    url: string,
    onProgress?: (stage: string, message: string) => void | Promise<void>,
  ): Promise<WebCrawlResult> {
    const result: WebCrawlResult = {
      sourceUrl: url,
      title: "",
      summary: "",
      headings: [],
      keyFacts: [],
      assets: [],
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const html = await res.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      result.title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

      // Extract description
      const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1];
      const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1];
      result.summary = (ogDesc || metaDesc || "").trim();

      // Extract headings
      const hMatches = html.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi);
      for (const m of hMatches) {
        const txt = m[1].trim();
        if (txt.length > 3 && txt.length < 80 && !result.headings.includes(txt)) {
          result.headings.push(txt);
          if (result.headings.length >= 8) break;
        }
      }

      // Collect candidate image URLs
      const imageUrls: string[] = [];

      // Open Graph / Twitter images
      const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];
      const twImg = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i)?.[1];
      if (ogImg) imageUrls.push(ogImg);
      if (twImg && twImg !== ogImg) imageUrls.push(twImg);

      // Extract high-res <img> sources
      const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
      for (const m of imgMatches) {
        const src = m[1].trim();
        if (
          !src.includes("data:image") &&
          !src.includes("icon") &&
          !src.includes("logo-small") &&
          !src.includes("1x1") &&
          !src.includes("badge") &&
          (src.endsWith(".jpg") || src.endsWith(".jpeg") || src.endsWith(".png") || src.endsWith(".webp") || src.includes("images/"))
        ) {
          imageUrls.push(src);
          if (imageUrls.length >= 10) break;
        }
      }

      // Download valid images
      result.assets = await this.downloadImages(imageUrls, url, onProgress);
    } catch (err: any) {
      console.warn(`[WebCrawler] Failed to crawl URL ${url}: ${err.message}`);
    }

    return result;
  }

  /**
   * Searches Wikipedia and public knowledge endpoints for a specific topic/character/brand.
   */
  public static async searchWebTopic(
    topic: string,
    onProgress?: (stage: string, message: string) => void | Promise<void>,
  ): Promise<WebCrawlResult> {
    const result: WebCrawlResult = {
      title: topic,
      summary: "",
      headings: [],
      keyFacts: [],
      assets: [],
    };

    try {
      const cleanTopic = encodeURIComponent(topic.trim().replace(/\s+/g, "_"));
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${cleanTopic}`;

      const res = await fetch(summaryUrl, {
        headers: { "User-Agent": "HyparlinkAutonomousCrawler/1.0 (contact@hyparlink.ai)" },
      });

      if (res.ok) {
        const data = await res.json();
        result.title = data.title || topic;
        result.summary = data.extract || "";

        const imageUrls: string[] = [];
        if (data.originalimage?.source) {
          imageUrls.push(data.originalimage.source);
        } else if (data.thumbnail?.source) {
          imageUrls.push(data.thumbnail.source);
        }

        if (imageUrls.length > 0) {
          result.assets = await this.downloadImages(imageUrls, "https://wikipedia.org", onProgress);
        }
      }
    } catch (err: any) {
      console.warn(`[WebCrawler] Topic search failed for ${topic}: ${err.message}`);
    }

    return result;
  }

  /**
   * Downloads candidate image URLs to a local cache directory.
   */
  private static async downloadImages(
    urls: string[],
    baseUrl: string,
    onProgress?: (stage: string, message: string) => void | Promise<void>,
  ): Promise<ScrapedWebAsset[]> {
    const assets: ScrapedWebAsset[] = [];
    const hash = crypto.randomBytes(3).toString("hex");
    const targetDir = path.join(this.cacheDir, `web-${hash}`);
    fs.mkdirSync(targetDir, { recursive: true });

    let count = 0;
    for (const rawUrl of urls) {
      if (count >= 5) break;

      let fullUrl = rawUrl;
      try {
        fullUrl = new URL(rawUrl, baseUrl).href;
      } catch {
        continue;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const imgRes = await fetch(fullUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!imgRes.ok) continue;

        const buffer = Buffer.from(await imgRes.arrayBuffer());
        if (buffer.length < 8000) continue; // Skip tiny icons/avatars

        const ext = fullUrl.endsWith(".png") ? ".png" : fullUrl.endsWith(".webp") ? ".webp" : ".jpg";
        const filename = `web_asset_${count + 1}${ext}`;
        const localPath = path.join(targetDir, filename);

        fs.writeFileSync(localPath, buffer);
        console.log(`[WebCrawler] Downloaded real web asset: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);

        assets.push({
          id: `web-asset-${hash}-${count}`,
          name: filename,
          originalFilename: filename,
          localPath,
          type: "image",
          mimeType: ext === ".png" ? "image/png" : "image/jpeg",
          url: fullUrl,
        });

        count++;
        if (onProgress) {
          await onProgress("web_crawling", `Downloaded real web media ${count}/5 from ${new URL(baseUrl).hostname}...`);
        }
      } catch (err: any) {
        console.warn(`[WebCrawler] Failed to download image ${fullUrl}: ${err.message}`);
      }
    }

    return assets;
  }

  /**
   * Helper to isolate real world subject keywords from conversational prompts.
   */
  private static extractSearchTopic(prompt: string): string | null {
    const clean = prompt
      .replace(/^create a \d+-second (cinematic )?(ad|video|commercial)? (for|of|about)? /i, "")
      .replace(/with (voice|logo|presentation|music|sound).*/i, "")
      .replace(/in (the )?same settings.*/i, "")
      .trim();

    const words = clean.split(/\s+/).slice(0, 4).join(" ");
    return words || null;
  }
}

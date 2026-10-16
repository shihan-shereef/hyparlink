import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dns from "node:dns/promises";
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
  sourceUrl?: string;
  attribution?: string;
  license?: string;
  fileSizeBytes: number;
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
   * SSRF Protection: Validates that a URL is safe to fetch.
   * Blocks non-HTTP/HTTPS schemes, localhost, loopbacks, link-local,
   * RFC 1918 private ranges, and cloud metadata endpoints (169.254.169.254).
   */
  public static async isSafeUrl(targetUrl: string): Promise<boolean> {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }

      const host = parsed.hostname.toLowerCase();

      // Block well-known loopbacks and metadata hosts
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host === "0.0.0.0" ||
        host === "metadata.google.internal" ||
        host === "instance-data"
      ) {
        return false;
      }

      // Check IPv4 directly if raw IP was provided
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        if (this.isPrivateIp(host)) return false;
      }

      // Perform DNS resolution to check actual target IP address
      const lookupResult = await dns.lookup(host, { all: true });
      for (const entry of lookupResult) {
        if (this.isPrivateIp(entry.address)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Evaluates if an IP address belongs to loopback, link-local, or private RFC ranges.
   */
  private static isPrivateIp(ip: string): boolean {
    if (ip.startsWith("127.") || ip === "0.0.0.0" || ip === "::1") return true;
    if (ip.startsWith("10.")) return true;
    if (ip.startsWith("192.168.")) return true;
    if (ip.startsWith("169.254.")) return true; // AWS/GCP/Azure metadata & link-local
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
    if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true; // IPv6 ULA & Link-local
    return false;
  }

  /**
   * Validates image magic bytes to ensure file is authentic JPEG, PNG, WebP, or SVG.
   */
  public static isValidImageBuffer(buffer: Buffer): { valid: boolean; mimeType: string; ext: string } {
    if (!buffer || buffer.length < 8) {
      return { valid: false, mimeType: "", ext: "" };
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { valid: true, mimeType: "image/jpeg", ext: ".jpg" };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return { valid: true, mimeType: "image/png", ext: ".png" };
    }

    // WebP: RIFF ... WEBP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { valid: true, mimeType: "image/webp", ext: ".webp" };
    }

    // SVG: Check first 256 bytes for <svg or <?xml
    const header = buffer.slice(0, 256).toString("utf-8").toLowerCase();
    if (header.includes("<svg") || (header.includes("<?xml") && header.includes("<svg"))) {
      return { valid: true, mimeType: "image/svg+xml", ext: ".svg" };
    }

    return { valid: false, mimeType: "", ext: "" };
  }

  /**
   * Intelligently enriches video requests with real-world research & assets when appropriate.
   */
  public static async enrichFromWeb(
    prompt: string,
    onProgress?: (stage: string, message: string) => void | Promise<void>,
  ): Promise<WebCrawlResult | null> {
    const urlMatch = prompt.match(/https?:\/\/[^\s"',)]+/i);
    const targetUrl = urlMatch ? urlMatch[0] : null;

    if (targetUrl) {
      const isSafe = await this.isSafeUrl(targetUrl);
      if (!isSafe) {
        console.warn(`[WebCrawler] URL failed SSRF security check: ${targetUrl}. Aborting crawl.`);
        return null;
      }

      console.log(`[WebCrawler] Authorized URL detected: ${targetUrl}`);
      if (onProgress) {
        await onProgress("web_crawling", `Researching verified web assets from ${new URL(targetUrl).hostname}...`);
      }
      return await this.crawlUrl(targetUrl, onProgress);
    }

    // Only search external topics when the prompt asks for real-world product research
    const pLower = prompt.toLowerCase();
    const wantsResearch =
      pLower.includes("research") ||
      pLower.includes("official website") ||
      pLower.includes("real software") ||
      pLower.includes("official product") ||
      pLower.includes("company website");

    if (wantsResearch) {
      const topic = this.extractSearchTopic(prompt);
      if (topic && topic.length > 2) {
        console.log(`[WebCrawler] Researching real-world subject: "${topic}"...`);
        if (onProgress) {
          await onProgress("web_crawling", `Researching verified product info for "${topic}"...`);
        }
        return await this.searchWebTopic(topic, onProgress);
      }
    }

    return null;
  }

  /**
   * Crawls a direct URL, parses its content, and downloads real photos/logos safely.
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
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        signal: controller.signal,
        redirect: "follow",
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
          !src.includes("1x1") &&
          !src.includes("badge") &&
          (src.endsWith(".jpg") || src.endsWith(".jpeg") || src.endsWith(".png") || src.endsWith(".webp") || src.includes("images/"))
        ) {
          imageUrls.push(src);
          if (imageUrls.length >= 8) break;
        }
      }

      // Download and verify images
      result.assets = await this.downloadImages(imageUrls, url, onProgress);
    } catch (err: any) {
      console.warn(`[WebCrawler] Notice crawling ${url}: ${err.message}`);
    }

    return result;
  }

  /**
   * Searches Wikipedia public knowledge endpoints for a specific topic/product/company.
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
        headers: { "User-Agent": "HyparlinkAutonomousEngine/1.0 (contact@hyparlink.ai)" },
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
      console.warn(`[WebCrawler] Topic research notice for ${topic}: ${err.message}`);
    }

    return result;
  }

  /**
   * Downloads candidate image URLs to a local project-isolated directory with SSRF, size & signature checks.
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

      // Check SSRF on target image
      const isSafe = await this.isSafeUrl(fullUrl);
      if (!isSafe) continue;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

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
        if (buffer.length < 5000 || buffer.length > 15 * 1024 * 1024) continue; // Min 5KB, Max 15MB

        // Verify magic bytes
        const sig = this.isValidImageBuffer(buffer);
        if (!sig.valid) {
          console.warn(`[WebCrawler] Rejected image with invalid signature: ${fullUrl}`);
          continue;
        }

        const filename = `web_asset_${count + 1}${sig.ext}`;
        const localPath = path.join(targetDir, filename);

        fs.writeFileSync(localPath, buffer);
        console.log(`[WebCrawler] Verified and saved web asset: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);

        assets.push({
          id: `web-asset-${hash}-${count}`,
          name: filename,
          originalFilename: filename,
          localPath,
          type: "image",
          mimeType: sig.mimeType,
          url: fullUrl,
          sourceUrl: baseUrl,
          attribution: `Source: ${new URL(baseUrl).hostname}`,
          license: "Public Web Asset",
          fileSizeBytes: buffer.length,
        });

        count++;
        if (onProgress) {
          await onProgress("web_crawling", `Acquired verified media ${count}/5 from ${new URL(baseUrl).hostname}...`);
        }
      } catch (err: any) {
        console.warn(`[WebCrawler] Failed to acquire image ${fullUrl}: ${err.message}`);
      }
    }

    return assets;
  }

  /**
   * Extracts clean, distinct real-world product/company topics from prompt strings.
   */
  private static extractSearchTopic(prompt: string): string | null {
    // Check if prompt names a real product e.g. "Linear", "Figma", "Nike", "Stripe", "Next.js", etc.
    const clean = prompt
      .replace(/^create\s+(a\s+)?(\d+[- ]seconds?\s+)?(advertisement|commercial|video|promo)\s+(for|about|of)?\s*/i, "")
      .replace(/\s*(with|using|showing|highlighting|featuring)\s+.*$/i, "")
      .replace(/\s*(research|official|website|features).*$/i, "")
      .trim();

    const words = clean.split(/\s+/).slice(0, 3).join(" ");
    return words.length > 2 ? words : null;
  }
}

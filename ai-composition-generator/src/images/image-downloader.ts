import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ImageCandidate } from "./types.js";

export class ImageDownloader {
  private static userAgent =
    "HyparlinkVideoStudio/1.0 (https://hyparlink.app; contact@hyparlink.app)";

  /**
   * Validates that a URL is a safe public HTTP/HTTPS endpoint.
   * Defends against SSRF, internal network probing, and malicious schemes.
   */
  public static isSafeUrl(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }
      const hostname = parsed.hostname.toLowerCase();
      // Block localhost, private IPs, loopbacks, and cloud metadata endpoints
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.16.") ||
        hostname.startsWith("169.254.") // AWS/GCP metadata IP
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates buffer magic bytes to ensure real image data (not HTML/text error pages).
   */
  public static detectMimeType(buffer: Buffer): string | null {
    if (!buffer || buffer.length < 12) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return "image/png";
    }

    // WebP: RIFF .... WEBP
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
      return "image/webp";
    }

    return null;
  }

  /**
   * Safely downloads an image candidate, verifies magic bytes, and saves to target directory.
   */
  public static async downloadCandidate(
    candidate: ImageCandidate,
    targetDir: string,
    filenamePrefix: string = "scene_asset"
  ): Promise<string> {
    fs.mkdirSync(targetDir, { recursive: true });

    // If candidate already has verified localPath, verify and return
    if (candidate.localPath && fs.existsSync(candidate.localPath)) {
      const stats = fs.statSync(candidate.localPath);
      if (stats.size > 2000) {
        return candidate.localPath;
      }
    }

    const downloadUrl = candidate.url || candidate.thumbnailUrl;
    if (!downloadUrl) {
      throw new Error(`Candidate ${candidate.id} has no valid download URL.`);
    }

    if (!this.isSafeUrl(downloadUrl)) {
      throw new Error(`Unsafe external image URL rejected: ${downloadUrl}`);
    }

    const hash = crypto.createHash("md5").update(downloadUrl).digest("hex").slice(0, 8);
    const candidateExt = candidate.mimeType === "image/png" ? ".png" : candidate.mimeType === "image/webp" ? ".webp" : ".jpg";
    const destFilename = `${filenamePrefix}_${hash}${candidateExt}`;
    const destPath = path.join(targetDir, destFilename);

    // Reuse if already cached and valid
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath);
      if (stats.size > 5000) {
        return destPath;
      }
    }

    console.log(`[ImageDownloader] Fetching: ${candidate.title.slice(0, 40)} from ${candidate.provider}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(downloadUrl, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Download HTTP error ${res.status}: ${res.statusText}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Verify file size (min 5KB, max 30MB)
      if (buffer.length < 5000) {
        throw new Error(`Downloaded image is too small (${buffer.length} bytes), likely an error response.`);
      }
      if (buffer.length > 30 * 1024 * 1024) {
        throw new Error(`Downloaded image exceeds safe size limit (${(buffer.length / 1024 / 1024).toFixed(1)}MB).`);
      }

      // Verify magic bytes
      const detectedMime = this.detectMimeType(buffer);
      if (!detectedMime) {
        throw new Error(`Downloaded file failed magic byte verification (unrecognized image format).`);
      }

      fs.writeFileSync(destPath, buffer);
      console.log(`[ImageDownloader] Saved ${destFilename} (${(buffer.length / 1024).toFixed(1)} KB, format: ${detectedMime})`);

      candidate.localPath = destPath;
      candidate.downloadedBytes = buffer.length;

      return destPath;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw new Error(`Failed to safely download image ${candidate.id}: ${err.message}`);
    }
  }
}

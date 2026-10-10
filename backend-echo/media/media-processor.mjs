import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const VENDOR_FFMPEG_PATHS = [
  process.env.FFMPEG_PATH,
  "/Applications/HyperFrames.app/Contents/Resources/app.asar.unpacked/vendor/ffmpeg/darwin-arm64/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/opt/homebrew/bin/ffmpeg",
  "ffmpeg",
];

export class MediaProcessor {
  static cachedFfmpegPath = null;

  static getFfmpegPath() {
    if (this.cachedFfmpegPath) return this.cachedFfmpegPath;

    for (const p of VENDOR_FFMPEG_PATHS) {
      if (p && (fs.existsSync(p) || p === "ffmpeg")) {
        this.cachedFfmpegPath = p;
        return p;
      }
    }
    return "ffmpeg";
  }

  /**
   * Generates a WebP poster frame / thumbnail from an MP4 video at 00:01 (or 00:00.1 if short).
   */
  static async generateThumbnail(inputPath, outputPath, options = {}) {
    const ffmpeg = this.getFfmpegPath();
    const timestamp = options?.timestamp || "00:00:01";
    const targetWidth = options?.width || 1280;
    const targetHeight = options?.height || 720;

    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    try {
      const scaleFilter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`;
      const args = [
        "-y",
        "-ss",
        timestamp,
        "-i",
        inputPath,
        "-vframes",
        "1",
        "-vf",
        scaleFilter,
        "-c:v",
        "libwebp",
        outputPath,
      ];

      await execFileAsync(ffmpeg, args);

      // Verify thumbnail output file
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        const stat = fs.statSync(outputPath);
        return {
          success: true,
          outputPath,
          size: stat.size,
          mimeType: "image/webp",
          width: targetWidth,
          height: targetHeight,
        };
      }

      // If at 1s failed (e.g. video shorter than 1s), fallback to frame 0
      const fallbackArgs = [
        "-y",
        "-ss",
        "00:00:00.1",
        "-i",
        inputPath,
        "-vframes",
        "1",
        "-vf",
        scaleFilter,
        "-c:v",
        "libwebp",
        outputPath,
      ];
      await execFileAsync(ffmpeg, fallbackArgs);

      const stat = fs.statSync(outputPath);
      return {
        success: true,
        outputPath,
        size: stat.size,
        mimeType: "image/webp",
        width: targetWidth,
        height: targetHeight,
      };
    } catch (err) {
      console.warn(
        `[MediaProcessor] Thumbnail generation warning: ${err.message}`,
      );
      return {
        success: false,
        outputPath,
        size: 0,
        mimeType: "image/webp",
        width: targetWidth,
        height: targetHeight,
        error: err.message,
      };
    }
  }

  /**
   * Transcodes an MP4 video to a specific resolution profile (e.g. 720p or 480p).
   */
  static async transcodeResolution(inputPath, outputPath, resolution) {
    const ffmpeg = this.getFfmpegPath();
    const config =
      resolution === "720p"
        ? { width: 1280, height: 720, crf: "22" }
        : { width: 854, height: 480, crf: "24" };

    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    try {
      const scaleFilter = `scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`;
      const args = [
        "-y",
        "-i",
        inputPath,
        "-vf",
        scaleFilter,
        "-c:v",
        "libx264",
        "-crf",
        config.crf,
        "-preset",
        "fast",
        "-c:a",
        "copy",
        outputPath,
      ];

      await execFileAsync(ffmpeg, args);

      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error(`Transcode output missing or empty: ${outputPath}`);
      }

      const stat = fs.statSync(outputPath);
      return {
        success: true,
        outputPath,
        resolution,
        width: config.width,
        height: config.height,
        size: stat.size,
      };
    } catch (err) {
      console.warn(
        `[MediaProcessor] Transcode to ${resolution} failed: ${err.message}`,
      );
      return {
        success: false,
        outputPath,
        resolution,
        width: config.width,
        height: config.height,
        size: 0,
        error: err.message,
      };
    }
  }

  /**
   * Generates optional HLS master playlist and resolution streams.
   */
  static async generateHls(inputPath, hlsDir) {
    const ffmpeg = this.getFfmpegPath();
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }

    const masterPath = path.join(hlsDir, "master.m3u8");
    const segmentPattern = path.join(hlsDir, "segment_%03d.ts");
    const streamPlaylist = path.join(hlsDir, "index.m3u8");

    try {
      const args = [
        "-y",
        "-i",
        inputPath,
        "-c:v",
        "libx264",
        "-crf",
        "22",
        "-preset",
        "fast",
        "-c:a",
        "copy",
        "-hls_time",
        "4",
        "-hls_playlist_type",
        "vod",
        "-hls_segment_filename",
        segmentPattern,
        streamPlaylist,
      ];

      await execFileAsync(ffmpeg, args);

      // Create a master.m3u8 pointing to index.m3u8
      const masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080
index.m3u8
`;
      fs.writeFileSync(masterPath, masterContent, "utf8");

      return {
        success: true,
        masterPlaylistPath: masterPath,
        playlists: [streamPlaylist],
      };
    } catch (err) {
      console.warn(`[MediaProcessor] HLS generation error: ${err.message}`);
      return {
        success: false,
        masterPlaylistPath: masterPath,
        playlists: [],
        error: err.message,
      };
    }
  }
}

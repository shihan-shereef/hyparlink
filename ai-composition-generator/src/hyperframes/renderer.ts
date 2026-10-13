import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { EnvironmentChecker } from "../system/environment-checker.js";

const execAsync = promisify(exec);

export interface ProbeMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  fps: number;
  hasAudio: boolean;
  audioCodec?: string;
  audioChannels?: number;
}

export interface RenderOptions {
  projectDir: string;
  outputPath: string;
  resolution?: string;
  format?: string;
  extractFrames?: boolean;
}

export interface RenderResult {
  success: boolean;
  outputPath?: string;
  duration?: number;
  resolution?: string;
  fps?: number;
  fileSizeBytes?: number;
  fileSizeFormatted?: string;
  renderTimeSeconds?: number;
  probeData?: ProbeMetadata;
  extractedFrames?: string[];
  error?: string;
  rawOutput?: string;
}

export class Renderer {
  public static async getFfprobePath(): Promise<string> {
    const status = await EnvironmentChecker.checkFfprobe();
    if (status.installed && status.path) {
      return status.path;
    }
    return "ffprobe";
  }

  public static async getFfmpegPath(): Promise<string> {
    const status = await EnvironmentChecker.checkFfmpeg();
    if (status.installed && status.path) {
      return status.path;
    }
    return "ffmpeg";
  }

  public static async render(options: RenderOptions): Promise<RenderResult> {
    const {
      projectDir,
      outputPath,
      resolution = "1080p",
      format = "mp4",
      extractFrames = true,
    } = options;
    const startTime = Date.now();

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const ffmpegPath = await this.getFfmpegPath();
    const ffmpegDir = path.dirname(ffmpegPath);
    const envPath = `${ffmpegDir}:${process.env.PATH || ""}`;
    const command = `npx --yes hyperframes@0.8.139 render --resolution ${resolution} --format ${format} -o "${outputPath}"`;

    console.log(`[Renderer] Render started...`);
    console.log(`[Renderer] Command: ${command}`);
    console.log(`[Renderer] Working directory: ${projectDir}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: projectDir,
        env: {
          ...process.env,
          PATH: envPath,
        },
        timeout: 180000, // 3 minutes timeout for rendering
      });

      const combined = stdout + "\n" + stderr;
      const renderTimeSeconds = Number(
        ((Date.now() - startTime) / 1000).toFixed(2),
      );

      // Verify output file exists
      const stats = await fs.stat(outputPath);
      const fileSizeBytes = stats.size;
      const fileSizeFormatted = `${(fileSizeBytes / 1024).toFixed(1)} KB`;

      // Run ffprobe verification
      let probeData: ProbeMetadata | undefined;
      try {
        probeData = await this.probeVideo(outputPath);
        console.log(
          `[Renderer/ffprobe] Verified: ${probeData.width}x${probeData.height} @ ${probeData.fps}fps, Duration: ${probeData.duration.toFixed(2)}s, Codec: ${probeData.codec}`,
        );
      } catch (probeErr: any) {
        console.warn(`[Renderer/ffprobe] Probe warning: ${probeErr.message}`);
      }

      // Extract representative frames for local programmatic inspection (NO BROWSER)
      const extractedFrames: string[] = [];
      if (extractFrames && probeData && probeData.duration > 0) {
        try {
          const frames = await this.extractInspectionFrames(
            outputPath,
            projectDir,
            probeData.duration,
          );
          extractedFrames.push(...frames);
          console.log(
            `[Renderer/Frames] Extracted ${extractedFrames.length} inspection frames into ${path.join(projectDir, "inspect")}`,
          );
        } catch (frameErr: any) {
          console.warn(`[Renderer/Frames] Extraction warning: ${frameErr.message}`);
        }
      }

      const finalDuration = probeData?.duration || 15.0;
      const finalFps = probeData?.fps || 30;
      const finalRes = probeData
        ? `${probeData.width}x${probeData.height}`
        : resolution === "1080p"
          ? "1920x1080"
          : resolution;

      console.log(
        `[Renderer] Render completed successfully in ${renderTimeSeconds}s.`,
      );
      console.log(`[Renderer] Output: ${outputPath} (${fileSizeFormatted})`);

      return {
        success: true,
        outputPath,
        duration: finalDuration,
        resolution: finalRes,
        fps: finalFps,
        fileSizeBytes,
        fileSizeFormatted,
        renderTimeSeconds,
        probeData,
        extractedFrames,
        rawOutput: combined,
      };
    } catch (err: any) {
      const combined =
        (err.stdout || "") +
        "\n" +
        (err.stderr || "") +
        "\n" +
        (err.message || "");
      console.error(`[Renderer] Render failed: ${err.message}`);

      return {
        success: false,
        error: err.message,
        rawOutput: combined,
      };
    }
  }

  /**
   * Programmatic inspection of rendered MP4 via ffprobe.
   */
  public static async probeVideo(videoPath: string): Promise<ProbeMetadata> {
    const ffprobePath = await this.getFfprobePath();
    const cmd = `"${ffprobePath}" -v error -show_entries format=duration,size,bit_rate:stream=codec_name,codec_type,width,height,r_frame_rate,channels -of json "${videoPath}"`;

    const { stdout } = await execAsync(cmd);
    const parsed = JSON.parse(stdout);

    const format = parsed.format || {};
    const videoStream =
      parsed.streams?.find((s: any) => s.codec_type === "video") ||
      parsed.streams?.[0] ||
      {};
    const audioStream = parsed.streams?.find((s: any) => s.codec_type === "audio");

    let fps = 30;
    if (videoStream.r_frame_rate) {
      const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
      if (den && num) fps = Math.round(num / den);
    }

    return {
      duration: parseFloat(format.duration || "0"),
      width: parseInt(videoStream.width || "1920", 10),
      height: parseInt(videoStream.height || "1080", 10),
      codec: videoStream.codec_name || "h264",
      bitrate: parseInt(format.bit_rate || "0", 10),
      fps,
      hasAudio: !!audioStream,
      audioCodec: audioStream?.codec_name,
      audioChannels: audioStream ? parseInt(audioStream.channels || "2", 10) : 0,
    };
  }

  /**
   * Headless frame extraction via ffmpeg for programmatic quality verification.
   */
  private static async extractInspectionFrames(
    videoPath: string,
    projectDir: string,
    totalDuration: number,
  ): Promise<string[]> {
    const ffmpegPath = await this.getFfmpegPath();
    const inspectDir = path.join(projectDir, "inspect");
    await fs.mkdir(inspectDir, { recursive: true });

    const timestamps = [
      Math.min(1.0, totalDuration * 0.1),
      totalDuration * 0.5,
      Math.max(1.0, totalDuration - 1.0),
    ];

    const extracted: string[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i].toFixed(2);
      const outFrame = path.join(inspectDir, `frame_0${i + 1}.jpg`);
      const cmd = `"${ffmpegPath}" -ss ${ts} -i "${videoPath}" -vframes 1 -q:v 2 -y "${outFrame}"`;

      try {
        await execAsync(cmd);
        const stats = await fs.stat(outFrame);
        if (stats.size > 0) {
          extracted.push(outFrame);
        }
      } catch (err: any) {
        console.warn(`[Renderer/Frames] Could not extract frame at ${ts}s: ${err.message}`);
      }
    }

    return extracted;
  }
}

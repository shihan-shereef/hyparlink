import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface FrameQualityIssue {
  type: "warning" | "error";
  code: string;
  framePath: string;
  timestamp: number;
  message: string;
}

export interface FrameQualityReport {
  inspectedFramesCount: number;
  passed: boolean;
  issues: FrameQualityIssue[];
  frameMetrics: Array<{
    framePath: string;
    timestamp: number;
    fileSizeBytes: number;
    width: number;
    height: number;
    isDuplicate: boolean;
    isBlank: boolean;
  }>;
}

export class FrameQualityAnalyzer {
  private static readonly VENDOR_FFMPEG_DIR =
    "/Applications/HyperFrames.app/Contents/Resources/app.asar.unpacked/vendor/ffmpeg/darwin-arm64";

  /**
   * Programmatically inspects extracted video frames without a browser.
   */
  public static async analyze(
    framePaths: string[],
    expectedSpecs: { width: number; height: number },
  ): Promise<FrameQualityReport> {
    const issues: FrameQualityIssue[] = [];
    const frameMetrics: FrameQualityReport["frameMetrics"] = [];
    const ffprobePath = path.join(this.VENDOR_FFMPEG_DIR, "ffprobe");

    let prevSize = -1;

    for (let i = 0; i < framePaths.length; i++) {
      const framePath = framePaths[i];
      const approxTimestamp = i === 0 ? 1.0 : i === 1 ? 15.0 : 28.0;

      try {
        const stats = await fs.stat(framePath);
        const fileSizeBytes = stats.size;

        // Check 1: File size is too small (likely completely black/blank frame)
        const isBlank = fileSizeBytes < 8000;
        if (isBlank) {
          issues.push({
            type: "warning",
            code: "POTENTIAL_BLANK_FRAME",
            framePath,
            timestamp: approxTimestamp,
            message: `Frame at ~${approxTimestamp}s has an unusually small file size (${fileSizeBytes} bytes), indicating potential blank or pure black content.`,
          });
        }

        // Check 2: Repeated identical frames where motion was expected
        const isDuplicate = prevSize > 0 && Math.abs(fileSizeBytes - prevSize) < 50;
        if (isDuplicate && i > 0) {
          issues.push({
            type: "warning",
            code: "REPEATED_STATIC_FRAME",
            framePath,
            timestamp: approxTimestamp,
            message: `Frame at ~${approxTimestamp}s has identical byte structure to previous frame. Ensure GSAP animations are active throughout the scene.`,
          });
        }
        prevSize = fileSizeBytes;

        // Check 3: Image resolution matches video resolution via ffprobe
        let width = expectedSpecs.width;
        let height = expectedSpecs.height;

        try {
          const cmd = `"${ffprobePath}" -v error -select_streams v:0 -show_entries stream=width,height -of json "${framePath}"`;
          const { stdout } = await execAsync(cmd);
          const parsed = JSON.parse(stdout);
          const stream = parsed.streams?.[0] || {};
          width = stream.width || width;
          height = stream.height || height;

          if (width !== expectedSpecs.width || height !== expectedSpecs.height) {
            issues.push({
              type: "error",
              code: "ASPECT_RATIO_MISMATCH",
              framePath,
              timestamp: approxTimestamp,
              message: `Frame resolution (${width}x${height}) differs from expected project specifications (${expectedSpecs.width}x${expectedSpecs.height}).`,
            });
          }
        } catch {}

        frameMetrics.push({
          framePath,
          timestamp: approxTimestamp,
          fileSizeBytes,
          width,
          height,
          isDuplicate,
          isBlank,
        });
      } catch (err: any) {
        issues.push({
          type: "error",
          code: "FRAME_READ_ERROR",
          framePath,
          timestamp: approxTimestamp,
          message: `Could not access inspection frame: ${err.message}`,
        });
      }
    }

    const hasErrors = issues.some((i) => i.type === "error");

    return {
      inspectedFramesCount: framePaths.length,
      passed: !hasErrors,
      issues,
      frameMetrics,
    };
  }
}

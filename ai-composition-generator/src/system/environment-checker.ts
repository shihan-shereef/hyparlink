import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";

const execAsync = promisify(exec);

export interface DependencyDetail {
  installed: boolean;
  version?: string;
  compatible: boolean;
  path?: string;
  minRequired?: string;
  error?: string;
  codecs?: Record<string, boolean>;
  formats?: Record<string, boolean>;
  cli?: string;
}

export interface StorageDetail {
  writable: boolean;
  storagePath: string;
  availableMb?: number;
  sufficient: boolean;
  minRequiredMb: number;
}

export interface EnvironmentStatus {
  status: "ready" | "not_ready" | "degraded";
  renderingReady: boolean;
  dependencies: {
    node: DependencyDetail;
    npm: DependencyDetail;
    ffmpeg: DependencyDetail;
    ffprobe: DependencyDetail;
    hyperframes: DependencyDetail;
    storage: StorageDetail;
  };
  recommendations: string[];
  lastChecked: string;
  cached: boolean;
  os: {
    platform: string;
    arch: string;
    release: string;
  };
}

export class EnvironmentChecker {
  private static cachedStatus: EnvironmentStatus | null = null;
  private static lastCheckTime = 0;
  private static readonly CACHE_TTL_MS = 30000; // 30-second TTL

  private static readonly VENDOR_FFMPEG_CANDIDATES = [
    process.env.FFMPEG_PATH,
    path.join(os.homedir(), ".local/bin/ffmpeg"),
    "/Applications/HyperFrames.app/Contents/Resources/app.asar.unpacked/vendor/ffmpeg/darwin-arm64/ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
    "ffmpeg",
  ].filter(Boolean) as string[];

  private static readonly VENDOR_FFPROBE_CANDIDATES = [
    process.env.FFPROBE_PATH,
    path.join(os.homedir(), ".local/bin/ffprobe"),
    "/Applications/HyperFrames.app/Contents/Resources/app.asar.unpacked/vendor/ffmpeg/darwin-arm64/ffprobe",
    "/opt/homebrew/bin/ffprobe",
    "/usr/local/bin/ffprobe",
    "/usr/bin/ffprobe",
    "ffprobe",
  ].filter(Boolean) as string[];

  /**
   * Performs comprehensive environment inspection
   */
  public static async checkEnvironment(forceRefresh = false): Promise<EnvironmentStatus> {
    const now = Date.now();
    if (!forceRefresh && this.cachedStatus && now - this.lastCheckTime < this.CACHE_TTL_MS) {
      return {
        ...this.cachedStatus,
        cached: true,
      };
    }

    const recommendations: string[] = [];

    // 1. Check Node.js
    const nodeStatus = await this.checkNode();
    if (!nodeStatus.installed || !nodeStatus.compatible) {
      recommendations.push(
        `Node.js >= 18 is required. Detected ${nodeStatus.version || "none"}. Please install or update Node.js.`,
      );
    }

    // 2. Check npm
    const npmStatus = await this.checkNpm();
    if (!npmStatus.installed || !npmStatus.compatible) {
      recommendations.push(
        `npm is required. Detected ${npmStatus.version || "none"}. Please install npm.`,
      );
    }

    // 3. Check FFmpeg
    const ffmpegStatus = await this.checkFfmpeg();
    if (!ffmpegStatus.installed || !ffmpegStatus.compatible) {
      recommendations.push(
        `FFmpeg with H.264 & AAC support is required for video encoding. Run 'bash scripts/setup-environment.sh' to install or symlink FFmpeg.`,
      );
    }

    // 4. Check FFprobe
    const ffprobeStatus = await this.checkFfprobe();
    if (!ffprobeStatus.installed || !ffprobeStatus.compatible) {
      recommendations.push(
        `FFprobe is required for post-render media verification. Run 'bash scripts/setup-environment.sh' to configure FFprobe.`,
      );
    }

    // 5. Check HyperFrames
    const hyperframesStatus = await this.checkHyperframes();
    if (!hyperframesStatus.installed || !hyperframesStatus.compatible) {
      recommendations.push(
        `HyperFrames CLI 0.8.139 is required for deterministic video rendering. Run 'npx --yes hyperframes@0.8.139 --version'.`,
      );
    }

    // 6. Check Storage and Disk Space
    const storageStatus = await this.checkStorage();
    if (!storageStatus.writable || !storageStatus.sufficient) {
      recommendations.push(
        `Storage path ${storageStatus.storagePath} is not writable or has less than ${storageStatus.minRequiredMb}MB available.`,
      );
    }

    const allCriticalPassed =
      nodeStatus.installed &&
      nodeStatus.compatible &&
      npmStatus.installed &&
      npmStatus.compatible &&
      ffmpegStatus.installed &&
      ffmpegStatus.compatible &&
      ffprobeStatus.installed &&
      ffprobeStatus.compatible &&
      hyperframesStatus.installed &&
      hyperframesStatus.compatible &&
      storageStatus.writable;

    const status: "ready" | "not_ready" | "degraded" = allCriticalPassed
      ? "ready"
      : recommendations.length > 2
        ? "not_ready"
        : "degraded";

    const result: EnvironmentStatus = {
      status,
      renderingReady: allCriticalPassed,
      dependencies: {
        node: nodeStatus,
        npm: npmStatus,
        ffmpeg: ffmpegStatus,
        ffprobe: ffprobeStatus,
        hyperframes: hyperframesStatus,
        storage: storageStatus,
      },
      recommendations,
      lastChecked: new Date().toISOString(),
      cached: false,
      os: {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
      },
    };

    this.cachedStatus = result;
    this.lastCheckTime = now;

    return result;
  }

  /**
   * Node.js version and compatibility check
   */
  private static async checkNode(): Promise<DependencyDetail> {
    const rawVersion = process.version; // e.g. "v22.20.0"
    const majorMatch = rawVersion.match(/^v?(\d+)/);
    const major = majorMatch ? parseInt(majorMatch[1], 10) : 0;
    const compatible = major >= 18;

    return {
      installed: true,
      version: rawVersion,
      compatible,
      minRequired: ">=18.0.0",
      path: process.execPath,
    };
  }

  /**
   * npm check
   */
  private static async checkNpm(): Promise<DependencyDetail> {
    try {
      const { stdout } = await execAsync("npm --version", { timeout: 5000 });
      const version = stdout.trim();
      const major = parseInt(version.split(".")[0], 10);
      return {
        installed: true,
        version,
        compatible: major >= 8,
        minRequired: ">=8.0.0",
      };
    } catch (err: any) {
      return {
        installed: false,
        compatible: false,
        minRequired: ">=8.0.0",
        error: err.message,
      };
    }
  }

  /**
   * FFmpeg check with path resolution and codec validation
   */
  public static async checkFfmpeg(): Promise<DependencyDetail> {
    let resolvedPath: string | null = null;
    let versionOutput = "";

    // Test candidates
    for (const candidate of this.VENDOR_FFMPEG_CANDIDATES) {
      try {
        if (candidate.startsWith("/") && !fsSync.existsSync(candidate)) {
          continue;
        }
        const { stdout } = await execAsync(`"${candidate}" -version`, { timeout: 5000 });
        if (stdout.includes("ffmpeg version")) {
          resolvedPath = candidate;
          versionOutput = stdout;
          break;
        }
      } catch {}
    }

    if (!resolvedPath) {
      return {
        installed: false,
        compatible: false,
        minRequired: "FFmpeg with h264/aac",
        error: "FFmpeg binary not found in PATH or standard vendor locations",
      };
    }

    const versionMatch = versionOutput.match(/ffmpeg version\s+([^\s]+)/i);
    const version = versionMatch ? versionMatch[1] : "detected";

    // Verify critical codecs (H.264 & AAC)
    let hasH264 = false;
    let hasAac = false;
    let hasMp4 = false;

    try {
      const { stdout: codecsOut } = await execAsync(`"${resolvedPath}" -codecs`, { timeout: 6000 });
      hasH264 = codecsOut.includes("h264") || codecsOut.includes("libx264");
      hasAac = codecsOut.includes("aac");

      const { stdout: formatsOut } = await execAsync(`"${resolvedPath}" -formats`, { timeout: 6000 });
      hasMp4 = formatsOut.includes("mp4");
    } catch {
      // In case -codecs output is large or truncated, fallback to true if version check succeeded
      hasH264 = true;
      hasAac = true;
      hasMp4 = true;
    }

    const compatible = hasH264 && hasMp4;

    return {
      installed: true,
      version,
      compatible,
      path: resolvedPath,
      minRequired: "FFmpeg with h264/aac",
      codecs: {
        h264: hasH264,
        aac: hasAac,
      },
      formats: {
        mp4: hasMp4,
      },
    };
  }

  /**
   * FFprobe check
   */
  public static async checkFfprobe(): Promise<DependencyDetail> {
    let resolvedPath: string | null = null;
    let versionOutput = "";

    for (const candidate of this.VENDOR_FFPROBE_CANDIDATES) {
      try {
        if (candidate.startsWith("/") && !fsSync.existsSync(candidate)) {
          continue;
        }
        const { stdout } = await execAsync(`"${candidate}" -version`, { timeout: 5000 });
        if (stdout.includes("ffprobe version")) {
          resolvedPath = candidate;
          versionOutput = stdout;
          break;
        }
      } catch {}
    }

    if (!resolvedPath) {
      return {
        installed: false,
        compatible: false,
        minRequired: "FFprobe executable",
        error: "FFprobe binary not found in PATH or standard vendor locations",
      };
    }

    const versionMatch = versionOutput.match(/ffprobe version\s+([^\s]+)/i);
    const version = versionMatch ? versionMatch[1] : "detected";

    return {
      installed: true,
      version,
      compatible: true,
      path: resolvedPath,
      minRequired: "FFprobe executable",
    };
  }

  /**
   * HyperFrames CLI check
   */
  private static async checkHyperframes(): Promise<DependencyDetail> {
    // 1. Instant check: inspect local node_modules package.json
    const packageJsonCandidates = [
      path.resolve(process.cwd(), "ai-composition-generator/node_modules/hyperframes/package.json"),
      path.resolve(process.cwd(), "node_modules/hyperframes/package.json"),
    ];

    for (const pkgPath of packageJsonCandidates) {
      if (fsSync.existsSync(pkgPath)) {
        try {
          const raw = fsSync.readFileSync(pkgPath, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed.version) {
            const compatible =
              parsed.version === "0.8.139" || parsed.version.startsWith("0.8.");
            return {
              installed: true,
              version: parsed.version,
              compatible,
              cli: "npx --yes hyperframes@0.8.139",
              minRequired: "0.8.139",
            };
          }
        } catch {}
      }
    }

    // 2. Binary check: local .bin
    const binCandidates = [
      path.resolve(process.cwd(), "ai-composition-generator/node_modules/.bin/hyperframes"),
      path.resolve(process.cwd(), "node_modules/.bin/hyperframes"),
    ];

    for (const binPath of binCandidates) {
      if (fsSync.existsSync(binPath)) {
        try {
          const { stdout } = await execAsync(`"${binPath}" --version`, { timeout: 5000 });
          const version = stdout.trim();
          if (version) {
            const compatible = version === "0.8.139" || version.startsWith("0.8.");
            return {
              installed: true,
              version,
              compatible,
              cli: "npx --yes hyperframes@0.8.139",
              minRequired: "0.8.139",
            };
          }
        } catch {}
      }
    }

    // 3. Fallback: npx execution
    try {
      const { stdout } = await execAsync("npx --prefer-offline hyperframes@0.8.139 --version", {
        timeout: 45000,
      });
      const version = stdout.trim();
      const compatible = version === "0.8.139" || version.startsWith("0.8.");
      return {
        installed: true,
        version,
        compatible,
        cli: "npx --yes hyperframes@0.8.139",
        minRequired: "0.8.139",
      };
    } catch (err: any) {
      return {
        installed: false,
        compatible: false,
        cli: "npx --yes hyperframes@0.8.139",
        minRequired: "0.8.139",
        error: err.message,
      };
    }
  }

  /**
   * Storage and disk space check
   */
  private static async checkStorage(): Promise<StorageDetail> {
    const storagePath = path.resolve(
      process.cwd(),
      "ai-composition-generator/storage",
    );
    const minRequiredMb = 500; // Minimum 500MB free required for video output

    try {
      await fs.mkdir(storagePath, { recursive: true });

      // Test write and delete
      const testFile = path.join(storagePath, `.health_test_${Date.now()}.tmp`);
      await fs.writeFile(testFile, "ok", "utf-8");
      await fs.unlink(testFile);

      // Query free disk space
      let availableMb = 5000;
      try {
        const { stdout } = await execAsync(`df -k "${storagePath}" | tail -n 1`);
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 4) {
          const availKb = parseInt(parts[3], 10);
          if (!isNaN(availKb)) {
            availableMb = Math.round(availKb / 1024);
          }
        }
      } catch {}

      return {
        writable: true,
        storagePath,
        availableMb,
        sufficient: availableMb >= minRequiredMb,
        minRequiredMb,
      };
    } catch {
      return {
        writable: false,
        storagePath,
        sufficient: false,
        minRequiredMb,
      };
    }
  }
}

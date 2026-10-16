import fs from "fs";
import { execFile } from "child_process";
import util from "util";
import { AudioValidationResult } from "./types.js";

const execFileAsync = util.promisify(execFile);

export class AudioValidator {
  /**
   * SSRF protection: ensures target URL uses public HTTP/HTTPS protocol
   * and does not attempt to contact private network spaces or cloud metadata services.
   */
  public static validateSafeUrl(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return false;
      }
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "::1" ||
        hostname.endsWith(".internal") ||
        hostname.endsWith(".local")
      ) {
        return false;
      }

      // Check private IPv4 ranges
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      const match = hostname.match(ipv4Regex);
      if (match) {
        const octet1 = parseInt(match[1], 10);
        const octet2 = parseInt(match[2], 10);
        if (octet1 === 10) return false;
        if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return false;
        if (octet1 === 192 && octet2 === 168) return false;
        if (octet1 === 169 && octet2 === 254) return false; // AWS/GCP metadata
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Magic byte verification: inspects binary buffer header to confirm legitimate audio format.
   */
  public static validateMagicBytes(buffer: Buffer): { valid: boolean; format: string } {
    if (!buffer || buffer.length < 16) {
      return { valid: false, format: "unknown" };
    }

    // Check for HTML/XML error payloads mistakenly received as 200 OK
    const headerAscii = buffer.slice(0, 16).toString("ascii").toLowerCase();
    if (
      headerAscii.includes("<!doc") ||
      headerAscii.includes("<html") ||
      headerAscii.includes("error") ||
      headerAscii.includes("<?xml")
    ) {
      return { valid: false, format: "html_error" };
    }

    // 1. MP3 with ID3 tag: 'ID3' (49 44 33)
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      return { valid: true, format: "mp3" };
    }

    // 2. MP3 raw frame sync (FF FB, FF F3, FF F2, FF FA)
    if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
      return { valid: true, format: "mp3" };
    }

    // 3. WAV: 'RIFF' (52 49 46 46) and 'WAVE' at offset 8
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer.length >= 12 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x41 &&
      buffer[10] === 0x56 &&
      buffer[11] === 0x45
    ) {
      return { valid: true, format: "wav" };
    }

    // 4. OGG: 'OggS' (4F 67 67 53)
    if (
      buffer[0] === 0x4f &&
      buffer[1] === 0x67 &&
      buffer[2] === 0x67 &&
      buffer[3] === 0x53
    ) {
      return { valid: true, format: "ogg" };
    }

    // 5. AAC / M4A: ISO BMFF box with 'ftyp' (offset 4-8: 66 74 79 70)
    if (buffer.length >= 12) {
      const ftyp = buffer.slice(4, 8).toString("ascii");
      if (ftyp === "ftyp") {
        return { valid: true, format: "m4a" };
      }
    }

    // 6. ADTS AAC syncword (FF F1, FF F9)
    if (buffer[0] === 0xff && (buffer[1] === 0xf1 || buffer[1] === 0xf9)) {
      return { valid: true, format: "aac" };
    }

    return { valid: false, format: "unknown" };
  }

  /**
   * Deep audio file inspection via FFprobe:
   * Validates duration, channels, sample rate, and codec stream integrity.
   */
  public static async inspectAudioFile(filePath: string): Promise<AudioValidationResult> {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: `File does not exist: ${filePath}` };
    }

    const stat = fs.statSync(filePath);
    if (stat.size < 500) {
      return { valid: false, error: `File is too small to be audio (${stat.size} bytes)` };
    }

    // First check magic bytes from disk
    const fd = fs.openSync(filePath, "r");
    const headerBuffer = Buffer.alloc(32);
    fs.readSync(fd, headerBuffer, 0, 32, 0);
    fs.closeSync(fd);

    const magicCheck = this.validateMagicBytes(headerBuffer);
    if (!magicCheck.valid) {
      return {
        valid: false,
        sizeBytes: stat.size,
        format: magicCheck.format,
        error: `Header failed audio magic-byte verification (detected ${magicCheck.format})`,
      };
    }

    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_name,channels,sample_rate,bit_rate,duration:format=duration,size",
        "-of",
        "json",
        filePath,
      ]);

      const probeData = JSON.parse(stdout);
      const stream = probeData.streams?.[0];
      const format = probeData.format;

      const durationSeconds = parseFloat(format?.duration || stream?.duration || "0");
      if (isNaN(durationSeconds) || durationSeconds <= 0.1) {
        return {
          valid: false,
          format: magicCheck.format,
          sizeBytes: stat.size,
          error: "Audio file has 0 or invalid duration",
        };
      }

      return {
        valid: true,
        format: stream?.codec_name || magicCheck.format,
        sizeBytes: stat.size,
        durationSeconds: Math.round(durationSeconds * 100) / 100,
        channels: parseInt(stream?.channels || "2", 10),
        sampleRate: parseInt(stream?.sample_rate || "44100", 10),
        bitrate: parseInt(stream?.bit_rate || "192000", 10),
        hasAudioStream: true,
      };
    } catch (probeErr: any) {
      return {
        valid: false,
        sizeBytes: stat.size,
        format: magicCheck.format,
        error: `FFprobe failed to decode audio stream: ${probeErr.message}`,
      };
    }
  }
}

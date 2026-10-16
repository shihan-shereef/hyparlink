import { spawn, execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { AudioMixOptions, AudioMixResult } from './types.js';

const execFileAsync = util.promisify(execFile);

export class AudioMixer {
  /**
   * Mixes background music with speech/narration and video using FFmpeg.
   * Supports intelligent speech-aware ducking (sidechain compression),
   * broadcast loudness normalization (-16 LUFS), smooth intro/outro fades,
   * and stream verification with ffprobe.
   */
  async mixVideoAudio(options: AudioMixOptions): Promise<AudioMixResult> {
    const {
      videoInputPath,
      musicTrackPath,
      speechAudioPath,
      outputPath,
      musicVolume = 0.35,
      speechVolume = 1.0,
      enableDucking = true,
      fadeInDurationSeconds = 1.5,
      fadeOutDurationSeconds = 2.0,
      targetDurationSeconds,
      normalizeLoudness = true,
    } = options;

    if (!fs.existsSync(videoInputPath)) {
      throw new Error(`Video file does not exist: ${videoInputPath}`);
    }
    if (!fs.existsSync(musicTrackPath)) {
      throw new Error(`Music file does not exist: ${musicTrackPath}`);
    }

    const duration = targetDurationSeconds || (await this.getMediaDuration(videoInputPath));
    const fadeOutStart = Math.max(0, duration - fadeOutDurationSeconds);

    const hasSpeech = !!(speechAudioPath && fs.existsSync(speechAudioPath));

    const ffmpegArgs: string[] = ['-y'];

    // Input 0: Video
    ffmpegArgs.push('-i', videoInputPath);

    // Input 1: Music (loopable to fill duration)
    ffmpegArgs.push('-stream_loop', '-1', '-i', musicTrackPath);

    if (hasSpeech && speechAudioPath) {
      // Input 2: Speech
      ffmpegArgs.push('-i', speechAudioPath);

      if (enableDucking) {
        const attack = options.duckingAttackMs || 80;
        const release = options.duckingReleaseMs || 450;
        // Convert dB attenuation (e.g. -14dB) to linear threshold if provided
        const threshold = options.duckingAttenuationDb
          ? Math.max(0.01, Math.min(0.5, Math.pow(10, options.duckingAttenuationDb / 20)))
          : 0.08;

        // Speech-aware ducking via sidechain compression:
        // Speech stream is padded with silence so sidechain detection and mix span the entire video duration
        const filterComplex = [
          `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${musicVolume},afade=t=in:st=0:d=${fadeInDurationSeconds},afade=t=out:st=${fadeOutStart}:d=${fadeOutDurationSeconds}[bgm_raw]`,
          `[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=${speechVolume},apad=whole_dur=${duration.toFixed(2)},asplit=2[speech_sc][speech_mix]`,
          `[bgm_raw][speech_sc]sidechaincompress=threshold=${threshold.toFixed(3)}:ratio=8:attack=${attack}:release=${release}[ducked_bgm]`,
          `[ducked_bgm][speech_mix]amix=inputs=2:duration=longest:dropout_transition=2:weights=0.9 1.0[mix_raw]`,
          normalizeLoudness ? `[mix_raw]loudnorm=I=-16:TP=-1.5:LRA=11[aout]` : `[mix_raw]anull[aout]`,
        ].join(';');

        ffmpegArgs.push('-filter_complex', filterComplex);
      } else {
        const filterComplex = [
          `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${musicVolume},afade=t=in:st=0:d=${fadeInDurationSeconds},afade=t=out:st=${fadeOutStart}:d=${fadeOutDurationSeconds}[bgm]`,
          `[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=${speechVolume},apad=whole_dur=${duration.toFixed(2)}[speech]`,
          `[bgm][speech]amix=inputs=2:duration=longest:weights=0.8 1.0[mix]`,
          normalizeLoudness ? `[mix]loudnorm=I=-16:TP=-1.5:LRA=11[aout]` : `[mix]anull[aout]`,
        ].join(';');
        ffmpegArgs.push('-filter_complex', filterComplex);
      }

      ffmpegArgs.push(
        '-map',
        '0:v:0',
        '-map',
        '[aout]',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-t',
        duration.toFixed(2),
        outputPath
      );
    } else {
      // Music only (no speech)
      const filterComplex = [
        `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${musicVolume},afade=t=in:st=0:d=${fadeInDurationSeconds},afade=t=out:st=${fadeOutStart}:d=${fadeOutDurationSeconds}${
          normalizeLoudness ? ',loudnorm=I=-16:TP=-1.5:LRA=11' : ''
        }[aout]`,
      ].join(';');

      ffmpegArgs.push(
        '-filter_complex',
        filterComplex,
        '-map',
        '0:v:0',
        '-map',
        '[aout]',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-t',
        duration.toFixed(2),
        outputPath
      );
    }

    // Execute FFmpeg
    await this.runFfmpeg(ffmpegArgs);

    // Verify output with FFprobe
    const verification = await this.verifyAudioStream(outputPath);

    const trackName = path.basename(musicTrackPath, path.extname(musicTrackPath));

    return {
      success: verification.hasAudioStream,
      outputPath,
      videoDurationSeconds: duration,
      audioDurationSeconds: verification.duration,
      hasSpeechTrack: hasSpeech,
      duckingApplied: hasSpeech ? enableDucking : false,
      soundtrackId: trackName,
      soundtrackTitle: trackName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      format: 'mp4',
    };
  }

  async getMediaDuration(filePath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ]);
      const dur = parseFloat(stdout.trim());
      return isNaN(dur) ? 60 : dur;
    } catch {
      return 60;
    }
  }

  async verifyAudioStream(filePath: string): Promise<{
    hasAudioStream: boolean;
    duration: number;
    channels: number;
    sampleRate: number;
  }> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'a:0',
        '-show_entries',
        'stream=channels,sample_rate,duration',
        '-of',
        'json',
        filePath,
      ]);

      const data = JSON.parse(stdout);
      const stream = data.streams?.[0];
      const hasAudio = !!stream;
      const duration = stream?.duration ? parseFloat(stream.duration) : await this.getMediaDuration(filePath);

      return {
        hasAudioStream: hasAudio,
        duration,
        channels: stream?.channels || 2,
        sampleRate: stream?.sample_rate ? parseInt(stream.sample_rate) : 48000,
      };
    } catch {
      return {
        hasAudioStream: false,
        duration: 0,
        channels: 0,
        sampleRate: 0,
      };
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args);
      let stderr = '';

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}:\n${stderr.slice(-1000)}`));
        }
      });

      proc.on('error', reject);
    });
  }
}

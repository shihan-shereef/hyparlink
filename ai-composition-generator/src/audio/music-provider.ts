import fs from 'fs';
import path from 'path';
import https from 'https';
import {
  MusicTrack,
  MusicSearchQuery,
  IMusicProvider,
  MusicProviderType,
} from './types.js';
import { WorkspaceMusicProvider } from './workspace-music-provider.js';
import { MixkitMusicProvider } from './mixkit-music-provider.js';
import { PixabayMusicProvider } from './pixabay-music-provider.js';
import { YouTubeAudioLibraryProvider } from './youtube-library-provider.js';
import { AudioValidator } from './audio-validator.js';

/**
 * InternalCatalogProvider: Serves pre-indexed, verified commercial-safe soundtracks.
 */
export class InternalCatalogProvider implements IMusicProvider {
  name = 'Internal Verified Catalog';
  providerType: MusicProviderType = 'internal_catalog';
  private catalog: MusicTrack[] = [];

  constructor(customCatalogPath?: string) {
    this.loadCatalog(customCatalogPath);
  }

  isConfigured(): boolean {
    return true;
  }

  private loadCatalog(customCatalogPath?: string) {
    try {
      const moduleDir = path.dirname(new URL(import.meta.url).pathname);
      const candidates = [
        customCatalogPath,
        path.resolve(moduleDir, 'music-catalog.json'),
        path.resolve(moduleDir, '../../src/audio/music-catalog.json'),
        path.resolve(process.cwd(), 'ai-composition-generator/src/audio/music-catalog.json'),
        path.resolve(process.cwd(), '../ai-composition-generator/src/audio/music-catalog.json'),
        path.resolve(process.cwd(), 'apps/app/public/audio/music-catalog.json'),
      ].filter(Boolean) as string[];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf8');
          this.catalog = JSON.parse(raw);
          return;
        }
      }
      this.catalog = [];
    } catch (err) {
      console.warn('[InternalCatalogProvider] Failed to load catalog JSON:', err);
      this.catalog = [];
    }
  }

  async search(query: MusicSearchQuery): Promise<MusicTrack[]> {
    if (!this.catalog.length) {
      this.loadCatalog();
    }

    return this.catalog.filter((track) => {
      // 1. Mandatory licensing check - commercial suitability
      if (!track.commercialSafe) return false;

      // 2. Vocals check
      if (query.instrumentalOnly && track.hasVocals) return false;

      // 3. Narration suitability
      if (query.suitableForNarration && track.suitableForNarration === false) return false;

      // 4. Keyword / Mood / Genre match
      if (query.keywords && query.keywords.length > 0) {
        const qText = query.keywords.join(' ').toLowerCase();
        const trackText = [
          track.title,
          track.genre,
          ...(track.subgenres || []),
          ...track.moods,
          ...track.instruments,
          ...(track.tags || []),
        ]
          .join(' ')
          .toLowerCase();

        const words = qText.split(/\s+/).filter(Boolean);
        const matchesAny = words.some((w: string) => trackText.includes(w));
        if (!matchesAny) return false;
      }

      return true;
    });
  }

  async getTrackById(id: string): Promise<MusicTrack | null> {
    if (!this.catalog.length) this.loadCatalog();
    return this.catalog.find((t) => t.id === id) || null;
  }

  async verifyAndDownload(track: MusicTrack, targetDir: string): Promise<string> {
    const rootDirs = [
      process.cwd(),
      path.resolve(process.cwd(), '..'),
      '/Users/apple/Desktop/hyparlink dashbord',
    ];

    const possiblePaths: string[] = [];
    for (const r of rootDirs) {
      if (track.localPath) possiblePaths.push(path.resolve(r, track.localPath));
      possiblePaths.push(path.resolve(r, `apps/app/public/audio/bgm/${track.id}.mp3`));
      possiblePaths.push(path.resolve(r, `backend-echo/storage/audio/bgm/${track.id}.mp3`));
      possiblePaths.push(path.resolve(r, `public/audio/bgm/${track.id}.mp3`));
      if (track.url) possiblePaths.push(path.resolve(r, `apps/app/public/${track.url.replace(/^\//, '')}`));
    }

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const inspection = await AudioValidator.inspectAudioFile(p);
        if (inspection.valid) {
          return p;
        }
      }
    }

    throw new Error(`[InternalCatalogProvider] Track ${track.id} audio file not found on disk or invalid.`);
  }
}

/**
 * FreesoundProvider: Queries Freesound API (if FREESOUND_API_KEY is configured).
 * Strictly filters for commercial-safe Creative Commons (CC0 or CC-BY).
 */
export class FreesoundProvider implements IMusicProvider {
  name = 'Freesound (Creative Commons)';
  providerType: MusicProviderType = 'freesound';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.FREESOUND_API_KEY || '';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async search(query: MusicSearchQuery): Promise<MusicTrack[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const q = encodeURIComponent(query.keywords?.slice(0, 3).join(' ') || 'music background');
      const url = `https://freesound.org/apiv2/search/text/?query=${q}&filter=license:"Creative Commons 0" OR license:"Attribution"&fields=id,name,tags,duration,previews,license,username&token=${this.apiKey}`;

      const data = await this.httpGetJson(url);
      if (!data || !data.results) return [];

      return data.results.map((r: any): MusicTrack => {
        const isCC0 = (r.license || '').toLowerCase().includes('0');
        const previewUrl = r.previews?.['preview-hq-mp3'] || '';
        return {
          id: `freesound_${r.id}`,
          title: r.name,
          artist: r.username || 'Freesound Creator',
          genre: 'Creative Commons Audio',
          subgenres: ['Ambient', 'Soundscape'],
          moods: r.tags || [],
          instruments: [],
          bpm: 100,
          durationSeconds: Math.round(r.duration || 60),
          energyLevel: 5,
          isInstrumental: true,
          hasVocals: false,
          license: isCC0 ? 'CC0' : 'CC-BY',
          commercialSafe: true,
          audioFormat: 'mp3',
          localPath: '',
          url: previewUrl,
          downloadUrl: previewUrl,
          provider: 'freesound',
          tags: r.tags || [],
          suitableForNarration: true,
          licenseInfo: {
            name: isCC0 ? 'Creative Commons CC0 1.0 Universal' : 'Creative Commons Attribution (CC BY)',
            url: isCC0 ? 'https://creativecommons.org/publicdomain/zero/1.0/' : 'https://creativecommons.org/licenses/by/4.0/',
            commercialSafe: true,
            attributionRequired: !isCC0,
            attributionText: `Audio: "${r.name}" by ${r.username} (Freesound, ${isCC0 ? 'CC0' : 'CC BY'})`,
            verified: true,
            verificationSource: 'Freesound API v2',
            permittedUseSummary: isCC0 ? 'Public Domain' : 'Attribution required for commercial video',
          },
        };
      });
    } catch (err) {
      console.warn('[FreesoundProvider] Search failed:', err);
      return [];
    }
  }

  async getTrackById(id: string): Promise<MusicTrack | null> {
    return null;
  }

  async verifyAndDownload(track: MusicTrack, targetDir: string): Promise<string> {
    const url = track.downloadUrl || track.url;
    if (!url) throw new Error('No download URL available for Freesound track.');
    if (!AudioValidator.validateSafeUrl(url)) {
      throw new Error(`SSRF validation failed for URL: ${url}`);
    }

    const targetFile = path.join(targetDir, `${track.id}.mp3`);
    if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 1000) {
      return targetFile;
    }
    await this.downloadFile(url, targetFile);

    const check = await AudioValidator.inspectAudioFile(targetFile);
    if (!check.valid) {
      fs.unlinkSync(targetFile);
      throw new Error(`Downloaded audio file failed inspection: ${check.error}`);
    }

    return targetFile;
  }

  private httpGetJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let body = '';
          res.on('data', (d) => (body += d));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https
        .get(url, (response) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => reject(err));
        });
    });
  }
}

/**
 * CompositeMusicProvider:
 * Unified music discovery hub aggregating:
 * 1. WorkspaceMusicProvider (#1 Priority: User Uploads & Media Library)
 * 2. InternalCatalogProvider (Verified Commercial Royalty-Free Masters)
 * 3. MixkitMusicProvider (Mixkit Free License Music)
 * 4. PixabayMusicProvider (Approved Pixabay License Workflow)
 * 5. YouTubeAudioLibraryProvider (Approved YouTube Audio Library Workflow)
 * 6. FreesoundProvider (CC0/CC-BY when API key is provided)
 */
export class CompositeMusicProvider implements IMusicProvider {
  name = 'Composite Music Provider';
  providerType: MusicProviderType = 'internal_catalog';
  private providers: IMusicProvider[] = [];
  private workspaceProvider: WorkspaceMusicProvider;
  private internalCatalogProvider: InternalCatalogProvider;
  private mixkitProvider: MixkitMusicProvider;
  private pixabayProvider: PixabayMusicProvider;
  private youtubeProvider: YouTubeAudioLibraryProvider;
  private freesoundProvider: FreesoundProvider;

  constructor() {
    this.workspaceProvider = new WorkspaceMusicProvider();
    this.internalCatalogProvider = new InternalCatalogProvider();
    this.mixkitProvider = new MixkitMusicProvider();
    this.pixabayProvider = new PixabayMusicProvider();
    this.youtubeProvider = new YouTubeAudioLibraryProvider();
    this.freesoundProvider = new FreesoundProvider();

    // Priority order: Workspace first, then verified catalog, Mixkit, Pixabay, YouTube, Freesound
    this.providers = [
      this.workspaceProvider,
      this.internalCatalogProvider,
      this.mixkitProvider,
      this.pixabayProvider,
      this.youtubeProvider,
    ];

    if (this.freesoundProvider.isConfigured()) {
      this.providers.push(this.freesoundProvider);
    }
  }

  isConfigured(): boolean {
    return true;
  }

  getProviders(): Array<{ name: string; type: MusicProviderType; configured: boolean; notice?: string }> {
    return [
      { name: this.workspaceProvider.name, type: "workspace", configured: true },
      { name: this.internalCatalogProvider.name, type: "internal_catalog", configured: true },
      { name: this.mixkitProvider.name, type: "mixkit", configured: true },
      { name: this.pixabayProvider.name, type: "pixabay", configured: this.pixabayProvider.isConfigured(), notice: this.pixabayProvider.getApiNotice() },
      { name: this.youtubeProvider.name, type: "youtube_library", configured: true, notice: this.youtubeProvider.getApiNotice() },
      { name: this.freesoundProvider.name, type: "freesound", configured: this.freesoundProvider.isConfigured() },
    ];
  }

  async search(query: MusicSearchQuery): Promise<MusicTrack[]> {
    // If a specific provider is requested by the query, route solely to it
    if (query.provider) {
      const matched = this.providers.find((p) => p.providerType === query.provider);
      if (matched) {
        return matched.search(query);
      }
    }

    const results: MusicTrack[] = [];
    const seenIds = new Set<string>();

    for (const provider of this.providers) {
      try {
        const tracks = await provider.search(query);
        for (const t of tracks) {
          if (!seenIds.has(t.id)) {
            seenIds.add(t.id);
            results.push(t);
          }
        }
      } catch (err) {
        console.warn(`[CompositeMusicProvider] Provider ${provider.name} failed:`, err);
      }
    }

    if (results.length === 0) {
      // Fallback: search internal catalog with relaxed keywords
      const fallback = await this.internalCatalogProvider.search({ ...query, keywords: [] });
      return fallback;
    }

    return results;
  }

  async getTrackById(id: string): Promise<MusicTrack | null> {
    for (const p of this.providers) {
      const track = await p.getTrackById(id);
      if (track) return track;
    }
    return null;
  }

  async verifyAndDownload(track: MusicTrack, targetDir: string): Promise<string> {
    for (const p of this.providers) {
      try {
        const downloadedPath = await p.verifyAndDownload(track, targetDir);
        if (downloadedPath && fs.existsSync(downloadedPath)) {
          return downloadedPath;
        }
      } catch {
        // Try next provider
      }
    }
    throw new Error(`Unable to verify or download track ${track.id} from any provider.`);
  }
}

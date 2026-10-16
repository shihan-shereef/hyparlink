import fs from "fs";
import path from "path";
import crypto from "crypto";
import { IMusicProvider, MusicTrack, MusicSearchQuery, MusicProviderType } from "./types.js";
import { AudioValidator } from "./audio-validator.js";

export class WorkspaceMusicProvider implements IMusicProvider {
  name = "User Workspace & Audio Library";
  providerType: MusicProviderType = "workspace";

  isConfigured(): boolean {
    return true; // Always active
  }

  async search(query: MusicSearchQuery): Promise<MusicTrack[]> {
    const candidateDirs = [
      path.resolve(process.cwd(), "apps/app/public/audio/custom"),
      path.resolve(process.cwd(), "backend-echo/storage/audio/custom"),
      path.resolve(process.cwd(), "storage/audio/custom"),
      path.resolve(process.cwd(), "assets/audio"),
    ];

    const discoveredTracks: MusicTrack[] = [];
    const seenFiles = new Set<string>();

    for (const dir of candidateDirs) {
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (![".mp3", ".wav", ".m4a", ".aac", ".ogg"].includes(ext)) continue;

        const fullPath = path.join(dir, file);
        if (seenFiles.has(fullPath)) continue;
        seenFiles.add(fullPath);

        const inspection = await AudioValidator.inspectAudioFile(fullPath);
        if (!inspection.valid || !inspection.durationSeconds) continue;

        // Extract metadata from filename: e.g. "cinematic_drums_user.mp3"
        const cleanName = path.basename(file, ext).replace(/[_-]+/g, " ");
        const hash = crypto.createHash("sha256").update(fs.readFileSync(fullPath).slice(0, 4096)).digest("hex").slice(0, 12);
        const trackId = `workspace_${hash}`;

        const track: MusicTrack = {
          id: trackId,
          title: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
          artist: "User Workspace Media",
          genre: "User Uploaded",
          subgenres: ["Custom Audio"],
          moods: cleanName.toLowerCase().split(/\s+/),
          instruments: [],
          bpm: 110,
          durationSeconds: inspection.durationSeconds,
          energyLevel: 6,
          isInstrumental: true,
          hasVocals: false,
          isLoopable: true,
          license: "Royalty-Free Commercial",
          commercialSafe: true,
          audioFormat: inspection.format || ext.replace(".", ""),
          localPath: fullPath,
          url: `/audio/custom/${file}`,
          provider: "workspace",
          tags: ["user", "custom", "imported", ...cleanName.toLowerCase().split(/\s+/)],
          suitableForNarration: true,
          licenseInfo: {
            name: "User Workspace Asset",
            url: "local://workspace",
            commercialSafe: true,
            attributionRequired: false,
            attributionText: "Audio provided by user workspace",
            verified: true,
            verificationSource: "Local File System",
            permittedUseSummary: "User-imported asset authorized for project synthesis",
          },
          provenance: {
            provider: "workspace",
            trackId,
            trackTitle: cleanName,
            artist: "User Workspace",
            sourceUrl: "local://workspace",
            downloadTimestamp: Date.now(),
            licenseName: "User Workspace Asset",
            licenseUrl: "local://workspace",
            attributionRequired: false,
            attributionText: "Audio provided by user workspace",
            commercialSafe: true,
            localPath: fullPath,
            fileFormat: inspection.format || "mp3",
            durationSeconds: inspection.durationSeconds,
            contentHash: hash,
          },
        };

        discoveredTracks.push(track);
      }
    }

    if (!query.keywords || query.keywords.length === 0) {
      return discoveredTracks;
    }

    const qWords = query.keywords.map((k) => k.toLowerCase());
    return discoveredTracks.filter((t) => {
      const text = `${t.title} ${t.genre} ${t.tags.join(" ")}`.toLowerCase();
      return qWords.some((w) => text.includes(w));
    });
  }

  async getTrackById(id: string): Promise<MusicTrack | null> {
    const all = await this.search({});
    return all.find((t) => t.id === id) || null;
  }

  async verifyAndDownload(track: MusicTrack, targetDir: string): Promise<string> {
    if (track.localPath && fs.existsSync(track.localPath)) {
      const valid = await AudioValidator.inspectAudioFile(track.localPath);
      if (!valid.valid) {
        throw new Error(`Workspace track failed validation: ${valid.error}`);
      }
      return track.localPath;
    }
    throw new Error(`Workspace audio file missing on disk: ${track.localPath}`);
  }
}

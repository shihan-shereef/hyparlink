export interface TimelineSyncCue {
  timestampSeconds: number;
  event: "intro_reveal" | "scene_transition" | "feature_card" | "climax" | "product_reveal" | "logo_outro";
  targetIntensity: "low" | "medium" | "high" | "peak";
  description?: string;
}

export interface NarrationDialogueRequirements {
  hasSpeech: boolean;
  speechDurationSeconds?: number;
  speechSegments?: Array<{ start: number; end: number }>;
  duckingRequired: boolean;
  duckingAttenuationDb?: number; // e.g. -14dB
  duckingAttackMs?: number;      // e.g. 80ms
  duckingReleaseMs?: number;     // e.g. 450ms
}

export interface MusicBrief {
  videoTitle: string;
  videoSubject: string;
  videoCategory: string; // e.g. "brand_advertisement", "tech_showcase", "corporate_pitch", "cinematic_trailer", "product_demo", "lifestyle_vlog", "educational", "nature_documentary"
  intendedAudience: string;
  emotionalTone: string[]; // e.g. ["luxurious", "inspirational", "majestic", "calm", "confident", "playful"]
  energyLevel: "serene" | "low" | "medium" | "high" | "building" | "epic";
  desiredMusicalAtmosphere: string;
  musicGenre: string; // e.g. "cinematic-orchestral", "tech-electronic", "corporate-acoustic", "lofi-chill", "ambient-nature", "epic-trailer", "minimal-synth"
  instrumentPreferences: string[]; // e.g. ["strings", "piano", "analog synths", "percussion"]
  tempoBpmRange: {
    min: number;
    max: number;
    target: number;
  };
  cinematicIntensity: "subtle" | "moderate" | "intense" | "epic";
  vocalPreference: "instrumental_only" | "subtle_textures" | "vocals_allowed";
  musicDurationSeconds: number;
  timelineSyncCues: TimelineSyncCue[];
  majorVisualReveals: string[];
  narrationRequirements: NarrationDialogueRequirements;
  endingStyle: "fade_out" | "climactic_hit" | "peaceful_resolution" | "looping";
  licensingRequirements: "royalty_free_commercial_safe";
  rawExplanation?: string;
  searchQueries?: string[];
  avoid?: string[];
}

export interface MusicLicenseInfo {
  name: string; // e.g. "Mixkit Free License", "CC0 1.0", "CC BY 4.0", "Pixabay License", "YouTube Audio Library License", "Royalty-Free Commercial"
  url: string;  // official terms URL
  commercialSafe: boolean;
  attributionRequired: boolean;
  attributionText: string;
  verified: boolean;
  verificationSource: string;
  permittedUseSummary: string;
}

export interface TrackProvenance {
  provider: string;
  trackId: string;
  trackTitle: string;
  artist: string;
  sourceUrl: string;
  downloadTimestamp: number;
  licenseName: string;
  licenseUrl: string;
  attributionRequired: boolean;
  attributionText: string;
  commercialSafe: boolean;
  localPath: string;
  fileFormat: string;
  durationSeconds: number;
  contentHash?: string;
}

export type MusicProviderType =
  | "workspace"
  | "internal_catalog"
  | "mixkit"
  | "pixabay"
  | "youtube_library"
  | "freesound"
  | "custom_upload";

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  subgenres?: string[];
  moods: string[];
  instruments: string[];
  bpm: number;
  durationSeconds: number;
  energyLevel: number; // 1 to 10 scale
  isInstrumental: boolean;
  hasVocals: boolean;
  isLoopable?: boolean;
  license: "CC0" | "CC-BY" | "Mixkit Free License" | "Pixabay License" | "YouTube Audio Library License" | "Royalty-Free Commercial" | "Proprietary";
  licenseInfo?: MusicLicenseInfo;
  commercialSafe: boolean;
  loudnessLufs?: number;
  audioFormat: string; // "mp3" | "wav" | "aac" | "ogg"
  localPath: string;
  url: string;
  downloadUrl?: string;
  provider: MusicProviderType;
  tags: string[];
  suitableForNarration?: boolean;
  provenance?: TrackProvenance;
  rankingScore?: number;
  rankingReason?: string;
  scoreBreakdown?: {
    moodScore: number;
    genreScore: number;
    subjectSynergyScore: number;
    energyPacingScore: number;
    durationSuitabilityScore: number;
    vocalSuitabilityScore: number;
    audioQualityScore: number;
    licensingScore?: number;
    totalScore: number;
  };
}

export interface MusicSearchQuery {
  keywords?: string[];
  genre?: string;
  moods?: string[];
  energyLevel?: "serene" | "low" | "medium" | "high" | "building" | "epic";
  bpmTarget?: number;
  durationSeconds?: number;
  instrumentalOnly?: boolean;
  suitableForNarration?: boolean;
  provider?: MusicProviderType;
  limit?: number;
}

export interface IMusicProvider {
  name: string;
  providerType: MusicProviderType;
  isConfigured(): boolean;
  search(query: MusicSearchQuery): Promise<MusicTrack[]>;
  getTrackById(id: string): Promise<MusicTrack | null>;
  verifyAndDownload(track: MusicTrack, targetDir: string): Promise<string>;
}

export interface MusicRankingResult {
  bestCandidate: MusicTrack;
  candidates: MusicTrack[];
  brief: MusicBrief;
  selectionReason: string;
  evaluatedCount: number;
  eligibleCount: number;
}

export interface MusicSettings {
  autoMusicEnabled: boolean;
  preferredStyle?: string; // "cinematic" | "orchestral" | "electronic" | "corporate" | "ambient" | "emotional" | "action" | "inspirational" | "nature" | "comedy" | "custom"
  preferredProvider?: "auto" | "workspace" | "mixkit" | "pixabay" | "youtube_library" | "catalog";
  providerPriority?: MusicProviderType[];
  pixabayEnabled: boolean;
  pixabayApiKey?: string;
  mixkitEnabled: boolean;
  youtubeLibraryEnabled: boolean;
  workspaceEnabled: boolean;
  freesoundEnabled: boolean;
  freesoundApiKey?: string;
  musicVolume: number; // 0.0 to 1.0 (default 0.35)
  speechVolume: number; // default 1.0
  fadeInDurationSeconds: number; // default 1.0
  fadeOutDurationSeconds: number; // default 2.0
  enableDucking: boolean;
  duckingAttenuationDb: number; // default -14
  preserveNarration: boolean;
  requireLicenseVerification: boolean;
  displayAttribution: boolean;
}

export interface AudioMixOptions {
  videoInputPath: string;
  musicTrackPath: string;
  speechAudioPath?: string | null;
  targetDurationSeconds?: number;
  musicVolume?: number; // 0.0 to 1.0 (default 0.35)
  speechVolume?: number; // default 1.0
  enableDucking?: boolean;
  duckingAttenuationDb?: number; // default -14dB
  duckingAttackMs?: number; // default 80ms
  duckingReleaseMs?: number; // default 450ms
  fadeInDurationSeconds?: number; // default 1.0
  fadeOutDurationSeconds?: number; // default 2.0
  normalizeLoudness?: boolean; // default true (-16 LUFS)
  outputPath: string;
}

export interface AudioMixResult {
  success: boolean;
  outputPath: string;
  videoDurationSeconds: number;
  audioDurationSeconds: number;
  hasSpeechTrack: boolean;
  duckingApplied: boolean;
  soundtrackId: string;
  soundtrackTitle: string;
  soundtrackArtist?: string;
  licenseName?: string;
  attributionText?: string;
  loudnessLufs?: number;
  format: string;
  error?: string;
}

export interface AudioValidationResult {
  valid: boolean;
  mimeType?: string;
  format?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  bitrate?: number;
  channels?: number;
  sampleRate?: number;
  hasAudioStream?: boolean;
  error?: string;
}

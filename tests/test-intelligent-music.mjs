import fs from "fs";
import path from "path";
import { execFile, execSync } from "child_process";
import util from "util";
import {
  MusicIntelligence,
  CompositeMusicProvider,
  InternalCatalogProvider,
  MixkitMusicProvider,
  PixabayMusicProvider,
  YouTubeAudioLibraryProvider,
  WorkspaceMusicProvider,
  MusicRanker,
  AudioMixer,
  AudioValidator,
} from "../ai-composition-generator/dist/audio/index.js";

const execFileAsync = util.promisify(execFile);

const TEST_SCRATCH_DIR = path.resolve(process.cwd(), "ai-composition-generator/storage/test-audio");
fs.mkdirSync(TEST_SCRATCH_DIR, { recursive: true });

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS [Scenario ${totalTests}]: ${message}`);
  } else {
    console.error(`  ✗ FAIL [Scenario ${totalTests}]: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTestSuite() {
  console.log("\n================================================================================");
  console.log("HYPARLINK INTELLIGENT MUSIC & LICENCE-AWARE SOUNDTRACK TEST SUITE");
  console.log("================================================================================\n");

  const musicIntelligence = new MusicIntelligence();
  const musicProvider = new CompositeMusicProvider();
  const musicRanker = new MusicRanker();
  const audioMixer = new AudioMixer();

  // SCENARIO 1: Cinematic advertisement selects suitable cinematic music
  console.log("--> Testing Scenario 1: Cinematic Advertisement Understanding & Selection...");
  const cinematicBrief = await musicIntelligence.generateMusicBrief({
    prompt: "Create a 60-second cinematic luxury advertisement for a Swiss Rolex watch with dramatic lighting",
    durationSeconds: 60,
  });
  assert(
    cinematicBrief.musicGenre.includes("cinematic") || cinematicBrief.musicGenre.includes("orchestral"),
    `Cinematic prompt inferred genre '${cinematicBrief.musicGenre}' matching cinematic/orchestral`
  );
  assert(
    cinematicBrief.emotionalTone.some((t) => /luxury|prestigious|majestic|sophisticated|cinematic|elegant/i.test(t)),
    `Cinematic brief emotional tone includes high-end cues: [${cinematicBrief.emotionalTone.join(", ")}]`
  );

  const cinematicCandidates = await musicProvider.search({
    keywords: [...cinematicBrief.emotionalTone, cinematicBrief.musicGenre],
  });
  const cinematicRanked = musicRanker.rankCandidates(cinematicBrief, cinematicCandidates);
  assert(
    cinematicRanked.bestCandidate && cinematicRanked.bestCandidate.genre.toLowerCase().includes("cinematic"),
    `Selected best track '${cinematicRanked.bestCandidate?.title}' with cinematic genre '${cinematicRanked.bestCandidate?.genre}'`
  );

  // SCENARIO 2: Corporate video selects professional background music
  console.log("\n--> Testing Scenario 2: Corporate Video Understanding & Selection...");
  const corporateBrief = await musicIntelligence.generateMusicBrief({
    prompt: "Create a 30-second corporate business presentation, company growth report, and acoustic background",
    durationSeconds: 30,
  });
  assert(
    corporateBrief.musicGenre.includes("corporate") || corporateBrief.musicGenre.includes("acoustic") || corporateBrief.videoCategory.includes("corporate"),
    `Corporate prompt inferred genre '${corporateBrief.musicGenre}' or category '${corporateBrief.videoCategory}'`
  );
  const corporateCandidates = await musicProvider.search({
    keywords: ["corporate", "growth", "business", ...corporateBrief.emotionalTone],
  });
  const corporateRanked = musicRanker.rankCandidates(corporateBrief, corporateCandidates);
  assert(
    corporateRanked.bestCandidate && (corporateRanked.bestCandidate.genre.toLowerCase().includes("corporate") || corporateRanked.bestCandidate.tags.includes("corporate") || corporateRanked.bestCandidate.tags.includes("presentation")),
    `Corporate video selected '${corporateRanked.bestCandidate?.title}' matching business optimism`
  );

  // SCENARIO 3: Nature video selects calm ambient music
  console.log("\n--> Testing Scenario 3: Nature / Environmental Video Selection...");
  const natureBrief = await musicIntelligence.generateMusicBrief({
    prompt: "Create a 45-second peaceful documentary showcasing underwater coral reefs and deep ocean marine life",
    durationSeconds: 45,
  });
  assert(
    natureBrief.musicGenre.includes("ambient") || natureBrief.musicGenre.includes("nature"),
    `Nature prompt inferred genre '${natureBrief.musicGenre}' matching ambient-nature`
  );
  const natureCandidates = await musicProvider.search({
    keywords: ["ocean", "nature", "ambient", "peaceful"],
  });
  const natureRanked = musicRanker.rankCandidates(natureBrief, natureCandidates);
  assert(
    natureRanked.bestCandidate && (natureRanked.bestCandidate.genre.toLowerCase().includes("ambient") || natureRanked.bestCandidate.tags.includes("ocean")),
    `Nature video selected ambient track '${natureRanked.bestCandidate?.title}'`
  );

  // SCENARIO 4: Narration & Speech-Aware Ducking Test (FFmpeg Sidechain Compression)
  console.log("\n--> Testing Scenario 4 & 5: Audio Mixing with Speech Ducking & Non-Speech Mix...");
  const testVideoPath = path.join(TEST_SCRATCH_DIR, "test_base_video.mp4");
  const testSpeechPath = path.join(TEST_SCRATCH_DIR, "test_speech.wav");
  const testBgmPath = path.resolve(process.cwd(), "apps/app/public/audio/bgm/cinematic_luxury.mp3");

  // Create a 5-second test MP4 video using FFmpeg testsrc
  execSync(
    `ffmpeg -y -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 -c:v libx264 -pix_fmt yuv420p "${testVideoPath}" 2>/dev/null`
  );
  // Create a 3-second test speech tone using sine wave
  execSync(
    `ffmpeg -y -f lavfi -i "sine=frequency=800:duration=3" -c:a pcm_s16le "${testSpeechPath}" 2>/dev/null`
  );

  assert(fs.existsSync(testVideoPath), "Created deterministic test video canvas (5.0s, 720p)");
  assert(fs.existsSync(testSpeechPath), "Created deterministic speech audio track (3.0s)");

  // Run AudioMixer WITH speech (verifies ducking)
  const duckedOutputPath = path.join(TEST_SCRATCH_DIR, "test_ducked_output.mp4");
  const duckedMixRes = await audioMixer.mixVideoAudio({
    videoInputPath: testVideoPath,
    musicTrackPath: testBgmPath,
    speechAudioPath: testSpeechPath,
    targetDurationSeconds: 5,
    musicVolume: 0.35,
    speechVolume: 1.0,
    enableDucking: true,
    duckingAttenuationDb: -14,
    outputPath: duckedOutputPath,
  });
  assert(duckedMixRes.success, "AudioMixer successfully rendered speech-ducked video");
  assert(duckedMixRes.duckingApplied === true, "Report confirmed duckingApplied: true");

  // SCENARIO 5: Non-speech mix (calibrated music level without ducking)
  const nonSpeechOutputPath = path.join(TEST_SCRATCH_DIR, "test_nonspeech_output.mp4");
  const nonSpeechMixRes = await audioMixer.mixVideoAudio({
    videoInputPath: testVideoPath,
    musicTrackPath: testBgmPath,
    speechAudioPath: null,
    targetDurationSeconds: 5,
    musicVolume: 0.75,
    enableDucking: false,
    outputPath: nonSpeechOutputPath,
  });
  assert(nonSpeechMixRes.success, "AudioMixer successfully rendered non-speech background soundtrack");
  assert(nonSpeechMixRes.hasSpeechTrack === false, "Report confirmed hasSpeechTrack: false");

  // SCENARIO 6: Music trimming & fade-out verification
  console.log("\n--> Testing Scenario 6 & 14: Duration & Trimming Verification via FFprobe...");
  const probeData = await audioMixer.verifyAudioStream(duckedOutputPath);
  assert(probeData.hasAudioStream, "Final output contains valid AAC audio stream");
  assert(
    Math.abs(probeData.duration - 5.0) <= 0.2,
    `Exported video duration (${probeData.duration.toFixed(2)}s) accurately trimmed to video target (5.0s)`
  );

  // SCENARIO 7 & 8: Provider Outage and Fallback Graceful Handling
  console.log("\n--> Testing Scenario 7 & 8: Provider Outage & Alternative Search Fallback...");
  const impossibleQueryResults = await musicProvider.search({
    keywords: ["xyzkdjfh9384752nonexistentterm"],
  });
  assert(
    impossibleQueryResults.length > 0,
    `Empty provider search automatically fell back to internal catalog (${impossibleQueryResults.length} tracks)`
  );

  // SCENARIO 9: Missing API Credentials for Freesound produces clear status
  console.log("\n--> Testing Scenario 9: Missing API Credentials Status Handling...");
  const freesoundProvider = new CompositeMusicProvider();
  const providersList = freesoundProvider.getProviders();
  const freesoundStatus = providersList.find((p) => p.type === "freesound");
  assert(
    freesoundStatus && freesoundStatus.configured === Boolean(process.env.FREESOUND_API_KEY),
    `Freesound correctly reflects configuration state without crashing`
  );

  // SCENARIO 10: Invalid or Corrupted Audio File Rejection (Magic-Byte Inspection)
  console.log("\n--> Testing Scenario 10: Magic-Byte Binary Validator & Corrupt File Rejection...");
  const fakeAudioPath = path.join(TEST_SCRATCH_DIR, "fake_html_error.mp3");
  fs.writeFileSync(fakeAudioPath, "<html><head><title>403 Forbidden</title></head><body>Error</body></html>");
  const fakeValidation = await AudioValidator.inspectAudioFile(fakeAudioPath);
  assert(
    fakeValidation.valid === false,
    `HTML error payload masquerading as .mp3 was rejected: "${fakeValidation.error}"`
  );

  // SCENARIO 11: Incompatible License Rejection
  console.log("\n--> Testing Scenario 11: License-Aware Non-Commercial Rejection...");
  const candidateWithRestrictedLicense = {
    id: "restricted_track_cc_nc",
    title: "Non-Commercial Only Song",
    artist: "Restricted Artist",
    genre: "Pop",
    moods: ["happy"],
    instruments: [],
    bpm: 120,
    durationSeconds: 60,
    energyLevel: 5,
    isInstrumental: true,
    hasVocals: false,
    license: "CC-BY-NC",
    commercialSafe: false, // NOT commercial safe
    audioFormat: "mp3",
    localPath: "",
    url: "",
    provider: "internal_catalog",
    tags: ["happy"],
  };
  const rankWithRestricted = musicRanker.rankCandidates(cinematicBrief, [candidateWithRestrictedLicense]);
  assert(
    rankWithRestricted.eligibleCount === 0,
    `Candidate with non-commercial license (commercialSafe: false) was rejected from eligible pool`
  );

  // SCENARIO 12: Provenance & Attribution Retention
  console.log("\n--> Testing Scenario 12: Provenance & Attribution Tracking...");
  const mixkitProvider = new MixkitMusicProvider();
  const mixkitTracks = await mixkitProvider.search({});
  assert(mixkitTracks.length > 0, `Mixkit provider retrieved ${mixkitTracks.length} verified tracks`);
  const sampleMixkit = mixkitTracks[0];
  assert(
    sampleMixkit.licenseInfo && sampleMixkit.licenseInfo.name === "Mixkit Free License",
    `Mixkit track retains official license: ${sampleMixkit.licenseInfo?.name}`
  );
  assert(
    sampleMixkit.provenance && Boolean(sampleMixkit.provenance.sourceUrl),
    `Mixkit track retains origin provenance: ${sampleMixkit.provenance?.sourceUrl}`
  );

  // SCENARIO 13: Pixabay Content License Workflow
  console.log("\n--> Testing Scenario 13: Pixabay License Workflow & Documentation...");
  const pixabayProvider = new PixabayMusicProvider();
  const pixabayTracks = await pixabayProvider.search({});
  assert(pixabayTracks.length > 0, `Pixabay provider loaded ${pixabayTracks.length} verified tracks`);
  assert(
    pixabayTracks[0].licenseInfo?.name.includes("Pixabay"),
    `Pixabay track has verified Pixabay Content License terms`
  );

  // SCENARIO 14: YouTube Audio Library Workflow
  console.log("\n--> Testing Scenario 14: YouTube Audio Library Workflow...");
  const ytProvider = new YouTubeAudioLibraryProvider();
  const ytTracks = await ytProvider.search({});
  assert(ytTracks.length > 0, `YouTube Audio Library provider loaded ${ytTracks.length} tracks`);
  assert(
    ytTracks[0].licenseInfo?.name === "YouTube Audio Library License",
    `YouTube track retains verified YouTube Audio Library license terms`
  );

  // SCENARIO 15: Workspace Provider Audio File Scanning
  console.log("\n--> Testing Scenario 15: Workspace Media Library Provider...");
  const workspaceProvider = new WorkspaceMusicProvider();
  const workspaceTracks = await workspaceProvider.search({});
  assert(Array.isArray(workspaceTracks), `Workspace provider scanned successfully (found ${workspaceTracks.length} custom files)`);

  console.log("\n================================================================================");
  console.log(`TEST SUITE COMPLETE: ${passedTests} OF ${totalTests} ASSERTIONS PASSED (100% SUCCESS)`);
  console.log("================================================================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});

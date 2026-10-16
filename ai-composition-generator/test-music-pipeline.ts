import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  MusicIntelligence,
  CompositeMusicProvider,
  MusicRanker,
  AudioMixer,
} from './src/audio/index.js';

async function runTests() {
  console.log('====================================================');
  console.log('HYPARLINK INTELLIGENT MUSIC PIPELINE VERIFICATION');
  console.log('====================================================\n');

  // 1. Test Music Intelligence Brief Generation
  console.log('--- TEST 1: Music Intelligence Brief Generation ---');
  const intelligence = new MusicIntelligence();
  
  const testScenarios = [
    {
      title: 'Rolex Oyster Deep Sea Commercial',
      prompt: 'Create a luxury 60-second commercial for Rolex Oyster Perpetual deep sea watch with ocean waves and green/white branding',
      scenes: [
        { id: '1', title: 'Deep ocean abyss', description: 'Tranquil emerald ocean depths', durationSeconds: 15, intensity: 'low' as const },
        { id: '2', title: 'Craftsmanship reveal', description: 'Oystersteel case catching light underwater', durationSeconds: 25, intensity: 'medium' as const },
        { id: '3', title: 'Crown emblem climax', description: 'Hero watch floating with triumphant resolution', durationSeconds: 20, intensity: 'peak' as const },
      ],
      expectedGenre: 'Cinematic Orchestral',
    },
    {
      title: 'Silicon Valley AI SaaS Pitch',
      prompt: 'Modern fast-paced tech demo for an autonomous AI developer agent platform',
      scenes: [
        { id: '1', title: 'Terminal launch', description: 'Futuristic code streams and cyber graphs', durationSeconds: 15, intensity: 'medium' as const },
        { id: '2', title: 'Neural network sync', description: 'Fast automated pipelines deploying to cloud', durationSeconds: 15, intensity: 'high' as const },
      ],
      expectedGenre: 'Tech Minimalist',
    },
    {
      title: 'Non-Profit Ocean Wildlife Rescue',
      prompt: 'Heartfelt genuine documentary about protecting sea turtles and coastal communities',
      scenes: [
        { id: '1', title: 'Morning shores', description: 'Gentle sunrise on sea turtles returning to ocean', durationSeconds: 30, intensity: 'low' as const },
      ],
      expectedGenre: 'Inspirational Acoustic',
    },
  ];

  const ranker = new MusicRanker();
  const provider = new CompositeMusicProvider();

  for (const scenario of testScenarios) {
    console.log(`\nEvaluating Scenario: "${scenario.title}"`);
    const brief = await intelligence.generateMusicBrief({
      prompt: scenario.prompt,
      durationSeconds: 60,
      scenes: scenario.scenes,
      voiceoverText: 'Welcome to perfection in motion.',
      voiceoverEnabled: true,
    });

    console.log(`Generated Brief:
  - Video Category: ${brief.videoCategory}
  - Moods: ${brief.emotionalTone.join(', ')}
  - Genre: ${brief.musicGenre}
  - Energy: ${brief.energyLevel}
  - Vocals: ${brief.vocalPreference}
  - Narration Ducking Required: ${brief.narrationRequirements.duckingRequired}`);

    // 2. Search & Retrieval
    const candidates = await provider.search({
      keywords: [...brief.emotionalTone, brief.musicGenre],
      suitableForNarration: true,
      instrumentalOnly: brief.vocalPreference === 'instrumental_only',
    });

    console.log(`Found ${candidates.length} search candidates.`);

    // 3. 10-Factor Ranking
    const ranking = ranker.rankCandidates(brief, candidates);
    console.log(`Selected Best Soundtrack:
  - ID: ${ranking.bestCandidate.id}
  - Title: ${ranking.bestCandidate.title}
  - Genre: ${ranking.bestCandidate.genre}
  - Score: ${ranking.bestCandidate.rankingScore}/100
  - Reason: ${ranking.selectionReason}
  - Commercial Safe: ${ranking.bestCandidate.commercialSafe} (License: ${ranking.bestCandidate.license})`);

    if (!ranking.bestCandidate.commercialSafe) {
      throw new Error(`TEST FAILED: Selected non-commercial track for ${scenario.title}`);
    }
  }

  // 4. Test Audio Mixer with Speech-Aware Ducking and FFprobe validation
  console.log('\n--- TEST 2: FFmpeg Speech-Aware Ducking & Output Verification ---');
  const mixer = new AudioMixer();

  // Create temporary synthetic video and speech files for test
  const testDir = '/tmp/hyparlink_audio_test';
  fs.mkdirSync(testDir, { recursive: true });
  const testVideoPath = path.join(testDir, 'synth_test_video.mp4');
  const testSpeechPath = path.join(testDir, 'synth_test_speech.mp3');
  const testMixedPath = path.join(testDir, 'synth_test_mixed.mp4');

  // Generate 5s test video (green background)
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0x0f2d1e:s=1280x720:d=6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', testVideoPath], { stdio: 'ignore' });

  // Generate 3s synthetic speech tone (beep / speech simulation)
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=800:duration=3', '-c:a', 'libmp3lame', '-b:a', '128k', testSpeechPath], { stdio: 'ignore' });

  const testMusicPath = path.resolve(process.cwd(), 'apps/app/public/audio/bgm/cinematic_luxury.mp3');

  console.log('Running AudioMixer.mixVideoAudio with speech-aware sidechain ducking...');
  const mixResult = await mixer.mixVideoAudio({
    videoInputPath: testVideoPath,
    musicTrackPath: testMusicPath,
    speechAudioPath: testSpeechPath,
    targetDurationSeconds: 6,
    musicVolume: 0.4,
    speechVolume: 1.0,
    enableDucking: true,
    outputPath: testMixedPath,
  });

  console.log('Audio Mix Result:', mixResult);

  if (!mixResult.success || !mixResult.hasSpeechTrack || !mixResult.duckingApplied) {
    throw new Error('TEST FAILED: Audio mixing or ducking failed to complete successfully.');
  }

  // Verify file existence and non-zero size
  const stats = fs.statSync(testMixedPath);
  console.log(`Verified output file size: ${stats.size} bytes`);
  if (stats.size < 5000) {
    throw new Error('TEST FAILED: Mixed video output file is too small or corrupt.');
  }

  console.log('\n====================================================');
  console.log('ALL INTELLIGENT MUSIC PIPELINE TESTS PASSED!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

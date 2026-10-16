import { AudioMixer } from "./src/audio/audio-mixer.js";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

async function test() {
  const mixer = new AudioMixer();
  const inputVideo = "/Users/apple/Desktop/hyparlink dashbord/ai-composition-generator/generated-projects/job-1792063489535-7be00cc9/test.mp4";
  const bgmTrack = "/Users/apple/Desktop/hyparlink dashbord/backend-echo/storage/audio/bgm/cinematic_luxury.mp3";
  const outputVideo = "/Users/apple/Desktop/hyparlink dashbord/ai-composition-generator/outputs/rolex_with_ai_music.mp4";

  console.log("Mixing AI soundtrack onto rendered video...");
  const res = await mixer.mixVideoAudio({
    videoInputPath: inputVideo,
    musicTrackPath: bgmTrack,
    outputPath: outputVideo,
    targetDurationSeconds: 5.0,
    musicVolume: 0.65,
    fadeInDurationSeconds: 1.0,
    fadeOutDurationSeconds: 1.5,
    enableDucking: false,
    normalizeLoudness: true
  });
  console.log("Audio mix result:", JSON.stringify(res, null, 2));

  const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type,sample_rate,channels -of json "${outputVideo}"`);
  console.log("FFprobe verification:", stdout);
}

test().catch(err => { console.error(err); process.exit(1); });

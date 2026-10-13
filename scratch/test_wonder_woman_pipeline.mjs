import { AIGenerator } from "../ai-composition-generator/dist/ai/generator.js";

async function test() {
  console.log("=== Testing Automated AI Image Generation for Wonder Woman ===");
  const generator = new AIGenerator();
  const prompt = "Create a 15-second cinematic DC Wonder Woman ad with glowing golden lasso in ancient temple";
  
  const payload = await generator.generateProject(prompt, {
    duration: 15,
    width: 1920,
    height: 1080,
    fps: 30,
    onProgress: (stage, msg) => {
      console.log(`[Progress] ${stage}: ${msg}`);
    }
  });

  console.log("Payload Generated!");
  console.log("Files:", Object.keys(payload.files));
  console.log("Analyzed Assets Count:", payload.analyzedAssets?.length || 0);
  if (payload.analyzedAssets) {
    for (const a of payload.analyzedAssets) {
      console.log(` - Asset: ${a.name} -> ${a.localPath}`);
    }
  }
}

test().catch(console.error);

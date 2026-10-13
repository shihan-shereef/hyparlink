import { AIGenerator } from "../ai-composition-generator/dist/ai/generator.js";

async function test() {
  const generator = new AIGenerator();
  const prompt = "Create a 20-second professional revenue-growth animation using an animated bar chart with Q1: $12M, Q2: $18M, Q3: $25M, Q4: $34M.";
  const payload = await generator.generateProject(prompt, { duration: 20 });
  console.log("File keys:", Object.keys(payload.files));
  for (const k of Object.keys(payload.files)) {
    if (k.includes("scene")) {
      console.log(`\n--- ${k} ---`);
      console.log(payload.files[k].slice(0, 500));
    }
  }
  console.log("\nCreativeBrief videoType:", payload.creativeBrief?.videoType);
  console.log("CreativeBrief category:", payload.creativeBrief?.category);
  console.log("Timeline scenes:", payload.timeline?.scenes.map(s => ({ id: s.id, type: s.sceneType, name: s.name, bars: s.dataVisualization?.bars })));
}

test().catch(console.error);

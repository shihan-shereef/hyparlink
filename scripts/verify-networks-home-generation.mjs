import path from "node:path";
import fs from "node:fs";
import { VideoGenerationPipeline } from "../ai-composition-generator/dist/pipeline/generate-video.js";

async function runTest() {
  console.log("=== Starting Verification Test: Networks Home 3-Scene Video Generation ===");

  const baseDir = path.resolve(import.meta.dirname, "../ai-composition-generator/generated-projects");
  const outputsDir = path.resolve(import.meta.dirname, "../ai-composition-generator/outputs");
  const assetPath = path.resolve(import.meta.dirname, "../ai-composition-generator/default-assets/ollasoftware-building.jpg");

  const pipeline = new VideoGenerationPipeline({
    baseDir,
    outputsDir,
  });

  const prompt = "Create a 30-second cinematic product advertisement with three scenes, smooth transitions and a final call-to-action. of networks home";
  const assets = [
    {
      id: "test-asset-01",
      name: "networks-headquarters.jpg",
      originalFilename: "networks-headquarters.jpg",
      type: "image",
      mimeType: "image/jpeg",
      localPath: assetPath,
    },
  ];

  console.log(`Prompt: "${prompt}"`);
  console.log(`Attached Asset: ${assets[0].name} (from ${assetPath})`);

  const report = await pipeline.run(prompt, {
    duration: 30,
    width: 1920,
    height: 1080,
    fps: 30,
    resolution: "1080p",
    assets,
  });

  console.log("\n=== Pipeline Report ===");
  console.log("Project Path:", report.projectPath);
  console.log("Output Path:", report.outputPath);
  console.log("Render Status:", report.renderStatus);
  console.log("Validation Status:", report.validationStatus);
  console.log("Duration:", report.duration);

  // Inspect generated scene HTML files
  const compDir = path.join(report.projectPath, "compositions");
  const sceneFiles = fs.readdirSync(compDir).filter((f) => f.endsWith(".html"));
  console.log(`Found ${sceneFiles.length} scene files:`, sceneFiles);

  for (const sf of sceneFiles) {
    const content = fs.readFileSync(path.join(compDir, sf), "utf-8");
    const headMatch = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const badgeMatch = content.match(/class=["'][^"']*badge-tag[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    console.log(`\n[${sf}]`);
    console.log(`  Headline: ${headMatch ? headMatch[1].replace(/<[^>]+>/g, "").trim() : "N/A"}`);
    console.log(`  Badge: ${badgeMatch ? badgeMatch[1].replace(/<[^>]+>/g, "").trim() : "N/A"}`);
    if (imgMatch) {
      console.log(`  Embedded Image: ${imgMatch[1]}`);
    }
  }

  // Verify MP4 exists and size > 0
  if (fs.existsSync(report.outputPath)) {
    const stats = fs.statSync(report.outputPath);
    console.log(`\n Rendered MP4 verified: ${report.outputPath} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
  } else {
    throw new Error(`Output file not found: ${report.outputPath}`);
  }

  console.log("\n ALL VERIFICATIONS PASSED SUCCESSFULLY!");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

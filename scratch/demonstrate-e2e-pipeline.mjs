import path from "node:path";
import { VideoGenerationPipeline } from "../ai-composition-generator/dist/pipeline/generate-video.js";

async function main() {
  console.log("================================================================================");
  console.log("DEMONSTRATING END-TO-END PIPELINE:");
  console.log("User prompt → LLM understands the request → creative brief → scene plan → dynamic HyperFrames composition → validation → rendering → final video.");
  console.log("================================================================================\n");

  const prompt = "Create a 10-second animation of a small yellow tree growing from a seed into a full tree. Show the seed, roots, trunk, branches, and yellow leaves appearing gradually. Use a clean background and smooth growth animation.";

  console.log("STAGE 1: USER PROMPT");
  console.log(`Prompt: "${prompt}"\n`);

  const pipeline = new VideoGenerationPipeline({
    baseDir: path.resolve(process.cwd(), "ai-composition-generator/storage/test-suite-runs"),
    outputsDir: path.resolve(process.cwd(), "ai-composition-generator/storage/test-suite-runs"),
  });

  const startTime = Date.now();
  const report = await pipeline.run(prompt, {
    duration: 10,
    resolution: "1080p",
    fps: 30,
    onProgress: (stage, message) => {
      console.log(`[PIPELINE PROGRESS] Stage: ${stage} | ${message}`);
    },
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n================================================================================");
  console.log("PIPELINE EXECUTION SUMMARY:");
  console.log("================================================================================");
  console.log(`1. User Prompt: "${report.prompt}"`);
  console.log(`2. AI Provider: ${report.aiProvider} (${report.aiModel})`);
  console.log(`3. Creative Brief Title: "${report.creativeBrief?.title || report.compositionPlan?.title}"`);
  console.log(`   Video Type: ${report.creativeBrief?.videoType || report.compositionPlan?.videoType}`);
  console.log(`   Subject: "${report.creativeBrief?.creativeBrief?.subject || report.creativeBrief?.subject}"`);
  console.log(`4. Scene Plan: ${report.timeline?.scenes?.length || report.storyboard?.scenes?.length} scenes planned`);
  if (report.timeline?.scenes) {
    for (const sc of report.timeline.scenes) {
      console.log(`   - [${sc.id}] ${sc.startTime}s - ${sc.endTime}s: ${sc.purpose}`);
    }
  }
  console.log(`5. Dynamic Composition Project: ${report.projectPath}`);
  console.log(`6. Validation Status: ${report.validationStatus} (Corrections: ${report.correctionAttempts})`);
  console.log(`7. Render Status: ${report.renderStatus} (Time: ${report.renderTimeSeconds}s)`);
  console.log(`8. Final Video Output: ${report.outputPath} (${report.fileSize})`);
  if (report.probeData) {
    console.log(`   Probe Duration: ${report.probeData.duration}s | Dimensions: ${report.probeData.width}x${report.probeData.height} @ ${report.probeData.fps}fps`);
    console.log(`   Codec: ${report.probeData.codec} | Audio: ${report.probeData.hasAudio ? "Yes" : "No"}`);
  }
  console.log(`Total Pipeline Runtime: ${totalTime}s`);
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});

import { VideoGenerationPipeline } from "./pipeline/generate-video.js";

function parseArgs(): { prompt: string } {
  const args = process.argv.slice(2);
  let prompt = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prompt" && args[i + 1]) {
      prompt = args[i + 1];
      i++;
    }
  }

  // Default test prompt from Section 1 of Phase 5 specification
  if (!prompt) {
    prompt =
      "Create a 5-second 1080p landscape title card for HyperFrames Studio with a dark background, blue glowing text, a smooth fade-in animation and a camera push effect.";
  }

  return { prompt };
}

async function main() {
  try {
    const { prompt } = parseArgs();
    const pipeline = new VideoGenerationPipeline();
    const report = await pipeline.run(prompt);

    console.log("\n==================================================");
    console.log("FINAL EXECUTION SUMMARY");
    console.log("==================================================");
    console.log(`Prompt:`);
    console.log(`${report.prompt}`);
    console.log(`\nAI Provider:`);
    console.log(`${report.aiProvider}`);
    console.log(`\nAI Model:`);
    console.log(`${report.aiModel}`);
    console.log(`\nProject:`);
    console.log(`${report.projectPath}`);
    console.log(`\nValidation:`);
    console.log(`${report.validationStatus}`);
    console.log(`\nCorrection Attempts:`);
    console.log(`${report.correctionAttempts}`);
    console.log(`\nRender:`);
    console.log(`${report.renderStatus}`);

    if (report.renderStatus === "SUCCESS") {
      console.log(`\nOutput:`);
      console.log(`${report.outputPath}`);
      console.log(`\nDuration:`);
      console.log(`${report.duration}s`);
      console.log(`\nResolution:`);
      console.log(`${report.resolution}`);
      console.log(`\nFPS:`);
      console.log(`${report.fps}`);
      console.log(`\nFile Size:`);
      console.log(`${report.fileSize}`);
      console.log(`\nRender Time:`);
      console.log(`${report.renderTimeSeconds}s`);
    } else if (report.validationErrors) {
      console.log(`\nValidation Errors:`);
      for (const err of report.validationErrors) {
        console.log(`- ${err}`);
      }
    } else if (report.renderError) {
      console.log(`\nRender Error:`);
      console.log(`${report.renderError}`);
    }

    console.log("==================================================\n");

    if (report.renderStatus !== "SUCCESS") {
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`\n[Fatal Execution Error]: ${err.message}`);
    process.exit(1);
  }
}

main();

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { VideoGenerationPipeline } from "./dist/pipeline/generate-video.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function probeFile(filePath) {
  const probeCmd = `ffprobe -v error -show_entries format=duration,size,bit_rate:stream=width,height,r_frame_rate,codec_name -of json "${filePath}"`;
  const out = execSync(probeCmd, { encoding: "utf8" });
  return JSON.parse(out);
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("HYPARLINK AUTONOMOUS AI AD ENGINE: 5-SCENARIO VERIFICATION TEST SUITE");
  console.log("================================================================================\n");

  const baseOutputDir = path.join(__dirname, "outputs");
  const baseProjectsDir = path.join(__dirname, "generated-projects");
  fs.mkdirSync(baseOutputDir, { recursive: true });
  fs.mkdirSync(baseProjectsDir, { recursive: true });

  const pipeline = new VideoGenerationPipeline({
    baseDir: baseProjectsDir,
    outputsDir: baseOutputDir,
    maxCorrectionAttempts: 3,
  });

  const testCases = [
    {
      id: "Test A",
      name: "Premium Footwear Advertisement",
      prompt: "Create a 20-second cinematic advertisement for a premium running shoe. Use suitable product imagery, dynamic movement, custom SVG speed graphics, bold typography, and a polished product reveal.",
      duration: 20,
      width: 1920,
      height: 1080,
      fps: 30,
      assets: [],
    },
    {
      id: "Test B",
      name: "Real Software Advertisement",
      prompt: "Create a 25-second advertisement for a real software product. Research its official website, identify its actual features, and use suitable official or properly licensed product imagery. Create a professional animated composition with a strong opening and a clear call to action.",
      duration: 25,
      width: 1920,
      height: 1080,
      fps: 30,
      assets: [],
    },
    {
      id: "Test C",
      name: "Yellow Tree Animation",
      prompt: "Create a 10-second animation showing a seed growing into a yellow tree. Use animated roots, a growing trunk, spreading branches, and leaves appearing progressively.",
      duration: 10,
      width: 1920,
      height: 1080,
      fps: 30,
      assets: [],
    },
    {
      id: "Test D",
      name: "Revenue Chart",
      prompt: "Create a 15-second animated revenue chart using only the data I provide. Animate the bars and labels with clear timing and professional typography.",
      duration: 15,
      width: 1920,
      height: 1080,
      fps: 30,
      assets: [],
    },
    {
      id: "Test E",
      name: "Selected Image Advertisement",
      prompt: "Create a 15-second advertisement using my selected image as the primary visual. Keep the image prominent while adding scene-specific GSAP animation, text, and transitions.",
      duration: 15,
      width: 1920,
      height: 1080,
      fps: 30,
      assets: [
        {
          id: "hero-user-asset-1",
          name: "ollasoftware-building.jpg",
          originalFilename: "ollasoftware-building.jpg",
          localPath: path.resolve(__dirname, "default-assets/ollasoftware-building.jpg"),
          type: "image",
          mimeType: "image/jpeg",
        },
      ],
    },
  ];

  const results = [];
  const projectSnapshots = [];

  const filterArg = process.argv[2];
  const targetCases = filterArg
    ? testCases.filter((t) => t.id.toLowerCase().includes(filterArg.toLowerCase()) || t.name.toLowerCase().includes(filterArg.toLowerCase()))
    : testCases;

  for (let i = 0; i < targetCases.length; i++) {
    const tc = targetCases[i];
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`[RUNNING ${tc.id}] ${tc.name} (${tc.duration}s)...`);
    console.log(`Prompt: "${tc.prompt}"`);
    console.log(`--------------------------------------------------------------------------------`);

    const startTime = Date.now();
    try {
      const report = await pipeline.run(tc.prompt, {
        duration: tc.duration,
        width: tc.width,
        height: tc.height,
        fps: tc.fps,
        assets: tc.assets,
        onProgress: (stage, message) => {
          console.log(`  [Progress - ${stage}] ${message}`);
        },
      });

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n  >> Pipeline completed in ${elapsedSec}s with renderStatus: ${report.renderStatus}, validation: ${report.validationStatus}`);

      // Verify Output File & FFprobe Stream Metrics
      let probeData = null;
      let durationDiff = null;
      let fileSizeBytes = 0;

      if (report.outputPath && fs.existsSync(report.outputPath)) {
        fileSizeBytes = fs.statSync(report.outputPath).size;
        try {
          const probeJson = await probeFile(report.outputPath);
          const actualDuration = parseFloat(probeJson.format?.duration || "0");
          durationDiff = Math.abs(actualDuration - tc.duration);
          probeData = {
            actualDuration,
            width: probeJson.streams?.[0]?.width,
            height: probeJson.streams?.[0]?.height,
            codec: probeJson.streams?.[0]?.codec_name,
            sizeBytes: fileSizeBytes,
          };
          console.log(`  [FFprobe] Duration: ${actualDuration.toFixed(2)}s (Target: ${tc.duration}s, Diff: ${durationDiff.toFixed(2)}s)`);
          console.log(`  [FFprobe] Resolution: ${probeData.width}x${probeData.height}, Codec: ${probeData.codec}, Size: ${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB`);
        } catch (probeErr) {
          console.warn(`  [FFprobe Warning] Probe failed: ${probeErr.message}`);
        }
      }

      // Inspect Scene Implementations in Compositions Directory
      const compDir = path.join(report.projectPath, "compositions");
      const sceneFiles = fs.existsSync(compDir)
        ? fs.readdirSync(compDir).filter((f) => f.endsWith(".html"))
        : [];

      const sceneSnippets = [];
      let usesGsapTimelines = true;
      let usesUserAsset = false;
      let distinctVisualSignature = "";

      for (const sf of sceneFiles) {
        const content = fs.readFileSync(path.join(compDir, sf), "utf-8");
        if (!content.includes("window.__timelines")) {
          usesGsapTimelines = false;
        }
        if (tc.assets.length > 0 && content.includes(tc.assets[0].name)) {
          usesUserAsset = true;
        }
        // Extract headline or visual element
        const hMatch = content.match(/<h[12][^>]*>(.*?)<\/h[12]>/i);
        sceneSnippets.push({
          file: sf,
          headline: hMatch ? hMatch[1].replace(/<[^>]+>/g, "").trim() : "N/A",
          length: content.length,
          hasSvg: content.includes("<svg"),
          hasImg: content.includes("<img"),
        });
      }

      const passed =
        report.renderStatus === "SUCCESS" &&
        report.validationStatus === "PASSED" &&
        fileSizeBytes > 10000 &&
        (durationDiff === null || durationDiff < 1.0);

      const resultEntry = {
        testId: tc.id,
        name: tc.name,
        targetDuration: tc.duration,
        actualDuration: probeData?.actualDuration,
        durationPassed: durationDiff !== null && durationDiff < 1.0,
        validationStatus: report.validationStatus,
        renderStatus: report.renderStatus,
        outputPath: report.outputPath,
        fileSizeMb: (fileSizeBytes / 1024 / 1024).toFixed(2),
        sceneCount: sceneFiles.length,
        scenes: sceneSnippets,
        usesGsapTimelines,
        usesUserAsset: tc.assets.length > 0 ? usesUserAsset : "N/A",
        correctionAttempts: report.correctionAttempts,
        passed,
        elapsedSec,
      };

      results.push(resultEntry);
      projectSnapshots.push({
        id: tc.id,
        title: report.creativeBrief?.title || "Untitled",
        category: report.creativeBrief?.category,
        scenes: sceneSnippets,
      });

      console.log(`  [Result] ${passed ? "✅ PASSED" : "❌ FAILED"}`);
    } catch (testErr) {
      console.error(`  [Test Error] ${tc.id} failed with error: ${testErr.message}`);
      results.push({
        testId: tc.id,
        name: tc.name,
        passed: false,
        error: testErr.message,
      });
    }
  }

  console.log("\n================================================================================");
  console.log("FINAL TEST SUMMARY & DIVERSITY VERIFICATION");
  console.log("================================================================================\n");

  console.table(
    results.map((r) => ({
      Test: r.testId,
      Name: r.name,
      Target: `${r.targetDuration}s`,
      Actual: r.actualDuration ? `${r.actualDuration.toFixed(1)}s` : "N/A",
      Scenes: r.sceneCount,
      Validation: r.validationStatus,
      Render: r.renderStatus,
      SizeMB: r.fileSizeMb,
      GSAP: r.usesGsapTimelines ? "Deterministic" : "No",
      UserAsset: r.usesUserAsset,
      Status: r.passed ? "PASS" : "FAIL",
    }))
  );

  // Cross-Scene Diversity Check
  console.log("\n[Diversity Analysis Across 5 Test Compositions]:");
  for (const s of projectSnapshots) {
    console.log(`  - ${s.id} (${s.title}): ${s.scenes.length} scenes: [${s.scenes.map((sc) => `${sc.file} (SVG:${sc.hasSvg}, IMG:${sc.hasImg})`).join(", ")}]`);
  }

  const allPassed = results.every((r) => r.passed);
  console.log(`\nOVERALL TEST SUITE RESULT: ${allPassed ? "✅ ALL TESTS PASSED SUCCESSFULLY" : "⚠️ SOME TESTS FAILED"}\n`);

  fs.writeFileSync(
    path.join(__dirname, "outputs/test-suite-report.json"),
    JSON.stringify({ timestamp: new Date().toISOString(), results, projectSnapshots }, null, 2),
    "utf-8"
  );
}

runTestSuite().catch(console.error);

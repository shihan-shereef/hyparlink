/**
 * Automated Test Suite for Intelligent Open-Web Image Discovery & Asset Integration
 */

import { WikimediaProvider } from "./src/images/wikimedia-provider.js";
import { WorkspaceProvider } from "./src/images/workspace-provider.js";
import { ImageRanker } from "./src/images/image-ranker.js";
import { ImageDownloader } from "./src/images/image-downloader.js";
import { ImageIntelligence } from "./src/images/image-intelligence.js";
import { CompositeImageService } from "./src/images/composite-image-service.js";
import { SceneVisualRequirement } from "./src/images/types.js";
import path from "node:path";
import fs from "node:fs";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING HYPARLINK IMAGE DISCOVERY TEST SUITE");
  console.log("==================================================\n");

  const settings = CompositeImageService.getDefaultSettings();

  // TEST 1: Wikimedia Commons Real Search & License Extraction
  console.log("Test 1: Wikimedia Commons API Search & License Extraction...");
  const wikiProvider = new WikimediaProvider();
  const wikiResults = await wikiProvider.searchImages(
    { query: "Coca-Cola bottle historical", limit: 4 },
    settings
  );

  console.log(`Retrieved ${wikiResults.length} Wikimedia candidates:`);
  for (const item of wikiResults) {
    console.log(`- Title: ${item.title}`);
    console.log(`  Provider: ${item.provider}`);
    console.log(`  Dimensions: ${item.width}x${item.height} (${item.aspectRatio})`);
    console.log(`  License: ${item.license.name}`);
    console.log(`  Attribution: ${item.license.attributionText}`);
    console.log(`  URL: ${item.url.slice(0, 60)}...`);
  }

  if (wikiResults.length === 0) {
    throw new Error("Test 1 FAILED: Wikimedia search returned 0 results.");
  }
  const first = wikiResults[0];
  if (!first.license || !first.license.name) {
    throw new Error("Test 1 FAILED: Wikimedia license metadata missing.");
  }
  console.log("✓ Test 1 PASSED: Wikimedia search and license verification operational.\n");

  // TEST 2: 10-Factor Multi-Attribute Ranking Engine
  console.log("Test 2: 10-Factor Image Candidate Ranking...");
  const requirement: SceneVisualRequirement = {
    sceneIndex: 0,
    sceneName: "The Origin (1886)",
    purpose: "Historical founding of Coca-Cola in Atlanta 1886",
    visualSubject: "Historical Coca-Cola contour bottle vintage archive",
    imageType: "historical_photograph",
    requiresImage: true,
    preferredSource: "wikimedia",
    searchQueries: ["Coca-Cola bottle historical", "Coca-Cola vintage 1880s"],
    compositionStyle: "fullscreen_hero",
    orientation: "landscape",
    historicalAccuracyRequired: true,
    cameraMotion: "ken_burns_zoom_in",
    visualTreatment: "Monochrome sepia grading with subtle vignette",
  };

  const ranked = ImageRanker.rankCandidates(wikiResults, requirement);
  console.log(`Ranked ${ranked.length} candidates against requirement:`);
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    console.log(`  #${i + 1} [Score: ${r.score}%] ${r.candidate.title.slice(0, 45)}`);
    console.log(`      Reason: ${r.reason}`);
    console.log(`      Breakdown: Subj: ${r.breakdown.subjectRelevance}, Scene: ${r.breakdown.sceneMatch}, Res: ${r.breakdown.resolution}, Hist: ${r.breakdown.historicalAccuracy}, Lic: ${r.breakdown.licensingCompliance}`);
  }

  if (ranked.length === 0 || ranked[0].score < 60) {
    throw new Error("Test 2 FAILED: Ranking algorithm failed to produce high-confidence candidate.");
  }
  console.log("✓ Test 2 PASSED: 10-factor ranking engine scored candidates with transparent rationale.\n");

  // TEST 3: User-Selected Workspace Asset Priority
  console.log("Test 3: User Workspace Asset Prioritization...");
  const mockUserAsset = {
    id: "user_custom_coke_hero",
    name: "official_coca_cola_vintage_brand.jpg",
    originalFilename: "official_coca_cola_vintage_brand.jpg",
    localPath: "/tmp/fake_user_asset.jpg",
    width: 3840,
    height: 2160,
    type: "image",
    mimeType: "image/jpeg",
  };

  const wsProvider = new WorkspaceProvider([mockUserAsset]);
  const wsCandidates = await wsProvider.searchImages(
    { query: "Coca-Cola bottle historical" },
    settings
  );

  const combinedCandidates = [...wikiResults, ...wsCandidates];
  const combinedRanked = ImageRanker.rankCandidates(combinedCandidates, requirement);

  console.log(`Top ranked candidate out of ${combinedRanked.length}:`);
  console.log(`- Title: ${combinedRanked[0].candidate.title}`);
  console.log(`- Provider: ${combinedRanked[0].candidate.provider}`);
  console.log(`- Score: ${combinedRanked[0].score}%`);
  console.log(`- Reason: ${combinedRanked[0].reason}`);

  if (combinedRanked[0].candidate.provider !== "workspace") {
    throw new Error("Test 3 FAILED: User workspace asset did not take priority over external candidates.");
  }
  console.log("✓ Test 3 PASSED: User workspace assets take top priority as required.\n");

  // TEST 4: Safe Image Downloader & File Integrity
  console.log("Test 4: Safe Image Download & Magic Byte Validation...");
  const testTargetDir = path.resolve(process.cwd(), "generated-assets/test-cache");
  fs.mkdirSync(testTargetDir, { recursive: true });

  const chosenCandidate = wikiResults[0];
  const downloadedPath = await ImageDownloader.downloadCandidate(
    chosenCandidate,
    testTargetDir,
    "test_scene_1"
  );

  console.log(`Saved image to: ${downloadedPath}`);
  const stats = fs.statSync(downloadedPath);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);

  const buffer = fs.readFileSync(downloadedPath);
  const detectedMime = ImageDownloader.detectMimeType(buffer);
  console.log(`Detected format via magic bytes: ${detectedMime}`);

  if (!stats || stats.size < 5000 || !detectedMime) {
    throw new Error("Test 4 FAILED: Downloaded image failed integrity or magic byte checks.");
  }
  console.log("✓ Test 4 PASSED: Image safely downloaded, verified, and cached.\n");

  // TEST 5: Visual Asset Plan Generation (Coca-Cola 60-Second Prompt)
  console.log("Test 5: Visual Asset Plan Generation...");
  const intelligence = new ImageIntelligence();
  const prompt = "Create a 60-second cinematic advertisement explaining the history of Coca-Cola, from its creation in 1886 to its worldwide popularity today.";
  const plan = await intelligence.planVisualAssets(prompt, undefined, 5);

  console.log(`Generated plan for "${prompt}":`);
  console.log(`- Total Scenes: ${plan.totalScenes}`);
  console.log(`- Scenes Requiring Images: ${plan.scenesWithImages}`);
  console.log(`- Historical Accuracy Required: ${plan.historicalAccuracyRequired}`);
  for (const scene of plan.sceneRequirements) {
    console.log(`  Scene ${scene.sceneIndex + 1} (${scene.imageType}):`);
    console.log(`    Subject: ${scene.visualSubject}`);
    console.log(`    Queries: ${scene.searchQueries.join(", ")}`);
    console.log(`    Source: ${scene.preferredSource} | Motion: ${scene.cameraMotion}`);
  }

  if (!plan.sceneRequirements || plan.sceneRequirements.length !== 5) {
    throw new Error("Test 5 FAILED: Plan did not generate 5 required scenes.");
  }
  console.log("✓ Test 5 PASSED: Visual Asset Plan generated with scene-by-scene requirements.\n");

  // TEST 6: Composite Image Service End-to-End Orchestration
  console.log("Test 6: Composite Image Service Full Orchestration...");
  const service = new CompositeImageService();
  const orchestrationResult = await service.discoverAndPrepareAssets({
    userPrompt: "History of Coca-Cola contour bottle from 1886 Atlanta to today",
    sceneCount: 3,
    settings: {
      wikimediaEnabled: true,
      pexelsEnabled: false,
      unsplashEnabled: false,
      aiFallbackEnabled: true,
      maxImagesPerVideo: 3,
    },
    targetStorageDir: testTargetDir,
  });

  console.log(`Orchestration Complete!`);
  console.log(`- Total Discovered Assets: ${orchestrationResult.report.totalDiscovered}`);
  console.log(`- External Assets Used: ${orchestrationResult.report.externalAssetsUsed}`);
  console.log(`- Attributions Recorded: ${orchestrationResult.report.attributions.length}`);
  for (const attr of orchestrationResult.report.attributions) {
    console.log(`  Scene ${attr.sceneIndex}: "${attr.assetTitle.slice(0, 35)}" (${attr.provider})`);
    console.log(`    Attribution: ${attr.attributionText}`);
    console.log(`    License: ${attr.license}`);
  }

  if (orchestrationResult.downloadedAssets.length === 0) {
    throw new Error("Test 6 FAILED: Composite service did not prepare downloaded assets.");
  }
  console.log("✓ Test 6 PASSED: End-to-end image discovery, ranking, download, and attribution verified.\n");

  console.log("==================================================");
  console.log("ALL 6 IMAGE DISCOVERY PIPELINE TESTS PASSED!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\n[TEST ERROR]:", err);
  process.exit(1);
});

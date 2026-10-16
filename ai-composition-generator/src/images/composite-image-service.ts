import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  IImageProvider,
  ImageCandidate,
  ImageProviderSettings,
  VisualAssetPlan,
  SceneVisualRequirement,
  DiscoveredAssetReport,
  ImageSourceProvider,
} from "./types.js";
import { WikimediaProvider } from "./wikimedia-provider.js";
import { PexelsProvider } from "./pexels-provider.js";
import { UnsplashProvider } from "./unsplash-provider.js";
import { WorkspaceProvider } from "./workspace-provider.js";
import { ImageRanker } from "./image-ranker.js";
import { ImageDownloader } from "./image-downloader.js";
import { ImageIntelligence } from "./image-intelligence.js";
import { CreativeBrief } from "../ai/creative-brief.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CompositeImageService {
  private providers: Map<ImageSourceProvider, IImageProvider> = new Map();
  private intelligence: ImageIntelligence;
  private workspaceProvider: WorkspaceProvider;

  constructor(userAssets: any[] = []) {
    this.workspaceProvider = new WorkspaceProvider(userAssets);
    this.providers.set("workspace", this.workspaceProvider);
    this.providers.set("wikimedia", new WikimediaProvider());
    this.providers.set("pexels", new PexelsProvider());
    this.providers.set("unsplash", new UnsplashProvider());
    this.intelligence = new ImageIntelligence();
  }

  public setUserAssets(assets: any[]) {
    this.workspaceProvider.setUserAssets(assets);
  }

  public static getDefaultSettings(): ImageProviderSettings {
    return {
      wikimediaEnabled: true,
      pexelsEnabled: Boolean(process.env.PEXELS_API_KEY),
      pexelsApiKey: process.env.PEXELS_API_KEY || "",
      unsplashEnabled: Boolean(process.env.UNSPLASH_ACCESS_KEY),
      unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY || "",
      workspaceEnabled: true,
      aiFallbackEnabled: true,
      imageReviewMode: "auto",
      searchPriority: ["workspace", "wikimedia", "pexels", "unsplash"],
      maxImagesPerVideo: 10,
      requireLicenseVerification: true,
      displayAttribution: true,
    };
  }

  /**
   * Discovers, ranks, and downloads the best legal assets for every scene of a video.
   */
  public async discoverAndPrepareAssets(options: {
    userPrompt: string;
    creativeBrief?: CreativeBrief;
    sceneCount?: number;
    userAssets?: any[];
    settings?: Partial<ImageProviderSettings>;
    targetStorageDir?: string;
    onProgress?: (stage: string, message: string) => void | Promise<void>;
  }): Promise<{
    report: DiscoveredAssetReport;
    downloadedAssets: Array<{
      id: string;
      name: string;
      originalFilename: string;
      localPath: string;
      type: string;
      mimeType: string;
      url: string;
      sceneIndex: number;
      license: any;
      attributionText: string;
    }>;
  }> {
    const {
      userPrompt,
      creativeBrief,
      sceneCount = 5,
      userAssets = [],
      settings: customSettings = {},
      targetStorageDir,
      onProgress,
    } = options;

    const settings: ImageProviderSettings = {
      ...CompositeImageService.getDefaultSettings(),
      ...customSettings,
    };

    if (userAssets && userAssets.length > 0) {
      this.setUserAssets(userAssets);
    }

    // 1. Author Visual Asset Plan with LLM
    if (onProgress) {
      await onProgress(
        "planning_visual_assets",
        "Stage 1: Analyzing video scenes and authoring visual-asset plan..."
      );
    }

    const plan = await this.intelligence.planVisualAssets(
      userPrompt,
      creativeBrief,
      sceneCount
    );

    console.log(`[CompositeImageService] Created plan with ${plan.sceneRequirements.length} scene requirements.`);

    // 2. Discover & Rank Candidates for Each Scene
    const selectedAssets: ImageCandidate[] = [];
    const attributions: DiscoveredAssetReport["attributions"] = [];
    const downloadedAssets: any[] = [];

    const defaultStorageDir =
      targetStorageDir ||
      path.resolve(__dirname, "../../generated-assets/discovered");
    fs.mkdirSync(defaultStorageDir, { recursive: true });

    let workspaceAssetsUsed = 0;
    let externalAssetsUsed = 0;
    let aiGeneratedUsed = 0;

    for (let i = 0; i < plan.sceneRequirements.length; i++) {
      const req = plan.sceneRequirements[i];
      if (!req.requiresImage) continue;

      if (onProgress) {
        await onProgress(
          "searching_images",
          `Searching image sources for Scene ${i + 1}/${plan.sceneRequirements.length}: ${req.visualSubject.slice(0, 35)}...`
        );
      }

      // Collect all candidates across prioritized providers
      const sceneCandidates: ImageCandidate[] = [];

      for (const providerId of settings.searchPriority) {
        const provider = this.providers.get(providerId);
        if (!provider || !provider.isEnabled(settings)) continue;

        try {
          for (const query of req.searchQueries.slice(0, 2)) {
            const results = await provider.searchImages(
              {
                query,
                limit: 5,
                orientation: req.orientation,
                imageType: req.imageType,
                historicalOnly: req.historicalAccuracyRequired,
              },
              settings
            );

            for (const r of results) {
              if (!sceneCandidates.some((c) => c.url === r.url || c.id === r.id)) {
                sceneCandidates.push(r);
              }
            }
          }
        } catch (provErr: any) {
          console.warn(`[CompositeImageService] Provider ${providerId} notice: ${provErr.message}`);
        }
      }

      // Rank candidates using 10-Factor Engine
      const ranked = ImageRanker.rankCandidates(sceneCandidates, req, plan);

      let chosenCandidate: ImageCandidate | null = null;
      if (ranked.length > 0) {
        chosenCandidate = ranked[0].candidate;
      }

      // Safe Download & Preparation
      if (chosenCandidate) {
        try {
          if (onProgress) {
            await onProgress(
              "preparing_images",
              `Preparing verified asset for Scene ${i + 1}: ${chosenCandidate.title.slice(0, 35)} (${chosenCandidate.provider})...`
            );
          }

          const filenamePrefix = `scene_${i + 1}_art`;
          const localPath = await ImageDownloader.downloadCandidate(
            chosenCandidate,
            defaultStorageDir,
            filenamePrefix
          );

          chosenCandidate.localPath = localPath;
          req.selectedAsset = chosenCandidate;
          selectedAssets.push(chosenCandidate);

          if (chosenCandidate.provider === "workspace") {
            workspaceAssetsUsed++;
          } else {
            externalAssetsUsed++;
          }

          const filename = path.basename(localPath);
          downloadedAssets.push({
            id: chosenCandidate.id,
            name: filename,
            originalFilename: filename,
            localPath,
            type: "image",
            mimeType: chosenCandidate.mimeType,
            url: chosenCandidate.url,
            sceneIndex: i,
            license: chosenCandidate.license,
            attributionText: chosenCandidate.license.attributionText,
          });

          attributions.push({
            sceneIndex: i + 1,
            assetTitle: chosenCandidate.title,
            author: chosenCandidate.license.authorName,
            provider: chosenCandidate.provider,
            license: chosenCandidate.license.name,
            attributionText: chosenCandidate.license.attributionText,
            sourceUrl: chosenCandidate.license.sourceUrl,
          });

          console.log(
            `[CompositeImageService] Bound Scene ${i + 1} -> ${chosenCandidate.title} (${chosenCandidate.provider}, Score: ${chosenCandidate.rankingScore || "N/A"})`
          );
        } catch (downloadErr: any) {
          console.warn(`[CompositeImageService] Download failed for ${chosenCandidate.id}: ${downloadErr.message}. Trying next candidate...`);
          // Try second candidate if available
          if (ranked.length > 1) {
            try {
              const fallbackCand = ranked[1].candidate;
              const localPath = await ImageDownloader.downloadCandidate(
                fallbackCand,
                defaultStorageDir,
                `scene_${i + 1}_art`
              );
              fallbackCand.localPath = localPath;
              req.selectedAsset = fallbackCand;
              selectedAssets.push(fallbackCand);
              externalAssetsUsed++;

              const filename = path.basename(localPath);
              downloadedAssets.push({
                id: fallbackCand.id,
                name: filename,
                originalFilename: filename,
                localPath,
                type: "image",
                mimeType: fallbackCand.mimeType,
                url: fallbackCand.url,
                sceneIndex: i,
                license: fallbackCand.license,
                attributionText: fallbackCand.license.attributionText,
              });

              attributions.push({
                sceneIndex: i + 1,
                assetTitle: fallbackCand.title,
                author: fallbackCand.license.authorName,
                provider: fallbackCand.provider,
                license: fallbackCand.license.name,
                attributionText: fallbackCand.license.attributionText,
                sourceUrl: fallbackCand.license.sourceUrl,
              });
            } catch {}
          }
        }
      }

      // If still no asset found and AI fallback enabled, generate bespoke artwork
      if (!req.selectedAsset && settings.aiFallbackEnabled) {
        try {
          console.log(`[CompositeImageService] Sourcing bespoke fallback visual for Scene ${i + 1}...`);
          const promptQuery = `${req.visualSubject}, high resolution 4k cinematic lighting, clean composition`;
          const seed = Math.floor(Math.random() * 900000) + 100000;
          const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
            promptQuery
          )}?model=sana&width=1280&height=720&nologo=true&seed=${seed}`;

          const candidate: ImageCandidate = {
            id: `ai_fallback_s${i + 1}_${seed}`,
            title: `AI Synthesized Visual: ${req.visualSubject}`,
            provider: "ai_generated",
            url: aiUrl,
            thumbnailUrl: aiUrl,
            sourcePageUrl: "https://pollinations.ai",
            width: 1280,
            height: 720,
            aspectRatio: "16:9",
            mimeType: "image/jpeg",
            license: {
              name: "Public Domain / Open Generation",
              commercialSafe: true,
              attributionRequired: false,
              attributionText: "Synthesized via Open Generative Diffusion",
              authorName: "Hyparlink Generative Engine",
              sourceUrl: "https://pollinations.ai",
            },
          };

          const localPath = await ImageDownloader.downloadCandidate(
            candidate,
            defaultStorageDir,
            `scene_${i + 1}_art`
          );
          candidate.localPath = localPath;
          req.selectedAsset = candidate;
          selectedAssets.push(candidate);
          aiGeneratedUsed++;

          const filename = path.basename(localPath);
          downloadedAssets.push({
            id: candidate.id,
            name: filename,
            originalFilename: filename,
            localPath,
            type: "image",
            mimeType: candidate.mimeType,
            url: candidate.url,
            sceneIndex: i,
            license: candidate.license,
            attributionText: candidate.license.attributionText,
          });

          attributions.push({
            sceneIndex: i + 1,
            assetTitle: candidate.title,
            author: "Hyparlink AI Engine",
            provider: "ai_generated",
            license: "Open Generation",
            attributionText: candidate.license.attributionText,
            sourceUrl: "https://pollinations.ai",
          });
        } catch (aiErr: any) {
          console.warn(`[CompositeImageService] AI fallback notice: ${aiErr.message}`);
        }
      }
    }

    const report: DiscoveredAssetReport = {
      visualAssetPlan: plan,
      selectedAssets,
      attributions,
      totalDiscovered: selectedAssets.length,
      workspaceAssetsUsed,
      externalAssetsUsed,
      aiGeneratedUsed,
    };

    return {
      report,
      downloadedAssets,
    };
  }

  /**
   * Tests connectivity to a specific provider.
   */
  public async testProvider(
    providerId: ImageSourceProvider,
    settings: ImageProviderSettings
  ): Promise<{ success: boolean; message: string; sampleCount?: number }> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return { success: false, message: `Unknown provider: ${providerId}` };
    }
    return provider.testConnection(settings);
  }
}

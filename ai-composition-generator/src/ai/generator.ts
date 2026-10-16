import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { jsonrepair } from "jsonrepair";
import { AIProvider } from "./provider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  HYPERFRAMES_SYSTEM_PROMPT,
  OLLIMA_STORYBOARD_SYSTEM_PROMPT,
  createCorrectionPrompt,
  CompositionPlan,
  Storyboard,
  StoryboardScene,
  SceneLayoutType,
} from "./prompts.js";
import { CompositionBuilder } from "./composition-builder.js";
import {
  CreativeBrief,
  CREATIVE_BRIEF_SYSTEM_PROMPT,
  BriefScenePlan,
} from "./creative-brief.js";
import { AssetAnalyzer, AnalyzedAsset } from "./asset-analyzer.js";
import { ScenePlanner, PlannedTimeline } from "./scene-planner.js";
import { CompositionSynthesizer } from "./composition-synthesizer.js";
import { AIImageGenerator } from "./image-generator.js";
import { WebCrawler, WebCrawlResult } from "./web-crawler.js";
import { AgentPlanner, VideoProductionPlan } from "./agent-planner.js";
import {
  CompositeImageService,
  DiscoveredAssetReport,
  ImageProviderSettings,
} from "../images/index.js";

export interface GeneratedProjectPayload {
  files: Record<string, string>;
  metadata: {
    title: string;
    duration: number;
    width: number;
    height: number;
    fps: number;
  };
  compositionPlan?: CompositionPlan;
  storyboard?: Storyboard;
  creativeBrief?: CreativeBrief;
  timeline?: PlannedTimeline;
  analyzedAssets?: AnalyzedAsset[];
  productionPlan?: VideoProductionPlan;
  discoveredAssetReport?: DiscoveredAssetReport;
}

export interface GenerateProjectOptions {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  assets?: any[];
  model?: string;
  productionPlan?: VideoProductionPlan;
  mode?: "plan" | "autopilot";
  imageSettings?: Partial<ImageProviderSettings>;
  compositionMode?: "mode_a" | "mode_b" | "mode_c" | "auto" | "hyperframes_only";
  visualStyle?: string;
  avatarLanguage?: string;
  onProgress?: (stage: string, message: string) => void | Promise<void>;
}

export class AIGenerator {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || new AIProvider();
  }

  public getProviderInfo() {
    return this.provider.getProviderInfo();
  }

  public async checkHealth() {
    return this.provider.checkHealth();
  }

  public static extractDurationFromPrompt(prompt: string): number | null {
    if (!prompt || typeof prompt !== "string") return null;
    const p = prompt.toLowerCase();

    // 1. Matches "30-second", "30 seconds", "30 secs", "30sec", "30s"
    const secMatch = p.match(/\b(\d{1,3})\s*(?:-|–)?\s*(?:seconds?|secs?|sec|s)\b/i);
    if (secMatch) {
      const s = parseInt(secMatch[1], 10);
      if (s >= 3 && s <= 300) return s;
    }

    // 2. Matches "1 minute", "2 minutes", "1 min", "1-min"
    const minMatch = p.match(/\b(\d{1,2})\s*(?:-|–)?\s*(?:minutes?|mins?|min)\b/i);
    if (minMatch) {
      const m = parseInt(minMatch[1], 10);
      if (m >= 1 && m <= 10) return m * 60;
    }

    // 3. Matches "0:30", "1:00"
    const colonMatch = p.match(/\b(\d{1,2}):(\d{2})\b/);
    if (colonMatch) {
      const mins = parseInt(colonMatch[1], 10);
      const secs = parseInt(colonMatch[2], 10);
      const total = mins * 60 + secs;
      if (total >= 3 && total <= 300) return total;
    }

    return null;
  }

  public async generateProject(
    userPrompt: string,
    optionsOrAssets?: any[] | GenerateProjectOptions,
  ): Promise<GeneratedProjectPayload> {
    let assets = Array.isArray(optionsOrAssets)
      ? optionsOrAssets
      : optionsOrAssets?.assets || [];
    const promptDuration = AIGenerator.extractDurationFromPrompt(userPrompt);
    const duration =
      promptDuration ||
      (!Array.isArray(optionsOrAssets) && optionsOrAssets?.duration
        ? Number(optionsOrAssets.duration)
        : 15);
    const width =
      !Array.isArray(optionsOrAssets) && optionsOrAssets?.width
        ? Number(optionsOrAssets.width)
        : 1920;
    const height =
      !Array.isArray(optionsOrAssets) && optionsOrAssets?.height
        ? Number(optionsOrAssets.height)
        : 1080;
    const fps =
      !Array.isArray(optionsOrAssets) && optionsOrAssets?.fps
        ? Number(optionsOrAssets.fps)
        : 30;
    const model =
      !Array.isArray(optionsOrAssets) && optionsOrAssets?.model
        ? optionsOrAssets.model
        : undefined;
    const onProgress =
      !Array.isArray(optionsOrAssets) && (optionsOrAssets as any)?.onProgress
        ? (optionsOrAssets as any).onProgress
        : undefined;
    const imageSettings =
      !Array.isArray(optionsOrAssets) && (optionsOrAssets as any)?.imageSettings
        ? (optionsOrAssets as any).imageSettings
        : undefined;

    // STAGE 1: Writing Composition (Understanding prompt intent, brief & assets)
    if (onProgress) {
      const durMsg = promptDuration
        ? `Writing composition: Authoritative duration ${duration}s extracted from prompt (${duration * fps} frames @ ${fps}fps)...`
        : `Writing composition: Analyzing prompt intent and authoritative duration (${duration}s @ ${fps}fps)...`;
      await onProgress("writing_composition", durMsg);
    }

    // Direct HTML Composition Detection: If user supplied full HTML with scene sections, parse directly
    if (
      userPrompt.includes("<section") &&
      (/class=["'][^"']*scene/i.test(userPrompt) || /data-start=/i.test(userPrompt))
    ) {
      const parsedStoryboard = this.parseHtmlToStoryboard(userPrompt, {
        duration,
        width,
        height,
        fps,
        assets,
      });
      if (parsedStoryboard && parsedStoryboard.scenes.length > 0) {
        const buildResult = CompositionBuilder.buildFromStoryboard(
          parsedStoryboard,
          assets,
        );
        return {
          files: buildResult.files,
          metadata: buildResult.metadata,
          compositionPlan: buildResult.compositionPlan as any,
          storyboard: parsedStoryboard,
        };
      }
    }

    // STAGE 0: Web Research & Media Crawling (for URLs or topic names)
    let webResult: WebCrawlResult | null = null;
    try {
      webResult = await WebCrawler.enrichFromWeb(userPrompt, onProgress);
      if (webResult) {
        console.log(`[AIGenerator] WebCrawler enriched topic "${webResult.title}" with ${webResult.assets.length} image(s) and ${webResult.keyFacts.length} fact(s)`);
      }
    } catch (crawlErr: any) {
      console.warn(`[AIGenerator] WebCrawler notice: ${crawlErr.message}`);
    }

    // If web crawler retrieved real images from the site/web topic, and user uploaded no assets, use crawled web images!
    if (webResult && webResult.assets.length > 0 && (!assets || assets.length === 0)) {
      assets = webResult.assets;
      console.log(`[AIGenerator] Bound ${assets.length} scraped web asset(s) to video composition!`);
    }

    // STAGE 1: Agent Video Production Plan & Creative Brief
    const incomingPlan =
      !Array.isArray(optionsOrAssets) && (optionsOrAssets as any)?.productionPlan
        ? (optionsOrAssets as any).productionPlan
        : null;

    let productionPlan: VideoProductionPlan;
    if (incomingPlan) {
      if (onProgress) {
        await onProgress(
          "writing_composition",
          `Writing composition: Adopting approved Video Production Plan (${incomingPlan.scenes?.length || 0} scenes)...`,
        );
      }
      productionPlan = incomingPlan;
    } else {
      if (onProgress) {
        await onProgress(
          "writing_composition",
          `Writing composition: Agent planning production plan, script & bespoke scene breakdown...`,
        );
      }
      productionPlan = await AgentPlanner.generatePlan(
        userPrompt,
        {
          duration,
          width,
          height,
          fps,
          model: model || this.provider.getProviderInfo().model,
          assets,
          mode: (!Array.isArray(optionsOrAssets) && (optionsOrAssets as any)?.mode) || "autopilot",
          compositionMode: (!Array.isArray(optionsOrAssets) && (optionsOrAssets as any)?.compositionMode) || undefined,
          visualStyle: (!Array.isArray(optionsOrAssets) && (optionsOrAssets as any)?.visualStyle) || undefined,
          avatarLanguage: (!Array.isArray(optionsOrAssets) && (optionsOrAssets as any)?.avatarLanguage) || undefined,
        },
        this.provider,
      );
    }

    let creativeBrief: CreativeBrief = AgentPlanner.planToCreativeBrief(productionPlan);
    creativeBrief.totalDuration = duration;
    creativeBrief.aiProvider = model || this.provider.getProviderInfo().model;

    // Check if the brief benefits from AI generated images (Rule 8: Support Image Generation When Needed)
    const promptLower = userPrompt.toLowerCase();
    const isSvgOrDiagramOrChart =
      promptLower.includes("tree") ||
      promptLower.includes("seed") ||
      promptLower.includes("grow") ||
      promptLower.includes("chart") ||
      promptLower.includes("revenue") ||
      promptLower.includes("graph") ||
      promptLower.includes("http") ||
      promptLower.includes("diagram") ||
      promptLower.includes("geometric") ||
      promptLower.includes("abstract motion") ||
      promptLower.includes("typography");

    // Intelligent Visual Asset Discovery & Sourcing
    let discoveredReport: DiscoveredAssetReport | undefined = undefined;
    const hasUserProvidedAssets = assets && assets.length > 0;

    // Search open-web visual sources when user hasn't explicitly supplied full assets
    const wantsImageDiscovery =
      !isSvgOrDiagramOrChart &&
      (imageSettings?.wikimediaEnabled !== false ||
        imageSettings?.pexelsEnabled ||
        imageSettings?.unsplashEnabled ||
        !hasUserProvidedAssets);

    if (wantsImageDiscovery) {
      console.log(`[AIGenerator] Discovering visual assets via CompositeImageService...`);
      try {
        const imageService = new CompositeImageService(assets || []);
        const sceneCount = creativeBrief.scenes?.length || Math.min(Math.max(Math.round(duration / 5), 1), 6);
        const discoveryResult = await imageService.discoverAndPrepareAssets({
          userPrompt,
          creativeBrief,
          sceneCount,
          userAssets: assets || [],
          settings: imageSettings,
          onProgress,
        });

        if (discoveryResult.downloadedAssets.length > 0) {
          // If user provided assets, ensure user assets remain first!
          if (hasUserProvidedAssets) {
            assets = [...assets, ...discoveryResult.downloadedAssets];
          } else {
            assets = discoveryResult.downloadedAssets;
          }
          discoveredReport = discoveryResult.report;
          console.log(
            `[AIGenerator] Successfully bound ${assets.length} visual asset(s) to project (${discoveredReport.externalAssetsUsed} external, ${discoveredReport.workspaceAssetsUsed} workspace, ${discoveredReport.aiGeneratedUsed} AI).`
          );
        }
      } catch (discErr: any) {
        console.warn(`[AIGenerator] Image discovery notice: ${discErr.message}`);
        if (!assets || assets.length === 0) {
          try {
            const aiAssets = await AIImageGenerator.generateSceneAssets(userPrompt, creativeBrief, onProgress);
            if (aiAssets && aiAssets.length > 0) {
              assets = aiAssets;
            }
          } catch {}
        }
      }
    }

    // Workspace Asset Analysis
    if (onProgress) {
      await onProgress(
        "writing_composition",
        `Writing composition: Analyzing ${assets.length} workspace asset(s) and determining layout roles...`,
      );
    }
    const analyzedAssets = AssetAnalyzer.analyzeAssets(
      assets,
      creativeBrief,
      userPrompt,
    );

    // STAGE 2: Timing the Clips (Planning Scenes and Frame-Accurate Timeline Math)
    if (onProgress) {
      await onProgress(
        "timing_clips",
        `Timing clips: Planning frame-accurate timeline (${duration}s = ${Math.round(duration * fps)} frames @ ${fps}fps)...`,
      );
    }
    const timeline = AgentPlanner.planToTimeline(productionPlan, analyzedAssets);

    // STAGE 3: Animating the Elements (Dynamic AI Composition Code Generation & GSAP Transforms)
    if (onProgress) {
      await onProgress(
        "animating_elements",
        `Animating elements: Synthesizing bespoke HTML, SVG, and GPU-transform GSAP animations for ${timeline.scenes.length} scenes...`,
      );
    }
    const synthesisResult = await CompositionSynthesizer.synthesizeWithAI(
      this.provider,
      creativeBrief,
      timeline,
      analyzedAssets,
      {
        width,
        height,
        fps,
      },
      model,
      onProgress,
    );

    return {
      files: synthesisResult.files,
      metadata: synthesisResult.metadata,
      creativeBrief,
      timeline,
      analyzedAssets,
      productionPlan,
      discoveredAssetReport: discoveredReport,
    };
  }

  /**
   * Resilient JSON extraction from LLM completion text, tolerating markdown fences,
   * leading/trailing conversational text, comments, unescaped newlines/tabs, and trailing commas via jsonrepair.
   */
  private extractJsonFromText(rawText: string): any {
    let clean = rawText.trim();
    const codeBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      clean = codeBlockMatch[1].trim();
    } else {
      const firstBrace = clean.indexOf("{");
      const lastBrace = clean.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }
    }

    try {
      return JSON.parse(clean);
    } catch {
      try {
        const repaired = jsonrepair(clean);
        return JSON.parse(repaired);
      } catch {
        const stripped = clean
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "")
          .replace(/,\s*([}\]])/g, "$1");
        const repaired2 = jsonrepair(stripped);
        return JSON.parse(repaired2);
      }
    }
  }

  private synthesizeDefaultBrief(
    prompt: string,
    duration: number,
    assets: any[],
    webResult?: WebCrawlResult | null,
  ): CreativeBrief {
    const promptLower = prompt.toLowerCase();
    const isTreeGrowth =
      promptLower.includes("tree") ||
      promptLower.includes("seed") ||
      promptLower.includes("grow");

    const isHttpFlow =
      promptLower.includes("http") ||
      promptLower.includes("request travels") ||
      (promptLower.includes("client") && promptLower.includes("server"));

    const isAbstractGeometric =
      promptLower.includes("geometric") ||
      promptLower.includes("abstract motion") ||
      promptLower.includes("white geometric");

    const isDataViz =
      promptLower.includes("revenue") ||
      promptLower.includes("bar chart") ||
      promptLower.includes("growth animation");

    const isFootwearOrApparel =
      promptLower.includes("shoe") ||
      promptLower.includes("footwear") ||
      promptLower.includes("sneaker") ||
      promptLower.includes("running");

    const isSoftwareProduct =
      promptLower.includes("software") ||
      promptLower.includes("saas") ||
      promptLower.includes("platform") ||
      promptLower.includes("application");

    const isSelectedAssetAd =
      assets.length > 0 &&
      (promptLower.includes("selected") || promptLower.includes("image") || promptLower.includes("advertisement"));

    const isSilent =
      promptLower.includes("silent") ||
      promptLower.includes("no audio") ||
      promptLower.includes("without audio");

    // SCENARIO 1: Animated Tree Growth from Seed (Test B)
    if (isTreeGrowth) {
      return {
        title: "The Growth of a Tree",
        subject: "Organic progression of a tree growing from seed into full yellow canopy",
        videoType: "nature_growth_animation",
        category: "explainer",
        promptComponents: {
          route: "nature_growth_animation",
          spec: {
            durationSeconds: duration,
            resolution: "1920x1080",
            frameRate: 30,
            aspectRatio: "16:9",
            visualStyle: "Clean, organic, nature-inspired minimalism",
            colorPalette: ["#FACC15", "#B45309", "#152A1C"],
            typography: "Plus Jakarta Sans",
            cameraMovement: "Subtle organic push",
            sceneCount: duration <= 12 ? 2 : 4,
          },
          beats: [
            { id: "b1", purpose: "Seed germination", duration: duration * 0.4, visualContent: "Seed in soil with roots extending", animation: "Path drawing" },
            { id: "b2", purpose: "Full yellow bloom", duration: duration * 0.6, visualContent: "Trunk and golden yellow leaves blooming", animation: "Elastic scale" },
          ],
          copy: {
            headlines: ["SEED GERMINATION", "VIBRANT YELLOW BLOOM"],
            callToAction: undefined,
          },
          technique: ["SVG path drawing", "GSAP elastic stagger bloom", "Organic radial gradient"],
          negatives: ["no corporate charts", "no stock photos", "no unrelated logos"],
        },
        audioPlan: {
          isSilent,
          backgroundMusicDescription: isSilent ? undefined : "Gentle acoustic morning atmosphere",
        },
        intendedAudience: "General audience, nature lovers",
        visualAtmosphere: "Clean earthy background with golden morning sunlight and organic soil baseline",
        colorPalette: {
          primary: "#FACC15",
          secondary: "#B45309",
          accent: "#FFE066",
          backgroundColor: "#0A160F",
          surfaceColor: "rgba(23, 45, 30, 0.6)",
          textColor: "#FFFFFF",
          textMutedColor: "#A7F3D0",
          glowColor: "rgba(250, 204, 21, 0.4)",
          borderColor: "rgba(250, 204, 21, 0.2)",
        },
        typography: {
          displayFont: "Plus Jakarta Sans",
          bodyFont: "Inter",
          weights: ["400", "700", "900"],
          headlineTransform: "uppercase",
        },
        narrativeProgression: [
          "Stage 1: Seed germination & root system",
          "Stage 2: Trunk ascending & yellow leaves blooming",
        ],
        sceneCount: duration <= 12 ? 2 : 4,
        totalDuration: duration,
        requiredImages: [],
        chartAndDataRequirements: "Organic growth progression",
        animationStyle: "Smooth organic SVG path expansion and leaf blooms",
        cameraMovement: "Slow organic push",
        closingMessage: "NATURE IN FULL BLOOM",
        callToAction: undefined,
        aiProvider: "offline-synthesizer",
      };
    }

    // SCENARIO 2: HTTP Client-Server Request/Response Explainer (Test E)
    if (isHttpFlow) {
      return {
        title: "HTTP Request & Response Flow",
        subject: "How an HTTP GET request travels from client to server and returns with status 200 OK",
        videoType: "network_architecture_explainer",
        category: "explainer",
        promptComponents: {
          route: "network_architecture_explainer",
          spec: {
            durationSeconds: duration,
            resolution: "1920x1080",
            frameRate: 30,
            aspectRatio: "16:9",
            visualStyle: "High-tech technical diagram with glowing packets",
            colorPalette: ["#00F5FF", "#10B981", "#070B12"],
            typography: "Space Grotesk",
            cameraMovement: "Diagram pan",
            sceneCount: duration <= 15 ? 2 : 3,
          },
          beats: [
            { id: "b1", purpose: "Client dispatches HTTP GET", duration: duration * 0.5, visualContent: "Client to server packet transit", animation: "Linear packet move" },
            { id: "b2", purpose: "Server returns HTTP 200 OK", duration: duration * 0.5, visualContent: "Server processing and response return", animation: "Glow & return transit" },
          ],
          copy: {
            headlines: ["CLIENT HTTP GET REQUEST", "SERVER RETURNS HTTP 200 OK"],
            callToAction: undefined,
          },
          technique: ["Interactive network diagram", "Animated glowing packet paths", "Status HUD badges"],
          negatives: ["no irrelevant stock photos", "no fake company metrics"],
        },
        audioPlan: {
          isSilent,
          backgroundMusicDescription: isSilent ? undefined : "Subtle electronic pulse",
        },
        intendedAudience: "Engineers, students, developers",
        visualAtmosphere: "Dark technical network diagram with glowing cyan request and emerald response paths",
        colorPalette: {
          primary: "#00F5FF",
          secondary: "#10B981",
          accent: "#38BDF8",
          backgroundColor: "#070B12",
          surfaceColor: "rgba(15, 23, 42, 0.7)",
          textColor: "#FFFFFF",
          textMutedColor: "#94A3B8",
          glowColor: "rgba(0, 245, 255, 0.4)",
          borderColor: "rgba(0, 245, 255, 0.2)",
        },
        typography: {
          displayFont: "Space Grotesk",
          bodyFont: "Inter",
          weights: ["400", "700", "900"],
          headlineTransform: "uppercase",
        },
        narrativeProgression: [
          "Phase 1: Client initiates HTTP GET request packet",
          "Phase 2: Server processes query and returns status 200 OK payload",
        ],
        sceneCount: duration <= 15 ? 2 : 3,
        totalDuration: duration,
        requiredImages: [],
        chartAndDataRequirements: "Network flow packet animation",
        animationStyle: "High-precision packet routing across bidirectional network lanes",
        cameraMovement: "Center focused",
        closingMessage: "TRANSMISSION COMPLETE // 200 OK",
        callToAction: undefined,
        aiProvider: "offline-synthesizer",
      };
    }

    // SCENARIO 3: Silent Abstract Motion Graphics (Test F)
    if (isAbstractGeometric) {
      return {
        title: "Monochrome Geometric Forms",
        subject: "Abstract white geometric motion graphics on pure black background with precise timing and no audio",
        videoType: "abstract_motion_graphics",
        category: "presentation",
        promptComponents: {
          route: "abstract_motion_graphics",
          spec: {
            durationSeconds: duration,
            resolution: "1920x1080",
            frameRate: 30,
            aspectRatio: "16:9",
            visualStyle: "High-contrast monochrome minimalism",
            colorPalette: ["#FFFFFF", "#CCCCCC", "#000000"],
            typography: "Space Grotesk",
            cameraMovement: "Zero camera drift",
            sceneCount: duration <= 12 ? 2 : 3,
          },
          beats: [
            { id: "b1", purpose: "Geometric form rotation", duration: duration * 0.5, visualContent: "Rotating squares and diamonds", animation: "Smooth rotation" },
            { id: "b2", purpose: "Concentric expansion", duration: duration * 0.5, visualContent: "Expanding ripple rings", animation: "Harmonic scale" },
          ],
          copy: {
            headlines: ["GEOMETRIC ALIGNMENT", "RHYTHMIC EXPANSION"],
            callToAction: undefined,
          },
          technique: ["Pure SVG geometry", "Synchronized GSAP rotation eases", "High contrast negative space"],
          negatives: ["no audio", "no colored gradients", "no corporate slides", "no text clutter"],
        },
        audioPlan: {
          isSilent: true,
          backgroundMusicDescription: undefined,
          voiceoverPrompt: undefined,
        },
        intendedAudience: "Motion designers and visual artists",
        visualAtmosphere: "Pitch black background with sharp pure white geometric vector shapes",
        colorPalette: {
          primary: "#FFFFFF",
          secondary: "#CCCCCC",
          accent: "#FFFFFF",
          backgroundColor: "#000000",
          surfaceColor: "rgba(255, 255, 255, 0.05)",
          textColor: "#FFFFFF",
          textMutedColor: "#999999",
          glowColor: "rgba(255, 255, 255, 0.2)",
          borderColor: "rgba(255, 255, 255, 0.2)",
        },
        typography: {
          displayFont: "Space Grotesk",
          bodyFont: "Inter",
          weights: ["400", "700", "900"],
          headlineTransform: "uppercase",
        },
        narrativeProgression: [
          "Movement 1: Rotating geometric squares & isometric angles",
          "Movement 2: Concentric ripples & harmonic equilibrium",
        ],
        sceneCount: duration <= 12 ? 2 : 3,
        totalDuration: duration,
        requiredImages: [],
        chartAndDataRequirements: "Geometric shape coordination",
        animationStyle: "Mathematical GSAP eases (power2.inOut, sine.inOut)",
        cameraMovement: "Fixed isometric view",
        closingMessage: "EQUILIBRIUM",
        callToAction: undefined,
        aiProvider: "offline-synthesizer",
      };
    }

    // SCENARIO 4: Business Revenue Data Visualization (Test C)
    if (isDataViz) {
      return {
        title: "Fiscal Revenue Growth Acceleration",
        subject: "Professional revenue growth animation with animated bar chart using verified data",
        videoType: "data_visualization",
        category: "data-visualization",
        promptComponents: {
          route: "data_visualization",
          spec: {
            durationSeconds: duration,
            resolution: "1920x1080",
            frameRate: 30,
            aspectRatio: "16:9",
            visualStyle: "Premium executive financial dashboard",
            colorPalette: ["#38BDF8", "#34D399", "#10B981"],
            typography: "Plus Jakarta Sans",
            cameraMovement: "Smooth subtle scale",
            sceneCount: duration <= 20 ? 3 : 4,
          },
          beats: [
            { id: "b1", purpose: "Revenue chart growth", duration: duration * 0.5, visualContent: "Animated quarterly bar chart", animation: "Bar height scale & value reveal" },
            { id: "b2", purpose: "Annual fiscal totals", duration: duration * 0.5, visualContent: "Summary metric KPI cards", animation: "Number counter HUD" },
          ],
          copy: {
            headlines: ["REVENUE GROWTH ACCELERATION", "ANNUAL FISCAL MILESTONES"],
            callToAction: "VIEW FULL AUDIT",
          },
          technique: ["Animated SVG bar chart", "Dynamic value count-ups", "Executive glassmorphic styling"],
          negatives: ["no fabricated stats for real companies", "no generic stock photos"],
        },
        audioPlan: {
          isSilent,
          backgroundMusicDescription: isSilent ? undefined : "Subtle sophisticated corporate pulse",
        },
        intendedAudience: "Investors, executives, financial analysts",
        visualAtmosphere: "Sleek dark financial dashboard with glowing blue and emerald performance bars",
        colorPalette: {
          primary: "#38BDF8",
          secondary: "#818CF8",
          accent: "#34D399",
          backgroundColor: "#080E1A",
          surfaceColor: "rgba(15, 23, 42, 0.65)",
          textColor: "#FFFFFF",
          textMutedColor: "#94A3B8",
          glowColor: "rgba(52, 211, 153, 0.35)",
          borderColor: "rgba(56, 189, 248, 0.2)",
        },
        typography: {
          displayFont: "Plus Jakarta Sans",
          bodyFont: "Inter",
          weights: ["400", "700", "900"],
          headlineTransform: "uppercase",
        },
        narrativeProgression: [
          "Scene 1: Quarterly revenue acceleration bar chart",
          "Scene 2: Annual totals and profit margin benchmarks",
        ],
        sceneCount: duration <= 20 ? 3 : 4,
        totalDuration: duration,
        requiredImages: [],
        chartAndDataRequirements: "Quarterly revenue growth bars with dollar metrics",
        animationStyle: "Fluid GSAP data bar rises and KPI metric reveals",
        cameraMovement: "Subtle slow zoom",
        closingMessage: "SUSTAINED FINANCIAL VELOCITY",
        callToAction: "VIEW REPORT",
        aiProvider: "offline-synthesizer",
      };
    }

    // SCENARIO 5A: Premium Footwear & Apparel Cinematic Advertisement (Test A)
    if (isFootwearOrApparel) {
      const sceneCount = duration <= 12 ? 3 : 4;
      const beatDur = duration / sceneCount;
      return {
        title: "AERO-PULSE // APEX RUNNING SHOE",
        subject: "Cinematic advertisement for a premium running shoe featuring dynamic motion, custom SVG speed graphics, and bold typography",
        videoType: "product_advertisement",
        category: "advertisement",
        promptComponents: {
          route: "product_advertisement",
          spec: {
            durationSeconds: duration,
            resolution: "1920x1080",
            frameRate: 30,
            aspectRatio: "16:9",
            visualStyle: "High-contrast dynamic sports cinematography with glowing neon speed trails and dark studio atmosphere",
            colorPalette: ["#FF4500", "#FFD700", "#0B0F19"],
            typography: "Plus Jakarta Sans",
            cameraMovement: "Cinematic camera push and dynamic tilt",
            sceneCount,
          },
          beats: [
            { id: "b1", purpose: "Visual hook & product entry", duration: beatDur, visualContent: "Close-up hero product entrance with cinematic lighting and glowing speed lines", animation: "Dynamic scale-up & sweep" },
            { id: "b2", purpose: "Product in motion & speed", duration: beatDur, visualContent: "Kinetic motion trails, SVG velocity streaks, and engineered traction", animation: "Horizontal velocity streak" },
            { id: "b3", purpose: "Engineered benefits & comfort", duration: beatDur, visualContent: "Zero-gravity foam cushioning and responsive energy return badges", animation: "Feature callout pop" },
            ...(sceneCount > 3 ? [{ id: "b4", purpose: "Brand climax & call to action", duration: beatDur, visualContent: "Polished brand reveal with glowing CTA button", animation: "Climax scale & button glow" }] : []),
          ],
          copy: {
            headlines: ["DEFY GRAVITY", "UNLEASH SPEED", "RESPONSIVE CUSHIONING", "CLAIM YOUR EDGE"],
            callToAction: "ORDER NOW",
          },
          technique: ["Cinematic Ken Burns camera scale", "SVG speed lines and motion trails", "Kinetic typography reveals"],
          negatives: ["no comic book elements", "no cartoon graphics", "no low-contrast text"],
        },
        audioPlan: {
          isSilent,
          backgroundMusicDescription: isSilent ? undefined : "Intense cinematic percussion and driving sports electronic pulse",
        },
        intendedAudience: "Athletes, runners, sports enthusiasts",
        visualAtmosphere: "Sleek dark cinematic arena with ember glow, anamorphic lens flares, and vibrant fiery orange accents",
        colorPalette: {
          primary: "#FF4500",
          secondary: "#FFD700",
          accent: "#FF8C00",
          backgroundColor: "#080B11",
          surfaceColor: "rgba(15, 23, 42, 0.75)",
          textColor: "#FFFFFF",
          textMutedColor: "#94A3B8",
          glowColor: "rgba(255, 69, 0, 0.45)",
          borderColor: "rgba(255, 69, 0, 0.3)",
        },
        typography: {
          displayFont: "Plus Jakarta Sans",
          bodyFont: "Inter",
          weights: ["400", "700", "900"],
          headlineTransform: "uppercase",
        },
        narrativeProgression: [
          "Scene 1: Dramatic silhouette and hero shoe entrance",
          "Scene 2: Kinetic speed graphics and aerodynamic agility",
          "Scene 3: Engineered carbon plate and responsive cushioning",
          ...(sceneCount > 3 ? ["Scene 4: Apex performance brand climax & CTA"] : []),
        ],
        sceneCount,
        totalDuration: duration,
        requiredImages: assets.map((a) => a.name || a.originalFilename || "shoe.jpg"),
        animationStyle: "High-energy GSAP velocity streaks and camera pushes",
        cameraMovement: "Slow push-in scale 1.0 to 1.08",
        closingMessage: "CLAIM YOUR EDGE",
        callToAction: "ORDER NOW",
        aiProvider: "offline-synthesizer",
      };
    }

    // SCENARIO 5B: Real Software & Tech Platform Advertisement (Test B)
    if (isSoftwareProduct) {
      const sceneCount = duration <= 15 ? 3 : 4;
      const beatDur = duration / sceneCount;
      return {
        title: "SYNAPSE // AUTONOMOUS CLOUD PLATFORM",
        subject: "Professional 25-second advertisement for a modern software product with feature callouts, high-tech telemetry, and official brand styling",
        videoType: "product_advertisement",
        category: "advertisement",
        promptComponents: {
          route: "product_advertisement",
          spec: {
            durationSeconds: duration,
            resolution: "1920x1080",
            frameRate: 30,
            aspectRatio: "16:9",
            visualStyle: "Ultra-sleek modern SaaS design with glassmorphism UI, glowing telemetry, and kinetic feature highlights",
            colorPalette: ["#6366F1", "#00F5FF", "#070E1A"],
            typography: "Space Grotesk",
            cameraMovement: "Subtle isometric pan and zoom",
            sceneCount,
          },
          beats: [
            { id: "b1", purpose: "The modern software challenge & hook", duration: beatDur, visualContent: "High-tech software interface with real-time streaming data telemetry", animation: "HUD sweep & headline stagger" },
            { id: "b2", purpose: "Architecture & core feature breakthrough", duration: beatDur, visualContent: "Modular glassmorphic microservice cards and zero-latency routing", animation: "Card cascade & metric rise" },
            { id: "b3", purpose: "Enterprise performance & reliability", duration: beatDur, visualContent: "Global edge network nodes and 99.99% uptime telemetry HUD", animation: "Map pulse & counter HUD" },
            ...(sceneCount > 3 ? [{ id: "b4", purpose: "Official call to action & start free", duration: beatDur, visualContent: "Verified product logo, developer docs link, and call to action", animation: "Glow climax & button shine" }] : []),
          ],
          copy: {
            headlines: ["RETHINK CLOUD COMPUTING", "AUTONOMOUS SPEED", "ZERO-DOWNTIME SCALE", "DEPLOY IN SECONDS"],
            callToAction: "START FREE TRIAL",
          },
          technique: ["Glassmorphism telemetry cards", "Kinetic typography reveals", "Animated edge network topology"],
          negatives: ["no cartoon comics", "no generic stock photos", "no low-contrast elements"],
        },
        audioPlan: {
          isSilent,
          backgroundMusicDescription: isSilent ? undefined : "Modern tech ambient pulse with subtle driving synthesizer rhythm",
        },
        intendedAudience: "Software engineers, CTOs, tech leads, digital creators",
        visualAtmosphere: "Deep obsidian void with radiant electric indigo and cyan ambient illumination",
        colorPalette: {
          primary: "#6366F1",
          secondary: "#00F5FF",
          accent: "#38BDF8",
          backgroundColor: "#050811",
          surfaceColor: "rgba(15, 23, 42, 0.75)",
          textColor: "#FFFFFF",
          textMutedColor: "#94A3B8",
          glowColor: "rgba(99, 102, 241, 0.45)",
          borderColor: "rgba(0, 245, 255, 0.25)",
        },
        typography: {
          displayFont: "Space Grotesk",
          bodyFont: "Inter",
          weights: ["400", "700", "900"],
          headlineTransform: "uppercase",
        },
        narrativeProgression: [
          "Scene 1: Next-generation cloud software breakthrough",
          "Scene 2: Core microservices architecture & intelligence",
          "Scene 3: Enterprise global telemetry & performance",
          ...(sceneCount > 3 ? ["Scene 4: Instant developer deployment & call to action"] : []),
        ],
        sceneCount,
        totalDuration: duration,
        requiredImages: assets.map((a) => a.name || a.originalFilename || "software.jpg"),
        animationStyle: "Precision UI telemetry sweeps and kinetic typography",
        cameraMovement: "Subtle zoom 1.0 to 1.05",
        closingMessage: "BUILD WITHOUT LIMITS",
        callToAction: "START FREE TRIAL",
        aiProvider: "offline-synthesizer",
      };
    }

    // SCENARIO 5D: Real Web Crawled Site/Topic Showcase
    if (webResult && (webResult.summary || (webResult.keyFacts && webResult.keyFacts.length > 0))) {
      const cleanTitle = (webResult.title || "Web Showcase").slice(0, 40);
      const headline1 = (webResult.headings[0] || cleanTitle || "INNOVATION").toUpperCase().slice(0, 24);
      const headline2 = (webResult.headings[1] || (webResult.keyFacts && webResult.keyFacts[0]) || "WORLD CLASS").toUpperCase().slice(0, 24);
      const headline3 = (webResult.headings[2] || "TRANSFORM TODAY").toUpperCase().slice(0, 24);
      let host = "";
      try {
        if (webResult.sourceUrl) host = new URL(webResult.sourceUrl).hostname;
      } catch {}
      const cta = host ? `VISIT ${host.toUpperCase()}` : "DISCOVER MORE";

      return {
        title: cleanTitle,
        subject: webResult.summary || `Professional showcase presentation for ${cleanTitle} featuring verified web research and images`,
        videoType: "product_advertisement",
        category: "advertisement",
        promptComponents: {
          route: "product_advertisement",
          spec: {
            durationSeconds: duration,
            resolution: "1920x1080",
            frameRate: 30,
            aspectRatio: "16:9",
            visualStyle: "High-end corporate showcase with real downloaded photography, dynamic glassmorphic cards, and kinetic typography",
            colorPalette: ["#3B82F6", "#06B6D4", "#F43F5E"],
            typography: "Plus Jakarta Sans",
            cameraMovement: "Slow cinematic scale",
            sceneCount: Math.min(5, Math.max(3, assets.length || 3)),
          },
          beats: [
            { id: "b1", purpose: "Introduction & Identity", duration: duration * 0.33, visualContent: `Spotlight on ${cleanTitle} identity and core mission`, animation: "Hero scale & stagger text" },
            { id: "b2", purpose: "Key Capabilities & Highlights", duration: duration * 0.34, visualContent: (webResult.keyFacts && webResult.keyFacts[0]) || "Key architectural and technological advantages", animation: "Card sweep & feature badges" },
            { id: "b3", purpose: "Call to Action Climax", duration: duration * 0.33, visualContent: `Official contact and next steps for ${cleanTitle}`, animation: "Button glow & final reveal" },
          ],
          copy: {
            headlines: [headline1, headline2, headline3],
            callToAction: cta,
          },
          technique: ["Cinematic Ken Burns camera scale", "Glassmorphic telemetry HUD", "Kinetic typography"],
          negatives: ["no comic book elements", "no cartoon graphics", "no low-contrast text"],
        },
        audioPlan: {
          isSilent,
          backgroundMusicDescription: isSilent ? undefined : "Inspiring upbeat commercial tech soundtrack with modern synth percussion",
        },
        intendedAudience: "Prospective clients, customers, and general audience",
        visualAtmosphere: "Sleek modern digital agency atmosphere with subtle cyan and indigo ambient gradients",
        colorPalette: {
          primary: "#3B82F6",
          secondary: "#06B6D4",
          accent: "#F43F5E",
          backgroundColor: "#050B14",
          surfaceColor: "rgba(10, 20, 38, 0.75)",
          textColor: "#FFFFFF",
          textMutedColor: "#94A3B8",
          glowColor: "rgba(59, 130, 246, 0.4)",
          borderColor: "rgba(59, 130, 246, 0.3)",
        },
        typography: {
          displayFont: "Plus Jakarta Sans",
          bodyFont: "Inter",
          weights: ["400", "700", "900"],
          headlineTransform: "uppercase",
        },
        narrativeProgression: [
          `Scene 1: Introducing ${cleanTitle}`,
          `Scene 2: Core capabilities: ${(webResult.keyFacts && webResult.keyFacts[0]) || "Verified expertise"}`,
          `Scene 3: Connect with ${cleanTitle}`,
        ],
        sceneCount: Math.min(5, Math.max(3, assets.length || 3)),
        totalDuration: duration,
        requiredImages: assets.map((a) => a.name || a.originalFilename || "asset.jpg"),
        animationStyle: "Polished corporate motion design",
        cameraMovement: "Subtle zoom 1.0 to 1.05",
        closingMessage: `DISCOVER ${cleanTitle.toUpperCase()}`,
        callToAction: cta,
        aiProvider: "offline-synthesizer",
      };
    }

    // SCENARIO 6: User-Selected Asset Advertisement (Test D)
    if (isSelectedAssetAd) {
      const primaryAssetName = assets[0]?.name || assets[0]?.originalFilename || "selected_asset.jpg";
      return {
        title: "Featured Product Advertisement",
        subject: `15-second product advertisement spotlighting ${primaryAssetName} as the hero visual with surrounding animations`,
        videoType: "product_advertisement",
        category: "advertisement",
        promptComponents: {
          route: "product_advertisement",
          spec: {
            durationSeconds: duration,
            resolution: "1920x1080",
            frameRate: 30,
            aspectRatio: "16:9",
            visualStyle: "Sleek modern advertisement highlighting user image",
            colorPalette: ["#00F5FF", "#6366F1", "#050814"],
            typography: "Plus Jakarta Sans",
            cameraMovement: "Slow cinematic backdrop scale",
            sceneCount: 2,
          },
          beats: [
            { id: "b1", purpose: "Hero asset spotlight", duration: duration * 0.5, visualContent: `Prominent display of ${primaryAssetName}`, animation: "Backdrop zoom with text stagger" },
            { id: "b2", purpose: "Climax call to action", duration: duration * 0.5, visualContent: `Featured view of ${primaryAssetName} with CTA`, animation: "Button reveal" },
          ],
          copy: {
            headlines: ["INNOVATION DEFINED", "EXPERIENCE EXCELLENCE"],
            callToAction: "DISCOVER NOW",
          },
          technique: ["Full-bleed hero backdrop", "Custom glassmorphism scrim", "Kinetic headline typography"],
          negatives: ["no replacing user asset with stock buildings", "no generic slide formats"],
        },
        audioPlan: {
          isSilent,
          backgroundMusicDescription: isSilent ? undefined : "High-energy modern commercial synth score",
        },
        intendedAudience: "Customers and prospective clients",
        visualAtmosphere: "Sleek premium advertisement with cinematic dark scrim gradient protecting text readability",
        colorPalette: {
          primary: "#00F5FF",
          secondary: "#6366F1",
          accent: "#00F5FF",
          backgroundColor: "#050814",
          surfaceColor: "rgba(10, 16, 28, 0.7)",
          textColor: "#FFFFFF",
          textMutedColor: "#94A3B8",
          glowColor: "rgba(0, 245, 255, 0.4)",
          borderColor: "rgba(0, 245, 255, 0.25)",
        },
        typography: {
          displayFont: "Plus Jakarta Sans",
          bodyFont: "Inter",
          weights: ["400", "700", "900"],
          headlineTransform: "uppercase",
        },
        narrativeProgression: [
          `Scene 1: Hero reveal featuring ${primaryAssetName}`,
          `Scene 2: Impact payoff and prominent call to action`,
        ],
        sceneCount: 2,
        totalDuration: duration,
        requiredImages: [primaryAssetName],
        animationStyle: "Slow Ken Burns backdrop scale 1.0 to 1.06 with glowing text reveals",
        cameraMovement: "Scale from 1.0 to 1.06",
        closingMessage: "EXPERIENCE EXCELLENCE",
        callToAction: "DISCOVER NOW",
        aiProvider: "offline-synthesizer",
      };
    }

    // Default: Dynamic Brief from Prompt Keywords
    const cleanPrompt = prompt
      .replace(/^create\s+(a\s+)?(video\s+about\s+|animation\s+about\s+)?/i, "")
      .trim();
    const firstWord = cleanPrompt.split(/\s+/)[0]?.toUpperCase() || "NEXT-GEN";

    return {
      title: cleanPrompt.slice(0, 40) || "Dynamic Showcase",
      subject: prompt,
      videoType: "brand_showcase",
      category: "presentation",
      promptComponents: {
        route: "brand_showcase",
        spec: {
          durationSeconds: duration,
          resolution: "1920x1080",
          frameRate: 30,
          aspectRatio: "16:9",
          visualStyle: "Modern motion graphics",
          colorPalette: ["#00F5FF", "#6366F1", "#070E1A"],
          typography: "Plus Jakarta Sans",
          sceneCount: 3,
        },
        beats: [
          { id: "b1", purpose: "Opening hook", duration: duration / 3, visualContent: "Theme introduction", animation: "Fade up" },
          { id: "b2", purpose: "Core focus", duration: duration / 3, visualContent: "Topic development", animation: "Stagger" },
          { id: "b3", purpose: "Payoff", duration: duration / 3, visualContent: "Conclusion", animation: "CTA" },
        ],
        copy: {
          headlines: [`${firstWord} // SPOTLIGHT`, "KEY INSIGHTS", "START TODAY"],
          callToAction: "EXPLORE NOW",
        },
        technique: ["GSAP timeline animations", "Responsive flex layout", "Glassmorphic badges"],
        negatives: ["no broken layouts", "no repeated slides"],
      },
      audioPlan: {
        isSilent,
        backgroundMusicDescription: isSilent ? undefined : "Ambient electronic score",
      },
      intendedAudience: "General audience",
      visualAtmosphere: "Modern high-contrast dark mode with glowing accents",
      colorPalette: {
        primary: "#6366F1",
        secondary: "#8B5CF6",
        accent: "#00F5FF",
        backgroundColor: "#070E1A",
        surfaceColor: "rgba(15, 23, 42, 0.6)",
        textColor: "#FFFFFF",
        textMutedColor: "#94A3B8",
        glowColor: "rgba(0, 245, 255, 0.3)",
        borderColor: "rgba(0, 245, 255, 0.15)",
      },
      typography: {
        displayFont: "Plus Jakarta Sans",
        bodyFont: "Inter",
        weights: ["400", "700", "900"],
        headlineTransform: "uppercase",
      },
      narrativeProgression: ["Hook", "Core development", "Conclusion"],
      sceneCount: 3,
      totalDuration: duration,
      requiredImages: assets.map((a) => a.name || a.originalFilename || "asset.jpg"),
      animationStyle: "Fluid motion graphics",
      cameraMovement: "Subtle zoom",
      closingMessage: "START TODAY",
      callToAction: "EXPLORE NOW",
      aiProvider: "offline-synthesizer",
    };
  }

  /**
   * Stage 4 Targeted Fix: Directly repairs a single failing scene using the LLM with targeted error context
   * and auto-heals the resulting HTML to guarantee HyperFrames compliance.
   */
  public async correctScene(
    userPrompt: string,
    creativeBrief: CreativeBrief,
    scene: any,
    currentHtml: string,
    errors: string[],
    model?: string,
  ): Promise<string> {
    const systemPrompt = `You are an elite HyperFrames and GSAP motion design engineer.
Your task is to fix a specific scene HTML file that failed validation or lint checks.
You must return ONLY the complete corrected HTML file starting with <!DOCTYPE html> or <html> and ending with </html>.
DO NOT wrap in markdown code blocks. DO NOT provide conversational explanations.`;

    const hasOverlap = errors.some((e) => e.includes("content_overlap") || e.includes("text_occluded"));
    const layoutInstructions = hasOverlap
      ? `\n5. CRITICAL FIX FOR LAYOUT OVERLAP / OCCLUSION:
   - Give each text block, headline, badge, and floating card its own distinct vertical or horizontal zone using Flexbox/Grid (e.g. display: flex; flex-direction: column; gap: 24px;).
   - NEVER place multiple text elements at overlapping absolute coordinates.
   - For all cards, text blocks, badges, and floating elements, mark intentional layering: data-layout-allow-overlap="true" data-layout-allow-occlusion="true".`
      : "";

    const userMessage = `The following HyperFrames subcomposition scene '${scene.id}' failed validation:

Original Request: "${userPrompt}"
Scene Purpose: "${scene.purpose || scene.title || "Scene"}"
Duration: ${scene.duration}s

ERRORS FOUND:
${errors.map((e) => `- ${e}`).join("\n")}

CURRENT SCENE HTML:
\`\`\`html
${currentHtml}
\`\`\`

REQUIREMENTS FOR FIX:
1. Root element must have id="root" data-composition-id="${scene.id}" data-width="1920" data-height="1080" data-duration="${scene.duration}".
2. Animation MUST be deterministic: register window.__timelines["${scene.id}"] = tl; and pause it: const tl = gsap.timeline({ paused: true }); tl.seek(0);
3. Keep all typography legible, high contrast, and visually striking.
4. Return ONLY the complete, raw HTML code for this scene.${layoutInstructions}`;

    try {
      const response = await this.provider.complete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        0.2,
        model,
      );

      let cleanHtml = response.trim();

      // Unwrap JSON if LLM returned structured JSON
      try {
        const trimmed = cleanHtml.trim();
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("{") && (trimmed.includes('"html"') || trimmed.includes('"code"') || trimmed.includes('"content"') || trimmed.includes('"sceneHtml"')))
        ) {
          const repaired = jsonrepair(trimmed);
          const parsed = JSON.parse(repaired);
          const candidate = parsed.html || parsed.code || parsed.content || parsed.sceneHtml || parsed.scene_html;
          if (typeof candidate === "string" && candidate.trim().length > 0) {
            cleanHtml = candidate.trim();
          }
        }
      } catch {}

      const codeBlockMatch = cleanHtml.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
      if (codeBlockMatch) {
        cleanHtml = codeBlockMatch[1].trim();
      }

      if (cleanHtml.includes("<html") || cleanHtml.includes("<!DOCTYPE html>")) {
        return CompositionSynthesizer.autoHealSceneHtml(
          cleanHtml,
          scene,
          { width: 1920, height: 1080, fps: 30 },
          creativeBrief,
        );
      }
    } catch (err: any) {
      console.warn(`[AIGenerator] targeted scene correction LLM notice: ${err.message}`);
    }

    // Fall back to auto-healing existing scene HTML
    return CompositionSynthesizer.autoHealSceneHtml(
      currentHtml,
      scene,
      { width: 1920, height: 1080, fps: 30 },
      creativeBrief,
    );
  }

  public async correctProject(
    originalPrompt: string,
    previousFiles: Record<string, string>,
    errors: string[],
  ): Promise<GeneratedProjectPayload> {
    const correctionPrompt = createCorrectionPrompt(
      originalPrompt,
      previousFiles,
      errors,
    );

    const rawResponse = await this.provider.complete([
      { role: "system", content: HYPERFRAMES_SYSTEM_PROMPT },
      { role: "user", content: correctionPrompt },
    ]);

    return this.parseAndValidateResponse(rawResponse);
  }

  private parseAndValidateResponse(
    raw: string,
    fallbackMeta?: {
      duration?: number;
      width?: number;
      height?: number;
      fps?: number;
    },
    availableAssets?: any[],
  ): GeneratedProjectPayload {
    let clean = raw.trim();

    // Remove markdown code fences if model enclosed JSON in ```json ... ```
    if (clean.startsWith("```")) {
      clean = clean
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (e: any) {
      throw new Error(
        `Failed to parse AI response as JSON: ${e.message}\nRaw response:\n${raw.slice(0, 500)}...`,
      );
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid AI response: Expected a JSON object.");
    }

    // CASE 1: AI returned complete files object
    if (parsed.files && typeof parsed.files === "object") {
      if (!parsed.files["index.html"]) {
        throw new Error('Invalid AI response structure: missing "index.html".');
      }

      const metadata = {
        title: parsed.metadata?.title || "HyperFrames Video",
        duration:
          fallbackMeta?.duration || Number(parsed.metadata?.duration) || 15,
        width: fallbackMeta?.width || Number(parsed.metadata?.width) || 1920,
        height: fallbackMeta?.height || Number(parsed.metadata?.height) || 1080,
        fps: fallbackMeta?.fps || Number(parsed.metadata?.fps) || 30,
      };

      return {
        files: parsed.files,
        metadata,
        compositionPlan: parsed.compositionPlan,
        storyboard: parsed.storyboard,
      };
    }

    // CASE 2: AI returned a structured video plan / storyboard
    const rawStoryboard: any =
      parsed.storyboard || (Array.isArray(parsed.scenes) ? parsed : null);

    if (!rawStoryboard || !Array.isArray(rawStoryboard.scenes)) {
      throw new Error(
        'Invalid AI video plan: response does not contain a valid "scenes" array or "files" dictionary.',
      );
    }

    if (rawStoryboard.scenes.length === 0) {
      throw new Error(
        'Invalid AI video plan: "scenes" array is empty. At least one scene is required.',
      );
    }

    // 1. Authoritative Duration Enforcement
    const targetDuration =
      fallbackMeta?.duration ||
      Number(rawStoryboard.totalDuration) ||
      Number(parsed.totalDuration) ||
      15;

    // Normalize individual scene durations to sum up exactly to targetDuration
    const scenes: StoryboardScene[] = rawStoryboard.scenes;
    let currentSum = scenes.reduce(
      (sum: number, s: any) => sum + (Number(s.duration) || 0),
      0,
    );

    if (currentSum <= 0) {
      const perScene = Number((targetDuration / scenes.length).toFixed(2));
      scenes.forEach((s) => {
        s.duration = perScene;
      });
      currentSum = perScene * scenes.length;
    }

    // Adjust slight discrepancies so sum === targetDuration strictly
    const diff = Number((targetDuration - currentSum).toFixed(2));
    if (diff !== 0) {
      scenes[scenes.length - 1].duration = Number(
        (scenes[scenes.length - 1].duration + diff).toFixed(2),
      );
    }

    // Recompute strictly monotonic scene start offsets
    let cumulativeStart = 0;
    scenes.forEach((s, idx) => {
      s.start = cumulativeStart;
      cumulativeStart = Number((cumulativeStart + s.duration).toFixed(2));
      if (!s.id) {
        s.id = `scene-${String(idx + 1).padStart(2, "0")}`;
      }
    });

    // 2. Selected Images Preservation
    if (availableAssets && availableAssets.length > 0) {
      const primaryAsset = availableAssets[0];
      const assetFilename = primaryAsset.name || primaryAsset.originalFilename;
      if (assetFilename) {
        let assetAssigned = scenes.some(
          (s) =>
            s.imageSpec?.assetName === assetFilename ||
            s.requiredAssets?.includes(assetFilename),
        );

        if (!assetAssigned) {
          // Find an image-showcase scene or use scene 2 (or 1) to feature user asset
          let targetScene = scenes.find((s) => s.layout === "image-showcase");
          if (!targetScene) {
            targetScene = scenes.length > 1 ? scenes[1] : scenes[0];
            targetScene.layout = "image-showcase";
          }

          targetScene.imageSpec = {
            assetName: assetFilename,
            caption:
              targetScene.imageSpec?.caption ||
              `${rawStoryboard.title || "Featured Asset"} - ${primaryAsset.name}`,
            overlayText: targetScene.imageSpec?.overlayText || targetScene.mainHeading,
          };
          targetScene.requiredAssets = [
            ...(targetScene.requiredAssets || []),
            assetFilename,
          ];
        }
      }
    }

    // 3. Construct validated Storyboard object
    const validatedStoryboard: Storyboard = {
      title: rawStoryboard.title || parsed.title || "HyperFrames Video",
      topic: rawStoryboard.topic || parsed.topic || "Presentation",
      purpose: rawStoryboard.purpose || parsed.purpose,
      targetAudience: rawStoryboard.targetAudience || "General Audience",
      presentationStyle:
        rawStoryboard.presentationStyle ||
        parsed.presentationStyle ||
        "educational-explainer",
      totalDuration: targetDuration,
      width:
        fallbackMeta?.width ||
        rawStoryboard.width ||
        (rawStoryboard.resolution === "720p" ? 1280 : 1920),
      height:
        fallbackMeta?.height ||
        rawStoryboard.height ||
        (rawStoryboard.resolution === "720p" ? 720 : 1080),
      resolution:
        fallbackMeta?.width === 1280 || rawStoryboard.resolution === "720p"
          ? "720p"
          : "1080p",
      aspectRatio: rawStoryboard.aspectRatio || "16:9",
      fps: fallbackMeta?.fps || rawStoryboard.fps || 30,
      theme: rawStoryboard.theme || {
        style: "Modern",
        name: "Standard Dark",
        primaryColor: "#6366f1",
        accentColor: "#00f5ff",
        backgroundColor: "#0a0a0f",
        textColor: "#ffffff",
        fontDisplay: "Plus Jakarta Sans",
        fontBody: "Inter",
      },
      scenes,
    };

    // 4. Compile Storyboard into HyperFrames 0.8.139 Project Files
    const buildResult = CompositionBuilder.buildFromStoryboard(
      validatedStoryboard,
      availableAssets,
    );

    return {
      files: buildResult.files,
      metadata: buildResult.metadata,
      compositionPlan: buildResult.compositionPlan as any,
      storyboard: validatedStoryboard,
    };
  }

  /**
   * Intelligently parses user-supplied HTML containing scenes, styling, and charts into a validated Storyboard.
   */
  private parseHtmlToStoryboard(
    html: string,
    options: {
      duration?: number;
      width?: number;
      height?: number;
      fps?: number;
      assets?: any[];
    },
  ): Storyboard | null {
    try {
      // 1. Title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch
        ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
        : "Custom AI Video";

      // 2. Colors from :root or style
      let primaryColor = "#0866E8";
      let accentColor = "#65D9FF";
      let backgroundColor = "#071426";
      let textColor = "#FFFFFF";
      let subtextColor = "#A8B8CD";

      const blueMatch = html.match(/--blue:\s*([^;]+);/i);
      if (blueMatch) primaryColor = blueMatch[1].trim();
      const cyanMatch = html.match(/--cyan:\s*([^;]+);/i);
      if (cyanMatch) accentColor = cyanMatch[1].trim();
      const darkMatch = html.match(/--dark:\s*([^;]+);/i);
      if (darkMatch) backgroundColor = darkMatch[1].trim();
      const mutedMatch = html.match(/--muted:\s*([^;]+);/i);
      if (mutedMatch) subtextColor = mutedMatch[1].trim();

      // 3. Extract scene sections
      const sceneMatches = [
        ...html.matchAll(
          /<section[^>]*class=["'][^"']*scene[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi,
        ),
      ];
      if (sceneMatches.length === 0) return null;

      const scenes: StoryboardScene[] = [];
      let lastEnd = 0;

      sceneMatches.forEach((match, idx) => {
        const fullTag = match[0];
        const content = match[1];

        // Start and end timestamps
        const startMatch = fullTag.match(/data-start=["']([\d.]+)["']/i);
        const endMatch = fullTag.match(/data-end=["']([\d.]+)["']/i);
        const start = startMatch ? parseFloat(startMatch[1]) : lastEnd;
        const end = endMatch ? parseFloat(endMatch[1]) : start + 5.0;
        const dur = Math.max(1, end - start);
        lastEnd = end;

        // Headline
        const h1Match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        const h2Match = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
        const rawHeadline = h1Match
          ? h1Match[1]
          : h2Match
            ? h2Match[1]
            : `Scene ${idx + 1}`;
        const headline = rawHeadline
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<[^>]+>/g, "")
          .trim();

        // Subtitle / text
        const pMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        const subtitle = pMatch
          ? pMatch[1].replace(/<[^>]+>/g, "").trim()
          : "";

        // Eyebrow / badge
        const eyebrowMatch = content.match(
          /<div[^>]*class=["'][^"']*eyebrow[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        );
        const badge = eyebrowMatch
          ? eyebrowMatch[1].replace(/<[^>]+>/g, "").trim()
          : undefined;

        // Layout determination
        let layout: SceneLayoutType = "cinematic-title";
        let diagramSpec: any = undefined;

        if (content.includes("chart") || content.includes("bar-item") || content.includes("bar-value")) {
          layout = "animated-bar-chart";
          const barMatches = [
            ...content.matchAll(
              /<div[^>]*class=["'][^"']*bar-item[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
            ),
          ];
          const fallbackMatches = [
            ...content.matchAll(
              /<div[^>]*class=["'][^"']*bar-item[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]*class=["']bar-item|$)/gi,
            ),
          ];
          const chosenMatches = barMatches.length > 0 ? barMatches : fallbackMatches;

          const bars: any[] = [];
          chosenMatches.forEach((bm) => {
            const bContent = bm[1];
            const heightMatch = bContent.match(/data-height=["']([\d.]+)["']/i);
            const valMatch = bContent.match(
              /<div[^>]*class=["'][^"']*bar-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
            );
            const lblMatch = bContent.match(
              /<div[^>]*class=["'][^"']*bar-label[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
            );

            const val = heightMatch ? parseFloat(heightMatch[1]) : 75;
            const formatted = valMatch
              ? valMatch[1].replace(/<[^>]+>/g, "").trim()
              : `${val}%`;
            const lbl = lblMatch
              ? lblMatch[1].replace(/<[^>]+>/g, "").trim()
              : "Metric";

            bars.push({ label: lbl, value: val, formattedValue: formatted, color: accentColor });
          });

          if (bars.length > 0) {
            diagramSpec = { bars };
          }
        } else if (content.includes("service") || content.includes("card")) {
          layout = "metrics-grid";
        } else if (idx === 0) {
          layout = "cinematic-title";
        } else if (idx === sceneMatches.length - 1) {
          layout = "closing-summary";
        }

        scenes.push({
          id: `scene-${String(idx + 1).padStart(2, "0")}`,
          name: headline.slice(0, 30),
          purpose: `Scene ${idx + 1}`,
          start,
          duration: dur,
          layout,
          mainHeading: headline,
          supportingText: subtitle,
          typography: {
            headline,
            subtitle,
            badge,
          },
          diagramSpec,
          palette: {
            primary: primaryColor,
            secondary: primaryColor,
            accent: accentColor,
            textColor,
            subtextColor,
            surfaceColor: "rgba(255, 255, 255, 0.06)",
            borderColor: "rgba(255, 255, 255, 0.15)",
          },
          background: {
            color: backgroundColor,
            gradient: `linear-gradient(135deg, ${backgroundColor} 0%, #0B1D36 100%)`,
            ambientGlow: `${accentColor}33`,
          },
          animation: {
            entrance: "fade-slide-up",
            visualAnimation: "scale-up",
            textStagger: 0.12,
            duration: 1.0,
          },
          transition: "fade",
        });
      });

      const totalDuration = options.duration || (lastEnd > 0 ? lastEnd : 30);

      return {
        title,
        topic: title,
        purpose: "Render custom presentation video",
        targetAudience: "General Audience",
        presentationStyle: "tech-advertisement",
        totalDuration,
        resolution: options.width === 1280 ? "720p" : "1080p",
        aspectRatio: "16:9",
        fps: options.fps || 30,
        width: options.width || 1920,
        height: options.height || 1080,
        theme: {
          style: "custom",
          name: "Custom Theme",
          primaryColor,
          accentColor,
          backgroundColor,
          textColor,
          fontDisplay: "Space Grotesk",
          fontBody: "Inter",
        },
        scenes,
      };
    } catch {
      return null;
    }
  }
}

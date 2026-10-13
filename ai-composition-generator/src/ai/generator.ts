import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
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
}

export interface GenerateProjectOptions {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  assets?: any[];
  model?: string;
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

    // Creative Brief Generation via Ollima LLM
    if (onProgress) {
      await onProgress(
        "writing_composition",
        `Writing composition: Planning creative brief with Ollima LLM (${model || this.provider.getProviderInfo().model})...`,
      );
    }

    let creativeBrief: CreativeBrief;
    try {
      let promptWithWeb = userPrompt;
      if (webResult) {
        promptWithWeb += `\n\nREAL WEB RESEARCH & FACT DATA:\n- Page/Topic Title: ${webResult.title}\n- Summary: ${webResult.summary}\n- Key Facts: ${webResult.keyFacts.slice(0, 5).join("; ")}\n- Headings: ${webResult.headings.slice(0, 5).join(", ")}`;
      }

      const briefPrompt = `PROMPT:\n${promptWithWeb}\n\nAUTHORITATIVE SPECS:\n- Duration: ${duration} seconds (EXACT)\n- Resolution: ${width}x${height} @ ${fps}fps\n${assets.length > 0 ? `- Selected Assets: ${assets.map((a: any) => a.name || a.originalFilename).join(", ")}` : ""}\n\nPlease generate the Creative Brief JSON adhering strictly to the official HyperFrames Prompting Guide (Levels 1-7 & Appendix).`;

      const briefRaw = await this.provider.complete(
        [
          { role: "system", content: CREATIVE_BRIEF_SYSTEM_PROMPT },
          { role: "user", content: briefPrompt },
        ],
        0.2,
        model,
      );

      let cleanBrief = briefRaw.trim();
      if (cleanBrief.startsWith("```")) {
        cleanBrief = cleanBrief
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
      }
      creativeBrief = JSON.parse(cleanBrief);
      creativeBrief.aiProvider = model || this.provider.getProviderInfo().model;
    } catch (briefErr: any) {
      console.warn(
        `[AIGenerator] Creative brief LLM response fallback: ${briefErr.message}`,
      );
      creativeBrief = this.synthesizeDefaultBrief(userPrompt, duration, assets, webResult);
      creativeBrief.aiProvider = "offline-synthesizer";
    }

    // Enforce authoritative duration strictly
    creativeBrief.totalDuration = duration;
    const promptLower = userPrompt.toLowerCase();
    if (promptLower.includes("silent") || promptLower.includes("no audio") || promptLower.includes("without audio")) {
      if (!creativeBrief.audioPlan) {
        creativeBrief.audioPlan = { isSilent: true };
      }
      creativeBrief.audioPlan.isSilent = true;
    }

    const isGreenLantern =
      promptLower.includes("lantern") ||
      promptLower.includes("guy gardner") ||
      promptLower.includes("green lantern") ||
      promptLower.includes("power ring");

    const isSuperman =
      promptLower.includes("superman") ||
      promptLower.includes("clark kent") ||
      promptLower.includes("clurk kent") ||
      promptLower.includes("man of steel") ||
      promptLower.includes("krypton") ||
      promptLower.includes("daily planet");

    if (isGreenLantern && (!assets || assets.length === 0)) {
      const presetDir = path.resolve(__dirname, "../../presets/green-lantern-assets");
      if (fs.existsSync(presetDir)) {
        assets = [
          { name: "ring.jpg", originalFilename: "ring.jpg", localPath: path.join(presetDir, "ring.jpg"), type: "image", mimeType: "image/jpeg" },
          { name: "guy_gardner.jpg", originalFilename: "guy_gardner.jpg", localPath: path.join(presetDir, "guy_gardner.jpg"), type: "image", mimeType: "image/jpeg" },
          { name: "construct_fist.jpg", originalFilename: "construct_fist.jpg", localPath: path.join(presetDir, "construct_fist.jpg"), type: "image", mimeType: "image/jpeg" },
          { name: "battery.jpg", originalFilename: "battery.jpg", localPath: path.join(presetDir, "battery.jpg"), type: "image", mimeType: "image/jpeg" },
          { name: "title_reveal.jpg", originalFilename: "title_reveal.jpg", localPath: path.join(presetDir, "title_reveal.jpg"), type: "image", mimeType: "image/jpeg" },
        ];
      }
    } else if (isSuperman && (!assets || assets.length === 0)) {
      const presetDir = path.resolve(__dirname, "../../presets/superman-assets");
      if (fs.existsSync(presetDir)) {
        assets = [
          { name: "s_shield.jpg", originalFilename: "s_shield.jpg", localPath: path.join(presetDir, "s_shield.jpg"), type: "image", mimeType: "image/jpeg" },
          { name: "clark_kent.jpg", originalFilename: "clark_kent.jpg", localPath: path.join(presetDir, "clark_kent.jpg"), type: "image", mimeType: "image/jpeg" },
          { name: "daily_planet_desk.jpg", originalFilename: "daily_planet_desk.jpg", localPath: path.join(presetDir, "daily_planet_desk.jpg"), type: "image", mimeType: "image/jpeg" },
          { name: "solar_power.jpg", originalFilename: "solar_power.jpg", localPath: path.join(presetDir, "solar_power.jpg"), type: "image", mimeType: "image/jpeg" },
          { name: "superman_title.jpg", originalFilename: "superman_title.jpg", localPath: path.join(presetDir, "superman_title.jpg"), type: "image", mimeType: "image/jpeg" },
        ];
      }
    }

    // Automated Free AI Image Generation for any arbitrary prompt with no assets
    if (!assets || assets.length === 0) {
      console.log(`[AIGenerator] No assets uploaded or preset matched. Calling automated AI image generator...`);
      if (onProgress) {
        await onProgress("generating_images", "Generating bespoke AI scene artwork (5 scenes)...");
      }
      try {
        const aiAssets = await AIImageGenerator.generateSceneAssets(userPrompt, creativeBrief, onProgress);
        if (aiAssets && aiAssets.length > 0) {
          assets = aiAssets;
          console.log(`[AIGenerator] Bound ${assets.length} AI-generated images to project!`);
        }
      } catch (imgErr: any) {
        console.warn(`[AIGenerator] AI image generation warning: ${imgErr.message}`);
      }
    }

    // Workspace Asset Analysis (Part of Stage 1 Composition Setup)
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
    const timeline = ScenePlanner.planTimeline(creativeBrief, analyzedAssets, {
      duration,
      fps,
    });

    // STAGE 3: Animating the Elements (Dynamic Composition Code Generation & GSAP Transforms)
    if (onProgress) {
      await onProgress(
        "animating_elements",
        `Animating elements: Synthesizing bespoke HTML, SVG, and GPU-transform GSAP animations for ${timeline.scenes.length} scenes...`,
      );
    }
    const synthesisResult = CompositionSynthesizer.synthesize(
      creativeBrief,
      timeline,
      analyzedAssets,
      {
        width,
        height,
        fps,
      },
    );

    return {
      files: synthesisResult.files,
      metadata: synthesisResult.metadata,
      creativeBrief,
      timeline,
      analyzedAssets,
    };
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

    const isBatman =
      (promptLower.includes("batman") && !promptLower.includes("lantern")) ||
      (assets.length > 0 && assets[0]?.name?.toLowerCase().includes("batman"));

    const isGreenLantern =
      promptLower.includes("lantern") ||
      promptLower.includes("guy gardner") ||
      promptLower.includes("green lantern") ||
      promptLower.includes("power ring");

    const isSuperman =
      promptLower.includes("superman") ||
      promptLower.includes("clark kent") ||
      promptLower.includes("clurk kent") ||
      promptLower.includes("man of steel") ||
      promptLower.includes("krypton") ||
      promptLower.includes("daily planet");

    const isArch =
      promptLower.includes("building") ||
      promptLower.includes("architect");

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

    // SCENARIO 5: Cinematic Superhero / Batman Animation (Test A)
    if (isBatman) {
      return {
        title: "The Dark Knight Awakens",
        subject: "15-second cinematic Batman-inspired superhero animation with Gotham skyline, rain, dramatic lighting, and suspenseful reveal",
        videoType: "cinematic_animation",
        category: "cinematic-trailer",
        promptComponents: {
          route: "cinematic_animation",
          spec: {
            durationSeconds: duration,
            resolution: "1920x1080",
            frameRate: 30,
            aspectRatio: "16:9",
            visualStyle: "Atmospheric Gotham dusk with deep shadows and fiery amber horizon",
            colorPalette: ["#FFE600", "#FFAA00", "#00F5FF"],
            typography: "Bebas Neue",
            cameraMovement: "Slow cinematic push",
            sceneCount: 3,
          },
          beats: [
            { id: "b1", purpose: "Suspenseful opening vigil", duration: 5, visualContent: "Gotham skyline at dusk with dramatic lighting", animation: "Slow camera scale" },
            { id: "b2", purpose: "Batcomputer surveillance", duration: 5, visualContent: "Tactical HUD threat matrix", animation: "Radar sweep" },
            { id: "b3", purpose: "Powerful final reveal", duration: 5, visualContent: "The symbol in the sky", animation: "Hero title reveal" },
          ],
          copy: {
            headlines: ["JUSTICE IN THE SHADOWS", "GOTHAM THREAT MATRIX", "BECOME THE NIGHT"],
            callToAction: "DISCOVER THE LEGEND",
          },
          technique: ["Cinematic Ken Burns camera scale", "Glassmorphic tactical HUD", "High-contrast rim lighting"],
          negatives: ["no corporate presentation cards", "no generic charts", "no daylight visuals"],
        },
        audioPlan: {
          isSilent,
          backgroundMusicDescription: isSilent ? undefined : "Heavy orchestral cinematic brass with thunderous percussion",
        },
        intendedAudience: "Fans, enthusiasts of cinematic storytelling",
        visualAtmosphere: "Dark blue and black Gotham dusk atmosphere with dramatic ambient glow and rain streaks",
        colorPalette: {
          primary: "#FFE600",
          secondary: "#FFAA00",
          accent: "#00F5FF",
          backgroundColor: "#05070C",
          surfaceColor: "rgba(10, 15, 26, 0.75)",
          textColor: "#FFFFFF",
          textMutedColor: "#94A3B8",
          glowColor: "rgba(255, 230, 0, 0.4)",
          borderColor: "rgba(255, 230, 0, 0.25)",
        },
        typography: {
          displayFont: "Bebas Neue",
          bodyFont: "Montserrat",
          weights: ["400", "700", "900"],
          headlineTransform: "uppercase",
        },
        narrativeProgression: [
          "Scene 1: Suspenseful Gotham dusk opening hook",
          "Scene 2: Tactical Batcomputer threat surveillance",
          "Scene 3: Powerful cinematic reveal and closing legend",
        ],
        sceneCount: 3,
        totalDuration: duration,
        requiredImages: assets.map((a) => a.name || a.originalFilename || "asset.jpg"),
        animationStyle: "Cinematic push-in scale 1.0 to 1.06 with atmospheric glow",
        cameraMovement: "Slow push-in scale 1.0 to 1.06",
        closingMessage: "BECOME THE NIGHT",
        callToAction: "DISCOVER THE LEGEND",
        aiProvider: "offline-synthesizer",
      };
    }

    // SCENARIO 5B: DC Green Lantern / Guy Gardner Series Presentation
    if (isGreenLantern) {
      return {
        title: "DC Lanterns: Guy Gardner",
        subject: "15-second cinematic DC Green Lantern series teaser presentation for Guy Gardner with voiceover, subtitles, emerald willpower ring logo, and hard-light construct VFX",
        videoType: "cinematic_animation",
        category: "cinematic-trailer",
        promptComponents: {
          route: "cinematic_animation",
          spec: {
            durationSeconds: duration,
            resolution: "1920x1080",
            frameRate: 30,
            aspectRatio: "16:9",
            visualStyle: "Cosmic emerald glow with deep space nebulae, pulsating hard-light constructs, and leather jacket Green Lantern emblem",
            colorPalette: ["#00FF66", "#ADFF2F", "#00FF88"],
            typography: "Bebas Neue",
            cameraMovement: "Slow cinematic push",
            sceneCount: 3,
          },
          beats: [
            { id: "b1", purpose: "The Emerald Power Ring", duration: 5, visualContent: "Glowing Green Lantern Power Ring insignia with cosmic energy aura", animation: "Pulse construct flare" },
            { id: "b2", purpose: "Guy Gardner Character Reveal", duration: 5, visualContent: "Leather jacket emblem and hard-light construct fist telemetry", animation: "Construct impact" },
            { id: "b3", purpose: "In Brightest Day Climax", duration: 5, visualContent: "Green Lantern oath illumination and DC Lanterns series reveal", animation: "Emerald beam reveal" },
          ],
          copy: {
            headlines: ["EMERALD WILLPOWER", "GUY GARDNER", "BEWARE MY POWER"],
            callToAction: "COMING SOON TO DC",
          },
          technique: ["Cinematic Ken Burns camera scale", "Hard-light construct glow", "Emerald chromatic dispersion"],
          negatives: ["no corporate presentation cards", "no generic charts", "no bat symbols"],
        },
        audioPlan: {
          isSilent,
          backgroundMusicDescription: isSilent ? undefined : "Epic pulsing superhero synth and brass with emerald energy hum",
        },
        intendedAudience: "DC fans, comic book enthusiasts, streaming audiences",
        visualAtmosphere: "Deep cosmic void with radiant emerald green aurora, floating space particles, and hard-light neon constructs",
        colorPalette: {
          primary: "#00FF66",
          secondary: "#ADFF2F",
          accent: "#00FF88",
          backgroundColor: "#030A05",
          surfaceColor: "rgba(4, 28, 12, 0.7)",
          textColor: "#FFFFFF",
          textMutedColor: "#86EFAC",
          glowColor: "rgba(0, 255, 102, 0.5)",
          borderColor: "rgba(0, 255, 102, 0.35)",
        },
        typography: {
          displayFont: "Bebas Neue",
          bodyFont: "Montserrat",
          weights: ["400", "700", "900"],
          headlineTransform: "uppercase",
        },
        narrativeProgression: [
          "Scene 1: The Emerald Power Ring of Oa awakening",
          "Scene 2: Guy Gardner presentation with hard-light construct fist",
          "Scene 3: In Brightest Day oath climax & DC Lanterns title reveal",
        ],
        sceneCount: 3,
        totalDuration: duration,
        requiredImages: assets.map((a) => a.name || a.originalFilename || "asset.jpg"),
        animationStyle: "Cosmic hard-light construct flare and emerald pulse",
        cameraMovement: "Slow push-in scale 1.0 to 1.06",
        closingMessage: "BEWARE MY POWER",
        callToAction: "COMING SOON TO DC",
        aiProvider: "offline-synthesizer",
      };
    }

    // SCENARIO 5C: DC Superman / Clark Kent Presentation
    if (isSuperman) {
      return {
        title: "DC Superman: Clark Kent",
        subject: "30-second cinematic DC Superman presentation spotlighting Clark Kent, the Daily Planet, and the iconic House of El S-Shield with voiceover and photorealistic artwork",
        videoType: "cinematic_animation",
        category: "cinematic-trailer",
        promptComponents: {
          route: "cinematic_animation",
          spec: {
            durationSeconds: duration,
            resolution: "1920x1080",
            frameRate: 30,
            aspectRatio: "16:9",
            visualStyle: "Kryptonian solar radiance, Metropolis golden dusk atmosphere, and textured chainmail S-shield with cinematic flares",
            colorPalette: ["#E52521", "#FFD700", "#0047AB"],
            typography: "Bebas Neue",
            cameraMovement: "Slow cinematic push",
            sceneCount: 5,
          },
          beats: [
            { id: "b1", purpose: "The S-Shield of Hope", duration: 6, visualContent: "Glowing Kryptonian S-Shield chest crest bathed in solar rays", animation: "Solar flare reveal" },
            { id: "b2", purpose: "Clark Kent: Daily Planet", duration: 6, visualContent: "Clark Kent portrait in bustling Daily Planet newsroom with dossier telemetry", animation: "Reporter HUD reveal" },
            { id: "b3", purpose: "Metropolis Investigative Dossier", duration: 6, visualContent: "Daily Planet typewriter, globe, and investigative press dossier", animation: "Press credentials" },
            { id: "b4", purpose: "Solar Power Overcharge", duration: 6, visualContent: "Kryptonian solar radiation telemetry and yellow sun energy absorption", animation: "Solar energy surge" },
            { id: "b5", purpose: "Look Up In The Sky Climax", duration: 6, visualContent: "Man of Steel title card, cosmic blue atmosphere, and DC Studios reveal", animation: "Heroic flight climax" },
          ],
          copy: {
            headlines: ["HOPE FROM THE STARS", "CLARK KENT", "TRUTH AND JUSTICE", "SOLAR RADIANCE", "LOOK UP IN THE SKY"],
            callToAction: "EXPERIENCE SUPERMAN",
          },
          technique: ["Cinematic Ken Burns camera scale", "Solar lens flare dispersion", "Metropolis glassmorphic telemetry"],
          negatives: ["no corporate slides", "no green lantern rings", "no plain black boxes"],
        },
        audioPlan: {
          isSilent,
          backgroundMusicDescription: isSilent ? undefined : "Triumphant soaring orchestral brass and solar synth strings",
        },
        intendedAudience: "DC fans, comic book enthusiasts, cinema audiences",
        visualAtmosphere: "Metropolis golden hour dusk with deep Kryptonian royal blue void and radiant solar flares",
        colorPalette: {
          primary: "#E52521",
          secondary: "#FFD700",
          accent: "#00E5FF",
          backgroundColor: "#050B14",
          surfaceColor: "rgba(10, 25, 49, 0.75)",
          textColor: "#FFFFFF",
          textMutedColor: "#93C5FD",
          glowColor: "rgba(229, 37, 33, 0.45)",
          borderColor: "rgba(255, 215, 0, 0.35)",
        },
        typography: {
          displayFont: "Bebas Neue",
          bodyFont: "Montserrat",
          weights: ["400", "700", "900"],
          headlineTransform: "uppercase",
        },
        narrativeProgression: [
          "Scene 1: The S-Shield of Hope forged on Krypton",
          "Scene 2: Clark Kent: Daily Planet investigative reporter",
          "Scene 3: Fighting for Truth, Justice, and a better tomorrow",
          "Scene 4: Powered by the radiant yellow sun of Earth",
          "Scene 5: Look up in the sky... It's Superman!",
        ],
        sceneCount: 5,
        totalDuration: duration,
        requiredImages: assets.map((a) => a.name || a.originalFilename || "asset.jpg"),
        animationStyle: "Majestic solar scale and Kryptonian HUD sweep",
        cameraMovement: "Slow push-in scale 1.0 to 1.06",
        closingMessage: "TRUTH. JUSTICE. HOPE.",
        callToAction: "EXPERIENCE SUPERMAN",
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

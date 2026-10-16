import { CreativeBrief, BriefScenePlan, SceneLayoutType } from "./creative-brief.js";
import { AnalyzedAsset } from "./asset-analyzer.js";

export interface PlannedScene {
  id: string; // "scene-01", "scene-02", etc.
  index: number;
  name: string;
  objective: string;
  start: number; // in seconds
  duration: number; // in seconds
  end: number;
  startFrame: number;
  endFrame: number;
  sceneType: SceneLayoutType;
  headline: string;
  highlightedWord?: string;
  subtitle: string;
  badge?: string;
  ctaText?: string;
  assetToFeature?: AnalyzedAsset;
  visualDescription?: string;
  narration?: string;
  dataVisualization?: {
    type: "bar-chart" | "line-chart" | "metric-counter" | "radar-hud" | "flow-nodes";
    bars?: Array<{ label: string; value: number; formattedValue: string; color: string }>;
    metrics?: Array<{
      label: string;
      value: string;
      startValue?: number;
      targetValue?: number;
      prefix?: string;
      suffix?: string;
      trend?: string;
    }>;
    nodes?: Array<{ label: string; sub?: string; icon?: string }>;
  };
  treeGrowthStage?: "seed" | "roots" | "trunk" | "branches" | "leaves-blooming" | "full-tree";
  httpFlowState?: "request-sent" | "server-processing" | "response-received";
  geometricMotionStyle?: "rotating-grid" | "concentric-ripples" | "expanding-polygons";
  visualAtmosphere: {
    backgroundType:
      | "image-backdrop"
      | "mesh-gradient"
      | "cyber-hud"
      | "architectural-blueprint"
      | "minimal-dark"
      | "nature-organic"
      | "pure-black";
    customBackgroundCss?: string;
    scrimGradient?: string;
    ambientGlowColor: string;
  };
}

export interface PlannedTimeline {
  totalDuration: number;
  fps: number;
  totalFrames: number;
  scenes: PlannedScene[];
}

export class ScenePlanner {
  /**
   * Plans an exact, frame-accurate timeline and scene breakdown.
   * Guarantees that the sum of scene durations strictly equals requested totalDuration.
   */
  public static planTimeline(
    brief: CreativeBrief,
    analyzedAssets: AnalyzedAsset[],
    options: { duration: number; fps?: number },
  ): PlannedTimeline {
    const totalDuration = Number(options.duration) || brief.totalDuration || 15.0;
    const fps = options.fps || 30;
    const totalFrames = Math.round(totalDuration * fps);

    // 1. Calculate optimal scene count and durations
    let sceneCount: number;
    let sceneDurations: number[];

    if (totalDuration <= 6) {
      sceneCount = 1;
      sceneDurations = [totalDuration];
    } else if (totalDuration <= 12) {
      sceneCount = 2;
      const d1 = Number((totalDuration * 0.5).toFixed(2));
      const d2 = Number((totalDuration - d1).toFixed(2));
      sceneDurations = [d1, d2];
    } else if (totalDuration <= 18) {
      sceneCount = 3;
      const d1 = Number((totalDuration / 3).toFixed(2));
      const d2 = Number((totalDuration / 3).toFixed(2));
      const d3 = Number((totalDuration - d1 - d2).toFixed(2));
      sceneDurations = [d1, d2, d3];
    } else if (totalDuration <= 24) {
      sceneCount = 4;
      const d = Number((totalDuration / 4).toFixed(2));
      sceneDurations = [d, d, d, Number((totalDuration - 3 * d).toFixed(2))];
    } else if (totalDuration <= 35) {
      sceneCount = 5;
      const base = Number((totalDuration / 5).toFixed(2));
      const rem = Number((totalDuration - base * 4).toFixed(2));
      sceneDurations = [base, base, base, base, rem];
    } else {
      sceneCount = 6;
      const base = Number((totalDuration / 6).toFixed(2));
      const rem = Number((totalDuration - base * 5).toFixed(2));
      sceneDurations = [base, base, base, base, base, rem];
    }

    // Verify mathematical equality to 0.00
    const sum = sceneDurations.reduce((a, b) => a + b, 0);
    const diff = Number((totalDuration - sum).toFixed(2));
    if (diff !== 0) {
      sceneDurations[sceneDurations.length - 1] = Number(
        (sceneDurations[sceneDurations.length - 1] + diff).toFixed(2),
      );
    }

    // 2. Synthesize scene plans based on category, videoType, and assets
    const primaryAsset = analyzedAssets.length > 0 ? analyzedAssets[0] : undefined;
    const promptLower = (brief.subject + " " + (brief.title || "")).toLowerCase();

    const isDataViz =
      brief.videoType === "data_visualization" ||
      promptLower.includes("revenue") ||
      promptLower.includes("bar chart") ||
      promptLower.includes("chart") ||
      (promptLower.includes("growth") && (promptLower.includes("revenue") || promptLower.includes("q1") || promptLower.includes("$")));

    const isTreeGrowth =
      !isDataViz &&
      (brief.videoType === "nature_growth_animation" ||
        promptLower.includes("tree") ||
        (promptLower.includes("seed") && promptLower.includes("grow")) ||
        (promptLower.includes("plant") && promptLower.includes("grow")));

    const isHttpFlow =
      brief.videoType === "network_architecture_explainer" ||
      promptLower.includes("http") ||
      promptLower.includes("request travels") ||
      (promptLower.includes("client") && promptLower.includes("server"));

    const isAbstractGeometric =
      brief.videoType === "abstract_motion_graphics" ||
      promptLower.includes("geometric") ||
      promptLower.includes("abstract motion") ||
      promptLower.includes("white geometric");

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

    const isArchitecture =
      brief.category === "architectural-showcase" ||
      promptLower.includes("building") ||
      promptLower.includes("architect");

    const isUserAssetAd =
      primaryAsset && (promptLower.includes("selected") || promptLower.includes("image") || promptLower.includes("advertisement"));

    const scenes: PlannedScene[] = [];
    let currentStart = 0;

    for (let i = 0; i < sceneCount; i++) {
      const dur = sceneDurations[i];
      const start = currentStart;
      const end = Number((start + dur).toFixed(2));
      const startFrame = Math.round(start * fps);
      const endFrame = Math.round(end * fps);
      currentStart = end;

      const sceneId = `scene-${String(i + 1).padStart(2, "0")}`;

      // Bespoke scene planning dispatch:
      // Priority 1: If the LLM created custom tailored scenes in the brief, use them!
      if (
        brief.scenes &&
        Array.isArray(brief.scenes) &&
        brief.scenes.length > 0
      ) {
        const briefScene =
          brief.scenes[i] || brief.scenes[i % brief.scenes.length];
        const sceneAsset =
          analyzedAssets[i] ||
          analyzedAssets[i % (analyzedAssets.length || 1)] ||
          primaryAsset;
        scenes.push(
          this.buildSceneFromBriefPlan(
            i,
            sceneId,
            start,
            dur,
            end,
            startFrame,
            endFrame,
            briefScene,
            brief,
            sceneAsset,
            sceneCount,
          ),
        );
      } else if (isTreeGrowth) {
        scenes.push(
          this.buildTreeGrowthScene(
            i,
            sceneId,
            start,
            dur,
            end,
            startFrame,
            endFrame,
            brief,
            sceneCount,
          ),
        );
      } else if (isHttpFlow) {
        scenes.push(
          this.buildHttpFlowScene(
            i,
            sceneId,
            start,
            dur,
            end,
            startFrame,
            endFrame,
            brief,
            sceneCount,
          ),
        );
      } else if (isAbstractGeometric) {
        scenes.push(
          this.buildAbstractGeometricScene(
            i,
            sceneId,
            start,
            dur,
            end,
            startFrame,
            endFrame,
            brief,
            sceneCount,
          ),
        );
      } else if (isDataViz) {
        scenes.push(
          this.buildDataVisualizationScene(
            i,
            sceneId,
            start,
            dur,
            end,
            startFrame,
            endFrame,
            brief,
            sceneCount,
          ),
        );
      } else if (isUserAssetAd && primaryAsset) {
        scenes.push(
          this.buildAssetAdScene(
            i,
            sceneId,
            start,
            dur,
            end,
            startFrame,
            endFrame,
            brief,
            primaryAsset,
            sceneCount,
          ),
        );
      } else if (isFootwearOrApparel || isSoftwareProduct) {
        const sceneAsset =
          analyzedAssets[i] ||
          analyzedAssets[i % (analyzedAssets.length || 1)] ||
          primaryAsset;
        scenes.push(
          this.buildDynamicShowcaseScene(
            i,
            sceneId,
            start,
            dur,
            end,
            startFrame,
            endFrame,
            brief,
            sceneAsset,
            sceneCount,
          ),
        );
      } else if (isArchitecture) {
        scenes.push(
          this.buildArchitectureScene(
            i,
            sceneId,
            start,
            dur,
            end,
            startFrame,
            endFrame,
            brief,
            primaryAsset,
            sceneCount,
          ),
        );
      } else {
        const sceneAsset =
          analyzedAssets[i] ||
          analyzedAssets[i % (analyzedAssets.length || 1)] ||
          primaryAsset;
        scenes.push(
          this.buildDynamicShowcaseScene(
            i,
            sceneId,
            start,
            dur,
            end,
            startFrame,
            endFrame,
            brief,
            sceneAsset,
            sceneCount,
          ),
        );
      }
    }

    return {
      totalDuration,
      fps,
      totalFrames,
      scenes,
    };
  }


  private static buildArchitectureScene(
    index: number,
    id: string,
    start: number,
    duration: number,
    end: number,
    startFrame: number,
    endFrame: number,
    brief: CreativeBrief,
    asset?: AnalyzedAsset,
    totalScenes: number = 6,
  ): PlannedScene {
    const isFirst = index === 0;
    const isLast = index === totalScenes - 1;

    if (isFirst) {
      return {
        id,
        index,
        name: "Architectural Vision",
        objective: "Full-screen photograph with architectural title treatment",
        start,
        duration,
        end,
        startFrame,
        endFrame,
        sceneType: "cinematic-hero-intro",
        headline: "ARCHITECTURAL EXCELLENCE",
        highlightedWord: "EXCELLENCE",
        subtitle: "A modern landmark engineered for sustainability, elegance, and human connection.",
        badge: "ARCHITECTURAL SHOWCASE",
        assetToFeature: asset,
        visualAtmosphere: {
          backgroundType: "image-backdrop",
          scrimGradient:
            "linear-gradient(90deg, rgba(15,20,30,0.92) 0%, rgba(15,20,30,0.65) 45%, rgba(15,20,30,0.15) 100%)",
          ambientGlowColor: "rgba(200, 169, 126, 0.25)",
        },
      };
    }

    if (index === 1) {
      return {
        id,
        index,
        name: "Structural Blueprint & Specifications",
        objective: "Engineering dimensions and structural engineering grid",
        start,
        duration,
        end,
        startFrame,
        endFrame,
        sceneType: "architectural-spec",
        headline: "STRUCTURAL SPECIFICATIONS",
        highlightedWord: "SPECIFICATIONS",
        subtitle: "Precision engineering combining high-tensile steel, low-iron glass, and acoustic insulation.",
        badge: "ENGINEERING DATA",
        dataVisualization: {
          type: "metric-counter",
          metrics: [
            { label: "Total Area", value: "480,000 sq ft" },
            { label: "Building Height", value: "42 Stories" },
            { label: "Efficiency Rating", value: "LEED Platinum" },
          ],
        },
        visualAtmosphere: {
          backgroundType: "architectural-blueprint",
          ambientGlowColor: "rgba(0, 212, 255, 0.25)",
        },
      };
    }

    if (index === 2) {
      return {
        id,
        index,
        name: "Energy Efficiency Analytics",
        objective: "Animated bar chart displaying reduced carbon footprint and power usage",
        start,
        duration,
        end,
        startFrame,
        endFrame,
        sceneType: "animated-bar-chart",
        headline: "CARBON & ENERGY SAVINGS",
        highlightedWord: "SAVINGS",
        subtitle: "Solar integration and smart geothermal HVAC cutting operational overhead.",
        badge: "SUSTAINABILITY METRICS",
        dataVisualization: {
          type: "bar-chart",
          bars: [
            { label: "Traditional", value: 100, formattedValue: "100%", color: "#94A3B8" },
            { label: "Standard Green", value: 72, formattedValue: "72%", color: "#60A5FA" },
            { label: "Smart Design", value: 45, formattedValue: "45%", color: "#34D399" },
            { label: "This Project", value: 24, formattedValue: "24%", color: "#10B981" },
          ],
        },
        visualAtmosphere: {
          backgroundType: "minimal-dark",
          ambientGlowColor: "rgba(52, 211, 153, 0.25)",
        },
      };
    }

    if (index === 3) {
      return {
        id,
        index,
        name: "Spatial Experience & Light",
        objective: "Architectural focus on natural light, acoustic isolation, and workspace flow",
        start,
        duration,
        end,
        startFrame,
        endFrame,
        sceneType: "kinetic-typography",
        headline: "DESIGNED FOR NATURAL LIGHT AND TIMELESS ELEVATION",
        highlightedWord: "TIMELESS ELEVATION",
        subtitle: "Floor-to-ceiling panoramic glass walls bringing outdoor vitality into executive interiors.",
        badge: "SPATIAL LUXURY",
        assetToFeature: asset,
        visualAtmosphere: {
          backgroundType: "image-backdrop",
          scrimGradient:
            "linear-gradient(180deg, rgba(15,20,30,0.85) 0%, rgba(15,20,30,0.35) 45%, rgba(15,20,30,0.95) 100%)",
          ambientGlowColor: "rgba(200, 169, 126, 0.3)",
        },
      };
    }

    if (index === 4) {
      return {
        id,
        index,
        name: "Milestone Construction Numbers",
        objective: "Animated counters highlighting investment and delivery milestones",
        start,
        duration,
        end,
        startFrame,
        endFrame,
        sceneType: "metrics-counter-hud",
        headline: "PROJECT MILESTONES",
        highlightedWord: "MILESTONES",
        subtitle: "Completed on schedule, with zero lost-time incidents and world-class safety.",
        badge: "DELIVERY REPORT",
        dataVisualization: {
          type: "metric-counter",
          metrics: [
            { label: "Project Value", value: "$320M", startValue: 0, targetValue: 320, prefix: "$", suffix: "M" },
            { label: "Pre-Leased", value: "88%", startValue: 0, targetValue: 88, suffix: "%" },
            { label: "Safety Score", value: "100%", startValue: 0, targetValue: 100, suffix: "%" },
          ],
        },
        visualAtmosphere: {
          backgroundType: "minimal-dark",
          ambientGlowColor: "rgba(200, 169, 126, 0.25)",
        },
      };
    }

    // Final Scene
    return {
      id,
      index,
      name: "Private Inquiries & Pre-Leasing",
      objective: "Architectural closing reveal and call to action",
      start,
      duration,
      end,
      startFrame,
      endFrame,
      sceneType: "cinematic-climax-cta",
      headline: "SCHEDULE A PRIVATE TOUR",
      highlightedWord: "PRIVATE TOUR",
      subtitle: "Exclusive executive suites and retail spaces currently accepting reservations.",
      badge: "LEASING OFFICE NOW OPEN",
      ctaText: "RESERVE YOUR SPACE",
      assetToFeature: asset,
      visualAtmosphere: {
        backgroundType: "image-backdrop",
        scrimGradient:
          "linear-gradient(180deg, rgba(15,20,30,0.8) 0%, rgba(15,20,30,0.35) 35%, rgba(15,20,30,0.96) 100%)",
        ambientGlowColor: "rgba(200, 169, 126, 0.3)",
      },
    };
  }

  private static buildSceneFromBriefPlan(
    index: number,
    id: string,
    start: number,
    duration: number,
    end: number,
    startFrame: number,
    endFrame: number,
    plan: BriefScenePlan,
    brief: CreativeBrief,
    asset?: AnalyzedAsset,
    totalScenes: number = 6,
  ): PlannedScene {
    const isFirst = index === 0;
    const isLast = index === totalScenes - 1;
    const palette = brief.colorPalette;

    // Feature hero asset whenever an asset is provided for the scene
    const shouldFeatureAsset = !!asset;

    let backgroundType: PlannedScene["visualAtmosphere"]["backgroundType"] =
      shouldFeatureAsset
        ? "image-backdrop"
        : brief.visualAtmosphere?.toLowerCase().includes("radar") ||
            brief.subject.toLowerCase().includes("batman")
          ? "cyber-hud"
          : "mesh-gradient";

    const headline = (plan.headline || brief.title).toUpperCase();
    const highlightedWord =
      plan.highlightedWord || headline.split(" ")[0] || "";
    const subtitle = plan.subtitle || brief.subject;
    const badge =
      plan.badge ||
      (isFirst
        ? `${brief.category.toUpperCase().replace("-", " ")} // 2026`
        : isLast
          ? "GET STARTED"
          : "OVERVIEW");

    // Standardize data visualization according to scene type
    let dataVisualization: PlannedScene["dataVisualization"] | undefined =
      undefined;

    if (plan.sceneType === "animated-bar-chart") {
      const defaultPaletteColors = [
        palette.primary || "#6366F1",
        palette.secondary || "#8B5CF6",
        palette.accent || "#00D4FF",
        "#00F5FF",
      ];
      const rawBars = plan.dataVisualization?.bars || [];
      const bars =
        rawBars.length >= 2
          ? rawBars.map((b, idx) => ({
              label: b.label || `Phase ${idx + 1}`,
              value:
                typeof b.value === "number"
                  ? Math.min(100, Math.max(10, b.value))
                  : 40 + idx * 18,
              formattedValue: b.formattedValue || `${b.value || 40 + idx * 18}%`,
              color:
                b.color ||
                defaultPaletteColors[idx % defaultPaletteColors.length],
            }))
          : [
              { label: "Q1", value: 35, formattedValue: "35%", color: defaultPaletteColors[0] },
              { label: "Q2", value: 60, formattedValue: "60%", color: defaultPaletteColors[1] },
              { label: "Q3", value: 82, formattedValue: "82%", color: defaultPaletteColors[2] },
              { label: "Q4", value: 100, formattedValue: "100%", color: defaultPaletteColors[3] },
            ];

      dataVisualization = {
        type: "bar-chart",
        bars,
      };
    } else if (plan.sceneType === "metrics-counter-hud") {
      const rawMetrics = plan.dataVisualization?.metrics || [];
      const metrics =
        rawMetrics.length >= 2
          ? rawMetrics.map((m) => ({
              label: m.label || "Performance Metric",
              value: m.value || "100%",
              startValue: m.startValue ?? 0,
              targetValue: m.targetValue ?? 100,
              suffix: m.suffix || "",
              prefix: m.prefix || "",
              trend: "up",
            }))
          : [
              { label: "Efficiency", value: "10x", startValue: 0, targetValue: 10, suffix: "x", trend: "up" },
              { label: "Reliability", value: "99.99%", startValue: 0, targetValue: 99.99, suffix: "%", trend: "up" },
              { label: "Performance", value: "100%", startValue: 0, targetValue: 100, suffix: "%", trend: "up" },
            ];

      dataVisualization = {
        type: "metric-counter",
        metrics,
      };
    } else if (plan.sceneType === "process-flow-nodes") {
      const rawNodes = plan.dataVisualization?.nodes || [];
      const nodes =
        rawNodes.length >= 2
          ? rawNodes.map((n, idx) => ({
              label: n.label || `Step ${idx + 1}`,
              sub: n.sub || "Pipeline Node",
            }))
          : [
              { label: "Connect", sub: "Data Ingestion" },
              { label: "Process", sub: "Real-time Engine" },
              { label: "Render", sub: "GPU Composition" },
              { label: "Deliver", sub: "Global Edge" },
            ];

      dataVisualization = {
        type: "flow-nodes",
        nodes,
      };
    }

    return {
      id,
      index,
      name: plan.name || `Scene ${index + 1}`,
      objective: plan.objective || "",
      start,
      duration,
      end,
      startFrame,
      endFrame,
      sceneType: plan.sceneType,
      headline,
      highlightedWord,
      subtitle,
      badge,
      ctaText: plan.ctaText || (isLast ? brief.callToAction || "GET STARTED" : undefined),
      assetToFeature: shouldFeatureAsset ? asset : undefined,
      dataVisualization,
      treeGrowthStage: plan.treeGrowthStage,
      httpFlowState: plan.httpFlowState,
      geometricMotionStyle: plan.geometricMotionStyle,
      visualAtmosphere: {
        backgroundType:
          plan.sceneType === "nature-tree-growth"
            ? "nature-organic"
            : plan.sceneType === "abstract-geometric-motion"
              ? "pure-black"
              : backgroundType,
        scrimGradient: shouldFeatureAsset
          ? "linear-gradient(180deg, rgba(6,11,20,0.85) 0%, rgba(6,11,20,0.3) 40%, rgba(6,11,20,0.96) 100%)"
          : undefined,
        ambientGlowColor:
          plan.sceneType === "abstract-geometric-motion"
            ? "rgba(255, 255, 255, 0.3)"
            : palette.accent || "rgba(0, 212, 255, 0.3)",
      },
    };
  }

  private static buildTreeGrowthScene(
    index: number,
    id: string,
    start: number,
    duration: number,
    end: number,
    startFrame: number,
    endFrame: number,
    brief: CreativeBrief,
    totalScenes: number,
  ): PlannedScene {
    const isFirst = index === 0;
    const isLast = index === totalScenes - 1;

    let treeGrowthStage: PlannedScene["treeGrowthStage"] = "seed";
    let headline = "SEED GERMINATION";
    let highlightedWord = "SEED";
    let subtitle = "A small seed rests in the soil, taking root and absorbing nutrients.";
    let badge = "GERMINATION // STAGE 01";

    if (totalScenes <= 2) {
      if (index === 0) {
        treeGrowthStage = "roots";
        headline = "ROOTS & GERMINATION";
        highlightedWord = "GERMINATION";
        subtitle = "The seed awakens, sending strong roots down into fertile soil.";
        badge = "ROOT FORMATION";
      } else {
        treeGrowthStage = "leaves-blooming";
        headline = "GROWTH & YELLOW BLOOM";
        highlightedWord = "YELLOW BLOOM";
        subtitle = "Trunk ascends and branches unfurl with vibrant yellow leaves in full canopy.";
        badge = "CANOPY BLOOM";
      }
    } else {
      if (index === 0) {
        treeGrowthStage = "seed";
        headline = "THE SEED AWAKENS";
        highlightedWord = "SEED";
        subtitle = "At the beginning of life, a golden seed rests quietly in fertile earth.";
        badge = "STAGE 01 // SEED";
      } else if (index === 1) {
        treeGrowthStage = "roots";
        headline = "ROOT SYSTEM ANCHOR";
        highlightedWord = "ROOT";
        subtitle = "Fibrous roots extend dynamically downward, establishing stability and life.";
        badge = "STAGE 02 // ROOTS";
      } else if (index === 2) {
        treeGrowthStage = "trunk";
        headline = "TRUNK ASCENDING";
        highlightedWord = "TRUNK";
        subtitle = "The central trunk rises smoothly toward the sunlight with organic strength.";
        badge = "STAGE 03 // STEM";
      } else if (index === 3) {
        treeGrowthStage = "branches";
        headline = "CANOPY BRANCHING";
        highlightedWord = "BRANCHING";
        subtitle = "Graceful limbs fan outward in all directions, preparing for the foliage bloom.";
        badge = "STAGE 04 // BRANCHES";
      } else {
        treeGrowthStage = "leaves-blooming";
        headline = "FULL YELLOW BLOOM";
        highlightedWord = "YELLOW BLOOM";
        subtitle = "Lush golden-yellow leaves burst into vibrant life, forming a complete crown.";
        badge = "STAGE 05 // CANOPY";
      }
    }

    return {
      id,
      index,
      name: `Growth Stage ${index + 1}`,
      objective: "Organic growth progression from seed to blooming tree",
      start,
      duration,
      end,
      startFrame,
      endFrame,
      sceneType: "nature-tree-growth",
      headline,
      highlightedWord,
      subtitle,
      badge,
      treeGrowthStage,
      visualAtmosphere: {
        backgroundType: "nature-organic",
        ambientGlowColor: "rgba(250, 204, 21, 0.4)",
      },
    };
  }

  private static buildHttpFlowScene(
    index: number,
    id: string,
    start: number,
    duration: number,
    end: number,
    startFrame: number,
    endFrame: number,
    brief: CreativeBrief,
    totalScenes: number,
  ): PlannedScene {
    let httpFlowState: PlannedScene["httpFlowState"] = "request-sent";
    let headline = "HTTP CLIENT REQUEST";
    let highlightedWord = "HTTP GET";
    let subtitle = "The client browser initiates an HTTP GET request with headers and query parameters.";
    let badge = "CLIENT // GET /api";

    if (totalScenes <= 2) {
      if (index === 0) {
        httpFlowState = "request-sent";
        headline = "CLIENT DISPATCHES REQUEST";
        highlightedWord = "REQUEST";
        subtitle = "HTTP GET /data packet travels across the network path from client to server.";
        badge = "DISPATCH // HTTP GET";
      } else {
        httpFlowState = "response-received";
        headline = "SERVER RETURNS HTTP 200 OK";
        highlightedWord = "200 OK";
        subtitle = "Server processes the request and streams back the HTTP 200 OK response with JSON data.";
        badge = "RESPONSE // 200 OK";
      }
    } else {
      if (index === 0) {
        httpFlowState = "request-sent";
        headline = "CLIENT DISPATCHES HTTP GET";
        highlightedWord = "HTTP GET";
        subtitle = "User triggers action; client initiates TCP connection and transmits HTTP request packet.";
        badge = "OUTBOUND // REQUEST";
      } else if (index === 1) {
        httpFlowState = "server-processing";
        headline = "SERVER RECEIVES & PROCESSES";
        highlightedWord = "PROCESSES";
        subtitle = "Server routing resolves the endpoint, executes backend logic, and crafts response.";
        badge = "SERVER // PROCESSING";
      } else {
        httpFlowState = "response-received";
        headline = "HTTP 200 OK RESPONSE RETURNED";
        highlightedWord = "200 OK";
        subtitle = "Encrypted response packet travels back across return channel and client renders view.";
        badge = "INBOUND // 200 OK";
      }
    }

    return {
      id,
      index,
      name: `HTTP Flow ${index + 1}`,
      objective: "Step-by-step educational network diagram of HTTP client-server cycle",
      start,
      duration,
      end,
      startFrame,
      endFrame,
      sceneType: "network-http-flow",
      headline,
      highlightedWord,
      subtitle,
      badge,
      httpFlowState,
      visualAtmosphere: {
        backgroundType: "minimal-dark",
        ambientGlowColor: "rgba(0, 245, 255, 0.35)",
      },
    };
  }

  private static buildAbstractGeometricScene(
    index: number,
    id: string,
    start: number,
    duration: number,
    end: number,
    startFrame: number,
    endFrame: number,
    brief: CreativeBrief,
    totalScenes: number,
  ): PlannedScene {
    let geometricMotionStyle: PlannedScene["geometricMotionStyle"] = "rotating-grid";
    let headline = "GEOMETRIC ALIGNMENT";
    let highlightedWord = "GEOMETRIC";
    let subtitle = "White geometric vectors rotating in high-contrast mathematical precision.";
    let badge = "MONOCHROME // 01";

    if (index === 0) {
      geometricMotionStyle = "rotating-grid";
      headline = "GEOMETRIC FORM & ALIGNMENT";
      highlightedWord = "ALIGNMENT";
      subtitle = "Pristine white geometric vectors rotating against pure negative space.";
      badge = "VECTOR SPACE";
    } else if (index === 1) {
      geometricMotionStyle = "concentric-ripples";
      headline = "RHYTHMIC EXPANDING RIPPLES";
      highlightedWord = "EXPANDING";
      subtitle = "Concentric geometric rings pulse smoothly outward with deterministic easing.";
      badge = "CONCENTRIC PULSE";
    } else {
      geometricMotionStyle = "expanding-polygons";
      headline = "DIMENSIONAL CONVERGENCE";
      highlightedWord = "CONVERGENCE";
      subtitle = "Synchronized polygon facets converging into balanced dynamic equilibrium.";
      badge = "EQUILIBRIUM";
    }

    return {
      id,
      index,
      name: `Abstract Form ${index + 1}`,
      objective: "Silent high-contrast geometric motion graphics animation",
      start,
      duration,
      end,
      startFrame,
      endFrame,
      sceneType: "abstract-geometric-motion",
      headline,
      highlightedWord,
      subtitle,
      badge,
      geometricMotionStyle,
      visualAtmosphere: {
        backgroundType: "pure-black",
        ambientGlowColor: "rgba(255, 255, 255, 0.2)",
      },
    };
  }

  private static buildDataVisualizationScene(
    index: number,
    id: string,
    start: number,
    duration: number,
    end: number,
    startFrame: number,
    endFrame: number,
    brief: CreativeBrief,
    totalScenes: number,
  ): PlannedScene {
    const isFirst = index === 0;
    const isLast = index === totalScenes - 1;
    const palette = brief.colorPalette;
    const briefScene = brief.scenes?.[index] || brief.scenes?.[0];

    // Priority 1: Check if brief.scenes has user-supplied or LLM-generated bars
    const briefBarScene = brief.scenes?.find(
      (s) => s.dataVisualization?.bars && s.dataVisualization.bars.length >= 2,
    );
    let bars = briefBarScene?.dataVisualization?.bars;

    // Priority 2: Extract user-supplied quarterly or milestone figures from prompt / brief text
    if (!bars || bars.length < 2) {
      const textToSearch = `${brief.chartAndDataRequirements || ""} ${brief.subject || ""} ${brief.promptComponents?.beats?.map((b) => b.visualContent).join(" ") || ""}`;
      const matches = Array.from(
        textToSearch.matchAll(
          /(Q[1-4]|Phase\s*\d|Month\s*\d|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^$\d]*([$€£]?\s*[\d.]+\s*[MBK%]?)/gi,
        ),
      );
      if (matches.length >= 2) {
        const defaultPaletteColors = [
          palette.primary || "#38BDF8",
          palette.secondary || "#818CF8",
          palette.accent || "#34D399",
          "#10B981",
        ];
        const parsed = matches.slice(0, 6).map((m) => {
          const label = m[1].trim();
          const formattedValue = m[2].trim();
          const numMatch = formattedValue.match(/[\d.]+/);
          const num = numMatch ? parseFloat(numMatch[0]) : 50;
          return { label, formattedValue, rawNum: num };
        });
        const maxVal = Math.max(...parsed.map((p) => p.rawNum), 1);
        bars = parsed.map((p, idx) => ({
          label: p.label,
          value: Math.max(15, Math.min(100, Math.round((p.rawNum / maxVal) * 100))),
          formattedValue: p.formattedValue,
          color: defaultPaletteColors[idx % defaultPaletteColors.length],
        }));
      }
    }

    const defaultPaletteColors = [
      palette.primary || "#38BDF8",
      palette.secondary || "#818CF8",
      palette.accent || "#34D399",
      "#10B981",
    ];

    // Fallback: Default progressive bars
    if (!bars || bars.length < 2) {
      bars = [
        { label: "Q1", value: 35, formattedValue: "$1.2M", color: palette.primary || "#38BDF8" },
        { label: "Q2", value: 58, formattedValue: "$2.4M", color: palette.secondary || "#818CF8" },
        { label: "Q3", value: 82, formattedValue: "$3.8M", color: palette.accent || "#34D399" },
        { label: "Q4", value: 100, formattedValue: "$5.2M", color: "#10B981" },
      ];
    }

    const normalizedBars = bars.map((b, idx) => ({
      label: b.label,
      value: b.value,
      formattedValue: b.formattedValue,
      color: b.color || defaultPaletteColors[idx % defaultPaletteColors.length],
    }));

    const headline =
      briefScene?.headline ||
      (isFirst
        ? "REVENUE GROWTH ACCELERATION"
        : isLast
          ? "ANNUAL FISCAL MILESTONES"
          : "QUARTERLY PERFORMANCE");
    const highlightedWord =
      briefScene?.highlightedWord || (isFirst ? "GROWTH" : isLast ? "MILESTONES" : "PERFORMANCE");
    const subtitle =
      briefScene?.subtitle ||
      (isFirst
        ? brief.subject || "Quarter-over-quarter revenue progression showcasing measured expansion."
        : isLast
          ? "Consistent multi-quarter revenue velocity with verified financial stability."
          : "Disciplined execution and revenue momentum driving sustained enterprise value.");
    const badge =
      briefScene?.badge || (isFirst ? "FINANCIAL REPORT" : isLast ? "VERIFIED TOTALS" : "QUARTERLY AUDIT");

    if (isFirst) {
      return {
        id,
        index,
        name: briefScene?.name || "Revenue Performance Overview",
        objective: briefScene?.objective || "Authoritative revenue analytics and growth overview",
        start,
        duration,
        end,
        startFrame,
        endFrame,
        sceneType: "animated-bar-chart",
        headline,
        highlightedWord,
        subtitle,
        badge,
        dataVisualization: {
          type: "bar-chart",
          bars: normalizedBars,
        },
        visualAtmosphere: {
          backgroundType: "minimal-dark",
          ambientGlowColor: "rgba(52, 211, 153, 0.3)",
        },
      };
    }

    if (isLast) {
      return {
        id,
        index,
        name: briefScene?.name || "Fiscal Milestones & Summary",
        objective: briefScene?.objective || "Summary metrics highlighting verified financial trajectory",
        start,
        duration,
        end,
        startFrame,
        endFrame,
        sceneType: briefScene?.sceneType === "animated-bar-chart" ? "animated-bar-chart" : "metrics-counter-hud",
        headline,
        highlightedWord,
        subtitle,
        badge,
        dataVisualization:
          briefScene?.sceneType === "animated-bar-chart"
            ? { type: "bar-chart", bars: normalizedBars }
            : {
                type: "metric-counter",
                metrics: [
                  { label: "Annual Revenue", value: "$12.6M", startValue: 0, targetValue: 12.6, prefix: "$", suffix: "M", trend: "up" },
                  { label: "YoY Growth", value: "+148%", startValue: 0, targetValue: 148, prefix: "+", suffix: "%", trend: "up" },
                  { label: "Operating Margin", value: "32%", startValue: 0, targetValue: 32, suffix: "%", trend: "up" },
                ],
              },
        visualAtmosphere: {
          backgroundType: "minimal-dark",
          ambientGlowColor: "rgba(52, 211, 153, 0.25)",
        },
      };
    }

    return {
      id,
      index,
      name: briefScene?.name || "Quarterly Revenue Breakdown",
      objective: briefScene?.objective || "Detailed quarterly progression chart",
      start,
      duration,
      end,
      startFrame,
      endFrame,
      sceneType: "animated-bar-chart",
      headline,
      highlightedWord,
      subtitle,
      badge,
      dataVisualization: {
        type: "bar-chart",
        bars: normalizedBars,
      },
      visualAtmosphere: {
        backgroundType: "minimal-dark",
        ambientGlowColor: "rgba(56, 189, 248, 0.25)",
      },
    };
  }

  private static buildAssetAdScene(
    index: number,
    id: string,
    start: number,
    duration: number,
    end: number,
    startFrame: number,
    endFrame: number,
    brief: CreativeBrief,
    asset: AnalyzedAsset,
    totalScenes: number,
  ): PlannedScene {
    const isFirst = index === 0;
    const isLast = index === totalScenes - 1;
    const palette = brief.colorPalette;

    if (isFirst) {
      return {
        id,
        index,
        name: "Featured Asset Spotlight",
        objective: "Prominently display user-selected asset with cinematic framing",
        start,
        duration,
        end,
        startFrame,
        endFrame,
        sceneType: "cinematic-hero-intro",
        headline: brief.title.toUpperCase(),
        highlightedWord: brief.title.split(" ")[0].toUpperCase(),
        subtitle: brief.subject,
        badge: "FEATURED SHOWCASE",
        assetToFeature: asset,
        visualAtmosphere: {
          backgroundType: "image-backdrop",
          scrimGradient:
            "linear-gradient(180deg, rgba(8,12,22,0.85) 0%, rgba(8,12,22,0.3) 35%, rgba(8,12,22,0.95) 100%)",
          ambientGlowColor: palette.accent || "rgba(0, 245, 255, 0.35)",
        },
      };
    }

    return {
      id,
      index,
      name: "Product Climax & Call to Action",
      objective: "Final closing highlight featuring the selected asset and CTA",
      start,
      duration,
      end,
      startFrame,
      endFrame,
      sceneType: "cinematic-climax-cta",
      headline: brief.closingMessage || "DISCOVER THE EXPERIENCE",
      highlightedWord: (brief.closingMessage || "EXPERIENCE").split(" ")[0],
      subtitle: brief.subject,
      badge: "OFFICIAL RELEASE",
      ctaText: brief.callToAction || "LEARN MORE",
      assetToFeature: asset,
      visualAtmosphere: {
        backgroundType: "image-backdrop",
        scrimGradient:
          "linear-gradient(180deg, rgba(8,12,22,0.8) 0%, rgba(8,12,22,0.35) 40%, rgba(8,12,22,0.96) 100%)",
        ambientGlowColor: palette.accent || "rgba(0, 245, 255, 0.35)",
      },
    };
  }

  private static buildDynamicShowcaseScene(
    index: number,
    id: string,
    start: number,
    duration: number,
    end: number,
    startFrame: number,
    endFrame: number,
    brief: CreativeBrief,
    asset?: AnalyzedAsset,
    totalScenes: number = 5,
  ): PlannedScene {
    const isFirst = index === 0;
    const isLast = index === totalScenes - 1;
    const palette = brief.colorPalette;

    if (isFirst) {
      return {
        id,
        index,
        name: "Opening Hook",
        objective: "Introduce central theme and subject",
        start,
        duration,
        end,
        startFrame,
        endFrame,
        sceneType: "cinematic-hero-intro",
        headline: brief.title.toUpperCase(),
        highlightedWord: brief.title.split(" ")[0].toUpperCase(),
        subtitle: brief.subject,
        badge: `${brief.category.toUpperCase().replace("-", " ")} // 2026`,
        assetToFeature: asset,
        visualAtmosphere: {
          backgroundType: asset ? "image-backdrop" : "mesh-gradient",
          ambientGlowColor: palette.accent || "rgba(0, 212, 255, 0.3)",
        },
      };
    }

    if (isLast) {
      return {
        id,
        index,
        name: "Payoff & Action",
        objective: "Strong takeaway and call to action",
        start,
        duration,
        end,
        startFrame,
        endFrame,
        sceneType: "cinematic-climax-cta",
        headline: brief.closingMessage || "EXPERIENCE THE DIFFERENCE",
        highlightedWord: (brief.closingMessage || "EXPERIENCE").split(" ")[0],
        subtitle: brief.subject,
        badge: "GET STARTED",
        ctaText: brief.callToAction || "EXPLORE NOW",
        assetToFeature: asset,
        visualAtmosphere: {
          backgroundType: asset ? "image-backdrop" : "mesh-gradient",
          ambientGlowColor: palette.accent || "rgba(0, 212, 255, 0.35)",
        },
      };
    }

    return {
      id,
      index,
      name: `Core Progression ${index + 1}`,
      objective: "Key narrative development",
      start,
      duration,
      end,
      startFrame,
      endFrame,
      sceneType: "kinetic-typography",
      headline: `${brief.title.toUpperCase()} // HIGHLIGHT`,
      highlightedWord: "HIGHLIGHT",
      subtitle: brief.subject,
      badge: "KEY PERSPECTIVE",
      assetToFeature: asset,
      visualAtmosphere: {
        backgroundType: asset ? "image-backdrop" : "minimal-dark",
        ambientGlowColor: palette.primary || "rgba(99, 102, 241, 0.25)",
      },
    };
  }
}


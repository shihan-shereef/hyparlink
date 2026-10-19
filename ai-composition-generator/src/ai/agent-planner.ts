import crypto from "node:crypto";
import { ColorPalette, TypographySpec, CreativeBrief } from "./creative-brief.js";
import { PlannedTimeline, PlannedScene } from "./scene-planner.js";
import { AnalyzedAsset } from "./asset-analyzer.js";
import { jsonrepair } from "jsonrepair";

export interface PlanScene {
  id: string; // "scene-1", "scene-2", etc.
  index: number;
  name: string;
  purpose: string;
  start: number;
  duration: number;
  end: number;
  narration: string;
  onScreenText: {
    headline: string;
    highlightedWord?: string;
    subtitle: string;
    badge?: string;
    ctaText?: string;
  };
  visualDescription: string;
  layoutArchetype:
    | "cinematic-hero-intro"
    | "hero-product-showcase"
    | "feature-split-layout"
    | "nature-tree-growth"
    | "animated-bar-chart"
    | "network-http-flow"
    | "abstract-geometric-motion"
    | "metrics-counter-hud"
    | "interactive-diagram"
    | "kinetic-typography"
    | "avatar-presenter-spotlight"
    | "avatar-mixed-feature"
    | "cinematic-climax-cta";
  animationDirection: string;
  transition: string;
  requiredAssets?: string[];
  audioCues?: string;
}

export interface VideoProductionPlan {
  planId: string;
  version: number;
  mode: "plan" | "autopilot";
  prompt: string;
  creativeBrief: {
    title: string;
    subject: string;
    goal: string;
    audience: string;
    videoType: string;
    visualDirection: string;
    tone: string;
    brandStyle?: {
      primaryColor?: string;
      accentColor?: string;
      fontFamily?: string;
      logoAsset?: string;
    };
    duration: number;
    aspectRatio: "16:9" | "9:16" | "1:1";
    resolution: "1080p" | "720p";
    width: number;
    height: number;
    fps: number;
    colorPalette: ColorPalette;
    typography: TypographySpec;
  };
  script: {
    hook: string;
    fullNarrative: string;
    callToAction?: string;
    scenesScript: Array<{
      sceneId: string;
      spokenNarration: string;
      onScreenCopy: string;
    }>;
  };
  scenes: PlanScene[];
  audioPlan: {
    isSilent: boolean;
    voiceId?: string;
    avatarId?: string;
    backgroundMusicDescription?: string;
    soundEffects?: string[];
  };
  mediaPlan: {
    userAssets: any[];
    researchedAssets: any[];
    suggestedVisuals: string[];
  };
  status: "ready" | "revising" | "approved";
  lastRevisionFeedback?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlanOptions {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  orientation?: "landscape" | "portrait" | "square";
  model?: string;
  avatarId?: string;
  voiceId?: string;
  isAvatarVideo?: boolean;
  compositionMode?: "mode_a" | "mode_b" | "mode_c" | "auto" | "hyperframes_only";
  visualStyle?: string;
  avatarLanguage?: string;
  brandColors?: { primary?: string; accent?: string; background?: string };
  assets?: any[];
  script?: string;
  mode?: "plan" | "autopilot";
}

export class AgentPlanner {
  /**
   * Generates a complete, structured Video Production Plan matching HeyGen Video Agent standards.
   */
  public static async generatePlan(
    prompt: string,
    options: PlanOptions,
    provider?: any,
  ): Promise<VideoProductionPlan> {
    const planId = `plan_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const mode = options.mode || "plan";

    // Sanitize avatar settings if prompt specifies no avatar/podcast or requests PPT
    const isNegativeAvatarPrompt = /\b(do\s*not\s*create\s*(?:a\s*)?(?:potcast|podcast)|don'?t\s*create\s*(?:a\s*)?(?:potcast|podcast)|no\s*(?:potcast|podcast|avatar|presenter)|without\s*avatar|remove\s*(?:the\s*)?avatar|not\s*(?:a\s*)?(?:potcast|podcast)|create\s*(?:a\s*)?ppt|ppt|presentation|pitch\s*deck|slideshow)\b/i.test(prompt);
    if (isNegativeAvatarPrompt) {
      options.avatarId = undefined;
      options.voiceId = undefined;
      options.isAvatarVideo = false;
    }

    // Determine authoritative duration & resolution
    const duration = Number(options.duration) || 15;
    const isPortrait = options.orientation === "portrait" || (options.height && options.height > (options.width || 0));
    const isSquare = options.orientation === "square" || (options.width === options.height);
    const width = options.width || (isPortrait ? 1080 : isSquare ? 1080 : 1920);
    const height = options.height || (isPortrait ? 1920 : isSquare ? 1080 : 1080);
    const fps = options.fps || 30;
    const aspectRatio: "16:9" | "9:16" | "1:1" = isPortrait ? "9:16" : isSquare ? "1:1" : "16:9";

    // Attempt generation with LLM
    if (provider && typeof provider.complete === "function") {
      try {
        const systemPrompt = `You are the Hyparlink Autonomous AI Video Production Agent (equivalent to the HeyGen Video Agent creative director).
Your mission is to understand the user's creative prompt, develop a compelling creative brief, author a polished script, and structure a frame-accurate, scene-by-scene production plan.

OUTPUT FORMAT: Strict valid JSON only. Do not include markdown preamble, commentary, or backticks outside the JSON.
{
  "title": "Clean, punchy project title",
  "subject": "Clear statement of topic and product",
  "goal": "Core objective (e.g. product launch, educational walkthrough, social conversion)",
  "audience": "Primary viewer persona",
  "videoType": "advertisement" | "explainer" | "motion_graphics" | "data_visualization" | "story",
  "visualDirection": "Detailed visual style description (e.g. sleek dark-mode tech, vibrant kinetic typography, organic botanical growth)",
  "tone": "e.g. professional, energetic, inspiring, authoritative",
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "backgroundColor": "#hex",
    "surfaceColor": "rgba(...)",
    "textColor": "#hex",
    "textMutedColor": "#hex",
    "glowColor": "rgba(...)",
    "borderColor": "rgba(...)"
  },
  "typography": {
    "displayFont": "Plus Jakarta Sans" | "Bebas Neue" | "Outfit" | "Syne" | "Playfair Display",
    "bodyFont": "Inter" | "Plus Jakarta Sans" | "Space Grotesk",
    "headlineTransform": "uppercase" | "none"
  },
  "script": {
    "hook": "Opening attention grabber",
    "fullNarrative": "Complete spoken or narrated script text",
    "callToAction": "Clear final action",
    "scenesScript": [
      { "sceneId": "scene-1", "spokenNarration": "...", "onScreenCopy": "..." }
    ]
  },
  "scenes": [
    {
      "id": "scene-1",
      "name": "Descriptive Scene Title",
      "purpose": "Why this scene exists",
      "duration": 5.0,
      "narration": "Spoken line for this scene",
      "onScreenText": {
        "headline": "PUNCHY HEADLINE",
        "highlightedWord": "PUNCHY",
        "subtitle": "Clear explanatory subtitle",
        "badge": "OPTIONAL BADGE",
        "ctaText": "OPTIONAL BUTTON TEXT"
      },
      "visualDescription": "Concrete visual scene contents (layout, elements, colors, subject)",
      "layoutArchetype": "cinematic-hero-intro" | "hero-product-showcase" | "feature-split-layout" | "animated-bar-chart" | "network-http-flow" | "abstract-geometric-motion" | "metrics-counter-hud" | "kinetic-typography" | "cinematic-climax-cta",
      "animationDirection": "Specific GSAP motion instructions",
      "transition": "fade" | "scale-zoom" | "whip-slide" | "crossfade"
    }
  ],
  "audioPlan": {
    "isSilent": false,
    "backgroundMusicDescription": "e.g. Upbeat modern tech electronic groove with subtle synth pulses",
    "soundEffects": ["whoosh_riser", "digital_ping"]
  }
}

CRITICAL RULES:
1. TOTAL DURATION MATH: The sum of all scene 'duration' values MUST equal exactly ${duration} seconds.
2. If the user provided a script, respect it scene-by-scene.
3. Every scene MUST have a unique layout and distinct visual description matching the specific prompt. Do NOT make every scene look identical.`;

        const userPrompt = `PROMPT: "${prompt}"
DURATION: ${duration} seconds (EXACT)
ORIENTATION: ${aspectRatio} (${width}x${height} @ ${fps}fps)
${options.script ? `USER SCRIPT: "${options.script}"` : ""}
${options.assets && options.assets.length > 0 ? `ATTACHED ASSETS: ${options.assets.map((a: any) => a.name || a.originalFilename).join(", ")}` : ""}
${options.avatarId ? `PRESENTER AVATAR ID: ${options.avatarId} (Voice: ${options.voiceId || "default"})` : ""}`;

        const raw = await provider.complete(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          0.2,
          options.model,
        );

        const parsed = this.cleanAndParseJson(raw);
        if (parsed && Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
          return this.assembleValidatedPlan(planId, mode, prompt, options, parsed, duration, width, height, fps, aspectRatio);
        }
      } catch (err: any) {
        console.warn(`[AgentPlanner] LLM planning notice: ${err.message}. Generating dynamic bespoke plan.`);
      }
    }

    // Heuristic synthesis fallback: creates a bespoke prompt-specific plan without generic repetition
    return this.synthesizeBespokePlan(planId, mode, prompt, options, duration, width, height, fps, aspectRatio);
  }

  /**
   * Revises an existing Video Production Plan based on user conversational feedback.
   */
  public static async revisePlan(
    currentPlan: VideoProductionPlan,
    feedback: string,
    provider?: any,
  ): Promise<VideoProductionPlan> {
    if (provider && typeof provider.complete === "function") {
      try {
        const systemPrompt = `You are the Hyparlink AI Video Production Agent revising a Video Production Plan based on user feedback.
Analyze the user's revision request:
- If it is a targeted adjustment (e.g. changing headline, script line, color, single scene), modify ONLY that element while preserving all other scenes and timeline math.
- If it is a structural change (e.g. adding a scene, changing total duration, complete restyle), update the scenes and recalculate durations so the sum equals ${currentPlan.creativeBrief.duration} seconds.

OUTPUT FORMAT: Strict valid JSON containing the updated plan matching the existing structure.`;

        const userPrompt = `CURRENT PLAN:\n${JSON.stringify(currentPlan, null, 2)}\n\nUSER REVISION REQUEST: "${feedback}"\n\nPlease output the revised plan JSON.`;

        const raw = await provider.complete(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          0.2,
        );

        const parsed = this.cleanAndParseJson(raw);
        if (parsed && Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
          return {
            ...currentPlan,
            version: currentPlan.version + 1,
            creativeBrief: {
              ...currentPlan.creativeBrief,
              ...(parsed.creativeBrief || {}),
            },
            script: parsed.script || currentPlan.script,
            scenes: this.normalizeSceneTimings(parsed.scenes, currentPlan.creativeBrief.duration),
            audioPlan: parsed.audioPlan || currentPlan.audioPlan,
            status: "ready",
            lastRevisionFeedback: feedback,
            updatedAt: Date.now(),
          };
        }
      } catch (err: any) {
        console.warn(`[AgentPlanner] LLM revision notice: ${err.message}. Applying direct revision rules.`);
      }
    }

    // Direct conversational revision parser
    return this.applyDirectRevision(currentPlan, feedback);
  }

  /**
   * Converts a VideoProductionPlan to a PlannedTimeline for the composition synthesizer.
   */
  public static planToTimeline(
    plan: VideoProductionPlan,
    analyzedAssets: AnalyzedAsset[] = [],
  ): PlannedTimeline {
    const totalDuration = plan.creativeBrief.duration;
    const fps = plan.creativeBrief.fps;
    const totalFrames = Math.round(totalDuration * fps);

    const plannedScenes: PlannedScene[] = plan.scenes.map((s, idx) => {
      const asset =
        analyzedAssets.find((a) => s.requiredAssets?.includes(a.name)) ||
        analyzedAssets[idx % (analyzedAssets.length || 1)];

      return {
        id: s.id,
        index: s.index,
        name: s.name,
        objective: s.purpose,
        start: s.start,
        duration: s.duration,
        end: s.end,
        startFrame: Math.round(s.start * fps),
        endFrame: Math.round(s.end * fps),
        sceneType: s.layoutArchetype as any,
        headline: s.onScreenText.headline,
        highlightedWord: s.onScreenText.highlightedWord || s.onScreenText.headline.split(" ")[0],
        subtitle: s.onScreenText.subtitle,
        badge: s.onScreenText.badge,
        ctaText: s.onScreenText.ctaText,
        assetToFeature: asset,
        visualAtmosphere: {
          backgroundType: asset ? "image-backdrop" : "mesh-gradient",
          ambientGlowColor: plan.creativeBrief.colorPalette.accent,
        },
      };
    });

    return {
      totalDuration,
      fps,
      totalFrames,
      scenes: plannedScenes,
    };
  }

  /**
   * Helper to build a CreativeBrief object from a VideoProductionPlan.
   */
  public static planToCreativeBrief(plan: VideoProductionPlan): CreativeBrief {
    return {
      title: plan.creativeBrief.title,
      subject: plan.creativeBrief.subject,
      videoType: plan.creativeBrief.videoType as any,
      category: (plan.creativeBrief.videoType || "advertisement") as any,
      promptComponents: {
        route: plan.creativeBrief.videoType,
        spec: {
          durationSeconds: plan.creativeBrief.duration,
          resolution: `${plan.creativeBrief.width}x${plan.creativeBrief.height}`,
          frameRate: plan.creativeBrief.fps,
          aspectRatio: plan.creativeBrief.aspectRatio,
          visualStyle: plan.creativeBrief.visualDirection,
          colorPalette: [
            plan.creativeBrief.colorPalette.primary,
            plan.creativeBrief.colorPalette.accent,
            plan.creativeBrief.colorPalette.backgroundColor,
          ],
          typography: plan.creativeBrief.typography.displayFont,
          sceneCount: plan.scenes.length,
        },
        beats: plan.scenes.map((s) => ({
          id: s.id,
          purpose: s.purpose,
          duration: s.duration,
          visualContent: s.visualDescription,
          animation: s.animationDirection,
        })),
        copy: {
          headlines: plan.scenes.map((s) => s.onScreenText.headline),
          narrations: plan.scenes.map((s) => s.narration),
          callToAction: plan.script.callToAction,
        },
        technique: ["GSAP timeline", "Procedural CSS/SVG", "Kinetic text"],
        negatives: ["no generic template", "no duplicate cards"],
      },
      audioPlan: {
        isSilent: plan.audioPlan.isSilent,
        backgroundMusicDescription: plan.audioPlan.backgroundMusicDescription,
      },
      intendedAudience: plan.creativeBrief.audience,
      visualAtmosphere: plan.creativeBrief.visualDirection,
      colorPalette: plan.creativeBrief.colorPalette,
      typography: plan.creativeBrief.typography,
      narrativeProgression: plan.scenes.map((s) => s.purpose),
      sceneCount: plan.scenes.length,
      requiredImages: (plan.mediaPlan.userAssets || []).map((a: any) => a.name || a.originalFilename || ""),
      animationStyle: "GSAP motion graphics and bespoke layout synthesis",
      cameraMovement: "Subtle organic push and pan",
      totalDuration: plan.creativeBrief.duration,
      closingMessage: plan.script.callToAction || "Get Started Today",
      callToAction: plan.script.callToAction || "Explore More",
    };
  }

  // ==========================================
  // INTERNAL HELPERS
  // ==========================================

  private static assembleValidatedPlan(
    planId: string,
    mode: "plan" | "autopilot",
    prompt: string,
    options: PlanOptions,
    parsed: any,
    duration: number,
    width: number,
    height: number,
    fps: number,
    aspectRatio: "16:9" | "9:16" | "1:1",
  ): VideoProductionPlan {
    const scenes = this.normalizeSceneTimings(parsed.scenes, duration);

    return {
      planId,
      version: 1,
      mode,
      prompt,
      creativeBrief: {
        title: parsed.title || "AI Video Production",
        subject: parsed.subject || prompt,
        goal: parsed.goal || "Engage audience with professional video production",
        audience: parsed.audience || "General Audience",
        videoType: parsed.videoType || "advertisement",
        visualDirection: parsed.visualDirection || "Cinematic modern aesthetic",
        tone: parsed.tone || "Professional and engaging",
        brandStyle: options.brandColors ? { primaryColor: options.brandColors.primary, accentColor: options.brandColors.accent } : undefined,
        duration,
        aspectRatio,
        resolution: width === 1920 ? "1080p" : "720p",
        width,
        height,
        fps,
        colorPalette: parsed.colorPalette || this.defaultPalette(),
        typography: parsed.typography || { displayFont: "Plus Jakarta Sans", bodyFont: "Inter", weights: ["400", "700", "800"] },
      },
      script: {
        hook: parsed.script?.hook || scenes[0]?.narration || "Welcome to the future",
        fullNarrative: parsed.script?.fullNarrative || scenes.map((s) => s.narration).join(" "),
        callToAction: parsed.script?.callToAction || "Discover more",
        scenesScript: scenes.map((s) => ({
          sceneId: s.id,
          spokenNarration: s.narration,
          onScreenCopy: s.onScreenText.headline,
        })),
      },
      scenes,
      audioPlan: {
        isSilent: Boolean(parsed.audioPlan?.isSilent),
        voiceId: options.voiceId,
        avatarId: options.avatarId,
        backgroundMusicDescription: parsed.audioPlan?.backgroundMusicDescription || "Modern electronic ambient bed",
        soundEffects: parsed.audioPlan?.soundEffects || ["subtle_riser"],
      },
      mediaPlan: {
        userAssets: options.assets || [],
        researchedAssets: [],
        suggestedVisuals: scenes.map((s) => s.visualDescription),
      },
      status: "ready",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private static synthesizeBespokePlan(
    planId: string,
    mode: "plan" | "autopilot",
    prompt: string,
    options: PlanOptions,
    duration: number,
    width: number,
    height: number,
    fps: number,
    aspectRatio: "16:9" | "9:16" | "1:1",
  ): VideoProductionPlan {
    const p = prompt.toLowerCase();
    const isTree = p.includes("tree") || p.includes("grow") || p.includes("seed");
    const isNetwork = p.includes("http") || p.includes("network") || p.includes("packet") || p.includes("server");
    const isChart = p.includes("revenue") || p.includes("chart") || p.includes("growth") || p.includes("metric");
    const isShoe = p.includes("shoe") || p.includes("sneaker") || p.includes("footwear");
    const isCyber = p.includes("cyber") || p.includes("security") || p.includes("tech");
    const isPPT = p.includes("ppt") || p.includes("presentation") || p.includes("deck") || p.includes("slideshow");
    const isVikas = p.includes("vikas") || p.includes("vices") || p.includes("swami") || (p.includes("networkers") && p.includes("ollasoftware"));

    let numScenes = duration >= 50 ? 6 : duration >= 25 ? 4 : duration >= 14 ? 3 : duration >= 8 ? 2 : 1;
    const durPerScene = Number((duration / numScenes).toFixed(2));

    const scenes: PlanScene[] = [];
    let curTime = 0;

    for (let i = 0; i < numScenes; i++) {
      const isFirst = i === 0;
      const isLast = i === numScenes - 1;
      const sDur = isLast ? Number((duration - curTime).toFixed(2)) : durPerScene;
      const sStart = curTime;
      const sEnd = Number((curTime + sDur).toFixed(2));
      curTime = sEnd;

      const hasAvatar = Boolean(options.avatarId || options.isAvatarVideo);
      const compMode = options.compositionMode || (hasAvatar ? "mode_a" : "hyperframes_only");

      let archetype: PlanScene["layoutArchetype"];
      if (hasAvatar) {
        if (compMode === "mode_c") {
          // Mode C: Full-Screen Avatar throughout all scenes with lower thirds & overlays
          archetype = "avatar-presenter-spotlight";
        } else if (compMode === "mode_a") {
          // Mode A: Presenter-Led — Avatar visible with side-by-side animated cards, telemetry & charts
          archetype = isFirst ? "avatar-presenter-spotlight" : "avatar-mixed-feature";
        } else if (compMode === "mode_b") {
          // Mode B: Cinematic with Avatar Inserts — Avatar appears in selected scenes (hook intro & outro), intermediate scenes are full-screen visuals
          archetype = (isFirst || isLast)
            ? "avatar-presenter-spotlight"
            : (isTree ? "nature-tree-growth" : isNetwork ? "network-http-flow" : isChart ? "animated-bar-chart" : isShoe ? "hero-product-showcase" : "feature-split-layout");
        } else {
          // Auto / Mixed default: Ollima recommendation
          archetype = isFirst
            ? "avatar-presenter-spotlight"
            : isLast
              ? "cinematic-climax-cta"
              : (i % 2 === 1 ? "avatar-mixed-feature" : "feature-split-layout");
        }
      } else {
        // Pure HyperFrames (No Avatar)
        archetype = isFirst
          ? "cinematic-hero-intro"
          : isLast
            ? "cinematic-climax-cta"
            : isTree
              ? "nature-tree-growth"
              : isNetwork
                ? "network-http-flow"
                : isChart
                  ? "animated-bar-chart"
                  : isShoe
                    ? "hero-product-showcase"
                    : "feature-split-layout";
      }

      let headline = isFirst
        ? (prompt.slice(0, 30).toUpperCase())
        : isLast
          ? "TAKE THE NEXT STEP"
          : isChart
            ? "EXPONENTIAL GROWTH METRICS"
            : isTree
              ? "CANOPY IN FULL BLOOM"
              : isNetwork
                ? "PACKET TRAVEL PROTOCOL"
                : "BUILT FOR PERFORMANCE";

      let narration = isFirst
        ? `Introducing ${prompt.slice(0, 40)}. The new standard in creation.`
        : isLast
          ? "Get started today and experience the difference."
          : `Engineered from the ground up for unprecedented results.`;

      let badge = isFirst ? "OFFICIAL PREVIEW" : isLast ? "GET STARTED" : "CAPABILITY";
      let subtitle = isFirst ? prompt : `Designed with utmost precision for modern teams.`;
      let sceneName = isFirst ? "Visual Hook & Intro" : isLast ? "Climax & Call To Action" : `Key Progression ${i + 1}`;

      if (isVikas) {
        if (i === 0) {
          sceneName = "Executive Profile & Dual Founder";
          headline = "VIKAS SWAMI";
          subtitle = "Co-Founder of Networkers Home & Founder of Ollasoftware";
          badge = "EXECUTIVE PROFILE";
          narration = "Meet Vikas Swami, dual enterprise founder driving technological excellence across global networks and autonomous software.";
          archetype = "cinematic-hero-intro";
        } else if (i === 1) {
          sceneName = "Networkers Home Legacy";
          headline = "NETWORKERS HOME";
          subtitle = "18+ Years Leading India's Premier Cisco Training Institution";
          badge = "18+ YEARS EXCELLENCE";
          narration = "Under his leadership, Networkers Home trained over 25,000 Cisco certified engineers across 30+ nations.";
          archetype = "feature-split-layout";
        } else if (i === 2) {
          sceneName = "Ollasoftware Innovation";
          headline = "OLLASOFTWARE";
          subtitle = "Enterprise AI & Autonomous Digital Transformation";
          badge = "ENTERPRISE SOFTWARE";
          narration = "With Ollasoftware, Vikas spearheads next-generation enterprise AI and autonomous digital engineering.";
          archetype = "interactive-diagram";
        } else if (i === 3) {
          sceneName = "Dual Enterprise Architecture";
          headline = "GLOBAL INFRASTRUCTURE";
          subtitle = "Bridging High-Speed Networking & Intelligent Enterprise Software";
          badge = "INFRASTRUCTURE + AI";
          narration = "Combining resilient networking foundations with scalable artificial intelligence architecture.";
          archetype = "network-http-flow";
        } else if (i === 4) {
          sceneName = "Proven Enterprise Scale";
          headline = "25,000+ ENGINEERS";
          subtitle = "25,000+ Certified Alumni • 100+ Enterprise Clients • 99.9% Reliable Scale";
          badge = "ENTERPRISE SCALE";
          narration = "A proven track record spanning two decades of tech leadership and measurable enterprise impact.";
          archetype = "animated-bar-chart";
        } else if (i === 5) {
          sceneName = "Strategic Leadership & Vision";
          headline = "SHAPING THE FUTURE";
          subtitle = "Connect with Vikas Swami • Networkers Home & Ollasoftware";
          badge = "EXECUTIVE SUMMARY";
          narration = "Pioneering the future of enterprise software and technology education worldwide.";
          archetype = "cinematic-climax-cta";
        }
      }

      scenes.push({
        id: `scene-${i + 1}`,
        index: i,
        name: sceneName,
        purpose: isFirst ? "Capture attention immediately" : isLast ? "Drive viewer action" : "Deliver core value proposition",
        start: sStart,
        duration: sDur,
        end: sEnd,
        narration,
        onScreenText: {
          headline,
          highlightedWord: headline.split(" ")[0],
          subtitle,
          badge,
          ctaText: isLast ? "EXPLORE NOW" : undefined,
        },
        visualDescription: isFirst
          ? `High contrast executive presentation title with smooth animations and subtle ambient lighting.`
          : isLast
            ? `Final dual-brand lockup with prominent call-to-action button and contact details.`
            : `Clean presentation slide layout with data badges, metrics cards, and fluid motion.`,
        layoutArchetype: archetype,
        animationDirection: "GSAP stagger entrance with power2.out ease and subtle camera push",
        transition: "whip-slide",
      });
    }

    const isWhiteAndBlue =
      /\bwhite\s+and\s+blue\b/i.test(p) ||
      /\bblue\s+and\s+white\b/i.test(p) ||
      (/\bwhite\b/i.test(p) && /\bblue\b/i.test(p) && /\b(?:color|theme|theam|bg|background)\b/i.test(p));

    const palette = isWhiteAndBlue
      ? {
          primary: "#1D4ED8", // Royal Blue
          secondary: "#2563EB", // Vibrant Blue
          accent: "#0284C7", // Sky Accent
          backgroundColor: "#F8FAFC", // Clean Crisp White
          surfaceColor: "rgba(255, 255, 255, 0.95)",
          textColor: "#0F172A", // Deep Navy / Charcoal
          textMutedColor: "#475569", // Slate Muted
          glowColor: "rgba(37, 99, 235, 0.15)",
          borderColor: "rgba(37, 99, 235, 0.25)",
        }
      : isCyber
        ? {
            primary: "#00F5FF",
            secondary: "#7928CA",
            accent: "#FFE600",
            backgroundColor: "#05070D",
            surfaceColor: "rgba(10, 15, 30, 0.75)",
            textColor: "#FFFFFF",
            textMutedColor: "rgba(255, 255, 255, 0.65)",
            glowColor: "rgba(0, 245, 255, 0.4)",
            borderColor: "rgba(0, 245, 255, 0.2)",
          }
        : isTree
          ? {
              primary: "#FACC15",
              secondary: "#15803D",
              accent: "#EAB308",
              backgroundColor: "#0A160F",
              surfaceColor: "rgba(20, 35, 25, 0.8)",
              textColor: "#F8FAFC",
              textMutedColor: "rgba(255, 255, 255, 0.7)",
              glowColor: "rgba(250, 204, 21, 0.35)",
              borderColor: "rgba(250, 204, 21, 0.2)",
            }
          : this.defaultPalette();

    return {
      planId,
      version: 1,
      mode,
      prompt,
      creativeBrief: {
        title: prompt.slice(0, 35),
        subject: prompt,
        goal: "Drive high engagement and retention with prompt-native video storytelling",
        audience: "Modern audience and professionals",
        videoType: isShoe ? "advertisement" : isChart ? "data_visualization" : isNetwork || isTree ? "explainer" : "motion_graphics",
        visualDirection: "Curated modern aesthetic with fluid GSAP micro-animations and custom color harmony",
        tone: "Dynamic, polished, and authoritative",
        duration,
        aspectRatio,
        resolution: width === 1920 ? "1080p" : "720p",
        width,
        height,
        fps,
        colorPalette: palette,
        typography: { displayFont: "Plus Jakarta Sans", bodyFont: "Inter", weights: ["400", "600", "800"], headlineTransform: "uppercase" },
      },
      script: {
        hook: scenes[0]?.narration || "Welcome to the future",
        fullNarrative: scenes.map((s) => s.narration).join(" "),
        callToAction: "Explore the new standard today",
        scenesScript: scenes.map((s) => ({
          sceneId: s.id,
          spokenNarration: s.narration,
          onScreenCopy: s.onScreenText.headline,
        })),
      },
      scenes,
      audioPlan: {
        isSilent: false,
        voiceId: options.voiceId,
        avatarId: options.avatarId,
        backgroundMusicDescription: "Uplifting modern electronic bed with cinematic momentum",
        soundEffects: ["riser", "digital_bell"],
      },
      mediaPlan: {
        userAssets: options.assets || [],
        researchedAssets: [],
        suggestedVisuals: scenes.map((s) => s.visualDescription),
      },
      status: "ready",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private static applyDirectRevision(
    currentPlan: VideoProductionPlan,
    feedback: string,
  ): VideoProductionPlan {
    const fLower = feedback.toLowerCase();
    const brief = currentPlan.creativeBrief || ({} as any);
    const targetDuration = Number(brief.duration) || 10;
    const updatedScenes = (currentPlan.scenes || []).map((s) => ({
      ...s,
      onScreenText: { ...(s.onScreenText || {}) },
    }));
    let updatedScript = { ...(currentPlan.script || {}) };
    const bp = brief.colorPalette || {};
    let updatedPalette = Object.assign(
      {
        primary: "#6366f1",
        secondary: "#818cf8",
        accent: "#06b6d4",
        backgroundColor: "#070913",
        surfaceColor: "#0f172a",
        textColor: "#ffffff",
        textMutedColor: "#94a3b8",
        glowColor: "rgba(99, 102, 241, 0.4)",
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      bp,
    );
    let updatedVisualDirection = brief.visualDirection || "Cinematic modern aesthetic";
    let updatedTypography = {
      displayFont: brief.typography?.displayFont || "Outfit",
      bodyFont: brief.typography?.bodyFont || "Inter",
      weights: brief.typography?.weights || ["400", "700", "800"],
    };

    // 1. Color palette & style changes
    if (fLower.includes("cinematic") || fLower.includes("high-contrast") || fLower.includes("high contrast")) {
      updatedPalette.backgroundColor = "#030712";
      updatedPalette.primary = "#F59E0B";
      updatedPalette.accent = "#38BDF8";
      updatedPalette.textColor = "#FFFFFF";
      updatedVisualDirection = "Cinematic high-contrast aesthetic with dramatic rim lighting and deep shadow falloff";
      for (const s of updatedScenes) {
        s.visualDescription = `${s.visualDescription || "Scene visual"} with cinematic high-contrast lighting, sharp rim highlights, and atmospheric depth.`;
      }
    } else if (fLower.includes("brighter") || fLower.includes("vibrant") || fLower.includes("light")) {
      updatedPalette.backgroundColor = "#0B0F19";
      updatedPalette.primary = "#6366F1";
      updatedPalette.accent = "#06B6D4";
      updatedPalette.textColor = "#FFFFFF";
      updatedVisualDirection = "Vibrant bright visual style with electric neon accents and vivid ambient glow";
      for (const s of updatedScenes) {
        s.visualDescription = `${s.visualDescription || "Scene visual"} in an ultra-vibrant space featuring electric glowing accents.`;
      }
    } else if (fLower.includes("emerald") || fLower.includes("green")) {
      updatedPalette.primary = "#10B981";
      updatedPalette.accent = "#34D399";
      updatedPalette.backgroundColor = "#062319";
    }

    // 2. Kinetic typography / Energy
    if (fLower.includes("kinetic") || fLower.includes("faster") || fLower.includes("energetic")) {
      updatedTypography.weights = ["700", "800", "900"];
      for (const s of updatedScenes) {
        s.animationDirection = "High-energy kinetic typography with rapid spring reveal and fluid dynamic acceleration";
        s.transition = "zoom-in";
      }
    }

    // 3. Timing / Duration adjustments (e.g. "shorten scene 1 to 2 seconds and extend the climax")
    if (fLower.includes("shorten scene 1") || (fLower.includes("scene 1") && fLower.includes("2 second"))) {
      if (updatedScenes[0]) {
        updatedScenes[0].duration = 2.0;
        const remaining = Math.max(2, targetDuration - 2.0);
        const otherScenes = updatedScenes.slice(1);
        if (otherScenes.length > 0) {
          const perOther = Number((remaining / otherScenes.length).toFixed(2));
          otherScenes.forEach((s, idx) => {
            if (idx === otherScenes.length - 1) {
              s.duration = Number((targetDuration - 2.0 - perOther * (otherScenes.length - 1)).toFixed(2));
            } else {
              s.duration = perOther;
            }
          });
        }
      }
    }

    // 4. Specific scene modifications
    // Scene 2 / Second scene
    if (fLower.includes("second scene") || fLower.includes("scene 2") || fLower.includes("product feature")) {
      if (updatedScenes[1]) {
        updatedScenes[1].name = "Product Features Showcase";
        updatedScenes[1].purpose = "Highlight key product features and precision capabilities";
        updatedScenes[1].layoutArchetype = "hero-product-showcase";
        updatedScenes[1].visualDescription = "Product featured front and center with interactive telemetry badges and floating feature callouts.";
        updatedScenes[1].onScreenText.headline = "PRECISION ENGINEERING";
        updatedScenes[1].onScreenText.subtitle = "Advanced capabilities built with relentless attention to detail.";
        updatedScenes[1].onScreenText.badge = "FLAGSHIP FEATURES";
      }
    }

    // Scene 1 / First scene
    if (fLower.includes("first scene") || (fLower.includes("scene 1") && !fLower.includes("shorten"))) {
      if (updatedScenes[0]) {
        updatedScenes[0].name = "Cinematic Reveal & Hook";
        updatedScenes[0].onScreenText.headline = "THE FUTURE OF CREATION";
        updatedScenes[0].visualDescription = "Cinematic widescreen opening with dramatic lighting and bold presence.";
      }
    }

    // Final / Last / Climax / Call to action
    if (fLower.includes("final") || fLower.includes("last") || fLower.includes("call to action") || fLower.includes("cta") || fLower.includes("climax")) {
      const last = updatedScenes[updatedScenes.length - 1];
      if (last) {
        last.name = "Climax & Immediate Action";
        last.onScreenText.headline = "START CREATING TODAY";
        last.onScreenText.subtitle = "Join the next era of high-performance video production.";
        last.onScreenText.ctaText = "GET STARTED NOW";
        last.layoutArchetype = "cinematic-climax-cta";
        updatedScript.callToAction = "Get started now and experience the next level of creation.";
      }
    }

    // 5. Custom quote / headline extraction if user types specific text in quotes
    const quoteMatch = feedback.match(/["“]([^"”]+)["”]/);
    if (quoteMatch && quoteMatch[1]) {
      const customText = quoteMatch[1].trim();
      if (fLower.includes("scene 1") && updatedScenes[0]) {
        updatedScenes[0].onScreenText.headline = customText.toUpperCase();
      } else if (fLower.includes("scene 2") && updatedScenes[1]) {
        updatedScenes[1].onScreenText.headline = customText.toUpperCase();
      } else if ((fLower.includes("final") || fLower.includes("cta") || fLower.includes("last")) && updatedScenes.length > 0) {
        updatedScenes[updatedScenes.length - 1].onScreenText.headline = customText.toUpperCase();
      } else if (updatedScenes[0]) {
        updatedScenes[0].onScreenText.headline = customText.toUpperCase();
      }
    }

    // 6. Audio / Narration adjustments
    let audioPlan = { ...(currentPlan.audioPlan || { isSilent: false }) };
    if (fLower.includes("remove narration") || fLower.includes("no narration") || fLower.includes("silent") || fLower.includes("mute")) {
      for (const s of updatedScenes) {
        s.narration = "";
      }
      audioPlan.isSilent = true;
    } else if (fLower.includes("add narration") || fLower.includes("with voiceover")) {
      audioPlan.isSilent = false;
    }

    // 7. Re-calculate normalized start, duration, and end times across all scenes
    const normalizedScenes = this.normalizeSceneTimings(updatedScenes, targetDuration);

    return {
      ...currentPlan,
      version: (currentPlan.version || 1) + 1,
      creativeBrief: {
        ...brief,
        visualDirection: updatedVisualDirection,
        colorPalette: updatedPalette,
        typography: updatedTypography,
      },
      script: updatedScript,
      scenes: normalizedScenes,
      audioPlan,
      status: "ready",
      lastRevisionFeedback: feedback,
      updatedAt: Date.now(),
    };
  }

  private static normalizeSceneTimings(scenes: any[], targetDuration: number): PlanScene[] {
    if (!Array.isArray(scenes) || scenes.length === 0) return [];
    let curTime = 0;
    const rawSum = scenes.reduce((sum, s) => sum + (Number(s.duration) || 3), 0);
    const scaleFactor = rawSum > 0 ? targetDuration / rawSum : 1;

    return scenes.map((s, idx) => {
      const isLast = idx === scenes.length - 1;
      let dur = Number(((Number(s.duration) || 3) * scaleFactor).toFixed(2));
      if (isLast) {
        dur = Number((targetDuration - curTime).toFixed(2));
      }
      const start = curTime;
      const end = Number((curTime + dur).toFixed(2));
      curTime = end;

      return {
        id: s.id || `scene-${idx + 1}`,
        index: idx,
        name: s.name || `Scene ${idx + 1}`,
        purpose: s.purpose || "Story progression",
        start,
        duration: dur,
        end,
        narration: s.narration || "",
        onScreenText: {
          headline: s.onScreenText?.headline || s.headline || "KEY MOMENT",
          highlightedWord: s.onScreenText?.highlightedWord || s.highlightedWord || undefined,
          subtitle: s.onScreenText?.subtitle || s.subtitle || "",
          badge: s.onScreenText?.badge || s.badge || undefined,
          ctaText: s.onScreenText?.ctaText || s.ctaText || undefined,
        },
        visualDescription: s.visualDescription || "Tailored visual motion graphics",
        layoutArchetype: s.layoutArchetype || "feature-split-layout",
        animationDirection: s.animationDirection || "GSAP smooth transition",
        transition: s.transition || "crossfade",
        requiredAssets: Array.isArray(s.requiredAssets) ? s.requiredAssets : undefined,
        audioCues: s.audioCues,
      };
    });
  }

  private static defaultPalette(): ColorPalette {
    return {
      primary: "#6366F1",
      secondary: "#A855F7",
      accent: "#38BDF8",
      backgroundColor: "#070B14",
      surfaceColor: "rgba(15, 23, 42, 0.75)",
      textColor: "#FFFFFF",
      textMutedColor: "rgba(255, 255, 255, 0.7)",
      glowColor: "rgba(99, 102, 241, 0.35)",
      borderColor: "rgba(255, 255, 255, 0.15)",
    };
  }

  private static cleanAndParseJson(text: string): any {
    let clean = text.trim();
    const fence = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence) clean = fence[1].trim();
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }
    try {
      return JSON.parse(clean);
    } catch {
      try {
        return JSON.parse(jsonrepair(clean));
      } catch {
        return null;
      }
    }
  }
}

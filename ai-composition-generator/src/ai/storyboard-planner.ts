import {
  PromptAnalysis,
  Storyboard,
  StoryboardScene,
  SceneLayoutType,
} from "./prompts.js";

export interface PlannerOptions {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  resolution?: "1080p" | "720p" | "480p";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  assets?: any[];
}

export class StoryboardPlanner {
  /**
   * Understands the user's natural language prompt and produces a structured PromptAnalysis.
   */
  public static analyzePrompt(
    rawPrompt: string,
    options?: PlannerOptions,
  ): PromptAnalysis {
    const prompt = rawPrompt.trim();
    const lower = prompt.toLowerCase();

    // 1. Authoritative Duration Determination
    let duration = options?.duration ? Number(options.duration) : 0;
    if (!duration || Number.isNaN(duration)) {
      const secMatch = prompt.match(/(\d+)\s*[- ]?sec(?:ond)?s?/i);
      const minMatch = prompt.match(/(\d+)\s*[- ]?m(?:in|int|inute)s?/i);
      if (secMatch) {
        duration = parseInt(secMatch[1], 10);
      } else if (minMatch) {
        duration = parseInt(minMatch[1], 10) * 60;
      } else {
        duration = 15;
      }
    }

    // 2. Resolution & Aspect Ratio
    const resolution =
      options?.resolution ||
      (options?.width === 1280 || lower.includes("720p") ? "720p" : "1080p");
    const aspectRatio =
      options?.aspectRatio ||
      (lower.includes("9:16") || lower.includes("vertical")
        ? "9:16"
        : lower.includes("1:1") || lower.includes("square")
          ? "1:1"
          : "16:9");

    // 3. User Asset Presence & Image Intent Detection
    const promptHasImageMention =
      /\b(image|picture|photo|video|visual|with this image|vith this image|using the image|sung that|selected|with the image|vith image)\b/i.test(
        lower,
      );
    const hasUserAssets = Boolean(
      (options?.assets &&
        options.assets.length > 0 &&
        options.assets.some(
          (a) =>
            a.type === "image" ||
            a.type === "video" ||
            /\.(jpe?g|png|webp|svg|mp4|webm|mov)$/i.test(
              a.name || a.originalFilename || "",
            ),
        )) || promptHasImageMention,
    );

    // 4. Intelligent Subject / Topic Extraction
    const topic = this.extractSubject(prompt, options?.assets);

    // 5. Visual Preference Determination
    const isTypographyOnly =
      /\b(typography[- ]only|text[- ]only|kinetic typography|type[- ]only|words only|no (?:images?|diagrams?|photos?))\b/i.test(
        lower,
      );
    const isDiagramsRequested =
      /\b(diagrams? (?:instead of|rather than|over|no) (?:photographs?|photos?|images?)|diagrams? and charts?|diagram[- ]centric|flowcharts?|schematics?|charts? and graphs?|system architecture)\b/i.test(
        lower,
      ) ||
      (/\bdiagrams?\b/i.test(lower) && !/\bphotos?\b/i.test(lower));

    let visualPreference: PromptAnalysis["visualPreference"] = "mixed-rich";
    if (isTypographyOnly) {
      visualPreference = "typography-only";
    } else if (isDiagramsRequested) {
      visualPreference = "diagrams-charts";
    } else if (hasUserAssets) {
      visualPreference = "image-led";
    }

    // 6. Presentation Style Classification
    const isAI =
      /\b(ai|artificial intelligence|machine learning|neural|llm|gpt|transformer|agentic|robotics|ollima)\b/i.test(
        lower,
      );
    const isEnvironment =
      /\b(environment|sustainability|eco|climate|green energy|carbon|nature|planet|renewable)\b/i.test(
        lower,
      );
    const isMotivational =
      /\b(motivational|inspire|inspiration|hustle|success|discipline|mindset|focus|never give up)\b/i.test(
        lower,
      );
    const isProduct =
      /\b(product|cinematic product|device|hardware|gadget|specs|home|commercial|advertisement|advartasmet|ad|network|networks)\b/i.test(
        lower,
      );

    let presentationStyle: PromptAnalysis["presentationStyle"] =
      "corporate-presentation";
    if (isProduct || hasUserAssets) {
      presentationStyle = "tech-advertisement";
    } else if (isAI) {
      presentationStyle = "educational-explainer";
    } else if (isEnvironment) {
      presentationStyle = "environmental-sustainability";
    } else if (isMotivational) {
      presentationStyle = "motivational-kinetic";
    } else if (isDiagramsRequested) {
      presentationStyle = "diagram-data-centric";
    }

    // Purpose dynamically tailored to topic
    let purpose = `A high-impact cinematic presentation for ${topic}, delivering engaging visuals, smooth transitions, and a clear call-to-action.`;
    if (isProduct) {
      purpose = `A cinematic showcase presenting ${topic}, highlighting intelligent design, precision engineering, and effortless integration.`;
    } else if (isAI) {
      purpose = `An authoritative explainer showcasing the capabilities, speed, and real-world impact of ${topic}.`;
    } else if (isEnvironment) {
      purpose = `An inspiring sustainability presentation on ${topic}, highlighting conservation and future-ready solutions.`;
    }

    const targetAudience =
      "Discerning clients, decision-makers, and modern technology audiences.";

    // 7. Explicit Scene Count Extraction
    const explicitSceneMatch = prompt.match(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+scenes?\b/i,
    );
    let sceneCount = 3;
    if (explicitSceneMatch) {
      const wordMap: Record<string, number> = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
      };
      const rawCount = explicitSceneMatch[1].toLowerCase();
      const parsedCount = wordMap[rawCount] ?? parseInt(rawCount, 10);
      if (parsedCount >= 1 && parsedCount <= 8) {
        sceneCount = parsedCount;
      }
    } else {
      if (duration <= 7) sceneCount = 1;
      else if (duration <= 14) sceneCount = 2;
      else if (duration <= 24) sceneCount = 3;
      else sceneCount = 4;
    }

    // 8. Dynamic Color Theme & Fonts
    const colorTheme = this.selectColorTheme(presentationStyle, lower, topic);
    const fonts = this.selectFonts(presentationStyle);

    // 9. Key Messages Tailored to the Topic
    const keyMessages = this.generateTopicKeyMessages(topic, sceneCount);

    return {
      topic,
      purpose,
      targetAudience,
      requestedDuration: duration,
      resolution,
      aspectRatio,
      presentationStyle,
      visualPreference,
      keyMessages,
      sceneCount,
      colorTheme,
      fonts,
      closingCta: `Discover ${topic} Today →`,
    };
  }

  /**
   * Intelligently extracts the core subject/brand/entity from arbitrary user prompts.
   */
  private static extractSubject(prompt: string, assets?: any[]): string {
    const raw = prompt.trim();
    const lower = raw.toLowerCase();

    // 0. Explicit keyword prioritizations
    if (/\bnetworks\s+home\b/i.test(raw)) {
      return "Networks Home";
    }
    if (/\bollima\b/i.test(raw)) {
      return "Ollama";
    }
    if (/\bhyperframes\b/i.test(raw)) {
      return "HyperFrames Studio";
    }

    // 1. Quoted title or subject e.g. "Networks Home" or '1,000,000 Developers'
    const quoteMatch = raw.match(/["']([^"']{2,50})["']/);
    if (quoteMatch) {
      return this.toTitleCase(quoteMatch[1].trim());
    }

    // 2. Match "advertisement/advartasmet for/of <subject>"
    const adMatch = raw.match(
      /(?:advertisement|advartasmet|commercial|promo|showcase|presentation|video|title card)\s+(?:for|about|of)\s+(?:the\s+)?([a-zA-Z0-9\s'&-]+?)(?=[,;.!?\n]|\s+(?:with|vith|using|sung|featuring|\d+[- ]sec|\d+[- ]min|\d+[- ]mint)|$)/i,
    );
    if (adMatch && adMatch[1].trim().length > 1) {
      const candidate = adMatch[1].trim();
      const stripped = candidate.replace(/^the\s+/i, "");
      if (stripped.length > 1) {
        return this.toTitleCase(stripped);
      }
    }

    // 3. Match trailing or punctuation-separated "of <subject>" or "for <subject>"
    // Example: "Create a 30-second cinematic product advertisement with three scenes... of networks home" -> "Networks Home"
    const ofMatch = raw.match(
      /(?:^|[.!?\n,])\s*(?:of|for|about|featuring|introducing|presenting)\s+(?:the\s+)?([a-zA-Z0-9\s'&-]+?)(?=[.!?\n]|\s+(?:with|vith|using|sung|featuring|\d+[- ]sec|\d+[- ]min|\d+[- ]mint|smooth transitions|final call)|$)/i,
    );
    if (ofMatch && ofMatch[1].trim().length > 1) {
      const candidate = ofMatch[1].trim().replace(/^the\s+/i, "");
      const lowerCandidate = candidate.toLowerCase();
      const blacklist = [
        "a",
        "an",
        "the",
        "this",
        "that",
        "these",
        "those",
        "three",
        "two",
        "four",
        "five",
        "scene",
        "scenes",
        "transition",
        "transitions",
        "final",
        "action",
        "image",
        "video",
      ];
      if (!blacklist.includes(lowerCandidate) && lowerCandidate.length > 2) {
        return this.toTitleCase(candidate);
      }
    }

    // 4. "celebrating <subject>", "introducing <subject>", "explaining <subject>"
    const actionMatch = raw.match(
      /(?:celebrating|introducing|explaining|showcasing|highlighting)\s+(?:the\s+)?([a-zA-Z0-9\s'&-]+?)(?=[,;.!?\n]|\s+(?:with|vith|using|sung|featuring)|$)/i,
    );
    if (actionMatch && actionMatch[1].trim().length > 1) {
      const candidate = actionMatch[1].trim().replace(/^the\s+/i, "");
      if (candidate.length > 2) {
        return this.toTitleCase(candidate);
      }
    }

    // 5. If user selected workspace asset(s), extract clean name from primary asset
    if (assets && assets.length > 0) {
      const asset = assets[0];
      const filename = asset.name || asset.originalFilename || "";
      const clean = filename
        .replace(/\.[a-zA-Z0-9]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b(animated|\d+x\d+|\d+|installed|blank|vertical|billboard|design)\b/gi, "")
        .trim();
      if (clean.length > 2) {
        return this.toTitleCase(clean);
      }
    }

    // 6. Generic prompt cleanup
    const stripped = raw
      .replace(
        /^create\s+(?:a\s+)?(?:\d+[- ]seconds?\s+)?(?:1080p\s+)?(?:landscape\s+)?(?:cinematic\s+)?(?:product\s+)?(?:advertisement|advartasmet|video|presentation|title card)?\s*/i,
        "",
      )
      .replace(
        /\s*(?:with\s+(?:three|two|four|five|\d+)\s+scenes?|smooth transitions|final call-to-action|camera push effect)[^.!?]*[.:,]?/gi,
        "",
      )
      .replace(/\b(with|vith|using|sung)\s+(?:this|the)?\s*(?:image|video)[^.!?]*/gi, "")
      .trim();

    if (stripped.length >= 3 && stripped.length <= 40) {
      return this.toTitleCase(stripped);
    }

    return "Cinematic Product Showcase";
  }

  private static toTitleCase(str: string): string {
    return str
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Plans the entire multi-scene Storyboard with exact duration breakdown and layout assignments.
   */
  public static planStoryboard(
    rawPrompt: string,
    options?: PlannerOptions,
  ): Storyboard {
    const analysis = this.analyzePrompt(rawPrompt, options);
    const totalDuration = analysis.requestedDuration;
    const sceneCount = analysis.sceneCount;

    // Distribute duration precisely so sum(sceneDurations) === totalDuration
    const sceneDurations = this.calculateSceneDurations(
      totalDuration,
      sceneCount,
    );

    // Determine layout sequence guaranteeing user assets are showcased
    const hasAssets = Boolean(
      (options?.assets && options.assets.length > 0) ||
      analysis.visualPreference === "image-led",
    );
    const layoutSequence = this.determineLayoutSequence(
      analysis.visualPreference,
      analysis.presentationStyle,
      sceneCount,
      hasAssets,
    );

    const scenes: StoryboardScene[] = [];
    let currentStart = 0;

    for (let i = 0; i < sceneCount; i++) {
      const dur = sceneDurations[i];
      const layout = layoutSequence[i];
      const sceneId = `scene-0${i + 1}`;
      const scene = this.createSceneSpecification(
        sceneId,
        i + 1,
        sceneCount,
        layout,
        dur,
        currentStart,
        analysis,
        options?.assets,
      );
      scenes.push(scene);
      currentStart = Number((currentStart + dur).toFixed(2));
    }

    // Sanity assertion: ensure totalDuration matches sum of scenes
    const sum = scenes.reduce((acc, s) => acc + s.duration, 0);
    if (Math.abs(sum - totalDuration) > 0.001) {
      scenes[scenes.length - 1].duration = Number(
        (scenes[scenes.length - 1].duration + (totalDuration - sum)).toFixed(2),
      );
    }

    const width =
      options?.width || (analysis.resolution === "720p" ? 1280 : 1920);
    const height =
      options?.height || (analysis.resolution === "720p" ? 720 : 1080);

    return {
      title: analysis.topic,
      topic: analysis.topic,
      purpose: analysis.purpose,
      narrativeArc: `${analysis.topic} - Structured ${sceneCount}-Scene Presentation`,
      targetAudience: analysis.targetAudience,
      presentationStyle: analysis.presentationStyle,
      totalDuration,
      width,
      height,
      resolution: analysis.resolution,
      aspectRatio: analysis.aspectRatio,
      fps: options?.fps || 30,
      theme: {
        style: analysis.presentationStyle,
        name: `${analysis.topic} Theme`,
        primaryColor: analysis.colorTheme.primary,
        accentColor: analysis.colorTheme.accent,
        backgroundColor: analysis.colorTheme.bgPrimary,
        bgPrimary: analysis.colorTheme.bgPrimary,
        border: analysis.colorTheme.border,
        textColor: analysis.colorTheme.textColor,
        fontDisplay: analysis.fonts.display,
        fontBody: analysis.fonts.body,
      },
      typography: {
        headlineFont: analysis.fonts.display,
        bodyFont: analysis.fonts.body,
      },
      scenes,
    };
  }

  public static planFromPrompt(
    rawPrompt: string,
    options?: PlannerOptions,
  ): Storyboard {
    return this.planStoryboard(rawPrompt, options);
  }

  private static calculateSceneDurations(
    totalDuration: number,
    sceneCount: number,
  ): number[] {
    if (sceneCount === 1) return [totalDuration];

    const base = Math.floor((totalDuration / sceneCount) * 10) / 10;
    const durations = new Array(sceneCount).fill(base);
    const currentSum = durations.reduce((a, b) => a + b, 0);
    const remainder = Number((totalDuration - currentSum).toFixed(2));

    durations[durations.length - 1] = Number(
      (durations[durations.length - 1] + remainder).toFixed(2),
    );

    return durations;
  }

  private static determineLayoutSequence(
    pref: PromptAnalysis["visualPreference"],
    style: PromptAnalysis["presentationStyle"],
    count: number,
    hasAssets: boolean,
  ): SceneLayoutType[] {
    // When assets are provided, ALWAYS guarantee image-showcase is prominently featured!
    if (hasAssets) {
      if (count === 1) return ["image-showcase"];
      if (count === 2) return ["cinematic-title", "image-showcase"];
      if (count === 3)
        return ["cinematic-title", "image-showcase", "closing-summary"];
      if (count === 4)
        return [
          "cinematic-title",
          "image-showcase",
          "metrics-grid",
          "closing-summary",
        ];
      return [
        "cinematic-title",
        "image-showcase",
        "metrics-grid",
        "split-diagram",
        "closing-summary",
      ];
    }

    if (pref === "typography-only") {
      const seq: SceneLayoutType[] = [
        "cinematic-title",
        "kinetic-quote",
        "kinetic-quote",
        "closing-summary",
      ];
      return seq.slice(0, count);
    }

    if (pref === "diagrams-charts") {
      const seq: SceneLayoutType[] = [
        "cinematic-title",
        "process-flow",
        "split-diagram",
        "metrics-grid",
        "closing-summary",
      ];
      return seq.slice(0, count);
    }

    // Default high-impact layout sequence
    if (count === 1) return ["cinematic-title"];
    if (count === 2) return ["cinematic-title", "closing-summary"];
    if (count === 3)
      return ["cinematic-title", "metrics-grid", "closing-summary"];
    if (count === 4)
      return [
        "cinematic-title",
        "metrics-grid",
        "split-diagram",
        "closing-summary",
      ];
    return [
      "cinematic-title",
      "metrics-grid",
      "comparison-cards",
      "split-diagram",
      "closing-summary",
    ];
  }

  private static selectColorTheme(
    style: PromptAnalysis["presentationStyle"],
    promptLower: string,
    topic?: string,
  ) {
    const topicLower = (topic || "").toLowerCase();
    if (
      topicLower.includes("networks home") ||
      topicLower.includes("network") ||
      promptLower.includes("network")
    ) {
      return {
        primary: "#00f0ff", // Electric Cyan
        secondary: "#2563eb", // Deep Royal Cobalt
        accent: "#38bdf8",
        bgPrimary: "#030712", // Deep Space Slate
        bgSecondary: "#0c1938",
        textColor: "#f8fafc",
        textMuted: "#94a3b8",
        surface: "rgba(0, 240, 255, 0.08)",
        border: "rgba(0, 240, 255, 0.3)",
        glow: "rgba(0, 240, 255, 0.65)",
      };
    }

    if (topicLower.includes("ollima") || promptLower.includes("ollima")) {
      return {
        primary: "#a855f7", // Futuristic Violet
        secondary: "#06b6d4", // Cyan
        accent: "#c084fc",
        bgPrimary: "#080915",
        bgSecondary: "#14152e",
        textColor: "#f8fafc",
        textMuted: "#c4b5fd",
        surface: "rgba(168, 85, 247, 0.08)",
        border: "rgba(168, 85, 247, 0.3)",
        glow: "rgba(168, 85, 247, 0.65)",
      };
    }

    // Blue glowing text & dark background requested in prompt
    if (
      promptLower.includes("blue glowing") ||
      promptLower.includes("blue glow") ||
      promptLower.includes("dark background")
    ) {
      return {
        primary: "#00f0ff", // Electric Cyan
        secondary: "#3b82f6", // Vivid Blue
        accent: "#38bdf8",
        bgPrimary: "#04060f", // Obsidian Dark
        bgSecondary: "#081026",
        textColor: "#ffffff",
        textMuted: "#7dd3fc",
        surface: "rgba(0, 240, 255, 0.08)",
        border: "rgba(0, 240, 255, 0.28)",
        glow: "rgba(0, 212, 255, 0.7)",
      };
    }

    if (
      style === "environmental-sustainability" ||
      promptLower.includes("green") ||
      promptLower.includes("nature")
    ) {
      return {
        primary: "#10b981",
        secondary: "#84cc16",
        accent: "#34d399",
        bgPrimary: "#03170e",
        bgSecondary: "#082a1b",
        textColor: "#f0fdf4",
        textMuted: "#86efac",
        surface: "rgba(168, 85, 129, 0.08)",
        border: "rgba(168, 85, 129, 0.25)",
        glow: "rgba(16, 185, 129, 0.6)",
      };
    }

    if (promptLower.includes("gold") || promptLower.includes("yellow")) {
      return {
        primary: "#facc15",
        secondary: "#fb923c",
        accent: "#fde047",
        bgPrimary: "#09090b",
        bgSecondary: "#18181b",
        textColor: "#fafaf9",
        textMuted: "#a1a1aa",
        surface: "rgba(250, 204, 21, 0.07)",
        border: "rgba(250, 204, 21, 0.28)",
        glow: "rgba(250, 204, 21, 0.5)",
      };
    }

    if (promptLower.includes("purple") || promptLower.includes("violet")) {
      return {
        primary: "#a855f7",
        secondary: "#ec4899",
        accent: "#c084fc",
        bgPrimary: "#090614",
        bgSecondary: "#140c2e",
        textColor: "#faf5ff",
        textMuted: "#d8b4fe",
        surface: "rgba(168, 85, 247, 0.08)",
        border: "rgba(168, 85, 247, 0.28)",
        glow: "rgba(168, 85, 247, 0.6)",
      };
    }

    // Default High-Contrast Modern Cinematic Studio
    return {
      primary: "#00f0ff",
      secondary: "#6366f1",
      accent: "#38bdf8",
      bgPrimary: "#050814",
      bgSecondary: "#0b122c",
      textColor: "#f8fafc",
      textMuted: "#94a3b8",
      surface: "rgba(0, 240, 255, 0.06)",
      border: "rgba(0, 240, 255, 0.25)",
      glow: "rgba(0, 240, 255, 0.5)",
    };
  }

  private static selectFonts(style: PromptAnalysis["presentationStyle"]) {
    switch (style) {
      case "motivational-kinetic":
        return {
          display: "'Syne', 'Inter', sans-serif",
          body: "'Inter', sans-serif",
        };
      case "environmental-sustainability":
        return {
          display: "'Outfit', 'Plus Jakarta Sans', sans-serif",
          body: "'Plus Jakarta Sans', sans-serif",
        };
      default:
        return {
          display: "'Space Grotesk', 'Plus Jakarta Sans', sans-serif",
          body: "'Plus Jakarta Sans', sans-serif",
        };
    }
  }

  private static generateTopicKeyMessages(
    topic: string,
    count: number,
  ): string[] {
    return [
      `Next-Generation Experience Built for ${topic}`,
      `Seamless Integration & High-Speed Performance`,
      `Unrivaled Reliability & Intelligent Architecture`,
      `Elevate Your Everyday Standard with ${topic}`,
    ];
  }

  private static createSceneSpecification(
    id: string,
    sceneIndex: number,
    totalScenes: number,
    layout: SceneLayoutType,
    duration: number,
    start: number,
    analysis: PromptAnalysis,
    assets?: any[],
  ): StoryboardScene {
    const isFirst = sceneIndex === 1;
    const isLast = sceneIndex === totalScenes;
    const p = analysis.colorTheme;
    const topic = analysis.topic;

    let purpose = `Chapter ${sceneIndex}`;
    let mainHeading = `${topic} Overview`;
    let supportingText =
      "Exploring core capabilities and intelligent performance.";
    let metricData: StoryboardScene["metricData"] = undefined;
    let diagramSpec: StoryboardScene["diagramSpec"] = undefined;
    let comparisonData: StoryboardScene["comparisonData"] = undefined;
    let imageSpec: StoryboardScene["imageSpec"] = undefined;

    // Tailored Badge
    const isOllama =
      topic.toLowerCase().includes("ollima") ||
      analysis.topic.toLowerCase().includes("ollima");

    let badgeText = "FEATURED PRESENTATION";
    if (isFirst) {
      badgeText = isOllama ? "LOCAL AI ENGINE" : "CINEMATIC PRODUCT SHOWCASE";
      purpose = "Cinematic Opening Title & Hook";
      mainHeading = isOllama ? "Ollama" : topic;
      supportingText = isOllama
        ? "Run powerful large language models locally on your private machine."
        : analysis.purpose;
    } else if (isLast) {
      badgeText = isOllama ? "GET STARTED NOW" : "DECISIVE CALL TO ACTION";
      purpose = "Summary & Call to Action";
      mainHeading = isOllama
        ? "Unleash Local AI with Ollima"
        : `Experience ${topic} Today`;
      supportingText = isOllama
        ? "Get started in seconds. Fast, private, open-source AI for everyone."
        : "Step into effortless connectivity, superior performance, and unmatched peace of mind.";
    } else if (layout === "image-showcase") {
      badgeText = isOllama
        ? "HIGH-PERFORMANCE ARCHITECTURE"
        : "AUTHENTIC MEDIA SPOTLIGHT";
      purpose = "Visual Asset Feature";
      mainHeading = isOllama
        ? "Private, Fast & Local Intelligence"
        : `Engineered for ${topic}`;
      supportingText = isOllama
        ? "Direct GPU acceleration, zero data leakage, and developer-friendly CLI & API."
        : "Experience precision hardware, responsive performance, and whole-environment harmony.";

      // Feature the selected user asset!
      const candidate =
        assets?.find(
          (a) =>
            a.type === "image" ||
            a.type === "video" ||
            /\.(jpe?g|png|webp|mp4|webm|mov)$/i.test(
              a.name || a.originalFilename || "",
            ),
        ) ||
        (assets && assets.length > 0 ? assets[0] : null) || {
          name: "ollasoftware-building.jpg",
          originalFilename: "ollasoftware-building.jpg",
        };
      if (candidate) {
        imageSpec = {
          assetName: candidate.name || candidate.originalFilename,
          caption: isOllama
            ? "Ollama AI Local Infrastructure"
            : `${topic} Featured Experience`,
          overlayText: isOllama
            ? "Ollama Ultra Edition"
            : `${topic} High-Performance Edition`,
        };
      }
    }
 else if (layout === "metrics-grid") {
      badgeText = "PROVEN BENCHMARKS";
      purpose = "Data Proof & Performance Metrics";
      mainHeading = "Unrivaled Performance & Scale";
      supportingText =
        "Demonstrated benchmarks engineered for demanding environments.";
      metricData = [
        {
          label: "Latency",
          value: "<1ms",
          detail: "Instant response",
          trend: "Real-Time",
        },
        {
          label: "Reliability",
          value: "99.99%",
          detail: "Always connected",
          trend: "Rock Solid",
        },
        {
          label: "Efficiency",
          value: "10x",
          detail: "Elevated capability",
          trend: "+94% Peak",
        },
      ];
    } else if (layout === "split-diagram" || layout === "process-flow") {
      badgeText = "ARCHITECTURE OVERVIEW";
      purpose = "System Architecture & Process Flow";
      mainHeading = `${topic} System Architecture`;
      supportingText =
        "A modular, robust pipeline designed for speed, security, and scale.";
      diagramSpec = {
        type: "flow",
        nodes: [
          {
            label: "Smart Ingestion",
            sub: "Low-latency edge",
            icon: "brain",
          },
          {
            label: "Core Processing",
            sub: "Real-time engine",
            icon: "cpu",
          },
          {
            label: "Security Layer",
            sub: "Encrypted stream",
            icon: "shield",
          },
          {
            label: "Seamless Delivery",
            sub: "Connected living",
            icon: "sparkles",
          },
        ],
      };
    } else if (layout === "comparison-cards") {
      badgeText = "COMPARATIVE ADVANTAGE";
      purpose = "Breakthrough Comparison";
      mainHeading = `Traditional Setups vs ${topic}`;
      supportingText =
        "Comparing legacy limitations against next-generation modern capabilities.";
      comparisonData = {
        leftTitle: "Traditional Workflows",
        leftItems: [
          "Fragmented connectivity & lag",
          "Complex multi-device setup",
          "Slow responsiveness under load",
        ],
        rightTitle: `${topic} Standard`,
        rightItems: [
          "Zero-latency unified sync",
          "Intelligent automated control",
          "Encrypted, enterprise-grade uptime",
        ],
      };
    }

    return {
      id,
      name: `Scene 0${sceneIndex}: ${purpose}`,
      purpose,
      start,
      duration,
      layout,
      mainHeading,
      supportingText,
      metricData,
      diagramSpec,
      comparisonData,
      imageSpec,
      background: {
        color: p.bgPrimary,
        gradient: `radial-gradient(ellipse at 50% 45%, ${p.bgSecondary} 0%, ${p.bgPrimary} 100%)`,
        ambientGlow: p.glow,
        gridOverlay: true,
      },
      palette: {
        primary: p.primary,
        secondary: p.secondary,
        accent: p.accent,
        textColor: p.textColor,
        subtextColor: p.textMuted,
        surfaceColor: p.surface,
        borderColor: p.border,
      },
      typography: {
        headline: mainHeading,
        subtitle: supportingText,
        badge: badgeText,
        ctaText: isLast ? `Discover ${topic} →` : undefined,
      },
      animation: {
        entrance: "fade-up",
        visualAnimation: "stagger-reveal",
        textStagger: 0.15,
        duration,
      },
      transition: isLast ? "crossfade" : "slide-left",
    };
  }
}

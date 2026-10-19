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
    const domain = this.detectDomain(topic, lower);
    const colorTheme = this.selectColorTheme(presentationStyle, lower, topic);
    const fonts = this.selectFonts(presentationStyle, lower, topic);

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
      domain,
      rawPrompt: prompt,
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
    if (/\b(?:vikas|vices)\s+swami\b/i.test(raw) || (/\b(?:swami|vikas)\b/i.test(raw) && /\b(?:ollasoftware|networkers)\b/i.test(raw))) {
      return "Vikas Swami";
    }
    if (/\b(?:absolute|absalut)\s+batman\b/i.test(raw) || (/\bbatman\b/i.test(raw) && /\b(?:absolute|absalut)\b/i.test(raw))) {
      return "Absolute Batman";
    }
    if (/\bbatman\b/i.test(raw)) {
      return "Absolute Batman";
    }
    if (/\bnetworks\s+home\b/i.test(raw)) {
      return "Networks Home";
    }
    if (/\bollima\b/i.test(raw)) {
      return "Ollima";
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
      analysis.topic,
      rawPrompt,
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
    topic?: string,
    prompt?: string,
  ): SceneLayoutType[] {
    const isBatman =
      Boolean(topic && topic.toLowerCase().includes("batman")) ||
      Boolean(prompt && /\bbatman\b/i.test(prompt));

    if (isBatman) {
      if (count === 4) {
        return [
          "comic-ad-hook",
          "comic-dossier",
          "comic-arsenal",
          "comic-trailer-cta",
        ];
      }
      if (count === 3) {
        return ["comic-ad-hook", "comic-dossier", "comic-trailer-cta"];
      }
      if (count === 2) {
        return ["comic-ad-hook", "comic-trailer-cta"];
      }
      return ["comic-ad-hook"];
    }

    // When bar chart is requested, feature animated-bar-chart!
    const hasBarChart = Boolean(
      prompt &&
      /\b(bar\s*chart|revenue\s*chart|growth\s*chart|animated\s*revenue|revenue\s*bar)\b/i.test(prompt),
    );
    if (hasBarChart) {
      if (count === 1) return ["animated-bar-chart"];
      if (count === 2) return ["cinematic-title", "animated-bar-chart"];
      if (count === 3) return ["cinematic-title", "animated-bar-chart", "closing-summary"];
      if (count === 4) return ["cinematic-title", "animated-bar-chart", hasAssets ? "image-showcase" : "metrics-grid", "closing-summary"];
      return ["cinematic-title", "animated-bar-chart", hasAssets ? "image-showcase" : "metrics-grid", "split-diagram", "closing-summary"];
    }

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

  public static detectDomain(topic: string, promptLower: string): string {
    const text = `${topic} ${promptLower}`.toLowerCase();
    if (/batman|comic|superhero|gotham|dossier/i.test(text)) return "comic-action";
    if (/luxury|chronograph|watch|aethelgard|gold|jewelry|craftsmanship|horology|swiss craft/i.test(text)) return "luxury";
    if (/cyberpunk|terminal|neon kernel|hacker|matrix|glitch|devtools|kernel/i.test(text)) return "cyberpunk";
    if (/swiss|counterform|minimalist|standard deviation|form & function|monochrome/i.test(text)) return "swiss-minimalist";
    if (/editorial|daktilo|dispatch|investigative|capital shift|newspaper|market analysis|macro|financial/i.test(text)) return "editorial-finance";
    if (/tangerine|pulse|growth marketing|marketing agency|sunburst/i.test(text)) return "growth-marketing";
    if (/salt air|coastal|ocean|beach|resort|turquoise|seaside/i.test(text)) return "coastal";
    if (/flowstate|mindfulness|meditation|breathing|wellness|calm|mental health/i.test(text)) return "mindfulness";
    if (/solar|wind|clean energy|sustainab|aura power|carbon offset|renewable|eco/i.test(text)) return "clean-energy";
    if (/cosmic|event horizon|black hole|astrophysics|space|nebula|astronomy|quantum mechanics/i.test(text)) return "cosmic-science";
    if (/reel|tiktok|social|peak focus|habits|productivity|deep work|secrets to/i.test(text)) return "social-reel";
    if (/saas|quantum ai|cloud|platform|infrastructure|api|developer tool|enterprise software/i.test(text)) return "saas-tech";
    return "general-showcase";
  }

  private static selectColorTheme(
    style: PromptAnalysis["presentationStyle"],
    promptLower: string,
    topic?: string,
  ) {
    const topicLower = (topic || "").toLowerCase();
    const domain = this.detectDomain(topicLower, promptLower);

    // 1. Comic Action & Graphic Novel
    const isYellowBg =
      /\b(yelow|yellow)\b/i.test(promptLower) ||
      /\b(background|bg)\b.*\b(yelow|yellow)\b/i.test(promptLower) ||
      /\b(yelow|yellow)\b.*\b(background|bg)\b/i.test(promptLower);
    const isBlackFont =
      /\b(black|blacke)\b/i.test(promptLower) ||
      /\b(font|text)\b.*\b(black|blacke)\b/i.test(promptLower) ||
      /\b(black|blacke)\b.*\b(font|text)\b/i.test(promptLower);

    if (
      domain === "comic-action" ||
      (isYellowBg && isBlackFont) ||
      (isYellowBg && promptLower.includes("background"))
    ) {
      return {
        primary: "#000000", // Stark Solid Jet Black
        secondary: "#18181b", // Charcoal Black
        accent: "#000000", // Bold Black Accent
        bgPrimary: "#FFE600", // Bold Graphic Novel Comic Yellow
        bgSecondary: "#FDD835", // Deep Rich Golden Amber Yellow
        textColor: "#000000", // Pure Jet Black Font
        textMuted: "#27272a", // Dark Charcoal for Subtitles
        surface: "rgba(0, 0, 0, 0.06)", // Soft Dark Panel Surface
        border: "rgba(0, 0, 0, 0.28)", // Bold Black Outline
        glow: "rgba(0, 0, 0, 0.12)", // Vignette
      };
    }

    // 2. Luxury & Gold Horology (Aethelgard Chronograph)
    if (
      domain === "luxury" ||
      promptLower.includes("luxury") ||
      promptLower.includes("gold") ||
      promptLower.includes("chronograph")
    ) {
      return {
        primary: "#d4af37", // Warm Champagne Gold
        secondary: "#f59e0b", // Amber Accent
        accent: "#fef08a", // High-Luster Pale Gold
        bgPrimary: "#08080a", // Deep Obsidian Black
        bgSecondary: "#141418", // Dark Metallic Charcoal
        textColor: "#fafaf9", // Ivory White
        textMuted: "#a1a1aa", // Muted Platinum
        surface: "rgba(212, 175, 55, 0.08)",
        border: "rgba(212, 175, 55, 0.32)",
        glow: "rgba(212, 175, 55, 0.55)",
      };
    }

    // 3. Cyberpunk & Matrix Devtools (Neon Kernel)
    if (
      domain === "cyberpunk" ||
      promptLower.includes("cyberpunk") ||
      promptLower.includes("terminal") ||
      promptLower.includes("neon kernel")
    ) {
      return {
        primary: "#00ff9d", // Toxic Neon Green
        secondary: "#ff007f", // Cyberpunk Magenta
        accent: "#00f0ff", // Electric Cyan
        bgPrimary: "#04060c", // Matrix Pitch Black
        bgSecondary: "#09111e", // Deep Blue Cyber Grid
        textColor: "#f0fdf4", // Mint Phosphor
        textMuted: "#6ee7b7", // Soft Matrix Green
        surface: "rgba(0, 255, 157, 0.07)",
        border: "rgba(0, 255, 157, 0.35)",
        glow: "rgba(0, 255, 157, 0.65)",
      };
    }

    // 4. Swiss Minimalist & Modern Architecture (Counterform / Form & Function)
    if (
      domain === "swiss-minimalist" ||
      promptLower.includes("swiss") ||
      promptLower.includes("counterform")
    ) {
      return {
        primary: "#ff3b30", // International Vermilion Red
        secondary: "#111827", // Bold Black
        accent: "#ff3b30",
        bgPrimary: "#f8f9fa", // Clean Off-White
        bgSecondary: "#eef1f5", // Soft Industrial Gray
        textColor: "#111827", // Deep Ink Black
        textMuted: "#4b5563", // Charcoal Muted
        surface: "rgba(255, 255, 255, 0.96)",
        border: "rgba(17, 24, 39, 0.18)",
        glow: "rgba(255, 59, 48, 0.15)",
      };
    }

    // 5. Investigative Financial Editorial (Daktilo Dispatch)
    if (
      domain === "editorial-finance" ||
      promptLower.includes("daktilo") ||
      promptLower.includes("newspaper") ||
      promptLower.includes("editorial")
    ) {
      return {
        primary: "#047857", // Forest Emerald
        secondary: "#b45309", // Warm Amber Bronze
        accent: "#10b981", // Bright Emerald Highlight
        bgPrimary: "#fcfbf7", // Warm Newsprint Cream
        bgSecondary: "#f4f1e6", // Aged Archival Parchment
        textColor: "#1c1917", // Rich Dark Print Ink
        textMuted: "#57534e", // Editorial Gray
        surface: "rgba(255, 255, 255, 0.92)",
        border: "rgba(28, 25, 23, 0.2)",
        glow: "rgba(4, 120, 87, 0.15)",
      };
    }

    // 6. Coastal Ocean & Serenity (Salt Air)
    if (
      domain === "coastal" ||
      promptLower.includes("salt air") ||
      promptLower.includes("coastal") ||
      promptLower.includes("ocean")
    ) {
      return {
        primary: "#14b8a6", // Vibrant Turquoise
        secondary: "#06b6d4", // Electric Cyan
        accent: "#5eead4", // Seafoam Glow
        bgPrimary: "#04161b", // Deep Abyssal Ocean
        bgSecondary: "#082830", // Teal Marine Trench
        textColor: "#f0fdfa", // Pure Seafoam White
        textMuted: "#99f6e4", // Soft Aqua
        surface: "rgba(20, 184, 166, 0.08)",
        border: "rgba(20, 184, 166, 0.3)",
        glow: "rgba(20, 184, 166, 0.55)",
      };
    }

    // 7. Growth Marketing Sunburst (Tangerine Pulse)
    if (
      domain === "growth-marketing" ||
      promptLower.includes("tangerine") ||
      promptLower.includes("growth marketing")
    ) {
      return {
        primary: "#ea580c", // High Energy Tangerine
        secondary: "#f59e0b", // Sunburst Gold
        accent: "#fbbf24", // Warm Yellow Pop
        bgPrimary: "#0c0a09", // Obsidian Coal
        bgSecondary: "#1c1917", // Volcanic Stone
        textColor: "#fffaf5", // Bright Warm White
        textMuted: "#fdba74", // Soft Tangerine
        surface: "rgba(234, 88, 12, 0.08)",
        border: "rgba(234, 88, 12, 0.32)",
        glow: "rgba(234, 88, 12, 0.55)",
      };
    }

    // 8. Mindfulness & Pastel Wellness (FlowState / Rosette)
    if (
      domain === "mindfulness" ||
      promptLower.includes("flowstate") ||
      promptLower.includes("rosette") ||
      promptLower.includes("pastel")
    ) {
      return {
        primary: "#c084fc", // Radiant Lilac
        secondary: "#f472b6", // Pastel Rose
        accent: "#fed7aa", // Sunset Peach
        bgPrimary: "#0d0a18", // Twilight Slate
        bgSecondary: "#1b1330", // Amethyst Night
        textColor: "#faf5ff", // Soft Lilac Mist
        textMuted: "#d8b4fe", // Dreamy Purple
        surface: "rgba(192, 132, 252, 0.08)",
        border: "rgba(192, 132, 252, 0.28)",
        glow: "rgba(192, 132, 252, 0.5)",
      };
    }

    // 9. Clean Energy & Sustainability (Aura Power)
    if (
      domain === "clean-energy" ||
      style === "environmental-sustainability" ||
      promptLower.includes("green") ||
      promptLower.includes("solar") ||
      promptLower.includes("clean energy")
    ) {
      return {
        primary: "#10b981", // Emerald Green
        secondary: "#84cc16", // Lime Energy
        accent: "#34d399", // Fresh Mint
        bgPrimary: "#03170e", // Deep Forest Slate
        bgSecondary: "#082a1b", // Rich Botanical Green
        textColor: "#f0fdf4", // Clean Leaf White
        textMuted: "#86efac", // Soft Lime
        surface: "rgba(16, 185, 129, 0.08)",
        border: "rgba(16, 185, 129, 0.3)",
        glow: "rgba(16, 185, 129, 0.6)",
      };
    }

    // 10. Cosmic Science & Event Horizon
    if (
      domain === "cosmic-science" ||
      promptLower.includes("cosmic") ||
      promptLower.includes("event horizon") ||
      promptLower.includes("space")
    ) {
      return {
        primary: "#a855f7", // Nebula Violet
        secondary: "#38bdf8", // Stellar Cyan
        accent: "#c084fc", // Pulsar Highlight
        bgPrimary: "#03020a", // Void Black
        bgSecondary: "#0a061c", // Cosmic Dust
        textColor: "#f8fafc", // Starlight White
        textMuted: "#c4b5fd", // Nebula Dust
        surface: "rgba(168, 85, 247, 0.08)",
        border: "rgba(168, 85, 247, 0.3)",
        glow: "rgba(168, 85, 247, 0.65)",
      };
    }

    // 11. Viral Social Reels (9:16 Vertical Peak Focus)
    if (
      domain === "social-reel" ||
      promptLower.includes("reel") ||
      promptLower.includes("vertical") ||
      promptLower.includes("tiktok")
    ) {
      return {
        primary: "#3b82f6", // Electric Cobalt
        secondary: "#10b981", // Growth Mint
        accent: "#f59e0b", // Focus Amber
        bgPrimary: "#080c16", // Deep Mobile Slate
        bgSecondary: "#101827", // Clean Dark Interface
        textColor: "#ffffff", // Crisp White
        textMuted: "#93c5fd", // Light Electric Blue
        surface: "rgba(59, 130, 246, 0.09)",
        border: "rgba(59, 130, 246, 0.3)",
        glow: "rgba(59, 130, 246, 0.55)",
      };
    }

    // 12. Modern SaaS & AI (Quantum AI / Networks Home)
    if (
      domain === "saas-tech" ||
      topicLower.includes("network") ||
      topicLower.includes("ollima") ||
      promptLower.includes("saas") ||
      promptLower.includes("quantum")
    ) {
      return {
        primary: "#00f0ff", // Electric Cyan
        secondary: "#6366f1", // Modern Indigo
        accent: "#38bdf8", // Sky Accent
        bgPrimary: "#030712", // Deep Space Pitch
        bgSecondary: "#0a1128", // Deep Midnight Cobalt
        textColor: "#f8fafc", // Pure High-Contrast White
        textMuted: "#94a3b8", // Modern Slate
        surface: "rgba(0, 240, 255, 0.08)",
        border: "rgba(0, 240, 255, 0.28)",
        glow: "rgba(0, 240, 255, 0.6)",
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

  private static selectFonts(
    style: PromptAnalysis["presentationStyle"],
    lowerPrompt: string = "",
    topic: string = "",
  ) {
    const text = `${lowerPrompt} ${topic}`.toLowerCase();
    const domain = this.detectDomain(topic, lowerPrompt);

    // 1. Superhero / Blockbuster / Cinematic Comic
    if (domain === "comic-action" || /superman|batman|comic|action|blockbuster|hero/i.test(text)) {
      return {
        display: "'Bebas Neue', 'Impact', sans-serif",
        body: "'Montserrat', sans-serif",
      };
    }

    // 2. Luxury / Gold Horology / Jewelry / Editorial Premium
    if (domain === "luxury" || /luxury|chronograph|watch|aethelgard|gold|jewelry|elegance/i.test(text)) {
      return {
        display: "'Playfair Display', 'Cinzel', serif",
        body: "'Montserrat', sans-serif",
      };
    }

    // 3. Cyberpunk & Matrix Devtools / Terminal Code
    if (domain === "cyberpunk" || /cyberpunk|terminal|neon kernel|matrix|devtools|code block/i.test(text)) {
      return {
        display: "'Orbitron', 'Space Grotesk', sans-serif",
        body: "'JetBrains Mono', monospace",
      };
    }

    // 4. Swiss Minimalist & Architecture
    if (domain === "swiss-minimalist" || /swiss|counterform|minimalist|architecture/i.test(text)) {
      return {
        display: "'Space Grotesk', 'Inter', sans-serif",
        body: "'Inter', sans-serif",
      };
    }

    // 5. Investigative Financial Editorial / Newspaper
    if (domain === "editorial-finance" || /editorial|newspaper|daktilo|dispatch|financial|investigative/i.test(text)) {
      return {
        display: "'Merriweather', 'Playfair Display', serif",
        body: "'Inter', sans-serif",
      };
    }

    // 6. Growth Marketing & High Energy Social Reels
    if (domain === "growth-marketing" || domain === "social-reel" || /energy|growth|pulse|reel|tiktok|bold/i.test(text)) {
      return {
        display: "'Syne', 'Outfit', sans-serif",
        body: "'Plus Jakarta Sans', sans-serif",
      };
    }

    // 7. Coastal Ocean & Mindfulness
    if (domain === "coastal" || domain === "mindfulness" || /salt air|coastal|mindfulness|calm|wellness/i.test(text)) {
      return {
        display: "'Playfair Display', 'Outfit', serif",
        body: "'Plus Jakarta Sans', sans-serif",
      };
    }

    // 8. SaaS / Tech / Cloud Enterprise
    if (domain === "saas-tech" || /saas|software|cloud|code|developer|api/i.test(text)) {
      return {
        display: "'Outfit', 'Plus Jakarta Sans', sans-serif",
        body: "'Inter', sans-serif",
      };
    }

    // 9. Default Modern Bold Geometric
    return {
      display: "'Space Grotesk', 'Plus Jakarta Sans', sans-serif",
      body: "'Plus Jakarta Sans', sans-serif",
    };
  }

  private static generateTopicKeyMessages(
    topic: string,
    count: number,
  ): string[] {
    if (topic.toLowerCase().includes("swami") || topic.toLowerCase().includes("vikas") || topic.toLowerCase().includes("ollasoftware")) {
      return [
        "Vikas Swami: Enterprise Architect, Dual Founder & Pioneer",
        "Networkers Home: 18+ Years Transforming 25,000+ Cisco Engineers",
        "Ollasoftware: Next-Gen Autonomous AI & Digital Transformation",
        "Pioneering Dual-Track Innovation Across Global Scale",
      ];
    }
    if (topic.toLowerCase().includes("batman")) {
      return [
        "Built from Gotham's Concrete: No Billions, 100% Grit",
        "Civil Engineering Turned Lethal Urban Warfare",
        "Detachable Battleaxe Emblem & Hook-Weighted Cape",
        "The Working-Class Tank Gotham Deserves",
      ];
    }
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
    const isBatman =
      topic.toLowerCase().includes("batman") ||
      analysis.topic.toLowerCase().includes("batman");

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
    let comicSpec: StoryboardScene["comicSpec"] = undefined;

    if (layout === "comic-ad-hook") {
      badgeText = "DC COMICS • ALL IN LAUNCH SPECIAL";
      purpose = "Teaser Hook & Cinematic Comic Title";
      mainHeading = "ABSOLUTE BATMAN";
      supportingText = "WITHOUT MONEY. WITHOUT AN EMPIRE. WITHOUT MERCY.";
      comicSpec = {
        banner: "DC COMICS • ALL IN INITIATIVE",
        tagline: "WITHOUT MONEY. WITHOUT AN EMPIRE. WITHOUT MERCY.",
        subTagline: "The Dark Knight is reborn from Gotham's raw concrete.",
      };
    } else if (layout === "comic-dossier") {
      badgeText = "CASE FILE // DOSSIER: BRUCE WAYNE";
      purpose = "Character Dossier & Origin Breakdown";
      mainHeading = "WHO IS THE ABSOLUTE BATMAN?";
      supportingText = "Stripped of infinite wealth. Molded by high-risk civil engineering. An unstoppable force of nature.";
      comicSpec = {
        dossierPanels: [
          {
            title: "CIVIL ENGINEER",
            category: "MUNICIPAL ARCHITECTURE",
            description: "Constructed Gotham's bridges, subways, and tunnels. Knows every structural stress point and concrete flaw in the city.",
            tag: "ORIGIN",
            stat: "BLUE-COLLAR",
          },
          {
            title: "6'6\" // 250 LBS TANK",
            category: "PHYSICAL JUGGERNAUT",
            description: "A terrifying wall of muscle and bone. Built to fight in the trenches and overpower entire armed crime syndicates alone.",
            tag: "PHYSIQUE",
            stat: "DOMINANT",
          },
          {
            title: "$0 TRUST FUND",
            category: "CRIME ALLEY SURVIVOR",
            description: "No Wayne Manor. No butler. No billionaire safety net. Fueled purely by blue-collar sweat, heavy iron, and survival grit.",
            tag: "LEGACY",
            stat: "100% GRIT",
          },
        ],
      };
    } else if (layout === "comic-arsenal") {
      badgeText = "TACTICAL HARDWARE & WEAPONRY";
      purpose = "Weapons Breakdown & Action Showcase";
      mainHeading = "ENGINEERED FOR TOTAL WAR";
      supportingText = "Heavy municipal construction equipment weaponized into lethal urban combat hardware.";
      comicSpec = {
        weapons: [
          {
            name: "DETACHABLE BATTLEAXE",
            type: "SIGNATURE WEAPON",
            description: "The broad chest Bat-emblem unlatches into a massive two-handed war axe designed to cleave reinforced steel and concrete.",
            badge: "MELEE",
          },
          {
            name: "HOOK-WEIGHTED CAPE",
            type: "CONCRETE ANCHOR",
            description: "Pre-stressed steel grappling hooks sewn into heavy cape edges that slice through armor and rip down masonry.",
            badge: "TACTICAL",
          },
          {
            name: "INDUSTRIAL EXOSUIT",
            type: "BALLISTIC RIG",
            description: "High-tensile municipal construction armor and concrete-shattering reinforced steel boots engineered for brutal ground combat.",
            badge: "ARMOR",
          },
        ],
      };
    } else if (layout === "comic-trailer-cta") {
      badgeText = "THE NEW DC LEGEND BEGINS";
      purpose = "Official Comic Ad Climax & Release CTA";
      mainHeading = "I AM THE CONCRETE. I AM THE BAT.";
      supportingText = "The corrupt elite built Gotham to bleed its citizens dry. Absolute Batman rises from the pavement to break their empire.";
      comicSpec = {
        issueTitle: "ABSOLUTE BATMAN #1",
        creators: "WRITTEN BY SCOTT SNYDER • ART BY NICK DRAGOTTA • COLORS BY FRANK MARTIN",
        publisher: "DC COMICS • THE ABSOLUTE UNIVERSE",
        ctaAction: "AVAILABLE NOW AT YOUR LOCAL COMIC SHOP",
        subCta: "READ DIGITALLY ON DC UNIVERSE INFINITE",
      };
    const domain = analysis.domain || this.detectDomain(topic, analysis.rawPrompt || "");

    let purpose = `Chapter ${sceneIndex}`;
    let mainHeading = `${topic} Overview`;
    let supportingText = "Exploring core capabilities and intelligent performance.";
    let metricData: StoryboardScene["metricData"] = undefined;
    let diagramSpec: StoryboardScene["diagramSpec"] = undefined;
    let comparisonData: StoryboardScene["comparisonData"] = undefined;
    let imageSpec: StoryboardScene["imageSpec"] = undefined;
    let badgeText = "FEATURED PRESENTATION";
    let comicSpec: StoryboardScene["comicSpec"] = undefined;

    if (layout === "comic-ad-hook") {
      badgeText = "DC COMICS • ALL IN LAUNCH SPECIAL";
      purpose = "Teaser Hook & Cinematic Comic Title";
      mainHeading = "ABSOLUTE BATMAN";
      supportingText = "WITHOUT MONEY. WITHOUT AN EMPIRE. WITHOUT MERCY.";
      comicSpec = {
        banner: "DC COMICS • ALL IN INITIATIVE",
        tagline: "WITHOUT MONEY. WITHOUT AN EMPIRE. WITHOUT MERCY.",
        subTagline: "The Dark Knight is reborn from Gotham's raw concrete.",
      };
    } else if (layout === "comic-dossier") {
      badgeText = "CASE FILE // DOSSIER: BRUCE WAYNE";
      purpose = "Character Dossier & Origin Breakdown";
      mainHeading = "WHO IS THE ABSOLUTE BATMAN?";
      supportingText = "Stripped of infinite wealth. Molded by high-risk civil engineering. An unstoppable force of nature.";
      comicSpec = {
        dossierPanels: [
          {
            title: "CIVIL ENGINEER",
            category: "MUNICIPAL ARCHITECTURE",
            description: "Constructed Gotham's bridges, subways, and tunnels. Knows every structural stress point and concrete flaw in the city.",
            tag: "ORIGIN",
            stat: "BLUE-COLLAR",
          },
          {
            title: "6'6\" // 250 LBS TANK",
            category: "PHYSICAL JUGGERNAUT",
            description: "A terrifying wall of muscle and bone. Built to fight in the trenches and overpower entire armed crime syndicates alone.",
            tag: "PHYSIQUE",
            stat: "DOMINANT",
          },
          {
            title: "$0 TRUST FUND",
            category: "CRIME ALLEY SURVIVOR",
            description: "No Wayne Manor. No butler. No billionaire safety net. Fueled purely by blue-collar sweat, heavy iron, and survival grit.",
            tag: "LEGACY",
            stat: "100% GRIT",
          },
        ],
      };
    } else if (layout === "comic-arsenal") {
      badgeText = "TACTICAL HARDWARE & WEAPONRY";
      purpose = "Weapons Breakdown & Action Showcase";
      mainHeading = "ENGINEERED FOR TOTAL WAR";
      supportingText = "Heavy municipal construction equipment weaponized into lethal urban combat hardware.";
      comicSpec = {
        weapons: [
          {
            name: "DETACHABLE BATTLEAXE",
            type: "SIGNATURE WEAPON",
            description: "The broad chest Bat-emblem unlatches into a massive two-handed war axe designed to cleave reinforced steel and concrete.",
            badge: "MELEE",
          },
          {
            name: "HOOK-WEIGHTED CAPE",
            type: "CONCRETE ANCHOR",
            description: "Pre-stressed steel grappling hooks sewn into heavy cape edges that slice through armor and rip down masonry.",
            badge: "TACTICAL",
          },
          {
            name: "INDUSTRIAL EXOSUIT",
            type: "BALLISTIC RIG",
            description: "High-tensile municipal construction armor and concrete-shattering reinforced steel boots engineered for brutal ground combat.",
            badge: "ARMOR",
          },
        ],
      };
    } else if (layout === "comic-trailer-cta") {
      badgeText = "THE NEW DC LEGEND BEGINS";
      purpose = "Official Comic Ad Climax & Release CTA";
      mainHeading = "I AM THE CONCRETE. I AM THE BAT.";
      supportingText = "The corrupt elite built Gotham to bleed its citizens dry. Absolute Batman rises from the pavement to break their empire.";
      comicSpec = {
        issueTitle: "ABSOLUTE BATMAN #1",
        creators: "WRITTEN BY SCOTT SNYDER • ART BY NICK DRAGOTTA • COLORS BY FRANK MARTIN",
        publisher: "DC COMICS • THE ABSOLUTE UNIVERSE",
        ctaAction: "AVAILABLE NOW AT YOUR LOCAL COMIC SHOP",
        subCta: "READ DIGITALLY ON DC UNIVERSE INFINITE",
      };
    } else if (isFirst) {
      purpose = "Cinematic Opening Title & Hook";
      if (domain === "luxury") {
        badgeText = "SWISS HAUTE HORLOGERIE // LIMITED EDITION";
        mainHeading = topic;
        supportingText = "Handcrafted in Switzerland. Engineered with relentless mechanical precision, obsidian elegance, and timeless prestige.";
      } else if (domain === "cyberpunk") {
        badgeText = "SYSTEM ARCHITECTURE // KERNEL CORE";
        mainHeading = topic;
        supportingText = "Zero memory overhead. Blazing multi-threaded speed. Engineered for modern high-performance infrastructure.";
      } else if (domain === "editorial-finance") {
        badgeText = "SPECIAL INVESTIGATIVE FINANCIAL REPORT";
        mainHeading = topic;
        supportingText = "Analyzing institutional capital velocity, global macroeconomic shifts, and algorithmic market liquidity.";
      } else if (domain === "swiss-minimalist") {
        badgeText = "SWISS MODERNIST DESIGN MANIFESTO";
        mainHeading = topic;
        supportingText = "Pure form and function. Eliminating distraction to let architectural structure and typography command attention.";
      } else if (domain === "growth-marketing") {
        badgeText = "HIGH-PERFORMANCE GROWTH AGENCY";
        mainHeading = "Move Fast. Scale Harder.";
        supportingText = "Transforming paid acquisition and viral creative into exponential revenue velocity.";
      } else if (domain === "coastal") {
        badgeText = "SERENE COASTAL SANCTUARY";
        mainHeading = topic;
        supportingText = "Breathe in the calm tide. Experience natural tranquility, deep ocean gradients, and timeless seaside beauty.";
      } else if (domain === "mindfulness") {
        badgeText = "NEUROSCIENCE-BACKED WELLNESS";
        mainHeading = "Find Your Flow State";
        supportingText = "Cultivate daily mindfulness, reduce cortisol, and reclaim mental clarity in just 5 minutes a day.";
      } else if (domain === "clean-energy") {
        badgeText = "RENEWABLE CLEAN ENERGY REVOLUTION";
        mainHeading = "Powering a Zero-Carbon World";
        supportingText = "Next-generation solar capture and intelligent microgrid storage engineered for sustainable communities.";
      } else if (domain === "cosmic-science") {
        badgeText = "DEEP SPACE ASTROPHYSICS";
        mainHeading = topic;
        supportingText = "Beyond the point of no return: exploring extreme gravity, singularity mechanics, and the event horizon.";
      } else if (domain === "social-reel") {
        badgeText = "HIGH-LEVERAGE PRODUCTIVITY PROTOCOL";
        mainHeading = topic;
        supportingText = "The exact daily framework top performers use to achieve 10x deep work without burning out.";
      } else {
        badgeText = isBatman
          ? "DC ALL IN • WORKING-CLASS VIGILANTE"
          : isOllama
            ? "LOCAL AI ENGINE"
            : "ENTERPRISE AUTONOMOUS PLATFORM";
        mainHeading = isBatman ? "Absolute Batman" : isOllama ? "Ollima" : topic;
        supportingText = isBatman
          ? "No billions. No mansion. Pure unrelenting grit, massive brute force, and lethal tactical engineering."
          : isOllama
            ? "Run powerful large language models locally on your private machine."
            : analysis.purpose;
      }
    } else if (isLast) {
      purpose = "Summary & Call to Action";
      if (domain === "luxury") {
        badgeText = "EXCLUSIVE RESERVATION ALLOCATION";
        mainHeading = "Own a Horological Masterpiece";
        supportingText = "Strictly limited production run. Inquire with private client services to reserve your individual allocation.";
      } else if (domain === "cyberpunk") {
        badgeText = "OPEN SOURCE // DEPLOY TODAY";
        mainHeading = `Build with ${topic}`;
        supportingText = "Available now via npm and cargo. Join over 50,000 systems engineers building on GitHub.";
      } else if (domain === "editorial-finance") {
        badgeText = "COMPLETE INSTITUTIONAL DOSSIER";
        mainHeading = "Navigate the Capital Shift";
        supportingText = "Access the comprehensive macroeconomic dataset, sovereign risk analysis, and capital flow models.";
      } else if (domain === "swiss-minimalist") {
        badgeText = "DESIGN FOR DECADES";
        mainHeading = "Form Follows Purpose";
        supportingText = "Great design is as little design as possible. Elevate your brand standard with purposeful geometry.";
      } else if (domain === "growth-marketing") {
        badgeText = "GROWTH AUDIT AVAILABLE";
        mainHeading = "Ready for Hyper-Scale?";
        supportingText = "Stop wasting capital on stale campaigns. Partner with the agency engineered for venture-backed scale.";
      } else if (domain === "mindfulness") {
        badgeText = "START 14-DAY FREE TRIAL";
        mainHeading = "Begin Your Daily Calm";
        supportingText = "Available on iOS and Android. Join 1.5 million mindful practitioners living with clarity.";
      } else if (domain === "clean-energy") {
        badgeText = "JOIN THE ENERGY TRANSITION";
        mainHeading = "The Future is 100% Clean";
        supportingText = "Transition your commercial or residential power to zero-carbon solar with immediate cost savings.";
      } else if (domain === "social-reel") {
        badgeText = "SAVE & SHARE THIS REEL";
        mainHeading = "Start Your First Sprint Today";
        supportingText = "Comment 'FOCUS' below to receive the free 90-Minute Sprint Checklist and Notion Focus Template.";
      } else {
        badgeText = isBatman
          ? "GOTHAM'S TRUE DEFENDER"
          : isOllama
            ? "GET STARTED NOW"
            : "EXPERIENCE THE NEXT STANDARD";
        mainHeading = isBatman
          ? "I Am The Concrete. I Am The Bat."
          : isOllama
            ? "Unleash Local AI with Ollima"
            : `Experience ${topic} Today`;
        supportingText = isBatman
          ? "The corrupt elite built Gotham to bleed its citizens dry. Absolute Batman rises from the pavement to break their empire."
          : isOllama
            ? "Get started in seconds. Fast, private, open-source AI for everyone."
            : "Step into effortless connectivity, superior performance, and unmatched peace of mind.";
      }
    } else if (layout === "animated-bar-chart") {
      badgeText = "REVENUE & GROWTH TRAJECTORY";
      purpose = "Animated Revenue & Performance Chart";
      mainHeading = `${topic} Revenue Surge`;
      supportingText = "Accelerating quarter-over-quarter revenue expansion and rapid commercial adoption.";
      diagramSpec = {
        type: "bars",
        bars: [
          { label: "Q1 2024", value: 35, formattedValue: "$1.4M", color: p.primary },
          { label: "Q2 2024", value: 55, formattedValue: "$2.8M", color: p.secondary },
          { label: "Q3 2024", value: 78, formattedValue: "$4.5M", color: p.accent },
          { label: "Q4 2024", value: 98, formattedValue: "$7.2M", color: "#10b981" },
        ],
      };
    } else if (layout === "image-showcase") {
      badgeText = isBatman
        ? "URBAN BATTLEGROUND SPOTLIGHT"
        : isOllama
          ? "HIGH-PERFORMANCE ARCHITECTURE"
          : `${topic.toUpperCase()} SPOTLIGHT`;
      purpose = "Visual Asset Feature";
      mainHeading = isBatman
        ? "Forged in Gotham's Streets"
        : isOllama
          ? "Private, Fast & Local Intelligence"
          : `Engineered for ${topic}`;
      supportingText = isBatman
        ? "Weaponizing Gotham's municipal architecture, steel girders, and reinforced structural mechanics."
        : isOllama
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
          caption: isBatman
            ? "Absolute Batman Tactical Ground"
            : isOllama
              ? "Ollima AI Local Infrastructure"
              : `${topic} Featured Experience`,
          overlayText: isBatman
            ? "Absolute Batman • DC Comics"
            : isOllama
              ? "Ollima Ultra Edition"
              : `${topic} High-Performance Edition`,
        };
      }
    } else if (layout === "metrics-grid") {
      purpose = "Data Proof & Performance Metrics";
      if (domain === "luxury") {
        badgeText = "PRECISION HOROLOGICAL SPECIFICATIONS";
        mainHeading = "Mastery in Every Micron";
        supportingText = "Individually regulated across six positions to deliver chronometer-grade certified accuracy.";
        metricData = [
          { label: "Case Material", value: "18K SOLID GOLD", detail: "Brushed & mirror polished", trend: "Bespoke" },
          { label: "Water Resistance", value: "300M / 1000FT", detail: "Screw-down sapphire crown", trend: "Certified" },
          { label: "Power Reserve", value: "72 HOURS", detail: "Automatic mechanical calibre", trend: "High-Beat" },
        ];
      } else if (domain === "cyberpunk") {
        badgeText = "MICROBENCHMARKS // BARE METAL";
        mainHeading = "Built for Zero-Overhead Speed";
        supportingText = "Consistently outperforming legacy runtime stacks across latency, memory, and IO throughput.";
        metricData = [
          { label: "Kernel Startup", value: "0.04ms", detail: "Cold-start microkernel init", trend: "Instant" },
          { label: "Memory Safety", value: "100% RUST", detail: "Zero memory leaks or panics", trend: "Hardened" },
          { label: "IO Throughput", value: "2.8M IOPS", detail: "Direct asynchronous NVMe ring", trend: "+420%" },
        ];
      } else if (domain === "editorial-finance") {
        badgeText = "MACROECONOMIC CAPITAL METRICS";
        mainHeading = "Accelerating Institutional Shift";
        supportingText = "Tracking cross-border sovereign flows, algorithmic balance sheets, and real-time yield velocity.";
        metricData = [
          { label: "Cross-Border Flow", value: "+$4.2T SHIFT", detail: "Capital velocity expansion", trend: "Surging" },
          { label: "Tech Allocation", value: "38.4% YIELD", detail: "Institutional portfolio weight", trend: "+12.4%" },
          { label: "Settlement Speed", value: "<0.05 SEC", detail: "Distributed clearing latency", trend: "Real-Time" },
        ];
      } else if (domain === "clean-energy") {
        badgeText = "VERIFIED ENVIRONMENTAL IMPACT";
        mainHeading = "Measurable Clean Energy Yield";
        supportingText = "High-efficiency silicon arrays delivering clean distributed energy across global microgrids.";
        metricData = [
          { label: "Carbon Offset", value: "1.2M TONS", detail: "Annual CO₂ displacement", trend: "Certified" },
          { label: "Cell Efficiency", value: "24.8% PEAK", detail: "Next-gen bifacial conversion", trend: "Record" },
          { label: "Grid Purity", value: "100% GREEN", detail: "Zero fossil-fuel dependency", trend: "Net Zero" },
        ];
      } else if (domain === "mindfulness") {
        badgeText = "CLINICAL WELLNESS BENCHMARKS";
        mainHeading = "The Science of Quiet Focus";
        supportingText = "Neuroscience-backed meditation sessions measured for physiological and cognitive recovery.";
        metricData = [
          { label: "Cortisol Drop", value: "-58% STRESS", detail: "Clinically validated reduction", trend: "Proven" },
          { label: "Daily Retention", value: "94.2% STREAK", detail: "Effortless habit building", trend: "Consistent" },
          { label: "Mindful Members", value: "1.5M+ ACTIVE", detail: "Practicing in 120 countries", trend: "Global" },
        ];
      } else if (domain === "social-reel") {
        badgeText = "PEAK PERFORMANCE METRICS";
        mainHeading = "Compound Productivity Leverage";
        supportingText = "Eliminating context switching to unlock uninterrupted deep creative focus.";
        metricData = [
          { label: "Daily Deep Work", value: "+4 HOURS", detail: "Zero notification distraction", trend: "Flow State" },
          { label: "Cognitive Fatigue", value: "-65% DROP", detail: "Dopamine fasting & rhythm", trend: "Energized" },
          { label: "Output Multiplier", value: "10x SPEED", detail: "Compounding weekly results", trend: "Top 1%" },
        ];
      } else if (domain === "growth-marketing") {
        badgeText = "PROVEN ROI & ACQUISITION";
        mainHeading = "High-Velocity Revenue Loops";
        supportingText = "Systematic creative testing and conversion architecture that scales profitably.";
        metricData = [
          { label: "Revenue Surge", value: "+340% YoY", detail: "High-converting media spend", trend: "Accelerating" },
          { label: "CAC Reduction", value: "-42% COST", detail: "Organic viral amplification", trend: "Efficient" },
          { label: "Ad Spend ROAS", value: "6.8x RETURN", detail: "Consistent multi-channel profit", trend: "Profitable" },
        ];
      } else if (domain === "cosmic-science") {
        badgeText = "ASTROPHYSICAL BENCHMARKS";
        mainHeading = "Extreme Singularity Physics";
        supportingText = "Measuring gravitational lens curvature and relativistic time dilation at the edge of spacetime.";
        metricData = [
          { label: "Event Horizon", value: "1.4M MASSES", detail: "Solar gravitational pull", trend: "Singularity" },
          { label: "Light Orbit", value: "300,000 km/s", detail: "Photon sphere trajectory", trend: "Relativistic" },
          { label: "Time Dilation", value: "∞ AT BORDER", detail: "Gravitational redshift asymptote", trend: "Infinite" },
        ];
      } else {
        badgeText = isBatman ? "COMBAT BENCHMARKS & HARDWARE" : "PROVEN SCALE & BENCHMARKS";
        mainHeading = isBatman ? "Brutal Tactical Mass & Arsenal" : "Unrivaled Performance & Scale";
        supportingText = isBatman
          ? "Standing 6'6\" and 250 lbs, engineered for devastating impact against Gotham's criminal syndicate."
          : "Demonstrated benchmarks engineered for demanding environments.";
        metricData = isBatman
          ? [
              { label: "Height & Weight", value: "6'6\" / 250 LBS", detail: "Pure physical powerhouse", trend: "Dominant" },
              { label: "Primary Weapon", value: "BROAD AXE", detail: "Detachable chest crest", trend: "Heavy Impact" },
              { label: "Trust Fund", value: "$0.00", detail: "Working-class guerrilla", trend: "100% Grit" },
            ]
          : [
              { label: "Inference Latency", value: "<3ms", detail: "Instant edge response", trend: "Real-Time" },
              { label: "Uptime SLA", value: "99.999%", detail: "Enterprise grade reliability", trend: "Rock Solid" },
              { label: "Scale Velocity", value: "10M+ RPS", detail: "Distributed elastic cluster", trend: "+94% Peak" },
            ];
      }
    } else if (layout === "split-diagram" || layout === "process-flow") {
      purpose = "System Architecture & Process Flow";
      if (domain === "luxury") {
        badgeText = "PRECISION COMPLICATION BLUEPRINT";
        mainHeading = "Anatomy of the Calibre";
        supportingText = "Over 280 hand-finished components working in synchronized mechanical harmony.";
        diagramSpec = {
          type: "flow",
          nodes: [
            { label: "Balance Wheel", sub: "Silicon hairspring", icon: "cpu" },
            { label: "Escapement", sub: "Jeweled pallets", icon: "brain" },
            { label: "Gear Train", sub: "Micro-beveled teeth", icon: "sparkles" },
            { label: "Sapphire Dial", sub: "Anti-reflective glass", icon: "shield" },
          ],
        };
      } else if (domain === "cyberpunk") {
        badgeText = "MICROKERNEL PIPELINE // RUNTIME";
        mainHeading = "Low-Level Kernel Architecture";
        supportingText = "Zero context switching between ring 0 and hardware memory primitives.";
        diagramSpec = {
          type: "flow",
          nodes: [
            { label: "Kernel Init", sub: "Hardware vector boot", icon: "cpu" },
            { label: "Memory Map", sub: "Lock-free atomic allocator", icon: "brain" },
            { label: "Async Poller", sub: "io_uring event ring", icon: "sparkles" },
            { label: "Driver Ring", sub: "Zero-copy packet bus", icon: "shield" },
          ],
        };
      } else if (domain === "clean-energy") {
        badgeText = "CLEAN ENERGY MICROGRID ARCHITECTURE";
        mainHeading = "From Solar Ray to Storage";
        supportingText = "Decentralized energy harvest flowing seamlessly into smart grid distribution.";
        diagramSpec = {
          type: "flow",
          nodes: [
            { label: "Bifacial Solar", sub: "Photon conversion", icon: "sparkles" },
            { label: "Smart Inverter", sub: "Harmonic stabilization", icon: "cpu" },
            { label: "Solid Storage", sub: "Safe iron-phosphate cells", icon: "shield" },
            { label: "Grid Dispatch", sub: "Zero-loss local delivery", icon: "brain" },
          ],
        };
      } else if (domain === "editorial-finance") {
        badgeText = "CAPITAL ALLOCATION MECHANICS";
        mainHeading = "How Capital Flows in 2026";
        supportingText = "Automated macroeconomic routing responding to real-time sovereign liquidity.";
        diagramSpec = {
          type: "flow",
          nodes: [
            { label: "Macro Ingestion", sub: "Central bank signals", icon: "brain" },
            { label: "Risk Modeling", sub: "Algorithmic stress testing", icon: "cpu" },
            { label: "Liquidity Pool", sub: "Decentralized treasury", icon: "shield" },
            { label: "Instant Clearing", sub: "T+0 ledger settlement", icon: "sparkles" },
          ],
        };
      } else {
        badgeText = isBatman ? "TACTICAL BLUEPRINT & ORIGIN" : "SYSTEM ARCHITECTURE OVERVIEW";
        mainHeading = isBatman ? "Civil Engineer Turned Urban Tank" : `${topic} Architecture Pipeline`;
        supportingText = isBatman
          ? "Bruce Wayne weaponized municipal infrastructure mechanics into an unstoppable urban guerrilla combat philosophy."
          : "A modular, fault-tolerant pipeline engineered for speed, privacy, and elastic scale.";
        diagramSpec = isBatman
          ? {
              type: "flow",
              nodes: [
                { label: "Civil Engineering", sub: "Infrastructure mastery", icon: "brain" },
                { label: "Physical Mass", sub: "6'6\" & 250 lbs tank", icon: "shield" },
                { label: "Battleaxe Crest", sub: "Detachable chest weapon", icon: "cpu" },
                { label: "Trench Warfare", sub: "Hook-weighted cape", icon: "sparkles" },
              ],
            }
          : {
              type: "flow",
              nodes: [
                { label: "Smart Ingestion", sub: "Low-latency edge", icon: "brain" },
                { label: "Neural Engine", sub: "Real-time inference", icon: "cpu" },
                { label: "Security Layer", sub: "Encrypted memory ring", icon: "shield" },
                { label: "Global Edge", sub: "Zero-latency delivery", icon: "sparkles" },
              ],
            };
      }
    } else if (layout === "comparison-cards") {
      badgeText = isBatman ? "CHARACTER DUALITY" : "COMPARATIVE ADVANTAGE";
      purpose = "Breakthrough Comparison";
      mainHeading = isBatman
        ? "Classic Wayne vs Absolute Batman"
        : `Traditional Solutions vs ${topic}`;
      supportingText = isBatman
        ? "Contrasting billionaire privilege against working-class brute force and tactical ingenuity."
        : "Comparing legacy limitations against next-generation modern capabilities.";
      if (domain === "luxury") {
        comparisonData = {
          leftTitle: "Mass Production Watches",
          leftItems: [
            "Stamped stamped alloy components",
            "Generic automated quartz assembly",
            "Depreciates after retail purchase",
          ],
          rightTitle: `${topic} Masterpiece`,
          rightItems: [
            "Hand-beveled 18K solid gold casing",
            "Bespoke mechanical calibre regulated in-house",
            "Heirloom investment built for generations",
          ],
        };
      } else if (domain === "cyberpunk") {
        comparisonData = {
          leftTitle: "Legacy Monolithic Runtimes",
          leftItems: [
            "Excessive garbage collection stalls",
            "Multi-gigabyte container overhead",
            "Opaque debugging & thread contention",
          ],
          rightTitle: `${topic} Engine`,
          rightItems: [
            "Sub-millisecond bare-metal execution",
            "Tiny footprint with zero memory bloat",
            "Predictable deterministic low-level control",
          ],
        };
      } else {
        comparisonData = isBatman
          ? {
              leftTitle: "Classic Wayne Legacy",
              leftItems: [
                "Billionaire fortune & Wayne Enterprises",
                "Wayne Manor & High-Tech Batcave",
                "Military gadgets & Alfred the butler",
              ],
              rightTitle: "Absolute Batman Standard",
              rightItems: [
                "Self-made civil municipal engineer",
                "Lives in working-class Gotham trenches",
                "Detachable chest battleaxe & raw muscle",
              ],
            }
          : {
              leftTitle: "Traditional Workflows",
              leftItems: [
                "Fragmented connectivity & lag",
                "Complex manual configuration",
                "Slow responsiveness under load",
              ],
              rightTitle: `${topic} Standard`,
              rightItems: [
                "Zero-latency unified sync",
                "Intelligent automated orchestration",
                "Encrypted, enterprise-grade uptime",
              ],
            };
      }
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
      comicSpec,
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

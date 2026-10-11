import {
  Storyboard,
  StoryboardScene,
  SceneLayoutType,
} from "./prompts.js";

export interface BuildProjectResult {
  files: Record<string, string>;
  metadata: {
    title: string;
    duration: number;
    width: number;
    height: number;
    fps: number;
  };
  compositionPlan: {
    title: string;
    description: string;
    totalDuration: number;
    scenes: Array<{
      id: string;
      name: string;
      duration: number;
      start: number;
      description: string;
      layout: string;
      visualElements: string[];
    }>;
  };
}

export class CompositionBuilder {
  /**
   * Builds the complete set of HyperFrames project files from a structured Storyboard.
   */
  public static buildFromStoryboard(
    storyboard: Storyboard,
    availableAssets?: any[],
  ): BuildProjectResult {
    const files: Record<string, string> = {};
    const width =
      storyboard.width || (storyboard.resolution === "720p" ? 1280 : 1920);
    const height =
      storyboard.height || (storyboard.resolution === "720p" ? 720 : 1080);
    const { fps, totalDuration, scenes, title, theme } = storyboard;

    // Normalize palette, background, and typography defaults across all scenes
    scenes.forEach((scene) => {
      const p = scene.palette || ({} as any);
      scene.palette = {
        primary: p.primary || theme?.primaryColor || "#6366f1",
        secondary: p.secondary || theme?.accentColor || "#a855f7",
        accent: p.accent || theme?.accentColor || "#00f5ff",
        textColor: p.textColor || theme?.textColor || "#ffffff",
        subtextColor: p.subtextColor || "#94a3b8",
        surfaceColor: p.surfaceColor || "rgba(255, 255, 255, 0.05)",
        borderColor: p.borderColor || theme?.border || "rgba(255, 255, 255, 0.12)",
      };

      const bg = scene.background || ({} as any);
      scene.background = {
        color: bg.color || theme?.bgPrimary || theme?.backgroundColor || "#0a0a0f",
        gradient:
          bg.gradient ||
          `linear-gradient(135deg, ${theme?.bgPrimary || theme?.backgroundColor || "#0a0a0f"} 0%, ${theme?.bgSecondary || "#16182a"} 100%)`,
        ambientGlow: bg.ambientGlow || (theme?.textColor === "#000000" ? "rgba(0,0,0,0.08)" : "rgba(99, 102, 241, 0.25)"),
        gridOverlay: bg.gridOverlay ?? true,
      };

      if (!scene.typography) {
        scene.typography = {
          headline: scene.mainHeading || "Scene Title",
          subtitle: scene.supportingText || "",
        };
      }
    });

    // 1. Generate individual scene HTML files in compositions/
    const compositionsMeta: Array<{
      id: string;
      file: string;
      duration: number;
      width: number;
      height: number;
    }> = [
      {
        id: "main",
        file: "index.html",
        duration: totalDuration,
        width,
        height,
      },
    ];

    scenes.forEach((scene, index) => {
      const sceneFileName = `compositions/scene_${String(index + 1).padStart(2, "0")}.html`;
      files[sceneFileName] = this.renderSceneHtml(scene, storyboard);
      compositionsMeta.push({
        id: scene.id,
        file: sceneFileName,
        duration: scene.duration,
        width,
        height,
      });
    });

    // 2. Generate Master index.html hosting the scenes
    files["index.html"] = this.renderMasterHtml(storyboard);

    // 3. Generate project.json (HyperFrames 0.8.139 specification)
    files["project.json"] = JSON.stringify(
      {
        version: "0.8.139",
        name: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: storyboard.narrativeArc || title,
        settings: {
          width,
          height,
          fps,
          duration: totalDuration,
        },
        compositions: compositionsMeta,
      },
      null,
      2,
    );

    // 4. Generate meta.json
    files["meta.json"] = JSON.stringify(
      {
        title,
        topic: storyboard.topic,
        purpose: storyboard.purpose,
        presentationStyle: storyboard.presentationStyle,
        duration: totalDuration,
        sceneCount: scenes.length,
        width,
        height,
        fps,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    );

    // 5. Structure compositionPlan for logging and dashboard inspection
    const compositionPlan = {
      title,
      description: storyboard.narrativeArc || title,
      totalDuration,
      scenes: scenes.map((s) => ({
        id: s.id,
        name: s.name,
        duration: s.duration,
        start: s.start,
        description: s.purpose,
        layout: s.layout,
        visualElements: [
          s.layout,
          s.typography.headline,
          s.imageSpec ? `Image: ${s.imageSpec.assetName}` : "SVG / Vector Art",
        ],
      })),
    };

    return {
      files,
      metadata: {
        title,
        duration: totalDuration,
        width,
        height,
        fps,
      },
      compositionPlan,
    };
  }

  /**
   * Renders the master index.html composition.
   */
  private static renderMasterHtml(storyboard: Storyboard): string {
    const width =
      storyboard.width || (storyboard.resolution === "720p" ? 1280 : 1920);
    const height =
      storyboard.height || (storyboard.resolution === "720p" ? 720 : 1080);
    const { totalDuration, scenes, title, theme } = storyboard;
    const bgPrimary = theme.bgPrimary || theme.backgroundColor || "#050811";
    const bodyFont =
      storyboard.typography?.bodyFont || "'Plus Jakarta Sans', sans-serif";

    const sceneTags = scenes
      .map(
        (scene, idx) =>
          `    <div id="${scene.id}" data-composition-id="${scene.id}" data-composition-src="compositions/scene_${String(idx + 1).padStart(2, "0")}.html" data-start="${scene.start}" data-duration="${scene.duration}" style="position: absolute; inset: 0; width: 100%; height: 100%;"></div>`,
      )
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <style>
    @font-face {
      font-family: 'Plus Jakarta Sans';
      src: local('Plus Jakarta Sans'), local('Inter'), sans-serif;
    }
    @font-face {
      font-family: 'Space Grotesk';
      src: local('Space Grotesk'), local('Inter'), sans-serif;
    }
    @font-face {
      font-family: 'Syne';
      src: local('Syne'), local('Inter'), sans-serif;
    }
    @font-face {
      font-family: 'Outfit';
      src: local('Outfit'), local('Inter'), sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html {
      width: 100%;
      height: 100%;
      background: ${bgPrimary};
      overflow: hidden;
      font-family: ${bodyFont};
      -webkit-font-smoothing: antialiased;
    }
    .master-composition {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${bgPrimary};
    }
  </style>
</head>
<body>
  <div class="composition master-composition" data-composition-id="main" data-start="0" data-duration="${totalDuration}" data-width="${width}" data-height="${height}">
${sceneTags}
  </div>

  <script>
    // HyperFrames Paused Master Timeline Contract
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    window.__timelines["main"] = tl;
    tl.seek(0);
  </script>
</body>
</html>`;
  }

  /**
   * Renders a specific scene HTML composition file.
   */
  private static renderSceneHtml(
    scene: StoryboardScene,
    storyboard: Storyboard,
  ): string {
    const width =
      storyboard.width || (storyboard.resolution === "720p" ? 1280 : 1920);
    const height =
      storyboard.height || (storyboard.resolution === "720p" ? 720 : 1080);
    const { layout, duration, palette, background } = scene;
    const { theme } = storyboard;
    const bodyFont =
      storyboard.typography?.bodyFont || "'Plus Jakarta Sans', sans-serif";
    const headlineFont =
      storyboard.typography?.headlineFont ||
      "'Plus Jakarta Sans', 'Inter', sans-serif";
    const border = theme.border || palette.borderColor || "rgba(255,255,255,0.1)";

    const contentHtml = this.generateSceneLayoutBody(scene, storyboard);
    const gsapAnimationScript = this.generateSceneGsapScript(scene);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(scene.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=Syne:wght@700;800&family=Outfit:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <style>
    @font-face {
      font-family: 'Plus Jakarta Sans';
      src: local('Plus Jakarta Sans'), local('Inter'), sans-serif;
    }
    @font-face {
      font-family: 'Space Grotesk';
      src: local('Space Grotesk'), local('Inter'), sans-serif;
    }
    @font-face {
      font-family: 'Syne';
      src: local('Syne'), local('Inter'), sans-serif;
    }
    @font-face {
      font-family: 'Outfit';
      src: local('Outfit'), local('Inter'), sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html {
      width: 100%;
      height: 100%;
      background: ${background.color};
      overflow: hidden;
      font-family: ${bodyFont};
      color: ${palette.textColor};
      -webkit-font-smoothing: antialiased;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    #root {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${background.gradient};
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 80px 100px;
    }

    /* Ambient background grid & lighting */
    .bg-grid {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(to right, ${border} 1px, transparent 1px),
        linear-gradient(to bottom, ${border} 1px, transparent 1px);
      background-size: 80px 80px;
      opacity: 0.25;
      pointer-events: none;
    }
    .bg-glow-spot {
      position: absolute;
      width: 800px;
      height: 800px;
      border-radius: 50%;
      background: radial-gradient(circle, ${background.ambientGlow || palette.accent} 0%, transparent 70%);
      top: -200px;
      right: -100px;
      pointer-events: none;
      filter: blur(60px);
      opacity: 0.4;
    }
    .bg-glow-spot-secondary {
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, ${palette.secondary} 0%, transparent 70%);
      bottom: -200px;
      left: -100px;
      pointer-events: none;
      filter: blur(80px);
      opacity: 0.25;
    }

    /* Typography hierarchy */
    .badge-tag {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-radius: 999px;
      background: ${palette.surfaceColor || "rgba(255, 255, 255, 0.05)"};
      border: 1px solid ${palette.borderColor};
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${palette.textColor};
      backdrop-filter: blur(8px);
      margin-bottom: 24px;
    }
    .headline {
      font-family: ${headlineFont};
      font-size: 64px;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.02em;
      color: ${palette.textColor};
      margin-bottom: 20px;
    }
    .subtitle {
      font-size: 24px;
      font-weight: 500;
      line-height: 1.5;
      color: ${palette.subtextColor};
      max-width: 900px;
    }
    .highlight {
      color: ${palette.textColor};
      background: linear-gradient(135deg, ${palette.primary} 0%, ${palette.secondary} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: ${palette.textColor};
    }

    /* Glassmorphic Cards */
    .glass-card {
      background: ${palette.surfaceColor};
      border: 1px solid ${palette.borderColor};
      border-radius: 20px;
      backdrop-filter: blur(16px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    }

    /* Progress rule */
    .scene-progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 4px;
      background: linear-gradient(90deg, ${palette.primary}, ${palette.accent});
      width: 0%;
      border-top-right-radius: 2px;
    }

    ${this.getLayoutSpecificStyles(layout, palette)}
  </style>
</head>
<body>
  <div class="composition" id="root" data-composition-id="${scene.id}" data-start="0" data-duration="${duration}" data-width="${width}" data-height="${height}">
    <div class="bg-grid"></div>
    <div class="bg-glow-spot"></div>
    <div class="bg-glow-spot-secondary"></div>

    ${contentHtml}

    <div class="scene-progress-bar" id="progressBar"></div>
  </div>

  <script>
    // HyperFrames Paused Timeline Contract
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    window.__timelines["${scene.id}"] = tl;

    ${gsapAnimationScript}

    tl.seek(0);
  </script>
</body>
</html>`;
  }

  /**
   * Generates specific HTML for each scene layout.
   */
  private static generateSceneLayoutBody(
    scene: StoryboardScene,
    storyboard: Storyboard,
  ): string {
    const { layout, palette, typography } = scene;
    const subtitleText = typography.subtitle || "";

    switch (layout) {
      case "cinematic-title":
        return `
    <div class="hero-container" style="text-align: center; max-width: 1200px; z-index: 10;">
      <div class="badge-tag anim-elem" id="titleBadge">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="4" fill="${palette.accent}"/></svg>
        ${this.escapeHtml(typography.badge || "FEATURED PRESENTATION")}
      </div>
      <h1 class="headline anim-elem" id="mainTitle" style="font-size: 76px;">
        ${this.formatHighlightedHeadline(typography.headline)}
      </h1>
      <p class="subtitle anim-elem" id="subTitle" style="margin: 0 auto; max-width: 860px;">
        ${this.escapeHtml(subtitleText)}
      </p>
      
      <div class="cinematic-divider anim-elem" id="cinematicDivider" style="margin: 40px auto 0; width: 140px; height: 3px; background: linear-gradient(90deg, transparent, ${palette.accent}, transparent); border-radius: 2px;"></div>
    </div>`;

      case "animated-typography":
      case "kinetic-quote":
        return `
    <div class="kinetic-container" style="max-width: 1300px; width: 100%; z-index: 10; position: relative;">
      <div class="badge-tag anim-elem" id="quoteBadge">
        ${this.escapeHtml(typography.badge || "KEY INSIGHT")}
      </div>
      <div class="quote-wrapper anim-elem" id="quoteWrapper" style="border-left: 6px solid ${palette.accent}; padding-left: 48px; margin: 24px 0 36px;">
        <h1 class="headline anim-elem" id="quoteText" style="font-size: 72px; line-height: 1.15; font-weight: 800; letter-spacing: -0.03em;">
          "${this.formatHighlightedHeadline(typography.headline)}"
        </h1>
      </div>
      <p class="subtitle anim-elem" id="quoteSub" style="padding-left: 54px; font-size: 26px; color: ${palette.subtextColor};">
        ${this.escapeHtml(subtitleText)}
      </p>
    </div>`;

      case "split-diagram":
      case "process-flow":
        return this.renderDiagramLayout(scene);

      case "metrics-grid":
        return this.renderMetricsLayout(scene);

      case "comparison-cards":
        return this.renderComparisonLayout(scene);

      case "image-showcase":
        return this.renderImageLayout(scene);

      case "closing-summary":
        return `
    <div class="closing-container glass-card anim-elem" id="closingCard" style="max-width: 1100px; width: 100%; padding: 60px 70px; text-align: center; z-index: 10;">
      <div class="badge-tag anim-elem" id="closingBadge" style="margin-bottom: 24px;">
        ${this.escapeHtml(typography.badge || "CONCLUSION")}
      </div>
      <h1 class="headline anim-elem" id="closingTitle" style="font-size: 60px; margin-bottom: 24px;">
        ${this.formatHighlightedHeadline(typography.headline)}
      </h1>
      <p class="subtitle anim-elem" id="closingSubtitle" style="margin: 0 auto 40px; max-width: 800px;">
        ${this.escapeHtml(subtitleText)}
      </p>
      
      <div class="cta-pill anim-elem" id="closingCta" style="display: inline-flex; align-items: center; gap: 14px; background: ${palette.textColor === "#000000" ? "#000000" : `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`}; color: ${palette.textColor === "#000000" ? "#FFE600" : "#ffffff"}; border: 2px solid ${palette.textColor === "#000000" ? "#000000" : "transparent"}; padding: 18px 40px; border-radius: 999px; font-size: 22px; font-weight: 700; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        <span>${this.escapeHtml(typography.ctaText || "Explore Next Steps")}</span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>
    </div>`;

      default:
        return `
    <div class="standard-scene" style="max-width: 1100px; text-align: center; z-index: 10;">
      <div class="badge-tag anim-elem">${this.escapeHtml(typography.badge || "CHAPTER")}</div>
      <h1 class="headline anim-elem">${this.formatHighlightedHeadline(typography.headline)}</h1>
      <p class="subtitle anim-elem">${this.escapeHtml(subtitleText)}</p>
    </div>`;
    }
  }

  /**
   * Layout for Architecture & Process Flow Diagrams (SVG-driven).
   */
  private static renderDiagramLayout(scene: StoryboardScene): string {
    const { palette, typography, diagramSpec } = scene;
    const subtitleText = typography.subtitle || "";
    const nodes = diagramSpec?.nodes || [
      { label: "Data Input", sub: "Ingestion layer", icon: "brain" },
      { label: "AI Analysis", sub: "Neural engine", icon: "cpu" },
      { label: "Synthesis", sub: "Vector pipeline", icon: "shield" },
      { label: "Output Stream", sub: "Verified video", icon: "sparkles" },
    ];

    const nodeCardsHtml = nodes
      .map(
        (node, i) => `
        <div class="diagram-node glass-card anim-node" id="node-${i}" style="padding: 24px 28px; min-width: 200px; text-align: left; position: relative;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
            <span style="font-size: 13px; font-weight: 800; color: ${palette.accent}; letter-spacing: 0.1em;">STEP 0${i + 1}</span>
            <div style="width: 28px; height: 28px; border-radius: 8px; background: ${palette.textColor === "#000000" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"}; display: flex; align-items: center; justify-content: center;">
              ${this.getSvgIcon(node.icon || "cpu", palette.accent)}
            </div>
          </div>
          <div style="font-size: 18px; font-weight: 700; color: ${palette.textColor}; margin-bottom: 4px;">${this.escapeHtml(node.label)}</div>
          <div style="font-size: 13px; color: ${palette.subtextColor}; font-weight: 500;">${this.escapeHtml(node.sub || "")}</div>
        </div>
        ${
          i < nodes.length - 1
            ? `
        <div class="connector-arrow anim-node" style="display: flex; align-items: center; justify-content: center; padding: 0 4px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${palette.accent}" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </div>`
            : ""
        }`,
      )
      .join("\n");

    return `
    <div class="diagram-layout" style="width: 100%; max-width: 1400px; z-index: 10; display: flex; flex-direction: column; gap: 40px;">
      <div class="diagram-header" style="text-align: left;">
        <div class="badge-tag anim-elem" id="diagramBadge">${this.escapeHtml(typography.badge || "SYSTEM ARCHITECTURE")}</div>
        <h1 class="headline anim-elem" id="diagramTitle" style="font-size: 56px; margin-bottom: 16px;">
          ${this.formatHighlightedHeadline(typography.headline)}
        </h1>
        <p class="subtitle anim-elem" id="diagramSub" style="max-width: 880px;">
          ${this.escapeHtml(subtitleText)}
        </p>
      </div>

      <div class="diagram-canvas glass-card anim-elem" id="diagramCanvas" style="padding: 44px 36px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: ${palette.textColor === "#000000" ? "rgba(0, 0, 0, 0.05)" : "rgba(10, 16, 32, 0.55)"};">
        ${nodeCardsHtml}
      </div>
    </div>`;
  }

  /**
   * Layout for Statistics & Metrics Grid.
   */
  private static renderMetricsLayout(scene: StoryboardScene): string {
    const { palette, typography, metricData } = scene;
    const subtitleText = typography.subtitle || "";
    const metrics = metricData || [
      {
        label: "Performance Gain",
        value: "10x",
        detail: "Speed acceleration",
        trend: "+94% YoY",
      },
      {
        label: "System Reliability",
        value: "99.9%",
        detail: "Enterprise uptime",
        trend: "Optimal",
      },
      {
        label: "Active Users",
        value: "2.4M+",
        detail: "Global community",
        trend: "+120% YoY",
      },
    ];

    const cardsHtml = metrics
      .map(
        (m, idx) => `
      <div class="metric-card glass-card anim-metric" id="metricCard-${idx}" style="flex: 1; padding: 40px 36px; text-align: left; position: relative; overflow: hidden;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <span style="font-size: 14px; font-weight: 700; color: ${palette.subtextColor}; text-transform: uppercase; letter-spacing: 0.08em;">${this.escapeHtml(m.label)}</span>
          ${
            m.trend
              ? `
          <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 13px; font-weight: 700;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6"/></svg>
            ${this.escapeHtml(m.trend)}
          </span>`
              : ""
          }
        </div>
        <div class="metric-num" style="font-size: 68px; font-weight: 800; color: ${palette.textColor}; line-height: 1; margin-bottom: 14px; font-family: 'Space Grotesk', sans-serif;">
          ${this.escapeHtml(m.value)}
        </div>
        <div style="font-size: 16px; color: ${palette.subtextColor}; font-weight: 500;">
          ${this.escapeHtml(m.detail || "")}
        </div>
        <div style="position: absolute; right: -20px; bottom: -20px; width: 100px; height: 100px; border-radius: 50%; background: ${palette.accent}; opacity: 0.06; filter: blur(20px);"></div>
      </div>`,
      )
      .join("\n");

    return `
    <div class="metrics-layout" style="width: 100%; max-width: 1350px; z-index: 10;">
      <div class="metrics-header" style="text-align: left; margin-bottom: 40px;">
        <div class="badge-tag anim-elem" id="metricBadge">${this.escapeHtml(typography.badge || "PROVEN PERFORMANCE")}</div>
        <h1 class="headline anim-elem" id="metricTitle" style="font-size: 56px; margin-bottom: 16px;">
          ${this.formatHighlightedHeadline(typography.headline)}
        </h1>
        <p class="subtitle anim-elem" id="metricSub" style="max-width: 860px;">
          ${this.escapeHtml(subtitleText)}
        </p>
      </div>

      <div class="metrics-row" style="display: flex; gap: 28px; width: 100%;">
        ${cardsHtml}
      </div>
    </div>`;
  }

  /**
   * Layout for Comparative Analysis (Legacy vs Modern).
   */
  private static renderComparisonLayout(scene: StoryboardScene): string {
    const { palette, typography, comparisonData } = scene;
    const subtitleText = typography.subtitle || "";
    const comp = comparisonData || {
      leftTitle: "Legacy Approach",
      leftItems: [
        "Manual timeline stitching & render lag",
        "Fragmented media and lost project assets",
        "Inflexible templates and rigid layouts",
      ],
      rightTitle: "Next-Gen Paradigm",
      rightItems: [
        "Automated GSAP code synthesis in seconds",
        "Deterministic cloud storage & verified assets",
        "Frame-accurate dynamic visual generation",
      ],
    };

    const leftList = comp.leftItems
      .map(
        (item) => `
      <li style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; font-size: 17px; color: ${palette.subtextColor}; line-height: 1.4;">
        <div style="margin-top: 4px; color: #ef4444;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg></div>
        <span>${this.escapeHtml(item)}</span>
      </li>`,
      )
      .join("\n");

    const rightList = comp.rightItems
      .map(
        (item) => `
      <li style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; font-size: 17px; color: ${palette.textColor}; line-height: 1.4; font-weight: 500;">
        <div style="margin-top: 4px; color: #10b981;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg></div>
        <span>${this.escapeHtml(item)}</span>
      </li>`,
      )
      .join("\n");

    return `
    <div class="comparison-layout" style="width: 100%; max-width: 1350px; z-index: 10;">
      <div class="comparison-header" style="text-align: left; margin-bottom: 40px;">
        <div class="badge-tag anim-elem" id="compBadge">${this.escapeHtml(typography.badge || "SIDE-BY-SIDE EVALUATION")}</div>
        <h1 class="headline anim-elem" id="compTitle" style="font-size: 56px; margin-bottom: 16px;">
          ${this.formatHighlightedHeadline(typography.headline)}
        </h1>
        <p class="subtitle anim-elem" id="compSub" style="max-width: 860px;">
          ${this.escapeHtml(subtitleText)}
        </p>
      </div>

      <div class="comparison-grid" style="display: flex; gap: 32px; width: 100%;">
        <div class="comp-col glass-card anim-comp-left" style="flex: 1; padding: 40px 36px; border-color: rgba(239, 68, 68, 0.25);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444;"></span>
            <h3 style="font-size: 22px; font-weight: 700; color: #fca5a5;">${this.escapeHtml(comp.leftTitle)}</h3>
          </div>
          <ul style="list-style: none;">${leftList}</ul>
        </div>

        <div class="comp-col glass-card anim-comp-right" style="flex: 1; padding: 40px 36px; border-color: ${palette.accent}; box-shadow: 0 0 40px rgba(0, 168, 255, 0.15);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${palette.accent};"></span>
            <h3 style="font-size: 22px; font-weight: 700; color: ${palette.textColor};">${this.escapeHtml(comp.rightTitle)}</h3>
          </div>
          <ul style="list-style: none;">${rightList}</ul>
        </div>
      </div>
    </div>`;
  }

  /**
   * Layout for Authentic Image Presentation.
   */
  private static renderImageLayout(scene: StoryboardScene): string {
    const { palette, typography, imageSpec } = scene;
    const subtitleText = typography.subtitle || "";
    const assetPath = imageSpec?.assetName
      ? `assets/${imageSpec.assetName}`
      : "assets/ollasoftware-building.jpg";

    const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(assetPath);
    const badgeText = typography.badge || (isVideo ? "FEATURED VIDEO MOTION" : "VERIFIED MEDIA FEATURE");
    const captionText = imageSpec?.caption || (isVideo ? "High-Definition Video Reference" : "Authentic High-Resolution Asset");

    const mediaTag = isVideo
      ? `<video src="${assetPath}" class="hero-img-element" autoplay muted playsinline loop style="width: 100%; height: 100%; object-fit: cover; display: block;"></video>`
      : `<img src="${assetPath}" alt="Featured media" class="hero-img-element" style="width: 100%; height: 100%; object-fit: cover; display: block;" />`;

    const iconSvg = isVideo
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;

    return `
    <div class="image-showcase-layout" style="width: 100%; max-width: 1400px; z-index: 10; display: flex; align-items: center; gap: 60px;">
      <div class="image-text-col" style="flex: 1; text-align: left;">
        <div class="badge-tag anim-elem" id="imgBadge">${this.escapeHtml(badgeText)}</div>
        <h1 class="headline anim-elem" id="imgTitle" style="font-size: 56px; margin-bottom: 20px;">
          ${this.formatHighlightedHeadline(typography.headline)}
        </h1>
        <p class="subtitle anim-elem" id="imgSub" style="margin-bottom: 30px;">
          ${this.escapeHtml(subtitleText)}
        </p>
        <div class="feature-tag glass-card anim-elem" style="display: inline-flex; align-items: center; gap: 10px; padding: 12px 20px; font-size: 15px; font-weight: 600; color: ${palette.accent};">
          ${iconSvg}
          <span>${this.escapeHtml(captionText)}</span>
        </div>
      </div>

      <div class="image-media-col anim-image" id="imageMediaWrap" style="flex: 1.1; position: relative;">
        <div class="image-card glass-card" style="padding: 12px; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.45); border: 1px solid ${palette.borderColor};">
          <div style="position: relative; width: 100%; height: 460px; border-radius: 16px; overflow: hidden;">
            ${mediaTag}
            <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 65%, rgba(0,0,0,0.7) 100%);"></div>
            ${
              imageSpec?.overlayText
                ? `
            <div style="position: absolute; bottom: 20px; left: 24px; font-size: 16px; font-weight: 700; color: #ffffff; text-shadow: 0 2px 8px rgba(0,0,0,0.8);">
              ${this.escapeHtml(imageSpec.overlayText)}
            </div>`
                : ""
            }
          </div>
        </div>
      </div>
    </div>`;
  }

  /**
   * Generates frame-accurate, strictly paused GSAP timelines.
   */
  private static generateSceneGsapScript(scene: StoryboardScene): string {
    const { layout, duration } = scene;

    return `
    // Progress bar animation across scene duration
    tl.to("#progressBar", { width: "100%", duration: ${duration}, ease: "none" }, 0);

    // Entrance animation for common elements
    tl.from(".anim-elem", {
      opacity: 0,
      y: 35,
      stagger: 0.12,
      duration: 1.0,
      ease: "power3.out"
    }, 0.2);

    ${
      layout === "split-diagram" || layout === "process-flow"
        ? `
    // Diagram nodes entrance & pulse
    tl.from(".anim-node", {
      opacity: 0,
      scale: 0.9,
      y: 20,
      stagger: 0.15,
      duration: 0.9,
      ease: "back.out(1.5)"
    }, 0.6);
    `
        : ""
    }

    ${
      layout === "metrics-grid"
        ? `
    // Metrics grid staggered scale
    tl.from(".anim-metric", {
      opacity: 0,
      y: 40,
      scale: 0.95,
      stagger: 0.18,
      duration: 1.1,
      ease: "power3.out"
    }, 0.5);
    `
        : ""
    }

    ${
      layout === "comparison-cards"
        ? `
    // Comparison cards directional entrance
    tl.from(".anim-comp-left", { opacity: 0, x: -50, duration: 1.0, ease: "power3.out" }, 0.5);
    tl.from(".anim-comp-right", { opacity: 0, x: 50, duration: 1.0, ease: "power3.out" }, 0.7);
    `
        : ""
    }

    ${
      layout === "image-showcase"
        ? `
    // Image card entrance and smooth subtle Ken Burns zoom
    tl.from("#imageMediaWrap", { opacity: 0, scale: 0.94, duration: 1.1, ease: "power3.out" }, 0.4);
    tl.fromTo(".hero-img-element", 
      { scale: 1.0 }, 
      { scale: 1.06, duration: ${duration}, ease: "none" }, 
      0
    );
    `
        : ""
    }

    ${
      layout === "cinematic-title"
        ? `
    // Subtle background glow expansion
    tl.fromTo(".bg-glow-spot", 
      { scale: 0.85, opacity: 0.2 }, 
      { scale: 1.15, opacity: 0.45, duration: ${duration}, ease: "sine.inOut" }, 
      0
    );
    `
        : ""
    }

    // Smooth exit transition at end of scene
    const exitTime = Math.max(${duration - 0.5}, 0.8);
    tl.to("#root", {
      opacity: 0,
      duration: 0.4,
      ease: "power2.in"
    }, exitTime);
    `;
  }

  private static getLayoutSpecificStyles(
    layout: SceneLayoutType,
    palette: StoryboardScene["palette"],
  ): string {
    return `
    .diagram-canvas {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .metric-card {
      /* Stat card styling */
    }
    `;
  }

  private static formatHighlightedHeadline(headline: string): string {
    const escaped = this.escapeHtml(headline);
    const words = escaped.split(" ");
    if (words.length <= 3) {
      return words.join(" ");
    }
    // Highlight the last 2 words with accent gradient
    const normal = words.slice(0, words.length - 2).join(" ");
    const highlighted = words.slice(words.length - 2).join(" ");
    return `${normal} <span class="highlight">${highlighted}</span>`;
  }

  private static getSvgIcon(iconName: string, color: string): string {
    switch (iconName) {
      case "brain":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04z"/></svg>`;
      case "cpu":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>`;
      case "shield":
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
      default:
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
    }
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

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
      padding: ${layout === "animated-bar-chart" ? "40px 60px" : "70px 90px"};
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

      case "animated-bar-chart":
        return this.renderBarChartLayout(scene);

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

      case "comic-ad-hook":
        return this.renderComicAdHook(scene);

      case "comic-dossier":
        return this.renderComicDossier(scene);

      case "comic-arsenal":
        return this.renderComicArsenal(scene);

      case "comic-trailer-cta":
        return this.renderComicTrailerCta(scene);

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
   * Layout for Animated Financial / Revenue Bar Charts.
   */
  private static renderBarChartLayout(scene: StoryboardScene): string {
    const { palette, typography, diagramSpec, metricData } = scene;
    const subtitleText = typography.subtitle || "";

    // Determine bars from diagramSpec.bars, metricData, or realistic trajectory
    let bars: Array<{ label: string; value: number; formattedValue: string; color?: string }> = [];

    if (diagramSpec?.bars && diagramSpec.bars.length > 0) {
      bars = diagramSpec.bars.map((b) => ({
        label: b.label,
        value: typeof b.value === "number" ? b.value : parseFloat(String(b.value)) || 50,
        formattedValue: (b as any).formattedValue || (typeof b.value === "number" ? `$${b.value}M` : String(b.value)),
        color: b.color || palette.accent,
      }));
    } else if (metricData && metricData.length > 0) {
      bars = metricData.map((m, idx) => ({
        label: m.label,
        value: 30 + idx * 25,
        formattedValue: m.value,
        color: palette.accent,
      }));
    } else {
      bars = [
        { label: "Q1 2024", value: 35, formattedValue: "$1.4M", color: palette.primary },
        { label: "Q2 2024", value: 55, formattedValue: "$2.8M", color: palette.secondary },
        { label: "Q3 2024", value: 78, formattedValue: "$4.5M", color: palette.accent },
        { label: "Q4 2024", value: 98, formattedValue: "$7.2M", color: "#10b981" },
      ];
    }

    const maxValue = Math.max(...bars.map((b) => b.value), 100);

    const barsHtml = bars
      .map((bar, i) => {
        const heightPct = Math.max(18, Math.min(100, Math.round((bar.value / maxValue) * 100)));
        const barGradient = `linear-gradient(180deg, ${bar.color || palette.accent} 0%, ${palette.primary} 100%)`;

        return `
        <div class="chart-col" style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; position: relative; max-width: 170px;">
          <!-- Floating Value Number -->
          <div class="anim-bar-val" id="barVal-${i}" style="margin-bottom: 14px; font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 800; color: ${palette.textColor}; text-shadow: 0 4px 14px rgba(0,0,0,0.6); letter-spacing: -0.02em;">
            ${this.escapeHtml(bar.formattedValue)}
          </div>

          <!-- Bar Outer Track & Growing Fill -->
          <div style="width: 100%; max-width: 120px; height: 250px; display: flex; align-items: flex-end; justify-content: center; position: relative;">
            <div class="anim-chart-bar" id="chartBar-${i}" style="width: 100%; height: ${heightPct}%; background: ${barGradient}; border-radius: 12px 12px 4px 4px; box-shadow: 0 12px 32px ${palette.accent ? `${palette.accent}45` : "rgba(0, 212, 255, 0.35)"}; border: 1px solid rgba(255,255,255,0.22); transform-origin: bottom center; position: relative; overflow: hidden;">
              <!-- Glossy Bar Highlight -->
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 35%; background: linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 100%);"></div>
            </div>
          </div>

          <!-- Bottom Label -->
          <div class="anim-bar-label" id="barLbl-${i}" style="margin-top: 16px; font-size: 14px; font-weight: 700; color: ${palette.subtextColor}; text-transform: uppercase; letter-spacing: 0.08em; text-align: center;">
            ${this.escapeHtml(bar.label)}
          </div>
        </div>`;
      })
      .join("\n");

    return `
    <div class="bar-chart-layout" style="width: 100%; max-width: 1380px; z-index: 10;">
      <!-- Header Section -->
      <div style="text-align: center; margin-bottom: 22px;">
        <div class="badge-tag anim-elem" id="chartBadge" style="margin-bottom: 12px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${palette.accent}" stroke-width="3"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
          ${this.escapeHtml(typography.badge || "REVENUE & GROWTH METRICS")}
        </div>
        <h1 class="headline anim-elem" id="chartTitle" style="font-size: 48px; margin-bottom: 8px;">
          ${this.formatHighlightedHeadline(typography.headline)}
        </h1>
        <p class="subtitle anim-elem" id="chartSub" style="margin: 0 auto; max-width: 860px; font-size: 20px;">
          ${this.escapeHtml(subtitleText)}
        </p>
      </div>

      <!-- Chart Glass Card Canvas (no anim-elem to prevent double-tween opacity conflict) -->
      <div class="glass-card" id="barChartCanvas" style="padding: 28px 44px 22px; position: relative; background: ${palette.textColor === "#000000" ? "rgba(255,255,255,0.92)" : "rgba(10, 16, 32, 0.75)"}; border: 1px solid ${palette.borderColor}; border-radius: 20px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);">
        <!-- Background Gridlines -->
        <div style="position: absolute; inset: 28px 44px 48px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; opacity: 0.18; border-bottom: 2px solid ${palette.borderColor};">
          <div style="border-top: 1px dashed ${palette.textColor}; width: 100%;"></div>
          <div style="border-top: 1px dashed ${palette.textColor}; width: 100%;"></div>
          <div style="border-top: 1px dashed ${palette.textColor}; width: 100%;"></div>
          <div style="border-top: 1px dashed ${palette.textColor}; width: 100%;"></div>
        </div>

        <!-- Bars Flex Container -->
        <div style="display: flex; align-items: flex-end; justify-content: space-around; gap: 20px; height: 330px; position: relative; z-index: 2;">
          ${barsHtml}
        </div>
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

  private static renderComicAdHook(scene: StoryboardScene): string {
    const { typography, comicSpec } = scene;
    const banner = comicSpec?.banner || "DC COMICS • ALL IN SPECIAL";
    const subTagline = comicSpec?.subTagline || "The Dark Knight is reborn from Gotham's raw concrete.";

    return `
    <div class="comic-action-bg" id="actionBg"></div>
    <div class="comic-bat-watermark" id="batWatermark">
      <svg width="100%" height="100%" viewBox="0 0 220 110" fill="none">
        <path d="M10 20 L60 20 L80 45 L110 25 L140 45 L160 20 L210 20 L195 75 L140 75 L110 95 L80 75 L25 75 Z" fill="#000000"/>
      </svg>
    </div>

    <div class="comic-hook-layout" id="rootContent" style="text-align: center; max-width: 1300px; width: 100%; z-index: 10; display: flex; flex-direction: column; align-items: center;">
      <!-- DC Publisher Header Bar -->
      <div id="publisherBar" style="display: inline-flex; align-items: center; gap: 14px; background: #000000; color: #FFE600; padding: 10px 28px; font-weight: 900; font-size: 16px; letter-spacing: 0.16em; text-transform: uppercase; border: 3px solid #000000; box-shadow: 6px 6px 0px rgba(0,0,0,0.4); margin-bottom: 22px;">
        <span style="display: inline-block; width: 12px; height: 12px; background: #FFE600; border-radius: 2px;"></span>
        ${this.escapeHtml(banner)}
      </div>

      <!-- Center Bat-Axe Emblem Graphic -->
      <div id="batAxeIcon" style="margin-bottom: 20px;">
        <svg width="220" height="110" viewBox="0 0 220 110" fill="none" style="filter: drop-shadow(8px 8px 0px rgba(0,0,0,0.4));">
          <path d="M10 20 L60 20 L80 45 L110 25 L140 45 L160 20 L210 20 L195 75 L140 75 L110 95 L80 75 L25 75 Z" fill="#000000"/>
          <line x1="110" y1="12" x2="110" y2="98" stroke="#FFE600" stroke-width="4" stroke-dasharray="6 4"/>
        </svg>
      </div>

      <!-- Giant Comic Title Box -->
      <div id="comicLogoWrap" style="background: #000000; padding: 26px 56px; border: 8px solid #000000; box-shadow: 14px 14px 0px #000000; transform: skewX(-2deg); margin-bottom: 28px; display: inline-block;">
        <h1 style="font-family: 'Space Grotesk', 'Syne', sans-serif; font-size: 92px; font-weight: 900; letter-spacing: -0.04em; text-transform: uppercase; line-height: 0.95; margin: 0; color: #FFE600;">
          ${this.escapeHtml(typography.headline)}
        </h1>
      </div>

      <!-- Action Comic Tagline: Broken into 3 Staggered Impact Punches -->
      <div id="taglineWrap" style="display: flex; gap: 14px; align-items: center; justify-content: center; margin-bottom: 16px; flex-wrap: wrap;">
        <span class="anim-tagline-punch" style="font-size: 34px; font-weight: 900; background: #000000; color: #FFE600; padding: 6px 16px; transform: skewX(-2deg); box-shadow: 4px 4px 0px rgba(0,0,0,0.3);">WITHOUT MONEY.</span>
        <span class="anim-tagline-punch" style="font-size: 34px; font-weight: 900; background: #000000; color: #FFE600; padding: 6px 16px; transform: skewX(-2deg); box-shadow: 4px 4px 0px rgba(0,0,0,0.3);">WITHOUT AN EMPIRE.</span>
        <span class="anim-tagline-punch" style="font-size: 34px; font-weight: 900; background: #000000; color: #FFE600; padding: 6px 16px; transform: skewX(-2deg); box-shadow: 4px 4px 0px rgba(0,0,0,0.3);">WITHOUT MERCY.</span>
      </div>

      <p id="subTaglineText" style="font-size: 24px; font-weight: 600; color: #18181b; max-width: 900px; margin: 0 auto; line-height: 1.4;">
        ${this.escapeHtml(subTagline)}
      </p>

      <!-- Comic Corner Stamp -->
      <div id="creatorStamp" style="margin-top: 30px; display: inline-flex; gap: 12px; align-items: center; border: 3px solid #000000; padding: 8px 22px; background: rgba(0,0,0,0.06); font-weight: 800; font-size: 15px; letter-spacing: 0.12em; text-transform: uppercase; color: #000000;">
        <span>DC ALL IN</span>
        <span>•</span>
        <span>SCOTT SNYDER</span>
        <span>•</span>
        <span>NICK DRAGOTTA</span>
      </div>
    </div>`;
  }

  private static renderComicDossier(scene: StoryboardScene): string {
    const { comicSpec } = scene;
    const panels = comicSpec?.dossierPanels || [
      {
        title: "CIVIL ENGINEER",
        category: "MUNICIPAL ARCHITECTURE",
        description: "Constructed Gotham's bridges, subways, and tunnels. Knows every structural flaw in the city.",
        tag: "ORIGIN",
        stat: "BLUE-COLLAR",
      },
      {
        title: "6'6\" // 250 LBS TANK",
        category: "PHYSICAL JUGGERNAUT",
        description: "A terrifying wall of muscle and bone. Built to fight in the trenches and overpower entire armed syndicates alone.",
        tag: "PHYSIQUE",
        stat: "DOMINANT",
      },
      {
        title: "$0 TRUST FUND",
        category: "CRIME ALLEY SURVIVOR",
        description: "No Wayne Manor. No butler. No billionaire safety net. Fueled purely by blue-collar sweat and survival grit.",
        tag: "LEGACY",
        stat: "100% GRIT",
      },
    ];

    const panelsHtml = panels
      .map(
        (p, i) => `
      <div class="comic-panel anim-comic-panel" id="panel-${i}" style="flex: 1; background: #FFE600; border: 5px solid #000000; box-shadow: 10px 10px 0px #000000; padding: 34px 28px; display: flex; flex-direction: column; justify-content: space-between; transform: skewX(-1.5deg); min-height: 400px; position: relative;">
        <div>
          <!-- Category & Tag header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; border-bottom: 3px solid #000000; padding-bottom: 12px;">
            <span style="font-size: 13px; font-weight: 900; color: #000000; letter-spacing: 0.14em; text-transform: uppercase;">
              ${this.escapeHtml(p.tag || `DOSSIER 0${i + 1}`)}
            </span>
            <span style="background: #000000; color: #FFE600; font-size: 12px; font-weight: 900; padding: 4px 10px; letter-spacing: 0.1em; text-transform: uppercase;">
              ${this.escapeHtml(p.stat || "VERIFIED")}
            </span>
          </div>

          <!-- Title -->
          <h2 style="font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 900; color: #000000; text-transform: uppercase; line-height: 1.1; margin-bottom: 10px; letter-spacing: -0.02em;">
            ${this.escapeHtml(p.title)}
          </h2>

          <div style="font-size: 13px; font-weight: 800; color: #18181b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px;">
            // ${this.escapeHtml(p.category)}
          </div>

          <!-- Description -->
          <p style="font-size: 17px; font-weight: 600; color: #000000; line-height: 1.45;">
            ${this.escapeHtml(p.description)}
          </p>
        </div>

        <div>
          <!-- Animated Progress Gauge Bar -->
          <div class="meter-container">
            <div class="meter-fill" id="meter-${i}"></div>
          </div>
          <div style="margin-top: 10px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; color: #000000; letter-spacing: 0.12em; text-transform: uppercase;">
            <span>ACTIVE METRIC</span>
            <span>100% VERIFIED</span>
          </div>
        </div>
      </div>`,
      )
      .join("\n");

    return `
    <div class="comic-action-bg" id="actionBg"></div>
    <div class="comic-dossier-layout" id="rootContent" style="width: 100%; max-width: 1420px; z-index: 10; display: flex; flex-direction: column; gap: 32px;">
      <!-- Header Bar -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 5px solid #000000; padding-bottom: 20px;">
        <div id="dossierHeaderLeft">
          <div style="display: inline-block; background: #000000; color: #FFE600; padding: 6px 16px; font-weight: 900; font-size: 13px; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 10px;">
            CASE FILE // DOSSIER: BRUCE WAYNE
          </div>
          <h1 class="headline" style="font-size: 58px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: -0.03em; margin: 0; line-height: 1;">
            WHO IS THE <span style="background: #000000; color: #FFE600; padding: 2px 14px; display: inline-block; transform: skewX(-2deg);">ABSOLUTE BATMAN?</span>
          </h1>
        </div>
        <div id="classifiedStamp" style="font-size: 15px; font-weight: 900; color: #000000; text-transform: uppercase; border: 4px solid #000000; padding: 8px 18px; background: rgba(0,0,0,0.06); box-shadow: 4px 4px 0px #000000;">
          CONFIDENTIAL // DC ALL IN
        </div>
      </div>

      <!-- 3 Panels Row -->
      <div style="display: flex; gap: 24px; width: 100%;">
        ${panelsHtml}
      </div>
    </div>`;
  }

  private static renderComicArsenal(scene: StoryboardScene): string {
    const { comicSpec } = scene;
    const weapons = comicSpec?.weapons || [
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
    ];

    const weaponIcons = [
      // Battleaxe SVG
      `<svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#FFE600" stroke-width="2.5"><path d="M14 2l6 6-5 5-6-6 5-5z"/><path d="M4 20l10-10"/><path d="M19 3l2 2"/></svg>`,
      // Hooked Cape SVG
      `<svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#FFE600" stroke-width="2.5"><path d="M12 2v8M8 6l4 4 4-4"/><path d="M6 14a6 6 0 0 0 12 0"/></svg>`,
      // Exosuit Armor SVG
      `<svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#FFE600" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>`,
    ];

    const cardsHtml = weapons
      .map(
        (w, i) => `
      <div class="comic-weapon anim-comic-weapon" id="weapon-${i}" style="flex: 1; background: #000000; color: #FFE600; border: 5px solid #000000; box-shadow: 10px 10px 0px rgba(0,0,0,0.4); padding: 34px 28px; display: flex; flex-direction: column; justify-content: space-between; transform: skewX(-1deg); min-height: 400px; position: relative; overflow: hidden;">
        <div class="weapon-shine-line" id="shine-${i}"></div>
        <div>
          <!-- Type badge -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid rgba(255,230,0,0.4); padding-bottom: 12px;">
            <span style="font-size: 13px; font-weight: 900; color: #FFE600; letter-spacing: 0.15em; text-transform: uppercase;">
              ${this.escapeHtml(w.type)}
            </span>
            <span style="background: #FFE600; color: #000000; font-size: 12px; font-weight: 900; padding: 4px 10px; letter-spacing: 0.1em; text-transform: uppercase;">
              ${this.escapeHtml(w.badge || "LETHAL")}
            </span>
          </div>

          <!-- Weapon Icon Box -->
          <div class="anim-weapon-icon" id="weaponIcon-${i}" style="margin-bottom: 18px; display: inline-flex; padding: 10px; background: rgba(255,230,0,0.1); border: 2px solid rgba(255,230,0,0.3); border-radius: 8px;">
            ${weaponIcons[i]}
          </div>

          <!-- Weapon Name -->
          <h2 style="font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 900; color: #FFE600; text-transform: uppercase; line-height: 1.1; margin-bottom: 14px; letter-spacing: -0.02em;">
            ${this.escapeHtml(w.name)}
          </h2>

          <!-- Description -->
          <p style="font-size: 17px; font-weight: 500; color: #f4f4f5; line-height: 1.45;">
            ${this.escapeHtml(w.description)}
          </p>
        </div>

        <div style="margin-top: 20px; border-top: 2px dashed rgba(255,230,0,0.4); padding-top: 10px; font-size: 12px; font-weight: 900; color: #FFE600; letter-spacing: 0.15em; text-transform: uppercase;">
          TACTICAL SPEC // 0${i + 1}
        </div>
      </div>`,
      )
      .join("\n");

    return `
    <div class="comic-action-bg" id="actionBg"></div>
    <div class="comic-arsenal-layout" id="rootContent" style="width: 100%; max-width: 1420px; z-index: 10; display: flex; flex-direction: column; gap: 32px;">
      <!-- Header Bar -->
      <div id="arsenalHeader" style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 5px solid #000000; padding-bottom: 20px;">
        <div>
          <div style="display: inline-block; background: #000000; color: #FFE600; padding: 6px 16px; font-weight: 900; font-size: 13px; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 10px;">
            TACTICAL HARDWARE &amp; ARSENAL
          </div>
          <h1 class="headline" style="font-size: 58px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: -0.03em; margin: 0; line-height: 1;">
            ENGINEERED FOR <span style="background: #000000; color: #FFE600; padding: 2px 14px; display: inline-block; transform: skewX(-2deg);">TOTAL WAR</span>
          </h1>
        </div>
        <div style="font-size: 15px; font-weight: 900; color: #000000; text-transform: uppercase; border: 4px solid #000000; padding: 8px 18px; background: rgba(0,0,0,0.06); box-shadow: 4px 4px 0px #000000;">
          HEAVY INDUSTRIAL COMBAT
        </div>
      </div>

      <!-- 3 Weapon Cards Row -->
      <div style="display: flex; gap: 24px; width: 100%;">
        ${cardsHtml}
      </div>
    </div>`;
  }

  private static renderComicTrailerCta(scene: StoryboardScene): string {
    const { comicSpec } = scene;
    const issueTitle = comicSpec?.issueTitle || "ABSOLUTE BATMAN #1";
    const creators = comicSpec?.creators || "WRITTEN BY SCOTT SNYDER • ART BY NICK DRAGOTTA • COLORS BY FRANK MARTIN";
    const publisher = comicSpec?.publisher || "DC COMICS • THE ABSOLUTE UNIVERSE";
    const ctaAction = comicSpec?.ctaAction || "AVAILABLE NOW AT YOUR LOCAL COMIC SHOP";
    const subCta = comicSpec?.subCta || "READ DIGITALLY ON DC UNIVERSE INFINITE";

    return `
    <div class="comic-action-bg" id="actionBg"></div>
    <div class="comic-cta-layout" id="rootContent" style="text-align: center; max-width: 1250px; width: 100%; z-index: 10; display: flex; flex-direction: column; align-items: center;">
      <!-- Dramatic Quote with Dual Kinetic Punch -->
      <div style="display: flex; gap: 16px; align-items: center; justify-content: center; margin-bottom: 24px; flex-wrap: wrap;">
        <span id="quotePart1" style="font-size: 44px; font-weight: 900; color: #000000; text-transform: uppercase; letter-spacing: -0.02em; text-shadow: 2px 2px 0px rgba(0,0,0,0.12);">"I AM THE CONCRETE.</span>
        <span id="quotePart2" style="font-size: 44px; font-weight: 900; background: #000000; color: #FFE600; padding: 4px 18px; text-transform: uppercase; letter-spacing: -0.02em; transform: skewX(-2deg); box-shadow: 4px 4px 0px rgba(0,0,0,0.3);">I AM THE BAT."</span>
      </div>

      <!-- Official Comic Box -->
      <div id="comicIssueBox" class="pulse-border-box" style="background: #000000; color: #FFE600; padding: 40px 60px; width: 100%; max-width: 1080px; margin-bottom: 30px; transform: skewX(-1.5deg);">
        <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.22em; text-transform: uppercase; margin-bottom: 12px; color: #FFE600;">
          ${this.escapeHtml(publisher)}
        </div>
        <h1 style="font-family: 'Space Grotesk', 'Syne', sans-serif; font-size: 80px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.04em; line-height: 0.95; margin: 0 0 18px; color: #FFE600;">
          ${this.escapeHtml(issueTitle)}
        </h1>
        <div style="font-size: 18px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #FFE600; border-top: 2px solid rgba(255,230,0,0.4); border-bottom: 2px solid rgba(255,230,0,0.4); padding: 10px 0;">
          ${this.escapeHtml(creators)}
        </div>
      </div>

      <!-- Action Trailer CTA Button with Bouncing Arrow -->
      <div id="comicCtaBtn" style="display: inline-flex; align-items: center; gap: 16px; background: #000000; color: #FFE600; padding: 20px 48px; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; border: 4px solid #000000; box-shadow: 8px 8px 0px #000000; margin-bottom: 16px;">
        <span>${this.escapeHtml(ctaAction)}</span>
        <svg class="cta-arrow-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>

      <div id="subCtaText" style="font-size: 16px; font-weight: 800; color: #000000; letter-spacing: 0.12em; text-transform: uppercase;">
        ${this.escapeHtml(subCta)}
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
      layout === "comic-ad-hook"
        ? `
    // Dynamic background speedlines continuous pan
    tl.to("#actionBg", { backgroundPosition: "300px 300px", duration: ${duration}, ease: "none" }, 0);
    // Subtle Bat watermark breathing
    tl.fromTo("#batWatermark", { scale: 0.9, opacity: 0.03 }, { scale: 1.15, opacity: 0.08, duration: ${duration}, ease: "sine.inOut" }, 0);

    // Camera slow cinematic zoom
    tl.fromTo("#rootContent", { scale: 0.96 }, { scale: 1.03, duration: ${duration}, ease: "none" }, 0);

    // Publisher bar drop
    tl.from("#publisherBar", { y: -50, opacity: 0, duration: 0.7, ease: "back.out(1.8)" }, 0.15);

    // Bat-Axe Emblem explosive slam
    tl.from("#batAxeIcon", { scale: 0, rotation: -90, opacity: 0, duration: 0.8, ease: "back.out(2)" }, 0.3);
    // Bat-Axe continuous subtle breathing pulse
    tl.to("#batAxeIcon", { scale: 1.08, duration: 2.5, yoyo: true, repeat: 2, ease: "sine.inOut" }, 1.2);

    // Main Title explosive slam with 3D drop-shadow expansion
    tl.from("#comicLogoWrap", { scale: 1.6, y: -40, opacity: 0, duration: 0.75, ease: "power4.out" }, 0.45);
    tl.fromTo("#comicLogoWrap", { boxShadow: "0px 0px 0px #000000" }, { boxShadow: "14px 14px 0px #000000", duration: 0.4, ease: "power2.out" }, 0.75);

    // Staggered Tagline punches
    tl.from(".anim-tagline-punch", { scale: 0.2, y: 30, opacity: 0, stagger: 0.22, duration: 0.6, ease: "back.out(2.2)" }, 0.9);

    // Subtitle & creator stamp slide-up
    tl.from("#subTaglineText", { opacity: 0, y: 20, duration: 0.7, ease: "power2.out" }, 1.6);
    tl.from("#creatorStamp", { opacity: 0, scale: 0.8, duration: 0.6, ease: "back.out(1.5)" }, 1.8);
    `
        : ""
    }

    ${
      layout === "comic-dossier"
        ? `
    // Background speedlines continuous pan
    tl.to("#actionBg", { backgroundPosition: "300px 300px", duration: ${duration}, ease: "none" }, 0);
    // Camera slow drift
    tl.fromTo("#rootContent", { scale: 0.97 }, { scale: 1.03, duration: ${duration}, ease: "none" }, 0);

    // Header entrance
    tl.from("#dossierHeaderLeft", { x: -60, opacity: 0, duration: 0.8, ease: "power3.out" }, 0.2);
    // Classified stamp drops and tilts
    tl.from("#classifiedStamp", { scale: 2.2, rotation: -30, opacity: 0, duration: 0.6, ease: "back.out(1.8)" }, 0.35);

    // 3 Panels staggered slam
    tl.from(".anim-comic-panel", {
      opacity: 0,
      y: 70,
      scale: 0.88,
      stagger: 0.22,
      duration: 0.8,
      ease: "back.out(1.6)"
    }, 0.5);

    // Meters fill sequentially via transform scaleX
    tl.fromTo("#meter-0", { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power2.out" }, 1.2);
    tl.fromTo("#meter-1", { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power2.out" }, 1.45);
    tl.fromTo("#meter-2", { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power2.out" }, 1.7);

    // Continuous floating/hovering of the 3 panels
    tl.to("#panel-0", { y: -10, duration: 2.6, yoyo: true, repeat: 1, ease: "sine.inOut", overwrite: "auto" }, 1.8);
    tl.to("#panel-1", { y: -14, duration: 2.3, yoyo: true, repeat: 1, ease: "sine.inOut", overwrite: "auto" }, 2.0);
    tl.to("#panel-2", { y: -8, duration: 2.9, yoyo: true, repeat: 1, ease: "sine.inOut", overwrite: "auto" }, 2.2);
    `
        : ""
    }

    ${
      layout === "comic-arsenal"
        ? `
    // Background speedlines continuous pan
    tl.to("#actionBg", { backgroundPosition: "300px 300px", duration: ${duration}, ease: "none" }, 0);
    // Camera slow drift
    tl.fromTo("#rootContent", { scale: 0.97 }, { scale: 1.03, duration: ${duration}, ease: "none" }, 0);

    // Header entrance
    tl.from("#arsenalHeader", { y: -40, opacity: 0, duration: 0.7, ease: "power3.out" }, 0.2);

    // 3 Weapon cards staggered slide-in
    tl.from(".anim-comic-weapon", {
      opacity: 0,
      x: 100,
      scale: 0.9,
      stagger: 0.2,
      duration: 0.85,
      ease: "power4.out"
    }, 0.4);

    // Weapon icons bounce in
    tl.from(".anim-weapon-icon", {
      scale: 0,
      rotation: -120,
      stagger: 0.2,
      duration: 0.75,
      ease: "back.out(2)"
    }, 0.75);

    // Gleaming light sweep across each weapon card using transforms (x)
    tl.fromTo("#shine-0", { x: -400 }, { x: 700, duration: 1.2, ease: "power2.inOut" }, 1.3);
    tl.fromTo("#shine-1", { x: -400 }, { x: 700, duration: 1.2, ease: "power2.inOut" }, 1.6);
    tl.fromTo("#shine-2", { x: -400 }, { x: 700, duration: 1.2, ease: "power2.inOut" }, 1.9);

    // Battleaxe card impact cleave shake
    tl.to("#weapon-0", { scale: 1.04, duration: 0.15, yoyo: true, repeat: 1, ease: "power1.inOut", overwrite: "auto" }, 2.5);
    tl.to("#weapon-1", { scale: 1.03, duration: 0.15, yoyo: true, repeat: 1, ease: "power1.inOut", overwrite: "auto" }, 2.8);
    tl.to("#weapon-2", { scale: 1.03, duration: 0.15, yoyo: true, repeat: 1, ease: "power1.inOut", overwrite: "auto" }, 3.1);
    `
        : ""
    }

    ${
      layout === "comic-trailer-cta"
        ? `
    // Background speedlines continuous pan
    tl.to("#actionBg", { backgroundPosition: "300px 300px", duration: ${duration}, ease: "none" }, 0);
    // Camera slow push
    tl.fromTo("#rootContent", { scale: 0.96 }, { scale: 1.04, duration: ${duration}, ease: "none" }, 0);

    // Dramatic quote sequential punch reveals
    tl.from("#quotePart1", { y: -40, opacity: 0, scale: 0.8, duration: 0.6, ease: "power4.out" }, 0.2);
    tl.from("#quotePart2", { y: 40, opacity: 0, scale: 1.3, duration: 0.7, ease: "back.out(2)" }, 0.6);

    // Comic Issue Box explosive slam
    tl.from("#comicIssueBox", { scale: 1.4, opacity: 0, duration: 0.6, ease: "power4.out" }, 0.9);
    tl.fromTo("#comicIssueBox", { boxShadow: "0px 0px 0px #000000" }, { boxShadow: "16px 16px 0px #000000", duration: 0.4, ease: "power2.out" }, 1.3);

    // Pulsing Comic Issue Box border breathing (starts after slam at 1.8s)
    tl.to("#comicIssueBox", { scale: 1.02, duration: 1.8, yoyo: true, repeat: 2, ease: "sine.inOut", overwrite: "auto" }, 1.8);

    // Action CTA button drops and breathes
    tl.from("#comicCtaBtn", { y: 40, opacity: 0, scale: 0.85, duration: 0.45, ease: "back.out(2)" }, 1.5);
    tl.to("#comicCtaBtn", { scale: 1.05, duration: 0.8, yoyo: true, repeat: 4, ease: "sine.inOut", overwrite: "auto" }, 2.1);

    // Arrow SVG continuous bouncing
    tl.to(".cta-arrow-svg", { x: 10, duration: 0.4, yoyo: true, repeat: 9, ease: "power1.inOut" }, 2.1);

    // Sub CTA text fade
    tl.from("#subCtaText", { opacity: 0, y: 15, duration: 0.5, ease: "power2.out" }, 1.9);
    `
        : ""
    }

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
      ease: "back.out(1.7)"
    }, 0.5);
    `
        : ""
    }

    ${
      layout === "animated-bar-chart"
        ? `
    // Bar chart container entrance
    tl.fromTo("#barChartCanvas", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.75, ease: "power2.out" }, 0.25);

    // Staggered bars growing upwards from zero using transform scaleY
    tl.fromTo(".anim-chart-bar",
      { scaleY: 0, transformOrigin: "bottom center" },
      { scaleY: 1, duration: 1.2, stagger: 0.12, ease: "power3.out" },
      0.5
    );

    // Staggered bar value numbers and labels fade in with pop
    tl.fromTo(".anim-bar-val", { opacity: 0, y: -10, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, stagger: 0.12, duration: 0.5, ease: "back.out(1.5)" }, 0.8);
    tl.fromTo(".anim-bar-label", { opacity: 0 }, { opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out" }, 0.7);
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

    /* Comic Action Speedlines Background */
    .comic-action-bg {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        -45deg,
        rgba(0, 0, 0, 0.035),
        rgba(0, 0, 0, 0.035) 20px,
        transparent 20px,
        transparent 40px
      );
      pointer-events: none;
      z-index: 1;
    }

    /* Comic Bat Watermark */
    .comic-bat-watermark {
      position: absolute;
      width: 850px;
      height: 420px;
      opacity: 0.055;
      pointer-events: none;
      z-index: 2;
    }

    /* Weapon shine effect */
    .weapon-shine-line {
      position: absolute;
      top: 0;
      left: 0;
      width: 50%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 230, 0, 0.45), transparent);
      transform: skewX(-25deg);
      pointer-events: none;
    }

    /* Meter styles for Dossier */
    .meter-container {
      width: 100%;
      height: 10px;
      background: rgba(0, 0, 0, 0.15);
      border: 2px solid #000000;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 14px;
    }
    .meter-fill {
      height: 100%;
      background: #000000;
      width: 100%;
      transform-origin: left center;
    }

    /* Pulsing border */
    .pulse-border-box {
      border: 7px solid #000000;
      box-shadow: 16px 16px 0px #000000;
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

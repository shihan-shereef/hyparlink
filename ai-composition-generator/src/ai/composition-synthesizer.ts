import { CreativeBrief } from "./creative-brief.js";
import { PlannedTimeline, PlannedScene } from "./scene-planner.js";
import { AnalyzedAsset } from "./asset-analyzer.js";

export interface SynthesizedProjectFiles {
  files: Record<string, string>;
  metadata: {
    title: string;
    duration: number;
    width: number;
    height: number;
    fps: number;
  };
}

export class CompositionSynthesizer {
  /**
   * Synthesizes fully customized, dynamic HyperFrames 0.8.139 compositions.
   * Free of hardcoded templates or forced .bg-grid styles.
   */
  public static synthesize(
    brief: CreativeBrief,
    timeline: PlannedTimeline,
    analyzedAssets: AnalyzedAsset[],
    specs: { width: number; height: number; fps: number },
  ): SynthesizedProjectFiles {
    const { width, height, fps } = specs;
    const { totalDuration, scenes } = timeline;
    const { colorPalette, typography } = brief;

    const files: Record<string, string> = {};

    // 1. Build index.html (Root Host Composition)
    files["index.html"] = this.buildIndexHtml(
      brief,
      timeline,
      width,
      height,
      fps,
    );

    // 2. Build each scene composition (compositions/scene_0X.html)
    for (const scene of scenes) {
      const sceneFileName = `compositions/${scene.id.replace("-", "_")}.html`;
      files[sceneFileName] = this.buildSceneHtml(
        scene,
        brief,
        analyzedAssets,
        width,
        height,
        fps,
      );
    }

    // 3. Build meta.json
    files["meta.json"] = JSON.stringify(
      {
        title: brief.title,
        description: brief.subject,
        duration: totalDuration,
        fps,
        width,
        height,
        version: "0.8.139",
        category: brief.category,
        author: "HyperFrames AI Pipeline",
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    );

    // 4. Build project.json
    files["project.json"] = JSON.stringify(
      {
        schemaVersion: "1.0.0",
        name: brief.title,
        settings: {
          width,
          height,
          fps,
          duration: totalDuration,
        },
        scenes: scenes.map((s) => ({
          id: s.id,
          name: s.name,
          src: `compositions/${s.id.replace("-", "_")}.html`,
          start: s.start,
          duration: s.duration,
        })),
        assets: analyzedAssets.map((a) => ({
          id: a.id,
          name: a.name,
          path: `assets/${a.name}`,
          type: a.type,
        })),
      },
      null,
      2,
    );

    return {
      files,
      metadata: {
        title: brief.title,
        duration: totalDuration,
        width,
        height,
        fps,
      },
    };
  }

  private static buildIndexHtml(
    brief: CreativeBrief,
    timeline: PlannedTimeline,
    width: number,
    height: number,
    fps: number,
  ): string {
    const { totalDuration, scenes } = timeline;
    const displayFont = brief.typography.displayFont || "Plus Jakarta Sans";
    const bodyFont = brief.typography.bodyFont || "Inter";

    const hostDivs = scenes
      .map(
        (s) =>
          `    <div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id.replace("-", "_")}.html" data-start="${s.start.toFixed(2)}" data-duration="${s.duration.toFixed(2)}" style="position: absolute; inset: 0; width: 100%; height: 100%;"></div>`,
      )
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(brief.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(displayFont)}:wght@400;600;700;800;900&family=${encodeURIComponent(bodyFont)}:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${brief.colorPalette.backgroundColor};
      font-family: '${bodyFont}', sans-serif;
    }
    #root {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${brief.colorPalette.backgroundColor};
    }
  </style>
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="${totalDuration.toFixed(2)}" data-width="${width}" data-height="${height}">
${hostDivs}
  </div>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.to("#root", { duration: ${totalDuration.toFixed(2)}, ease: "none" }, 0);
    window.__timelines["main"] = tl;
    tl.seek(0);
  </script>
</body>
</html>`;
  }

  private static buildSceneHtml(
    scene: PlannedScene,
    brief: CreativeBrief,
    analyzedAssets: AnalyzedAsset[],
    width: number,
    height: number,
    fps: number,
  ): string {
    const palette = brief.colorPalette;
    const typo = brief.typography;
    const displayFont = typo.displayFont || "Plus Jakarta Sans";
    const bodyFont = typo.bodyFont || "Inter";

    // 1. Scene Background & Atmosphere (Customized per scene, NOT generic grid)
    const bgElements = this.renderBackgroundAtmosphere(scene, analyzedAssets, palette);

    // 2. Scene Layout Content
    const layoutContent = this.renderSceneLayout(scene, brief, analyzedAssets);

    // 3. Deterministic GSAP Timeline Script
    const gsapScript = this.renderGsapScript(scene, brief);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(scene.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(displayFont)}:wght@400;600;700;800;900&family=${encodeURIComponent(bodyFont)}:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${palette.backgroundColor};
      font-family: '${bodyFont}', sans-serif;
      color: ${palette.textColor};
      -webkit-font-smoothing: antialiased;
    }
    #root {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 70px 100px;
    }

    .display-font { font-family: '${displayFont}', sans-serif; }
    .body-font { font-family: '${bodyFont}', sans-serif; }

    /* Glassmorphic Cards & Badges */
    .glass-card {
      background: ${palette.surfaceColor};
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid ${palette.borderColor};
      border-radius: 20px;
    }
    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 20px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid ${palette.borderColor};
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${palette.accent};
    }
    .badge-pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${palette.accent};
      box-shadow: 0 0 12px ${palette.accent};
    }

    /* Headings & Typography */
    .hero-headline {
      font-size: 64px;
      line-height: 1.1;
      font-weight: 900;
      letter-spacing: -0.02em;
      text-transform: ${typo.headlineTransform || "uppercase"};
      color: ${palette.textColor};
    }
    .highlight-span {
      color: ${palette.accent};
      text-shadow: 0 0 30px ${palette.glowColor};
    }
    .hero-subtitle {
      font-size: 24px;
      line-height: 1.5;
      font-weight: 500;
      color: ${palette.textMutedColor};
      max-width: 900px;
    }

    /* Interactive Data Elements */
    .metric-value-large {
      font-size: 56px;
      font-weight: 900;
      color: #FFFFFF;
      line-height: 1;
    }
    .metric-label-muted {
      font-size: 15px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${palette.textMutedColor};
      margin-top: 8px;
    }

    /* CTA Button */
    .btn-cta {
      display: inline-flex;
      align-items: center;
      gap: 14px;
      padding: 18px 44px;
      border-radius: 14px;
      background: ${palette.accent};
      color: #05070B;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      box-shadow: 0 10px 30px ${palette.glowColor};
      border: none;
    }
  </style>
</head>
<body>
  <div id="root" data-composition-id="${scene.id}" data-start="0" data-duration="${scene.duration.toFixed(2)}" data-width="${width}" data-height="${height}">
${bgElements}
${layoutContent}
  </div>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <script>
${gsapScript}
  </script>
</body>
</html>`;
  }

  private static renderBackgroundAtmosphere(
    scene: PlannedScene,
    analyzedAssets: AnalyzedAsset[],
    palette: any,
  ): string {
    const bgType = scene.visualAtmosphere.backgroundType;
    const asset = scene.assetToFeature;

    if (bgType === "image-backdrop" && asset) {
      const assetPath = `assets/${asset.name}`;
      const scrim =
        scene.visualAtmosphere.scrimGradient ||
        asset.scrimGradient ||
        "linear-gradient(180deg, rgba(5,7,12,0.8) 0%, rgba(5,7,12,0.3) 40%, rgba(5,7,12,0.95) 100%)";

      return `
    <!-- FULL-SCREEN HERO BACKGROUND WITH CUSTOM SCRIM -->
    <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1;">
      <img id="heroBackdropImg" src="${assetPath}" alt="Cinematic Backdrop" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center center; display: block;" />
      <div style="position: absolute; inset: 0; background: ${scrim};"></div>
      <div style="position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.65) 100%);"></div>
    </div>`;
    }

    if (bgType === "cyber-hud") {
      return `
    <!-- CYBER RADAR & HUD ATMOSPHERE -->
    <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; background: ${palette.backgroundColor};">
      <div style="position: absolute; width: 900px; height: 900px; border-radius: 50%; border: 1px solid rgba(255, 230, 0, 0.12); top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
      <div style="position: absolute; width: 600px; height: 600px; border-radius: 50%; border: 1px dashed rgba(255, 230, 0, 0.18); top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
      <div style="position: absolute; width: 300px; height: 300px; border-radius: 50%; border: 1px solid rgba(255, 230, 0, 0.25); top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
      <div id="radarScannerSweep" style="position: absolute; width: 450px; height: 450px; top: calc(50% - 450px); left: calc(50% - 450px); transform-origin: bottom right; background: conic-gradient(from 0deg at 100% 100%, rgba(255, 230, 0, 0.15) 0deg, transparent 60deg);"></div>
      <div style="position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 50%, rgba(5,5,8,0.85) 100%);"></div>
    </div>`;
    }

    if (bgType === "architectural-blueprint") {
      return `
    <!-- ARCHITECTURAL BLUEPRINT GRID ATMOSPHERE -->
    <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; background: ${palette.backgroundColor};">
      <div style="position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(200,169,126,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(200,169,126,0.08) 1px, transparent 1px); background-size: 120px 120px;"></div>
      <div style="position: absolute; top: 40px; right: 50px; font-family: monospace; font-size: 13px; color: rgba(200,169,126,0.5); letter-spacing: 0.15em;">ARCH-SPEC // SCALE 1:100 // ELEVATION +140M</div>
      <div style="position: absolute; inset: 0; background: radial-gradient(circle at 30% 50%, rgba(200,169,126,0.12) 0%, transparent 70%);"></div>
    </div>`;
    }

    if (bgType === "pure-black") {
      return `
    <!-- PURE BLACK MONOCHROME ATMOSPHERE -->
    <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; background: #000000;">
    </div>`;
    }

    if (bgType === "nature-organic") {
      return `
    <!-- ORGANIC CLEAN NATURE ATMOSPHERE -->
    <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; background: radial-gradient(circle at 50% 30%, #172D1E 0%, #0A160F 60%, #050B07 100%);">
      <div style="position: absolute; width: 800px; height: 800px; border-radius: 50%; background: radial-gradient(circle, rgba(250, 204, 21, 0.08) 0%, transparent 70%); top: -100px; left: 50%; transform: translateX(-50%); filter: blur(80px);"></div>
      <div style="position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 65%, rgba(0,0,0,0.6) 100%);"></div>
    </div>`;
    }

    if (bgType === "minimal-dark") {
      return `
    <!-- MINIMAL DARK ATMOSPHERE -->
    <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; background: #070B12;">
      <div style="position: absolute; width: 900px; height: 900px; border-radius: 50%; background: radial-gradient(circle, rgba(0, 245, 255, 0.05) 0%, transparent 70%); top: -200px; right: -100px; filter: blur(90px);"></div>
      <div style="position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 70%, rgba(3,5,9,0.7) 100%);"></div>
    </div>`;
    }

    // Default: Rich Mesh Gradient Atmosphere
    return `
    <!-- RICH MESH GRADIENT ATMOSPHERE -->
    <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; background: ${palette.backgroundColor};">
      <div style="position: absolute; width: 1000px; height: 1000px; border-radius: 50%; background: radial-gradient(circle, ${palette.primary}22 0%, transparent 70%); top: -300px; right: -200px; filter: blur(80px);"></div>
      <div style="position: absolute; width: 800px; height: 800px; border-radius: 50%; background: radial-gradient(circle, ${palette.accent}18 0%, transparent 70%); bottom: -200px; left: -100px; filter: blur(90px);"></div>
      <div style="position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 60%, rgba(5,7,12,0.8) 100%);"></div>
    </div>`;
  }

  private static renderSceneLayout(
    scene: PlannedScene,
    brief: CreativeBrief,
    analyzedAssets: AnalyzedAsset[],
  ): string {
    const palette = brief.colorPalette;
    const formattedHeadline = this.formatHighlightedHeadline(
      scene.headline,
      scene.highlightedWord,
    );

    // LAYOUT 1: Cinematic Hero Intro
    if (scene.sceneType === "cinematic-hero-intro") {
      const isBatman = brief.subject.toLowerCase().includes("batman") || (scene.assetToFeature?.name.toLowerCase().includes("batman"));
      const isArchitecture = brief.subject.toLowerCase().includes("building") || brief.subject.toLowerCase().includes("architect");

      const badgeHtml = scene.badge
        ? `<div class="badge-pill anim-header" id="sceneBadge"><span class="badge-pulse-dot"></span><span>${this.escapeHtml(scene.badge)}</span></div>`
        : "";

      const alignment = isArchitecture ? "flex-start" : isBatman ? "flex-start" : "center";
      const textAlign = isArchitecture ? "left" : isBatman ? "left" : "center";
      const maxW = isArchitecture ? "1000px" : isBatman ? "1100px" : "1200px";

      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: ${maxW}; display: flex; flex-direction: column; align-items: ${alignment}; text-align: ${textAlign}; gap: 24px;">
      ${badgeHtml}
      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 68px;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 24px;">
        ${this.escapeHtml(scene.subtitle)}
      </p>
      ${
        isBatman
          ? `<div class="anim-sub" style="display: flex; gap: 16px; margin-top: 10px;">
               <div class="glass-card" style="padding: 12px 24px; border-left: 3px solid #FFE600; font-size: 14px; font-weight: 700; color: #FFE600; letter-spacing: 0.1em;">SECTOR 4 PATROL: ACTIVE</div>
               <div class="glass-card" style="padding: 12px 24px; border-left: 3px solid #00F5FF; font-size: 14px; font-weight: 700; color: #00F5FF; letter-spacing: 0.1em;">SIGNAL: BROADCASTING</div>
             </div>`
          : ""
      }
    </div>`;
    }

    // LAYOUT 1A: Green Lantern Ring Logo & Emerald Willpower
    if (scene.sceneType === "green-lantern-ring") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px;">
      <div class="badge-pill anim-header" id="sceneBadge" style="border-color: rgba(0, 255, 102, 0.4); background: rgba(0, 255, 102, 0.1); color: #00FF66;">
        <span class="badge-pulse-dot" style="background: #00FF66; box-shadow: 0 0 16px #00FF66;"></span>
        <span>${this.escapeHtml(scene.badge || "DC LANTERNS // SECTOR 2814")}</span>
      </div>

      <!-- ICONIC SVG GREEN LANTERN RING LOGO WITH EMERALD PLASMA BURST -->
      <div class="anim-ring-box" style="position: relative; width: 320px; height: 320px; display: flex; align-items: center; justify-content: center; margin: 10px 0;">
        <div id="ringAura" style="position: absolute; width: 280px; height: 280px; border-radius: 50%; background: radial-gradient(circle, rgba(0,255,102,0.4) 0%, rgba(173,255,47,0.15) 50%, transparent 70%); filter: blur(25px);"></div>
        
        <svg id="glRingSvg" viewBox="0 0 300 300" style="width: 260px; height: 260px; overflow: visible; filter: drop-shadow(0 0 25px rgba(0,255,102,0.8));">
          <defs>
            <linearGradient id="ringMetal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#00FF88" />
              <stop offset="50%" stop-color="#00AA44" />
              <stop offset="100%" stop-color="#004411" />
            </linearGradient>
            <linearGradient id="emeraldPlasma" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ADFF2F" />
              <stop offset="50%" stop-color="#00FF66" />
              <stop offset="100%" stop-color="#008833" />
            </linearGradient>
            <filter id="glowGreen" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <!-- Outer Ring Band Bezel -->
          <circle cx="150" cy="150" r="120" stroke="url(#ringMetal)" stroke-width="14" fill="rgba(3,10,5,0.85)" />
          
          <!-- Green Lantern Emblem: Top Bar -->
          <rect id="glTopBar" x="80" y="82" width="140" height="20" rx="8" fill="url(#emeraldPlasma)" filter="url(#glowGreen)" />
          
          <!-- Green Lantern Emblem: Bottom Bar -->
          <rect id="glBottomBar" x="80" y="198" width="140" height="20" rx="8" fill="url(#emeraldPlasma)" filter="url(#glowGreen)" />
          
          <!-- Green Lantern Emblem: Outer Battery Circle -->
          <circle id="glBatteryCircle" cx="150" cy="150" r="62" stroke="url(#emeraldPlasma)" stroke-width="18" fill="none" filter="url(#glowGreen)" />
          
          <!-- Green Lantern Emblem: Center Glowing Power Core -->
          <circle id="glCore" cx="150" cy="150" r="32" fill="#FFFFFF" opacity="0.95" filter="url(#glowGreen)" />
        </svg>
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 64px; letter-spacing: -0.02em;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 22px; max-width: 900px; color: #86EFAC;">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <!-- Voiceover Subtitle Bar -->
      <div class="glass-card anim-sub" style="display: flex; align-items: center; gap: 14px; padding: 12px 28px; border-color: rgba(0,255,102,0.3); background: rgba(0,255,102,0.06); border-radius: 9999px;">
        <span style="font-size: 13px; font-weight: 800; color: #00FF66; letter-spacing: 0.1em; text-transform: uppercase;">VOICEOVER:</span>
        <span style="font-size: 15px; color: #FFFFFF; font-style: italic;">&ldquo;In brightest day, in blackest night... The ring chose you for a reason.&rdquo;</span>
      </div>
    </div>`;
    }

    // LAYOUT 1A-2: Guy Gardner Character Presentation
    if (scene.sceneType === "green-lantern-guy-gardner") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1400px; display: flex; flex-direction: column; align-items: center; gap: 24px;">
      <div style="text-align: center;">
        <div class="badge-pill anim-header" id="sceneBadge" style="border-color: rgba(173,255,47,0.4); background: rgba(173,255,47,0.1); color: #ADFF2F;">
          <span class="badge-pulse-dot" style="background: #ADFF2F; box-shadow: 0 0 16px #ADFF2F;"></span>
          <span>${this.escapeHtml(scene.badge || "WARRIOR OF SECTOR 2814")}</span>
        </div>
        <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 58px; margin-top: 12px;">
          ${formattedHeadline}
        </h1>
        <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 20px; color: #86EFAC; margin-top: 6px;">
          ${this.escapeHtml(scene.subtitle)}
        </p>
      </div>

      <!-- GUY GARDNER HARD-LIGHT CONSTRUCT & DOSSIER LAYOUT -->
      <div style="width: 100%; max-width: 1200px; display: flex; gap: 30px; align-items: center;">
        <!-- HARD LIGHT CONSTRUCT FIST EMBLEM -->
        <div class="glass-card anim-construct-fist" style="width: 360px; height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; border-color: rgba(0,255,102,0.4); background: rgba(0,255,102,0.08); box-shadow: 0 0 40px rgba(0,255,102,0.25);">
          <svg viewBox="0 0 200 200" style="width: 160px; height: 160px; filter: drop-shadow(0 0 18px #00FF66);">
            <polygon points="100,20 180,65 180,155 100,195 20,155 20,65" stroke="#ADFF2F" stroke-width="4" fill="rgba(0,255,102,0.15)"/>
            <circle cx="100" cy="110" r="45" stroke="#00FF66" stroke-width="8" fill="#000000" />
            <rect x="70" y="80" width="60" height="10" rx="3" fill="#ADFF2F" />
            <rect x="70" y="130" width="60" height="10" rx="3" fill="#ADFF2F" />
            <circle cx="100" cy="110" r="22" stroke="#00FF66" stroke-width="6" fill="#FFFFFF" />
          </svg>
          <div class="display-font" style="font-size: 18px; font-weight: 800; color: #00FF66; margin-top: 12px; letter-spacing: 0.08em;">HARD-LIGHT CONSTRUCT</div>
          <div style="font-size: 13px; color: #ADFF2F; font-weight: 600;">WILLPOWER DISRUPTION: 100%</div>
        </div>

        <!-- DOSSIER TELEMETRY CARDS -->
        <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="glass-card anim-metric-card" style="padding: 22px; border-left: 4px solid #00FF66;">
            <div style="font-size: 12px; font-weight: 800; color: #86EFAC; letter-spacing: 0.1em; text-transform: uppercase;">UNIFORM</div>
            <div class="display-font" style="font-size: 22px; font-weight: 900; color: #FFFFFF; margin-top: 4px;">LEATHER JACKET</div>
            <div style="font-size: 13px; color: #94A3B8; margin-top: 4px;">Custom Sector 2814 Combat Cut</div>
          </div>
          <div class="glass-card anim-metric-card" style="padding: 22px; border-left: 4px solid #ADFF2F;">
            <div style="font-size: 12px; font-weight: 800; color: #86EFAC; letter-spacing: 0.1em; text-transform: uppercase;">FIGHTING STYLE</div>
            <div class="display-font" style="font-size: 22px; font-weight: 900; color: #FFFFFF; margin-top: 4px;">RAW BRAWLER</div>
            <div style="font-size: 13px; color: #94A3B8; margin-top: 4px;">Unstoppable construct sledgehammers</div>
          </div>
          <div class="glass-card anim-metric-card" style="padding: 22px; border-left: 4px solid #00FF88;">
            <div style="font-size: 12px; font-weight: 800; color: #86EFAC; letter-spacing: 0.1em; text-transform: uppercase;">FEAR FACTOR</div>
            <div class="display-font" style="font-size: 22px; font-weight: 900; color: #FFFFFF; margin-top: 4px;">ZERO FEAR</div>
            <div style="font-size: 13px; color: #94A3B8; margin-top: 4px;">Bowl-cut grit & boundless willpower</div>
          </div>
          <div class="glass-card anim-metric-card" style="padding: 22px; border-left: 4px solid #ADFF2F;">
            <div style="font-size: 12px; font-weight: 800; color: #86EFAC; letter-spacing: 0.1em; text-transform: uppercase;">RING PROTOCOL</div>
            <div class="display-font" style="font-size: 22px; font-weight: 900; color: #FFFFFF; margin-top: 4px;">OVERCHARGED</div>
            <div style="font-size: 13px; color: #94A3B8; margin-top: 4px;">Green Lantern Corp Heavy Striker</div>
          </div>
        </div>
      </div>

      <!-- Voiceover Subtitle Bar -->
      <div class="glass-card anim-sub" style="display: flex; align-items: center; gap: 14px; padding: 12px 28px; border-color: rgba(173,255,47,0.3); background: rgba(173,255,47,0.06); border-radius: 9999px;">
        <span style="font-size: 13px; font-weight: 800; color: #ADFF2F; letter-spacing: 0.1em; text-transform: uppercase;">VOICEOVER:</span>
        <span style="font-size: 15px; color: #FFFFFF; font-style: italic;">&ldquo;He&rsquo;s loud, he&rsquo;s unfiltered, and he&rsquo;s Earth&rsquo;s most stubborn defender: Guy Gardner.&rdquo;</span>
      </div>
    </div>`;
    }

    // LAYOUT 1A-3: Green Lantern Oath Climax
    if (scene.sceneType === "green-lantern-oath") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 24px;">
      <div class="badge-pill anim-header" id="sceneBadge" style="border-color: rgba(0, 255, 102, 0.4); background: rgba(0, 255, 102, 0.1); color: #00FF66;">
        <span class="badge-pulse-dot" style="background: #00FF66; box-shadow: 0 0 16px #00FF66;"></span>
        <span>${this.escapeHtml(scene.badge || "DC STUDIOS ORIGINAL // 2026")}</span>
      </div>

      <!-- RADIANT OATH ENERGY BURST -->
      <div style="position: relative; width: 100%; max-width: 700px; height: 180px; display: flex; align-items: center; justify-content: center;">
        <div id="oathFlare" style="position: absolute; width: 500px; height: 120px; border-radius: 50%; background: radial-gradient(ellipse, rgba(0,255,102,0.5) 0%, rgba(173,255,47,0.2) 60%, transparent 80%); filter: blur(30px);"></div>
        <div class="display-font" style="position: relative; font-size: 38px; font-weight: 900; letter-spacing: 0.06em; color: #ADFF2F; text-shadow: 0 0 30px #00FF66;">
          IN BRIGHTEST DAY, IN BLACKEST NIGHT...
        </div>
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 72px; letter-spacing: -0.02em;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 24px; color: #86EFAC; max-width: 900px;">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <!-- Climax Subtitle / Oath Card -->
      <div class="glass-card anim-sub" style="padding: 16px 36px; border-color: rgba(0,255,102,0.4); background: rgba(0,255,102,0.1); border-radius: 16px; margin-top: 8px;">
        <div style="font-size: 18px; font-weight: 700; color: #FFFFFF; font-style: italic;">
          &ldquo;No evil shall escape my sight... Beware my power, Green Lantern&rsquo;s light!&rdquo;
        </div>
      </div>

      <div class="anim-cta" style="margin-top: 10px;">
        <button class="btn-cta display-font" style="background: linear-gradient(135deg, #00FF66 0%, #ADFF2F 100%); color: #020803; box-shadow: 0 0 40px rgba(0,255,102,0.6); border: none; cursor: pointer;">
          DC LANTERNS &bull; ONLY IN THE DC UNIVERSE
        </button>
      </div>
    </div>`;
    }

    // LAYOUT 1A-4: Hard-Light Willpower Construct
    if (scene.sceneType === "green-lantern-construct") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: flex-start; gap: 20px;">
      <div class="badge-pill anim-header" id="sceneBadge" style="border-color: rgba(0, 255, 102, 0.4); background: rgba(0, 255, 102, 0.1); color: #00FF66;">
        <span class="badge-pulse-dot" style="background: #00FF66; box-shadow: 0 0 16px #00FF66;"></span>
        <span>${this.escapeHtml(scene.badge || "HARD-LIGHT CONSTRUCT // OVERCHARGED")}</span>
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 64px; letter-spacing: -0.02em; text-align: left;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 22px; max-width: 800px; color: #86EFAC; text-align: left;">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <!-- Combat Construct Telemetry Grid -->
      <div class="anim-sub" style="display: flex; gap: 16px; margin-top: 10px;">
        <div class="glass-card" style="padding: 14px 24px; border-color: rgba(0,255,102,0.3); background: rgba(0,255,102,0.08); border-radius: 12px;">
          <div style="font-size: 11px; font-weight: 800; color: #ADFF2F; letter-spacing: 0.1em; text-transform: uppercase;">CONSTRUCT FORCE</div>
          <div class="display-font" style="font-size: 28px; font-weight: 900; color: #FFFFFF; margin-top: 4px;">100,000 TONS</div>
        </div>
        <div class="glass-card" style="padding: 14px 24px; border-color: rgba(0,255,102,0.3); background: rgba(0,255,102,0.08); border-radius: 12px;">
          <div style="font-size: 11px; font-weight: 800; color: #ADFF2F; letter-spacing: 0.1em; text-transform: uppercase;">DISRUPTION FACTOR</div>
          <div class="display-font" style="font-size: 28px; font-weight: 900; color: #FFFFFF; margin-top: 4px;">ZERO LIMIT</div>
        </div>
        <div class="glass-card" style="padding: 14px 24px; border-color: rgba(0,255,102,0.3); background: rgba(0,255,102,0.08); border-radius: 12px;">
          <div style="font-size: 11px; font-weight: 800; color: #ADFF2F; letter-spacing: 0.1em; text-transform: uppercase;">FIGHTING STYLE</div>
          <div class="display-font" style="font-size: 28px; font-weight: 900; color: #FFFFFF; margin-top: 4px;">RAW BRAWLER</div>
        </div>
      </div>

      <!-- Voiceover Subtitle Bar -->
      <div class="glass-card anim-sub" style="display: flex; align-items: center; gap: 14px; padding: 12px 28px; border-color: rgba(0,255,102,0.3); background: rgba(0,255,102,0.06); border-radius: 9999px; margin-top: 10px;">
        <span style="font-size: 13px; font-weight: 800; color: #00FF66; letter-spacing: 0.1em; text-transform: uppercase;">VOICEOVER:</span>
        <span style="font-size: 15px; color: #FFFFFF; font-style: italic;">&ldquo;He doesn&rsquo;t fight by the book. He turns pure willpower into raw cosmic force.&rdquo;</span>
      </div>
    </div>`;
    }

    // LAYOUT 1A-5: Central Power Battery of Oa
    if (scene.sceneType === "green-lantern-battery") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px;">
      <div class="badge-pill anim-header" id="sceneBadge" style="border-color: rgba(0, 255, 102, 0.4); background: rgba(0, 255, 102, 0.1); color: #00FF66;">
        <span class="badge-pulse-dot" style="background: #00FF66; box-shadow: 0 0 16px #00FF66;"></span>
        <span>${this.escapeHtml(scene.badge || "CENTRAL BATTERY OF OA")}</span>
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 64px; letter-spacing: -0.02em;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 22px; max-width: 900px; color: #86EFAC;">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <div class="glass-card anim-sub" style="display: flex; align-items: center; gap: 14px; padding: 12px 28px; border-color: rgba(0,255,102,0.3); background: rgba(0,255,102,0.06); border-radius: 9999px; margin-top: 10px;">
        <span style="font-size: 13px; font-weight: 800; color: #00FF66; letter-spacing: 0.1em; text-transform: uppercase;">VOICEOVER:</span>
        <span style="font-size: 15px; color: #FFFFFF; font-style: italic;">&ldquo;When the ring runs dry, the oath recharges the infinite emerald flame.&rdquo;</span>
      </div>
    </div>`;
    }

    // LAYOUT 1S-1: Superman S-Shield of Hope
    if (scene.sceneType === "superman-shield") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px;">
      <div class="badge-pill anim-header" id="sceneBadge" style="border-color: rgba(255, 215, 0, 0.4); background: rgba(229, 37, 33, 0.15); color: #FFD700;">
        <span class="badge-pulse-dot" style="background: #E52521; box-shadow: 0 0 16px #E52521;"></span>
        <span>${this.escapeHtml(scene.badge || "HOUSE OF EL // KRYPTON")}</span>
      </div>

      <div class="anim-ring-glow" style="width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle, rgba(229,37,33,0.3) 0%, rgba(255,215,0,0.15) 50%, transparent 70%); display: flex; align-items: center; justify-content: center; margin: 0 auto; filter: drop-shadow(0 0 24px rgba(229,37,33,0.6));">
        <svg viewBox="0 0 100 100" style="width: 90px; height: 90px; filter: drop-shadow(0 0 12px #FFD700);">
          <polygon points="50,5 95,30 80,90 20,90 5,30" fill="rgba(229,37,33,0.85)" stroke="#FFD700" stroke-width="4"/>
          <path d="M65,35 C60,25 40,25 35,35 C30,45 65,45 65,65 C65,78 40,80 32,68" fill="none" stroke="#FFD700" stroke-width="8" stroke-linecap="round"/>
        </svg>
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 64px; letter-spacing: -0.02em; text-shadow: 0 4px 30px rgba(0,0,0,0.8);">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 22px; max-width: 900px; color: #93C5FD;">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <div class="glass-card anim-sub" style="display: flex; align-items: center; gap: 14px; padding: 12px 28px; border-color: rgba(255,215,0,0.3); background: rgba(10,25,49,0.7); border-radius: 9999px; margin-top: 10px;">
        <span style="font-size: 13px; font-weight: 800; color: #FFD700; letter-spacing: 0.1em; text-transform: uppercase;">VOICEOVER:</span>
        <span style="font-size: 15px; color: #FFFFFF; font-style: italic;">&ldquo;In a world seeking hope, a symbol arrived from the stars: the House of El.&rdquo;</span>
      </div>
    </div>`;
    }

    // LAYOUT 1S-2: Clark Kent Daily Planet Reporter Dossier
    if (scene.sceneType === "superman-clark-kent") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1400px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 24px;">
      <div class="badge-pill anim-header" id="sceneBadge" style="border-color: rgba(255, 215, 0, 0.4); background: rgba(10, 25, 49, 0.6); color: #FFD700;">
        <span class="badge-pulse-dot" style="background: #FFD700; box-shadow: 0 0 16px #FFD700;"></span>
        <span>${this.escapeHtml(scene.badge || "DAILY PLANET // PRESS CREDENTIAL")}</span>
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 68px; letter-spacing: -0.02em;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 22px; max-width: 900px; color: #E2E8F0;">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <!-- CLARK KENT PRESS DOSSIER GRID -->
      <div class="anim-cards" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; width: 100%; max-width: 1200px; margin-top: 10px;">
        <div class="glass-card" style="padding: 20px; text-align: left; border-color: rgba(255,215,0,0.3); background: rgba(10,25,49,0.75);">
          <div style="font-size: 12px; color: #93C5FD; text-transform: uppercase; font-weight: 700; letter-spacing: 0.08em;">OCCUPATION</div>
          <div style="font-size: 20px; font-weight: 800; color: #FFFFFF; margin-top: 6px;">INVESTIGATIVE JOURNALIST</div>
          <div style="font-size: 13px; color: #FFD700; margin-top: 4px;">Daily Planet Newsroom</div>
        </div>
        <div class="glass-card" style="padding: 20px; text-align: left; border-color: rgba(255,215,0,0.3); background: rgba(10,25,49,0.75);">
          <div style="font-size: 12px; color: #93C5FD; text-transform: uppercase; font-weight: 700; letter-spacing: 0.08em;">CODE OF HONOR</div>
          <div style="font-size: 20px; font-weight: 800; color: #FFFFFF; margin-top: 6px;">TRUTH & INTEGRITY</div>
          <div style="font-size: 13px; color: #FFD700; margin-top: 4px;">Fearless Reporter</div>
        </div>
        <div class="glass-card" style="padding: 20px; text-align: left; border-color: rgba(255,215,0,0.3); background: rgba(10,25,49,0.75);">
          <div style="font-size: 12px; color: #93C5FD; text-transform: uppercase; font-weight: 700; letter-spacing: 0.08em;">HOMETOWN</div>
          <div style="font-size: 20px; font-weight: 800; color: #FFFFFF; margin-top: 6px;">SMALLVILLE, KANSAS</div>
          <div style="font-size: 13px; color: #FFD700; margin-top: 4px;">Raised by the Kents</div>
        </div>
        <div class="glass-card" style="padding: 20px; text-align: left; border-color: rgba(229,37,33,0.4); background: rgba(10,25,49,0.75);">
          <div style="font-size: 12px; color: #E52521; text-transform: uppercase; font-weight: 700; letter-spacing: 0.08em;">SECRET IDENTITY</div>
          <div style="font-size: 20px; font-weight: 800; color: #FFD700; margin-top: 6px;">KAL-EL OF KRYPTON</div>
          <div style="font-size: 13px; color: #E52521; margin-top: 4px;">The Man of Steel</div>
        </div>
      </div>

      <div class="glass-card anim-sub" style="display: flex; align-items: center; gap: 14px; padding: 12px 28px; border-color: rgba(255,215,0,0.3); background: rgba(10,25,49,0.7); border-radius: 9999px; margin-top: 10px;">
        <span style="font-size: 13px; font-weight: 800; color: #FFD700; letter-spacing: 0.1em; text-transform: uppercase;">VOICEOVER:</span>
        <span style="font-size: 15px; color: #FFFFFF; font-style: italic;">&ldquo;By day, a mild-mannered investigative reporter for the Daily Planet: Clark Kent.&rdquo;</span>
      </div>
    </div>`;
    }

    // LAYOUT 1S-3: Truth and Justice Metropolis Editorial Bureau
    if (scene.sceneType === "superman-metropolis") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px;">
      <div class="badge-pill anim-header" id="sceneBadge" style="border-color: rgba(0, 180, 255, 0.4); background: rgba(10, 25, 49, 0.6); color: #00E5FF;">
        <span class="badge-pulse-dot" style="background: #00E5FF; box-shadow: 0 0 16px #00E5FF;"></span>
        <span>${this.escapeHtml(scene.badge || "METROPOLIS EDITORIAL BUREAU")}</span>
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 64px; letter-spacing: -0.02em;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 22px; max-width: 900px; color: #BAE6FD;">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <!-- METROPOLIS JOURNALISM METRICS -->
      <div class="anim-cards" style="display: flex; gap: 24px; width: 100%; max-width: 900px; justify-content: center; margin-top: 12px;">
        <div class="glass-card" style="flex: 1; padding: 22px; border-color: rgba(0,180,255,0.3); background: rgba(10,25,49,0.75);">
          <div style="font-size: 13px; color: #93C5FD; font-weight: 700;">CORRUPTION EXPOSED</div>
          <div style="font-size: 32px; font-weight: 900; color: #FFFFFF; margin-top: 6px;">100%</div>
        </div>
        <div class="glass-card" style="flex: 1; padding: 22px; border-color: rgba(255,215,0,0.3); background: rgba(10,25,49,0.75);">
          <div style="font-size: 13px; color: #FFD700; font-weight: 700;">EDITORIAL INTEGRITY</div>
          <div style="font-size: 32px; font-weight: 900; color: #FFD700; margin-top: 6px;">UNCOMPROMISED</div>
        </div>
        <div class="glass-card" style="flex: 1; padding: 22px; border-color: rgba(229,37,33,0.3); background: rgba(10,25,49,0.75);">
          <div style="font-size: 13px; color: #E52521; font-weight: 700;">DEFENDER OF METROPOLIS</div>
          <div style="font-size: 32px; font-weight: 900; color: #FFFFFF; margin-top: 6px;">STANDS TALL</div>
        </div>
      </div>

      <div class="glass-card anim-sub" style="display: flex; align-items: center; gap: 14px; padding: 12px 28px; border-color: rgba(0,180,255,0.3); background: rgba(10,25,49,0.7); border-radius: 9999px; margin-top: 10px;">
        <span style="font-size: 13px; font-weight: 800; color: #00E5FF; letter-spacing: 0.1em; text-transform: uppercase;">VOICEOVER:</span>
        <span style="font-size: 15px; color: #FFFFFF; font-style: italic;">&ldquo;Dedicated to truth, justice, and defending the innocent from darkness.&rdquo;</span>
      </div>
    </div>`;
    }

    // LAYOUT 1S-4: Solar Radiation Core
    if (scene.sceneType === "superman-solar") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px;">
      <div class="badge-pill anim-header" id="sceneBadge" style="border-color: rgba(255, 215, 0, 0.4); background: rgba(255, 215, 0, 0.1); color: #FFD700;">
        <span class="badge-pulse-dot" style="background: #FFD700; box-shadow: 0 0 16px #FFD700;"></span>
        <span>${this.escapeHtml(scene.badge || "KRYPTONIAN CELLULAR CORE // 100%")}</span>
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 64px; letter-spacing: -0.02em;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 22px; max-width: 900px; color: #FED7AA;">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <div class="anim-cards" style="display: flex; gap: 24px; width: 100%; max-width: 900px; justify-content: center; margin-top: 12px;">
        <div class="glass-card" style="flex: 1; padding: 22px; border-color: rgba(255,215,0,0.3); background: rgba(20,10,5,0.75);">
          <div style="font-size: 13px; color: #FFD700; font-weight: 700;">YELLOW SUN ABSORPTION</div>
          <div style="font-size: 32px; font-weight: 900; color: #FFD700; margin-top: 6px;">100% MAXIMUM</div>
        </div>
        <div class="glass-card" style="flex: 1; padding: 22px; border-color: rgba(229,37,33,0.3); background: rgba(20,10,5,0.75);">
          <div style="font-size: 13px; color: #E52521; font-weight: 700;">INVULNERABILITY</div>
          <div style="font-size: 32px; font-weight: 900; color: #FFFFFF; margin-top: 6px;">UNBREAKABLE</div>
        </div>
        <div class="glass-card" style="flex: 1; padding: 22px; border-color: rgba(255,215,0,0.3); background: rgba(20,10,5,0.75);">
          <div style="font-size: 13px; color: #FFD700; font-weight: 700;">FLIGHT VELOCITY</div>
          <div style="font-size: 32px; font-weight: 900; color: #FFFFFF; margin-top: 6px;">MACH 10+</div>
        </div>
      </div>

      <div class="glass-card anim-sub" style="display: flex; align-items: center; gap: 14px; padding: 12px 28px; border-color: rgba(255,215,0,0.3); background: rgba(20,10,5,0.7); border-radius: 9999px; margin-top: 10px;">
        <span style="font-size: 13px; font-weight: 800; color: #FFD700; letter-spacing: 0.1em; text-transform: uppercase;">VOICEOVER:</span>
        <span style="font-size: 15px; color: #FFFFFF; font-style: italic;">&ldquo;Powered by Earth&rsquo;s yellow sun, carrying boundless strength in his heart.&rdquo;</span>
      </div>
    </div>`;
    }

    // LAYOUT 1S-5: The Man of Steel Climax
    if (scene.sceneType === "superman-climax") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 24px;">
      <div class="badge-pill anim-header" id="sceneBadge" style="border-color: rgba(229, 37, 33, 0.4); background: rgba(229, 37, 33, 0.15); color: #FFD700;">
        <span class="badge-pulse-dot" style="background: #E52521; box-shadow: 0 0 16px #E52521;"></span>
        <span>${this.escapeHtml(scene.badge || "DC STUDIOS EXCLUSIVE")}</span>
      </div>

      <div class="anim-ring-glow" style="font-size: 28px; font-weight: 900; letter-spacing: 0.2em; color: #FFD700; text-transform: uppercase;">
        FASTER THAN A SPEEDING BULLET...
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 80px; letter-spacing: -0.02em; text-transform: uppercase; text-shadow: 0 0 40px rgba(229,37,33,0.8), 0 0 80px rgba(255,215,0,0.4);">
        ${formattedHeadline}
      </h1>

      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 24px; max-width: 900px; color: #93C5FD;">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <div class="glass-card anim-sub" style="display: flex; align-items: center; gap: 14px; padding: 12px 28px; border-color: rgba(229,37,33,0.4); background: rgba(10,25,49,0.7); border-radius: 9999px;">
        <span style="font-size: 15px; color: #FFFFFF; font-style: italic;">&ldquo;Look up in the sky... Faster than a speeding bullet: it&rsquo;s Superman!&rdquo;</span>
      </div>

      <div class="anim-sub" style="margin-top: 14px;">
        <a href="#experience" class="cta-button" style="display: inline-block; padding: 18px 48px; font-size: 18px; font-weight: 900; color: #050B14; background: linear-gradient(135deg, #FFD700 0%, #E52521 100%); border-radius: 9999px; text-decoration: none; text-transform: uppercase; letter-spacing: 0.08em; box-shadow: 0 0 35px rgba(255,215,0,0.6);">
          ${this.escapeHtml(scene.ctaText || "DC SUPERMAN • IN THEATERS & STREAMING")}
        </a>
      </div>
    </div>`;
    }

    // LAYOUT 1B: Nature Tree Growth (Organic SVG Growth Sequence)
    if (scene.sceneType === "nature-tree-growth") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1400px; display: flex; flex-direction: column; align-items: center; gap: 24px;">
      <div style="text-align: center;">
        <div class="badge-pill anim-header" id="sceneBadge" style="background: rgba(250, 204, 21, 0.15); color: #FACC15; border-color: rgba(250, 204, 21, 0.3);">
          <span class="badge-pulse-dot" style="background: #FACC15; box-shadow: 0 0 12px #FACC15;"></span>
          <span>${this.escapeHtml(scene.badge || "ORGANIC GROWTH")}</span>
        </div>
        <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 52px; margin-top: 12px;">
          ${formattedHeadline}
        </h1>
        <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 20px; margin-top: 8px;">
          ${this.escapeHtml(scene.subtitle)}
        </p>
      </div>

      <!-- BESPOKE SVG TREE GROWTH ILLUSTRATION -->
      <div class="glass-card anim-tree-box" style="width: 100%; max-width: 900px; height: 420px; display: flex; align-items: center; justify-content: center; position: relative; overflow: visible; padding: 20px;">
        <svg viewBox="0 0 800 400" style="width: 100%; height: 100%; overflow: visible;">
          <defs>
            <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#4B3621" stop-opacity="0.8"/>
              <stop offset="100%" stop-color="#1E140A" stop-opacity="0.95"/>
            </linearGradient>
            <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#78350F"/>
              <stop offset="50%" stop-color="#92400E"/>
              <stop offset="100%" stop-color="#B45309"/>
            </linearGradient>
            <filter id="yellowGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <!-- Ground Baseline -->
          <rect x="50" y="300" width="700" height="90" rx="8" fill="url(#groundGrad)" />
          <line x1="50" y1="300" x2="750" y2="300" stroke="#FACC15" stroke-opacity="0.4" stroke-width="2" />

          <!-- Roots System -->
          <g id="rootsGroup">
            <path id="root1" d="M400,305 Q380,335 340,360" stroke="#B45309" stroke-width="4" stroke-linecap="round" fill="none" />
            <path id="root2" d="M400,305 Q410,345 440,375" stroke="#B45309" stroke-width="4.5" stroke-linecap="round" fill="none" />
            <path id="root3" d="M400,305 Q400,350 390,385" stroke="#92400E" stroke-width="5" stroke-linecap="round" fill="none" />
            <path id="root4" d="M360,335 Q330,345 300,355" stroke="#78350F" stroke-width="2.5" stroke-linecap="round" fill="none" />
            <path id="root5" d="M420,340 Q450,355 480,365" stroke="#78350F" stroke-width="2.5" stroke-linecap="round" fill="none" />
          </g>

          <!-- Golden Seed -->
          <ellipse id="seedCore" cx="400" cy="302" rx="14" ry="10" fill="#FACC15" filter="url(#yellowGlow)" />

          <!-- Trunk -->
          <path id="trunkPath" d="M388,300 Q394,220 395,160 L405,160 Q406,220 412,300 Z" fill="url(#trunkGrad)" />

          <!-- Primary Branches -->
          <g id="branchesGroup">
            <path id="branchL1" d="M396,210 Q350,180 300,165" stroke="#92400E" stroke-width="6" stroke-linecap="round" fill="none" />
            <path id="branchR1" d="M404,210 Q450,180 500,165" stroke="#92400E" stroke-width="6" stroke-linecap="round" fill="none" />
            <path id="branchL2" d="M398,170 Q370,140 330,110" stroke="#B45309" stroke-width="4.5" stroke-linecap="round" fill="none" />
            <path id="branchR2" d="M402,170 Q430,140 470,110" stroke="#B45309" stroke-width="4.5" stroke-linecap="round" fill="none" />
            <path id="branchTop" d="M400,160 Q400,110 400,75" stroke="#92400E" stroke-width="5" stroke-linecap="round" fill="none" />
          </g>

          <!-- Golden Yellow Leaves Blooms -->
          <g id="leavesGroup" filter="url(#yellowGlow)">
            <ellipse class="tree-leaf" cx="300" cy="165" rx="18" ry="12" fill="#FACC15" transform="rotate(-20 300 165)" />
            <ellipse class="tree-leaf" cx="280" cy="150" rx="16" ry="10" fill="#FFE066" transform="rotate(-35 280 150)" />
            <ellipse class="tree-leaf" cx="500" cy="165" rx="18" ry="12" fill="#FACC15" transform="rotate(20 500 165)" />
            <ellipse class="tree-leaf" cx="520" cy="150" rx="16" ry="10" fill="#FFE066" transform="rotate(35 520 150)" />
            <ellipse class="tree-leaf" cx="330" cy="110" rx="19" ry="13" fill="#FACC15" transform="rotate(-15 330 110)" />
            <ellipse class="tree-leaf" cx="310" cy="95" rx="17" ry="11" fill="#FFE066" transform="rotate(-30 310 95)" />
            <ellipse class="tree-leaf" cx="470" cy="110" rx="19" ry="13" fill="#FACC15" transform="rotate(15 470 110)" />
            <ellipse class="tree-leaf" cx="490" cy="95" rx="17" ry="11" fill="#FFE066" transform="rotate(30 490 95)" />
            <ellipse class="tree-leaf" cx="400" cy="75" rx="22" ry="15" fill="#FACC15" />
            <ellipse class="tree-leaf" cx="380" cy="60" rx="18" ry="12" fill="#FFE066" transform="rotate(-10 380 60)" />
            <ellipse class="tree-leaf" cx="420" cy="60" rx="18" ry="12" fill="#FFE066" transform="rotate(10 420 60)" />
            <ellipse class="tree-leaf" cx="400" cy="40" rx="20" ry="13" fill="#FEF08A" />
            <ellipse class="tree-leaf" cx="355" cy="140" rx="15" ry="10" fill="#FACC15" />
            <ellipse class="tree-leaf" cx="445" cy="140" rx="15" ry="10" fill="#FACC15" />
          </g>
        </svg>
      </div>
    </div>`;
    }

    // LAYOUT 1C: Network HTTP Request/Response Explainer Flow
    if (scene.sceneType === "network-http-flow") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1400px; display: flex; flex-direction: column; align-items: center; gap: 30px;">
      <div style="text-align: center;">
        <div class="badge-pill anim-header" id="sceneBadge" style="background: rgba(0, 245, 255, 0.12); color: #00F5FF; border-color: rgba(0, 245, 255, 0.3);">
          <span class="badge-pulse-dot"></span>
          <span>${this.escapeHtml(scene.badge || "HTTP CLIENT-SERVER FLOW")}</span>
        </div>
        <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 52px; margin-top: 12px;">
          ${formattedHeadline}
        </h1>
        <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 20px; margin-top: 8px;">
          ${this.escapeHtml(scene.subtitle)}
        </p>
      </div>

      <!-- BESPOKE HTTP REQUEST/RESPONSE DIAGRAM -->
      <div class="glass-card" style="width: 100%; max-width: 1100px; padding: 40px; position: relative; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; position: relative;">
          
          <!-- CLIENT MACHINE -->
          <div id="clientNode" class="glass-card" style="width: 240px; padding: 24px; text-align: center; border: 2px solid #00F5FF; background: rgba(0, 245, 255, 0.05); z-index: 5;">
            <div style="width: 50px; height: 50px; margin: 0 auto 12px; border-radius: 12px; background: rgba(0, 245, 255, 0.15); display: flex; align-items: center; justify-content: center;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00F5FF" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div class="display-font" style="font-size: 20px; font-weight: 800; color: #FFFFFF;">CLIENT BROWSER</div>
            <div style="font-size: 13px; color: #94A3B8; margin-top: 6px;">IP: 192.168.1.104</div>
            <div id="clientStatusBadge" style="margin-top: 10px; font-size: 12px; font-weight: 700; color: #00F5FF; background: rgba(0, 245, 255, 0.1); padding: 4px 10px; border-radius: 6px;">DISPATCHING</div>
          </div>

          <!-- NETWORK TRANSIT LANES -->
          <div style="flex: 1; margin: 0 30px; display: flex; flex-direction: column; gap: 40px; position: relative;">
            
            <!-- TOP LANE: REQUEST (Client -> Server) -->
            <div style="position: relative; height: 44px; display: flex; align-items: center;">
              <div style="position: absolute; inset: 0; display: flex; align-items: center;">
                <div style="width: 100%; height: 2px; background: rgba(0, 245, 255, 0.25); border-top: 2px dashed rgba(0, 245, 255, 0.5);"></div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#00F5FF" style="margin-left: -8px;"><path d="M5 3l14 9-14 9V3z"/></svg>
              </div>
              <div id="requestPacket" style="position: absolute; left: 0; background: #00F5FF; color: #050814; font-weight: 900; font-size: 13px; padding: 6px 16px; border-radius: 20px; box-shadow: 0 0 20px #00F5FF; white-space: nowrap; z-index: 10;">
                HTTP GET /api/data &rarr;
              </div>
            </div>

            <!-- BOTTOM LANE: RESPONSE (Server -> Client) -->
            <div style="position: relative; height: 44px; display: flex; align-items: center;">
              <div style="position: absolute; inset: 0; display: flex; align-items: center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#10B981" style="margin-right: -8px;"><path d="M19 21L5 12l14-9v18z"/></svg>
                <div style="width: 100%; height: 2px; background: rgba(16, 185, 129, 0.25); border-top: 2px dashed rgba(16, 185, 129, 0.5);"></div>
              </div>
              <div id="responsePacket" style="position: absolute; right: 0; background: #10B981; color: #050814; font-weight: 900; font-size: 13px; padding: 6px 16px; border-radius: 20px; box-shadow: 0 0 20px #10B981; white-space: nowrap; z-index: 10;">
                &larr; HTTP 200 OK (JSON)
              </div>
            </div>

          </div>

          <!-- SERVER MACHINE -->
          <div id="serverNode" class="glass-card" style="width: 240px; padding: 24px; text-align: center; border: 2px solid #10B981; background: rgba(16, 185, 129, 0.05); z-index: 5;">
            <div style="width: 50px; height: 50px; margin: 0 auto 12px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); display: flex; align-items: center; justify-content: center;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            </div>
            <div class="display-font" style="font-size: 20px; font-weight: 800; color: #FFFFFF;">ORIGIN SERVER</div>
            <div style="font-size: 13px; color: #94A3B8; margin-top: 6px;">PORT: 443 (HTTPS)</div>
            <div id="serverStatusBadge" style="margin-top: 10px; font-size: 12px; font-weight: 700; color: #10B981; background: rgba(16, 185, 129, 0.1); padding: 4px 10px; border-radius: 6px;">STANDBY</div>
          </div>

        </div>
      </div>
    </div>`;
    }

    // LAYOUT 1D: Abstract Geometric Motion Graphics (Monochrome)
    if (scene.sceneType === "abstract-geometric-motion") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1400px; display: flex; flex-direction: column; align-items: center; gap: 32px;">
      <div style="text-align: center;">
        <div class="badge-pill anim-header" id="sceneBadge" style="background: rgba(255, 255, 255, 0.1); color: #FFFFFF; border-color: rgba(255, 255, 255, 0.3);">
          <span class="badge-pulse-dot" style="background: #FFFFFF; box-shadow: 0 0 10px #FFFFFF;"></span>
          <span>${this.escapeHtml(scene.badge || "GEOMETRIC ABSTRACTION")}</span>
        </div>
        <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 56px; color: #FFFFFF; margin-top: 12px;">
          ${formattedHeadline}
        </h1>
        <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 20px; color: #94A3B8; margin-top: 8px;">
          ${this.escapeHtml(scene.subtitle)}
        </p>
      </div>

      <!-- BESPOKE PURE WHITE GEOMETRIC MOTION VECTOR RIG -->
      <div style="width: 100%; max-width: 500px; height: 380px; display: flex; align-items: center; justify-content: center; position: relative;">
        <svg viewBox="0 0 400 400" style="width: 100%; height: 100%; overflow: visible;">
          <!-- Outer Rotating Polygon Square -->
          <rect id="geomSquare1" x="75" y="75" width="250" height="250" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.8" />
          
          <!-- Mid Inset Rotated Diamond -->
          <rect id="geomDiamond" x="110" y="110" width="180" height="180" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="8,6" stroke-opacity="0.6" />

          <!-- Concentric Ripple Circles -->
          <circle id="geomCircleOuter" cx="200" cy="200" r="160" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-opacity="0.4" />
          <circle id="geomCircleMid" cx="200" cy="200" r="100" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.8" />
          <circle id="geomCircleInner" cx="200" cy="200" r="40" fill="none" stroke="#FFFFFF" stroke-width="2" />
          
          <!-- Central Core Node -->
          <circle id="geomCoreDot" cx="200" cy="200" r="8" fill="#FFFFFF" />

          <!-- Crosshair Alignment Vectors -->
          <line x1="20" y1="200" x2="380" y2="200" stroke="#FFFFFF" stroke-width="1" stroke-opacity="0.3" stroke-dasharray="4,8" />
          <line x1="200" y1="20" x2="200" y2="380" stroke="#FFFFFF" stroke-width="1" stroke-opacity="0.3" stroke-dasharray="4,8" />
        </svg>
      </div>
    </div>`;
    }

    // LAYOUT 2: Animated SVG Bar Chart
    if (scene.sceneType === "animated-bar-chart") {

      const bars = scene.dataVisualization?.bars || [
        { label: "Q1", value: 30, formattedValue: "3,000", color: palette.primary },
        { label: "Q2", value: 55, formattedValue: "5,500", color: palette.secondary },
        { label: "Q3", value: 80, formattedValue: "8,000", color: palette.accent },
        { label: "Q4", value: 100, formattedValue: "10,000", color: palette.accent },
      ];

      const barElements = bars
        .map((b, idx) => {
          const barW = 120;
          const spacing = 190;
          const x = 110 + idx * spacing;
          const maxH = 260;
          const h = Math.round((b.value / 100) * maxH);
          const y = 320 - h;

          return `
          <!-- Bar ${idx + 1} -->
          <g class="bar-group" id="barGroup${idx}">
            <defs>
              <linearGradient id="barGrad${idx}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${b.color}" />
                <stop offset="100%" stop-color="${palette.primary}" stop-opacity="0.3" />
              </linearGradient>
            </defs>
            <rect id="barRect${idx}" x="${x}" y="320" width="${barW}" height="0" rx="10" fill="url(#barGrad${idx})" filter="drop-shadow(0 0 16px ${b.color}66)" />
            <text id="barVal${idx}" x="${x + barW / 2}" y="${y - 14}" text-anchor="middle" font-size="22" font-weight="900" fill="#FFFFFF" class="display-font" opacity="0">${b.formattedValue}</text>
            <text x="${x + barW / 2}" y="356" text-anchor="middle" font-size="16" font-weight="700" fill="${palette.textMutedColor}" class="body-font">${b.label}</text>
          </g>`;
        })
        .join("\n");

      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1400px; display: flex; flex-direction: column; align-items: center; gap: 32px;">
      <div style="text-align: center;">
        <div class="badge-pill anim-header" id="sceneBadge"><span class="badge-pulse-dot"></span><span>${this.escapeHtml(scene.badge || "DATA ANALYTICS")}</span></div>
        <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 52px; margin-top: 14px;">
          ${formattedHeadline}
        </h1>
        <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 20px; margin-top: 10px;">
          ${this.escapeHtml(scene.subtitle)}
        </p>
      </div>

      <!-- ANIMATED SVG BAR CHART -->
      <div class="glass-card anim-chart" style="width: 100%; max-width: 1000px; padding: 24px 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
        <svg viewBox="0 0 900 390" style="width: 100%; height: 320px; overflow: visible;">
          <!-- Baseline and Gridlines -->
          <line x1="60" y1="320" x2="840" y2="320" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
          <line x1="60" y1="200" x2="840" y2="200" stroke="rgba(255,255,255,0.06)" stroke-dasharray="6,6" stroke-width="1" />
          <line x1="60" y1="80" x2="840" y2="80" stroke="rgba(255,255,255,0.06)" stroke-dasharray="6,6" stroke-width="1" />
${barElements}
        </svg>
      </div>
    </div>`;
    }

    // LAYOUT 3: Metrics Counter HUD
    if (scene.sceneType === "metrics-counter-hud") {
      const metrics = scene.dataVisualization?.metrics || [
        { label: "Active Nodes", value: "99.9%" },
        { label: "Turnaround Speed", value: "12x Faster" },
        { label: "Global Scale", value: "1,000,000+" },
      ];

      const cardsHtml = metrics
        .map(
          (m, idx) => `
        <div class="glass-card anim-metric-card" id="metricCard${idx}" style="flex: 1; padding: 36px 30px; text-align: center; border-top: 3px solid ${idx === 0 ? palette.accent : idx === 1 ? palette.primary : palette.secondary};">
          <div class="metric-value-large display-font" id="metricVal${idx}">${this.escapeHtml(m.value)}</div>
          <div class="metric-label-muted body-font">${this.escapeHtml(m.label)}</div>
          ${m.trend ? `<div style="font-size: 13px; font-weight: 700; color: ${m.trend === 'down' ? '#34D399' : palette.accent}; margin-top: 12px;">STATUS: VERIFIED</div>` : ""}
        </div>`,
        )
        .join("\n");

      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: center; gap: 40px;">
      <div style="text-align: center;">
        <div class="badge-pill anim-header" id="sceneBadge"><span class="badge-pulse-dot"></span><span>${this.escapeHtml(scene.badge || "KEY METRICS")}</span></div>
        <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 54px; margin-top: 14px;">
          ${formattedHeadline}
        </h1>
        <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 21px; margin-top: 10px;">
          ${this.escapeHtml(scene.subtitle)}
        </p>
      </div>

      <div style="width: 100%; display: flex; gap: 24px; align-items: stretch;">
${cardsHtml}
      </div>
    </div>`;
    }

    // LAYOUT 4: Process Flow Nodes
    if (scene.sceneType === "process-flow-nodes") {
      const nodes = scene.dataVisualization?.nodes || [
        { label: "Prompt Input", sub: "Natural Language" },
        { label: "AI Reasoning", sub: "Scene Planning" },
        { label: "GPU Render", sub: "HyperFrames 0.8.139" },
        { label: "Instant Delivery", sub: "Global Edge CDN" },
      ];

      const nodesHtml = nodes
        .map(
          (node, idx) => `
        <div class="glass-card anim-node" id="node${idx}" style="flex: 1; padding: 28px 20px; text-align: center; position: relative;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: ${palette.accent}; color: #05070B; font-weight: 900; font-size: 18px; margin-bottom: 16px;">
            0${idx + 1}
          </div>
          <div style="font-size: 19px; font-weight: 800; color: #FFFFFF;" class="display-font">${this.escapeHtml(node.label)}</div>
          <div style="font-size: 14px; font-weight: 500; color: ${palette.textMutedColor}; margin-top: 6px;" class="body-font">${this.escapeHtml(node.sub || "")}</div>
        </div>`,
        )
        .join("\n");

      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1350px; display: flex; flex-direction: column; align-items: center; gap: 40px;">
      <div style="text-align: center;">
        <div class="badge-pill anim-header" id="sceneBadge"><span class="badge-pulse-dot"></span><span>${this.escapeHtml(scene.badge || "SYSTEM ARCHITECTURE")}</span></div>
        <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 54px; margin-top: 14px;">
          ${formattedHeadline}
        </h1>
        <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 21px; margin-top: 10px;">
          ${this.escapeHtml(scene.subtitle)}
        </p>
      </div>

      <div style="width: 100%; display: flex; gap: 20px; align-items: stretch;">
${nodesHtml}
      </div>
    </div>`;
    }

    // LAYOUT 5: Kinetic Typography Impact
    if (scene.sceneType === "kinetic-typography") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1250px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 28px;">
      <div class="badge-pill anim-header" id="sceneBadge"><span class="badge-pulse-dot"></span><span>${this.escapeHtml(scene.badge || "MISSION STATEMENT")}</span></div>
      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 66px; line-height: 1.15; max-width: 1100px;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 24px;">
        ${this.escapeHtml(scene.subtitle)}
      </p>
    </div>`;
    }

    // LAYOUT 6: Architectural Spec
    if (scene.sceneType === "architectural-spec") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: flex-start; gap: 32px;">
      <div>
        <div class="badge-pill anim-header" id="sceneBadge"><span class="badge-pulse-dot"></span><span>${this.escapeHtml(scene.badge || "BLUEPRINT SPEC")}</span></div>
        <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 58px; margin-top: 14px;">
          ${formattedHeadline}
        </h1>
        <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 22px; margin-top: 10px;">
          ${this.escapeHtml(scene.subtitle)}
        </p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; width: 100%;">
        <div class="glass-card anim-metric-card" style="padding: 30px;">
          <div style="font-size: 14px; font-weight: 700; color: ${palette.accent}; text-transform: uppercase;">STRUCTURAL CODE</div>
          <div style="font-size: 32px; font-weight: 900; color: #FFF; margin-top: 8px;">EN-1993 STEEL</div>
          <div style="font-size: 14px; color: ${palette.textMutedColor}; margin-top: 6px;">Seismic dampeners, reinforced pile foundations</div>
        </div>
        <div class="glass-card anim-metric-card" style="padding: 30px;">
          <div style="font-size: 14px; font-weight: 700; color: ${palette.accent}; text-transform: uppercase;">FAÇADE ENVELOPE</div>
          <div style="font-size: 32px; font-weight: 900; color: #FFF; margin-top: 8px;">TRIPLE GLAZED</div>
          <div style="font-size: 14px; color: ${palette.textMutedColor}; margin-top: 6px;">Low-E solar reflectance, thermal barrier</div>
        </div>
        <div class="glass-card anim-metric-card" style="padding: 30px;">
          <div style="font-size: 14px; font-weight: 700; color: ${palette.accent}; text-transform: uppercase;">ENERGY RATING</div>
          <div style="font-size: 32px; font-weight: 900; color: #FFF; margin-top: 8px;">NET ZERO 2026</div>
          <div style="font-size: 14px; color: ${palette.textMutedColor}; margin-top: 6px;">Integrated rooftop photovoltaic array</div>
        </div>
      </div>
    </div>`;
    }

    // LAYOUT 7: Comparison Impact
    if (scene.sceneType === "comparison-impact") {
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1250px; display: flex; flex-direction: column; align-items: center; gap: 36px;">
      <div style="text-align: center;">
        <div class="badge-pill anim-header" id="sceneBadge"><span class="badge-pulse-dot"></span><span>${this.escapeHtml(scene.badge || "PERFORMANCE COMPARISON")}</span></div>
        <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 54px; margin-top: 14px;">
          ${formattedHeadline}
        </h1>
        <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 21px; margin-top: 10px;">
          ${this.escapeHtml(scene.subtitle)}
        </p>
      </div>

      <div style="width: 100%; display: flex; gap: 30px;">
        <div class="glass-card anim-metric-card" style="flex: 1; padding: 40px; border-top: 4px solid #EF4444;">
          <div style="font-size: 22px; font-weight: 800; color: #EF4444;" class="display-font">TRADITIONAL METHODS</div>
          <ul style="list-style: none; margin-top: 20px; display: flex; flex-direction: column; gap: 14px; font-size: 17px; color: ${palette.textMutedColor};">
            <li>✕ Manual timeline keyframing</li>
            <li>✕ Hours spent debugging missing video frames</li>
            <li>✕ Inconsistent visual styling & templates</li>
          </ul>
        </div>
        <div class="glass-card anim-metric-card" style="flex: 1; padding: 40px; border-top: 4px solid ${palette.accent}; background: rgba(0, 245, 255, 0.05);">
          <div style="font-size: 22px; font-weight: 800; color: ${palette.accent};" class="display-font">HYPERFRAMES AUTOMATION</div>
          <ul style="list-style: none; margin-top: 20px; display: flex; flex-direction: column; gap: 14px; font-size: 17px; color: #FFFFFF;">
            <li>✓ Prompt-driven creative brief & scene math</li>
            <li>✓ Frame-accurate GSAP headless rendering</li>
            <li>✓ Production-ready MP4 delivery in seconds</li>
          </ul>
        </div>
      </div>
    </div>`;
    }

    // LAYOUT 8: Cinematic Climax CTA (Final Scene)
    return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1200px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 28px;">
      <div class="badge-pill anim-header" id="sceneBadge"><span class="badge-pulse-dot"></span><span>${this.escapeHtml(scene.badge || "DISCOVER MORE")}</span></div>
      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 68px;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 24px; max-width: 850px;">
        ${this.escapeHtml(scene.subtitle)}
      </p>
      <div class="anim-cta" style="margin-top: 14px;">
        <button class="btn-cta display-font">
          <span>${this.escapeHtml(scene.ctaText || "GET STARTED NOW")}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>`;
  }

  private static renderGsapScript(
    scene: PlannedScene,
    brief: CreativeBrief,
  ): string {
    const dur = scene.duration;
    const isChart = scene.sceneType === "animated-bar-chart";
    const hasBackdrop = scene.visualAtmosphere.backgroundType === "image-backdrop" && !!scene.assetToFeature;

    let chartAnimations = "";
    if (isChart && scene.dataVisualization?.bars) {
      const bars = scene.dataVisualization.bars;
      chartAnimations = bars
        .map((b, idx) => {
          const maxH = 260;
          const h = Math.round((b.value / 100) * maxH);
          const y = 320 - h;
          const barStartTime = 0.4 + idx * 0.12;

          return `
    tl.fromTo("#barRect${idx}", 
      { attr: { height: 0, y: 320 } }, 
      { attr: { height: ${h}, y: ${y} }, duration: 1.0, ease: "power2.out" }, 
      ${barStartTime.toFixed(2)}
    );
    tl.fromTo("#barVal${idx}", 
      { opacity: 0, y: 20 }, 
      { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 
      ${(barStartTime + 0.2).toFixed(2)}
    );`;
        })
        .join("\n");
    }

    let bespokeSceneAnimations = "";
    if (scene.sceneType === "nature-tree-growth") {
      bespokeSceneAnimations = `
    // Organic tree growth animation
    tl.fromTo("#seedCore",
      { scale: 0.6, transformOrigin: "center center" },
      { scale: 1.15, duration: 0.8, ease: "power2.out", yoyo: true, repeat: 1 },
      0.2
    );
    tl.fromTo("#rootsGroup path",
      { strokeDasharray: 200, strokeDashoffset: 200 },
      { strokeDashoffset: 0, duration: 1.4, stagger: 0.12, ease: "power2.out" },
      0.3
    );
    tl.fromTo("#trunkPath",
      { scaleY: 0, transformOrigin: "bottom center" },
      { scaleY: 1, duration: 1.5, ease: "power2.out" },
      0.7
    );
    tl.fromTo("#branchesGroup path",
      { strokeDasharray: 250, strokeDashoffset: 250 },
      { strokeDashoffset: 0, duration: 1.3, stagger: 0.15, ease: "power2.out" },
      1.2
    );
    tl.fromTo(".tree-leaf",
      { scale: 0, opacity: 0, transformOrigin: "center center" },
      { scale: 1, opacity: 1, duration: 0.9, stagger: 0.06, ease: "back.out(1.7)" },
      1.6
    );`;
    } else if (scene.sceneType === "network-http-flow") {
      bespokeSceneAnimations = `
    // Network HTTP request & response packet animation via GPU transforms (x)
    tl.fromTo("#requestPacket",
      { x: 0, opacity: 0 },
      { x: 420, opacity: 1, duration: ${Math.min(2.0, dur * 0.4).toFixed(2)}, ease: "power2.inOut" },
      0.4
    );
    tl.to("#serverNode",
      { boxShadow: "0 0 35px #10B981", duration: 0.5, yoyo: true, repeat: 1 },
      ${Math.min(2.4, dur * 0.45).toFixed(2)}
    );
    tl.fromTo("#responsePacket",
      { x: 0, opacity: 0 },
      { x: -420, opacity: 1, duration: ${Math.min(2.0, dur * 0.4).toFixed(2)}, ease: "power2.inOut" },
      ${Math.min(2.8, dur * 0.52).toFixed(2)}
    );
    tl.to("#clientNode",
      { boxShadow: "0 0 35px #00F5FF", duration: 0.5 },
      ${Math.min(4.8, dur * 0.88).toFixed(2)}
    );`;
    } else if (scene.sceneType === "abstract-geometric-motion") {
      bespokeSceneAnimations = `
    // Pure geometric vector rotation & pulse
    tl.fromTo("#geomSquare1",
      { rotation: 0, transformOrigin: "center center", scale: 0.8 },
      { rotation: 90, scale: 1.05, duration: ${dur.toFixed(2)}, ease: "power2.inOut" },
      0
    );
    tl.fromTo("#geomDiamond",
      { rotation: 45, transformOrigin: "center center", scale: 0.9 },
      { rotation: -45, scale: 1.1, duration: ${dur.toFixed(2)}, ease: "none" },
      0
    );
    tl.fromTo("#geomCircleOuter",
      { scale: 0.7, opacity: 0.2, transformOrigin: "center center" },
      { scale: 1.15, opacity: 0.8, duration: ${dur.toFixed(2)}, ease: "sine.inOut" },
      0
    );
    tl.fromTo("#geomCircleMid",
      { scale: 1.2, transformOrigin: "center center" },
      { scale: 0.85, duration: ${dur.toFixed(2)}, ease: "sine.inOut" },
      0
    );`;
    } else if (scene.sceneType === "green-lantern-ring") {
      bespokeSceneAnimations = `
    // Emerald Ring scale & plasma aura expansion
    tl.fromTo("#ringAura",
      { scale: 0.6, opacity: 0.3 },
      { scale: 1.25, opacity: 0.9, duration: 1.6, ease: "power2.out", yoyo: true, repeat: 1 },
      0.1
    );
    tl.fromTo("#glRingSvg",
      { scale: 0.7, opacity: 0, rotation: -25, transformOrigin: "center center" },
      { scale: 1, opacity: 1, rotation: 0, duration: 1.2, ease: "back.out(1.4)" },
      0.2
    );
    tl.fromTo("#glCore",
      { scale: 0.5, opacity: 0.4, transformOrigin: "center center" },
      { scale: 1.3, opacity: 1, duration: 0.8, yoyo: true, repeat: 2, ease: "power1.inOut" },
      0.5
    );`;
    } else if (scene.sceneType === "green-lantern-guy-gardner") {
      bespokeSceneAnimations = `
    // Guy Gardner Construct Fist Impact & Telemetry Cards Stagger
    tl.fromTo(".anim-construct-fist",
      { scale: 0.5, opacity: 0, x: -60 },
      { scale: 1, opacity: 1, x: 0, duration: 1.0, ease: "back.out(1.5)" },
      0.2
    );
    tl.fromTo(".anim-metric-card",
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: "power2.out" },
      0.4
    );`;
    } else if (scene.sceneType === "green-lantern-oath") {
      bespokeSceneAnimations = `
    // Radiant Oath Flare Beam & Climax Reveal
    tl.fromTo("#oathFlare",
      { scaleX: 0.2, opacity: 0 },
      { scaleX: 1.4, opacity: 1, duration: 1.2, ease: "power3.out" },
      0.2
    );
    tl.fromTo(".btn-cta",
      { scale: 0.85, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.6)" },
      0.6
    );`;
    } else if (scene.sceneType === "superman-shield") {
      bespokeSceneAnimations = `
    // Solar rays & S-Shield reveal
    tl.fromTo(".anim-ring-glow",
      { scale: 0.7, opacity: 0, rotation: -10, transformOrigin: "center center" },
      { scale: 1.05, opacity: 1, rotation: 0, duration: 1.2, ease: "back.out(1.4)" },
      0.1
    );`;
    } else if (scene.sceneType === "superman-clark-kent" || scene.sceneType === "superman-metropolis" || scene.sceneType === "superman-solar") {
      bespokeSceneAnimations = `
    // Dossier Cards stagger & solar energy flare
    tl.fromTo(".anim-cards > div",
      { opacity: 0, y: 35, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.12, ease: "power2.out" },
      0.3
    );`;
    } else if (scene.sceneType === "superman-climax") {
      bespokeSceneAnimations = `
    // Man of Steel Climax Reveal & CTA
    tl.fromTo(".anim-ring-glow",
      { scale: 0.8, opacity: 0 },
      { scale: 1.05, opacity: 1, duration: 1.0, ease: "power2.out" },
      0.1
    );
    tl.fromTo(".cta-button",
      { scale: 0.85, opacity: 0, y: 20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.9, ease: "back.out(1.5)" },
      0.6
    );`;
    }

    const backdropCameraAnimation = hasBackdrop
      ? `
    // Subtle cinematic camera push on background image
    tl.fromTo("#heroBackdropImg",
      { scale: 1.0 },
      { scale: 1.06, duration: ${dur.toFixed(2)}, ease: "none" },
      0
    );`
      : "";

    return `
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });

    ${backdropCameraAnimation}

    // Header & badge entrance
    tl.fromTo("#sceneBadge",
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
      0.1
    );

    // Headline bold entrance
    tl.fromTo("#sceneTitle",
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" },
      0.2
    );

    // Subtitle entrance
    tl.fromTo("#sceneSubtitle",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
      0.35
    );

    // Layout-specific animated components
    ${chartAnimations}
    ${bespokeSceneAnimations}

    tl.fromTo(".anim-metric-card, .anim-node, .anim-chart, .anim-cta",
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: "power2.out" },
      0.4
    );

    // Ensure timeline spans exact scene duration
    tl.to("#root", { duration: ${dur.toFixed(2)}, ease: "none" }, 0);

    window.__timelines["${scene.id}"] = tl;
    tl.seek(0);
`;
  }

  private static formatHighlightedHeadline(
    headline: string,
    highlightWord?: string,
  ): string {
    if (!highlightWord) return this.escapeHtml(headline);

    const regex = new RegExp(`(${this.escapeRegex(highlightWord)})`, "gi");
    return this.escapeHtml(headline).replace(
      regex,
      '<span class="highlight-span">$1</span>',
    );
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

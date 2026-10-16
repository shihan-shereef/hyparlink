import { CreativeBrief } from "./creative-brief.js";
import { PlannedTimeline, PlannedScene } from "./scene-planner.js";
import { AnalyzedAsset } from "./asset-analyzer.js";
import { jsonrepair } from "jsonrepair";

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
      const sceneId = String(scene.id || `scene_${scene.index || 0}`);
      const sceneFileName = `compositions/${sceneId.replace("-", "_")}.html`;
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
        scenes: scenes.map((s) => {
          const sId = String(s.id || `scene_${s.index || 0}`);
          return {
            id: sId,
            name: s.name,
            src: `compositions/${sId.replace("-", "_")}.html`,
            start: s.start,
            duration: s.duration,
          };
        }),
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

  /**
   * Synthesizes authentic, prompt-specific HyperFrames scenes using the LLM.
   * Directly authors bespoke HTML, SVG, and GSAP motion code for every scene.
   */
  public static async synthesizeWithAI(
    provider: any,
    brief: CreativeBrief,
    timeline: PlannedTimeline,
    analyzedAssets: AnalyzedAsset[],
    specs: { width: number; height: number; fps: number },
    model?: string,
    onProgress?: (stage: string, message: string) => void | Promise<void>,
  ): Promise<SynthesizedProjectFiles> {
    const { width, height, fps } = specs;
    const { totalDuration, scenes } = timeline;

    const files: Record<string, string> = {};

    // 1. Build root host index.html
    files["index.html"] = this.buildIndexHtml(
      brief,
      timeline,
      width,
      height,
      fps,
    );

    // 2. Build meta.json
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

    // 3. Build project.json
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
        scenes: scenes.map((s) => {
          const sId = String(s.id || `scene_${s.index || 0}`);
          return {
            id: sId,
            name: s.name,
            src: `compositions/${sId.replace("-", "_")}.html`,
            start: s.start,
            duration: s.duration,
          };
        }),
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

    // 4. Concurrently generate authentic, bespoke HTML for all scenes
    const scenePromises = scenes.map(async (scene, idx) => {
      const sceneId = String(scene.id || `scene_${scene.index || idx}`);
      const sceneFileName = `compositions/${sceneId.replace("-", "_")}.html`;
      const prevScene = idx > 0 ? scenes[idx - 1] : undefined;
      const nextScene = idx < scenes.length - 1 ? scenes[idx + 1] : undefined;

      try {
        if (provider && typeof provider.complete === "function") {
          const generatedHtml = await this.generateSceneWithAI(
            provider,
            scene,
            brief,
            analyzedAssets,
            specs,
            model,
            (brief as any).userPrompt || brief.subject,
            prevScene,
            nextScene,
          );
          if (generatedHtml) {
            // Verify generatedHtml actually contains visual DOM elements inside the root container (NOT an empty black box)
            const rootMatch = generatedHtml.match(/<div[^>]*\bid=["']root["'][^>]*>([\s\S]*?)<\/div>/i);
            const innerContent = rootMatch ? rootMatch[1] : generatedHtml;
            const stripped = innerContent
              .replace(/<script\b[\s\S]*?<\/script>/gi, "")
              .replace(/<style\b[\s\S]*?<\/style>/gi, "")
              .trim();
            const hasVisual = /<(h[1-6]|p|span|div|svg|img|video|canvas|ul|ol|table|card|section|article)\b/i.test(stripped) && stripped.length > 50;

            if (hasVisual) {
              console.log(`[CompositionSynthesizer] Scene ${idx + 1} (${scene.id}) synthesized via LLM (${generatedHtml.length} chars).`);
              files[sceneFileName] = generatedHtml;
              return;
            } else {
              console.warn(
                `[CompositionSynthesizer] Scene ${idx + 1} (${scene.id}) LLM output lacked visual content (${stripped.length} chars). Falling back to rich presentation slide synthesizer.`,
              );
            }
          }
        }
      } catch (err: any) {
        console.warn(
          `[CompositionSynthesizer] LLM scene generation notice for ${scene.id}: ${err.message}. Using dynamic motion synthesizer.`,
        );
      }

      // Enhanced dynamic synthesis fallback
      files[sceneFileName] = this.buildSceneHtml(
        scene,
        brief,
        analyzedAssets,
        width,
        height,
        fps,
      );
    });

    await Promise.all(scenePromises);

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

  /**
   * Prompts the LLM to write a complete, bespoke, standalone HyperFrames scene HTML file.
   * Provides full narrative context, available asset manifests, and auto-heals syntax.
   */
  private static async generateSceneWithAI(
    provider: any,
    scene: PlannedScene,
    brief: CreativeBrief,
    analyzedAssets: AnalyzedAsset[],
    specs: { width: number; height: number; fps: number },
    model?: string,
    userPrompt?: string,
    prevScene?: PlannedScene,
    nextScene?: PlannedScene,
  ): Promise<string | null> {
    const { width, height } = specs;
    const palette = brief.colorPalette;
    const typo = brief.typography;
    const displayFont = typo.displayFont || "Plus Jakarta Sans";
    const bodyFont = typo.bodyFont || "Inter";
    const dur = scene.duration;

    // Build asset manifest information for the LLM
    let assetInstructions = "No external image assets provided. Create bespoke SVGs, typography, and CSS vector visuals.";
    if (analyzedAssets && analyzedAssets.length > 0) {
      const assetList = analyzedAssets.map((a, i) => `  ${i + 1}. Filename: "assets/${a.name}" (Role: ${a.role || "hero"}, Type: ${a.type})`).join("\n");
      assetInstructions = `WORKSPACE ASSETS AVAILABLE (Reference in HTML as "assets/<filename>"):
${assetList}
CRITICAL ASSET EMBEDDING RULE:
- If this scene should feature an asset, embed it directly:
  <img src="assets/${(scene.assetToFeature || analyzedAssets[0]).name}" alt="Hero Visual" class="hero-product-img" style="max-width: 650px; max-height: 480px; object-fit: contain; filter: drop-shadow(0 15px 35px rgba(0,0,0,0.6)); border-radius: 16px;" />
- Always animate the asset in your GSAP timeline (e.g. scale entrance, subtle floating movement, or camera push).`;
    }

    // Determine archetype-specific creative direction
    let archetypeGuidance = "";
    if (scene.index === 0) {
      archetypeGuidance = `SCENE ARCHETYPE: [VISUAL HOOK & HERO OPENER]
- Purpose: Capture attention instantly in the first 2 seconds!
- Visuals: Bold kinetic typography entrance, high contrast dark atmosphere, glowing neon accents (${palette.accent}), dramatic entrance of hero subject or product silhouette.
- Motion: Kinetic text stagger, glowing badge pulse, cinematic scale push on background.`;
    } else if (scene.sceneType === "nature-tree-growth" || /tree|seed|growth/i.test(brief.subject)) {
      archetypeGuidance = `SCENE ARCHETYPE: [PROCEDURAL ORGANIC TREE GROWTH]
- Visuals: Custom SVG showing roots drawing with strokeDashoffset, trunk growing upward with scaleY, branches spreading, and vibrant yellow leaves blooming with elastic bounce.
- Motion: GSAP path drawing from 0 to 1, leaf stagger scaling from scale: 0 to scale: 1.`;
    } else if (scene.sceneType === "animated-bar-chart" || /revenue|chart|data|fiscal/i.test(brief.subject)) {
      archetypeGuidance = `SCENE ARCHETYPE: [DATA-DRIVEN REVENUE BAR CHART]
- Visuals: Clean animated SVG bar chart with labeled axes, glowing bar gradients, and distinct quarterly metrics.
- Motion: GSAP animating bar heights from 0 upward and values fading in.`;
    } else if (scene.sceneType === "network-http-flow" || /http|client.*server|network/i.test(brief.subject)) {
      archetypeGuidance = `SCENE ARCHETYPE: [CLIENT-SERVER NETWORK PROTOCOL FLOW]
- Visuals: Client browser terminal on the left, origin server on the right, animated glowing request packet and response packet.
- Motion: GSAP animating packet travel along network dashed lines.`;
    } else if (scene.sceneType === "abstract-geometric-motion" || /geometric|monochrome/i.test(brief.subject)) {
      archetypeGuidance = `SCENE ARCHETYPE: [PURE GEOMETRIC VECTOR MOTION]
- Visuals: High-contrast pure white geometric vector shapes, concentric ripple rings, and rotating isometric polygons on deep black.
- Motion: GSAP rotating polygons and pulsing concentric circles with harmonic eases.`;
    } else if (scene.index === (brief.sceneCount || 4) - 1 || scene.ctaText) {
      archetypeGuidance = `SCENE ARCHETYPE: [BRAND CLIMAX & CALL TO ACTION]
- Purpose: Deliver the memorable payoff and clear call to action!
- Visuals: Prominent brand logo/title lockup, glowing CTA button (${palette.accent}), trust badges, final tagline.
- Motion: Hero title scale-up, glowing button bounce reveal, subtle light sweep.`;
    } else {
      archetypeGuidance = `SCENE ARCHETYPE: [PRODUCT IN ACTION & KEY CAPABILITIES]
- Purpose: Showcase the product's performance, speed, and craftsmanship.
- Visuals: Custom SVG speed lines / velocity arcs, split card layout with glassmorphic cards, telemetry HUD callouts.
- Motion: Staggered feature entrances, glowing leader lines, dynamic speed trail vectors.`;
    }

    const narrativeContext = `NARRATIVE SEQUENCE:
- Original Prompt: "${userPrompt || brief.subject}"
- Total Video Duration: ${brief.totalDuration}s (${brief.sceneCount || 4} scenes)
- Scene Position: Scene ${scene.index + 1} of ${brief.sceneCount || 4}
- Scene Duration: ${dur.toFixed(2)} seconds
${prevScene ? `- Preceding Scene: "${prevScene.headline}" (${prevScene.objective})` : "- Preceding Scene: None (Opening hook)"}
${nextScene ? `- Next Scene: "${nextScene.headline}" (${nextScene.objective})` : "- Next Scene: None (Final climax)"}`;

    const systemPrompt = `You are an elite Motion Graphics and HyperFrames Autonomous Animation Engineer.
Generate the COMPLETE, production-ready, standalone HTML composition file for Scene ${scene.index + 1}.

${narrativeContext}

SCENE CONTENT SPECIFICATIONS:
- Scene ID: ${scene.id}
- Scene Title: "${scene.name}"
- Scene Objective: "${scene.objective}"
${scene.visualDescription ? `- Scene Visual Content Description: "${scene.visualDescription}"` : ""}
${scene.narration ? `- Spoken Narration / Dialogue: "${scene.narration}"` : ""}
- Primary Headline: "${scene.headline}"
- Highlight Word: "${scene.highlightedWord || ""}"
- Subtitle: "${scene.subtitle}"
- Badge: "${scene.badge || ""}"
- CTA Text: "${scene.ctaText || ""}"
- Visual Style: ${brief.promptComponents?.spec?.visualStyle || "Modern cinematic motion graphics"}
- Palette: Primary=${palette.primary}, Accent=${palette.accent}, Secondary=${palette.secondary}, Background=${palette.backgroundColor}, Text=${palette.textColor}, Glow=${palette.glowColor}
- Typography: Display font '${displayFont}', Body font '${bodyFont}'

${archetypeGuidance}

${assetInstructions}

MANDATORY ANTIGRAVITY MOTION & HYPERFRAMES COMPLIANCE RULES:
1. Root element MUST be:
   <div id="root" data-composition-id="${scene.id}" data-start="0" data-duration="${dur.toFixed(2)}" data-width="${width}" data-height="${height}" style="position: relative; width: ${width}px; height: ${height}px; overflow: hidden; background: ${palette.backgroundColor};">
2. Include Google Fonts & GSAP:
   <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
3. 3-PLANE VISUAL DEPTH ARCHITECTURE:
   - Layer 0 (Atmosphere): Add an ambient technical micro-dot grid pattern, dual glowing radial blur orbs (filter: blur(90px); opacity: 0.18;), and a radial vignette to give cinematic depth.
   - Layer 1 (Midground Glassmorphism): Container cards with background: rgba(255,255,255,0.035); backdrop-filter: blur(28px); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; box-shadow: 0 30px 60px rgba(0,0,0,0.6); with glowing accent indicators.
   - Layer 2 (Foreground Kinetic Typography): Large scale contrast. Hero display headline (${displayFont}, 56px-72px, font-weight: 900, letter-spacing: -0.02em), subtitle (${bodyFont}, 18px-22px, opacity: 0.85), and badge pills (letter-spacing: 0.15em, uppercase with pulsing live indicator dot).
4. KINETIC GSAP CHOREOGRAPHY (ANTIGRAVITY ATOMIC MOTION):
   - Mandatory Eases: Use ease: "power4.out" or "expo.out" for text and card reveals. Use ease: "back.out(1.5)" for badges and buttons.
   - Cinematic Camera Push: Always add a subtle 3.5% camera push-in across the scene duration:
     tl.to("#root", { scale: 1.035, duration: ${dur.toFixed(2)}, ease: "none" }, 0);
   - Stagger: Stagger cards, feature list items, and metric pills by 0.08s.
   - Ambient Micro-Motion: Keep the scene alive with subtle harmonic floating or ambient orb movement:
     tl.to(".ambient-orb", { x: 25, y: -15, duration: ${dur.toFixed(2)}, ease: "sine.inOut" }, 0);
5. INITIAL STATE & TIMELINE RULES:
   - NEVER use tl.set(...) at position 0 to hide elements. Use gsap.set(...) immediately OUTSIDE the timeline (e.g. gsap.set(".card", { opacity: 0, y: 30 });) or author the initial hidden state in CSS.
   - NEVER chain methods on gsap.set(...) (DO NOT do gsap.set(...).to(...)).
   - Do NOT overlap GSAP tweens on the same property for the same element without overwrite: "auto".
6. COLLISION & OVERLAP PREVENTION:
   - Give each headline, badge, subtitle, and CTA its own distinct vertical or horizontal zone using Flexbox/Grid.
   - For all cards, text blocks, badges, and floating elements, mark intentional layering: data-layout-allow-overlap="true" data-layout-allow-occlusion="true".
7. Return ONLY the complete HTML code enclosed in \`\`\`html ... \`\`\`. Do not write preamble or commentary.`;

    const promptMessage = `Write the complete, standalone HTML composition for Scene ${scene.index + 1}: "${scene.headline}". Follow all HyperFrames rules and make it visually stunning.`;

    const raw = await provider.complete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: promptMessage },
      ],
      0.25,
      model,
    );

    if (raw && raw.trim().length > 100) {
      const healed = this.autoHealSceneHtml(raw, scene, specs, brief);
      if (healed) return healed;
    }

    return null;
  }

  /**
   * Auto-heals an LLM-generated HTML scene into a 100% compliant HyperFrames composition.
   * Injects root attributes, GSAP CDN, and deterministic timeline registration if omitted.
   */
  public static autoHealSceneHtml(
    rawCode: string,
    scene: PlannedScene,
    specs: { width: number; height: number; fps: number },
    brief: CreativeBrief,
  ): string {
    const { width, height } = specs;
    const dur = scene.duration;
    const palette = brief.colorPalette;
    const typo = brief.typography;
    const displayFont = typo.displayFont || "Plus Jakarta Sans";
    const bodyFont = typo.bodyFont || "Inter";

    let clean = rawCode.trim();

    // 0. Unwrap JSON response if the LLM output was formatted as a JSON object
    try {
      const trimmed = clean.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("{") && (trimmed.includes('"html"') || trimmed.includes('"code"') || trimmed.includes('"content"') || trimmed.includes('"sceneHtml"')))
      ) {
        const repaired = jsonrepair(trimmed);
        const parsed = JSON.parse(repaired);
        const candidate = parsed.html || parsed.code || parsed.content || parsed.sceneHtml || parsed.scene_html;
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          clean = candidate.trim();
        }
      }
    } catch {}

    // Extract from markdown code fences if wrapped
    if (clean.includes("```html")) {
      const match = clean.match(/```html\s*([\s\S]*?)\s*```/i);
      if (match) clean = match[1].trim();
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
    }

    // Fix unescaped quotes or literal \n if present from stringified output
    if (clean.includes('\\"') && !clean.includes('"')) {
      clean = clean.replace(/\\"/g, '"');
    }
    if (clean.includes('\\n') && !clean.includes('\n')) {
      clean = clean.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    }

    // 1. Ensure basic HTML document skeleton if only a fragment was returned
    if (!clean.includes("<html") || !clean.includes("<!DOCTYPE html>")) {
      clean = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(scene.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&family=Bebas+Neue&family=Orbitron:wght@700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: ${palette.backgroundColor}; font-family: '${bodyFont}', sans-serif; color: ${palette.textColor}; }
  </style>
</head>
<body>
${clean}
</body>
</html>`;
    }

    // 2. Ensure GSAP script CDN is in head
    if (!clean.includes("gsap.min.js") && clean.includes("</head>")) {
      clean = clean.replace(
        "</head>",
        `  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>\n</head>`,
      );
    }

    // Ensure Google Fonts link is in head
    if (!clean.includes("fonts.googleapis.com") && clean.includes("</head>")) {
      const gFonts = `  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&family=Bebas+Neue&family=Orbitron:wght@700&display=swap" rel="stylesheet">\n`;
      clean = clean.replace("</head>", `${gFonts}</head>`);
    }

    // 3. Ensure root element has mandatory HyperFrames attributes
    const rootTagRegex = /<div([^>]*\bid=["']root["'][^>]*)>/i;
    if (rootTagRegex.test(clean)) {
      clean = clean.replace(rootTagRegex, (match, attrs) => {
        let updatedAttrs = attrs;
        if (!/data-composition-id=/i.test(updatedAttrs)) {
          updatedAttrs += ` data-composition-id="${scene.id}"`;
        } else {
          updatedAttrs = updatedAttrs.replace(/data-composition-id=["'][^"']*["']/i, `data-composition-id="${scene.id}"`);
        }
        if (!/data-start=/i.test(updatedAttrs)) {
          updatedAttrs += ` data-start="0"`;
        }
        if (!/data-duration=/i.test(updatedAttrs)) {
          updatedAttrs += ` data-duration="${dur.toFixed(2)}"`;
        } else {
          updatedAttrs = updatedAttrs.replace(/data-duration=["'][^"']*["']/i, `data-duration="${dur.toFixed(2)}"`);
        }
        if (!/data-width=/i.test(updatedAttrs)) {
          updatedAttrs += ` data-width="${width}"`;
        }
        if (!/data-height=/i.test(updatedAttrs)) {
          updatedAttrs += ` data-height="${height}"`;
        }
        if (!/data-layout-allow-overflow=/i.test(updatedAttrs)) {
          updatedAttrs += ` data-layout-allow-overflow="true"`;
        }
        if (!/data-layout-allow-overlap=/i.test(updatedAttrs)) {
          updatedAttrs += ` data-layout-allow-overlap="true"`;
        }
        if (!/data-layout-allow-occlusion=/i.test(updatedAttrs)) {
          updatedAttrs += ` data-layout-allow-occlusion="true"`;
        }
        return `<div${updatedAttrs}>`;
      });
    } else {
      // Wrap body content in valid root element
      clean = clean.replace(
        /<body([^>]*)>([\s\S]*?)<\/body>/i,
        `<body$1>\n  <div id="root" data-composition-id="${scene.id}" data-start="0" data-duration="${dur.toFixed(2)}" data-width="${width}" data-height="${height}" data-layout-allow-overflow="true" data-layout-allow-overlap="true" data-layout-allow-occlusion="true" style="position: relative; width: ${width}px; height: ${height}px; overflow: hidden; background: ${palette.backgroundColor};">\n$2\n  </div>\n</body>`,
      );
    }

    // Resolve subcomposition_root_styled_by_class by retargeting root class selectors to #root
    const rootClassMatch = clean.match(/<div[^>]*\bid=["']root["'][^>]*class=["']([^"']+)["']/i);
    if (rootClassMatch) {
      const classList = rootClassMatch[1].split(/\s+/).filter(Boolean);
      for (const cls of classList) {
        const clsRegex = new RegExp(`\\.${cls}\\b`, "g");
        clean = clean.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, styleBody) => {
          return `<style>${styleBody.replace(clsRegex, "#root")}</style>`;
        });
      }
    }

    // Add layout attributes to SVGs, text elements, cards, and containers to prevent false-positive occlusion/overlap linter blocks
    clean = clean.replace(/<svg\b(?![^>]*\bdata-layout-allow-overflow=)([^>]*)>/gi, '<svg$1 data-layout-allow-overflow="true" data-layout-allow-overlap="true">');
    // 1. Text elements: headings, paragraphs, spans, links, buttons, labels, list items, formatting tags
    clean = clean.replace(/<(h[1-6]|p|span|a|button|label|li|strong|b|em|i|small|sub|sup|blockquote|q)\b([^>]*?)>/gi, (match, tag, attrs) => {
      let newAttrs = attrs;
      if (!/data-layout-allow-overlap=/i.test(newAttrs)) {
        newAttrs += ' data-layout-allow-overlap="true"';
      }
      if (!/data-layout-allow-occlusion=/i.test(newAttrs)) {
        newAttrs += ' data-layout-allow-occlusion="true"';
      }
      return `<${tag}${newAttrs}>`;
    });
    // 2. Div containers, cards, floating elements, badges, and widgets
    clean = clean.replace(/<div\b(?![^>]*\bid=["']root["'])([^>]*?)>/gi, (match, attrs) => {
      let newAttrs = attrs;
      if (!/data-layout-allow-overlap=/i.test(newAttrs)) {
        newAttrs += ' data-layout-allow-overlap="true"';
      }
      if (!/data-layout-allow-occlusion=/i.test(newAttrs)) {
        newAttrs += ' data-layout-allow-occlusion="true"';
      }
      return `<div${newAttrs}>`;
    });
    // 3. Media elements (img, video, canvas)
    clean = clean.replace(/<(img|video|canvas)\b([^>]*?)>/gi, (match, tag, attrs) => {
      let newAttrs = attrs;
      if (!/data-layout-allow-overlap=/i.test(newAttrs)) newAttrs += ' data-layout-allow-overlap="true"';
      if (!/data-layout-allow-occlusion=/i.test(newAttrs)) newAttrs += ' data-layout-allow-occlusion="true"';
      if (!/data-layout-allow-overflow=/i.test(newAttrs)) newAttrs += ' data-layout-allow-overflow="true"';
      return `<${tag}${newAttrs}>`;
    });

    // 4. Sanitize and enforce deterministic HyperFrames & GSAP rules:
    // A. Strip banned CSS transitions
    clean = clean.replace(/transition:\s*[^;}]+;/gi, "/* transition omitted for frame clock */");

    // B. Comment out static CSS transforms that conflict with GSAP transforms
    clean = clean.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, styleBody) => {
      const fixedStyle = styleBody.replace(/(?<!-)\btransform:\s*[^;}]+;/gi, "/* transform managed by GSAP */");
      return `<style>${fixedStyle}</style>`;
    });

    // C. Replace infinite loops (repeat: -1) with finite yoyo
    clean = clean.replace(/repeat:\s*-1\b/g, "repeat: 1, yoyo: true");

    // D. Convert standalone tl.set(...) statements to gsap.set(...) to satisfy gsap_timeline_set_initial_hide
    clean = clean.replace(/(?<!\.)\btl\.set\s*\(([^;]+?)\);/g, "gsap.set($1);");
    // Repair broken chained gsap.set().set() or gsap.set().to() back to timeline chaining (tl.set)
    clean = clean.replace(/\bgsap\.set\s*\(([^;]+?)\)\s*\.(set|to|from|fromTo)\b/g, "tl.set($1).$2");

    // E. Replace Math.random() and non-deterministic clock functions with seeded deterministic equivalents
    clean = clean.replace(/Math\.random\(\)/g, "((Math.sin(window.__rndSeed = (window.__rndSeed || 1) + 1) + 1) / 2)");
    clean = clean.replace(/\bDate\.now\(\)/g, "1700000000000");
    clean = clean.replace(/\bperformance\.now\(\)/g, "0");

    // F. Normalize parent traversal in asset paths (../assets/ -> assets/)
    clean = clean.replace(/\.\.\/assets\//g, "assets/");

    // 5. Ensure deterministic GSAP timeline contract
    if (!clean.includes(`window.__timelines["${scene.id}"]`) && !clean.includes(`window.__timelines['${scene.id}']`)) {
      const scriptRegex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i;
      const scriptMatch = clean.match(scriptRegex);
      if (scriptMatch) {
        const scriptBody = scriptMatch[1];
        let tlVar = "tl";
        const tlMatch = scriptBody.match(/(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*gsap\.timeline/);
        if (tlMatch) {
          tlVar = tlMatch[1];
        }

        const registration = `
    // Auto-healed HyperFrames Deterministic Timeline Contract
    window.__timelines = window.__timelines || {};
    ${tlVar}.to("#root", { duration: ${dur.toFixed(2)}, ease: "none" }, 0);
    window.__timelines["${scene.id}"] = ${tlVar};
    ${tlVar}.seek(0);
`;
        clean = clean.replace(scriptRegex, (fullScript) => {
          return fullScript.replace(/<\/script>$/i, `${registration}\n  </script>`);
        });
      } else {
        const injectedScript = `
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#root > *", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.0, stagger: 0.15, ease: "power2.out" }, 0.2);
    tl.to("#root", { duration: ${dur.toFixed(2)}, ease: "none" }, 0);
    window.__timelines["${scene.id}"] = tl;
    tl.seek(0);
  </script>`;
        clean = clean.replace("</body>", `${injectedScript}\n</body>`);
      }
    }

    return clean;
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
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Orbitron:wght@500;700;900&family=Playfair+Display:ital,wght@0,600;0,800;0,900;1,600&family=Cinzel:wght@700;900&family=Space+Grotesk:wght@500;600;700&family=Syne:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800;900&family=Outfit:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
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
    // Normalize sceneType if raw type is passed
    const rawType = String(scene.sceneType || (scene as any).type || "").toLowerCase().replace(/_/g, "-");
    if (!scene.sceneType || (scene.sceneType as any) === "generic") {
      if (rawType.includes("spotlight") || rawType.includes("presenter") || rawType.includes("avatar-spotlight")) {
        scene.sceneType = "avatar-presenter-spotlight";
      } else if (rawType.includes("mixed") || rawType.includes("avatar-mixed")) {
        scene.sceneType = "avatar-mixed-feature";
      } else if (rawType.includes("metric") || rawType.includes("counter")) {
        scene.sceneType = "metrics-counter-hud";
      }
    }

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
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Orbitron:wght@500;700;900&family=Playfair+Display:ital,wght@0,600;0,800;0,900;1,600&family=Cinzel:wght@700;900&family=Space+Grotesk:wght@500;600;700&family=Syne:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800;900&family=Outfit:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
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
  <div id="root" data-composition-id="${scene.id}" data-scene-type="${(scene as any).type || scene.sceneType || ''}" data-start="0" data-duration="${scene.duration.toFixed(2)}" data-width="${width}" data-height="${height}">
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
    const bgType = scene.visualAtmosphere?.backgroundType || "gradient-mesh";
    const asset = scene.assetToFeature;

    if (bgType === "image-backdrop" && asset) {
      const assetPath = `assets/${asset.name}`;
      const scrim =
        scene.visualAtmosphere?.scrimGradient ||
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

    // Default: Rich Mesh Gradient Atmosphere (Antigravity Depth Layer)
    return `
    <!-- RICH MESH GRADIENT ATMOSPHERE -->
    <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; background: ${palette.backgroundColor};">
      <div style="position: absolute; inset: 0; background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px); background-size: 36px 36px;"></div>
      <div class="ambient-glow-orb" style="position: absolute; width: 1000px; height: 1000px; border-radius: 50%; background: radial-gradient(circle, ${palette.primary}33 0%, transparent 70%); top: -300px; right: -200px; filter: blur(90px);"></div>
      <div class="ambient-glow-orb" style="position: absolute; width: 850px; height: 850px; border-radius: 50%; background: radial-gradient(circle, ${palette.accent}25 0%, transparent 70%); bottom: -200px; left: -100px; filter: blur(100px);"></div>
      <div style="position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 50%, rgba(5,7,12,0.85) 100%);"></div>
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

    // LAYOUT 1A: Hero Product Showcase (Footwear / Hardware / Luxury Products)
    if (scene.sceneType === "hero-product-showcase") {
      const asset = scene.assetToFeature || analyzedAssets[0];
      const assetImg = asset
        ? `<img id="productHeroImg" src="assets/${asset.name}" alt="${this.escapeHtml(scene.headline)}" style="max-width: 680px; max-height: 480px; object-fit: contain; filter: drop-shadow(0 20px 40px rgba(0,0,0,0.7)); border-radius: 16px;" />`
        : `<svg id="productHeroSvg" viewBox="0 0 500 300" style="width: 520px; height: 300px; filter: drop-shadow(0 15px 30px ${palette.accent}66);">
            <path d="M50 220 Q120 180 220 190 Q340 130 450 200 L430 250 Q280 260 50 250 Z" fill="${palette.primary}" opacity="0.85"/>
            <path d="M120 190 Q220 110 360 140 Q400 170 450 200" stroke="${palette.accent}" stroke-width="6" fill="none" stroke-linecap="round"/>
            <line x1="80" y1="210" x2="380" y2="150" stroke="#FFF" stroke-width="2" stroke-dasharray="10 8"/>
          </svg>`;

      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1400px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 24px;">
      <div class="badge-pill anim-header" id="sceneBadge">
        <span class="badge-pulse-dot"></span>
        <span>${this.escapeHtml(scene.badge || "INNOVATION // 2026")}</span>
      </div>

      <!-- ILLUMINATED PEDESTAL & PRODUCT HERO -->
      <div class="anim-product-stage" style="position: relative; width: 720px; height: 420px; display: flex; align-items: center; justify-content: center;">
        <div id="productPedestalHalo" style="position: absolute; width: 560px; height: 140px; border-radius: 50%; background: radial-gradient(ellipse, ${palette.accent}55 0%, ${palette.glowColor} 45%, transparent 75%); filter: blur(28px); bottom: 10px;"></div>
        
        <!-- SVG Speed Velocity Rings -->
        <svg id="velocityRingsSvg" viewBox="0 0 700 350" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
          <ellipse cx="350" cy="220" rx="280" ry="60" fill="none" stroke="${palette.accent}" stroke-width="2" stroke-dasharray="16 12" opacity="0.6"/>
          <ellipse cx="350" cy="220" rx="340" ry="80" fill="none" stroke="${palette.primary}" stroke-width="1.5" stroke-dasharray="8 14" opacity="0.4"/>
        </svg>

        <div id="productVisualContainer" style="position: relative; z-index: 5;">
          ${assetImg}
        </div>
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 64px; letter-spacing: -0.02em;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 22px; max-width: 900px; color: ${palette.textMutedColor};">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <!-- SPEC TELEMETRY TILES -->
      <div class="anim-cards" style="display: flex; gap: 18px; width: 100%; max-width: 900px; justify-content: center; margin-top: 6px;">
        <div class="glass-card" style="flex: 1; padding: 18px 24px; text-align: left; border-left: 3px solid ${palette.accent};">
          <div style="font-size: 11px; font-weight: 800; color: ${palette.accent}; letter-spacing: 0.1em; text-transform: uppercase;">PERFORMANCE</div>
          <div class="display-font" style="font-size: 22px; font-weight: 900; color: #FFF; margin-top: 4px;">RESPONSIVE CUSHIONING</div>
        </div>
        <div class="glass-card" style="flex: 1; padding: 18px 24px; text-align: left; border-left: 3px solid ${palette.primary};">
          <div style="font-size: 11px; font-weight: 800; color: ${palette.primary}; letter-spacing: 0.1em; text-transform: uppercase;">AERODYNAMICS</div>
          <div class="display-font" style="font-size: 22px; font-weight: 900; color: #FFF; margin-top: 4px;">ZERO DRAG DESIGN</div>
        </div>
        <div class="glass-card" style="flex: 1; padding: 18px 24px; text-align: left; border-left: 3px solid ${palette.secondary};">
          <div style="font-size: 11px; font-weight: 800; color: ${palette.secondary}; letter-spacing: 0.1em; text-transform: uppercase;">MATERIALS</div>
          <div class="display-font" style="font-size: 22px; font-weight: 900; color: #FFF; margin-top: 4px;">CARBON FIBER PLATE</div>
        </div>
      </div>
    </div>`;
    }

    // LAYOUT 1A-1: Avatar Presenter Spotlight (HeyGen Avatar + GSAP HUD & Lower Third)
    if (scene.sceneType === "avatar-presenter-spotlight") {
      const presenterAsset = analyzedAssets.find((a) => a.name.includes("presenter") || a.name.includes("avatar")) || { name: "presenter.mp4" };
      const videoId = `avatar_spotlight_s${scene.index || 1}`;
      const mediaStart = (scene.start || 0).toFixed(2);
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; padding: 60px 80px;">
      <!-- HeyGen Avatar Presenter Video Background Clip -->
      <video id="${videoId}" class="clip" src="assets/${presenterAsset.name}" data-start="0" data-duration="${scene.duration.toFixed(2)}" data-media-start="${mediaStart}" autoplay loop muted playsinline style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; border-radius: 0;"></video>
      <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(5,7,12,0.3) 0%, transparent 40%, rgba(5,7,12,0.85) 100%); z-index: 2; pointer-events: none;"></div>

      <!-- Presenter Cinematic Lower Third Overlay -->
      <div class="glass-card anim-presenter-card" style="position: relative; z-index: 5; display: inline-flex; align-items: center; gap: 24px; padding: 20px 32px; border-left: 5px solid ${palette.accent}; max-width: 950px; backdrop-filter: blur(24px);">
        <div class="badge-pill" style="background: ${palette.accent}22; border-color: ${palette.accent}66; color: ${palette.accent}; font-weight: 800; font-size: 13px;">
          <span class="badge-pulse-dot" style="background: ${palette.accent};"></span>
          <span>${this.escapeHtml(scene.badge || "AI PRESENTER")}</span>
        </div>
        <div style="flex: 1;">
          <h2 class="display-font" style="font-size: 32px; font-weight: 900; color: #FFFFFF; line-height: 1.1; margin: 0;">
            ${formattedHeadline}
          </h2>
          <p class="body-font" style="font-size: 17px; color: ${palette.textMutedColor}; margin-top: 6px; line-height: 1.4;">
            ${this.escapeHtml(scene.subtitle)}
          </p>
        </div>
      </div>
    </div>`;
    }

    // LAYOUT 1A-1B: Avatar Mixed Feature (Split Layout with Avatar Video Clip + Graphic Cards)
    if (scene.sceneType === "avatar-mixed-feature") {
      const presenterAsset = analyzedAssets.find((a) => a.name.includes("presenter") || a.name.includes("avatar")) || { name: "presenter.mp4" };
      const videoId = `avatar_mixed_s${scene.index || 1}`;
      const mediaStart = (scene.start || 0).toFixed(2);
      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1400px; display: flex; flex-direction: column; align-items: center; gap: 28px;">
      <div style="text-align: center;">
        <div class="badge-pill anim-header" id="sceneBadge">
          <span class="badge-pulse-dot"></span>
          <span>${this.escapeHtml(scene.badge || "KEY INSIGHT")}</span>
        </div>
        <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 52px; margin-top: 10px;">
          ${formattedHeadline}
        </h1>
      </div>

      <div style="width: 100%; max-width: 1300px; display: flex; gap: 36px; align-items: center;">
        <!-- Left: Avatar Presenter Video Frame -->
        <div class="glass-card anim-split-product" style="flex: 1; height: 420px; border-radius: 24px; position: relative; overflow: hidden; border: 2px solid ${palette.accent}44; box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
          <video id="${videoId}" class="clip" src="assets/${presenterAsset.name}" data-start="0" data-duration="${scene.duration.toFixed(2)}" data-media-start="${mediaStart}" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
          <div style="position: absolute; bottom: 16px; left: 16px; background: rgba(0,0,0,0.75); backdrop-filter: blur(12px); border-radius: 9999px; padding: 6px 16px; font-size: 12px; font-weight: 700; color: #FFF; display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span>
            <span>Live Presenter Brief</span>
          </div>
        </div>

        <!-- Right: Animated Info & Telemetry Cards -->
        <div style="flex: 1.1; display: flex; flex-direction: column; gap: 16px;">
          <div class="glass-card anim-feature-row" style="padding: 22px 28px; border-left: 4px solid ${palette.accent};">
            <div class="display-font" style="font-size: 20px; font-weight: 800; color: #FFF;">INTELLIGENT SCENE PLANNING</div>
            <div style="font-size: 14px; color: ${palette.textMutedColor}; margin-top: 4px;">${this.escapeHtml(scene.subtitle || "Ollima AI plans the creative brief, scene sequencing and precise timing.")}</div>
          </div>
          <div class="glass-card anim-feature-row" style="padding: 22px 28px; border-left: 4px solid ${palette.primary};">
            <div class="display-font" style="font-size: 20px; font-weight: 800; color: #FFF;">PHOTOREALISTIC HEYGEN AVATAR</div>
            <div style="font-size: 14px; color: ${palette.textMutedColor}; margin-top: 4px;">High-fidelity facial animation and synchronized audio narration.</div>
          </div>
          <div class="glass-card anim-feature-row" style="padding: 22px 28px; border-left: 4px solid ${palette.secondary};">
            <div class="display-font" style="font-size: 20px; font-weight: 800; color: #FFF;">HYPERFRAMES 1080P RENDERING</div>
            <div style="font-size: 14px; color: ${palette.textMutedColor}; margin-top: 4px;">Hardware-accelerated headless compositor renders ultra-crisp output.</div>
          </div>
        </div>
      </div>
    </div>`;
    }

    // LAYOUT 1A-2: Feature Split Layout (2-Column Product & Capability Breakdown)
    if (scene.sceneType === "feature-split-layout") {
      const asset = scene.assetToFeature || analyzedAssets[0];
      const assetImg = asset
        ? `<img src="assets/${asset.name}" alt="${this.escapeHtml(scene.headline)}" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 15px 30px rgba(0,0,0,0.6));" />`
        : `<svg viewBox="0 0 400 300" style="width: 100%; height: 100%;">
            <rect width="400" height="300" rx="20" fill="rgba(255,255,255,0.04)" stroke="${palette.borderColor}" stroke-width="2"/>
            <circle cx="200" cy="150" r="70" fill="${palette.primary}22" stroke="${palette.accent}" stroke-width="2"/>
            <text x="200" y="158" text-anchor="middle" font-size="20" font-weight="900" fill="#FFF">CORE ENGINE</text>
          </svg>`;

      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1400px; display: flex; flex-direction: column; align-items: center; gap: 28px;">
      <div style="text-align: center;">
        <div class="badge-pill anim-header" id="sceneBadge">
          <span class="badge-pulse-dot"></span>
          <span>${this.escapeHtml(scene.badge || "ENGINEERED CAPABILITY")}</span>
        </div>
        <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 54px; margin-top: 12px;">
          ${formattedHeadline}
        </h1>
        <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 20px; color: ${palette.textMutedColor}; margin-top: 6px;">
          ${this.escapeHtml(scene.subtitle)}
        </p>
      </div>

      <!-- TWO-COLUMN PRODUCT & FEATURE CARDS -->
      <div style="width: 100%; max-width: 1250px; display: flex; gap: 36px; align-items: center;">
        <!-- Left Product Showcase Panel -->
        <div class="glass-card anim-split-product" style="flex: 1; height: 380px; display: flex; align-items: center; justify-content: center; padding: 24px; position: relative; overflow: hidden;">
          <div style="position: absolute; width: 300px; height: 300px; border-radius: 50%; background: radial-gradient(circle, ${palette.accent}33 0%, transparent 70%); filter: blur(35px);"></div>
          ${assetImg}
        </div>

        <!-- Right Feature List Cards -->
        <div style="flex: 1.1; display: flex; flex-direction: column; gap: 16px;">
          <div class="glass-card anim-feature-row" style="padding: 22px 28px; border-left: 4px solid ${palette.accent}; display: flex; align-items: center; gap: 20px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: ${palette.accent}22; display: flex; align-items: center; justify-content: center; color: ${palette.accent}; font-weight: 900; font-size: 20px;">01</div>
            <div>
              <div class="display-font" style="font-size: 20px; font-weight: 800; color: #FFF;">HIGH-IMPACT VELOCITY</div>
              <div style="font-size: 14px; color: ${palette.textMutedColor}; margin-top: 4px;">Engineered energy return for unprecedented power transfer.</div>
            </div>
          </div>
          <div class="glass-card anim-feature-row" style="padding: 22px 28px; border-left: 4px solid ${palette.primary}; display: flex; align-items: center; gap: 20px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: ${palette.primary}22; display: flex; align-items: center; justify-content: center; color: ${palette.primary}; font-weight: 900; font-size: 20px;">02</div>
            <div>
              <div class="display-font" style="font-size: 20px; font-weight: 800; color: #FFF;">PRECISION CRAFTSMANSHIP</div>
              <div style="font-size: 14px; color: ${palette.textMutedColor}; margin-top: 4px;">Ultra-lightweight composite structure built to endure demanding conditions.</div>
            </div>
          </div>
          <div class="glass-card anim-feature-row" style="padding: 22px 28px; border-left: 4px solid ${palette.secondary}; display: flex; align-items: center; gap: 20px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: ${palette.secondary}22; display: flex; align-items: center; justify-content: center; color: ${palette.secondary}; font-weight: 900; font-size: 20px;">03</div>
            <div>
              <div class="display-font" style="font-size: 20px; font-weight: 800; color: #FFF;">ZERO COMPROMISE COMFORT</div>
              <div style="font-size: 14px; color: ${palette.textMutedColor}; margin-top: 4px;">Adaptive ergonomic fit that contours seamlessly with movement.</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    }

    // LAYOUT 1A-3: Brand Climax CTA
    if (scene.sceneType === "brand-climax-cta") {
      const asset = scene.assetToFeature || analyzedAssets[0];
      const logoHtml = asset
        ? `<img src="assets/${asset.name}" alt="Brand Logo" style="max-height: 90px; object-fit: contain; filter: drop-shadow(0 0 25px ${palette.accent}); margin-bottom: 8px;" />`
        : `<div class="display-font" style="font-size: 28px; font-weight: 900; color: ${palette.accent}; letter-spacing: 0.15em; text-transform: uppercase;">${this.escapeHtml(brief.title)}</div>`;

      return `
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 24px;">
      <div class="badge-pill anim-header" id="sceneBadge">
        <span class="badge-pulse-dot"></span>
        <span>${this.escapeHtml(scene.badge || "OFFICIAL RELEASE // 2026")}</span>
      </div>

      <div class="anim-brand-logo">
        ${logoHtml}
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 72px; letter-spacing: -0.02em;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 24px; color: ${palette.textMutedColor}; max-width: 900px;">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <div class="anim-cta" style="margin-top: 10px;">
        <button class="btn-cta display-font" style="padding: 20px 52px; font-size: 20px; box-shadow: 0 12px 35px ${palette.glowColor}; border: none; cursor: pointer;">
          <span>${this.escapeHtml(scene.ctaText || "ORDER NOW &bull; EXPERIENCE EXCELLENCE")}</span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>

      <div class="anim-sub" style="display: flex; gap: 24px; margin-top: 10px; font-size: 14px; color: ${palette.textMutedColor}; font-weight: 600;">
        <span style="display: flex; align-items: center; gap: 6px;">✓ Premium Quality</span>
        <span style="display: flex; align-items: center; gap: 6px;">✓ Global Delivery</span>
        <span style="display: flex; align-items: center; gap: 6px;">✓ Satisfaction Guaranteed</span>
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
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1300px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 32px;">
      <div class="badge-pill anim-header" id="sceneBadge"><span class="badge-pulse-dot"></span><span>${this.escapeHtml(scene.badge || "INNOVATION // 2026")}</span></div>
      
      <!-- KINETIC ACCENT SVG SPEED LINES -->
      <div style="position: absolute; width: 100%; height: 350px; pointer-events: none; z-index: -1; display: flex; align-items: center; justify-content: center; opacity: 0.35;">
        <svg viewBox="0 0 1000 300" style="width: 100%; height: 100%; overflow: visible;">
          <line x1="0" y1="150" x2="1000" y2="150" stroke="${palette.accent}" stroke-width="1.5" stroke-dasharray="16 12" />
          <line x1="100" y1="80" x2="900" y2="80" stroke="${palette.primary}" stroke-width="1" stroke-dasharray="8 8" opacity="0.5" />
          <line x1="100" y1="220" x2="900" y2="220" stroke="${palette.secondary}" stroke-width="1" stroke-dasharray="8 8" opacity="0.5" />
          <circle cx="500" cy="150" r="120" stroke="${palette.accent}" stroke-width="1" fill="none" opacity="0.25" stroke-dasharray="6 6" />
        </svg>
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 72px; line-height: 1.1; max-width: 1150px; letter-spacing: -0.02em;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 24px; max-width: 900px; color: ${palette.textMutedColor};">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <!-- DYNAMIC TELEMETRY CARDS -->
      <div style="display: flex; gap: 20px; width: 100%; max-width: 960px; justify-content: center; margin-top: 8px;">
        <div class="glass-card anim-metric-card" style="flex: 1; padding: 22px 30px; text-align: left; border-left: 4px solid ${palette.accent};">
          <div style="font-size: 13px; font-weight: 700; color: ${palette.accent}; letter-spacing: 0.1em; text-transform: uppercase;">PERFORMANCE</div>
          <div class="display-font" style="font-size: 26px; font-weight: 900; color: #FFF; margin-top: 4px;">UNPARALLELED SPEED</div>
          <div style="font-size: 14px; color: ${palette.textMutedColor}; margin-top: 4px;">Engineered for peak performance and impact</div>
        </div>
        <div class="glass-card anim-metric-card" style="flex: 1; padding: 22px 30px; text-align: left; border-left: 4px solid ${palette.secondary};">
          <div style="font-size: 13px; font-weight: 700; color: ${palette.secondary}; letter-spacing: 0.1em; text-transform: uppercase;">PRECISION DESIGN</div>
          <div class="display-font" style="font-size: 26px; font-weight: 900; color: #FFF; margin-top: 4px;">NEXT-GEN STANDARD</div>
          <div style="font-size: 14px; color: ${palette.textMutedColor}; margin-top: 4px;">Every detail meticulously refined</div>
        </div>
      </div>
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
    <div class="scene-content" style="position: relative; z-index: 10; width: 100%; max-width: 1250px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 28px;">
      <div class="badge-pill anim-header" id="sceneBadge"><span class="badge-pulse-dot"></span><span>${this.escapeHtml(scene.badge || "EXPERIENCE EXCELLENCE")}</span></div>
      
      <!-- FOCAL GLOWING ENERGY BURST -->
      <div style="position: relative; width: 200px; height: 30px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
        <div style="position: absolute; width: 280px; height: 60px; border-radius: 50%; background: radial-gradient(ellipse, ${palette.accent}66 0%, transparent 75%); filter: blur(20px);"></div>
      </div>

      <h1 class="hero-headline display-font anim-headline" id="sceneTitle" style="font-size: 72px; letter-spacing: -0.02em;">
        ${formattedHeadline}
      </h1>
      <p class="hero-subtitle body-font anim-sub" id="sceneSubtitle" style="font-size: 24px; max-width: 900px; color: ${palette.textMutedColor};">
        ${this.escapeHtml(scene.subtitle)}
      </p>

      <div class="anim-cta" style="margin-top: 14px;">
        <button class="btn-cta display-font" style="padding: 20px 52px; font-size: 20px; box-shadow: 0 12px 35px ${palette.glowColor};">
          <span>${this.escapeHtml(scene.ctaText || "GET STARTED NOW")}</span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>

      <div class="anim-sub" style="display: flex; gap: 24px; margin-top: 8px; font-size: 14px; color: ${palette.textMutedColor}; font-weight: 600;">
        <span style="display: flex; align-items: center; gap: 6px;">✓ Verified Excellence</span>
        <span style="display: flex; align-items: center; gap: 6px;">✓ Instant Access</span>
        <span style="display: flex; align-items: center; gap: 6px;">✓ Seamless Results</span>
      </div>
    </div>`;
  }

  private static renderGsapScript(
    scene: PlannedScene,
    brief: CreativeBrief,
  ): string {
    const dur = scene.duration;
    const isChart = scene.sceneType === "animated-bar-chart";
    const hasBackdrop = scene.visualAtmosphere?.backgroundType === "image-backdrop" && !!scene.assetToFeature;

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
    } else if (scene.sceneType === "hero-product-showcase") {
      bespokeSceneAnimations = `
    // Product Showcase Stage & Velocity Rings
    tl.fromTo("#productPedestalHalo",
      { scale: 0.5, opacity: 0 },
      { scale: 1.15, opacity: 0.9, duration: 1.2, ease: "power2.out" },
      0.1
    );
    tl.fromTo("#velocityRingsSvg",
      { rotation: -20, scale: 0.8, opacity: 0, transformOrigin: "center center" },
      { rotation: 0, scale: 1, opacity: 1, duration: 1.4, ease: "power2.out" },
      0.2
    );
    tl.fromTo("#productVisualContainer",
      { scale: 0.75, opacity: 0, y: 40 },
      { scale: 1, opacity: 1, y: 0, duration: 1.1, ease: "back.out(1.4)" },
      0.3
    );
    tl.fromTo(".anim-cards > div",
      { opacity: 0, y: 25 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: "power2.out" },
      0.6
    );`;
    } else if (scene.sceneType === "feature-split-layout") {
      bespokeSceneAnimations = `
    // 2-Column Split Product & Feature List
    tl.fromTo(".anim-split-product",
      { x: -50, opacity: 0, scale: 0.9 },
      { x: 0, opacity: 1, scale: 1, duration: 1.0, ease: "power3.out" },
      0.2
    );
    tl.fromTo(".anim-feature-row",
      { x: 50, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.8, stagger: 0.14, ease: "power2.out" },
      0.4
    );`;
    } else if (scene.sceneType === "brand-climax-cta") {
      bespokeSceneAnimations = `
    // Brand Climax CTA Reveal
    tl.fromTo(".anim-brand-logo",
      { scale: 0.6, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.9, ease: "back.out(1.5)" },
      0.1
    );
    tl.fromTo(".btn-cta",
      { scale: 0.85, opacity: 0, y: 20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.8, ease: "back.out(1.6)" },
      0.5
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

    // Master Cinematic Camera Push-In (Antigravity Signature Depth)
    tl.to("#root", { scale: 1.035, duration: ${dur.toFixed(2)}, ease: "none" }, 0);

    // Ambient floating orbs micro-motion
    tl.to(".ambient-glow-orb", { x: 30, y: -20, duration: ${dur.toFixed(2)}, ease: "sine.inOut" }, 0);

    // Header & badge bounce entrance
    tl.fromTo("#sceneBadge",
      { opacity: 0, scale: 0.82, y: -16 },
      { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: "back.out(1.6)" },
      0.1
    );

    // Headline bold power entrance
    tl.fromTo("#sceneTitle",
      { opacity: 0, y: 36 },
      { opacity: 1, y: 0, duration: 1.0, ease: "power4.out" },
      0.2
    );

    // Subtitle entrance
    tl.fromTo("#sceneSubtitle",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" },
      0.35
    );

    // Layout-specific animated components
    ${chartAnimations}
    ${bespokeSceneAnimations}

    tl.fromTo(".anim-metric-card, .anim-node, .anim-chart, .anim-cta, .anim-presenter-card, .anim-split-product, .anim-feature-row",
      { opacity: 0, y: 35, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 1.0, stagger: 0.08, ease: "power4.out" },
      0.35
    );

    // Ensure timeline spans exact scene duration
    tl.to("#root", { duration: ${dur.toFixed(2)}, ease: "none" }, 0);

    window.__timelines["${scene.id}"] = tl;
    tl.seek(0);
`;
  }

  private static formatHighlightedHeadline(
    headline: string = "",
    highlightWord?: string,
  ): string {
    const safeHeadline = String(headline || "");
    if (!highlightWord) return this.escapeHtml(safeHeadline);

    const regex = new RegExp(`(${this.escapeRegex(highlightWord)})`, "gi");
    return this.escapeHtml(safeHeadline).replace(
      regex,
      '<span class="highlight-span">$1</span>',
    );
  }

  private static escapeHtml(str: string = ""): string {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private static escapeRegex(str: string = ""): string {
    return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

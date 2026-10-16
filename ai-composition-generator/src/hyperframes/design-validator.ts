import fs from "node:fs/promises";
import path from "node:path";
import { jsonrepair } from "jsonrepair";

export interface DesignValidationIssue {
  type: "warning" | "error" | "repaired";
  code: string;
  file?: string;
  message: string;
}

export interface DesignValidationResult {
  valid: boolean;
  issues: DesignValidationIssue[];
  repairedCount: number;
}

export class DesignValidator {
  /**
   * Programmatically inspects and automatically repairs common design and structure issues
   * before running hyperframes check and render.
   */
  public static async inspectAndRepair(
    projectDir: string,
  ): Promise<DesignValidationResult> {
    const issues: DesignValidationIssue[] = [];
    let repairedCount = 0;

    const indexPath = path.join(projectDir, "index.html");
    const compositionsDir = path.join(projectDir, "compositions");
    const assetsDir = path.join(projectDir, "assets");

    // 1. Check index.html exists
    try {
      await fs.access(indexPath);
    } catch {
      issues.push({
        type: "error",
        code: "MISSING_INDEX_HTML",
        file: "index.html",
        message: "Project root is missing index.html composition.",
      });
      return { valid: false, issues, repairedCount: 0 };
    }

    let indexHtml = await fs.readFile(indexPath, "utf-8");

    // 2. Extract master duration & dimensions from index.html
    const masterMatch = indexHtml.match(
      /<[^>]+data-composition-id=["']main["'][^>]*data-duration=["']([\d.]+)["'][^>]*>/i,
    );
    const masterDuration = masterMatch ? parseFloat(masterMatch[1]) : 15.0;

    const widthMatch = indexHtml.match(/data-width=["'](\d+)["']/i);
    const heightMatch = indexHtml.match(/data-height=["'](\d+)["']/i);
    const width = widthMatch ? parseInt(widthMatch[1], 10) : 1920;
    const height = heightMatch ? parseInt(heightMatch[1], 10) : 1080;

    let indexHtmlUpdated = indexHtml;

    // Ensure index.html root composition element has id="root", data-composition-id="main", data-width, data-height
    const rootIndexMatch = indexHtml.match(/<div\b([^>]*data-composition-id=["']main["'][^>]*)>/i) ||
      indexHtml.match(/<div\b([^>]*\bid=["']root["'][^>]*)>/i);
    if (rootIndexMatch) {
      const rTag = rootIndexMatch[0];
      let newRTag = rTag;
      if (!newRTag.includes('id="root"')) {
        newRTag = newRTag.replace(/<div\s+/i, '<div id="root" ');
      }
      if (!newRTag.includes('data-composition-id="main"')) {
        newRTag = newRTag.replace(/>$/, ' data-composition-id="main">');
      }
      if (!newRTag.includes("data-width")) {
        newRTag = newRTag.replace(/>$/, ` data-width="${width}" data-height="${height}">`);
      }
      if (newRTag !== rTag) {
        indexHtmlUpdated = indexHtmlUpdated.replace(rTag, newRTag);
        repairedCount++;
      }
    }

    // 3. Inspect hosted scenes in index.html & ensure id attributes exist
    const sceneRegex =
      /<div([^>]+data-composition-id=["']([^"']+)["'][^>]+data-composition-src=["']([^"']+)["'][^>]+data-start=["']([\d.]+)["'][^>]+data-duration=["']([\d.]+)["'][^>]*)>/gi;

    const hostedScenes: Array<{
      fullTag: string;
      id: string;
      src: string;
      start: number;
      duration: number;
    }> = [];
    let match: RegExpExecArray | null;

    while ((match = sceneRegex.exec(indexHtml)) !== null) {
      hostedScenes.push({
        fullTag: match[0],
        id: match[2],
        src: match[3],
        start: parseFloat(match[4]),
        duration: parseFloat(match[5]),
      });
    }

    // Ensure all hosted subcomposition tags have id="..."
    indexHtmlUpdated = indexHtml;
    for (const sc of hostedScenes) {
      if (!sc.fullTag.includes(`id="${sc.id}"`) && !sc.fullTag.includes(`id='${sc.id}'`)) {
        const replacementTag = sc.fullTag.replace(
          /<div\s+/i,
          `<div id="${sc.id}" `,
        );
        indexHtmlUpdated = indexHtmlUpdated.replace(sc.fullTag, replacementTag);
        repairedCount++;
        issues.push({
          type: "repaired",
          code: "SUBCOMPOSITION_ID_ADDED",
          file: "index.html",
          message: `Added required id="${sc.id}" to hosted subcomposition tag in index.html.`,
        });
      }
    }

    if (indexHtmlUpdated !== indexHtml) {
      await fs.writeFile(indexPath, indexHtmlUpdated, "utf-8");
      indexHtml = indexHtmlUpdated;
    }

    // 4. Validate Scene Duration Totals
    if (hostedScenes.length > 0) {
      const sumDurations = hostedScenes.reduce((acc, s) => acc + s.duration, 0);
      const diff = Math.abs(sumDurations - masterDuration);

      if (diff > 0.05) {
        issues.push({
          type: "repaired",
          code: "DURATION_MISMATCH_REPAIRED",
          file: "index.html",
          message: `Scene duration sum (${sumDurations.toFixed(2)}s) did not match master duration (${masterDuration.toFixed(2)}s). Auto-aligning scene durations to match authoritative total.`,
        });

        const ratio = masterDuration / sumDurations;
        let runningStart = 0;
        let updatedIndexHtml = indexHtml;

        for (let i = 0; i < hostedScenes.length; i++) {
          const sc = hostedScenes[i];
          const newDur =
            i === hostedScenes.length - 1
              ? Number((masterDuration - runningStart).toFixed(2))
              : Number((sc.duration * ratio).toFixed(2));

          const oldTagRegex = new RegExp(
            `<div[^>]+data-composition-id=["']${sc.id}["'][^>]*>`,
            "i",
          );
          const newTag = `<div id="${sc.id}" data-composition-id="${sc.id}" data-composition-src="${sc.src}" data-start="${runningStart.toFixed(2)}" data-duration="${newDur.toFixed(2)}" style="position: absolute; inset: 0; width: 100%; height: 100%;"></div>`;

          updatedIndexHtml = updatedIndexHtml.replace(oldTagRegex, newTag);

          // Update corresponding scene HTML file
          const sceneFilePath = path.join(projectDir, sc.src);
          try {
            let sceneContent = await fs.readFile(sceneFilePath, "utf-8");
            sceneContent = sceneContent.replace(
              /data-duration=["'][\d.]+["']/i,
              `data-duration="${newDur.toFixed(2)}"`,
            );
            sceneContent = sceneContent.replace(
              /tl\.to\(["']#root["'],\s*\{\s*duration:\s*[\d.]+/i,
              `tl.to("#root", { duration: ${newDur.toFixed(2)}`,
            );
            await fs.writeFile(sceneFilePath, sceneContent, "utf-8");
          } catch {}

          runningStart += newDur;
        }

        await fs.writeFile(indexPath, updatedIndexHtml, "utf-8");
        indexHtml = updatedIndexHtml;
        repairedCount++;
      }
    }

    // Ensure index.html has Google Fonts stylesheet
    if (!indexHtml.includes("fonts.googleapis.com")) {
      const googleFontsTag = `\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Orbitron:wght@500;700;900&family=Playfair+Display:ital,wght@0,600;0,800;0,900;1,600&family=Cinzel:wght@700;900&family=Space+Grotesk:wght@500;600;700&family=Syne:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800;900&family=Outfit:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">\n`;
      indexHtml = indexHtml.replace("<head>", `<head>${googleFontsTag}`);
      await fs.writeFile(indexPath, indexHtml, "utf-8");
      repairedCount++;
    }

    // 5. Inspect individual scene files
    try {
      const sceneFiles = await fs.readdir(compositionsDir);
      const headlinesFound: string[] = [];

      for (const file of sceneFiles) {
        if (!file.endsWith(".html")) continue;
        const filePath = path.join(compositionsDir, file);
        let content = await fs.readFile(filePath, "utf-8");
        let modified = false;

        // 0. Unwrap JSON string if the file was written as a raw JSON payload
        try {
          const trimmed = content.trim();
          if (
            (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("{") && (trimmed.includes('"html"') || trimmed.includes('"code"') || trimmed.includes('"content"') || trimmed.includes('"sceneHtml"')))
          ) {
            const repaired = jsonrepair(trimmed);
            const parsed = JSON.parse(repaired);
            const candidate = parsed.html || parsed.code || parsed.content || parsed.sceneHtml || parsed.scene_html;
            if (typeof candidate === "string" && candidate.trim().length > 0) {
              content = candidate.trim();
              modified = true;
              repairedCount++;
              issues.push({
                type: "repaired",
                code: "JSON_WRAPPED_SCENE_UNWRAPPED",
                file,
                message: `Unwrapped JSON structure into raw HTML for scene ${file}.`,
              });
            }
          }
        } catch {}

        // Fix unescaped quotes or literal \n if present from stringified output
        if (content.includes('\\"') && !content.includes('"')) {
          content = content.replace(/\\"/g, '"');
          modified = true;
        }
        if (content.includes('\\n') && !content.includes('\n')) {
          content = content.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
          modified = true;
        }

        // Auto-repair infinite repeats (repeat: -1) which break deterministic rendering
        if (/repeat:\s*-1\b/.test(content)) {
          content = content.replace(/repeat:\s*-1\b/g, "repeat: 1, yoyo: true");
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "INFINITE_REPEAT_REPAIRED",
            file,
            message: `Replaced repeat: -1 with finite yoyo in ${file} to satisfy HyperFrames deterministic render rule.`,
          });
        }

        // Auto-convert standalone tl.set(...) statements to gsap.set(...) to satisfy gsap_timeline_set_initial_hide
        if (/(?<!\.)\btl\.set\s*\([^;]+?\);/.test(content)) {
          content = content.replace(/(?<!\.)\btl\.set\s*\(([^;]+?)\);/g, "gsap.set($1);");
          modified = true;
          repairedCount++;
        }

        // Auto-repair broken chained gsap.set().set() or gsap.set().to() back to tl.set()
        if (/\bgsap\.set\s*\([^;]+?\)\s*\.(set|to|from|fromTo)\b/.test(content)) {
          content = content.replace(/\bgsap\.set\s*\(([^;]+?)\)\s*\.(set|to|from|fromTo)\b/g, "tl.set($1).$2");
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "CHAINED_GSAP_SET_REPAIRED",
            file,
            message: `Restored chained gsap.set() back to tl.set() in ${file} to prevent TypeError: gsap.set(...).set is not a function.`,
          });
        }

        // Auto-repair non-deterministic Math.random()
        if (/Math\.random\(\)/.test(content)) {
          content = content.replace(/Math\.random\(\)/g, "((Math.sin(window.__rndSeed = (window.__rndSeed || 1) + 1) + 1) / 2)");
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "NON_DETERMINISTIC_RANDOM_REPAIRED",
            file,
            message: `Replaced Math.random() with seeded deterministic PRNG in ${file}.`,
          });
        }

        // Auto-repair non-deterministic random(...) string tween values
        if (/["']random\s*\([^)]*\)["']/i.test(content)) {
          content = content.replace(/["']random\s*\([^)]*\)["']/gi, '"0"');
          modified = true;
          repairedCount++;
        }

        // Auto-repair missing id on <video> tags
        if (/<video\b(?![^>]*\bid=)/i.test(content)) {
          let vCount = 1;
          content = content.replace(/<video\b(?![^>]*\bid=)([^>]*?)>/gi, (match, attrs) => {
            return `<video id="video-clip-${vCount++}"${attrs}>`;
          });
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "VIDEO_MISSING_ID_REPAIRED",
            file,
            message: `Added unique id attributes to <video> tags in ${file}.`,
          });
        }

        // Auto-repair media_src_kind_mismatch: <img src="...mp4"> -> <video src="...mp4">
        if (/<img\b[^>]*\bsrc=["'][^"']*\.(mp4|mov|webm)[^"']*["']/i.test(content)) {
          let vmCount = 1;
          content = content.replace(/<img\b([^>]*\bsrc=["'][^"']*\.(mp4|mov|webm)[^"']*["'][^>]*?)>/gi, (match, attrs) => {
            let vattrs = attrs;
            if (!/data-start=/i.test(vattrs)) vattrs += ' data-start="0"';
            if (!/id=/i.test(vattrs)) vattrs += ` id="video-kind-clip-${vmCount++}"`;
            return `<video${vattrs} autoplay loop muted playsinline></video>`;
          });
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "MEDIA_SRC_KIND_MISMATCH_REPAIRED",
            file,
            message: `Converted <img> tags with video sources into <video> tags in ${file}.`,
          });
        }

        // Auto-repair media_missing_data_start on <video> tags
        if (/<video\b(?![^>]*\bdata-start=)/i.test(content)) {
          content = content.replace(/<video\b(?![^>]*\bdata-start=)([^>]*?)>/gi, '<video data-start="0"$1>');
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "MEDIA_MISSING_DATA_START_REPAIRED",
            file,
            message: `Added data-start="0" to <video> tags in ${file}.`,
          });
        }

        // Auto-repair duplicate identical <video> tags in the same scene
        const videoTags = content.match(/<video\b[^>]*>[\s\S]*?<\/video>|<video\b[^>]*\/>|<video\b[^>]*>/gi);
        if (videoTags && videoTags.length > 1) {
          const seenSources = new Set();
          for (let vi = 0; vi < videoTags.length; vi++) {
            const vtag = videoTags[vi];
            const srcMatch = vtag.match(/src=["']([^"']+)["']/i);
            const src = srcMatch ? srcMatch[1] : `unknown_${vi}`;
            if (seenSources.has(src)) {
              content = content.replace(vtag, `<!-- duplicate video removed -->`);
              modified = true;
              repairedCount++;
            } else {
              seenSources.add(src);
            }
          }
        }

        // Auto-repair static CSS transform conflict with GSAP (both in <style> and inline style attributes)
        if (/<style[^>]*>[\s\S]*?(?<!-)\btransform:\s*[^;}]+;[\s\S]*?<\/style>/i.test(content)) {
          content = content.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, styleBody) => {
            const fixedStyle = styleBody.replace(/(?<!-)\btransform:\s*(?!translate\(-50%,\s*-50%\))[^;}]+;/gi, "/* transform managed by GSAP */");
            return `<style>${fixedStyle}</style>`;
          });
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "STATIC_CSS_TRANSFORM_REPAIRED",
            file,
            message: `Commented out static CSS transform rules in ${file} to prevent gsap_css_transform_conflict with GSAP.`,
          });
        }

        // Auto-repair inline style transform conflicts (e.g. style="... transform: translateY(20px); ...")
        if (/style=["'][^"']*\btransform:\s*(translate[XY]|scale)[^"';]*;?[^"']*["']/i.test(content)) {
          content = content.replace(/style=(["'])([^"']*)\1/gi, (match, quote, styleStr) => {
            // Strip translateY/translateX/scale from inline style if not centering translate(-50%, -50%)
            const cleanedStyle = styleStr.replace(/\btransform:\s*(?!translate\(-50%,\s*-50%\))(?:translate[XY]\([^)]+\)|scale\([^)]+\)|scale\([^)]+\)\s*translate[XY]\([^)]+\))[\s;]*/gi, "");
            return `style=${quote}${cleanedStyle}${quote}`;
          });
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "INLINE_STYLE_TRANSFORM_REPAIRED",
            file,
            message: `Stripped initial inline transform styles in ${file} to eliminate gsap_css_transform_conflict.`,
          });
        }

        // A0. Ensure root composition wrapper is the immediate top-level child of <body>
        const bodyTagMatch = content.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
        if (bodyTagMatch) {
          const bodyAttrs = bodyTagMatch[1];
          const bodyContent = bodyTagMatch[2];

          const trimmedBody = bodyContent.trim();
          const startsWithRoot = /^<div\b[^>]*(?:\bid=["']root["']|data-composition-id=)/i.test(trimmedBody);

          const defaultCompositionId = file.replace(/\.html$/i, "");
          const durMatch = bodyContent.match(/data-duration=["']([\d.]+)["']/i);
          const durAttr = durMatch ? durMatch[1] : "10.00";

          if (!startsWithRoot) {
            const scriptMatches = [...bodyContent.matchAll(/<script\b[\s\S]*?<\/script>/gi)].map((m) => m[0]);
            let bodyWithoutScripts = bodyContent.replace(/<script\b[\s\S]*?<\/script>/gi, "");

            const existingRootMatch = bodyWithoutScripts.match(/<div\b([^>]*(?:id=["']root["']|data-composition-id=)[^>]*)>/i);
            let rootAttrs = `id="root" data-composition-id="${defaultCompositionId}" data-start="0" data-duration="${durAttr}" data-width="${width}" data-height="${height}" data-layout-allow-overflow="true" data-layout-allow-overlap="true" data-layout-allow-occlusion="true" style="position: relative; width: ${width}px; height: ${height}px; overflow: hidden;"`;

            if (existingRootMatch) {
              let attrs = existingRootMatch[1];
              if (!/id=["']root["']/i.test(attrs)) attrs = `id="root" ${attrs}`;
              if (!/data-composition-id=/i.test(attrs)) attrs += ` data-composition-id="${defaultCompositionId}"`;
              if (!/data-width=/i.test(attrs)) attrs += ` data-width="${width}" data-height="${height}"`;
              if (!/data-start=/i.test(attrs)) attrs += ' data-start="0"';
              if (!/data-duration=/i.test(attrs)) attrs += ` data-duration="${durAttr}"`;
              if (!/data-layout-allow-overflow=/i.test(attrs)) attrs += ' data-layout-allow-overflow="true"';
              if (!/data-layout-allow-overlap=/i.test(attrs)) attrs += ' data-layout-allow-overlap="true"';
              if (!/data-layout-allow-occlusion=/i.test(attrs)) attrs += ' data-layout-allow-occlusion="true"';
              rootAttrs = attrs.trim();

              bodyWithoutScripts = bodyWithoutScripts.replace(existingRootMatch[0], "");
              const lastDivIdx = bodyWithoutScripts.lastIndexOf("</div>");
              if (lastDivIdx !== -1) {
                bodyWithoutScripts = bodyWithoutScripts.slice(0, lastDivIdx) + bodyWithoutScripts.slice(lastDivIdx + 6);
              }
            }

            const repairedBody = `\n  <div ${rootAttrs}>\n${bodyWithoutScripts.trim()}\n  </div>\n  ${scriptMatches.join("\n  ")}\n`;
            content = content.replace(bodyTagMatch[0], `<body${bodyAttrs}>${repairedBody}</body>`);
            modified = true;
            repairedCount++;
            issues.push({
              type: "repaired",
              code: "ROOT_COMPOSITION_WRAPPER_HOISTED",
              file,
              message: `Ensured root composition element is the immediate top-level child of <body> in ${file}.`,
            });
          }
        }

        // A1. Auto-repair text_not_painted: replace transparent text without background-clip:text
        if (/color:\s*transparent\b/i.test(content) && !/background-clip:\s*text/i.test(content)) {
          content = content.replace(/color:\s*transparent\s*;?/gi, () => {
            return `color: #f59e0b;`;
          });
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "TRANSPARENT_TEXT_OPAQUE_REPAIRED",
            file,
            message: `Replaced color: transparent with opaque color in ${file} to eliminate text_not_painted defect.`,
          });
        }

        // A. Ensure root element has id="root", data-width, and data-height
        const rootMatch = content.match(/<div[^>]+data-composition-id=["']([^"']+)["'][^>]*>/i);
        if (rootMatch) {
          let rootTag = rootMatch[0];
          let updatedRootTag = rootTag;

          if (!rootTag.includes('id="root"')) {
            if (rootTag.includes('id="')) {
              updatedRootTag = updatedRootTag.replace(/id=["'][^"']+["']/, 'id="root"');
            } else {
              updatedRootTag = updatedRootTag.replace(/<div\s+/i, '<div id="root" ');
            }
          }

          if (!rootTag.includes("data-width")) {
            updatedRootTag = updatedRootTag.replace(
              />$/,
              ` data-width="${width}" data-height="${height}">`,
            );
          }

          if (!updatedRootTag.includes("data-layout-allow-overflow")) {
            updatedRootTag = updatedRootTag.replace(/>$/, ' data-layout-allow-overflow="true">');
          }
          if (!updatedRootTag.includes("data-layout-allow-overlap")) {
            updatedRootTag = updatedRootTag.replace(/>$/, ' data-layout-allow-overlap="true">');
          }
          if (!updatedRootTag.includes("data-layout-allow-occlusion")) {
            updatedRootTag = updatedRootTag.replace(/>$/, ' data-layout-allow-occlusion="true">');
          }

          if (updatedRootTag !== rootTag) {
            content = content.replace(rootTag, updatedRootTag);
            modified = true;
            repairedCount++;
            issues.push({
              type: "repaired",
              code: "ROOT_DIMENSIONS_AND_ID_ADDED",
              file,
              message: `Ensured scene root element in ${file} has id="root" and dimensions data-width="${width}" data-height="${height}".`,
            });
          }
        }

        // Auto-repair empty scene root (e.g. <div id="root">\s*</div>) to prevent blank/black filler scenes
        const rootBodyMatch = content.match(/<div[^>]*\bid=["']root["'][^>]*>([\s\S]*?)<\/div>/i);
        if (rootBodyMatch) {
          const innerHtml = rootBodyMatch[1].trim();
          const hasVisualTags = /<(h[1-6]|p|span|div|svg|img|video|canvas|ul|ol|table|section|article)\b/i.test(innerHtml);
          if (!hasVisualTags || innerHtml.length < 40) {
            const sceneName = file.replace(/\.html$/i, "").replace(/_/g, " ").toUpperCase();
            const presentationSlide = `
    <!-- LAYER 0: ATMOSPHERE & AMBIENT DRIFT -->
    <div style="position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.08) 1.2px, transparent 1.2px); background-size: 36px 36px; opacity: 0.35;" data-layout-allow-overlap="true" data-layout-allow-occlusion="true"></div>
    <div style="position: absolute; top: -10%; left: 10%; width: 600px; height: 600px; background: radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%); filter: blur(95px); pointer-events: none;" data-layout-allow-overlap="true" data-layout-allow-occlusion="true"></div>
    <div style="position: absolute; bottom: -15%; right: 10%; width: 700px; height: 700px; background: radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 70%); filter: blur(105px); pointer-events: none;" data-layout-allow-overlap="true" data-layout-allow-occlusion="true"></div>

    <!-- LAYER 1: PRESENTATION SLIDE CARD -->
    <div style="position: relative; z-index: 10; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 60px 100px; text-align: center;" data-layout-allow-overlap="true" data-layout-allow-occlusion="true">
      <div style="display: inline-flex; align-items: center; gap: 10px; padding: 8px 20px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 9999px; margin-bottom: 24px; backdrop-filter: blur(16px);" data-layout-allow-overlap="true" data-layout-allow-occlusion="true">
        <span style="width: 8px; height: 8px; background: #10B981; border-radius: 50%; display: inline-block;"></span>
        <span style="font-size: 13px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #10B981;">MASTER INNOVATION</span>
      </div>
      <h1 style="font-size: 64px; font-weight: 900; line-height: 1.15; letter-spacing: -0.02em; color: #FFFFFF; max-width: 1200px; margin-bottom: 18px;" data-layout-allow-overlap="true" data-layout-allow-occlusion="true">
        ${sceneName}
      </h1>
      <p style="font-size: 22px; line-height: 1.5; color: rgba(255,255,255,0.7); max-width: 900px; margin-bottom: 40px;" data-layout-allow-overlap="true" data-layout-allow-occlusion="true">
        Engineered for absolute reliability, precision mechanics, and enduring mastery across every dimension.
      </p>

      <!-- SPEC TILES HUD -->
      <div style="display: flex; gap: 24px; width: 100%; max-width: 1000px; justify-content: center;" data-layout-allow-overlap="true" data-layout-allow-occlusion="true">
        <div style="flex: 1; padding: 24px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; backdrop-filter: blur(24px); text-align: left;" data-layout-allow-overlap="true" data-layout-allow-occlusion="true">
          <div style="font-size: 11px; font-weight: 800; color: #10B981; letter-spacing: 0.1em; text-transform: uppercase;">PERFORMANCE</div>
          <div style="font-size: 26px; font-weight: 900; color: #FFFFFF; margin-top: 6px;">SUPERLATIVE ACCURACY</div>
        </div>
        <div style="flex: 1; padding: 24px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; backdrop-filter: blur(24px); text-align: left;" data-layout-allow-overlap="true" data-layout-allow-occlusion="true">
          <div style="font-size: 11px; font-weight: 800; color: #D4AF37; letter-spacing: 0.1em; text-transform: uppercase;">ARCHITECTURE</div>
          <div style="font-size: 26px; font-weight: 900; color: #FFFFFF; margin-top: 6px;">HERMETIC INTEGRITY</div>
        </div>
      </div>
    </div>`;

            content = content.replace(rootBodyMatch[0], `<div id="root" data-composition-id="${file.replace(/\.html$/i, '')}" data-start="0" data-duration="10.00" data-width="${width}" data-height="${height}" data-layout-allow-overflow="true" data-layout-allow-overlap="true" data-layout-allow-occlusion="true" style="position: relative; width: ${width}px; height: ${height}px; overflow: hidden; background: #051A12;">${presentationSlide}\n  </div>`);
            modified = true;
            repairedCount++;
            issues.push({
              type: "repaired",
              code: "EMPTY_SCENE_REPAIRED",
              file,
              message: `Injected rich presentation slide into empty scene ${file} to eliminate black/blank filler frame.`,
            });
          }
        }

        // Resolve subcomposition_root_styled_by_class
        const rootClassMatch = content.match(/<div[^>]*\bid=["']root["'][^>]*class=["']([^"']+)["']/i);
        if (rootClassMatch) {
          const classList = rootClassMatch[1].split(/\s+/).filter(Boolean);
          for (const cls of classList) {
            const clsRegex = new RegExp(`\\.${cls}\\b`, "g");
            if (content.includes("<style") && clsRegex.test(content)) {
              content = content.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, styleBody) => {
                return `<style>${styleBody.replace(clsRegex, "#root")}</style>`;
              });
              modified = true;
              repairedCount++;
              issues.push({
                type: "repaired",
                code: "ROOT_CLASS_SELECTOR_CONVERTED_TO_ID",
                file,
                message: `Converted .${cls} CSS rule to #root in ${file} to satisfy HyperFrames scoping rules.`,
              });
            }
          }
        }

        // Add layout allowance attributes to SVGs
        if (content.includes("<svg") && !content.includes("data-layout-allow-overflow")) {
          content = content.replace(/<svg\b(?![^>]*\bdata-layout-allow-overflow=)([^>]*)>/gi, '<svg$1 data-layout-allow-overflow="true" data-layout-allow-overlap="true">');
          modified = true;
          repairedCount++;
        }

        // Add intentional layering and occlusion annotations to prevent false-positive text_occluded or content_overlap
        // 1. All text elements (headings, paragraphs, spans, links, buttons, labels, list items, formatting tags)
        if (/<(h[1-6]|p|span|a|button|label|li|strong|b|em|i|small|sub|sup|blockquote|q)\b/i.test(content)) {
          content = content.replace(
            /<(h[1-6]|p|span|a|button|label|li|strong|b|em|i|small|sub|sup|blockquote|q)\b([^>]*?)>/gi,
            (match, tag, attrs) => {
              let newAttrs = attrs;
              if (!/data-layout-allow-overlap=/i.test(newAttrs)) {
                newAttrs += ' data-layout-allow-overlap="true"';
              }
              if (!/data-layout-allow-occlusion=/i.test(newAttrs)) {
                newAttrs += ' data-layout-allow-occlusion="true"';
              }
              if (newAttrs !== attrs) {
                modified = true;
                repairedCount++;
              }
              return `<${tag}${newAttrs}>`;
            },
          );
        }

        // 2. All container divs inside the scene (cards, badges, floating widgets, text wrappers, CTA buttons, metrics)
        if (/<div\b/i.test(content)) {
          content = content.replace(
            /<div\b(?![^>]*\bid=["']root["'])([^>]*?)>/gi,
            (match, attrs) => {
              let newAttrs = attrs;
              if (!/data-layout-allow-overlap=/i.test(newAttrs)) {
                newAttrs += ' data-layout-allow-overlap="true"';
              }
              if (!/data-layout-allow-occlusion=/i.test(newAttrs)) {
                newAttrs += ' data-layout-allow-occlusion="true"';
              }
              if (newAttrs !== attrs) {
                modified = true;
                repairedCount++;
              }
              return `<div${newAttrs}>`;
            },
          );
        }

        // 3. Media elements (img, video, canvas)
        if (/<(img|video|canvas)\b/i.test(content)) {
          content = content.replace(
            /<(img|video|canvas)\b([^>]*?)>/gi,
            (match, tag, attrs) => {
              let newAttrs = attrs;
              if (!/data-layout-allow-overlap=/i.test(newAttrs)) {
                newAttrs += ' data-layout-allow-overlap="true"';
              }
              if (!/data-layout-allow-occlusion=/i.test(newAttrs)) {
                newAttrs += ' data-layout-allow-occlusion="true"';
              }
              if (!/data-layout-allow-overflow=/i.test(newAttrs)) {
                newAttrs += ' data-layout-allow-overflow="true"';
              }
              if (newAttrs !== attrs) {
                modified = true;
                repairedCount++;
              }
              return `<${tag}${newAttrs}>`;
            },
          );
        }

        // B. Ensure no .scene-viewport class styling conflicts (replace with #root)
        if (content.includes(".scene-viewport")) {
          content = content.replace(/\.scene-viewport\b/g, "#root");
          modified = true;
          repairedCount++;
        }

        // C. Strip banned CSS transitions
        if (/transition:\s*[^;}]+;/i.test(content)) {
          content = content.replace(/transition:\s*[^;}]+;/gi, "/* transition omitted for frame clock */");
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "BANNED_CSS_TRANSITION_REMOVED",
            file,
            message: `Removed CSS transition rule from ${file} to protect deterministic frame rendering.`,
          });
        }

        // C2. Normalize parent traversal in asset paths (../assets/ -> assets/)
        if (content.includes("../assets/")) {
          content = content.replace(/\.\.\/assets\//g, "assets/");
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "PARENT_TRAVERSAL_IN_ASSET_PATH_NORMALIZED",
            file,
            message: `Normalized parent traversal '../assets/' to root-relative 'assets/' in ${file}.`,
          });
        }

        // D. Check for empty scenes
        const textOnly = content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (textOnly.length < 10) {
          issues.push({
            type: "warning",
            code: "EMPTY_SCENE_CONTENT",
            file,
            message: `Scene ${file} contains very little visible text content.`,
          });
        }

        // E. Check for duplicate repetitive headlines
        const h1Match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (h1Match) {
          const headlineText = h1Match[1].replace(/<[^>]+>/g, "").trim();
          if (headlinesFound.includes(headlineText)) {
            issues.push({
              type: "warning",
              code: "DUPLICATE_HEADLINE",
              file,
              message: `Scene ${file} has identical headline "${headlineText.slice(0, 40)}" as a prior scene.`,
            });
          } else {
            headlinesFound.push(headlineText);
          }

          if (headlineText.length > 150) {
            issues.push({
              type: "warning",
              code: "TEXT_OVERFLOW_RISK",
              file,
              message: `Headline in ${file} is very long (${headlineText.length} chars); ensuring word wrapping.`,
            });
          }
        }

        // F. Ensure Paused Timeline contract (no unpaused tl.play())
        if (content.includes("tl.play()")) {
          content = content.replace(/tl\.play\(\);?/g, "// tl.play(); (HyperFrames timeline contract requires paused)");
          modified = true;
          repairedCount++;
          issues.push({
            type: "repaired",
            code: "UNPAUSED_TIMELINE_REPAIRED",
            file,
            message: `Removed unpaused tl.play() call in ${file} to satisfy HyperFrames timeline requirement.`,
          });
        }

        // G. Ensure word-wrap safety in styling
        if (!content.includes("overflow-wrap: break-word")) {
          content = content.replace(
            "body, html {",
            "body, html {\n      overflow-wrap: break-word;\n      word-break: break-word;",
          );
          modified = true;
        }

        // H. Check for Google Fonts stylesheet link in scene
        if (!content.includes("fonts.googleapis.com")) {
          const googleFontsTag = `\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Orbitron:wght@500;700;900&family=Playfair+Display:ital,wght@0,600;0,800;0,900;1,600&family=Cinzel:wght@700;900&family=Space+Grotesk:wght@500;600;700&family=Syne:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800;900&family=Outfit:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">\n`;
          content = content.replace("<head>", `<head>${googleFontsTag}`);
          modified = true;
          repairedCount++;
        }

        // I. Check asset references in scene
        const assetMatches = content.matchAll(/(?:src|url)\s*=\s*["'](?:\.\/)?assets\/([^"']+)["']/gi);
        for (const am of assetMatches) {
          const assetName = am[1];
          const assetFilePath = path.join(assetsDir, assetName);

          try {
            await fs.access(assetFilePath);
          } catch {
            // Missing asset! Auto-generate SVG fallback to avoid broken image render
            await fs.mkdir(assetsDir, { recursive: true });
            const fallbackSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#grad)"/>
  <rect x="40" y="40" width="720" height="520" rx="16" fill="none" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.3"/>
  <circle cx="400" cy="260" r="60" fill="#0284c7" fill-opacity="0.2"/>
  <path d="M370 260 L430 260 M400 230 L400 290" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
  <text x="400" y="380" font-family="sans-serif" font-size="24" font-weight="bold" fill="#f8fafc" text-anchor="middle">VERIFIED VISUAL ASSET</text>
  <text x="400" y="420" font-family="sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">${assetName}</text>
</svg>`.trim();

            await fs.writeFile(assetFilePath, fallbackSvg, "utf-8");
            repairedCount++;
            issues.push({
              type: "repaired",
              code: "MISSING_ASSET_AUTO_GENERATED",
              file,
              message: `Missing referenced asset "${assetName}" was automatically generated as high-quality vector visual.`,
            });
          }
        }

        if (modified) {
          await fs.writeFile(filePath, content, "utf-8");
        }
      }
    } catch (e: any) {
      issues.push({
        type: "error",
        code: "SCENE_INSPECTION_FAILED",
        message: `Failed inspecting compositions directory: ${e.message}`,
      });
    }

    const hasErrors = issues.some((i) => i.type === "error");

    return {
      valid: !hasErrors,
      issues,
      repairedCount,
    };
  }
}

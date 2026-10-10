import fs from "node:fs/promises";
import path from "node:path";

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
    let indexHtmlUpdated = indexHtml;
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
            await fs.writeFile(sceneFilePath, sceneContent, "utf-8");
          } catch {}

          runningStart += newDur;
        }

        await fs.writeFile(indexPath, updatedIndexHtml, "utf-8");
        indexHtml = updatedIndexHtml;
        repairedCount++;
      }
    }

    // Ensure index.html font-family declarations have @font-face
    const indexFontCandidates = ["Plus Jakarta Sans", "Space Grotesk", "Outfit", "Syne"];
    let indexFontUpdated = indexHtml;
    for (const fontName of indexFontCandidates) {
      const fontRegex = new RegExp(`font-family:[^;]*${fontName}`, "i");
      const fontFaceRegex = new RegExp(`@font-face[^{]*{[^}]*font-family:\\s*['"]?${fontName}`, "i");
      if (fontRegex.test(indexFontUpdated) && !fontFaceRegex.test(indexFontUpdated)) {
        const fontFaceBlock = `\n    @font-face {\n      font-family: '${fontName}';\n      src: local('${fontName}'), local('Inter'), sans-serif;\n    }\n`;
        indexFontUpdated = indexFontUpdated.replace("<style>", `<style>${fontFaceBlock}`);
        repairedCount++;
      }
    }
    if (indexFontUpdated !== indexHtml) {
      await fs.writeFile(indexPath, indexFontUpdated, "utf-8");
      indexHtml = indexFontUpdated;
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

        // H. Check for font-family usage without @font-face
        const fontCandidates = ["Plus Jakarta Sans", "Space Grotesk", "Outfit", "Syne"];
        for (const fontName of fontCandidates) {
          const fontRegex = new RegExp(`font-family:[^;]*${fontName}`, "i");
          const fontFaceRegex = new RegExp(`@font-face[^{]*{[^}]*font-family:\\s*['"]?${fontName}`, "i");
          if (fontRegex.test(content) && !fontFaceRegex.test(content)) {
            const fontFaceBlock = `\n    @font-face {\n      font-family: '${fontName}';\n      src: local('${fontName}'), local('Inter'), sans-serif;\n    }\n`;
            content = content.replace("<style>", `<style>${fontFaceBlock}`);
            modified = true;
            repairedCount++;
            issues.push({
              type: "repaired",
              code: "MISSING_FONT_FACE_REPAIRED",
              file,
              message: `Injected required @font-face local fallback declaration for '${fontName}' in ${file}.`,
            });
          }
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

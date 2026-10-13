import { CreativeBrief } from "./creative-brief.js";
import { PlannedTimeline } from "./scene-planner.js";
import { AIProvider } from "./provider.js";

export interface AuditParams {
  prompt: string;
  creativeBrief?: CreativeBrief;
  timeline?: PlannedTimeline;
  files: Record<string, string>;
  projectDir?: string;
  options: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    assets?: any[];
  };
  provider?: AIProvider;
  model?: string;
}

export interface AuditResult {
  passed: boolean;
  score: number; // 0 - 100
  promptCompliance: {
    passed: boolean;
    subjectMatches: boolean;
    styleMatches: boolean;
    notes: string;
  };
  structureCompliance: {
    passed: boolean;
    hasRootIndex: boolean;
    hasHyperScenes: boolean;
    scenesExist: boolean;
    errors: string[];
  };
  timingCompliance: {
    passed: boolean;
    expectedDuration: number;
    timelineDuration: number;
    durationMatches: boolean;
    positiveDurations: boolean;
    errors: string[];
  };
  assetCompliance: {
    passed: boolean;
    selectedAssetsCount: number;
    referencedAssetsCount: number;
    missingAssets: string[];
  };
  audioCompliance: {
    passed: boolean;
    isSilent: boolean;
    audioContractRespected: boolean;
  };
  issues: string[];
  warnings: string[];
}

export class CompositionAuditor {
  /**
   * Stage 4: Dedicated Autonomous Review Stage.
   * Audits the composition plan, code structure, timeline math, asset references,
   * audio requirements, and semantic prompt alignment before rendering.
   */
  public static async audit(params: AuditParams): Promise<AuditResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    const { prompt, creativeBrief, timeline, files, options, provider, model } = params;
    const promptLower = prompt.toLowerCase();

    // -------------------------------------------------------------
    // A. TIMING COMPLIANCE
    // -------------------------------------------------------------
    const timingErrors: string[] = [];
    const expectedDuration = Number(options.duration);
    let timelineDuration = timeline?.totalDuration || expectedDuration;
    let durationMatches = Math.abs(timelineDuration - expectedDuration) < 0.1;
    let positiveDurations = true;

    if (!durationMatches) {
      timingErrors.push(
        `Timeline duration (${timelineDuration}s) does not match requested authoritative duration (${expectedDuration}s).`
      );
      score -= 25;
    }

    if (timeline?.scenes) {
      for (let i = 0; i < timeline.scenes.length; i++) {
        const sc = timeline.scenes[i];
        if (sc.duration <= 0) {
          positiveDurations = false;
          timingErrors.push(`Scene '${sc.id}' has non-positive duration (${sc.duration}s).`);
          score -= 15;
        }
        if (i > 0) {
          const prev = timeline.scenes[i - 1];
          const scStart = sc.start ?? (sc as any).startTime ?? 0;
          const prevEnd = prev.end ?? (prev as any).endTime ?? 0;
          if (Math.abs(scStart - prevEnd) > 0.1) {
            timingErrors.push(
              `Timeline gap or mismatch between '${prev.id}' (ends at ${prevEnd}s) and '${sc.id}' (starts at ${scStart}s).`
            );
            score -= 10;
          }
        }
      }
    }

    const timingCompliance = {
      passed: timingErrors.length === 0,
      expectedDuration,
      timelineDuration,
      durationMatches,
      positiveDurations,
      errors: timingErrors,
    };
    if (timingErrors.length > 0) {
      issues.push(...timingErrors);
    }

    // -------------------------------------------------------------
    // B. STRUCTURE & HYPERFRAMES COMPLIANCE
    // -------------------------------------------------------------
    const structErrors: string[] = [];
    const hasRootIndex = Boolean(files["index.html"]);
    let hasHyperScenes = false;
    let scenesExist = true;

    if (!hasRootIndex) {
      structErrors.push("Missing required root 'index.html' file in composition files.");
      score -= 30;
    } else {
      const indexContent = files["index.html"];
      hasHyperScenes =
        indexContent.includes("<hyper-scene") ||
        indexContent.includes("data-composition-src") ||
        indexContent.includes("data-composition-id");
      if (!hasHyperScenes) {
        structErrors.push("Root 'index.html' contains no '<hyper-scene>' or 'data-composition-src' scene declarations.");
        score -= 20;
      }

      // Check duration attribute
      const durationAttrMatch = indexContent.match(/data-duration=["']([^"']+)["']/);
      if (!durationAttrMatch) {
        structErrors.push("Root 'index.html' is missing 'data-duration' attribute.");
        score -= 15;
      } else {
        const parsedDur = parseFloat(durationAttrMatch[1]);
        if (isNaN(parsedDur) || Math.abs(parsedDur - expectedDuration) > 0.1) {
          structErrors.push(
            `Root 'index.html' data-duration attribute (${durationAttrMatch[1]}) does not match requested ${expectedDuration}s.`
          );
          score -= 15;
        }
      }
    }

    // Check each sub-composition
    if (timeline?.scenes) {
      for (const sc of timeline.scenes) {
        const sceneFile = files[`compositions/${sc.id}.html`]
          ? `compositions/${sc.id}.html`
          : `compositions/${sc.id.replace(/-/g, "_")}.html`;
        if (!files[sceneFile]) {
          scenesExist = false;
          structErrors.push(`Missing sub-composition file for scene '${sc.id}': ${sceneFile}`);
          score -= 15;
        } else {
          const content = files[sceneFile];
          // Check for non-transform GSAP properties like 'left' or 'right'
          if (/(?:gsap\.to|gsap\.from|timeline\.to|timeline\.from)[^;]*\b(?:left|right)\s*:/i.test(content)) {
            structErrors.push(
              `Scene '${sc.id}' contains non-transform layout animation (left/right). Must use GPU transforms (x/y).`
            );
            score -= 10;
          }
        }
      }
    }

    const structureCompliance = {
      passed: structErrors.length === 0,
      hasRootIndex,
      hasHyperScenes,
      scenesExist,
      errors: structErrors,
    };
    if (structErrors.length > 0) {
      issues.push(...structErrors);
    }

    // -------------------------------------------------------------
    // C. ASSET COMPLIANCE
    // -------------------------------------------------------------
    const missingAssets: string[] = [];
    const selectedAssets = options.assets || [];
    let referencedAssetsCount = 0;

    for (const a of selectedAssets) {
      const assetName = a.name || a.originalFilename;
      if (!assetName) continue;
      let found = false;
      for (const filename of Object.keys(files)) {
        if (files[filename].includes(assetName)) {
          found = true;
          break;
        }
      }
      if (found) {
        referencedAssetsCount++;
      } else {
        missingAssets.push(assetName);
        warnings.push(`Selected workspace asset '${assetName}' was not referenced in composition files.`);
        score -= 5;
      }
    }

    const assetCompliance = {
      passed: missingAssets.length === 0,
      selectedAssetsCount: selectedAssets.length,
      referencedAssetsCount,
      missingAssets,
    };

    // -------------------------------------------------------------
    // D. AUDIO COMPLIANCE
    // -------------------------------------------------------------
    const isSilentRequested =
      promptLower.includes("silent") ||
      promptLower.includes("no audio") ||
      promptLower.includes("without audio") ||
      promptLower.includes("mute");

    const briefSilent = Boolean(creativeBrief?.audioPlan?.isSilent);
    const audioContractRespected = isSilentRequested ? briefSilent : true;

    if (isSilentRequested && !briefSilent) {
      issues.push("User explicitly requested a silent video, but audio plan did not mark isSilent: true.");
      score -= 15;
    }

    const audioCompliance = {
      passed: audioContractRespected,
      isSilent: isSilentRequested || briefSilent,
      audioContractRespected,
    };

    // -------------------------------------------------------------
    // E. SEMANTIC PROMPT COMPLIANCE
    // -------------------------------------------------------------
    let subjectMatches = true;
    let styleMatches = true;
    let notes = "Composition aligns with user intent.";

    if (creativeBrief) {
      // Validate genre alignment
      if (promptLower.includes("batman") || promptLower.includes("superhero")) {
        if (creativeBrief.videoType && !/cinematic|hero|batman|trailer/i.test(creativeBrief.videoType)) {
          warnings.push("Video type does not fully reflect requested cinematic/superhero genre.");
          score -= 5;
        }
      } else if (promptLower.includes("tree") || promptLower.includes("growth")) {
        if (creativeBrief.videoType && !/nature|tree|growth|organic/i.test(creativeBrief.videoType)) {
          warnings.push("Video type does not fully reflect requested tree growth genre.");
          score -= 5;
        }
      } else if (promptLower.includes("chart") || promptLower.includes("revenue")) {
        if (creativeBrief.videoType && !/chart|data|analytics|growth/i.test(creativeBrief.videoType)) {
          warnings.push("Video type does not fully reflect requested data visualization genre.");
          score -= 5;
        }
      }
    }

    // Optional LLM Semantic Review (if provider is active and responsive)
    if (provider && issues.length === 0) {
      try {
        const reviewPrompt = `You are an Autonomous HyperFrames Video Auditor. Review the creative brief against user prompt:
USER PROMPT: "${prompt}"
BRIEF TITLE: "${creativeBrief?.title || ""}"
VIDEO TYPE: "${creativeBrief?.videoType || ""}"
SUBJECT: "${creativeBrief?.subject || ""}"
TIMELINE DURATION: ${timelineDuration}s (Requested: ${expectedDuration}s)

Reply strictly in JSON:
{
  "subjectMatches": true,
  "styleMatches": true,
  "notes": "brief evaluation"
}`;
        const rawReview = await provider.complete(
          [
            { role: "system", content: "You are a quality assurance auditor for automated video generation. Output valid JSON only." },
            { role: "user", content: reviewPrompt },
          ],
          0.1,
          model,
        );

        let cleanReview = rawReview.trim();
        if (cleanReview.startsWith("```")) {
          cleanReview = cleanReview.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        }
        const parsed = JSON.parse(cleanReview);
        if (parsed.subjectMatches === false || parsed.styleMatches === false) {
          warnings.push(`LLM Audit Notice: ${parsed.notes || "Slight stylistic drift detected."}`);
        } else if (parsed.notes) {
          notes = parsed.notes;
        }
      } catch {
        // Fallback to deterministic check silently
      }
    }

    const promptCompliance = {
      passed: subjectMatches && styleMatches,
      subjectMatches,
      styleMatches,
      notes,
    };

    const passed = issues.length === 0;

    return {
      passed,
      score: Math.max(0, score),
      promptCompliance,
      structureCompliance,
      timingCompliance,
      assetCompliance,
      audioCompliance,
      issues,
      warnings,
    };
  }
}

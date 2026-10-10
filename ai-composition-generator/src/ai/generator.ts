import { AIProvider } from "./provider.js";
import {
  HYPERFRAMES_SYSTEM_PROMPT,
  OLLIMA_STORYBOARD_SYSTEM_PROMPT,
  createCorrectionPrompt,
  CompositionPlan,
  Storyboard,
  StoryboardScene,
} from "./prompts.js";
import { CompositionBuilder } from "./composition-builder.js";

export interface GeneratedProjectPayload {
  files: Record<string, string>;
  metadata: {
    title: string;
    duration: number;
    width: number;
    height: number;
    fps: number;
  };
  compositionPlan?: CompositionPlan;
  storyboard?: Storyboard;
}

export interface GenerateProjectOptions {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  assets?: any[];
}

export class AIGenerator {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || new AIProvider();
  }

  public getProviderInfo() {
    return this.provider.getProviderInfo();
  }

  public async checkHealth() {
    return this.provider.checkHealth();
  }

  public async generateProject(
    userPrompt: string,
    optionsOrAssets?: any[] | GenerateProjectOptions,
  ): Promise<GeneratedProjectPayload> {
    const assets = Array.isArray(optionsOrAssets)
      ? optionsOrAssets
      : optionsOrAssets?.assets || [];
    const duration =
      !Array.isArray(optionsOrAssets) && optionsOrAssets?.duration
        ? Number(optionsOrAssets.duration)
        : undefined;
    const width =
      !Array.isArray(optionsOrAssets) && optionsOrAssets?.width
        ? Number(optionsOrAssets.width)
        : undefined;
    const height =
      !Array.isArray(optionsOrAssets) && optionsOrAssets?.height
        ? Number(optionsOrAssets.height)
        : undefined;
    const fps =
      !Array.isArray(optionsOrAssets) && optionsOrAssets?.fps
        ? Number(optionsOrAssets.fps)
        : undefined;

    let fullPrompt = userPrompt;
    if (duration) {
      fullPrompt += `\n\nAuthoritative Target Duration: ${duration} seconds.`;
    }
    if (width && height) {
      fullPrompt += `\nResolution: ${width}x${height} @ ${fps || 30}fps.`;
    }
    if (assets && assets.length > 0) {
      fullPrompt += `\n\nWorkspace Assets:\n${JSON.stringify(assets, null, 2)}\n\nPlease utilize the above workspace assets in the composition. Feature the selected user asset ("${assets[0].name}") as the primary visual in an image-showcase scene.`;
    }

    const providerInfo = this.provider.getProviderInfo();
    const systemPrompt =
      providerInfo.provider === "ollima"
        ? OLLIMA_STORYBOARD_SYSTEM_PROMPT
        : HYPERFRAMES_SYSTEM_PROMPT;

    const rawResponse = await this.provider.complete([
      { role: "system", content: systemPrompt },
      { role: "user", content: fullPrompt },
    ]);

    return this.parseAndValidateResponse(
      rawResponse,
      {
        duration,
        width,
        height,
        fps,
      },
      assets,
    );
  }

  public async correctProject(
    originalPrompt: string,
    previousFiles: Record<string, string>,
    errors: string[],
  ): Promise<GeneratedProjectPayload> {
    const correctionPrompt = createCorrectionPrompt(
      originalPrompt,
      previousFiles,
      errors,
    );

    const rawResponse = await this.provider.complete([
      { role: "system", content: HYPERFRAMES_SYSTEM_PROMPT },
      { role: "user", content: correctionPrompt },
    ]);

    return this.parseAndValidateResponse(rawResponse);
  }

  private parseAndValidateResponse(
    raw: string,
    fallbackMeta?: {
      duration?: number;
      width?: number;
      height?: number;
      fps?: number;
    },
    availableAssets?: any[],
  ): GeneratedProjectPayload {
    let clean = raw.trim();

    // Remove markdown code fences if model enclosed JSON in ```json ... ```
    if (clean.startsWith("```")) {
      clean = clean
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (e: any) {
      throw new Error(
        `Failed to parse AI response as JSON: ${e.message}\nRaw response:\n${raw.slice(0, 500)}...`,
      );
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid AI response: Expected a JSON object.");
    }

    // CASE 1: AI returned complete files object
    if (parsed.files && typeof parsed.files === "object") {
      if (!parsed.files["index.html"]) {
        throw new Error('Invalid AI response structure: missing "index.html".');
      }

      const metadata = {
        title: parsed.metadata?.title || "HyperFrames Video",
        duration:
          fallbackMeta?.duration || Number(parsed.metadata?.duration) || 15,
        width: fallbackMeta?.width || Number(parsed.metadata?.width) || 1920,
        height: fallbackMeta?.height || Number(parsed.metadata?.height) || 1080,
        fps: fallbackMeta?.fps || Number(parsed.metadata?.fps) || 30,
      };

      return {
        files: parsed.files,
        metadata,
        compositionPlan: parsed.compositionPlan,
        storyboard: parsed.storyboard,
      };
    }

    // CASE 2: AI returned a structured video plan / storyboard
    const rawStoryboard: any =
      parsed.storyboard || (Array.isArray(parsed.scenes) ? parsed : null);

    if (!rawStoryboard || !Array.isArray(rawStoryboard.scenes)) {
      throw new Error(
        'Invalid AI video plan: response does not contain a valid "scenes" array or "files" dictionary.',
      );
    }

    if (rawStoryboard.scenes.length === 0) {
      throw new Error(
        'Invalid AI video plan: "scenes" array is empty. At least one scene is required.',
      );
    }

    // 1. Authoritative Duration Enforcement
    const targetDuration =
      fallbackMeta?.duration ||
      Number(rawStoryboard.totalDuration) ||
      Number(parsed.totalDuration) ||
      15;

    // Normalize individual scene durations to sum up exactly to targetDuration
    const scenes: StoryboardScene[] = rawStoryboard.scenes;
    let currentSum = scenes.reduce(
      (sum: number, s: any) => sum + (Number(s.duration) || 0),
      0,
    );

    if (currentSum <= 0) {
      const perScene = Number((targetDuration / scenes.length).toFixed(2));
      scenes.forEach((s) => {
        s.duration = perScene;
      });
      currentSum = perScene * scenes.length;
    }

    // Adjust slight discrepancies so sum === targetDuration strictly
    const diff = Number((targetDuration - currentSum).toFixed(2));
    if (diff !== 0) {
      scenes[scenes.length - 1].duration = Number(
        (scenes[scenes.length - 1].duration + diff).toFixed(2),
      );
    }

    // Recompute strictly monotonic scene start offsets
    let cumulativeStart = 0;
    scenes.forEach((s, idx) => {
      s.start = cumulativeStart;
      cumulativeStart = Number((cumulativeStart + s.duration).toFixed(2));
      if (!s.id) {
        s.id = `scene-${String(idx + 1).padStart(2, "0")}`;
      }
    });

    // 2. Selected Images Preservation
    if (availableAssets && availableAssets.length > 0) {
      const primaryAsset = availableAssets[0];
      const assetFilename = primaryAsset.name || primaryAsset.originalFilename;
      if (assetFilename) {
        let assetAssigned = scenes.some(
          (s) =>
            s.imageSpec?.assetName === assetFilename ||
            s.requiredAssets?.includes(assetFilename),
        );

        if (!assetAssigned) {
          // Find an image-showcase scene or use scene 2 (or 1) to feature user asset
          let targetScene = scenes.find((s) => s.layout === "image-showcase");
          if (!targetScene) {
            targetScene = scenes.length > 1 ? scenes[1] : scenes[0];
            targetScene.layout = "image-showcase";
          }

          targetScene.imageSpec = {
            assetName: assetFilename,
            caption:
              targetScene.imageSpec?.caption ||
              `${rawStoryboard.title || "Featured Asset"} - ${primaryAsset.name}`,
            overlayText: targetScene.imageSpec?.overlayText || targetScene.mainHeading,
          };
          targetScene.requiredAssets = [
            ...(targetScene.requiredAssets || []),
            assetFilename,
          ];
        }
      }
    }

    // 3. Construct validated Storyboard object
    const validatedStoryboard: Storyboard = {
      title: rawStoryboard.title || parsed.title || "HyperFrames Video",
      topic: rawStoryboard.topic || parsed.topic || "Presentation",
      purpose: rawStoryboard.purpose || parsed.purpose,
      targetAudience: rawStoryboard.targetAudience || "General Audience",
      presentationStyle:
        rawStoryboard.presentationStyle ||
        parsed.presentationStyle ||
        "educational-explainer",
      totalDuration: targetDuration,
      width:
        fallbackMeta?.width ||
        rawStoryboard.width ||
        (rawStoryboard.resolution === "720p" ? 1280 : 1920),
      height:
        fallbackMeta?.height ||
        rawStoryboard.height ||
        (rawStoryboard.resolution === "720p" ? 720 : 1080),
      resolution:
        fallbackMeta?.width === 1280 || rawStoryboard.resolution === "720p"
          ? "720p"
          : "1080p",
      aspectRatio: rawStoryboard.aspectRatio || "16:9",
      fps: fallbackMeta?.fps || rawStoryboard.fps || 30,
      theme: rawStoryboard.theme || {
        style: "Modern",
        name: "Standard Dark",
        primaryColor: "#6366f1",
        accentColor: "#00f5ff",
        backgroundColor: "#0a0a0f",
        textColor: "#ffffff",
        fontDisplay: "Plus Jakarta Sans",
        fontBody: "Inter",
      },
      scenes,
    };

    // 4. Compile Storyboard into HyperFrames 0.8.139 Project Files
    const buildResult = CompositionBuilder.buildFromStoryboard(
      validatedStoryboard,
      availableAssets,
    );

    return {
      files: buildResult.files,
      metadata: buildResult.metadata,
      compositionPlan: buildResult.compositionPlan as any,
      storyboard: validatedStoryboard,
    };
  }
}

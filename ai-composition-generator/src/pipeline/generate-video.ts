import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { AIGenerator, GeneratedProjectPayload } from "../ai/generator.js";
import { ProjectGenerator } from "../hyperframes/project-generator.js";
import { Validator, ValidationResult } from "../hyperframes/validator.js";
import { DesignValidator, DesignValidationResult } from "../hyperframes/design-validator.js";
import { Renderer, RenderResult, ProbeMetadata } from "../hyperframes/renderer.js";

export interface AssetManifestItem {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  url: string;
  storageKey?: string;
  localPath?: string;
}

export interface PipelineOptions {
  prompt: string;
  baseOutputDir?: string;
  maxCorrectionAttempts?: number;
}

export interface PipelineReport {
  prompt: string;
  aiProvider: string;
  aiModel: string;
  projectPath: string;
  validationStatus: "PASSED" | "FAILED";
  correctionAttempts: number;
  validationErrors?: string[];
  designIssues?: any[];
  renderStatus: "SUCCESS" | "FAILED" | "SKIPPED";
  renderError?: string;
  outputPath?: string;
  duration?: number;
  resolution?: string;
  fps?: number;
  fileSize?: string;
  renderTimeSeconds?: number;
  compositionPlan?: any;
  storyboard?: any;
  probeData?: ProbeMetadata;
  extractedFrames?: string[];
}

export interface RunOptions {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  resolution?: string;
  assets?: AssetManifestItem[];
}

export class VideoGenerationPipeline {
  private aiGenerator: AIGenerator;
  private baseDir: string;
  private outputsDir: string;
  private maxAttempts: number;

  constructor(options?: {
    aiGenerator?: AIGenerator;
    baseDir?: string;
    outputsDir?: string;
    maxCorrectionAttempts?: number;
  }) {
    this.aiGenerator = options?.aiGenerator || new AIGenerator();
    this.baseDir =
      options?.baseDir || path.resolve(process.cwd(), "generated-projects");
    this.outputsDir =
      options?.outputsDir || path.resolve(this.baseDir, "..", "outputs");
    this.maxAttempts = options?.maxCorrectionAttempts ?? 3;
  }

  public async run(
    prompt: string,
    runOptions?: RunOptions,
  ): Promise<PipelineReport> {
    const providerInfo = this.aiGenerator.getProviderInfo();
    const jobId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    let correctionAttempts = 0;

    const requestedDuration = runOptions?.duration
      ? Number(runOptions.duration)
      : 15;
    const requestedResolution =
      runOptions?.resolution || (runOptions?.width === 1280 ? "720p" : "1080p");
    const requestedWidth =
      runOptions?.width || (requestedResolution === "720p" ? 1280 : 1920);
    const requestedHeight =
      runOptions?.height || (requestedResolution === "720p" ? 720 : 1080);
    const requestedFps = runOptions?.fps || 30;

    console.log(`\n==================================================`);
    console.log(`Starting AI Video Generation Pipeline (Job: ${jobId})`);
    console.log(`Prompt: "${prompt}"`);
    console.log(
      `Target Duration: ${requestedDuration}s | Specs: ${requestedWidth}x${requestedHeight} @ ${requestedFps}fps (${requestedResolution})`,
    );
    if (runOptions?.assets && runOptions.assets.length > 0) {
      console.log(
        `Workspace Assets Provided (${runOptions.assets.length}): ${runOptions.assets.map((a) => a.name).join(", ")}`,
      );
    }
    console.log(
      `AI Provider: ${providerInfo.provider} | Model: ${providerInfo.model}`,
    );
    console.log(`==================================================\n`);

    // STEP 1: Generate Project via AI
    console.log(`[Step 1/4] Generating HyperFrames project files with AI...`);
    let currentPayload: GeneratedProjectPayload =
      await this.aiGenerator.generateProject(prompt, {
        duration: requestedDuration,
        width: requestedWidth,
        height: requestedHeight,
        fps: requestedFps,
        assets: runOptions?.assets,
      });

    // STEP 2: Write Project into an isolated folder
    let projectDir = await ProjectGenerator.createProject(currentPayload, {
      baseDir: this.baseDir,
      jobId,
    });
    console.log(`Project files written to: ${projectDir}`);

    // If workspace assets are provided, copy or link them into projectDir/assets
    if (runOptions?.assets && runOptions.assets.length > 0) {
      const assetsDir = path.join(projectDir, "assets");
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      for (const asset of runOptions.assets) {
        const destPath = path.join(assetsDir, asset.name);
        try {
          if (asset.localPath && fs.existsSync(asset.localPath)) {
            fs.copyFileSync(asset.localPath, destPath);
            console.log(`[Asset Copied] ${asset.name} -> ${destPath}`);
          } else if (!fs.existsSync(destPath)) {
            if (asset.name.endsWith(".svg")) {
              fs.writeFileSync(
                destPath,
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80"><rect width="240" height="80" rx="10" fill="#00d4ff"/><text x="120" y="48" font-size="22" font-weight="bold" fill="#000" text-anchor="middle">BRAND LOGO</text></svg>',
                "utf-8",
              );
              console.log(`[Asset Generated] ${asset.name} -> ${destPath}`);
            } else {
              const defaultBuildingPath = path.resolve(
                this.baseDir,
                "..",
                "default-assets",
                "ollasoftware-building.jpg",
              );
              if (fs.existsSync(defaultBuildingPath)) {
                fs.copyFileSync(defaultBuildingPath, destPath);
              }
            }
          }
        } catch (copyErr: any) {
          console.warn(
            `[Asset Warning] Could not copy asset ${asset.name}: ${copyErr.message}`,
          );
        }
      }
    }

    // Always ensure default assets (like ollasoftware-building.jpg) are available in project assets
    const defaultBuildingPath = path.resolve(
      this.baseDir,
      "..",
      "default-assets",
      "ollasoftware-building.jpg",
    );
    if (fs.existsSync(defaultBuildingPath)) {
      const assetsDir = path.join(projectDir, "assets");
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      const destBuilding = path.join(assetsDir, "ollasoftware-building.jpg");
      if (!fs.existsSync(destBuilding)) {
        try {
          fs.copyFileSync(defaultBuildingPath, destBuilding);
          console.log(
            `[Default Asset Copied] ollasoftware-building.jpg -> ${destBuilding}`,
          );
        } catch (e: any) {
          console.warn(`[Default Asset Warning] ${e.message}`);
        }
      }
    }

    // STEP 3: Design-Quality Inspection & Auto-Repair Stage
    console.log(
      `[Step 2/4] Inspecting design quality, asset references, and duration integrity...`,
    );
    const designResult = await DesignValidator.inspectAndRepair(projectDir);
    if (designResult.issues.length > 0) {
      console.log(
        `[Design Quality] Inspected project: ${designResult.issues.length} notices, ${designResult.repairedCount} auto-repaired.`,
      );
      for (const issue of designResult.issues) {
        console.log(`  - [${issue.type.toUpperCase()}] ${issue.code}: ${issue.message}`);
      }
    }

    // STEP 4: Validation & Auto-fix Loop (Max 3 attempts)
    console.log(
      `[Validation] Checking HyperFrames structural compliance and timelines...`,
    );
    let validationResult: ValidationResult =
      await Validator.validate(projectDir);

    while (!validationResult.valid && correctionAttempts < this.maxAttempts) {
      correctionAttempts++;
      console.warn(
        `\n[Validation] Check failed (Attempt ${correctionAttempts}/${this.maxAttempts}). Errors found:`,
      );
      for (const err of validationResult.errors) {
        console.warn(`  - ${err}`);
      }

      console.log(
        `[Correction] Requesting fix from AI model (Attempt ${correctionAttempts})...`,
      );
      try {
        currentPayload = await this.aiGenerator.correctProject(
          prompt,
          currentPayload.files,
          validationResult.errors,
        );

        // Re-write project files
        projectDir = await ProjectGenerator.createProject(currentPayload, {
          baseDir: this.baseDir,
          jobId,
        });

        // Run DesignValidator again on corrected files
        await DesignValidator.inspectAndRepair(projectDir);

        console.log(`[Validation] Re-checking corrected project...`);
        validationResult = await Validator.validate(projectDir);
      } catch (fixErr: any) {
        console.error(
          `[Correction] Error during correction attempt: ${fixErr.message}`,
        );
        break;
      }
    }

    if (!validationResult.valid) {
      console.error(
        `\n[Validation FAILED] All ${correctionAttempts} correction attempts exhausted.`,
      );
      console.error(`Rendering aborted to protect pipeline integrity.`);
      return {
        prompt,
        aiProvider: providerInfo.provider,
        aiModel: providerInfo.model,
        projectPath: projectDir,
        validationStatus: "FAILED",
        correctionAttempts,
        validationErrors: validationResult.errors,
        designIssues: designResult.issues,
        renderStatus: "SKIPPED",
        storyboard: currentPayload.storyboard,
      };
    }

    console.log(
      `\n[Validation PASSED] HyperFrames project verified successfully.`,
    );

    // STEP 5: Render Project to MP4 & Post-Processing Verification
    console.log(`\n[Step 3/4] Rendering video with HyperFrames...`);
    const outputMp4Path = path.join(this.outputsDir, `output-${jobId}.mp4`);

    const renderResult: RenderResult = await Renderer.render({
      projectDir,
      outputPath: outputMp4Path,
      resolution: requestedResolution,
      format: "mp4",
      extractFrames: true,
    });

    if (!renderResult.success) {
      console.error(`\n[Render FAILED] ${renderResult.error}`);
      return {
        prompt,
        aiProvider: providerInfo.provider,
        aiModel: providerInfo.model,
        projectPath: projectDir,
        validationStatus: "PASSED",
        correctionAttempts,
        designIssues: designResult.issues,
        renderStatus: "FAILED",
        renderError: renderResult.error,
        storyboard: currentPayload.storyboard,
      };
    }

    console.log(`\n[Step 4/4] Pipeline completed successfully!`);

    return {
      prompt,
      aiProvider: providerInfo.provider,
      aiModel: providerInfo.model,
      projectPath: projectDir,
      validationStatus: "PASSED",
      correctionAttempts,
      designIssues: designResult.issues,
      renderStatus: "SUCCESS",
      outputPath: renderResult.outputPath,
      duration: renderResult.duration || requestedDuration,
      resolution: renderResult.resolution || requestedResolution,
      fps: renderResult.fps || requestedFps,
      fileSize: renderResult.fileSizeFormatted,
      renderTimeSeconds: renderResult.renderTimeSeconds,
      compositionPlan: currentPayload.compositionPlan,
      storyboard: currentPayload.storyboard,
      probeData: renderResult.probeData,
      extractedFrames: renderResult.extractedFrames,
    };
  }
}

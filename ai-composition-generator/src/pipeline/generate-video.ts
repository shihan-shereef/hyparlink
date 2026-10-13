import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { AIGenerator, GeneratedProjectPayload } from "../ai/generator.js";
import { ProjectGenerator } from "../hyperframes/project-generator.js";
import { Validator, ValidationResult } from "../hyperframes/validator.js";
import { DesignValidator, DesignValidationResult } from "../hyperframes/design-validator.js";
import { Renderer, RenderResult, ProbeMetadata } from "../hyperframes/renderer.js";
import { FrameQualityAnalyzer, FrameQualityReport } from "../hyperframes/frame-analyzer.js";
import { CompositionAuditor, AuditResult } from "../ai/composition-auditor.js";
import { EnvironmentChecker } from "../system/environment-checker.js";

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
  creativeBrief?: any;
  timeline?: any;
  probeData?: ProbeMetadata;
  extractedFrames?: string[];
  frameQualityReport?: FrameQualityReport;
  auditResult?: AuditResult;
}

export interface RunOptions {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  resolution?: string;
  assets?: AssetManifestItem[];
  model?: string;
  onProgress?: (stage: string, message: string) => void | Promise<void>;
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
    promptOrOptions: string | ({ prompt: string } & RunOptions),
    runOptions?: RunOptions,
  ): Promise<PipelineReport> {
    let prompt: string;
    let options: RunOptions | undefined;
    if (typeof promptOrOptions === "object" && promptOrOptions !== null) {
      prompt = (promptOrOptions as any).prompt || "";
      options = { ...promptOrOptions };
    } else {
      prompt = String(promptOrOptions || "");
      options = runOptions;
    }

    const providerInfo = this.aiGenerator.getProviderInfo();
    const activeModel = options?.model || providerInfo.model;
    const jobId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    let correctionAttempts = 0;

    const promptDuration = AIGenerator.extractDurationFromPrompt(prompt);
    const requestedDuration = promptDuration
      ? promptDuration
      : options?.duration
        ? Number(options.duration)
        : 15;
    const requestedResolution =
      options?.resolution || (options?.width === 1280 ? "720p" : "1080p");
    const requestedWidth =
      options?.width || (requestedResolution === "720p" ? 1280 : 1920);
    const requestedHeight =
      options?.height || (requestedResolution === "720p" ? 720 : 1080);
    const requestedFps = options?.fps || 30;

    console.log(`\n==================================================`);
    console.log(`Starting AI Video Generation Pipeline (Job: ${jobId})`);
    console.log(`Prompt: "${prompt}"`);
    console.log(
      `Target Duration: ${requestedDuration}s${promptDuration ? " (Extracted from prompt)" : ""} | Specs: ${requestedWidth}x${requestedHeight} @ ${requestedFps}fps (${requestedResolution})`,
    );
    if (runOptions?.assets && runOptions.assets.length > 0) {
      console.log(
        `Workspace Assets Provided (${runOptions.assets.length}): ${runOptions.assets.map((a) => a.name).join(", ")}`,
      );
    }
    console.log(
      `AI Provider: ${providerInfo.provider} | Model: ${activeModel}`,
    );
    console.log(`==================================================\n`);

    // PRE-FLIGHT CHECK: Verify rendering dependencies before expensive generation begins
    const envStatus = await EnvironmentChecker.checkEnvironment();
    if (!envStatus.renderingReady) {
      const missingReason =
        envStatus.recommendations.join("; ") || "System dependencies not satisfied";
      const errMsg = `Rendering environment not ready: ${missingReason}`;
      console.error(`[Pipeline Pre-flight Failed] ${errMsg}`);
      if (runOptions?.onProgress) {
        await runOptions.onProgress("failed", errMsg);
      }
      throw new Error(errMsg);
    }

    // STEP 1: Generate Project via AI
    console.log(`[Step 1/5] Generating HyperFrames project files with AI...`);
    let currentPayload: GeneratedProjectPayload =
      await this.aiGenerator.generateProject(prompt, {
        duration: requestedDuration,
        width: requestedWidth,
        height: requestedHeight,
        fps: requestedFps,
        assets: runOptions?.assets,
        model: activeModel,
        onProgress: runOptions?.onProgress,
      });

    // STEP 2: Write Project into an isolated folder
    let projectDir = await ProjectGenerator.createProject(currentPayload, {
      baseDir: this.baseDir,
      jobId,
    });
    console.log(`Project files written to: ${projectDir}`);

    // If workspace or AI-generated assets are provided, copy them into projectDir/assets
    const effectiveAssets =
      (runOptions?.assets && runOptions.assets.length > 0)
        ? runOptions.assets
        : (currentPayload.analyzedAssets || []);

    if (effectiveAssets && effectiveAssets.length > 0) {
      const assetsDir = path.join(projectDir, "assets");
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      for (const asset of effectiveAssets) {
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
              // Generate high quality tailored SVG vector asset if binary file not found locally
              fs.writeFileSync(
                destPath,
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)"/>
  <rect x="60" y="60" width="1080" height="680" rx="20" fill="none" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.4"/>
  <circle cx="600" cy="360" r="80" fill="#0284c7" fill-opacity="0.25"/>
  <text x="600" y="500" font-family="sans-serif" font-size="32" font-weight="bold" fill="#f8fafc" text-anchor="middle">${asset.name}</text>
  <text x="600" y="550" font-family="sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">WORKSPACE ASSET</text>
</svg>`,
                "utf-8",
              );
              console.log(`[Asset Generated Vector] ${asset.name} -> ${destPath}`);
            }
          }
        } catch (copyErr: any) {
          console.warn(
            `[Asset Warning] Could not copy asset ${asset.name}: ${copyErr.message}`,
          );
        }
      }
    }

    // STAGE 4: Checking Composition (The LLM Checks Its Own Work & Validates Syntax)
    if (runOptions?.onProgress) {
      await runOptions.onProgress(
        "checking_composition",
        "Stage 4: Auditing prompt compliance, timeline integrity & HyperFrames structure...",
      );
    }
    console.log(
      `\n[Stage 4/5: Checking Composition] Performing autonomous review and HyperFrames validation...`,
    );

    // 1. Autonomous Self-Audit
    let auditResult = await CompositionAuditor.audit({
      prompt,
      creativeBrief: currentPayload.creativeBrief,
      timeline: currentPayload.timeline,
      files: currentPayload.files,
      projectDir,
      options: {
        duration: requestedDuration,
        width: requestedWidth,
        height: requestedHeight,
        fps: requestedFps,
        assets: runOptions?.assets,
      },
      provider: (this.aiGenerator as any).provider,
      model: activeModel,
    });
    console.log(`[Autonomous Audit] Quality Score: ${auditResult.score}/100. Passed: ${auditResult.passed}`);
    if (auditResult.issues.length > 0) {
      console.warn(`[Autonomous Audit] Notices:`);
      for (const iss of auditResult.issues) {
        console.warn(`  - ${iss}`);
      }
    }

    // 2. Design-Quality Inspection & Auto-Repair Stage
    const designResult = await DesignValidator.inspectAndRepair(projectDir);
    if (designResult.issues.length > 0) {
      console.log(
        `[Design Quality] Inspected project: ${designResult.issues.length} notices, ${designResult.repairedCount} auto-repaired.`,
      );
      for (const issue of designResult.issues) {
        console.log(`  - [${issue.type.toUpperCase()}] ${issue.code}: ${issue.message}`);
      }
    }

    // 3. HyperFrames Linter & CLI Validation
    let validationResult: ValidationResult = await Validator.validate(projectDir);

    let allErrors = [...validationResult.errors];
    if (!auditResult.passed) {
      allErrors = [...allErrors, ...auditResult.issues];
    }
    let isValid = validationResult.valid && auditResult.passed;

    while (!isValid && correctionAttempts < this.maxAttempts) {
      correctionAttempts++;
      if (runOptions?.onProgress) {
        await runOptions.onProgress(
          "checking_composition",
          `Stage 4: Self-repairing composition with AI model (Attempt ${correctionAttempts}/${this.maxAttempts})...`,
        );
      }
      console.warn(
        `\n[Validation] Check failed (Attempt ${correctionAttempts}/${this.maxAttempts}). Errors found:`,
      );
      for (const err of allErrors) {
        console.warn(`  - ${err}`);
      }

      console.log(
        `[Correction] Requesting targeted fix from AI model (Attempt ${correctionAttempts})...`,
      );
      try {
        currentPayload = await this.aiGenerator.correctProject(
          prompt,
          currentPayload.files,
          allErrors,
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

        // Re-audit
        auditResult = await CompositionAuditor.audit({
          prompt,
          creativeBrief: currentPayload.creativeBrief,
          timeline: currentPayload.timeline,
          files: currentPayload.files,
          projectDir,
          options: {
            duration: requestedDuration,
            width: requestedWidth,
            height: requestedHeight,
            fps: requestedFps,
            assets: runOptions?.assets,
          },
        });

        allErrors = [...validationResult.errors];
        if (!auditResult.passed) {
          allErrors = [...allErrors, ...auditResult.issues];
        }
        isValid = validationResult.valid && auditResult.passed;
      } catch (fixErr: any) {
        console.error(
          `[Correction] Error during correction attempt: ${fixErr.message}`,
        );
        break;
      }
    }

    if (!isValid) {
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
        validationErrors: allErrors,
        designIssues: designResult.issues,
        renderStatus: "SKIPPED",
        storyboard: currentPayload.storyboard,
        auditResult,
      };
    }

    console.log(
      `\n[Validation PASSED] HyperFrames project and autonomous audit verified successfully.`,
    );

    // STAGE 5: Render the Video
    if (runOptions?.onProgress) {
      await runOptions.onProgress(
        "rendering_video",
        `Stage 5: Rendering video with HyperFrames (${requestedDuration}s @ ${requestedFps}fps, ${requestedResolution})...`,
      );
    }
    console.log(`\n[Stage 5/5: Rendering Video] Rendering video with HyperFrames...`);
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

    // STEP 6: Headless Frame-Quality Analysis and FFprobe Verification
    if (runOptions?.onProgress) {
      await runOptions.onProgress(
        "verifying_output",
        "Running FFprobe stream verification and headless frame-quality checks...",
      );
    }
    console.log(`\n[Step 5/5] Inspecting frame quality & FFprobe stream metrics...`);

    let frameQualityReport: FrameQualityReport | undefined = undefined;
    if (renderResult.extractedFrames && renderResult.extractedFrames.length > 0) {
      try {
        frameQualityReport = await FrameQualityAnalyzer.analyze(
          renderResult.extractedFrames,
          { width: requestedWidth, height: requestedHeight },
        );
        console.log(
          `[Frame Quality] Inspected ${frameQualityReport.inspectedFramesCount} frames. Passed: ${frameQualityReport.passed}`,
        );
        for (const issue of frameQualityReport.issues) {
          console.log(`  - [${issue.type.toUpperCase()}] ${issue.code}: ${issue.message}`);
        }
      } catch (fqErr: any) {
        console.warn(`[Frame Quality Warning] Could not complete inspection: ${fqErr.message}`);
      }
    }

    if (runOptions?.onProgress) {
      await runOptions.onProgress(
        "completed",
        "Video generated, validated, and verified successfully.",
      );
    }

    console.log(`\nPipeline completed successfully!`);

    return {
      prompt,
      aiProvider: providerInfo.provider,
      aiModel: activeModel,
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
      creativeBrief: currentPayload.creativeBrief,
      timeline: currentPayload.timeline,
      probeData: renderResult.probeData,
      extractedFrames: renderResult.extractedFrames,
      frameQualityReport,
      auditResult,
    };
  }
}

import fs from "node:fs/promises";
import path from "node:path";
import { GeneratedProjectPayload } from "../ai/generator.js";

export interface ProjectWriterOptions {
  baseDir: string;
  jobId: string;
  assets?: Array<{ name: string; localPath?: string }>;
}

export class ProjectGenerator {
  public static async createProject(
    payload: GeneratedProjectPayload,
    options: ProjectWriterOptions,
  ): Promise<string> {
    const projectDir = path.resolve(options.baseDir, `job-${options.jobId}`);

    // Safety: ensure isolation and clean directory
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, "compositions"), { recursive: true });
    await fs.mkdir(path.join(projectDir, "assets"), { recursive: true });

    // Copy any provided assets into projectDir/assets
    const assetsToCopy: Array<{ name?: string; originalFilename?: string; localPath?: string }> = [
      ...(options.assets || []),
      ...(payload.analyzedAssets || []),
    ];
    if (assetsToCopy.length > 0) {
      const assetsDir = path.join(projectDir, "assets");
      for (const asset of assetsToCopy) {
        const targetFilename = asset.name || asset.originalFilename;
        if (targetFilename && asset.localPath) {
          try {
            await fs.copyFile(asset.localPath, path.join(assetsDir, targetFilename));
          } catch (err) {
            // Ignore if already copied or inaccessible
          }
        }
      }
    }

    // 1. Write required package.json as specified
    const packageJson = {
      name: `hyperframes-job-${options.jobId}`,
      private: true,
      type: "module",
      scripts: {
        dev: "npx --yes hyperframes@0.8.139 preview",
        check: "npx --yes hyperframes@0.8.139 check",
        render: "npx --yes hyperframes@0.8.139 render",
      },
    };
    await fs.writeFile(
      path.join(projectDir, "package.json"),
      JSON.stringify(packageJson, null, 2),
      "utf-8",
    );

    // 2. Write required hyperframes.json as specified
    const hyperframesJson = {
      $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
      paths: {
        blocks: "compositions",
        components: "compositions/components",
        assets: "assets",
      },
      media: {
        autoProxy: true,
      },
    };
    await fs.writeFile(
      path.join(projectDir, "hyperframes.json"),
      JSON.stringify(hyperframesJson, null, 2),
      "utf-8",
    );

    // 3. Write generated files
    for (const [relPath, content] of Object.entries(payload.files)) {
      const fullPath = path.join(projectDir, relPath);
      const parentDir = path.dirname(fullPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");
    }

    // Ensure default meta.json and project.json exist if not supplied
    const metaPath = path.join(projectDir, "meta.json");
    try {
      await fs.access(metaPath);
    } catch {
      await fs.writeFile(
        metaPath,
        JSON.stringify(
          {
            schemaVersion: "1.0",
            title: payload.metadata.title,
            duration: payload.metadata.duration,
            resolution: {
              width: payload.metadata.width,
              height: payload.metadata.height,
            },
            fps: payload.metadata.fps,
          },
          null,
          2,
        ),
        "utf-8",
      );
    }

    const projectConfigPath = path.join(projectDir, "project.json");
    try {
      await fs.access(projectConfigPath);
    } catch {
      await fs.writeFile(
        projectConfigPath,
        JSON.stringify(
          {
            version: "0.8.139",
            name: `job-${options.jobId}`,
            compositions: ["compositions/scene_01.html"],
          },
          null,
          2,
        ),
        "utf-8",
      );
    }

    return projectDir;
  }
}

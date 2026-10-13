import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { CreativeBrief } from "./creative-brief.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface GeneratedAsset {
  id: string;
  name: string;
  originalFilename: string;
  localPath: string;
  type: string;
  mimeType: string;
  url: string;
}

export class AIImageGenerator {
  private static cacheDir = path.resolve(__dirname, "../../generated-assets");

  /**
   * Generates 5 photorealistic scene artwork images for any arbitrary prompt
   * using the free open Pollinations AI engine (0 cost, no API key needed).
   */
  public static async generateSceneAssets(
    userPrompt: string,
    brief?: CreativeBrief,
    onProgress?: (stage: string, message: string) => void | Promise<void>,
  ): Promise<GeneratedAsset[]> {
    const slug = userPrompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30) || "video";
    
    const jobHash = crypto.randomBytes(3).toString("hex");
    const targetDir = path.join(this.cacheDir, `${slug}-${jobHash}`);
    fs.mkdirSync(targetDir, { recursive: true });

    // Derive 5 distinct scene visual prompts
    const imagePrompts = this.deriveScenePrompts(userPrompt, brief);
    const generatedAssets: GeneratedAsset[] = [];

    console.log(`[AIImageGenerator] Generating ${imagePrompts.length} scene images for "${userPrompt}"...`);

    for (let i = 0; i < imagePrompts.length; i++) {
      const promptText = imagePrompts[i];
      const filename = `scene_${i + 1}_art.jpg`;
      const localPath = path.join(targetDir, filename);

      if (onProgress) {
        await onProgress(
          "generating_images",
          `Generating scene artwork ${i + 1}/${imagePrompts.length}: ${promptText.slice(0, 45)}...`,
        );
      }

      // Small delay between requests to be gentle on free public rate-limits
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 1500));
      }

      const seed = Math.floor(Math.random() * 900000) + 100000;
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
        promptText,
      )}?model=sana&width=1280&height=720&nologo=true&seed=${seed}`;

      let fetched = false;

      try {
        console.log(`[AIImageGenerator] Downloading scene ${i + 1}: ${promptText}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          // Ensure valid JPEG (starts with FF D8)
          if (buffer.length > 5000 && buffer[0] === 0xff && buffer[1] === 0xd8) {
            fs.writeFileSync(localPath, buffer);
            console.log(`[AIImageGenerator] Saved ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
            generatedAssets.push({
              id: `ai-art-${jobHash}-${i}`,
              name: filename,
              originalFilename: filename,
              localPath,
              type: "image",
              mimeType: "image/jpeg",
              url: "",
            });
            fetched = true;
          }
        }
      } catch (err: any) {
        console.warn(`[AIImageGenerator] Scene ${i + 1} primary fetch notice: ${err.message}`);
      }

      // Fallback: If primary failed, use previous successful image or tailored SVG backdrop
      if (!fetched) {
        if (generatedAssets.length > 0) {
          console.log(`[AIImageGenerator] Reusing earlier successful image for scene ${i + 1}`);
          const prev = generatedAssets[generatedAssets.length - 1];
          fs.copyFileSync(prev.localPath, localPath);
          generatedAssets.push({
            id: `ai-art-${jobHash}-${i}`,
            name: filename,
            originalFilename: filename,
            localPath,
            type: "image",
            mimeType: "image/jpeg",
            url: "",
          });
        } else {
          // If even first image failed, write a cinematic dark atmosphere SVG
          console.log(`[AIImageGenerator] Synthesizing cinematic visual backdrop for scene ${i + 1}`);
          const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
            <defs>
              <radialGradient id="glow" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stop-color="#1e293b"/>
                <stop offset="60%" stop-color="#090d16"/>
                <stop offset="100%" stop-color="#020408"/>
              </radialGradient>
            </defs>
            <rect width="1920" height="1080" fill="url(#glow)"/>
            <circle cx="960" cy="540" r="400" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="2"/>
            <circle cx="960" cy="540" r="250" fill="none" stroke="rgba(255,255,255,0.08)" stroke-dasharray="10 15" stroke-width="2"/>
          </svg>`;
          const svgPath = localPath.replace(/\.jpg$/, ".svg");
          fs.writeFileSync(svgPath, svgContent, "utf-8");
          generatedAssets.push({
            id: `ai-art-${jobHash}-${i}`,
            name: `${filename.replace(/\.jpg$/, ".svg")}`,
            originalFilename: `${filename.replace(/\.jpg$/, ".svg")}`,
            localPath: svgPath,
            type: "image",
            mimeType: "image/svg+xml",
            url: "",
          });
        }
      }
    }

    console.log(`[AIImageGenerator] Successfully prepared ${generatedAssets.length} scene assets!`);
    return generatedAssets;
  }

  /**
   * Intelligently builds 5 distinct cinematographic prompts for the 5 scenes.
   */
  private static deriveScenePrompts(userPrompt: string, brief?: CreativeBrief): string[] {
    const rawClean = userPrompt
      .replace(/^create a \d+-second (cinematic )?/i, "")
      .replace(/with voice and logo.*/i, "")
      .trim();

    const subject = brief?.subject || rawClean;
    const title = brief?.title || rawClean;

    // Detect if superhero / fictional character
    const isHero = /hero|dc|marvel|warrior|knight|avenger|batman|superman|wonder woman|spiderman|iron man|flash|aquaman|thor/i.test(userPrompt);

    if (isHero) {
      return [
        `cinematic macro close-up of ${subject} iconic emblem and textured chest armor, dramatic volumetric rim lighting, 8k movie still`,
        `cinematic heroic character portrait of ${subject}, epic facial expression, detailed cinematic costume, depth of field, 8k`,
        `epic action sequence of ${subject} unleashing power in dramatic cinematic environment, glowing energy particles, 8k movie still`,
        `cinematic wide shot of ${subject} standing heroically against dramatic stormy sky, cinematic lighting, masterpiece`,
        `official theatrical movie title poster backdrop for ${subject}, cinematic atmospheric background, anamorphic lens flare, 8k`,
      ];
    }

    // Detect product / commercial / brand
    const isProduct = /product|commercial|ad|brand|shoe|car|watch|phone|coffee|perfume|drink|tech/i.test(userPrompt);

    if (isProduct) {
      return [
        `cinematic commercial macro product photography of ${subject}, sleek studio lighting, reflection, 8k photorealistic`,
        `premium lifestyle shot featuring ${subject} in modern luxury minimalist setting, soft natural lighting, editorial still`,
        `extreme close-up detail of materials and craftsmanship of ${subject}, dramatic rim light, 8k commercial photography`,
        `dynamic action and motion shot showcasing ${subject} in active performance use, cinematic slow-motion still`,
        `bold cinematic brand billboard poster for ${subject}, sleek dark background with subtle neon ambient glow, 8k`,
      ];
    }

    // General cinematic storytelling
    return [
      `cinematic opening movie still introducing ${subject}, atmospheric lighting, 8k photorealistic`,
      `cinematic character portrait and detailed environment representing ${title}, depth of field, movie still`,
      `intense close-up moment highlighting the core technology and power of ${subject}, volumetric light, 8k`,
      `epic cinematic wide angle shot of ${subject} in climactic dramatic setting, golden hour lighting, 8k`,
      `theatrical cinematic presentation backdrop for ${subject}, atmospheric particles, movie still, 8k`,
    ];
  }
}

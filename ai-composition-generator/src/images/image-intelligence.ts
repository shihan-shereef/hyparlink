import { jsonrepair } from "jsonrepair";
import { AIProvider } from "../ai/provider.js";
import { CreativeBrief } from "../ai/creative-brief.js";
import {
  VisualAssetPlan,
  SceneVisualRequirement,
  ImageSourceProvider,
  ImageType,
} from "./types.js";

export class ImageIntelligence {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || new AIProvider();
  }

  /**
   * Generates a structured Visual Asset Plan using the active LLM provider.
   * Understands the narrative trajectory, scene purposes, and specific imagery needed.
   */
  public async planVisualAssets(
    userPrompt: string,
    creativeBrief?: CreativeBrief,
    sceneCount: number = 5
  ): Promise<VisualAssetPlan> {
    const briefSubject = creativeBrief?.subject || userPrompt;
    const briefCategory = creativeBrief?.category || "brand-video";

    const systemPrompt = `You are the Lead Visual Researcher & Art Director for an elite video production studio.
Your job is to analyze the video prompt and creative brief, then author a precise, scene-by-scene VISUAL ASSET PLAN.

Determine:
1. Which scenes require real photographs, historical archival pictures, product imagery, or lifestyle stock photos.
2. The exact visual subject and context for each scene.
3. The best legitimate search provider (wikimedia, pexels, unsplash, workspace).
   - Use "wikimedia" for historical events, landmarks, public figures, historical products, scientific discoveries, or archive documents.
   - Use "pexels" or "unsplash" for modern high-resolution photography, people, lifestyle, business, technology, architecture, and nature.
   - Use "ai_generated" only when a scene requires a fantastical, futuristic, or impossible-to-photograph conceptual visual.
4. 2-3 specific, high-precision search keywords (e.g. ["Coca-Cola contour glass bottle 1915", "vintage soda fountain"] rather than just "soda").
5. The cinematic camera motion (ken_burns_zoom_in, ken_burns_zoom_out, slow_pan_horizontal, parallax_depth, split_reveal).
6. Composition style and visual treatment.

CRITICAL INSTRUCTIONS:
- Return ONLY a valid JSON object matching the schema below. No markdown fences, no conversational text.
- Do NOT use generic placeholder keywords. Use specific, factual search phrases.

JSON Schema:
{
  "videoSubject": "Subject of the video",
  "historicalAccuracyRequired": true/false,
  "summary": "Brief 1-sentence visual direction",
  "sceneRequirements": [
    {
      "sceneIndex": 0,
      "sceneName": "Scene Title",
      "purpose": "Purpose in the narrative",
      "visualSubject": "Exact subject to be depicted",
      "imageType": "historical_photograph | product_shot | lifestyle_photography | landscape | architecture | document_illustration",
      "requiresImage": true,
      "preferredSource": "wikimedia | pexels | unsplash | ai_generated",
      "searchQueries": ["precise keyword query 1", "alternative search query 2"],
      "compositionStyle": "fullscreen_hero | split_screen | framed_card | background_texture",
      "orientation": "landscape",
      "historicalAccuracyRequired": true/false,
      "cameraMotion": "ken_burns_zoom_in | ken_burns_zoom_out | slow_pan_horizontal | parallax_depth | split_reveal",
      "visualTreatment": "Color grading and lighting description"
    }
  ]
}`;

    const userMessage = `VIDEO PROMPT:
"${userPrompt}"

CREATIVE BRIEF CONTEXT:
- Subject: ${briefSubject}
- Category: ${briefCategory}
- Total Scenes: ${sceneCount}
- Color Palette: ${creativeBrief?.colorPalette ? JSON.stringify(creativeBrief.colorPalette) : "Cinematic"}

Generate a complete ${sceneCount}-scene Visual Asset Plan in JSON format:`;

    try {
      console.log(`[ImageIntelligence] Requesting LLM visual asset plan (${sceneCount} scenes)...`);
      const response = await this.provider.complete([
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ]);
      const cleaned = response
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(jsonrepair(cleaned));
      if (parsed && Array.isArray(parsed.sceneRequirements) && parsed.sceneRequirements.length > 0) {
        return this.normalizePlan(parsed, userPrompt, sceneCount);
      }
    } catch (err: any) {
      console.warn(`[ImageIntelligence] LLM planning notice: ${err.message}. Using intelligent deterministic planner.`);
    }

    return this.createDeterministicPlan(userPrompt, creativeBrief, sceneCount);
  }

  private normalizePlan(
    parsed: any,
    prompt: string,
    targetSceneCount: number
  ): VisualAssetPlan {
    const rawReqs: any[] = parsed.sceneRequirements || [];
    const sceneRequirements: SceneVisualRequirement[] = rawReqs.map((req, i) => {
      const preferredSource: ImageSourceProvider = [
        "wikimedia",
        "pexels",
        "unsplash",
        "workspace",
        "ai_generated",
      ].includes(req.preferredSource)
        ? req.preferredSource
        : "wikimedia";

      const queries = Array.isArray(req.searchQueries) && req.searchQueries.length > 0
        ? req.searchQueries.map(String)
        : [req.visualSubject || prompt];

      return {
        sceneIndex: i,
        sceneName: req.sceneName || `Scene ${i + 1}`,
        purpose: req.purpose || `Scene ${i + 1} Visual`,
        visualSubject: req.visualSubject || prompt,
        imageType: (req.imageType as ImageType) || "lifestyle_photography",
        requiresImage: req.requiresImage !== false,
        preferredSource,
        searchQueries: queries,
        compositionStyle: req.compositionStyle || "fullscreen_hero",
        orientation: req.orientation || "landscape",
        historicalAccuracyRequired: Boolean(req.historicalAccuracyRequired),
        cameraMotion: req.cameraMotion || "ken_burns_zoom_in",
        visualTreatment: req.visualTreatment || "Cinematic grade with subtle vignette",
      };
    });

    const scenesWithImages = sceneRequirements.filter((r) => r.requiresImage).length;

    return {
      videoSubject: parsed.videoSubject || prompt,
      totalScenes: sceneRequirements.length,
      scenesWithImages,
      sceneRequirements,
      historicalAccuracyRequired: Boolean(parsed.historicalAccuracyRequired),
      summary: parsed.summary || `Visual asset plan with ${scenesWithImages} curated scenes for "${prompt}".`,
      rawExplanation: parsed.rawExplanation,
    };
  }

  /**
   * Deterministic asset planner that generates high-fidelity visual queries
   * based on prompt domain analysis when offline or when LLM output is incomplete.
   */
  public createDeterministicPlan(
    userPrompt: string,
    creativeBrief?: CreativeBrief,
    sceneCount: number = 5
  ): VisualAssetPlan {
    const promptLower = userPrompt.toLowerCase();
    const isHistorical =
      promptLower.includes("history") ||
      promptLower.includes("origin") ||
      promptLower.includes("18") ||
      promptLower.includes("19") ||
      promptLower.includes("century") ||
      promptLower.includes("evolution") ||
      promptLower.includes("invent");

    const isCocaCola = promptLower.includes("coca-cola") || promptLower.includes("coke");
    const isRolex = promptLower.includes("rolex") || promptLower.includes("watch");
    const isTech = promptLower.includes("tech") || promptLower.includes("software") || promptLower.includes("ai");
    const isNature = promptLower.includes("nature") || promptLower.includes("ocean") || promptLower.includes("tree");

    const sceneRequirements: SceneVisualRequirement[] = [];

    for (let i = 0; i < sceneCount; i++) {
      let subject = "";
      let imageType: ImageType = "lifestyle_photography";
      let preferredSource: ImageSourceProvider = "wikimedia";
      let searchQueries: string[] = [];
      let cameraMotion: SceneVisualRequirement["cameraMotion"] = "ken_burns_zoom_in";
      let visualTreatment = "High contrast cinematic grading";

      if (isCocaCola) {
        if (i === 0) {
          subject = "Classic Coca-Cola contour glass bottle";
          imageType = "product_shot";
          preferredSource = "wikimedia";
          searchQueries = ["Coca-Cola contour glass bottle", "vintage Coca-Cola bottle"];
          cameraMotion = "ken_burns_zoom_in";
          visualTreatment = "Deep ruby red backdrop with warm golden highlights";
        } else if (i === 1) {
          subject = "Late 19th century Atlanta pharmacy and street life";
          imageType = "historical_photograph";
          preferredSource = "wikimedia";
          searchQueries = ["Atlanta 1880s historical photograph", "19th century pharmacy soda fountain"];
          cameraMotion = "slow_pan_horizontal";
          visualTreatment = "Authentic sepia monochrome grading with soft vignette";
        } else if (i === 2) {
          subject = "Early vintage Coca-Cola print advertisements 1890s";
          imageType = "document_illustration";
          preferredSource = "wikimedia";
          searchQueries = ["Coca-Cola vintage advertisement 1890s", "Coca-Cola historical poster"];
          cameraMotion = "parallax_depth";
          visualTreatment = "Aged parchment paper texture with delicate edge shadow";
        } else if (i === 3) {
          subject = "People sharing cold refreshments and lifestyle celebration";
          imageType = "lifestyle_photography";
          preferredSource = "pexels";
          searchQueries = ["friends drinking soda summer lifestyle", "people sharing cold drink outdoor"];
          cameraMotion = "ken_burns_zoom_out";
          visualTreatment = "Sun-drenched golden hour warmth with natural lens flare";
        } else {
          subject = "Modern worldwide Coca-Cola celebration and iconic contour";
          imageType = "product_shot";
          preferredSource = "wikimedia";
          searchQueries = ["Coca-Cola iconic bottle modern", "Coca-Cola global red brand"];
          cameraMotion = "ken_burns_zoom_in";
          visualTreatment = "Polished cinematic studio rim lighting with crystal droplets";
        }
      } else if (isRolex) {
        if (i === 0) {
          subject = "Luxury luxury timepiece emerald bezel close-up";
          imageType = "product_shot";
          preferredSource = "wikimedia";
          searchQueries = ["luxury wristwatch close-up", "Rolex Submariner watch macro"];
          cameraMotion = "ken_burns_zoom_in";
          visualTreatment = "Deep obsidian black with rich emerald green accents";
        } else if (i === 1) {
          subject = "Swiss horology master watchmaker precision mechanics";
          imageType = "historical_photograph";
          preferredSource = "wikimedia";
          searchQueries = ["watchmaker precision tools", "mechanical watch escapement gears"];
          cameraMotion = "slow_pan_horizontal";
          visualTreatment = "Warm tungsten studio illumination";
        } else if (i === 2) {
          subject = "Deep sea marine diving exploration oyster casing";
          imageType = "landscape";
          preferredSource = "pexels";
          searchQueries = ["underwater deep sea ocean blue", "scuba diver ocean exploration"];
          cameraMotion = "parallax_depth";
          visualTreatment = "Atmospheric deep navy ocean depths with glowing bioluminescence";
        } else {
          subject = "Prestigious luxury gold craftsmanship and crown seal";
          imageType = "product_shot";
          preferredSource = "wikimedia";
          searchQueries = ["gold luxury watch dial", "chronometer precision watch"];
          cameraMotion = "ken_burns_zoom_in";
          visualTreatment = "Soft golden rim glow with subtle reflective floor";
        }
      } else if (isTech) {
        subject = `Modern technological innovation: ${userPrompt.slice(0, 30)}`;
        imageType = "lifestyle_photography";
        preferredSource = "pexels";
        searchQueries = ["modern data center servers tech", "developer coding software laptop", "artificial intelligence tech"];
        cameraMotion = i % 2 === 0 ? "ken_burns_zoom_in" : "slow_pan_horizontal";
        visualTreatment = "Dark mode cyber aesthetic with electric cyan glow";
      } else if (isNature) {
        subject = `Lush nature landscape: ${userPrompt.slice(0, 30)}`;
        imageType = "landscape";
        preferredSource = "unsplash";
        searchQueries = ["majestic emerald forest trees", "ocean waves breaking sunrise", "organic green plant growth"];
        cameraMotion = "ken_burns_zoom_in";
        visualTreatment = "Natural atmospheric daylight with crisp environmental depth";
      } else {
        // Universal cinematic subject
        subject = `Scene ${i + 1}: ${userPrompt.slice(0, 40)}`;
        imageType = isHistorical ? "historical_photograph" : "lifestyle_photography";
        preferredSource = isHistorical ? "wikimedia" : "pexels";
        searchQueries = [userPrompt.slice(0, 45), `${userPrompt.slice(0, 30)} photography`];
        cameraMotion = i % 2 === 0 ? "ken_burns_zoom_in" : "slow_pan_horizontal";
        visualTreatment = "Cinematic 2.39:1 widescreen lighting with subtle vignette";
      }

      sceneRequirements.push({
        sceneIndex: i,
        sceneName: `Scene ${i + 1}`,
        purpose: `Act ${i + 1} Visual Storytelling`,
        visualSubject: subject,
        imageType,
        requiresImage: true,
        preferredSource,
        searchQueries,
        compositionStyle: i === 0 ? "fullscreen_hero" : i === 2 ? "split_screen" : "fullscreen_hero",
        orientation: "landscape",
        historicalAccuracyRequired: isHistorical,
        cameraMotion,
        visualTreatment,
      });
    }

    return {
      videoSubject: userPrompt,
      totalScenes: sceneCount,
      scenesWithImages: sceneCount,
      sceneRequirements,
      historicalAccuracyRequired: isHistorical,
      summary: `Tailored ${sceneCount}-scene visual plan for "${userPrompt}".`,
    };
  }
}

import { AIProvider } from "../ai/provider.js";
import { MusicBrief, TimelineSyncCue, NarrationDialogueRequirements } from "./types.js";

export interface VideoAnalysisContext {
  prompt: string;
  durationSeconds: number;
  creativeBrief?: any;
  compositionPlan?: any;
  storyboard?: any;
  productionPlan?: any;
  scenes?: Array<{
    id?: string;
    name?: string;
    title?: string;
    description?: string;
    duration?: number;
    visualContent?: string;
    animationIntensity?: "low" | "medium" | "high";
    speechText?: string;
  }>;
  hasPresenter?: boolean;
  presenterDurationSeconds?: number;
  presenterScript?: string;
  voiceoverText?: string;
  voiceoverEnabled?: boolean;
}

export class MusicIntelligence {
  private aiProvider: AIProvider;

  constructor(aiProvider?: AIProvider) {
    this.aiProvider = aiProvider || new AIProvider();
  }

  /**
   * Generates a comprehensive MusicBrief by deeply analyzing the video request,
   * creative brief, scene progression, narrative pacing, and narration requirements.
   */
  public async generateMusicBrief(context: VideoAnalysisContext): Promise<MusicBrief> {
    const promptText = (context.prompt || "").trim();
    const duration = Math.max(3, Math.round(context.durationSeconds || 15));
    const title = context.creativeBrief?.title || context.productionPlan?.creativeBrief?.title || "AI Video Production";
    const subject = context.creativeBrief?.subject || context.productionPlan?.creativeBrief?.subject || promptText.slice(0, 80);
    const category = context.creativeBrief?.category || context.creativeBrief?.videoType || this.inferCategory(promptText);

    // Build scene narrative summary
    const scenes = this.extractScenes(context);
    const sceneDescriptions = scenes
      .map((s, i) => `Scene ${i + 1} (${s.duration}s): "${s.title || s.name || 'Visual Card'}" - ${s.description || s.visualContent || ''}`)
      .join("\n");

    const hasSpeech = Boolean(
      context.hasPresenter ||
      context.presenterScript ||
      context.voiceoverText ||
      context.voiceoverEnabled ||
      scenes.some((s) => s.speechText && s.speechText.trim().length > 0)
    );

    const speechScript = context.presenterScript || context.voiceoverText || scenes.map((s) => s.speechText).filter(Boolean).join(" ");

    const systemPrompt = `You are an elite Hollywood music supervisor and cinematic soundtrack director.
Your mission is to analyze a video production plan and output a structured, authoritative JSON Music Brief.
The music brief must reflect the video's subject, emotional arc, visual rhythm, scene transitions, and narrative pacing.
You MUST output ONLY valid JSON matching the exact schema below, with no markdown code fences, no extra text.`;

    const userPrompt = `VIDEO PRODUCTION DETAILS:
- Title: ${title}
- Subject: ${subject}
- Inferred Category: ${category}
- Target Duration: ${duration} seconds
- Has Speech/Narration: ${hasSpeech ? "YES" : "NO"}
${hasSpeech ? `- Speech/Script: "${speechScript.slice(0, 300)}"` : ""}

SCENE PROGRESSION & PACING:
${sceneDescriptions || "- Full motion kinetic design sequence"}

USER'S ORIGINAL REQUEST:
"${promptText}"

Generate a comprehensive Music Brief with the following JSON structure:
{
  "videoTitle": "${title}",
  "videoSubject": "${subject}",
  "videoCategory": "${category}",
  "intendedAudience": "<target audience>",
  "emotionalTone": ["<emotion1>", "<emotion2>", "<emotion3>"],
  "energyLevel": "serene" | "low" | "medium" | "high" | "building" | "epic",
  "desiredMusicalAtmosphere": "<detailed musical description>",
  "musicGenre": "cinematic-orchestral" | "tech-electronic" | "corporate-acoustic" | "lofi-chill" | "ambient-nature" | "epic-trailer" | "minimal-synth" | "modern-commercial",
  "instrumentPreferences": ["<instrument1>", "<instrument2>", "<instrument3>"],
  "tempoBpmRange": { "min": <number>, "max": <number>, "target": <number> },
  "cinematicIntensity": "subtle" | "moderate" | "intense" | "epic",
  "vocalPreference": "instrumental_only" | "subtle_textures" | "vocals_allowed",
  "musicDurationSeconds": ${duration},
  "timelineSyncCues": [
    { "timestampSeconds": 0, "event": "intro_reveal", "targetIntensity": "low", "description": "Atmospheric intro opening" },
    { "timestampSeconds": ${Math.round(duration * 0.5)}, "event": "climax", "targetIntensity": "high", "description": "Core product or narrative reveal" },
    { "timestampSeconds": ${Math.max(1, duration - 2)}, "event": "logo_outro", "targetIntensity": "medium", "description": "Final branding resolution" }
  ],
  "majorVisualReveals": ["<key reveal 1>", "<key reveal 2>"],
  "narrationRequirements": {
    "hasSpeech": ${hasSpeech},
    "duckingRequired": ${hasSpeech},
    "duckingAttenuationDb": -14,
    "duckingAttackMs": 80,
    "duckingReleaseMs": 450
  },
  "endingStyle": "fade_out" | "climactic_hit" | "peaceful_resolution" | "looping",
  "licensingRequirements": "royalty_free_commercial_safe",
  "rawExplanation": "<brief explanation of why this musical profile elevates the video>"
}`;

    try {
      const llmPromise = this.aiProvider.complete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        0.2
      );
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("LLM brief generation request timeout (3500ms)")), 3500)
      );
      const response = await Promise.race([llmPromise, timeoutPromise]);

      const cleaned = response
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      return this.validateAndNormalizeBrief(parsed, context, duration);
    } catch (err: any) {
      console.warn(`[MusicIntelligence] LLM brief generation note (${err.message}). Using authoritative semantic intelligence synthesis.`);
      return this.synthesizeDeterministicBrief(context, duration, hasSpeech);
    }
  }

  private validateAndNormalizeBrief(raw: any, context: VideoAnalysisContext, duration: number): MusicBrief {
    return {
      videoTitle: raw.videoTitle || context.creativeBrief?.title || "Video Production",
      videoSubject: raw.videoSubject || context.prompt.slice(0, 60),
      videoCategory: raw.videoCategory || "commercial",
      intendedAudience: raw.intendedAudience || "General Audience",
      emotionalTone: Array.isArray(raw.emotionalTone) && raw.emotionalTone.length > 0 ? raw.emotionalTone : ["cinematic", "polished", "engaging"],
      energyLevel: ["serene", "low", "medium", "high", "building", "epic"].includes(raw.energyLevel) ? raw.energyLevel : "building",
      desiredMusicalAtmosphere: raw.desiredMusicalAtmosphere || "Atmospheric cinematic score with modern tonal clarity",
      musicGenre: raw.musicGenre || "cinematic-orchestral",
      instrumentPreferences: Array.isArray(raw.instrumentPreferences) ? raw.instrumentPreferences : ["strings", "piano", "analog pads"],
      tempoBpmRange: {
        min: Number(raw.tempoBpmRange?.min) || 75,
        max: Number(raw.tempoBpmRange?.max) || 120,
        target: Number(raw.tempoBpmRange?.target) || 95,
      },
      cinematicIntensity: raw.cinematicIntensity || "moderate",
      vocalPreference: raw.vocalPreference || "instrumental_only",
      musicDurationSeconds: duration,
      timelineSyncCues: Array.isArray(raw.timelineSyncCues) && raw.timelineSyncCues.length > 0 ? raw.timelineSyncCues : this.generateDefaultCues(duration),
      majorVisualReveals: Array.isArray(raw.majorVisualReveals) ? raw.majorVisualReveals : ["Opening Scene", "Closing Call-to-Action"],
      narrationRequirements: {
        hasSpeech: Boolean(raw.narrationRequirements?.hasSpeech),
        duckingRequired: Boolean(raw.narrationRequirements?.duckingRequired),
        duckingAttenuationDb: Number(raw.narrationRequirements?.duckingAttenuationDb) || -14,
        duckingAttackMs: Number(raw.narrationRequirements?.duckingAttackMs) || 80,
        duckingReleaseMs: Number(raw.narrationRequirements?.duckingReleaseMs) || 450,
      },
      endingStyle: raw.endingStyle || "fade_out",
      licensingRequirements: "royalty_free_commercial_safe",
      rawExplanation: raw.rawExplanation || "Selected to match video pacing and narrative arc.",
    };
  }

  private synthesizeDeterministicBrief(context: VideoAnalysisContext, duration: number, hasSpeech: boolean): MusicBrief {
    const p = (context.prompt || "").toLowerCase();
    const isRolexOrLuxury = /\b(rolex|oyster|perpetual|luxury|watch|diamond|horology|gold|jewelry|prestige|mercedes|bentley)\b/i.test(p);
    const isCorporateOrPitch = /\b(business|corporate|pitch|investor|investors|finance|financial|quarterly|growth|revenue|deck|startup|presentation|report|board)\b/i.test(p);
    const isOceanOrNature = /\b(ocean|sea|waves?|water|marine|nature|forest|trees?|ecology|ecological|organic|river|coastal|coral|underwater)\b/i.test(p);
    const isTechOrCyber = /\b(tech|technology|\bai\b|cyber|software|code|coding|data|crypto|saas|algorithm|developer|cloud|fintech|future)\b/i.test(p);
    const isTrailerOrEpic = /\b(trailer|cinematic|epic|battle|action|dramatic|intense|teaser|blockbuster|hero)\b/i.test(p);
    const isLoFiOrChill = /\b(chill|lofi|lo-fi|relax|cozy|vlog|lifestyle|coffee|study|minimalist|aesthetic)\b/i.test(p);

    let genre = "cinematic-orchestral";
    let emotionalTone = ["cinematic", "polished", "engaging"];
    let atmosphere = "Rich orchestral strings and warm brass progression tailored for high-end visual reveals";
    let instruments = ["strings", "piano", "subtle brass", "analog pads"];
    let energyLevel: MusicBrief["energyLevel"] = "building";
    let targetBpm = 92;

    if (isRolexOrLuxury) {
      genre = "cinematic-orchestral";
      emotionalTone = ["luxurious", "prestigious", "timeless", "majestic"];
      atmosphere = "Deep atmospheric cello and violin swells with warm orchestral precision, echoing Swiss luxury craftsmanship";
      instruments = ["cellos", "violins", "acoustic grand piano", "subtle orchestral brass"];
      energyLevel = "building";
      targetBpm = 90;
    } else if (isCorporateOrPitch) {
      genre = "corporate-acoustic";
      emotionalTone = ["confident", "inspiring", "professional", "optimistic"];
      atmosphere = "Clean acoustic piano chords and inspiring rhythmic momentum suited for investor presentations";
      instruments = ["acoustic piano", "clean acoustic guitar", "subtle percussion", "ambient pads"];
      energyLevel = "medium";
      targetBpm = 100;
    } else if (isOceanOrNature) {
      genre = "ambient-nature";
      emotionalTone = ["serene", "fluid", "atmospheric", "organic"];
      atmosphere = "Natural marine resonance, gentle rolling aquatic swells, and crystalline ambient frequencies";
      instruments = ["ambient synthesizers", "bowed strings", "oceanic soundscapes", "soft bells"];
      energyLevel = "serene";
      targetBpm = 75;
    } else if (isTechOrCyber) {
      genre = "tech-electronic";
      emotionalTone = ["futuristic", "innovative", "pulsing", "intelligent"];
      atmosphere = "Modern arpeggiated synthesizers, clean electronic sub-pulses, and forward-moving cyber cadence";
      instruments = ["modular synths", "electronic drums", "arpeggiators", "digital sub-bass"];
      energyLevel = "high";
      targetBpm = 115;
    } else if (isTrailerOrEpic) {
      genre = "epic-trailer";
      emotionalTone = ["dramatic", "powerful", "suspenseful", "climactic"];
      atmosphere = "Low brass stabs, thunderous cinematic taiko percussion, and soaring climactic string ostinatos";
      instruments = ["taiko drums", "french horns", "heavy strings", "hybrid trailer sub-hits"];
      energyLevel = "epic";
      targetBpm = 130;
    } else if (isLoFiOrChill) {
      genre = "lofi-chill";
      emotionalTone = ["relaxed", "chill", "creative", "smooth"];
      atmosphere = "Smooth jazz-infused electric piano, subtle vinyl crackle, and laid-back downtempo drum groove";
      instruments = ["Rhodes electric piano", "downtempo beats", "mellow bass", "vinyl texture"];
      energyLevel = "low";
      targetBpm = 82;
    }

    // Generate multiple targeted search queries derived from brief
    const rawQueries = [
      `${genre.replace(/-/g, " ")} ${emotionalTone.slice(0, 2).join(" ")} background instrumental`,
      `${context.prompt.slice(0, 40)} cinematic score`,
      `${emotionalTone[0] || "cinematic"} ${genre.replace(/-/g, " ")} music`,
      `${genre.replace(/-/g, " ")} instrumental commercial`,
    ];

    return {
      videoTitle: context.creativeBrief?.title || "Video Composition",
      videoSubject: p.slice(0, 60),
      videoCategory: this.inferCategory(p),
      intendedAudience: isRolexOrLuxury ? "Luxury Aficionados & High-Net-Worth Connoisseurs" : "Target Demographic",
      emotionalTone,
      energyLevel,
      desiredMusicalAtmosphere: atmosphere,
      musicGenre: genre,
      instrumentPreferences: instruments,
      tempoBpmRange: { min: targetBpm - 15, max: targetBpm + 15, target: targetBpm },
      cinematicIntensity: isTrailerOrEpic ? "epic" : isRolexOrLuxury ? "moderate" : "moderate",
      vocalPreference: "instrumental_only",
      musicDurationSeconds: duration,
      timelineSyncCues: this.generateDefaultCues(duration),
      majorVisualReveals: ["Hero Intro", "Key Feature", "Final CTA"],
      narrationRequirements: {
        hasSpeech,
        duckingRequired: hasSpeech,
        duckingAttenuationDb: -14,
        duckingAttackMs: 80,
        duckingReleaseMs: 450,
      },
      endingStyle: "fade_out",
      licensingRequirements: "royalty_free_commercial_safe",
      rawExplanation: `Heuristically tailored ${genre} score designed for ${atmosphere}`,
      searchQueries: rawQueries,
      avoid: ["distracting vocals", "inappropriate mood", "abrupt ending", "unlicensed audio"],
    };
  }

  private inferCategory(prompt: string): string {
    const p = prompt.toLowerCase();
    if (/\b(pitch|deck|presentation|investor|investors|finance|financial|quarterly|report|revenue|sales|business|corporate)\b/i.test(p)) return "corporate_pitch";
    if (/\b(rolex|watch|luxury|ad|commercial|promo)\b/i.test(p)) return "brand_advertisement";
    if (/\b(trailer|teaser|movie)\b/i.test(p)) return "cinematic_trailer";
    if (/\b(saas|app|software|dashboard|tool)\b/i.test(p)) return "product_demo";
    if (/\b(explain|how to|learn|tutorial)\b/i.test(p)) return "educational";
    return "brand_advertisement";
  }

  private extractScenes(context: VideoAnalysisContext): Array<{ duration: number; title?: string; name?: string; description?: string; visualContent?: string; speechText?: string }> {
    if (Array.isArray(context.scenes) && context.scenes.length > 0) {
      return context.scenes.map((s) => ({
        duration: s.duration || 5,
        title: s.title || s.name,
        description: s.description || s.visualContent,
        speechText: s.speechText,
      }));
    }
    if (context.productionPlan?.scenes && Array.isArray(context.productionPlan.scenes)) {
      return context.productionPlan.scenes.map((s: any) => ({
        duration: s.duration || 5,
        title: s.title || s.name,
        description: s.visualGoal || s.description,
        speechText: s.voiceoverScript || s.presenterScript,
      }));
    }
    return [];
  }

  private generateDefaultCues(duration: number): TimelineSyncCue[] {
    return [
      { timestampSeconds: 0, event: "intro_reveal", targetIntensity: "low", description: "Video opening" },
      { timestampSeconds: Math.round(duration * 0.4), event: "feature_card", targetIntensity: "medium", description: "Core feature reveal" },
      { timestampSeconds: Math.round(duration * 0.75), event: "climax", targetIntensity: "high", description: "Climactic visual peak" },
      { timestampSeconds: Math.max(0, duration - 2), event: "logo_outro", targetIntensity: "medium", description: "Outro and brand resolution" },
    ];
  }
}

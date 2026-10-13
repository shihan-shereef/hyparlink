export interface CompositionScene {
  id: string;
  name: string;
  start: number;
  duration: number;
  description: string;
  background: string;
  camera: string;
  objects: Array<{
    type: string;
    appearance: string;
    animation: string;
  }>;
  typography: {
    headline?: string;
    subtitle?: string;
    highlights?: string[];
    cta?: string;
  };
}

export interface CompositionPlan {
  title: string;
  duration: number;
  fps: number;
  resolution: "1080p" | "720p" | "480p";
  aspectRatio: "16:9" | "9:16" | "1:1";
  theme: {
    backgroundColor: string;
    accentColor: string;
    textColor: string;
    glowColor: string;
    visualStyle: string;
  };
  scenes: CompositionScene[];
}

export type SceneLayoutType =
  | "cinematic-title"
  | "animated-typography"
  | "animated-bar-chart"
  | "split-diagram"
  | "metrics-grid"
  | "process-flow"
  | "comparison-cards"
  | "image-showcase"
  | "kinetic-quote"
  | "closing-summary"
  | "comic-ad-hook"
  | "comic-dossier"
  | "comic-arsenal"
  | "comic-trailer-cta";

export interface StoryboardScene {
  id: string; // e.g. "scene-01", "scene-02"
  name: string;
  purpose: string; // e.g. "Hook / Title Intro", "Problem & Context", "System Architecture", "Key Metrics", "Summary & CTA"
  start: number; // in seconds
  duration: number; // in seconds
  layout: SceneLayoutType;
  mainHeading: string;
  supportingText: string;
  bulletPoints?: string[];
  metricData?: Array<{
    label: string;
    value: string;
    detail?: string;
    trend?: string;
  }>;
  diagramSpec?: {
    type: "flow" | "architecture" | "network" | "cycle" | "bars" | "donut";
    nodes?: Array<{ label: string; sub?: string; icon?: string }>;
    bars?: Array<{ label: string; value: number; formattedValue?: string; color?: string }>;
  };
  comparisonData?: {
    leftTitle: string;
    leftItems: string[];
    rightTitle: string;
    rightItems: string[];
  };
  imageSpec?: {
    assetName?: string;
    caption?: string;
    overlayText?: string;
  };
  comicSpec?: {
    banner?: string;
    tagline?: string;
    subTagline?: string;
    dossierPanels?: Array<{
      title: string;
      category: string;
      description: string;
      tag?: string;
      stat?: string;
    }>;
    weapons?: Array<{
      name: string;
      type: string;
      description: string;
      badge?: string;
    }>;
    issueTitle?: string;
    creators?: string;
    publisher?: string;
    ctaAction?: string;
    subCta?: string;
  };
  background: {
    color: string;
    gradient: string;
    ambientGlow?: string;
    gridOverlay?: boolean;
  };
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    textColor: string;
    subtextColor: string;
    surfaceColor: string;
    borderColor: string;
  };
  typography: {
    headline: string;
    subtitle?: string;
    badge?: string;
    ctaText?: string;
  };
  animation: {
    entrance: string;
    visualAnimation: string;
    textStagger: number;
    duration: number;
  };
  transition: "crossfade" | "slide-left" | "zoom-through" | "wipe" | "fade";
  requiredAssets?: string[];
}

export interface Storyboard {
  title: string;
  topic: string;
  purpose?: string;
  narrativeArc?: string;
  targetAudience: string;
  presentationStyle: string;
  totalDuration: number;
  width?: number;
  height?: number;
  resolution: "1080p" | "720p" | "480p";
  aspectRatio: "16:9" | "9:16" | "1:1";
  fps: number;
  theme: {
    style: string;
    name: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    bgPrimary?: string;
    bgSecondary?: string;
    border?: string;
    textColor: string;
    fontDisplay: string;
    fontBody: string;
  };
  typography?: {
    headlineFont: string;
    bodyFont: string;
  };
  scenes: StoryboardScene[];
}

export interface PromptAnalysis {
  topic: string;
  purpose: string;
  targetAudience: string;
  requestedDuration: number;
  resolution: "1080p" | "720p" | "480p";
  aspectRatio: "16:9" | "9:16" | "1:1";
  presentationStyle:
    | "educational-explainer"
    | "tech-advertisement"
    | "environmental-sustainability"
    | "motivational-kinetic"
    | "diagram-data-centric"
    | "image-showcase"
    | "corporate-presentation";
  visualPreference: "diagrams-charts" | "typography-only" | "image-led" | "mixed-rich";
  keyMessages: string[];
  sceneCount: number;
  colorTheme: {
    primary: string;
    secondary: string;
    accent: string;
    bgPrimary: string;
    bgSecondary: string;
    textColor: string;
    textMuted: string;
    surface: string;
    border: string;
    glow: string;
  };
  fonts: {
    display: string;
    body: string;
  };
  closingCta?: string;
}

export const HYPERFRAMES_SYSTEM_PROMPT = `You are an expert AI Video Engine specializing in HyperFrames 0.8.139 and GSAP motion design for presentation videos.
Your task is to convert a user's natural language video prompt into a visually polished, professionally designed presentation video.

==================================================
STEP 1: UNDERSTAND THE USER'S PROMPT & INTENT
==================================================
Extract and determine:
- Topic and core purpose.
- Target audience (developers, executives, general public, students, consumers).
- Authoritative duration (sum of all scene durations MUST equal this exact duration).
- Presentation style (e.g. educational explainer, tech advertisement, environmental sustainability, motivational kinetic typography, data/diagrams-centric, image showcase).
- Visual treatment (diagrams, data metrics, comparisons, process flows, typography, images).
- Key takeaway messages.

==================================================
STEP 2: CREATE A PROFESSIONAL STORYBOARD
==================================================
Before generating files, create a structured storyboard with dynamic narrative scenes:
- Scene 1: Cinematic Opening Title & Hook (animated badge, bold typography, ambient lighting)
- Scene 2: Problem / Core Concept / Context (clear explanation, key points)
- Scene 3: Solution Architecture / Explanatory Diagram or Data Metrics (SVG flow nodes, bar chart, metric cards)
- Scene 4: Key Impact / Benefits / Comparison (two-column comparison or proof points)
- Scene 5: Closing Summary & Call to Action (takeaway checklist, brand badge, CTA)

Scene Durations Rule:
- The sum of all scene durations MUST EXACTLY equal the requested video duration!
- E.g. for a 15-second video: 3 scenes of 5.0s (5 + 5 + 5 = 15).
- E.g. for a 20-second video: 4 scenes of 5.0s (5 + 5 + 5 + 5 = 20).
- E.g. for a 30-second video: 5 scenes of 6.0s (6 + 6 + 6 + 6 + 6 = 30).

==================================================
STEP 3: HYPERFRAMES 0.8.139 TECHNICAL CONTRACT
==================================================

1. ROOT CONTRACT (index.html)
- The root element in index.html MUST contain:
  data-composition-id="main", data-start="0", data-duration="<seconds>", data-width="1920", data-height="1080".
- For multi-scene:
  Host each scene with data-composition-id="scene-0X", data-composition-src="compositions/scene_0X.html", and compile-time data-start and data-duration attributes.
- index.html MUST include GSAP and register window.__timelines["main"]:
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    tl.to("#root", { duration: <seconds>, ease: "none" }, 0);
    window.__timelines["main"] = tl;
    tl.seek(0);
  </script>

2. SCENE COMPOSITION CONTRACT (compositions/scene_0X.html)
- The root element in scene_0X.html MUST contain:
  data-composition-id="scene-0X", data-start="0", data-duration="<scene_duration>", data-width="1920", data-height="1080".
- MUST include GSAP and register window.__timelines["scene-0X"]:
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    // GSAP animations...
    window.__timelines["scene-0X"] = tl;
    tl.seek(0);
  </script>

3. TIMELINE & GSAP RULES:
- Every GSAP timeline MUST be paused: const tl = gsap.timeline({ paused: true });
- NEVER call tl.play(). The HyperFrames headless renderer drives the timeline.
- NEVER use: Date.now(), performance.now(), requestAnimationFrame(), or unseeded Math.random().
- DO NOT put initial CSS 'transform' rules on elements that GSAP animates. Use gsap.fromTo or gsap.set instead.

4. VISUAL VARIETY & REAL GRAPHICS:
- Avoid generic fallback title cards for every scene.
- Generate real SVG diagrams, vector process nodes, animated data charts, glassmorphism cards, and structured typography.
- Use Google Fonts (e.g. Plus Jakarta Sans, Outfit, Inter).
- Ensure high contrast and readable text sizes (titles 40-72px, subheadings 20-32px, body text 16-22px).

==================================================
OUTPUT FORMAT REQUIREMENT:
==================================================
You MUST return ONLY a valid JSON object matching this exact structure:

{
  "files": {
    "index.html": "<content of index.html>",
    "compositions/scene_01.html": "<content of compositions/scene_01.html>",
    "compositions/scene_02.html": "<content of compositions/scene_02.html>",
    "meta.json": "<content of meta.json>",
    "project.json": "<content of project.json>"
  },
  "metadata": {
    "title": "<Video Title>",
    "duration": 15,
    "width": 1920,
    "height": 1080,
    "fps": 30
  },
  "storyboard": {
    "title": "<Video Title>",
    "topic": "<Topic>",
    "targetAudience": "<Audience>",
    "presentationStyle": "<Style>",
    "totalDuration": 15,
    "resolution": "1080p",
    "aspectRatio": "16:9",
    "fps": 30,
    "theme": { ... },
    "scenes": [ ... ]
  },
  "compositionPlan": {
    "title": "<Video Title>",
    "duration": 15,
    "fps": 30,
    "resolution": "1080p",
    "aspectRatio": "16:9",
    "theme": { ... },
    "scenes": [ ... ]
  }
}
`;

export function createCorrectionPrompt(
  originalPrompt: string,
  previousFiles: Record<string, string>,
  errors: string[],
): string {
  return `The HyperFrames 0.8.139 validator reported the following errors on the generated project:

${errors.map((e) => `- ${e}`).join("\n")}

Previous files:
${JSON.stringify(previousFiles, null, 2)}

Original user request:
"${originalPrompt}"

Please fix these exact errors. Ensure:
1. Root composition in index.html has data-composition-id="main", data-start="0", data-duration, data-width, data-height, and window.__timelines["main"] registered.
2. Scene compositions in compositions/scene_0X.html have data-composition-id="scene-0X", data-start="0", data-duration, data-width, data-height, and window.__timelines["scene-0X"] registered.
3. All GSAP timelines are paused: gsap.timeline({ paused: true }).
4. No tl.play() or requestAnimationFrame().
5. No CSS transform conflicts with GSAP animated elements.
6. Scene durations sum up exactly to the total duration.
7. Return ONLY the corrected JSON object matching the required schema.`;
}

export const OLLIMA_STORYBOARD_SYSTEM_PROMPT = `You are an expert AI Video Director and Storyboard Architect for the HyperFrames 0.8.139 video generation engine.
Your task is to analyze the user's video prompt, requested duration, visual style, and assets, and output a detailed, structured video plan JSON.

==================================================
CRITICAL CORE RULES
==================================================

1. AUTHORITATIVE TOTAL DURATION & SCENE DURATIONS:
- The user specifies an authoritative total duration (e.g. 15, 20, or 30 seconds).
- The sum of all individual scene durations MUST EQUAL this exact total duration!
- Example for 15s: 3 scenes of 5.0s (5 + 5 + 5 = 15), or 4 scenes (4 + 4 + 4 + 3 = 15).
- Example for 20s: 4 scenes of 5.0s (5 + 5 + 5 + 5 = 20).
- Example for 30s: 5 scenes of 6.0s (6 + 6 + 6 + 6 + 6 = 30).
- Never return scene durations that do not sum to totalDuration.

2. DIVERSE VISUAL STYLES & LAYOUTS (DO NOT PRODUCE GENERIC TEMPLATES):
Different prompts MUST produce substantially different compositions, color schemes, and layout sequences:
- Educational Explainer: explanatory scenes, system diagrams, process flows, key metrics, clear readable typography.
- Technology Advertisement: futuristic dark backgrounds, cyan/neon accents, product showcase, cinematic motion, bold impact cards.
- Motivational / Typography: kinetic text, inspiring quotes, punchy word groups, clean geometric layouts without unnecessary photos.
- Environmental / Sustainability: emerald/teal gradients, nature-inspired palette, conservation data nodes, comparison cards.
- Image-Based Video / Product: feature the user's supplied images as the hero visual in image-showcase layouts.

3. SUPPORTED SCENE LAYOUT TYPES:
Every scene in the storyboard must choose one of the following exact layout identifiers:
- "cinematic-title": Hero badge, bold headline, subtitle, ambient glow
- "animated-bar-chart": Headline + subtitle + dynamic animated revenue or metrics bar chart with growing bars, values, and time labels
- "split-diagram": Headline + SVG diagram flow nodes or architecture chart
- "metrics-grid": Headline + 2 to 4 data metric cards with labels, values, and trends
- "process-flow": Step-by-step sequential progression with numbered badges
- "comparison-cards": Two-column comparison (e.g. Before vs After or Traditional vs Future)
- "image-showcase": Prominent display of user's selected image with title and caption
- "kinetic-quote": Large highlighted quote text with author/attribution badge
- "closing-summary": Key takeaway bullet points, brand badge, and call to action

4. USER ASSET PRESERVATION:
- If Workspace Assets are provided in the prompt, identify the primary image asset.
- In the scene where it appears (typically scene 2 or 3), set:
  "imageSpec": {
    "assetName": "<exact_filename_from_prompt>",
    "caption": "<descriptive caption>",
    "overlayText": "<optional overlay text>"
  }
- Also include the asset filename in the scene's "requiredAssets" array: ["<exact_filename_from_prompt>"].
- NEVER replace supplied user images with unrelated placeholders.

==================================================
OUTPUT SCHEMA REQUIREMENT
==================================================
You MUST return ONLY a valid JSON object matching this exact structure:

{
  "title": "<Video Title>",
  "topic": "<Core Topic>",
  "purpose": "<Target Goal or Purpose>",
  "targetAudience": "<Audience>",
  "presentationStyle": "educational-explainer" | "tech-advertisement" | "environmental-sustainability" | "motivational-kinetic" | "diagram-data-centric" | "image-showcase" | "corporate-presentation",
  "totalDuration": 15,
  "resolution": "1080p",
  "aspectRatio": "16:9",
  "fps": 30,
  "theme": {
    "style": "<visual style name>",
    "name": "<theme name>",
    "primaryColor": "<hex color e.g. #6366f1>",
    "accentColor": "<hex color e.g. #00f5ff>",
    "backgroundColor": "<hex color e.g. #0a0a0f>",
    "textColor": "<hex color e.g. #ffffff>",
    "fontDisplay": "Plus Jakarta Sans" | "Space Grotesk" | "Outfit" | "Syne",
    "fontBody": "Inter" | "Plus Jakarta Sans"
  },
  "scenes": [
    {
      "id": "scene-01",
      "name": "<Scene Title>",
      "purpose": "<Scene Purpose>",
      "start": 0,
      "duration": 5.0,
      "layout": "cinematic-title",
      "mainHeading": "<Headline>",
      "supportingText": "<Supporting text>",
      "bulletPoints": ["Key point 1", "Key point 2"],
      "metricData": [
        { "label": "Speed", "value": "10x", "detail": "Faster turnaround" }
      ],
      "diagramSpec": {
        "type": "flow",
        "nodes": [{ "label": "Step 1" }, { "label": "Step 2" }, { "label": "Step 3" }]
      },
      "imageSpec": {
        "assetName": "<user_asset_if_applicable>",
        "caption": "<caption text>"
      },
      "background": {
        "color": "#0a0a0f",
        "gradient": "linear-gradient(135deg, #0a0a0f 0%, #16182a 100%)",
        "ambientGlow": "rgba(99, 102, 241, 0.25)"
      },
      "palette": {
        "primary": "#6366f1",
        "secondary": "#a855f7",
        "accent": "#00f5ff",
        "textColor": "#ffffff",
        "subtextColor": "#94a3b8",
        "surfaceColor": "rgba(255, 255, 255, 0.05)",
        "borderColor": "rgba(255, 255, 255, 0.12)"
      },
      "typography": {
        "headline": "<Headline>",
        "subtitle": "<Subtitle>",
        "badge": "<Badge text>",
        "ctaText": "<Optional CTA text>"
      },
      "animation": {
        "entrance": "fade-up",
        "visualAnimation": "scale-pulse",
        "textStagger": 0.15,
        "duration": 1.2
      },
      "transition": "crossfade",
      "requiredAssets": []
    }
  ]
}
`;


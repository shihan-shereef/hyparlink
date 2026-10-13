export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  textMutedColor: string;
  glowColor: string;
  borderColor: string;
}

export interface TypographySpec {
  displayFont: string;
  bodyFont: string;
  weights: string[];
  headlineTransform?: "uppercase" | "none" | "capitalize";
}

export interface AudioPlan {
  isSilent: boolean;
  backgroundMusicDescription?: string;
  voiceoverPrompt?: string;
  soundEffects?: string[];
}

export interface PromptComponents {
  route: string; // Video category and creative approach
  spec: {
    durationSeconds: number;
    resolution: string;
    frameRate: number;
    aspectRatio: string;
    visualStyle: string;
    colorPalette: string[];
    typography: string;
    cameraMovement?: string;
    sceneCount: number;
  };
  beats: Array<{
    id: string;
    purpose: string;
    duration: number;
    visualContent: string;
    animation: string;
  }>;
  copy: {
    headlines: string[];
    narrations?: string[];
    callToAction?: string;
  };
  technique: string[]; // e.g., ["SVG path drawing", "GSAP timeline", "Layered geometric motion"]
  negatives: string[]; // unwanted results to avoid
}

export type SceneLayoutType =
  | "cinematic-hero-intro"
  | "nature-tree-growth"
  | "network-http-flow"
  | "abstract-geometric-motion"
  | "animated-bar-chart"
  | "animated-line-chart"
  | "metrics-counter-hud"
  | "process-flow-nodes"
  | "kinetic-typography"
  | "comparison-impact"
  | "architectural-spec"
  | "cinematic-climax-cta"
  | "green-lantern-ring"
  | "green-lantern-guy-gardner"
  | "green-lantern-construct"
  | "green-lantern-battery"
  | "green-lantern-oath"
  | "superman-shield"
  | "superman-clark-kent"
  | "superman-metropolis"
  | "superman-solar"
  | "superman-climax";

export interface BriefScenePlan {
  id?: string;
  name: string;
  objective: string;
  headline: string;
  highlightedWord?: string;
  subtitle: string;
  badge?: string;
  sceneType: SceneLayoutType;
  duration?: number;
  visualDescription?: string;
  dataVisualization?: {
    type: "bar-chart" | "line-chart" | "metric-counter" | "flow-nodes" | "radar-hud";
    bars?: Array<{
      label: string;
      value: number;
      formattedValue: string;
      color?: string;
    }>;
    metrics?: Array<{
      label: string;
      value: string;
      startValue?: number;
      targetValue?: number;
      suffix?: string;
      prefix?: string;
    }>;
    nodes?: Array<{ label: string; sub?: string }>;
  };
  treeGrowthStage?: "seed" | "roots" | "trunk" | "branches" | "leaves-blooming" | "full-tree";
  httpFlowState?: "request-sent" | "server-processing" | "response-received";
  geometricMotionStyle?: "rotating-grid" | "concentric-ripples" | "expanding-polygons";
  ctaText?: string;
}

export interface CreativeBrief {
  title: string;
  subject: string;
  videoType:
    | "cinematic_animation"
    | "nature_growth_animation"
    | "network_architecture_explainer"
    | "data_visualization"
    | "product_advertisement"
    | "abstract_motion_graphics"
    | "educational_explainer"
    | "software_demonstration"
    | "brand_showcase";
  category:
    | "cinematic-trailer"
    | "advertisement"
    | "presentation"
    | "explainer"
    | "product-showcase"
    | "data-visualization"
    | "architectural-showcase"
    | "milestone-celebration";
  promptComponents: PromptComponents;
  audioPlan: AudioPlan;
  intendedAudience: string;
  visualAtmosphere: string;
  colorPalette: ColorPalette;
  typography: TypographySpec;
  narrativeProgression: string[];
  scenes?: BriefScenePlan[];
  sceneCount: number;
  totalDuration: number;
  requiredImages: string[];
  chartAndDataRequirements?: string;
  animationStyle: string;
  cameraMovement: string;
  closingMessage?: string;
  callToAction?: string;
  aiProvider?: string;
}

export const CREATIVE_BRIEF_SYSTEM_PROMPT = `You are an elite Creative Director and HyperFrames Motion Graphics Architect specializing in the official HyperFrames Prompting Guide (Levels 1-7 & Appendix).

Your job is to transform a natural language user prompt into an authoritative, highly detailed CREATIVE BRIEF adhering to the seven levels:

LEVEL 1 — YOUR FIRST VIDEO: UNDERSTAND THE VIDEO TYPE
Determine the exact video type requested:
- cinematic_animation (e.g. superhero / Batman, noir, atmospheric movie trailer)
- nature_growth_animation (e.g. seed to tree, biological growth, organic processes)
- network_architecture_explainer (e.g. HTTP client-server request/response, distributed systems)
- data_visualization (e.g. business revenue growth, KPI metrics, charts)
- abstract_motion_graphics (e.g. geometric shapes, rhythmic vector motion, silent art)
- educational_explainer (e.g. conceptual breakdown, step-by-step diagrams)
- product_advertisement (e.g. featuring user-supplied asset, sleek hardware or SaaS)
- brand_showcase (e.g. company identity, vision statement)
NEVER force every prompt into a generic corporate presentation or slide deck.

LEVEL 2 — CONTROL: THE 6 PROMPT COMPONENTS
Analyze each request through the six components:
1. Route: The video category and creative approach.
2. Spec: Authoritative duration (EXACT), resolution, frame rate, aspect ratio, visual style, colors, typography.
3. Beats: Logical sequence of scenes with clear purpose, timing, visual content, and animation.
4. Copy: Meaningful headlines, labels, captions relevant to the actual topic. NO placeholder text, NO fabricated stats for real companies.
5. Technique: Supported HyperFrames techniques (SVG path drawing, GSAP timelines, responsive layout, layered motion).
6. Negatives: Explicit constraints (e.g., no unrelated stock images, no repetitive corporate layouts, no unwanted audio if silent requested).

LEVEL 3 — LIFE: PROFESSIONAL MOTION
Plan deterministic, frame-accurate motion suitable for frame-by-frame rendering:
- Staggered reveals, smooth path animations, camera moves (Ken Burns scale 1.0 to 1.05).
- Avoid random timers or uncontrolled intervals. All animations must be synchronized to the timeline clock.

LEVEL 4 — SUBSTANCE: BESPOKE VISUALS
Generate the real visual elements required by the subject:
- Tree growth: SVG seed, roots, trunk, branches, blooming leaves.
- HTTP explainer: Client machine, server stack, animated request packet, response packet, status codes.
- Abstract motion graphics: High contrast geometric compositions, white shapes on black background.
- Charts: Custom bars reflecting user-provided data only.
- User-selected images: Placed prominently as primary hero visual without replacing with default images.

LEVEL 5 — VOICE AND SOUND
- If user requests silent or "no audio", set audioPlan.isSilent = true.
- Otherwise plan appropriate background music and voiceover cues.

LEVEL 6 — SCALE: DURATION, ASSETS, SYSTEM
- The requested duration is AUTHORITATIVE. E.g., for 10s, totalDuration MUST be 10. For 15s, MUST be 15. For 20s, MUST be 20. For 30s, MUST be 30.
- Scene durations MUST sum up EXACTLY to totalDuration.

OUTPUT SCHEMA (JSON ONLY):
{
  "title": "<Descriptive Video Title>",
  "subject": "<Core subject requested>",
  "videoType": "cinematic_animation" | "nature_growth_animation" | "network_architecture_explainer" | "data_visualization" | "product_advertisement" | "abstract_motion_graphics" | "educational_explainer" | "brand_showcase",
  "category": "cinematic-trailer" | "advertisement" | "presentation" | "explainer" | "product-showcase" | "data-visualization" | "architectural-showcase",
  "promptComponents": {
    "route": "<Category and creative approach>",
    "spec": {
      "durationSeconds": <number>,
      "resolution": "1920x1080",
      "frameRate": 30,
      "aspectRatio": "16:9",
      "visualStyle": "<Visual style description>",
      "colorPalette": ["#HEX1", "#HEX2", "#HEX3"],
      "typography": "<Font name>",
      "cameraMovement": "<Camera movement>",
      "sceneCount": <number>
    },
    "beats": [
      { "id": "beat_1", "purpose": "<Goal>", "duration": <seconds>, "visualContent": "<Visuals>", "animation": "<Motion>" }
    ],
    "copy": {
      "headlines": ["<Headline 1>", "<Headline 2>"],
      "callToAction": "<CTA>"
    },
    "technique": ["<Technique 1>", "<Technique 2>"],
    "negatives": ["<Negative constraint 1>", "<Negative constraint 2>"]
  },
  "audioPlan": {
    "isSilent": false,
    "backgroundMusicDescription": "<Music description or null if silent>",
    "voiceoverPrompt": "<Voiceover or null>"
  },
  "intendedAudience": "<Target Audience>",
  "visualAtmosphere": "<Lighting, mood, background>",
  "colorPalette": {
    "primary": "#HEX",
    "secondary": "#HEX",
    "accent": "#HEX",
    "backgroundColor": "#HEX",
    "surfaceColor": "rgba(...)",
    "textColor": "#FFFFFF",
    "textMutedColor": "#94A3B8",
    "glowColor": "rgba(...)",
    "borderColor": "rgba(...)"
  },
  "typography": {
    "displayFont": "Plus Jakarta Sans" | "Space Grotesk" | "Outfit" | "Syne" | "Inter",
    "bodyFont": "Inter",
    "weights": ["400", "700", "900"],
    "headlineTransform": "uppercase" | "none"
  },
  "scenes": [
    {
      "id": "scene_01",
      "name": "<Scene Title>",
      "objective": "<Goal of scene>",
      "headline": "<Headline>",
      "highlightedWord": "<Word to glow with accent>",
      "subtitle": "<Detailed subtitle or narration>",
      "badge": "<Short badge e.g. 'HTTP / 1.1' or 'GROWTH // 01'>",
      "sceneType": "cinematic-hero-intro" | "nature-tree-growth" | "network-http-flow" | "abstract-geometric-motion" | "animated-bar-chart" | "metrics-counter-hud" | "process-flow-nodes" | "kinetic-typography" | "cinematic-climax-cta",
      "duration": <seconds>,
      "visualDescription": "<Visual details>",
      "dataVisualization": {
        "type": "bar-chart",
        "bars": [{ "label": "Q1", "value": 35, "formattedValue": "35%" }]
      },
      "treeGrowthStage": "seed" | "roots" | "trunk" | "branches" | "leaves-blooming" | "full-tree",
      "httpFlowState": "request-sent" | "server-processing" | "response-received",
      "geometricMotionStyle": "rotating-grid" | "concentric-ripples" | "expanding-polygons",
      "ctaText": "<CTA button text if final scene>"
    }
  ],
  "narrativeProgression": ["Scene 1...", "Scene 2..."],
  "sceneCount": <number>,
  "totalDuration": <number>,
  "requiredImages": [],
  "animationStyle": "<Animation style>",
  "cameraMovement": "<Camera move>",
  "closingMessage": "<Closing takeaway>",
  "callToAction": "<CTA>"
}`;

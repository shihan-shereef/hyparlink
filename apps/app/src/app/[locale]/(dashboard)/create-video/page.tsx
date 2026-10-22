"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  Sparkles,
  Film,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Video,
  FolderKanban,
  FileImage,
  FileVideo,
  FileAudio,
  Upload,
  Globe,
  Plus,
  Code2,
  Terminal,
  FileCode,
  Presentation,
  FileText,
  Play,
  X,
  Check,
  Layers,
  Smartphone,
  Flame,
  ChevronRight,
  ChevronDown,
  Info,
  HelpCircle,
  Tv,
  ArrowUp,
  Sliders,
  Eye,
  EyeOff,
  Search,
  Cpu,
  Activity,
  CheckCheck,
  Trash2,
  ExternalLink,
  Bot,
  Mic,
  User,
  Key,
  ShieldCheck,
  Music,
  Volume2,
  VolumeX,
  Pause,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { DependencyStatusCard } from "@/components/dependency-status-card";
import { VideoProductionPlanStudio } from "@/components/video-production-plan-studio";
import { SurgicalSceneRevision } from "@/components/surgical-scene-revision";
import { READY_MADE_TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/templates-catalog";

interface InspirationItem {
  id: string;
  title: string;
  category: "Motion graphics" | "A-roll Cuts" | "Mobile Ads" | "Shaders";
  author: string;
  duration: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  prompt: string;
  description: string;
  accentColor: string;
  visualType:
    | "counter"
    | "chart"
    | "speaker"
    | "kinetic"
    | "shader"
    | "mobile"
    | "neural"
    | "eco";
}

const INSPIRATIONS: InspirationItem[] = [
  {
    id: "counterform",
    title: "Counterform",
    category: "Motion graphics",
    author: "Counterform Studio",
    duration: 15,
    aspectRatio: "16:9",
    prompt: "Create a bold Swiss typographic layout with high-contrast text, geometric accent circles, and smooth staggered transitions.",
    description: "Bold Swiss typography, geometric accents, staggered motion",
    accentColor: "#f43f5e",
    visualType: "counter",
  },
  {
    id: "salt-air",
    title: "Salt Air",
    category: "Motion graphics",
    author: "Salt Air Design",
    duration: 15,
    aspectRatio: "16:9",
    prompt: "Create an organic coastal aesthetic presentation with soothing ocean-green tones, scenic photography, and elegant serif typography.",
    description: "Scenic coastal aesthetics, serif titles, atmospheric motion",
    accentColor: "#0d9488",
    visualType: "shader",
  },
  {
    id: "rosette",
    title: "Rosette",
    category: "Motion graphics",
    author: "Rosette Creative",
    duration: 15,
    aspectRatio: "16:9",
    prompt: "Create a vibrant celebratory showcase with vivid lilac and magenta color blocking, playful geometric stickers, and lively photo montages.",
    description: "Celebration motifs, lilac and magenta gradients, dynamic cutouts",
    accentColor: "#d946ef",
    visualType: "kinetic",
  },
  {
    id: "daktilo-dispatch",
    title: "Daktilo Dispatch",
    category: "Motion graphics",
    author: "Daktilo Editorial",
    duration: 15,
    aspectRatio: "16:9",
    prompt: "Create a modern investigative editorial deck with brutalist newspaper gridlines, financial callouts, and monochrome documentation textures.",
    description: "Brutalist editorial grids, headline hierarchy, financial callouts",
    accentColor: "#64748b",
    visualType: "chart",
  },
  {
    id: "tangerine-pulse",
    title: "Tangerine (Pulse)",
    category: "Motion graphics",
    author: "Pulse Studio",
    duration: 15,
    aspectRatio: "16:9",
    prompt: "Create a high-energy growth marketing presentation with warm tangerine sunburst gradients, bold sans-serif headlines, and kinetic CTA buttons.",
    description: "Warm gradient glows, growth metrics, bold sans-serif headlines",
    accentColor: "#f97316",
    visualType: "mobile",
  },
  {
    id: "further-study",
    title: "Further Study",
    category: "Motion graphics",
    author: "Further Lab",
    duration: 15,
    aspectRatio: "16:9",
    prompt: "Create an ambient gradient atmosphere with warm copper and terracotta diffuse lighting, subtle dust textures, and thoughtful essay prose.",
    description: "Diffuse sunset gradients, essay typographic layout, ambient glow",
    accentColor: "#ea580c",
    visualType: "shader",
  },
];

const CATEGORIES = [
  "All",
  "Motion graphics",
  "A-roll Cuts",
  "Mobile Ads",
  "Shaders",
] as const;

const PIPELINE_STAGES = [
  {
    id: "prompt_analysis",
    label: "Analyzing prompt & scene planning",
    desc: "Understanding video intent, scriptwriting & storyboard planning with AI",
  },
  {
    id: "asset_preparation",
    label: "Preparing assets & timeline synchronization",
    desc: "Curating media assets, licensed visuals & frame-accurate audio bed",
  },
  {
    id: "building_composition",
    label: "Dynamic visual composition assembly",
    desc: "Authoring responsive layouts, cinematic motion graphics & typography",
  },
  {
    id: "rendering_video",
    label: "High-definition rendering & audio mixing",
    desc: "Headless 1080p composition rendering & balanced soundtrack multiplexing",
  },
  {
    id: "validating_output",
    label: "Output validation & quality check",
    desc: "Validating streams, codecs, duration and audiovisual synchronization",
  },
];

const getStageIndex = (statusStr: string): number => {
  const s = (statusStr || "").toLowerCase();
  switch (s) {
    case "prompt_analysis":
    case "writing_composition":
    case "script_generation":
    case "understanding_prompt":
    case "preparing_brief":
      return 0;
    case "timing_clips":
    case "asset_preparation":
    case "avatar_asset_retrieval":
    case "planning_scenes":
    case "analyzing_assets":
      return 1;
    case "building_composition":
    case "animating_elements":
    case "generating":
    case "generating_composition":
    case "hyperframes_composition":
      return 2;
    case "rendering":
    case "rendering_video":
    case "audio_processing":
    case "audio_mixing":
      return 3;
    case "checking_composition":
    case "checking_own_work":
    case "validating":
    case "validating_project":
    case "verifying_output":
    case "output_validation":
      return 4;
    case "completed":
      return 5;
    default:
      return 0;
  }
};

/**
 * Robust JSON fetch parser that safely extracts server responses,
 * preventing Safari / WebKit DOMException 12 "The string did not match the expected pattern".
 */
async function safeJsonFetch<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(input, init);
    const text = await res.text();
    let data: any = null;
    if (text && text.trim()) {
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        let errMsg = text;
        if (text.includes("<html") || text.includes("<!DOCTYPE") || text.includes("<body")) {
          const titleMatch = text.match(/<title>(.*?)<\/title>/i) || text.match(/<h1>(.*?)<\/h1>/i);
          errMsg = titleMatch && titleMatch[1] ? titleMatch[1].trim() : `Server error (HTTP ${res.status})`;
        }
        return {
          ok: false,
          status: res.status,
          data: null,
          error: errMsg || `Invalid response format (HTTP ${res.status})`,
        };
      }
    }
    const isSuccess = res.ok && data?.success !== false;
    const errorMsg =
      data?.error ||
      data?.message ||
      (!res.ok ? `Request failed with status ${res.status}` : undefined);
    return {
      ok: isSuccess,
      status: res.status,
      data,
      error: errorMsg,
    };
  } catch (netErr: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: netErr?.message || "Network connection failed",
    };
  }
}

export default function CreateVideoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { current, workspaces, select } = useWorkspace();
  const activeWorkspaceId =
    current ||
    (workspaces && workspaces[0]?._id) ||
    ("mh7eadmg10g11yqwbjtyc41yjs8fxx17" as Id<"workspaces">);

  useEffect(() => {
    if (!current && workspaces && workspaces[0]) {
      select(workspaces[0]._id);
    }
  }, [current, workspaces, select]);

  const createProject = useMutation(api.projects.create);
  const saveProductionPlan = useMutation(api.projects.saveProductionPlan);
  const approveAndRenderPlan = useMutation(api.projects.approveAndRenderPlan);
  const createAsset = useMutation(api.assets.create);
  const removeAsset = useMutation(api.assets.remove);

  // HeyGen Video Agent: Creation Modes & Interactive Plan State
  const [creationMode, setCreationMode] = useState<"plan" | "autopilot">("plan");
  const [videoPlan, setVideoPlan] = useState<any>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [isRevisingPlan, setIsRevisingPlan] = useState<boolean>(false);

  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<number>(5);
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false);
  const [promptDetectedDuration, setPromptDetectedDuration] = useState<number | null>(null);
  const [resolution, setResolution] = useState<string>("1080p");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [fps, setFps] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<Id<"projects"> | null>(
    null,
  );
  const [selectedAssetIds, setSelectedAssetIds] = useState<Id<"assets">[]>([]);
  const [selectedInspirationIds, setSelectedInspirationIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [assetFilter, setAssetFilter] = useState<"all" | "video" | "image">(
    "all",
  );
  const [showStepByStep, setShowStepByStep] = useState(false);
  const [showEnvCard, setShowEnvCard] = useState(false);

  // Typography Engine
  const [selectedTypographyStyle, setSelectedTypographyStyle] = useState<string>("auto");

  // PHASE TWO: Creation Mode Selection (AI Prompt Mode vs Direct Code Mode)
  const [pipelineMode, setPipelineMode] = useState<"ai_prompt" | "direct_code">("ai_prompt");
  const [codeTab, setCodeTab] = useState<"html" | "css" | "js">("html");
  const [directHtml, setDirectHtml] = useState<string>(`<!-- HyperFrames HTML Composition -->
<div class="ollastar-card">
  <div class="brand-badge">
    <span class="dot"></span>
    <span>Ollastar Motion Studio</span>
  </div>
  <h1 class="main-heading">Create at the Speed of Thought</h1>
  <p class="sub-heading">High-performance 60 FPS motion graphics generated directly from code.</p>
  <div class="metrics-row">
    <div class="metric-item">
      <span class="metric-val">40s</span>
      <span class="metric-lbl">Full Duration</span>
    </div>
    <div class="metric-item">
      <span class="metric-val">1080p</span>
      <span class="metric-lbl">Crisp Output</span>
    </div>
    <div class="metric-item">
      <span class="metric-val">60 FPS</span>
      <span class="metric-lbl">Silk Smooth</span>
    </div>
  </div>
</div>`);
  const [directCss, setDirectCss] = useState<string>(`/* HyperFrames CSS Styling */
.ollastar-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 30%, #1e1b4b 0%, #09090b 100%);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  text-align: center;
  padding: 48px;
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 9999px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  font-size: 13px;
  font-weight: 600;
  color: #818cf8;
  margin-bottom: 24px;
  opacity: 0;
  transform: translateY(-10px);
}

.brand-badge .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #818cf8;
  box-shadow: 0 0 10px #818cf8;
}

.main-heading {
  font-size: 56px;
  font-weight: 900;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 16px;
  line-height: 1.1;
  opacity: 0;
  transform: translateY(20px);
}

.sub-heading {
  font-size: 20px;
  color: #94a3b8;
  max-width: 650px;
  line-height: 1.5;
  margin-bottom: 40px;
  opacity: 0;
  transform: translateY(20px);
}

.metrics-row {
  display: flex;
  gap: 32px;
  opacity: 0;
  transform: scale(0.95);
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 28px;
  border-radius: 16px;
}

.metric-val {
  font-size: 28px;
  font-weight: 800;
  color: #38bdf8;
  font-family: monospace;
}

.metric-lbl {
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 4px;
}`);
  const [directJs, setDirectJs] = useState<string>(`// Register GSAP animation timeline on window.__timelines["main"]
const tl = gsap.timeline({ paused: true });

tl.to(".brand-badge", {
  opacity: 1,
  y: 0,
  duration: 0.8,
  ease: "power3.out"
}, 0.2);

tl.to(".main-heading", {
  opacity: 1,
  y: 0,
  duration: 1.0,
  ease: "power3.out"
}, 0.5);

tl.to(".sub-heading", {
  opacity: 1,
  y: 0,
  duration: 0.9,
  ease: "power2.out"
}, 0.9);

tl.to(".metrics-row", {
  opacity: 1,
  scale: 1,
  duration: 0.8,
  ease: "back.out(1.5)"
}, 1.3);

// Hold through the full duration (e.g. 40s)
tl.to(".ollastar-card", {
  background: "radial-gradient(circle at 50% 30%, #1e293b 0%, #030712 100%)",
  duration: 6,
  ease: "none"
}, 2.0);

window.__timelines = window.__timelines || {};
window.__timelines["main"] = tl;`);
  const [directDuration, setDirectDuration] = useState<number>(40);
  const [directResolution, setDirectResolution] = useState<string>("1080p");
  const [directFps, setDirectFps] = useState<number>(30);
  const [directTitle, setDirectTitle] = useState<string>("Ollastar Motion Project");
  const [validationResult, setValidationResult] = useState<{
    valid?: boolean;
    errors?: string[];
    parsedErrors?: any[];
  } | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState<boolean>(false);
  const [recentTab, setRecentTab] = useState<"work" | "chats">("work");

  const handleValidateDirectCode = async () => {
    setIsValidatingCode(true);
    setValidationResult(null);
    try {
      const { ok, data, error } = await safeJsonFetch("/api/direct-code/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: directHtml,
          css: directCss,
          js: directJs,
          duration: directDuration,
          width: directResolution === "720p" ? 1280 : 1920,
          height: directResolution === "720p" ? 720 : 1080,
          fps: directFps,
        }),
      });
      if (ok && data) {
        setValidationResult(data);
        if (data.valid) {
          toast.success("Source code validated! Ready to render.");
        } else {
          toast.error(`Validation warnings: ${(data.errors || []).join("; ")}`);
        }
      } else {
        toast.error(error || "Validation failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to validate source code");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const repairDirectCodePayload = (
    inHtml: string,
    inCss: string,
    inJs: string,
    dur: number,
    res: string
  ) => {
    let repairedHtml = (inHtml || "").trim();
    let repairedJs = (inJs || "").trim();
    let repairedCss = (inCss || "").trim();

    // 0a. Strip markdown code fences (```html ... ``` or ```css ... ``` or ```)
    repairedHtml = repairedHtml
      .replace(/^```[a-z0-9_-]*\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    // 0b. Strip stray leading markdown hyphens/bullets, e.g. "-\n" or "- #composition" or "* "
    repairedHtml = repairedHtml
      .replace(/^[\s\-\*•]+(?=(?:<!DOCTYPE|<html|<div|<main|<section|#|\.|\/\*|[a-z]))/i, "")
      .trim();

    // 0c. Extract <style>...</style> if present in HTML and copy to repairedCss without deleting from HTML
    const styleMatches = repairedHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (styleMatches) {
      for (const match of styleMatches) {
        const cssContent = match.replace(/<\/?style[^>]*>/gi, "").trim();
        if (cssContent && !repairedCss.includes(cssContent.slice(0, 30))) {
          repairedCss = (repairedCss ? repairedCss + "\n\n" : "") + cssContent;
        }
      }
    }

    // 0d. Extract inline <script>...</script> if present (exclude scripts with src=) and copy to repairedJs without deleting from HTML
    const scriptMatches = repairedHtml.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
      for (const match of scriptMatches) {
        const jsContent = match.replace(/<\/?script[^>]*>/gi, "").trim();
        if (jsContent && !repairedJs.includes(jsContent.slice(0, 30))) {
          repairedJs = (repairedJs ? repairedJs + "\n\n" : "") + jsContent;
        }
      }
    }

    // 0e. Check if user pasted pure CSS into the HTML tab (CSS rules with no HTML opening/closing tags)
    const hasHtmlTags = /<[a-z0-9_-]+[\s>]/i.test(repairedHtml);
    const looksLikeCss = /(?:^|\n)\s*(?:#[a-z0-9_-]+|\.[a-z0-9_-]+|[a-z0-9_-]+)\s*\{[^}]*\}/i.test(repairedHtml);
    if (!hasHtmlTags && looksLikeCss) {
      if (!repairedCss.includes(repairedHtml.slice(0, 30))) {
        repairedCss = (repairedCss ? repairedCss + "\n\n" : "") + repairedHtml;
      }
      const w = res === "720p" ? 1280 : 1920;
      const h = res === "720p" ? 720 : 1080;
      repairedHtml = `<div id="composition" class="clip" data-start="0" data-duration="${dur}" data-width="${w}" data-height="${h}" data-layout-allow-overflow="true" data-layout-allow-overlap="true" data-layout-allow-occlusion="true">
  <section class="scene clip" data-start="0" data-duration="${dur}">
    <div class="scene-background"></div>
    <div class="content">
      <h1 class="main-heading">Ollastar Motion Studio</h1>
      <p class="sub-heading">HyperFrames & FFmpeg Direct Composition</p>
    </div>
  </section>
</div>`;
    }

    // 0f. Auto-strip leading comments before <!DOCTYPE html> and ensure valid HTML wrapper if needed
    repairedHtml = repairedHtml.replace(/^(\s*<!--[\s\S]*?-->\s*)+/i, "");
    if (!/<!doctype\s+html/i.test(repairedHtml)) {
      if (/<html\b/i.test(repairedHtml)) {
        repairedHtml = `<!DOCTYPE html>\n${repairedHtml}`;
      }
    }
    repairedHtml = repairedHtml.replace(/<\/html\s*$/i, "</html>");
    repairedHtml = repairedHtml.replace(/<\/body\s*$/i, "</body>\n</html>");

    // 1. Auto-add class="clip" to elements with data-in/data-out/data-start/data-duration/data-scene or class="scene"
    repairedHtml = repairedHtml.replace(/<([a-z0-9_-]+)\b([^>]*\b(?:data-in|data-out|data-start|data-duration|data-scene)=[^>]*)>/gi, (match, tag, attrs) => {
      if (/\bclass=["']([^"']*)["']/i.test(attrs)) {
        if (!/\bclip\b/i.test(attrs)) {
          return `<${tag} ${attrs.replace(/\bclass=["']([^"']*)["']/i, 'class="$1 clip"')}>`;
        }
        return match;
      }
      return `<${tag} class="clip" ${attrs}>`;
    });
    repairedHtml = repairedHtml.replace(/<section\b([^>]*\bclass=["'][^"']*\bscene\b[^"']*["'][^>]*)>/gi, (match, attrs) => {
      if (!/\bclip\b/i.test(attrs)) {
        return `<section ${attrs.replace(/\bclass=["']([^"']*)["']/i, 'class="$1 clip"')}>`;
      }
      return match;
    });

    // 2. Align timeline ID between window.__timelines["..."] and data-composition-id
    const tlKeyMatch = (repairedHtml + "\n" + repairedJs).match(/window\.__timelines\[["']([^"']+)["']\]/);
    const detectedTlId = tlKeyMatch ? tlKeyMatch[1] : null;

    // Find composition root (can be <main id="composition", <div id="composition", <div id="root", etc.)
    const compTagRegex = /<([a-z0-9_-]+)\b([^>]*\bid=["'](?:composition|root)["'][^>]*)>/i;
    if (compTagRegex.test(repairedHtml)) {
      repairedHtml = repairedHtml.replace(compTagRegex, (match, tag, attrs) => {
        let updated = attrs;
        // ensure clip class
        if (/\bclass=["']([^"']*)["']/i.test(updated)) {
          if (!/\bclip\b/i.test(updated)) {
            updated = updated.replace(/\bclass=["']([^"']*)["']/i, 'class="$1 clip"');
          }
        } else {
          updated = ` class="clip"${updated}`;
        }
        // align data-composition-id
        if (detectedTlId && detectedTlId !== "main") {
          if (/data-composition-id=/i.test(updated)) {
            updated = updated.replace(/data-composition-id=["'][^"']*["']/i, `data-composition-id="${detectedTlId}"`);
          } else {
            updated = `${updated} data-composition-id="${detectedTlId}"`;
          }
        }
        // ensure start & duration
        if (!/data-start=/i.test(updated)) updated += ` data-start="0"`;
        if (!/data-duration=/i.test(updated)) updated += ` data-duration="${dur}"`;
        // ensure dimensions and layout overrides
        const w = res === "720p" ? 1280 : 1920;
        const h = res === "720p" ? 720 : 1080;
        if (!/data-width=/i.test(updated)) updated += ` data-width="${w}"`;
        if (!/data-height=/i.test(updated)) updated += ` data-height="${h}"`;
        if (!/data-layout-allow-overflow=/i.test(updated)) updated += ` data-layout-allow-overflow="true"`;
        if (!/data-layout-allow-overlap=/i.test(updated)) updated += ` data-layout-allow-overlap="true"`;
        if (!/data-layout-allow-occlusion=/i.test(updated)) updated += ` data-layout-allow-occlusion="true"`;
        return `<${tag}${updated}>`;
      });
    }

    // 3. Remove conflicting CSS transforms like .scene-background { transform: scale(...) }
    repairedHtml = repairedHtml.replace(/(\.scene-background\s*\{[^}]*?)transform\s*:\s*scale\([^)]+\)\s*;?/gi, '$1');
    repairedCss = repairedCss.replace(/(\.scene-background\s*\{[^}]*?)transform\s*:\s*scale\([^)]+\)\s*;?/gi, '$1');

    // 4. Clean up letterSpacing animations in GSAP
    repairedHtml = repairedHtml.replace(/(['"]?letter[-S]pacing['"]?\s*:\s*)[^,\}\n]+/gi, '/* letterSpacing held */ opacity: 1');
    repairedJs = repairedJs.replace(/(['"]?letter[-S]pacing['"]?\s*:\s*)[^,\}\n]+/gi, '/* letterSpacing held */ opacity: 1');

    // 5. Clean up any corrupted comment fragments from previous runs
    repairedHtml = repairedHtml.replace(/\/\*[\s\S]*?timeline\.play[\s\S]*?\*\/(\s*\(void 0\);?|\s*bypassed for seek(\s*\*\/)?)*/gi, '(void 0);');
    repairedHtml = repairedHtml.replace(/bypassed for seek(\s*\*\/)?\s*(\(void 0\);)?/gi, '');
    repairedJs = repairedJs.replace(/\/\*[\s\S]*?timeline\.play[\s\S]*?\*\/(\s*\(void 0\);?|\s*bypassed for seek(\s*\*\/)?)*/gi, '(void 0);');
    repairedJs = repairedJs.replace(/bypassed for seek(\s*\*\/)?\s*(\(void 0\);)?/gi, '');

    // Safely neutralize timeline.play() calls without comments so keywords never get exposed
    repairedHtml = repairedHtml.replace(/\btimeline\.play\s*\([^)]*\)\s*;?/g, '(void 0);');
    repairedJs = repairedJs.replace(/\btimeline\.play\s*\([^)]*\)\s*;?/g, '(void 0);');

    // 6. Detect duration from code if present (e.g. TOTAL_DURATION = 40 or data-duration="40")
    const durMatch = (repairedHtml + "\n" + repairedJs).match(/(?:TOTAL_DURATION|data-duration)=["']?(\d+)["']?/i);
    let matchedDur = dur;
    if (durMatch && durMatch[1]) {
      const parsedDur = parseInt(durMatch[1], 10);
      if ([5, 15, 30, 40, 60].includes(parsedDur)) {
        matchedDur = parsedDur;
      }
    }

    return { repairedHtml, repairedCss, repairedJs, matchedDur };
  };

  const handleAutoFixDirectCode = async () => {
    const cleaned = repairDirectCodePayload(
      directHtml,
      directCss,
      directJs,
      directDuration,
      directResolution
    );

    if (cleaned.matchedDur !== directDuration) {
      setDirectDuration(cleaned.matchedDur);
    }
    setDirectHtml(cleaned.repairedHtml);
    setDirectJs(cleaned.repairedJs);
    setDirectCss(cleaned.repairedCss);

    toast.loading("Applying fixes & re-validating...", { id: "autofix" });
    try {
      const { ok, data } = await safeJsonFetch("/api/direct-code/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: cleaned.repairedHtml,
          css: cleaned.repairedCss,
          js: cleaned.repairedJs,
          duration: cleaned.matchedDur,
          width: directResolution === "720p" ? 1280 : 1920,
          height: directResolution === "720p" ? 720 : 1080,
          fps: directFps,
        }),
      });
      if (ok && data) {
        setValidationResult(data);
        if (data.valid) {
          toast.success("Code auto-repaired and verified clean!", { id: "autofix" });
        } else {
          toast.success("Code repaired with minor advisory notices", { id: "autofix" });
        }
      } else {
        toast.success("Code auto-repaired!", { id: "autofix" });
      }
    } catch {
      toast.success("Code auto-repaired!", { id: "autofix" });
    }
  };

  const handleRenderDirectCode = async (overrideHtml?: string | React.SyntheticEvent) => {
    const rawHtml = (typeof overrideHtml === "string" ? overrideHtml : directHtml).trim();
    if (!rawHtml) {
      toast.error("Please enter HTML source code");
      return;
    }

    // Auto-repair code prior to sending to ensure bulletproof compilation
    const cleaned = repairDirectCodePayload(
      rawHtml,
      directCss,
      directJs,
      directDuration,
      directResolution
    );

    setDirectHtml(cleaned.repairedHtml);
    setDirectCss(cleaned.repairedCss);
    setDirectJs(cleaned.repairedJs);
    if (cleaned.matchedDur !== directDuration) {
      setDirectDuration(cleaned.matchedDur);
    }

    const htmlToRender = cleaned.repairedHtml;
    const effectiveDuration = cleaned.matchedDur;

    setIsSubmitting(true);
    try {
      const targetWs = current || activeWorkspaceId;
      const width = directResolution === "720p" ? 1280 : 1920;
      const height = directResolution === "720p" ? 720 : 1080;

      // Extract title from HTML if not explicitly provided
      const titleMatch =
        htmlToRender.match(/<title>([^<]+)<\/title>/i) ||
        htmlToRender.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
      const extractedTitle = titleMatch && titleMatch[1] ? titleMatch[1].trim() : "";
      const effectiveTitle = (directTitle || extractedTitle || "Direct Code Video").trim();

      const projId = `proj_code_${Date.now()}`;

      // Instantly set active project ID and polled state so the UI immediately shows the live 5-stage progress card
      setActiveProjectId(projId as any);
      setPolledProject({
        _id: projId,
        name: effectiveTitle,
        prompt: "DIRECT_CODE_RENDER",
        status: "validating",
        stage: "validating",
        duration: effectiveDuration,
      });

      // Smooth scroll to top so the progress card is immediately in view
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      // Non-blocking background sync to Convex (never blocks the render pipeline)
      createProject({
        workspaceId: targetWs,
        name: effectiveTitle,
        prompt: "DIRECT_CODE_RENDER",
        duration: effectiveDuration,
        width,
        height,
        fps: directFps,
        mode: "direct_code",
      }).catch((e) => console.log("Direct code background sync notice:", e));

      const { ok, data, error } = await safeJsonFetch("/api/direct-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projId,
          html: htmlToRender,
          css: cleaned.repairedCss,
          js: cleaned.repairedJs,
          duration: effectiveDuration,
          width,
          height,
          fps: directFps,
          title: effectiveTitle,
          workspaceId: targetWs,
        }),
      });

      if (!ok || !data?.ok) {
        throw new Error(error || data?.error || "Failed to trigger direct code render");
      }
      toast.success("Direct code render initiated! Saving to your video projects...");
    } catch (err: any) {
      toast.error(err.message || "Failed to start direct code render");
      setIsSubmitting(false);
    }
  };

  // Soundtrack & Background Music Studio State
  const [autoMusicEnabled, setAutoMusicEnabled] = useState<boolean>(true);
  const [selectedMusicStyle, setSelectedMusicStyle] = useState<string>("Cinematic");
  const [selectedMusicSource, setSelectedMusicSource] = useState<string>("auto");
  const [selectedBgmTrack, setSelectedBgmTrack] = useState<string>("auto");
  const [bgmVolume, setBgmVolume] = useState<number>(0.35);
  const [musicDuckingEnabled, setMusicDuckingEnabled] = useState<boolean>(false);
  const [preserveNarrationSetting, setPreserveNarrationSetting] = useState<boolean>(false);
  const [fadeInDuration, setFadeInDuration] = useState<number>(1.0);
  const [fadeOutDuration, setFadeOutDuration] = useState<number>(2.0);
  const [musicCandidatesList, setMusicCandidatesList] = useState<any[]>([]);
  const [showMusicSettingsDrawer, setShowMusicSettingsDrawer] = useState<boolean>(false);
  const [testedMusicProvider, setTestedMusicProvider] = useState<Record<string, { ok: boolean; msg: string; sampleCount?: number }>>({});
  const [isTestingMusicProvider, setIsTestingMusicProvider] = useState<string | null>(null);

  const [aiRecommendedTrack, setAiRecommendedTrack] = useState<{
    id: string;
    title: string;
    artist: string;
    genre: string;
    moods: string[];
    bpm: number;
    url: string;
    license: string;
    licenseInfo?: {
      name: string;
      url: string;
      commercialSafe: boolean;
      attributionRequired: boolean;
      attributionText: string;
      verified: boolean;
      permittedUseSummary?: string;
    };
    hasVocals: boolean;
    rankingScore?: number;
    provider?: string;
  } | null>({
    id: "cinematic_luxury",
    title: "Cinematic Luxury & Elegance",
    artist: "Hyparlink Audio Labs",
    genre: "Cinematic Orchestral",
    moods: ["luxury", "prestigious", "elegant", "calm"],
    bpm: 75,
    url: "/audio/bgm/cinematic_luxury.mp3",
    license: "Royalty-Free Commercial",
    licenseInfo: {
      name: "Hyparlink Commercial Royalty-Free",
      url: "https://hyparlink.ai/licenses/commercial-royalty-free",
      commercialSafe: true,
      attributionRequired: false,
      attributionText: "Music: 'Cinematic Luxury & Elegance' by Hyparlink Audio Labs",
      verified: true,
      permittedUseSummary: "Perpetual worldwide commercial video synchronization",
    },
    hasVocals: false,
    rankingScore: 92,
    provider: "internal_catalog",
  });
  const [aiMusicReason, setAiMusicReason] = useState<string>(
    "Acoustically aligned with cinematic luxury branding & dynamic speech ducking"
  );
  const [isRecommendingMusic, setIsRecommendingMusic] = useState<boolean>(false);
  const [musicRefinementInput, setMusicRefinementInput] = useState<string>("");
  const [showCatalogDrawer, setShowCatalogDrawer] = useState<boolean>(false);

  const [customBgm, setCustomBgm] = useState<{
    filename: string;
    name: string;
    audioUrl: string;
    localPath: string;
    duration: number;
  } | null>(null);
  const [isUploadingBgm, setIsUploadingBgm] = useState<boolean>(false);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [showSettingsPopover, setShowSettingsPopover] = useState<boolean>(false);
  const [activeFormatPill, setActiveFormatPill] = useState<string>("Presentation");
  const [showAdvancedStudio, setShowAdvancedStudio] = useState<boolean>(false);

  const handleTestMusicProvider = async (provider: string) => {
    setIsTestingMusicProvider(provider);
    try {
      const res = await safeJsonFetch("/api/music/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (res.ok && res.data) {
        setTestedMusicProvider((prev) => ({
          ...prev,
          [provider]: {
            ok: res.data.success,
            msg: res.data.message || res.data.licenseNote || "Provider connected",
            sampleCount: res.data.sampleCount,
          },
        }));
        toast.success(res.data.message || `${provider} connected successfully`);
      } else {
        throw new Error(res.error || "Provider test failed");
      }
    } catch (err: any) {
      setTestedMusicProvider((prev) => ({
        ...prev,
        [provider]: { ok: false, msg: err.message },
      }));
      toast.error(err.message);
    } finally {
      setIsTestingMusicProvider(null);
    }
  };

  const requestMusicRecommendation = async (customPrompt?: string) => {
    const promptToAnalyze = customPrompt || prompt;
    if (!promptToAnalyze.trim()) {
      toast.error("Please enter a video prompt first to analyze musical tone.");
      return;
    }
    setIsRecommendingMusic(true);
    const toastId = toast.loading("Analyzing video content & scoring soundtracks...");
    try {
      const res = await safeJsonFetch("/api/music/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToAnalyze,
          duration: Math.round(duration || 60),
          voiceoverEnabled: false,
          hasAvatar: Boolean(avatarId),
        }),
      });

      if (res.ok && res.data?.selectedTrack) {
        setAiRecommendedTrack(res.data.selectedTrack);
        setAiMusicReason(res.data.selectionReason || "Best acoustic match for video theme");
        if (Array.isArray(res.data.candidates)) {
          setMusicCandidatesList(res.data.candidates);
        }
        setSelectedBgmTrack("auto");
        toast.success(`Selected "${res.data.selectedTrack.title}" (${res.data.selectedTrack.genre})`, { id: toastId });
      } else {
        throw new Error(res.error || "Recommendation engine could not evaluate candidates");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to analyze music recommendation", { id: toastId });
    } finally {
      setIsRecommendingMusic(false);
    }
  };

  const refineMusicRecommendation = async (instruction: string) => {
    if (!instruction.trim()) return;
    setIsRecommendingMusic(true);
    const toastId = toast.loading(`Refining soundtrack for "${instruction}"...`);
    try {
      const res = await safeJsonFetch("/api/music/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          duration: Math.round(duration || 60),
          currentTrackId: aiRecommendedTrack?.id || "cinematic_luxury",
          refinementInstruction: instruction,
        }),
      });

      if (res.ok && res.data?.selectedTrack) {
        setAiRecommendedTrack(res.data.selectedTrack);
        setAiMusicReason(res.data.selectionReason);
        setSelectedBgmTrack("auto");
        setMusicRefinementInput("");
        toast.success(`Updated to "${res.data.selectedTrack.title}"!`, { id: toastId });
      } else {
        throw new Error(res.error || "Refinement failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to refine music selection", { id: toastId });
    } finally {
      setIsRecommendingMusic(false);
    }
  };

  const togglePlayPreview = (trackId: string, audioUrl: string) => {
    if (previewTrackId === trackId) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPreviewTrackId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audio.volume = bgmVolume;
      audio.onended = () => setPreviewTrackId(null);
      audio.onerror = () => {
        toast.error("Audio preview not available for this track");
        setPreviewTrackId(null);
      };
      audio.play().catch(() => setPreviewTrackId(null));
      previewAudioRef.current = audio;
      setPreviewTrackId(trackId);
    }
  };

  const handleCustomBgmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBgm(true);
    const toastId = toast.loading(`Uploading audio track "${file.name}"...`);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64 = res.split(",")[1];
          resolve(base64 || "");
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const data = await base64Promise;

      const res = await safeJsonFetch("/api/audio/upload-bgm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          data,
        }),
      });

      if (!res.ok || !res.data) {
        throw new Error(res.error || "Failed to upload audio file");
      }

      setCustomBgm({
        filename: res.data.filename,
        name: file.name,
        audioUrl: res.data.audioUrl,
        localPath: res.data.localPath,
        duration: res.data.duration,
      });
      setSelectedBgmTrack("custom");
      toast.success(`Attached custom soundtrack: ${file.name} (${res.data.duration}s)!`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload audio file", { id: toastId });
    } finally {
      setIsUploadingBgm(false);
    }
  };

  // Cinematic Composition Studio State (Voice reading prompt removed by default)
  const [compositionMode, setCompositionMode] = useState<"auto" | "mode_a" | "mode_b" | "mode_c" | "hyperframes_only">("hyperframes_only");
  const [visualStyle, setVisualStyle] = useState<string>("cinematic");
  const [avatarLanguage, setAvatarLanguage] = useState<string>("all");
  const [availableAvatars, setAvailableAvatars] = useState<any[]>([]);
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState<boolean>(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const [generationMode, setGenerationMode] = useState<"hyperframes_only" | "avatar_mixed" | "avatar_presenter">("hyperframes_only");
  const [avatarId, setAvatarId] = useState<string>("");
  const [avatarName, setAvatarName] = useState<string>("");
  const [voiceId, setVoiceId] = useState<string>("");
  const [voiceName, setVoiceName] = useState<string>("");
  const [heygenApiKey, setHeygenApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [apiKeyValidating, setApiKeyValidating] = useState<boolean>(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    valid: boolean;
    mode: "cloud" | "sandbox" | "invalid";
    message: string;
  }>({
    valid: false,
    mode: "sandbox",
    message: "Free Studio Sandbox Active (FFmpeg + Local Speech)",
  });
  const [customPresenterVideo, setCustomPresenterVideo] = useState<{
    filename: string;
    videoUrl: string;
    localPath: string;
    duration: number;
    name?: string;
  } | null>(null);
  const [isUploadingPresenter, setIsUploadingPresenter] = useState<boolean>(false);
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(true);
  const [bgMusicEnabled, setBgMusicEnabled] = useState<boolean>(true);
  const [isSavedConfig, setIsSavedConfig] = useState<boolean>(false);

  const handlePlayVoicePreview = (v: any) => {
    if (playingVoiceId === v.id) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingVoiceId(null);
      return;
    }

    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (v.previewAudio) {
      const audio = new Audio(v.previewAudio);
      audioPreviewRef.current = audio;
      setPlayingVoiceId(v.id);
      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => setPlayingVoiceId(null);
      audio.play().catch(() => setPlayingVoiceId(null));
    } else {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const text = v.sampleText || "Welcome to Hyparlink. Transform your ideas into high production value videos.";
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.onend = () => setPlayingVoiceId(null);
        utterance.onerror = () => setPlayingVoiceId(null);
        setPlayingVoiceId(v.id);
        window.speechSynthesis.speak(utterance);
      } else {
        toast.info(`Voice selected: ${v.name} (${v.tone || v.accent || "Standard"})`);
      }
    }
  };

  const verifyHeyGenKey = async (keyToTest: string) => {
    if (!keyToTest.trim()) {
      setApiKeyStatus({
        valid: false,
        mode: "sandbox",
        message: "Sandbox Mode: Free Local Studio Engine Active.",
      });
      return;
    }
    setApiKeyValidating(true);
    try {
      const res = await fetch("/api/heygen/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToTest.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setApiKeyStatus({
          valid: true,
          mode: "cloud",
          message: "HeyGen Account Connected: Live Cloud Rendering Active.",
        });
        localStorage.setItem("heygen_api_key", keyToTest.trim());
      } else {
        setApiKeyStatus({
          valid: false,
          mode: "sandbox",
          message: data.message || "Invalid HeyGen API key. Free local studio engine will be used.",
        });
      }
    } catch {
      setApiKeyStatus({
        valid: false,
        mode: "sandbox",
        message: "Failed to verify key. Free local studio engine will be used.",
      });
    } finally {
      setApiKeyValidating(false);
    }
  };

  // Intelligent Visual Asset Discovery & Sourcing State
  const [imageDiscoveryEnabled, setImageDiscoveryEnabled] = useState<boolean>(true);
  const [imageReviewMode, setImageReviewMode] = useState<"auto" | "review">("auto");
  const [wikimediaEnabled, setWikimediaEnabled] = useState<boolean>(true);
  const [pexelsEnabled, setPexelsEnabled] = useState<boolean>(false);
  const [pexelsApiKey, setPexelsApiKey] = useState<string>("");
  const [unsplashEnabled, setUnsplashEnabled] = useState<boolean>(false);
  const [unsplashAccessKey, setUnsplashAccessKey] = useState<string>("");
  const [aiImageFallback, setAiImageFallback] = useState<boolean>(true);
  const [providerTesting, setProviderTesting] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [visualAssetPlan, setVisualAssetPlan] = useState<any>(null);
  const [isPlanningAssets, setIsPlanningAssets] = useState<boolean>(false);
  const [showImageSettingsDrawer, setShowImageSettingsDrawer] = useState<boolean>(false);

  const handleTestImageProvider = async (provider: string, apiKey?: string) => {
    setProviderTesting(provider);
    try {
      const res = await safeJsonFetch("/api/images/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      if (res.ok && res.data?.success) {
        setProviderStatus((prev) => ({
          ...prev,
          [provider]: { ok: true, msg: res.data.message },
        }));
        toast.success(res.data.message);
      } else {
        const msg = res.data?.message || res.error || "Connection test notice";
        setProviderStatus((prev) => ({
          ...prev,
          [provider]: { ok: false, msg },
        }));
        toast.error(msg);
      }
    } catch (err: any) {
      setProviderStatus((prev) => ({
        ...prev,
        [provider]: { ok: false, msg: err.message },
      }));
      toast.error(err.message);
    } finally {
      setProviderTesting(null);
    }
  };

  const handlePlanVisualAssets = async () => {
    const p = prompt || selectedInspirations[0]?.prompt;
    if (!p) {
      toast.error("Please enter a prompt first to generate a visual asset plan.");
      return;
    }
    setIsPlanningAssets(true);
    try {
      toast.info("Analyzing video scenes and authoring visual asset plan with AI...");
      const res = await safeJsonFetch("/api/images/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, sceneCount: 4 }),
      });
      if (res.ok && res.data?.plan) {
        setVisualAssetPlan(res.data.plan);
        toast.success(`Visual Asset Plan generated (${res.data.plan.sceneRequirements.length} scenes planned)!`);
      } else {
        throw new Error(res.error || "Failed to generate plan");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsPlanningAssets(false);
    }
  };

  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("heygen_api_key");
      if (savedKey) {
        setHeygenApiKey(savedKey);
        verifyHeyGenKey(savedKey);
      }
      const savedBgm = localStorage.getItem("hyparlink_bgm_track");
      if (savedBgm && savedBgm !== "cinematic_luxury") {
        setSelectedBgmTrack(savedBgm);
      } else {
        setSelectedBgmTrack("auto");
      }
      const savedVol = localStorage.getItem("hyparlink_bgm_volume");
      if (savedVol) {
        const v = parseFloat(savedVol);
        if (!isNaN(v)) setBgmVolume(v);
      }
    } catch {}

    const loadHeyGenCatalog = async () => {
      setIsLoadingAvatars(true);
      try {
        const [avRes, vcRes] = await Promise.all([
          safeJsonFetch("/api/heygen/avatars"),
          safeJsonFetch("/api/heygen/voices"),
        ]);
        if (avRes?.data?.avatars && avRes.data.avatars.length > 0) {
          setAvailableAvatars(avRes.data.avatars);
          if (!avatarId) {
            setAvatarId(avRes.data.avatars[0].id);
            setAvatarName(avRes.data.avatars[0].name);
          }
        }
        if (vcRes?.data?.voices && vcRes.data.voices.length > 0) {
          setAvailableVoices(vcRes.data.voices);
          if (!voiceId) {
            setVoiceId(vcRes.data.voices[0].id);
            setVoiceName(vcRes.data.voices[0].name);
          }
        }
      } catch (err: any) {
        console.warn("[HeyGen] Notice loading avatar catalog:", err.message);
      } finally {
        setIsLoadingAvatars(false);
      }
    };
    loadHeyGenCatalog();
  }, []);

  const handleSaveAvatarConfig = () => {
    try {
      localStorage.setItem("hyparlink_bgm_track", selectedBgmTrack);
      localStorage.setItem("hyparlink_bgm_volume", String(bgmVolume));
      toast.success("Soundtrack configuration saved!");
    } catch {
      toast.error("Failed to save configuration locally.");
    }
  };

  const handleClearAvatarConfig = () => {
    try {
      localStorage.removeItem("hyparlink_avatar_voice_config");
      localStorage.removeItem("heygen_custom_avatar_id");
      localStorage.removeItem("heygen_custom_voice_id");
      setAvatarId("");
      setAvatarName("");
      setVoiceId("");
      setVoiceName("");
      setSelectedBgmTrack("cinematic_luxury");
      setBgmVolume(0.85);
      setIsSavedConfig(false);
      toast.info("Audio configuration reset to Cinematic Luxury.");
    } catch {}
  };

  // Helper: Extract authoritative duration from prompt
  const extractDuration = (text: string): number | null => {
    if (!text) return null;
    const p = text.toLowerCase();
    const secMatch = p.match(/\b(\d{1,3})\s*(?:-|–)?\s*(?:seconds?|secs?|sec|s)\b/i);
    if (secMatch && secMatch[1]) {
      const s = parseInt(secMatch[1], 10);
      if (s >= 3 && s <= 300) return s;
    }
    const minMatch = p.match(/\b(\d{1,2})\s*(?:-|–)?\s*(?:minutes?|mins?|min)\b/i);
    if (minMatch && minMatch[1]) {
      const m = parseInt(minMatch[1], 10);
      if (m >= 1 && m <= 10) return m * 60;
    }
    const colonMatch = p.match(/\b(\d{1,2}):(\d{2})\b/);
    if (colonMatch && colonMatch[1] && colonMatch[2]) {
      const mins = parseInt(colonMatch[1], 10);
      const secs = parseInt(colonMatch[2], 10);
      const total = mins * 60 + secs;
      if (total >= 3 && total <= 300) return total;
    }
    return null;
  };

  // Sync duration whenever prompt mentions a time (authoritative priority over UI setting)
  useEffect(() => {
    const detected = extractDuration(prompt);
    if (detected) {
      setPromptDetectedDuration(detected);
      setDuration(detected);
      setIsCustomDuration(![5, 10, 15, 20, 30, 45, 60].includes(detected));
    } else {
      setPromptDetectedDuration(null);
    }
  }, [prompt]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const promptContainerRef = useRef<HTMLFormElement>(null);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string>("All");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showAllTemplates, setShowAllTemplates] = useState<boolean>(false);

  // Auto-fill template when navigated with ?template=<templateId>
  useEffect(() => {
    const templateParam = searchParams.get("template");
    if (!templateParam) return;
    const tmpl = READY_MADE_TEMPLATES.find((t) => t.id === templateParam);
    if (tmpl) {
      setSelectedTemplateId(tmpl.id);
      setPrompt(tmpl.prompt);
      setName(tmpl.title);
      setDuration(tmpl.duration);
      setAspectRatio(tmpl.aspectRatio);
      setShowAllTemplates(true);
      toast.success(`Template loaded: "${tmpl.title}"`, {
        description: `${tmpl.category} • ${tmpl.aspectRatio} • ${tmpl.duration}s. Click Generate Video or customize your prompt!`,
      });
      setTimeout(() => {
        promptInputRef.current?.focus();
        promptContainerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 250);
    }
  }, [searchParams]);

  const [aiStatus, setAiStatus] = useState<{
    provider: string;
    model: string;
    configured: boolean;
    status: string;
    statusLabel: string;
    message?: string;
    lastChecked?: string;
  } | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const fetchAiStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const { ok, status, data, error } = await safeJsonFetch("/api/ai/status");
      if (ok && data) {
        setAiStatus(data);
      } else {
        setAiStatus({
          provider: "backend",
          model: "unknown",
          configured: false,
          status: "error",
          statusLabel: "Status Check Failed",
          message: error || `HTTP ${status}`,
        });
      }
    } catch (err: any) {
      setAiStatus({
        provider: "backend",
        model: "offline",
        configured: false,
        status: "unavailable",
        statusLabel: "Provider Service Offline",
        message: err.message,
      });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const [models, setModels] = useState<Array<{
    id: string;
    name: string;
    owned_by: string;
    created?: number;
    isVerifiedFree?: boolean;
  }>>([]);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3-flash");
  const [modelSearch, setModelSearch] = useState<string>("");
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<{
    latencyMs?: number;
    message?: string;
    error?: string;
    errorCategory?: string;
  } | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState<boolean>(false);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchModels = async () => {
    setIsLoadingModels(true);
    setModelError(null);
    try {
      const { ok, status, data, error } = await safeJsonFetch("/api/ai/models");
      if (ok && data && Array.isArray(data.models)) {
        setModels(data.models);
        if (data.defaultModel && (!selectedModel || selectedModel === "default-model")) {
          setSelectedModel(data.defaultModel);
        }
      } else {
        setModelError(error || data?.error || `HTTP ${status}: Failed to reach models endpoint`);
      }
    } catch (err: any) {
      setModelError(err.message || "Network error loading models");
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedModel) return;
    setTestStatus("testing");
    setTestResult(null);
    try {
      const { ok, data, error } = await safeJsonFetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
      });
      if (ok && data) {
        setTestStatus("success");
        setTestResult({
          latencyMs: data.latencyMs,
          message: data.message || `Connected (${data.latencyMs}ms)`,
        });
        toast.success(`Connected to ${selectedModel} (${data.latencyMs}ms)`);
      } else {
        setTestStatus("error");
        setTestResult({
          latencyMs: data?.latencyMs,
          error: error || data?.error || "Connection test failed",
          errorCategory: data?.errorCategory || "ERROR",
        });
        toast.error(error || data?.error || `Connection test failed for ${selectedModel}`);
      }
    } catch (err: any) {
      setTestStatus("error");
      setTestResult({
        error: err.message || "Failed to test connection",
        errorCategory: "NETWORK_ERROR",
      });
      toast.error(err.message || "Failed to test connection");
    }
  };

  useEffect(() => {
    fetchAiStatus();
    fetchModels();
  }, []);

  const filteredModels = models.filter((m) => {
    if (!modelSearch.trim()) return true;
    const q = modelSearch.toLowerCase();
    return (m.id && m.id.toLowerCase().includes(q)) || (m.name && m.name.toLowerCase().includes(q));
  });

  // Query workspace assets
  const workspaceAssets = useQuery(
    api.assets.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

  // Query recent projects for Recent Work section
  const recentProjects = useQuery(
    api.projects.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip",
  );

  useEffect(() => {
    const assetIdParam = searchParams.get("assetId");
    if (
      assetIdParam &&
      !selectedAssetIds.includes(assetIdParam as Id<"assets">)
    ) {
      setSelectedAssetIds((prev) => [...prev, assetIdParam as Id<"assets">]);
    }

    const promptParam = searchParams.get("prompt");
    if (promptParam) {
      setPrompt(promptParam);
      const dur = extractDuration(promptParam);
      if (dur) setDuration(dur);
      if (searchParams.get("duration")) {
        const d = Number(searchParams.get("duration"));
        if (!isNaN(d) && d > 0) setDuration(d);
      }
      if (searchParams.get("aspectRatio")) {
        setAspectRatio(searchParams.get("aspectRatio")!);
      }
    }

    const projIdParam = searchParams.get("projectId") || searchParams.get("id");
    if (projIdParam && !activeProjectId) {
      setActiveProjectId(projIdParam as any);
    }
  }, [searchParams]);

  const isConvexProjectId =
    typeof activeProjectId === "string" &&
    !activeProjectId.startsWith("plan_") &&
    !activeProjectId.startsWith("proj_") &&
    !activeProjectId.startsWith("temp_") &&
    !activeProjectId.includes("_") &&
    activeProjectId.length > 20;

  // Reactive subscription to active project status
  const liveActiveProject = useQuery(
    api.projects.get,
    isConvexProjectId ? { projectId: activeProjectId as Id<"projects"> } : "skip",
  );

  const [polledProject, setPolledProject] = useState<any>(null);

  // Resilient fallback polling to guarantee the 5 stages advance smoothly even if WebSockets experience drops
  useEffect(() => {
    if (!activeProjectId) {
      setPolledProject(null);
      return;
    }

    let isMounted = true;
    const pollStatus = async () => {
      if (isConvexProjectId) {
        try {
          const convexUrl =
            (typeof window !== "undefined" &&
              document
                .querySelector('meta[name="convex-url"]')
                ?.getAttribute("content")) ||
            process.env.NEXT_PUBLIC_CONVEX_URL ||
            "http://127.0.0.1:3210";

          const { ok, data } = await safeJsonFetch(`${convexUrl}/api/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: "projects:get",
              args: { projectId: activeProjectId },
              format: "json",
            }),
          });

          if (ok && isMounted && data?.value) {
            setPolledProject(data.value);
            if (
              data.value.status === "completed" ||
              data.value.status === "failed"
            ) {
              setIsSubmitting(false);
            }
            return;
          }
        } catch (err) {
          // Silently continue to direct API check
        }
      }

      // Direct API Status Check Fallback (for Cloudflare tunnel & offline Convex)
      try {
        const { ok, data } = await safeJsonFetch(
          `/api/generate/status?projectId=${activeProjectId}`,
        );
        if (ok && isMounted && data) {
          setPolledProject((prev: any) => ({
            ...prev,
            ...data,
            _id: activeProjectId,
          }));
          if (data.status === "completed" || data.status === "failed") {
            setIsSubmitting(false);
          }
        }
      } catch (directErr) {
        // Silently retry on next interval
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeProjectId]);

  // Merge live query and polled state so the UI continuously advances through all 5 stages
  const activeProject = useMemo(() => {
    if (!liveActiveProject && !polledProject) return null;
    if (!liveActiveProject) return polledProject;
    if (!polledProject) return liveActiveProject;

    const liveStage = getStageIndex(liveActiveProject.status || "");
    const polledStage = getStageIndex(polledProject.status || "");

    if (polledStage >= liveStage) {
      return { ...liveActiveProject, ...polledProject };
    }
    return { ...polledProject, ...liveActiveProject };
  }, [liveActiveProject, polledProject]);

  useEffect(() => {
    if (activeProject?.productionPlan && !videoPlan) {
      setVideoPlan(activeProject.productionPlan);
    }
  }, [activeProject, videoPlan]);

  const toggleAsset = (assetId: Id<"assets">) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId],
    );
  };

  const handleSelectInspiration = (item: InspirationItem) => {
    setSelectedInspirationIds((prev) => {
      const isAlready = prev.includes(item.id);
      const next = isAlready
        ? prev.filter((id) => id !== item.id)
        : [...prev, item.id];

      const selectedItems = INSPIRATIONS.filter((i) => next.includes(i.id));

      if (selectedItems.length === 0) {
        setPrompt("");
        setName("");
      } else if (selectedItems.length === 1 && selectedItems[0]) {
        const item = selectedItems[0];
        setPrompt(item.prompt);
        setName(item.title);
        setDuration(item.duration);
        setAspectRatio(item.aspectRatio);
        toast.success(`Selected: ${item.title}`);
      } else {
        const combinedTitle =
          selectedItems.map((i) => i.title.split(" ")[0]).join(" + ") +
          " Hybrid";
        const combinedPrompt =
          `Create an advanced multi-scene video composition combining the following concepts and styles:\n\n` +
          selectedItems
            .map((i, idx) => `Part ${idx + 1} (${i.title}):\n${i.prompt}`)
            .join("\n\n") +
          `\n\nEnsure a fluid transition between all scenes with unified modern typography, consistent ambient lighting, and cinematic motion graphics.`;
        setPrompt(combinedPrompt);
        setName(combinedTitle);
        const combinedDuration = Math.min(
          60,
          Math.max(30, selectedItems.length * 10),
        );
        setDuration(combinedDuration);
        toast.success(
          `Combined ${selectedItems.length} inspirations into your prompt!`,
        );
      }

      return next;
    });
  };

  const handleClearInspiration = () => {
    setSelectedInspirationIds([]);
    setPrompt("");
    setName("");
    toast("Inspirations cleared");
  };

  // Direct Video & Media Upload Handler (Supports multiple files simultaneously)
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const targetWs = current || activeWorkspaceId;

    setIsUploadingMedia(true);
    const toastId = toast.loading(
      files.length === 1
        ? `Uploading reference media: ${files[0]?.name || "file"}...`
        : `Uploading ${files.length} reference assets...`,
    );

    try {
      const uploadedIds: Id<"assets">[] = [];

      for (const file of files) {
        let assetType = "image";
        if (
          file.type.startsWith("video/") ||
          /\.(mp4|webm|mov|m4v)$/i.test(file.name)
        ) {
          assetType = "video";
        } else if (
          file.type.startsWith("audio/") ||
          /\.(mp3|wav|m4a|aac)$/i.test(file.name)
        ) {
          assetType = "audio";
        }

        const maxMb = assetType === "video" ? 500 : 25;
        if (file.size > maxMb * 1024 * 1024) {
          toast.error(`File ${file.name} exceeds ${maxMb}MB limit for ${assetType}s`);
          continue;
        }

        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const res = reader.result as string;
            const base64 = res.split(",")[1];
            resolve(base64 || "");
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const data = await base64Promise;

        const { ok, data: uploadData, error } = await safeJsonFetch(`/assets/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: current,
            name: file.name,
            originalFilename: file.name,
            type: assetType,
            mimeType:
              file.type ||
              (assetType === "video" ? "video/mp4" : "image/jpeg"),
            data,
          }),
        });

        if (!ok || !uploadData) {
          throw new Error(
            error || `Upload failed for ${file.name}`,
          );
        }

        const newAssetId = await createAsset({
          workspaceId: targetWs,
          name: file.name,
          originalFilename: file.name,
          type: assetType,
          mimeType: uploadData.mimeType,
          size: uploadData.size,
          storageProvider: uploadData.storageProvider || "local",
          storageKey: uploadData.storageKey,
          storageUrl: uploadData.storageUrl,
          cdnUrl: uploadData.cdnUrl,
        });

        if (newAssetId) {
          uploadedIds.push(newAssetId as Id<"assets">);
        }
      }

      if (uploadedIds.length > 0) {
        setSelectedAssetIds((prev) => [...prev, ...uploadedIds]);
        toast.success(
          files.length === 1
            ? `${files[0]?.name || "Asset"} uploaded & attached!`
            : `${uploadedIds.length} assets uploaded & attached to video!`,
          { id: toastId },
        );
      }
    } catch (err: any) {
      console.error("Media upload error:", err);
      toast.error(err.message || "Failed to upload reference media", {
        id: toastId,
      });
    } finally {
      setIsUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete Workspace Asset Handler
  const handleDeleteAsset = async (
    e: React.MouseEvent,
    assetId: Id<"assets">,
    name: string,
    storageKey?: string,
  ) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await removeAsset({ assetId });
      if (storageKey) {
        fetch(`/storage/${storageKey}`, { method: "DELETE" }).catch(() => {});
        fetch(`/backend-api/assets/${storageKey}`, { method: "DELETE" }).catch(() => {});
      }
      setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId));
      toast.success(`Deleted ${name}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete asset");
    }
  };

  const handleSubmit = async (e?: React.FormEvent, explicitPrompt?: string) => {
    if (e) e.preventDefault();
    let promptValue = (explicitPrompt || prompt || "").trim();
    if (!promptValue) {
      toast.error("Please enter a video prompt");
      return;
    }

    // Intelligent Direct HTML Auto-detection:
    // If user pastes HTML source code into the prompt box, automatically route to Direct Code Mode
    const isDirectHtml =
      /^\s*<(!doctype|html|div|section|main|head|body|svg)/i.test(promptValue) ||
      (promptValue.includes("<div") && promptValue.includes("</div>")) ||
      (promptValue.includes("<style") && promptValue.includes("</style>")) ||
      (promptValue.includes("<h1") && promptValue.includes("</h1>"));

    if (isDirectHtml) {
      toast.info("Direct HTML detected! Rendering your custom HTML directly without AI alteration...");
      setDirectHtml(promptValue);
      setPipelineMode("direct_code");
      return handleRenderDirectCode(promptValue);
    }

    if (selectedTypographyStyle === "comic_hero" && !promptValue.toLowerCase().includes("bebas")) {
      promptValue += " (Typography: Bebas Neue bold display headers, Montserrat body)";
    } else if (selectedTypographyStyle === "cyberpunk" && !promptValue.toLowerCase().includes("orbitron")) {
      promptValue += " (Typography: Orbitron futuristic display headers, Space Grotesk body)";
    } else if (selectedTypographyStyle === "luxury" && !promptValue.toLowerCase().includes("playfair")) {
      promptValue += " (Typography: Playfair Display high-contrast serif headers, Cinzel body)";
    } else if (selectedTypographyStyle === "kinetic" && !promptValue.toLowerCase().includes("syne")) {
      promptValue += " (Typography: Syne ultra-bold kinetic headers, Outfit body)";
    } else if (selectedTypographyStyle === "saas" && !promptValue.toLowerCase().includes("jakarta")) {
      promptValue += " (Typography: Plus Jakarta Sans modern headers, Inter body)";
    }
    const targetWs = current || activeWorkspaceId;

    setIsSubmitting(true);
    try {
      let width = 1920;
      let height = 1080;
      if (aspectRatio === "9:16") {
        width = resolution === "1080p" ? 1080 : 720;
        height = resolution === "1080p" ? 1920 : 1280;
      } else if (aspectRatio === "1:1") {
        width = resolution === "1080p" ? 1080 : 720;
        height = resolution === "1080p" ? 1080 : 720;
      } else {
        width = resolution === "1080p" ? 1920 : 1280;
        height = resolution === "1080p" ? 1080 : 720;
      }

      let projectName = name.trim();
      const pLower = promptValue.toLowerCase();
      const isPresetTitle =
        INSPIRATIONS.some(
          (i) => i.title.toLowerCase() === projectName.toLowerCase(),
        ) ||
        projectName.toLowerCase() === "tech academy ad" ||
        projectName.toLowerCase() === "cinematic product video";

      if (pLower.includes("ollima")) {
        projectName = "Ollima Commercial";
      } else if (pLower.includes("networks home")) {
        projectName = "Networks Home";
      } else if (
        !projectName ||
        projectName.toLowerCase().includes("quarterly") ||
        isPresetTitle
      ) {
        const stripped = promptValue
          .replace(
            /^create\s+(?:a\s+)?(?:\d+[- ]seconds?\s+)?(?:cinematic\s+)?(?:product\s+)?(?:advertisement|video|presentation)?\s*(?:of|for|about)?\s*/i,
            "",
          )
          .replace(
            /\s*(?:with\s+three\s+scenes|smooth transitions|final call).*$/i,
            "",
          )
          .trim();
        projectName = stripped
          ? stripped.charAt(0).toUpperCase() + stripped.slice(1, 35)
          : "AI Video Project";
      }


      const promptDur = extractDuration(promptValue);
      const effectiveDuration = promptDur || duration;

      // Avatar and voice generation disabled
      const isAvatarRequested = false;
      const effectiveAvatarId: string | undefined = undefined;
      const effectiveAvatarName: string | undefined = undefined;
      const effectiveVoiceId: string | undefined = undefined;
      const effectiveVoiceName: string | undefined = undefined;
      const isAvatarVideo = false;
      const effectiveGenerationMode = "hyperframes_only";

      // Auto-resolve workspace assets if none explicitly checked but prompt references them
      let effectiveSelectedAssetIds = [...selectedAssetIds];
      if (effectiveSelectedAssetIds.length === 0 && workspaceAssets && workspaceAssets.length > 0) {
        const mentionsAssets = /\b(workspace\s*assets|reference\s*media|attached|attach|photo|image|picture|logo|vikas|swami|ollasoftware|networkers)\b/i.test(promptValue);
        if (mentionsAssets) {
          const matched = workspaceAssets.filter((a: any) => {
            const name = (a.name || a.originalFilename || "").toLowerCase();
            const pLow = promptValue.toLowerCase();
            return (
              (name && pLow.includes(name.split(".")[0])) ||
              pLow.includes("workspace assets") ||
              pLow.includes("attached") ||
              pLow.includes("reference media")
            );
          });
          if (matched.length > 0) {
            effectiveSelectedAssetIds = matched.map((a: any) => a._id);
          } else {
            effectiveSelectedAssetIds = workspaceAssets.map((a: any) => a._id);
          }
        }
      }
      const effectiveAssets = (workspaceAssets || []).filter((a: any) => effectiveSelectedAssetIds.includes(a._id));

      let projectId: any = null;

      // =========================================================================
      // MODE A: PLAN MODE (Review & Refine Plan before Rendering)
      // =========================================================================
      if (creationMode === "plan") {
        setIsGeneratingPlan(true);
        toast.info("AI Video Agent is analyzing prompt and developing video production plan...");

        try {
          const { ok, data: planData, error } = await safeJsonFetch("/api/agent/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: promptValue,
              duration: effectiveDuration,
              orientation: aspectRatio === "9:16" ? "portrait" : aspectRatio === "1:1" ? "square" : "landscape",
              width,
              height,
              fps,
              workspaceId: targetWs,
              assets: effectiveAssets,
              compositionMode,
              visualStyle,
              avatarLanguage: avatarLanguage !== "all" ? avatarLanguage : undefined,
              avatarId: effectiveAvatarId,
              avatarName: effectiveAvatarName,
              voiceId: effectiveVoiceId,
              voiceName: effectiveVoiceName,
              apiKey: heygenApiKey || undefined,
              generationMode: effectiveGenerationMode,
              isAvatarVideo,
              bgmTrack: autoMusicEnabled ? selectedBgmTrack : "none",
              bgmVolume,
              enableDucking: musicDuckingEnabled,
              preserveNarration: preserveNarrationSetting,
              musicStyle: selectedMusicStyle,
              musicSource: selectedMusicSource,
              customBgmPath: customBgm?.localPath,
              model: selectedModel,
              mode: "plan",
            }),
          });
          if (!ok || !planData || !planData.plan) {
            throw new Error(error || planData?.error || "Failed to generate video production plan");
          }
          const generatedPlan = planData.plan;
          setVideoPlan(generatedPlan);

          try {
            const validAssetIds = effectiveSelectedAssetIds.filter(
              (id) => typeof id === "string" && !id.includes("_") && id.length > 20,
            );
            const res: any = await createProject({
              workspaceId: targetWs,
              name: projectName,
              prompt: promptValue,
              duration: effectiveDuration,
              width,
              height,
              fps,
              assetIds: validAssetIds.length > 0 ? (validAssetIds as Id<"assets">[]) : undefined,
              model: selectedModel,
              avatarId: effectiveAvatarId,
              avatarName: effectiveAvatarName,
              voiceId: effectiveVoiceId,
              voiceName: effectiveVoiceName,
              generationMode: effectiveGenerationMode,
              isAvatarVideo,
              mode: "plan",
              productionPlan: generatedPlan,
              planStatus: "ready",
            });
            projectId = res.projectId;
          } catch (convexErr) {
            projectId = `plan_${Date.now()}`;
          }

          setActiveProjectId(projectId);
          setPolledProject({
            _id: projectId,
            name: projectName,
            prompt: promptValue,
            status: "plan_ready",
            planStatus: "ready",
            duration: effectiveDuration,
            productionPlan: generatedPlan,
          });
          toast.success("Production plan ready! Review scenes, direction, and script below.");
        } finally {
          setIsGeneratingPlan(false);
          setIsSubmitting(false);
        }
        return;
      }

      // =========================================================================
      // MODE B: AUTOPILOT MODE (Autonomous end-to-end plan & render)
      // =========================================================================
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Convex connection timeout")), 2000),
        );
        const validAssetIds = effectiveSelectedAssetIds.filter(
          (id) => typeof id === "string" && !id.includes("_") && id.length > 20,
        );
        const res: any = await Promise.race([
          createProject({
            workspaceId: targetWs,
            name: projectName,
            prompt: promptValue,
            duration: effectiveDuration,
            width,
            height,
            fps,
            assetIds: validAssetIds.length > 0 ? (validAssetIds as Id<"assets">[]) : undefined,
            model: selectedModel,
            avatarId: effectiveAvatarId,
            avatarName: effectiveAvatarName,
            voiceId: effectiveVoiceId,
            voiceName: effectiveVoiceName,
            generationMode: effectiveGenerationMode,
            isAvatarVideo,
            mode: "autopilot",
          }),
          timeoutPromise,
        ]);
        projectId = res.projectId;
      } catch (convexErr: any) {
        console.warn("[Convex Notice] Using direct /api/generate pipeline fallback:", convexErr?.message || convexErr);
        const { ok, data: directData, error } = await safeJsonFetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptValue,
            duration: effectiveDuration,
            width,
            height,
            fps,
            model: selectedModel,
            compositionMode,
            visualStyle,
            avatarLanguage: undefined,
            avatarId: undefined,
            avatarName: undefined,
            voiceId: undefined,
            voiceName: undefined,
            apiKey: undefined,
            generationMode: "hyperframes_only",
            isAvatarVideo: false,
            bgmTrack: autoMusicEnabled ? selectedBgmTrack : "none",
            bgmVolume,
            enableDucking: musicDuckingEnabled,
            preserveNarration: preserveNarrationSetting,
            musicStyle: selectedMusicStyle,
            musicSource: selectedMusicSource,
            customBgmPath: customBgm?.localPath,
            mode: "autopilot",
            workspaceId: targetWs,
            assets: effectiveAssets,
            assetIds: effectiveSelectedAssetIds.length > 0 ? effectiveSelectedAssetIds : undefined,
            imageSettings: {
              wikimediaEnabled,
              pexelsEnabled: Boolean(pexelsApiKey.trim()) || pexelsEnabled,
              pexelsApiKey: pexelsApiKey.trim(),
              unsplashEnabled: Boolean(unsplashAccessKey.trim()) || unsplashEnabled,
              unsplashAccessKey: unsplashAccessKey.trim(),
              workspaceEnabled: true,
              aiFallbackEnabled: aiImageFallback,
              imageReviewMode,
              searchPriority: ["workspace", "wikimedia", "pexels", "unsplash"],
              maxImagesPerVideo: 10,
              requireLicenseVerification: true,
              displayAttribution: true,
            },
          }),
        });
        if (!ok || !directData) {
          throw new Error(error || "Generation failed to start");
        }
        projectId = directData.projectId;
        setPolledProject({
          _id: projectId,
          name: projectName,
          prompt: promptValue,
          status: "writing_composition",
          duration: effectiveDuration,
        });
      }

      setActiveProjectId(projectId);
      toast.success("Video generation job created in Autopilot Mode!");
    } catch (err: any) {
      toast.error(err.message || "Failed to start generation");
      setIsSubmitting(false);
    }
  };

  const handleApproveAndRender = async () => {
    if (!videoPlan) return;
    setIsSubmitting(true);
    try {
      toast.info("Approving plan and dispatching autonomous video render...");
      if (activeProjectId && typeof activeProjectId === "string" && !activeProjectId.startsWith("plan_") && !activeProjectId.startsWith("proj_")) {
        try {
          await approveAndRenderPlan({
            projectId: activeProjectId as Id<"projects">,
            model: selectedModel,
          });
        } catch (convexErr) {
          console.warn("[Convex Notice] Using direct backend trigger:", convexErr);
        }
      }

      const width = videoPlan.creativeBrief?.width || (aspectRatio === "9:16" ? 1080 : 1920);
      const height = videoPlan.creativeBrief?.height || (aspectRatio === "9:16" ? 1920 : 1080);
      const dur = videoPlan.creativeBrief?.duration || duration;

      const { ok, data: directData, error } = await safeJsonFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProjectId || `proj_${Date.now()}`,
          prompt: videoPlan.prompt,
          duration: dur,
          width,
          height,
          fps: videoPlan.creativeBrief?.fps || fps,
          model: selectedModel,
          productionPlan: videoPlan,
          compositionMode,
          visualStyle,
          generationMode: "hyperframes_only",
          isAvatarVideo: false,
            bgmTrack: autoMusicEnabled ? selectedBgmTrack : "none",
            bgmVolume,
            enableDucking: musicDuckingEnabled,
            preserveNarration: preserveNarrationSetting,
            musicStyle: selectedMusicStyle,
            musicSource: selectedMusicSource,
            customBgmPath: customBgm?.localPath,
            mode: "plan",
            workspaceId: activeWorkspaceId,
            assets: videoPlan.mediaPlan?.userAssets || (workspaceAssets || []).filter((a: any) => selectedAssetIds.includes(a._id)),
            assetIds: selectedAssetIds.length > 0 ? selectedAssetIds : undefined,
            imageSettings: {
              wikimediaEnabled,
              pexelsEnabled: Boolean(pexelsApiKey.trim()) || pexelsEnabled,
              pexelsApiKey: pexelsApiKey.trim(),
              unsplashEnabled: Boolean(unsplashAccessKey.trim()) || unsplashEnabled,
              unsplashAccessKey: unsplashAccessKey.trim(),
              workspaceEnabled: true,
              aiFallbackEnabled: aiImageFallback,
              imageReviewMode,
              searchPriority: ["workspace", "wikimedia", "pexels", "unsplash"],
              maxImagesPerVideo: 10,
              requireLicenseVerification: true,
              displayAttribution: true,
            },
          }),
      });

      if (!ok || !directData) {
        throw new Error(error || "Failed to start render");
      }
      const realProjectId = directData.projectId || activeProjectId;
      setActiveProjectId(realProjectId);
      setPolledProject({
        _id: realProjectId,
        name: videoPlan.creativeBrief?.title || "AI Video Project",
        prompt: videoPlan.prompt,
        status: "writing_composition",
        duration: dur,
        productionPlan: videoPlan,
      });
      toast.success("Plan approved! Rendering HyperFrames video...");
    } catch (err: any) {
      toast.error(err.message || "Failed to start render");
      setIsSubmitting(false);
    }
  };

  const handleRefinePlan = async (feedback: string) => {
    if (!feedback.trim() || !videoPlan || isRevisingPlan) return;
    setIsRevisingPlan(true);
    try {
      const { ok, data, error } = await safeJsonFetch("/api/agent/revise-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPlan: videoPlan,
          feedback: feedback.trim(),
          model: selectedModel,
        }),
      });
      if (!ok || !data?.plan) {
        throw new Error(error || data?.error || "Failed to revise production plan");
      }
      setVideoPlan(data.plan);

      if (activeProjectId && typeof activeProjectId === "string" && !activeProjectId.startsWith("plan_") && !activeProjectId.startsWith("proj_")) {
        try {
          await saveProductionPlan({
            projectId: activeProjectId as Id<"projects">,
            productionPlan: data.plan,
            chatMessage: feedback.trim(),
          });
        } catch (e) {}
      }
      toast.success("Production plan revised by AI Video Agent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update plan");
    } finally {
      setIsRevisingPlan(false);
    }
  };

  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    const auto = searchParams.get("autoStart");
    const pParam = searchParams.get("prompt");
    if (auto === "1" && pParam && !hasAutoStartedRef.current && !activeProjectId) {
      hasAutoStartedRef.current = true;
      const t = setTimeout(() => {
        handleSubmit(undefined, pParam);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [searchParams, activeProjectId]);



  const getStepStatus = (
    stepIndex: number,
  ): "waiting" | "in_progress" | "completed" | "failed" => {
    if (!activeProject) return "waiting";
    const status = (activeProject.status || "").toLowerCase();
    const stageStr = (activeProject.stage || "").toLowerCase();
    let currentIdx = getStageIndex(stageStr && stageStr !== "failed" ? stageStr : status);

    if (status === "failed") {
      if (currentIdx === 0 && (activeProject.error || "").match(/check|validat|overlap|occlu|lint|repair/i)) {
        currentIdx = 3; // Checking its own work
      } else if (currentIdx === 0 && (activeProject.error || "").match(/render|ffmpeg|ffprobe/i)) {
        currentIdx = 4; // Rendering the video
      }
      if (stepIndex === currentIdx) return "failed";
      if (stepIndex < currentIdx) return "completed";
      return "waiting";
    }

    if (status === "completed") return "completed";

    if (stepIndex < currentIdx) return "completed";
    if (stepIndex === currentIdx) return "in_progress";
    return "waiting";
  };

  const calculateProgressPercent = () => {
    if (!activeProject) return 5;
    const status = activeProject.status.toLowerCase();
    if (status === "completed") return 100;
    if (status === "failed") return 100;

    const idx = getStageIndex(status);
    const progressMap = [20, 40, 60, 80, 95, 100];
    return progressMap[idx] || 20;
  };

  const filteredInspirations =
    activeCategory === "All"
      ? INSPIRATIONS
      : INSPIRATIONS.filter((item) => item.category === activeCategory);

  const selectedInspirations = INSPIRATIONS.filter((i) =>
    selectedInspirationIds.includes(i.id),
  );

  const attachedAssets = (workspaceAssets || []).filter((a: any) =>
    selectedAssetIds.includes(a._id),
  );

  const visibleAssets = (workspaceAssets || []).filter((a: any) => {
    if (assetFilter === "all") return true;
    return a.type === assetFilter;
  });

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] w-full flex-col justify-start bg-[#fcfdfe] dark:bg-[#090d14] text-slate-800 dark:text-slate-100 px-4 py-6 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-start space-y-6">

        {/* BRAND LOGO & MOTTO (Ollastar with Coconut Tree Logo) */}
        <div className="flex flex-col items-center justify-center space-y-4 pt-2">
          <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center hover:scale-105 transition-transform duration-200">
            <img
              src="/ollastar-logo.png"
              alt="Ollastar"
              className="h-full w-full object-contain dark:invert"
            />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-center text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Create videos at the speed of thought
            </h1>
          </div>

          {/* Centered Mode Switcher Pill */}
          <div className="flex items-center justify-center pt-1">
            <div className="flex items-center gap-1 rounded-full border border-slate-200/90 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-800/90 shadow-2xs">
              <button
                type="button"
                onClick={() => setPipelineMode("ai_prompt")}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                  pipelineMode === "ai_prompt"
                    ? "bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>AI Prompt Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setPipelineMode("direct_code")}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                  pipelineMode === "direct_code"
                    ? "bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Code2 className="h-3.5 w-3.5 shrink-0" />
                <span>Direct Code Mode</span>
              </button>
            </div>
          </div>
        </div>


        {/* HEYGEN VIDEO AGENT: PLAN MODE STUDIO */}
        {videoPlan && (!activeProject || activeProject.status === "plan_ready") && !isSubmitting && (
          <VideoProductionPlanStudio
            plan={videoPlan}
            onApproveAndRender={handleApproveAndRender}
            onRefinePlan={handleRefinePlan}
            isRevising={isRevisingPlan}
            isRendering={isSubmitting}
            onDismiss={() => {
              setVideoPlan(null);
              setActiveProjectId(null);
            }}
          />
        )}

        {/* ACTIVE JOB PROGRESS OVERLAY / CARD */}
        {activeProjectId && activeProject && activeProject.status !== "plan_ready" && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-3 w-3 rounded-full ${
                    activeProject.status === "completed"
                      ? "bg-emerald-500"
                      : activeProject.status === "failed"
                        ? "bg-rose-500"
                        : "bg-blue-500 animate-ping"
                  }`}
                />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {activeProject.status === "completed"
                      ? "Video Generated Successfully"
                      : activeProject.status === "failed"
                        ? "Video Generation Failed"
                        : "Generating HyperFrames Composition..."}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">
                    Stage:{" "}
                    <span className="font-mono uppercase font-bold text-slate-800 dark:text-neutral-200">
                      {activeProject.status.replace(/_/g, " ")}
                    </span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {calculateProgressPercent()}%
                </span>
              </div>
            </div>

            <div className="my-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-neutral-800">
              <div
                className={`h-full transition-all duration-500 ${
                  activeProject.status === "failed"
                    ? "bg-rose-500"
                    : activeProject.status === "completed"
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-blue-500 to-indigo-500"
                }`}
                style={{ width: `${calculateProgressPercent()}%` }}
              />
            </div>

            <div className="flex flex-col gap-2.5 py-2">
              {PIPELINE_STAGES.map((st, sIdx) => {
                const sState = getStepStatus(sIdx);
                const isCorrection =
                  st.id === "checking_composition" &&
                  activeProject.status?.toLowerCase().includes("correcting");

                return (
                  <div
                    key={st.id}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-colors ${
                      sState === "in_progress"
                        ? "border-blue-300 bg-blue-50/80 shadow-xs dark:border-blue-500/40 dark:bg-blue-500/10"
                        : sState === "completed"
                          ? "border-slate-200/90 bg-slate-50/70 dark:border-neutral-800 dark:bg-white/5"
                          : sState === "failed"
                            ? "border-rose-300 bg-rose-50/80 dark:border-rose-500/30 dark:bg-rose-500/10"
                            : "border-slate-100 bg-white/40 opacity-60 dark:border-white/5 dark:bg-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {sState === "completed" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : sState === "in_progress" ? (
                        <RefreshCw className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
                      ) : sState === "failed" ? (
                        <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                      ) : (
                        <Clock className="h-5 w-5 text-slate-400 dark:text-neutral-500 shrink-0" />
                      )}
                      <div>
                        <span
                          className={`font-semibold text-sm ${
                            sState === "in_progress"
                              ? "text-blue-800 dark:text-blue-200"
                              : sState === "completed"
                                ? "text-slate-900 dark:text-white"
                                : sState === "failed"
                                  ? "text-rose-800 dark:text-rose-200"
                                  : "text-slate-500 dark:text-neutral-400"
                          }`}
                        >
                          {st.label}
                        </span>
                        <p className="text-xs text-slate-500 dark:text-neutral-400">{st.desc}</p>
                      </div>
                    </div>

                    <div>
                      {sState === "completed" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                        </span>
                      )}
                      {sState === "in_progress" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30">
                          <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                          {isCorrection ? "Self-repairing" : "In progress"}
                        </span>
                      )}
                      {sState === "failed" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30">
                          <AlertCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      )}
                      {sState === "waiting" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 border border-slate-200/80 dark:bg-white/5 dark:text-neutral-400 dark:border-white/10">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-neutral-500" /> Waiting
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Video Player & Conversational Surgical Scene Revision */}
            {activeProject.status === "completed" && (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <SurgicalSceneRevision
                  projectId={String(activeProjectId)}
                  videoUrl={activeProject.videoUrl || activeProject.outputUrl || `/outputs/${activeProjectId}.mp4`}
                  scenes={activeProject.productionPlan?.scenes || videoPlan?.scenes || []}
                  onRevisionSuccess={(newUrl) => {
                    setPolledProject((prev: any) => ({
                      ...prev,
                      videoUrl: newUrl,
                      outputUrl: newUrl,
                    }));
                  }}
                />

                {/* Verified Visual Asset Sources & License Attributions Card */}
                {activeProject.assetAttributions && activeProject.assetAttributions.length > 0 && (
                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-neutral-900/60">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-400">
                          <Globe className="h-3.5 w-3.5" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Verified Visual Asset Sources & Licences ({activeProject.assetAttributions.length})
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
                        Legitimate Open-Web Sourcing
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {activeProject.assetAttributions.map((attr: any, idx: number) => (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs flex flex-col justify-between shadow-2xs dark:border-white/5 dark:bg-black/40">
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-neutral-400">Scene {attr.sceneIndex}</span>
                              <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 uppercase dark:bg-blue-500/15 dark:border-blue-500/30 dark:text-blue-300">
                                {attr.provider}
                              </span>
                            </div>
                            <p className="font-semibold text-slate-900 dark:text-neutral-200 line-clamp-1">{attr.assetTitle}</p>
                            <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 line-clamp-1">{attr.attributionText}</p>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-500">
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">{attr.license}</span>
                            {attr.sourceUrl && (
                              <a href={attr.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white flex items-center gap-0.5">
                                Source <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeProject.status === "failed" && (
              <div className="mt-4 rounded-xl bg-rose-500/10 p-4 border border-rose-500/20 text-rose-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Generation Notice</span>
                  </div>
                  {activeProject.error && (activeProject.error.includes("overlap") || activeProject.error.includes("occlu")) && (
                    <span className="text-[11px] font-medium bg-rose-500/20 text-rose-200 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                      Layering Notice Auto-Fix Available
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs opacity-90">{activeProject.error || "Render notice occurred."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveProjectId(null)}>
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                    onClick={async () => {
                      if (pipelineMode === "direct_code") {
                        toast.loading("Auto-repairing code syntax and re-rendering...", { id: "repair" });
                        try {
                          await handleAutoFixDirectCode();
                          await handleRenderDirectCode();
                          return;
                        } catch (err: any) {
                          toast.error(err.message || "Failed to auto-repair direct code", { id: "repair" });
                          return;
                        }
                      }
                      if (activeProjectId) {
                        try {
                          toast.loading("Auto-repairing layout and re-rendering...", { id: "repair" });
                          const { ok, data: json, error } = await safeJsonFetch("/api/agent/repair-layout", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ projectId: String(activeProjectId) }),
                          });
                          if (ok && json?.videoUrl) {
                            toast.success("Layout repaired & video rendered!", { id: "repair" });
                            setPolledProject((prev: any) => ({
                              ...prev,
                              status: "completed",
                              stage: "completed",
                              videoUrl: json.videoUrl,
                              outputUrl: json.videoUrl,
                            }));
                            setIsSubmitting(false);
                            return;
                          }
                          if (error) {
                            throw new Error(error);
                          }
                        } catch (e: any) {
                          toast.error(e.message || "Auto-repair notice", { id: "repair" });
                        }
                      }
                      setActiveProjectId(null);
                      setIsSubmitting(false);
                    }}
                  >
                    Auto-Repair & Render
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveProjectId(null);
                      setIsSubmitting(false);
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}


        {/* CREATION MODE CONTENT: AI PROMPT MODE OR DIRECT CODE MODE */}
        {pipelineMode === "ai_prompt" ? (
          /* MAIN PROMPT CARD (Matching Gamma Center Prompt Box) */
          <form ref={promptContainerRef} onSubmit={handleSubmit} className="w-full max-w-3xl space-y-4">
            <div
              onClick={() => promptInputRef.current?.focus()}
              className="group relative rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-slate-200/40 dark:border-neutral-800 dark:bg-[#111520] dark:shadow-none transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-950/50 cursor-text"
            >
              {/* Attached Reference Media Chips */}
              {attachedAssets.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Attached Media ({attachedAssets.length}):
                  </span>
                  {attachedAssets.map((asset: any) => (
                    <div
                      key={asset._id}
                      className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300"
                    >
                      {asset.type === "video" ? (
                        <FileVideo className="h-3 w-3 text-purple-500" />
                      ) : (
                        <FileImage className="h-3 w-3 text-blue-500" />
                      )}
                      <span className="max-w-[140px] truncate font-medium">{asset.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleAsset(asset._id)}
                        className="ml-1 text-indigo-400 hover:text-indigo-800 dark:hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Large Textarea */}
              <textarea
                ref={promptInputRef}
                required
                rows={3}
                value={prompt}
                onChange={(e) => {
                  const newPrompt = e.target.value;
                  setPrompt(newPrompt);
                  const val = newPrompt.toLowerCase();
                  if (val.includes("ollima")) {
                    setName("Ollima Commercial");
                  } else if (val.includes("networks home")) {
                    setName("Networks Home");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSubmit(e);
                  }
                }}
                placeholder="Describe what you want to create, or paste a script..."
                className="w-full resize-none bg-transparent text-sm sm:text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />

              {/* Bottom Toolbar inside the box (Matching Gamma) */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-neutral-800/80">
                {/* Left Controls: + (Attach), Sliders (Settings) */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-300 dark:hover:bg-neutral-700 transition shadow-2xs cursor-pointer shrink-0"
                    title="Attach media or files"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettingsPopover(!showSettingsPopover);
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border transition shadow-2xs cursor-pointer ${
                        showSettingsPopover
                          ? "border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-300"
                      }`}
                      title="Video Settings (Duration, Ratio, Resolution)"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                    </button>

                    {/* Settings Popover */}
                    {showSettingsPopover && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-10 left-0 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-neutral-800 dark:bg-[#121622] animate-in fade-in zoom-in-95 duration-100"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-neutral-800">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">Video Controls</span>
                          <button type="button" onClick={() => setShowSettingsPopover(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="space-y-3 pt-3">
                          <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Duration</label>
                            <div className="grid grid-cols-4 gap-1.5 mt-1">
                              {[5, 15, 30, 40, 60].map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => setDuration(d)}
                                  className={`rounded-lg py-1 text-xs font-bold transition cursor-pointer ${
                                    duration === d
                                      ? "bg-indigo-600 text-white shadow-xs"
                                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-300"
                                  }`}
                                >
                                  {d}s
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Aspect Ratio</label>
                            <div className="grid grid-cols-3 gap-1.5 mt-1">
                              {[
                                { label: "16:9", val: "16:9" },
                                { label: "9:16", val: "9:16" },
                                { label: "1:1", val: "1:1" },
                              ].map((ar) => (
                                <button
                                  key={ar.val}
                                  type="button"
                                  onClick={() => setAspectRatio(ar.val)}
                                  className={`rounded-lg py-1 text-xs font-bold transition cursor-pointer ${
                                    aspectRatio === ar.val
                                      ? "bg-indigo-600 text-white shadow-xs"
                                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-300"
                                  }`}
                                >
                                  {ar.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Resolution</label>
                            <div className="grid grid-cols-2 gap-1.5 mt-1">
                              {["1080p", "4k"].map((res) => (
                                <button
                                  key={res}
                                  type="button"
                                  onClick={() => setResolution(res)}
                                  className={`rounded-lg py-1 text-xs font-bold transition cursor-pointer ${
                                    resolution === res
                                      ? "bg-indigo-600 text-white shadow-xs"
                                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-300"
                                  }`}
                                >
                                  {res}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Controls: Model Pill (Matching Gamma Lite v), Mic and Send Button */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Model Selector Pill (Matching Gamma Lite dropdown) */}
                  <div className="relative shrink-0" ref={modelDropdownRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowModelDropdown(!showModelDropdown);
                      }}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-slate-200 transition cursor-pointer"
                      title="Select AI Model"
                    >
                      <Sparkles className="h-3 w-3 text-indigo-500" />
                      <span>{selectedModel === "gemini-3-flash" ? "Lite" : selectedModel}</span>
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    </button>

                    {showModelDropdown && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-9 right-0 z-50 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-[#121622] animate-in fade-in zoom-in-95 duration-100"
                      >
                        <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Generation Model
                        </div>
                        <div className="space-y-1">
                          {[
                            { id: "gemini-3-flash", label: "Lite (Fast)", desc: "Gemini Flash 2.5/3" },
                            { id: "gemini-2.5-pro", label: "Pro (High Quality)", desc: "Gemini Pro Reasoning" },
                            { id: "ollama-local", label: "Ollama (Local)", desc: "Local LLM via port 11434" },
                          ].map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSelectedModel(m.id);
                                setShowModelDropdown(false);
                              }}
                              className={`w-full rounded-xl p-2 text-left text-xs transition cursor-pointer ${
                                selectedModel === m.id
                                  ? "bg-indigo-50 text-indigo-700 font-bold dark:bg-indigo-950/60 dark:text-indigo-300"
                                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-neutral-800"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{m.label}</span>
                                {selectedModel === m.id && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                              </div>
                              <p className="text-[10px] text-slate-400 font-normal">{m.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mic Icon */}
                  <button
                    type="button"
                    onClick={() => toast.info("Voice prompt ready (start speaking)")}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-neutral-800 dark:hover:text-white transition cursor-pointer"
                    title="Voice prompt"
                  >
                    <Mic className="h-4 w-4" />
                  </button>

                  {/* Submit Circle Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || isGeneratingPlan || !prompt.trim()}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition shadow-xs cursor-pointer ${
                      prompt.trim()
                        ? "bg-slate-900 text-white hover:bg-indigo-600 dark:bg-white dark:text-slate-900"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-600"
                    }`}
                    title="Generate (Cmd+Enter)"
                  >
                    {isSubmitting || isGeneratingPlan ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          /* DIRECT CODE MODE EDITOR (Phase 2 & Phase 3 — Strict Ollima Bypass) */
          <div className="w-full max-w-3xl space-y-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-slate-200/40 dark:border-neutral-800 dark:bg-[#111520] dark:shadow-none animate-in fade-in duration-200">
            {/* Header with Title and Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Code2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Direct Code Mode
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                    Bypasses Ollima & AI. Directly compiles to HyperFrames & FFmpeg.
                  </p>
                </div>
              </div>

              {/* Right Controls: Language Tabs & Header Render Button */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Code Language Tabs */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-neutral-800">
                  {(["html", "css", "js"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setCodeTab(tab)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                        codeTab === tab
                          ? "bg-white text-indigo-600 shadow-xs dark:bg-neutral-900 dark:text-indigo-400"
                          : "text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Primary Top Render Button — Always visible without scrolling */}
                <button
                  type="button"
                  disabled={isSubmitting || isValidatingCode || !directHtml.trim()}
                  onClick={() => handleRenderDirectCode()}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow-md transition cursor-pointer ${
                    isSubmitting
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-indigo-500/20"
                  }`}
                  title="Render video from this direct code"
                >
                  {isSubmitting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                  <span>Render Video ({directDuration}s)</span>
                </button>
              </div>
            </div>

            {/* Code Editor Area */}
            <div className="relative rounded-2xl border border-slate-800 bg-[#0c1017] p-4 font-mono text-xs shadow-inner">
              <div className="mb-2 flex items-center justify-between border-b border-neutral-800/80 pb-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="font-semibold text-slate-300">
                    {codeTab === "html" ? "index.html" : codeTab === "css" ? "styles.css" : "script.js"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">
                    {codeTab === "html" ? "(HyperFrames Composition Layout)" : codeTab === "css" ? "(Visual Styles)" : "(Timeline & Motion Choreography)"}
                  </span>
                </span>
                <span className="text-[10px] text-slate-500">
                  {codeTab === "html" ? `${directHtml.split("\n").length} lines` : codeTab === "css" ? `${directCss.split("\n").length} lines` : `${directJs.split("\n").length} lines`}
                </span>
              </div>

              {codeTab === "html" && (
                <textarea
                  value={directHtml}
                  onChange={(e) => setDirectHtml(e.target.value)}
                  rows={12}
                  className="w-full max-h-[360px] resize-y overflow-y-auto bg-transparent font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none"
                  placeholder="<!-- Enter HTML here -->"
                  spellCheck={false}
                />
              )}
              {codeTab === "css" && (
                <textarea
                  value={directCss}
                  onChange={(e) => setDirectCss(e.target.value)}
                  rows={12}
                  className="w-full max-h-[360px] resize-y overflow-y-auto bg-transparent font-mono text-xs leading-relaxed text-indigo-200 placeholder:text-slate-600 focus:outline-none"
                  placeholder="/* Enter CSS here */"
                  spellCheck={false}
                />
              )}
              {codeTab === "js" && (
                <textarea
                  value={directJs}
                  onChange={(e) => setDirectJs(e.target.value)}
                  rows={12}
                  className="w-full max-h-[360px] resize-y overflow-y-auto bg-transparent font-mono text-xs leading-relaxed text-emerald-200 placeholder:text-slate-600 focus:outline-none"
                  placeholder="// Enter GSAP timeline registration here"
                  spellCheck={false}
                />
              )}
            </div>

            {/* Validation Feedback */}
            {validationResult && (
              <div className={`rounded-xl p-3.5 text-xs ${
                validationResult.valid
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-bold">
                    {validationResult.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />}
                    <span>{validationResult.valid ? "Source code is valid and ready to render." : "Validation warnings:"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFixDirectCode}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer shrink-0"
                    title="Automatically add class='clip', align timeline IDs, and fix CSS/GSAP issues"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Auto-Fix & Clean Code</span>
                  </button>
                </div>
                {((validationResult.errors && validationResult.errors.length > 0) || ((validationResult as any).warnings && (validationResult as any).warnings.length > 0)) && (
                  <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] opacity-90 border-t border-amber-200/60 dark:border-amber-800/60 pt-2">
                    {(validationResult.errors?.length ? validationResult.errors : (validationResult as any).warnings || []).map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Direct Code Controls & Actions (Sticky Bottom Bar) */}
            <div className="sticky bottom-0 z-20 -mx-5 -mb-5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-md rounded-b-3xl dark:border-neutral-800 dark:bg-[#111520]/95 shadow-lg">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Duration:</span>
                  {[5, 15, 30, 40, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirectDuration(d)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                        directDuration === d
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-300"
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Res:</span>
                  {["1080p", "720p", "4k"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDirectResolution(r)}
                      className={`rounded-lg px-2 py-1 text-xs font-bold transition cursor-pointer ${
                        directResolution === r
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-300"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isValidatingCode || isSubmitting || !directHtml.trim()}
                  onClick={handleAutoFixDirectCode}
                  className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-100 hover:text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 transition cursor-pointer"
                  title="Auto-repair tags, align timeline IDs, add clip classes, and sanitize CSS/GSAP"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Auto-Fix & Clean Code</span>
                </button>

                <button
                  type="button"
                  disabled={isValidatingCode || isSubmitting}
                  onClick={handleValidateDirectCode}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-200 transition cursor-pointer"
                >
                  {isValidatingCode ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
                  <span>Validate Syntax</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || isValidatingCode || !directHtml.trim()}
                  onClick={() => handleRenderDirectCode()}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-white shadow-md transition cursor-pointer ${
                    isSubmitting
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20 active:scale-95"
                  }`}
                >
                  {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  <span>Render Video ({directDuration}s)</span>
                </button>
              </div>
            </div>
          </div>
        )}


        {/* READY-MADE DESIGN TEMPLATES GALLERY */}
        <div className="w-full pt-2 pb-2">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-5">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedTemplateCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                  selectedTemplateCategory === cat
                    ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900 font-semibold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {(() => {
              const matchingTemplates = READY_MADE_TEMPLATES.filter(
                (tmpl) =>
                  selectedTemplateCategory === "All" ||
                  tmpl.category === selectedTemplateCategory,
              );
              const displayed =
                showAllTemplates || selectedTemplateCategory !== "All"
                  ? matchingTemplates
                  : matchingTemplates.slice(0, 6);

              return displayed.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => {
                      setSelectedTemplateId(tmpl.id);
                      setPrompt(tmpl.prompt);
                      setName(tmpl.title);
                      setDuration(tmpl.duration);
                      setAspectRatio(tmpl.aspectRatio);
                      toast.success(`Template loaded: "${tmpl.title}"`, {
                        description: `${tmpl.category} • ${tmpl.aspectRatio} • ${tmpl.duration}s. Review the prompt or click Generate Video!`,
                      });
                      promptInputRef.current?.focus();
                      promptContainerRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }}
                    className={`group cursor-pointer flex flex-col transition rounded-xl p-1.5 ${
                      isSelected
                        ? "ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-md"
                        : "hover:bg-slate-50 dark:hover:bg-neutral-900/60"
                    }`}
                  >
                    <div className="relative aspect-[16/10] w-full rounded-lg overflow-hidden mb-1.5 border border-slate-200/90 shadow-2xs group-hover:shadow-md group-hover:scale-[1.03] transition dark:border-white/10">
                      {tmpl.renderThumbnail()}

                      {/* Aspect Ratio & Duration Tag */}
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 text-white backdrop-blur-xs">
                          {tmpl.aspectRatio}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-600/80 text-white backdrop-blur-xs">
                          {tmpl.duration}s
                        </span>
                      </div>

                      {/* Active Checkmark */}
                      {isSelected && (
                        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 z-10 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[8px] font-bold shadow-xs">
                          <Check className="w-2.5 h-2.5" />
                          <span>Active</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col text-left px-0.5">
                      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                        {tmpl.title}
                      </span>
                      <span className="text-[9px] text-slate-400 dark:text-neutral-500 truncate">
                        {tmpl.category}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* View all templates button (toggles inline without redirecting) */}
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllTemplates(!showAllTemplates)}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/70 px-5 py-2 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-100 hover:border-indigo-300 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                {showAllTemplates
                  ? "Show fewer templates"
                  : "View all 15 ready-made templates"}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-indigo-500 transition-transform duration-200 ${
                  showAllTemplates ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* HORIZONTAL DIVIDER */}
        <div className="my-6 w-full border-t border-slate-200/80 dark:border-neutral-800/80" />

        {/* RECENT WORK SECTION (Matching Image 3) */}
        <div className="w-full space-y-4 pb-8">
          {/* Tabs: Recent work | Recent chats */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRecentTab("work")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                recentTab === "work"
                  ? "bg-[#e9eefe] text-[#3b52d9] dark:bg-indigo-950/60 dark:text-indigo-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <FolderKanban className="h-4 w-4" />
              <span>Recent work</span>
            </button>
            <button
              type="button"
              onClick={() => setRecentTab("chats")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                recentTab === "chats"
                  ? "bg-[#e9eefe] text-[#3b52d9] dark:bg-indigo-950/60 dark:text-indigo-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>Recent chats</span>
            </button>
          </div>

          {/* Recent Work Cards Grid */}
          {recentTab === "work" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recentProjects && recentProjects.length > 0 ? (
                recentProjects.slice(0, 3).map((p: any) => (
                  <Link
                    key={p._id}
                    href={`/projects?id=${p._id}`}
                    className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-xs hover:border-slate-300 hover:shadow-md dark:border-neutral-800 dark:bg-[#121620] transition"
                  >
                    <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-950 mb-3 flex items-center justify-center">
                      {p.videoUrl ? (
                        <video src={p.videoUrl} className="h-full w-full object-cover" muted />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-slate-400">
                          <Film className="h-6 w-6 text-indigo-400" />
                          <span className="text-[10px] font-mono">{p.duration || 15}s</span>
                        </div>
                      )}
                      <span className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white uppercase backdrop-blur-xs">
                        {p.status || "ready"}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition">
                        {p.name || p.prompt?.slice(0, 30) || "Video Project"}
                      </h4>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>{new Date(p._creationTime || Date.now()).toLocaleDateString()}</span>
                        <Globe className="h-3 w-3" />
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                /* High fidelity fallback cards matching Image 3 */
                <>
                  <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-xs hover:border-slate-300 hover:shadow-md dark:border-neutral-800 dark:bg-[#121620] transition cursor-pointer">
                    <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#0c1322] mb-3 flex items-center justify-center p-3">
                      <div className="relative z-10 text-left w-full">
                        <span className="text-[9px] text-blue-400 font-semibold uppercase tracking-wider block">Hardware Tech</span>
                        <span className="text-xs font-bold text-white block mt-0.5">The Power of Tiny Chips: Microprocessors</span>
                      </div>
                      <div className="absolute right-2 bottom-2 h-10 w-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                        <Cpu className="h-5 w-5 text-blue-400" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        The Power of Tiny Chips: Microprocessors and...
                      </h4>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>Viewed 1 year ago</span>
                        <Globe className="h-3 w-3" />
                      </div>
                    </div>
                  </div>

                  <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-xs hover:border-slate-300 hover:shadow-md dark:border-neutral-800 dark:bg-[#121620] transition cursor-pointer">
                    <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#faf8f5] mb-3 flex items-center justify-between p-3 border border-slate-100">
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-900 block">Tree Data Structure</span>
                        <span className="text-[9px] text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5 inline-block mt-1">Site</span>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <Layers className="h-5 w-5 text-emerald-600" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        Tree Data Structure
                      </h4>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span className="truncate max-w-[150px]">tree-data-structure-tyhbk...</span>
                        <span>Viewed 1 year ago</span>
                      </div>
                    </div>
                  </div>

                  <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-xs hover:border-slate-300 hover:shadow-md dark:border-neutral-800 dark:bg-[#121620] transition cursor-pointer">
                    <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-white mb-3 flex flex-col justify-center p-3 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <span>✨</span>
                        <span>Ollastar Tips & Tricks</span>
                      </div>
                      <div className="mt-2 space-y-1 text-[9px] text-slate-500">
                        <div className="flex items-center gap-1"><span className="h-1 w-1 bg-amber-400 rounded-full" /> <span>Direct Code 40s render</span></div>
                        <div className="flex items-center gap-1"><span className="h-1 w-1 bg-blue-400 rounded-full" /> <span>Real media integration</span></div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        Ollastar Tips & Tricks
                      </h4>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>Viewed 1 year ago</span>
                        <Globe className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {recentTab === "chats" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-[#121620]">
              <p className="text-xs text-slate-500 dark:text-neutral-400">No active chat sessions. Generate a video to begin conversation history.</p>
            </div>
          )}

          {/* View all recents button */}
          <div className="mt-4 flex justify-center">
            <Link
              href="/projects?tab=projects"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-300 dark:hover:bg-neutral-800 transition"
            >
              View all recents
            </Link>
          </div>
        </div>
      </div>
            
      {/* FLOATING HELP BUTTON AT BOTTOM RIGHT (Matching Gamma) */}
      <a
        href="https://gamma.app"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 hover:text-slate-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-300 transition z-40"
        title="Help & Questions"
      >
        <HelpCircle className="h-5 w-5" />
      </a>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleMediaUpload}
        className="hidden"
        multiple
        accept="image/*,video/*,audio/*"
      />
    </div>
  );
}

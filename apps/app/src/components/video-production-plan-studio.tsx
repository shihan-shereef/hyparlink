"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Film,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  Palette,
  Type,
  FileText,
  LayoutGrid,
  Send,
  MessageSquare,
  Sliders,
  ChevronRight,
  Layers,
  ArrowRight,
  RefreshCw,
  Wand2,
  Tv,
  Check,
  AlertCircle,
  Eye,
  Video,
} from "lucide-react";
import { Button } from "@v1/ui/button";

export interface PlanScene {
  id: string;
  index: number;
  name: string;
  purpose: string;
  start: number;
  duration: number;
  end: number;
  narration?: string;
  onScreenText?: {
    headline: string;
    highlightedWord?: string;
    subtitle: string;
    badge?: string;
    ctaText?: string;
  };
  visualDescription?: string;
  layoutArchetype?: string;
  animationDirection?: string;
  transition?: string;
  requiredAssets?: string[];
  audioCues?: string;
}

export interface VideoProductionPlan {
  planId: string;
  version: number;
  mode: "plan" | "autopilot";
  prompt: string;
  creativeBrief: {
    title: string;
    subject: string;
    goal: string;
    audience: string;
    videoType: string;
    visualDirection: string;
    tone: string;
    duration: number;
    aspectRatio: "16:9" | "9:16" | "1:1";
    resolution: "1080p" | "720p";
    width: number;
    height: number;
    fps: number;
    colorPalette?: {
      primary: string;
      secondary?: string;
      accent: string;
      backgroundColor: string;
      textColor?: string;
    };
    typography?: {
      displayFont: string;
      bodyFont: string;
      weights?: string[];
    };
  };
  script?: {
    hook?: string;
    fullNarrative?: string;
    callToAction?: string;
    scenesScript?: Array<{
      sceneId: string;
      spokenNarration: string;
      onScreenCopy: string;
    }>;
  };
  scenes: PlanScene[];
  audioPlan?: {
    isSilent: boolean;
    voiceId?: string;
    avatarId?: string;
    backgroundMusicDescription?: string;
  };
  lastRevisionFeedback?: string;
}

interface VideoProductionPlanStudioProps {
  plan: VideoProductionPlan;
  onApproveAndRender: () => Promise<void>;
  onRefinePlan: (feedback: string) => Promise<void>;
  isRevising: boolean;
  isRendering: boolean;
  onDismiss?: () => void;
}

export function VideoProductionPlanStudio({
  plan,
  onApproveAndRender,
  onRefinePlan,
  isRevising,
  isRendering,
  onDismiss,
}: VideoProductionPlanStudioProps) {
  const [feedbackInput, setFeedbackInput] = useState("");
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"scenes" | "brief" | "script">("scenes");

  const brief = plan.creativeBrief || ({} as any);
  const scenes = plan.scenes || [];
  const palette = brief.colorPalette || {
    primary: "#6366f1",
    accent: "#06b6d4",
    backgroundColor: "#070913",
  };
  const typography = brief.typography || {
    displayFont: "Outfit",
    bodyFont: "Inter",
  };

  const handleSendFeedback = (text?: string) => {
    const q = (text || feedbackInput).trim();
    if (!q || isRevising) return;
    onRefinePlan(q);
    setFeedbackInput("");
  };

  const QUICK_PROMPTS = [
    "Make the visual style more cinematic and high-contrast",
    "Change scene 2 to focus directly on product features",
    "Use a brighter visual style with vibrant accents",
    "Make the kinetic typography faster and more energetic",
    "Shorten scene 1 to 2 seconds and extend the climax",
    "Change the final call to action headline",
  ];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/40 backdrop-blur-xl dark:border-neutral-800 dark:bg-[#111520] dark:shadow-none">
      {/* HEADER SECTION */}
      <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-white p-6 dark:border-neutral-800 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-neutral-900/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-300">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-500 dark:text-indigo-400" />
                HEYGEN VIDEO AGENT • PLAN MODE
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600 dark:bg-white/10 dark:text-neutral-300">
                v{plan.version || 1}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                Review & Refine
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {brief.title || "Video Production Plan"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 line-clamp-1 max-w-2xl">
              {brief.goal || plan.prompt}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 shrink-0">
            {onDismiss && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDismiss}
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 cursor-pointer"
              >
                Reset Plan
              </Button>
            )}

            <Button
              onClick={onApproveAndRender}
              disabled={isRendering || isRevising}
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold px-5 py-2.5 shadow-lg shadow-indigo-500/25 hover:opacity-95 transition-all cursor-pointer"
            >
              {isRendering ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Rendering Video...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current mr-2" />
                  Proceed & Render Video ({brief.duration || 15}s)
                </>
              )}
            </Button>
          </div>
        </div>

        {/* REVISION NOTICE IF APPLIED */}
        {plan.lastRevisionFeedback && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3.5 py-2 text-xs text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>Latest Agent Revision:</strong> &ldquo;{plan.lastRevisionFeedback}&rdquo;
            </span>
          </div>
        )}

        {/* METRICS ROW */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-white/5 dark:bg-white/5">
            <div className="text-slate-500 dark:text-neutral-400 font-medium">Target Duration</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              {brief.duration || 15} Seconds
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-white/5 dark:bg-white/5">
            <div className="text-slate-500 dark:text-neutral-400 font-medium">Resolution & Ratio</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
              <Tv className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              {brief.width || 1920}x{brief.height || 1080} ({brief.aspectRatio || "16:9"})
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-white/5 dark:bg-white/5">
            <div className="text-slate-500 dark:text-neutral-400 font-medium">Scenes Planned</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-pink-600 dark:text-pink-400" />
              {scenes.length} Bespoke Scenes
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-white/5 dark:bg-white/5">
            <div className="text-slate-500 dark:text-neutral-400 font-medium">Audio / Narration</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
              <Video className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {plan.audioPlan?.isSilent ? "Silent / BGM" : "Spoken Voiceover"}
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 bg-slate-50/60 px-6 dark:border-white/10 dark:bg-black/30">
        <button
          type="button"
          onClick={() => setActiveTab("scenes")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition cursor-pointer ${
            activeTab === "scenes"
              ? "border-indigo-600 text-indigo-700 dark:border-indigo-500 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Scene Breakdown ({scenes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("brief")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition cursor-pointer ${
            activeTab === "brief"
              ? "border-indigo-600 text-indigo-700 dark:border-indigo-500 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
          }`}
        >
          <Palette className="h-4 w-4" />
          Creative Direction & Palette
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("script")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition cursor-pointer ${
            activeTab === "script"
              ? "border-indigo-600 text-indigo-700 dark:border-indigo-500 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
          }`}
        >
          <FileText className="h-4 w-4" />
          Script & Narrative
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="p-6">
        {/* TAB 1: SCENES BREAKDOWN */}
        {activeTab === "scenes" && (
          <div className="space-y-6">
            {/* Horizontal Timeline Strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {scenes.map((s, idx) => (
                <button
                  key={s.id || idx}
                  type="button"
                  onClick={() => setSelectedSceneIndex(idx)}
                  className={`flex flex-col items-start min-w-[160px] rounded-xl border p-3 text-left transition cursor-pointer ${
                    selectedSceneIndex === idx
                      ? "border-indigo-500 bg-indigo-50/80 shadow-xs dark:border-indigo-500 dark:bg-indigo-500/15"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      Scene {idx + 1}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-neutral-400">
                      {s.duration}s
                    </span>
                  </div>
                  <span className="mt-1 text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">
                    {s.onScreenText?.headline || s.purpose || `Scene ${idx + 1}`}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-neutral-400 mt-1">
                    {formatTime(s.start)} - {formatTime(s.end)}
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Scene Detail Card */}
            {scenes[selectedSceneIndex] && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-white/10">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-2xs">
                      {selectedSceneIndex + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {scenes[selectedSceneIndex].name || `Scene ${selectedSceneIndex + 1}`}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-neutral-400">
                        {scenes[selectedSceneIndex].purpose}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 font-mono text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300">
                      Archetype: {scenes[selectedSceneIndex].layoutArchetype || "custom-layout"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-slate-600 dark:bg-white/10 dark:text-neutral-300">
                      {scenes[selectedSceneIndex].duration}s duration
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Left Column: Copy & Narration */}
                  <div className="space-y-3">
                    <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs dark:bg-black/40 dark:border-white/5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        On-Screen Headline & Copy
                      </span>
                      <p className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                        &ldquo;{scenes[selectedSceneIndex].onScreenText?.headline || "Untitled"}&rdquo;
                      </p>
                      {scenes[selectedSceneIndex].onScreenText?.subtitle && (
                        <p className="text-slate-600 dark:text-neutral-300 mt-0.5">
                          {scenes[selectedSceneIndex].onScreenText?.subtitle}
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs dark:bg-black/40 dark:border-white/5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Spoken Narration / Voiceover
                      </span>
                      <p className="text-slate-700 dark:text-neutral-200 mt-1 italic">
                        {scenes[selectedSceneIndex].narration || "Instrumental motion graphics beat (No spoken voiceover)"}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Visual Description & Animation */}
                  <div className="space-y-3">
                    <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs dark:bg-black/40 dark:border-white/5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        AI Visual Description (Bespoke Layout)
                      </span>
                      <p className="text-slate-600 dark:text-neutral-300 mt-1 leading-relaxed">
                        {scenes[selectedSceneIndex].visualDescription || "Custom generative visual layout designed for this scene."}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs dark:bg-black/40 dark:border-white/5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">
                        Animation & Camera Movement
                      </span>
                      <p className="text-slate-600 dark:text-neutral-300 mt-1">
                        {scenes[selectedSceneIndex].animationDirection || "GSAP coordinated stagger, smooth scale and opacity transforms."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CREATIVE DIRECTION & PALETTE */}
        {activeTab === "brief" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs dark:border-white/10 dark:bg-white/5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Visual Direction
                </span>
                <p className="text-slate-700 dark:text-neutral-200 leading-relaxed text-sm">
                  {brief.visualDirection || "Cinematic modern aesthetic tailored to the prompt."}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs dark:border-white/10 dark:bg-white/5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Tone & Intended Audience
                </span>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-slate-500 dark:text-neutral-400">Tone:</span>
                    <p className="font-semibold text-slate-900 dark:text-white">{brief.tone || "Authoritative"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-neutral-400">Audience:</span>
                    <p className="font-semibold text-slate-900 dark:text-white">{brief.audience || "General Audience"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Color Palette */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs dark:border-white/10 dark:bg-white/5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">
                  Color Palette Swatches
                </span>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="h-10 w-10 rounded-xl border border-slate-200 dark:border-white/20 shadow-xs"
                      style={{ backgroundColor: palette.primary }}
                    />
                    <span className="font-mono text-[10px] text-slate-700 dark:text-neutral-300">
                      {palette.primary}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-neutral-400">Primary</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="h-10 w-10 rounded-xl border border-slate-200 dark:border-white/20 shadow-xs"
                      style={{ backgroundColor: palette.accent }}
                    />
                    <span className="font-mono text-[10px] text-slate-700 dark:text-neutral-300">
                      {palette.accent}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-neutral-400">Accent</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="h-10 w-10 rounded-xl border border-slate-200 dark:border-white/20 shadow-xs"
                      style={{ backgroundColor: palette.backgroundColor }}
                    />
                    <span className="font-mono text-[10px] text-slate-700 dark:text-neutral-300">
                      {palette.backgroundColor}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-neutral-400">Background</span>
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-2xs dark:border-white/10 dark:bg-white/5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Typography Engine Spec
                </span>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-slate-500 dark:text-neutral-400">Display Font:</span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{typography.displayFont}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-neutral-400">Body Font:</span>
                    <p className="font-medium text-slate-700 dark:text-neutral-200 text-sm">{typography.bodyFont}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SCRIPT & NARRATIVE */}
        {activeTab === "script" && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs shadow-2xs dark:border-white/10 dark:bg-white/5">
            <div className="border-b border-slate-200 pb-3 dark:border-white/10">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Opening Hook
              </span>
              <p className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                &ldquo;{plan.script?.hook || scenes[0]?.narration || "Welcome."}&rdquo;
              </p>
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Scene-by-Scene Script Progression
              </span>
              <div className="space-y-2.5">
                {scenes.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 border border-slate-200/80 dark:bg-black/40 dark:border-white/5"
                  >
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                      0{idx + 1}
                    </span>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {s.onScreenText?.headline || `Scene ${idx + 1}`}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-neutral-400">
                          ({s.duration}s)
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-neutral-300 italic">
                        {s.narration || "Instrumental / Motion sequence"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {plan.script?.callToAction && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Closing Call To Action
                </span>
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">
                  &ldquo;{plan.script.callToAction}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* CONVERSATIONAL PLAN REFINEMENT BAR (HEYGEN AGENT WORKFLOW) */}
        {/* ========================================================================= */}
        <div className="mt-8 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3 dark:border-indigo-500/30 dark:bg-black/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Refine Plan with AI Video Agent</span>
            </div>
            {isRevising && (
              <span className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-300 font-medium">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Updating plan...
              </span>
            )}
          </div>

          {/* Quick suggestions pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 dark:text-neutral-400 mr-1">Suggestions:</span>
            {QUICK_PROMPTS.map((promptText, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendFeedback(promptText)}
                disabled={isRevising}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 transition disabled:opacity-40 shadow-2xs dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/15 dark:hover:text-white cursor-pointer"
              >
                + {promptText}
              </button>
            ))}
          </div>

          {/* Interactive conversational input */}
          <div className="relative flex items-center mt-2">
            <input
              type="text"
              value={feedbackInput}
              onChange={(e) => setFeedbackInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendFeedback();
                }
              }}
              disabled={isRevising}
              placeholder="e.g. Change the second scene to show product features, make headline bolder, make animation faster..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-24 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-white/15 dark:bg-neutral-900/90 dark:text-white dark:placeholder:text-neutral-500 shadow-2xs"
            />
            <Button
              size="sm"
              onClick={() => handleSendFeedback()}
              disabled={isRevising || !feedbackInput.trim()}
              className="absolute right-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-7 px-3 rounded-lg cursor-pointer"
            >
              {isRevising ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="h-3 w-3 mr-1" /> Refine
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

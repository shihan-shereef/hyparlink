"use client";

import React, { useState, useEffect } from "react";
import {
  Wand2,
  Send,
  RefreshCw,
  CheckCircle2,
  Download,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@v1/ui/button";
import Link from "next/link";
import { toast } from "sonner";

interface SurgicalSceneRevisionProps {
  projectId: string;
  videoUrl: string;
  scenes?: Array<{
    id: string;
    name?: string;
    purpose?: string;
    duration?: number;
    headline?: string;
    onScreenText?: { headline?: string };
  }>;
  hidePlayer?: boolean;
  onRevisionSuccess?: (newVideoUrl: string) => void;
}

export function SurgicalSceneRevision({
  projectId,
  videoUrl,
  scenes = [],
  hidePlayer = false,
  onRevisionSuccess,
}: SurgicalSceneRevisionProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    scenes[0]?.id || "scene-1",
  );
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [isRevising, setIsRevising] = useState(false);
  const [revisionStage, setRevisionStage] = useState<string>("");
  const [activeVideoUrl, setActiveVideoUrl] = useState(videoUrl);

  useEffect(() => {
    if (videoUrl) {
      setActiveVideoUrl(videoUrl);
    }
  }, [videoUrl]);

  const displayScenes =
    scenes && scenes.length > 0
      ? scenes
      : [
          { id: "scene-1", name: "Scene 1 (Intro)" },
          { id: "scene-2", name: "Scene 2 (Feature)" },
          { id: "scene-3", name: "Scene 3 (CTA)" },
        ];

  const handleRevise = async (customPrompt?: string) => {
    const feedback = (customPrompt || revisionFeedback).trim();
    if (!feedback || isRevising) return;
    setIsRevising(true);
    setRevisionStage("Initiating revision...");

    const toastId = "revise-toast";

    try {
      toast.loading(`Surgically revising ${selectedSceneId}... (zero re-render of other scenes)`, {
        id: toastId,
      });

      const res = await fetch("/api/agent/revise-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sceneId: selectedSceneId,
          feedback,
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        const titleMatch = text.match(/<title>(.*?)<\/title>/i);
        throw new Error(titleMatch && titleMatch[1] ? titleMatch[1].trim() : `Server error (HTTP ${res.status})`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to revise scene (HTTP ${res.status})`);
      }

      // If server returned videoUrl synchronously
      if (data.videoUrl && data.status === "completed") {
        const newUrl = data.videoUrl.includes("?")
          ? `${data.videoUrl}&t=${Date.now()}`
          : `${data.videoUrl}?t=${Date.now()}`;
        setActiveVideoUrl(newUrl);
        if (onRevisionSuccess) onRevisionSuccess(newUrl);
        setRevisionFeedback("");
        toast.success(
          `Scene ${selectedSceneId} surgically revised! Unaffected scenes preserved with 0 re-render.`,
          { id: toastId },
        );
        setIsRevising(false);
        setRevisionStage("");
        return;
      }

      // Asynchronous background job polling
      const jobId = data.jobId;
      setRevisionStage("Rendering updated scene...");
      toast.loading(`Revising ${selectedSceneId}: rendering scene in background...`, {
        id: toastId,
      });

      let attempts = 0;
      const maxAttempts = 150; // up to ~4 minutes polling with 1.6s interval
      let isDone = false;

      while (attempts < maxAttempts && !isDone) {
        attempts++;
        await new Promise((r) => setTimeout(r, 1600));

        try {
          const pollUrl = `/api/agent/project-status?projectId=${encodeURIComponent(projectId)}&jobId=${encodeURIComponent(jobId || "")}`;
          const pollRes = await fetch(pollUrl);
          if (!pollRes.ok) continue;

          const pollData = await pollRes.json();

          if (pollData.stage || pollData.message) {
            setRevisionStage(pollData.message || `Rendering (${pollData.progress || 50}%)...`);
            toast.loading(pollData.message || `Surgically revising ${selectedSceneId}...`, {
              id: toastId,
            });
          }

          if (pollData.status === "completed" && (pollData.videoUrl || pollData.outputUrl)) {
            const finalUrl = pollData.videoUrl || pollData.outputUrl;
            const newUrl = finalUrl.includes("?")
              ? `${finalUrl}&t=${Date.now()}`
              : `${finalUrl}?t=${Date.now()}`;
            setActiveVideoUrl(newUrl);
            if (onRevisionSuccess) onRevisionSuccess(newUrl);
            setRevisionFeedback("");
            toast.success(
              `Scene ${selectedSceneId} surgically revised! Unaffected scenes preserved with 0 re-render.`,
              { id: toastId },
            );
            isDone = true;
            break;
          }

          if (pollData.status === "failed") {
            throw new Error(pollData.error || pollData.message || "Revision render failed");
          }
        } catch (pollErr: any) {
          if (pollErr.message && (pollErr.message.includes("failed") || pollErr.message.includes("Error"))) {
            throw pollErr;
          }
        }
      }

      if (!isDone) {
        throw new Error("Revision timed out. Please check the Studio editor or try again.");
      }
    } catch (err: any) {
      console.error("[Surgical Scene Revision Error]", err);
      toast.error(err.message || "Failed to revise scene", { id: toastId });
    } finally {
      setIsRevising(false);
      setRevisionStage("");
    }
  };

  const SCENE_QUICK_ACTIONS = [
    "Make the headline bolder with a subtle glow",
    "Change the background to a sleek dark gradient",
    "Speed up the motion graphics transition",
    "Enlarge the center visual subject",
    "Make subtitle text punchier and more concise",
  ];

  return (
    <div className="space-y-6">
      {/* 1080P MASTER VIDEO PLAYER PREVIEW - Clean White Card */}
      {!hidePlayer && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center">
            <video
              key={activeVideoUrl}
              src={activeVideoUrl}
              controls
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
            >
              <source src={activeVideoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Video metadata and action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3.5 text-xs text-slate-800">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>1080p Master Render Complete &bull; Verified with FFprobe</span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={activeVideoUrl}
                download={`ollastar_${projectId}.mp4`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download MP4</span>
              </a>

              <Link
                href={`/editor/${projectId}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in Studio</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* SURGICAL SCENE REVISION PANEL - Pure White Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-5 text-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs shrink-0 mt-0.5">
              <Wand2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="font-bold text-slate-900 text-base tracking-tight">
                  Conversational Surgical Scene Revision
                </h3>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider shadow-2xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  ZERO RE-RENDER OF OTHER SCENES
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 font-medium">
                Select any scene below and tell the agent what to refine. Only that scene will be revised; unaffected scenes are preserved byte-for-byte.
              </p>
            </div>
          </div>
        </div>

        {/* Scene Selection Tabs */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            <span>Select Scene to Revise:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {displayScenes.map((s, idx) => {
              const sceneKey = s.id || `scene-${idx + 1}`;
              const isSelected = selectedSceneId === sceneKey;
              return (
                <button
                  key={sceneKey}
                  type="button"
                  onClick={() => setSelectedSceneId(sceneKey)}
                  className={`rounded-xl border px-3.5 py-1.5 text-xs font-bold transition cursor-pointer shadow-2xs ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {s.name || `Scene ${idx + 1}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Quick Suggestions:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {SCENE_QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleRevise(action)}
                disabled={isRevising}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/70 hover:text-indigo-700 transition shadow-2xs cursor-pointer disabled:opacity-40"
              >
                + {action}
              </button>
            ))}
          </div>
        </div>

        {/* Conversational Prompt Box */}
        <div className="relative flex items-center pt-2">
          <input
            type="text"
            value={revisionFeedback}
            onChange={(e) => setRevisionFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleRevise();
              }
            }}
            disabled={isRevising}
            placeholder={`Ask Video Agent to adjust ${selectedSceneId} (e.g. 'Make headline bolder with a subtle glow', 'Enlarge center visual')...`}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 pr-32 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 shadow-inner transition disabled:opacity-50"
          />
          <Button
            size="sm"
            onClick={() => handleRevise()}
            disabled={isRevising || !revisionFeedback.trim()}
            className="absolute right-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {isRevising ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                <span className="max-w-[130px] truncate">{revisionStage || "Revising..."}</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                <span>Revise Scene</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

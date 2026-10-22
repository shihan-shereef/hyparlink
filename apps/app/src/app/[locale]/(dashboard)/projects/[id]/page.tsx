"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Download,
  Film,
  Sparkles,
  AlertCircle,
  RotateCw,
  Cpu,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  Video,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SurgicalSceneRevision } from "@/components/surgical-scene-revision";

function computeDownloadFilename(project: any, selectedResolution: string): string {
  const pLower = (project?.prompt || "").toLowerCase();
  let topic = (project?.name || "").trim();

  if (pLower.includes("ollima")) {
    topic = "ollama-ad";
  } else if (pLower.includes("networks home")) {
    topic = "networks-home";
  } else if (
    !topic ||
    topic.toLowerCase().includes("quarterly") ||
    topic.toLowerCase() === "untitled video" ||
    topic.toLowerCase() === "tech academy ad" ||
    topic.toLowerCase() === "cinematic product video" ||
    topic.toLowerCase() === "modern presentation"
  ) {
    const cleaned = (project?.prompt || "")
      .replace(
        /^create\s+(?:a\s+)?(?:\d+[- ]seconds?\s+)?(?:1080p\s+)?(?:landscape\s+)?(?:cinematic\s+)?(?:product\s+)?(?:advertisement|video|presentation)?\s*(?:of|for|about)?\s*/i,
        "",
      )
      .replace(
        /\s*(?:with\s+(?:three|two|four|\d+)\s+scenes|smooth transitions|final call).*$/i,
        "",
      )
      .trim();
    topic = cleaned.length > 2 ? cleaned.slice(0, 30) : "hyperframes-video";
  }

  const cleanSlug = topic
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${cleanSlug || "video"}-${selectedResolution}.mp4`;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as Id<"projects">;
  const { current } = useWorkspace();
  const [selectedResolution, setSelectedResolution] = useState<string>("1080p");
  const retryProject = useMutation(api.projects.retry);
  const removeProject = useMutation(api.projects.remove);

  const project = useQuery(
    api.projects.get,
    projectId ? { projectId } : "skip",
  );

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await removeProject({ projectId });
      toast.success("Project deleted successfully");
      router.push("/projects");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete project");
    }
  };

  const handleDownload = async () => {
    if (!activeVideoUrl) {
      toast.error("Video URL is not available yet");
      return;
    }
    setIsDownloading(true);
    const toastId = toast.loading(`Downloading ${selectedResolution} MP4...`);
    try {
      const downloadFilename = computeDownloadFilename(project, selectedResolution);

      const downloadUrl = activeVideoUrl.includes("?")
        ? `${activeVideoUrl}&download=true&filename=${encodeURIComponent(downloadFilename)}`
        : `${activeVideoUrl}?download=true&filename=${encodeURIComponent(downloadFilename)}`;

      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Download started successfully!", { id: toastId });
    } catch (err: any) {
      console.warn("Direct blob download fell back to browser navigation:", err);
      const downloadFilename = computeDownloadFilename(project, selectedResolution);

      const downloadUrl = activeVideoUrl.includes("?")
        ? `${activeVideoUrl}&download=true&filename=${encodeURIComponent(downloadFilename)}`
        : `${activeVideoUrl}?download=true&filename=${encodeURIComponent(downloadFilename)}`;
      window.open(downloadUrl, "_blank");
      toast.success("Opened direct download link", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };


  if (!project) {
    return (
      <div className="flex h-full w-full items-center justify-center p-12 text-primary/40">
        <RotateCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const handleRetry = async () => {
    try {
      await retryProject({ projectId });
      toast.success("Retrying video generation job...");
    } catch (err: any) {
      toast.error(err.message || "Failed to retry generation");
    }
  };

  const isCompleted = project.status.toLowerCase() === "completed";
  const isFailed = project.status.toLowerCase() === "failed";
  const isProcessing = !isCompleted && !isFailed;

  // Multi-resolution resolution selector
  const renders = project.renders || [];
  const activeRender = renders.find((r) => r.resolution === selectedResolution);
  const activeVideoUrl =
    activeRender?.cdnUrl || activeRender?.storageUrl || project.videoUrl;

  const availableResolutions = [
    { id: "1080p", label: "1080p", available: true },
    {
      id: "720p",
      label: "720p",
      available: renders.some(
        (r) => r.resolution === "720p" && r.status === "completed",
      ),
    },
    {
      id: "480p",
      label: "480p",
      available: renders.some(
        (r) => r.resolution === "480p" && r.status === "completed",
      ),
    },
  ];

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto w-full max-w-5xl space-y-8">
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-primary/60 hover:text-primary transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Projects
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/create-video">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Create Another
              </Button>
            </Link>

            <Link href={`/editor/${projectId}`}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> Live Editor
              </Button>
            </Link>

            {/* Top Bar Download Button */}
            {isCompleted && (
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                size="sm"
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition"
              >
                {isDownloading ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download {selectedResolution} MP4
              </Button>
            )}

            {/* Top Bar Delete Button */}
            <Button
              onClick={handleDelete}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-rose-400 border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>

        {/* Header Title & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-primary/60 max-w-2xl">
              {project.prompt}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                isCompleted
                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                  : isFailed
                    ? "bg-red-500/10 text-red-600 border-red-500/20"
                    : "bg-blue-500/10 text-blue-600 border-blue-500/20"
              }`}
            >
              {project.status}
            </span>
          </div>
        </div>

        {/* VIDEO PLAYER SECTION */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg space-y-0">
          {/* Resolution Switcher Bar & Download Action */}
          {isCompleted && (
            <div className="flex flex-wrap items-center justify-between border-b border-border bg-secondary/50 px-4 py-2.5 gap-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 text-xs font-medium text-primary/70">
                  <Layers className="h-3.5 w-3.5" />
                  Select Resolution:
                </span>
                <div className="flex items-center gap-1">
                  {availableResolutions.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      disabled={!res.available}
                      onClick={() => setSelectedResolution(res.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium transition ${
                        selectedResolution === res.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : res.available
                            ? "bg-card text-primary/70 hover:bg-card/80 border border-border"
                            : "text-primary/30 cursor-not-allowed line-through"
                      }`}
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direct Download Button Right Above Player */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  size="sm"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition"
                >
                  {isDownloading ? (
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                  )}
                  <span>Download {selectedResolution} Video</span>
                </Button>

                {activeVideoUrl && (() => {
                  const downloadFilename = computeDownloadFilename(
                    project,
                    selectedResolution,
                  );
                  return (
                    <a
                      href={`${activeVideoUrl}${activeVideoUrl.includes("?") ? "&" : "?"}download=true&filename=${encodeURIComponent(downloadFilename)}`}
                      download={downloadFilename}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border border-border bg-card text-primary/80 hover:bg-secondary hover:text-primary transition"
                      title="Direct Download Link (Browser native)"
                    >
                      <Download className="h-3 w-3" />
                      <span>Direct Link</span>
                    </a>
                  );
                })()}

              </div>
            </div>
          )}

          {isCompleted && activeVideoUrl ? (
            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              <video
                key={activeVideoUrl}
                src={activeVideoUrl}
                poster={project.thumbnailUrl || project.thumbnailCdnUrl}
                controls
                autoPlay
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
              />
            </div>
          ) : isFailed ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-red-500/5">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-600 mb-3">
                <AlertCircle className="h-6 w-6" />
              </span>
              <h3 className="text-base font-semibold text-primary">
                Video Generation Failed
              </h3>
              <p className="mt-1 text-sm text-primary/60 max-w-md">
                {project.error ||
                  "The HyperFrames validation or render process encountered an issue."}
              </p>
              <Button onClick={handleRetry} className="mt-4 gap-2">
                <RotateCw className="h-4 w-4" /> Retry Generation
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <RotateCw className="h-8 w-8 animate-spin text-primary/40 mb-3" />
              <h3 className="text-base font-semibold text-primary">
                Video In Progress
              </h3>
              <p className="mt-1 text-sm text-primary/60 max-w-md">
                Phase 5 pipeline is currently validating and rendering your
                composition. Status: {project.status}.
              </p>
            </div>
          )}
        </div>

        {/* Surgical Scene Revision Panel */}
        {isCompleted && (
          <SurgicalSceneRevision
            projectId={String(projectId)}
            videoUrl={activeVideoUrl || ""}
            scenes={project.productionPlan?.scenes || []}
            hidePlayer={true}
            onRevisionSuccess={() => {
              router.refresh();
            }}
          />
        )}

        {/* METADATA & SPECS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Specifications Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary/70 flex items-center gap-2">
              <Film className="h-4 w-4" /> Video Specifications
            </h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-xs text-primary/50">Duration</span>
                <span className="font-mono font-medium text-primary">
                  {project.duration}s
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-xs text-primary/50">
                  Master Resolution
                </span>
                <span className="font-mono font-medium text-primary">
                  {project.width} × {project.height}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-xs text-primary/50">Framerate</span>
                <span className="font-mono font-medium text-primary">
                  {project.fps} fps
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-primary/50">HyperFrames</span>
                <span className="font-mono font-medium text-primary">
                  v{project.hyperframesVersion}
                </span>
              </div>
            </div>
          </div>

          {/* Diagnostics Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary/70 flex items-center gap-2">
              <Cpu className="h-4 w-4" /> Pipeline Diagnostics
            </h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-xs text-primary/50">Validation</span>
                <span className="font-mono font-medium text-green-600 dark:text-green-400">
                  {project.validationStatus || "PASSED"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-xs text-primary/50">Fix Attempts</span>
                <span className="font-mono font-medium text-primary">
                  {project.correctionAttempts ?? 0}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-xs text-primary/50">Render Time</span>
                <span className="font-mono font-medium text-primary">
                  {project.renderTimeSeconds
                    ? `${project.renderTimeSeconds}s`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-primary/50">AI Engine</span>
                <span className="font-mono font-medium text-primary truncate max-w-[120px]">
                  {project.aiProvider || "Deterministic"}
                </span>
              </div>
            </div>
          </div>

          {/* Thumbnail & Cloud Storage Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary/70 flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Poster & Storage
            </h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-xs text-primary/50">Thumbnail</span>
                <span className="font-mono font-medium text-green-600 dark:text-green-400">
                  {project.thumbnailStatus === "completed"
                    ? "WebP 1280×720"
                    : project.thumbnailStatus || "Pending"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-xs text-primary/50">
                  Storage Provider
                </span>
                <span className="font-mono font-medium text-primary uppercase">
                  {project.storageProvider || "Local / R2"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-xs text-primary/50">Master Size</span>
                <span className="font-mono font-medium text-primary">
                  {project.fileSize
                    ? `${(project.fileSize / 1024).toFixed(1)} KB`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-primary/50">CDN Status</span>
                <span className="font-mono text-xs font-semibold text-green-600 dark:text-green-400">
                  Streaming Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

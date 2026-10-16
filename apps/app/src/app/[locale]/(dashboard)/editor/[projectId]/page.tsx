"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Film,
  Layers,
  Maximize2,
  Minimize2,
  Monitor,
  Palette,
  Play,
  RefreshCw,
  RotateCw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Tv,
  Type,
  Video,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface EditorScene {
  id: string;
  file: string;
  start: number;
  duration: number;
}

interface EditableProperties {
  title: string;
  subtitle: string;
  accentColor: string;
  backgroundColor: string;
  duration: number;
  fps: number;
  resolution: string;
}

interface StudioSession {
  sessionId: string;
  port: number;
  studioUrl: string;
  projectName: string;
  ready: boolean;
  reused?: boolean;
}

export default function ProjectLiveEditorPage() {
  const params = useParams();
  const projectId = params.projectId as Id<"projects">;
  const { current } = useWorkspace();

  const convexProject = useQuery(
    api.projects.get,
    projectId ? { projectId } : "skip",
  );

  const effectiveWs = (convexProject as any)?.workspaceId || current || "";

  // View mode: companion Inspector (default for remote/tunnel), official Studio, or Rendered Video
  const [activeView, setActiveView] = useState<
    "studio" | "inspector" | "video"
  >("inspector");
  const [activeInspectorTab, setActiveInspectorTab] = useState<
    "visual" | "code"
  >("visual");

  // Fullscreen toggle state & container ref
  const [isFullscreen, setIsFullscreen] = useState(false);
  const studioContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        const target = studioContainerRef.current || document.documentElement;
        if (target && target.requestFullscreen && !document.fullscreenElement) {
          target.requestFullscreen().catch(() => {});
        }
        toast.info("Entered Fullscreen mode (Tap again or press Esc to exit)");
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        toast.info("Exited Fullscreen mode");
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        toggleFullscreen();
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen, toggleFullscreen]);

  // Studio Session State
  const [session, setSession] = useState<StudioSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<
    "initializing" | "ready" | "error"
  >("initializing");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Companion Inspector State
  const [projectLoading, setProjectLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [scenes, setScenes] = useState<EditorScene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string>("scene-01");
  const [selectedFile, setSelectedFile] = useState<string>(
    "compositions/scene_01.html",
  );
  const [properties, setProperties] = useState<EditableProperties>({
    title: "",
    subtitle: "",
    accentColor: "#00a8ff",
    backgroundColor: "#050811",
    duration: 15,
    fps: 30,
    resolution: "1080p",
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previewKey, setPreviewKey] = useState<number>(Date.now());
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  // Backend API URL
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "";

  // 1. Initialize or Reuse Official HyperFrames Studio Session
  const initStudioSession = useCallback(async () => {
    if (!projectId) return;
    try {
      setSessionStatus("initializing");
      setSessionError(null);
      setIframeLoaded(false);

      const res = await fetch(`${backendUrl}/editor/session/${projectId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": effectiveWs,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || `HTTP ${res.status}: Failed to start Studio session`,
        );
      }

      let finalStudioUrl = data.studioUrl;
      const isHttps =
        typeof window !== "undefined" && window.location.protocol === "https:";
      const isLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1");

      if (
        isHttps &&
        !isLocalhost &&
        (data.tunnelStudioUrl || process.env.NEXT_PUBLIC_STUDIO_URL)
      ) {
        const tunnelBase =
          data.tunnelStudioUrl ||
          `${process.env.NEXT_PUBLIC_STUDIO_URL}/#project/${data.projectName || data.sessionId}`;
        finalStudioUrl = tunnelBase;
      } else if (isLocalhost) {
        finalStudioUrl = finalStudioUrl.replace("127.0.0.1", "localhost");
      }

      setSession({
        sessionId: data.sessionId,
        port: data.port,
        studioUrl: finalStudioUrl,
        projectName: data.projectName,
        ready: data.ready,
        reused: data.reused,
      });
      setSessionStatus("ready");

      if (data.reused) {
        toast.success(
          `Connected to active Studio instance on port ${data.port}`,
        );
      } else {
        toast.success(`HyperFrames Studio launched on port ${data.port}`);
      }
    } catch (err: any) {
      console.error("[StudioSession] Init error:", err);
      setSessionStatus("error");
      setSessionError(
        err.message || "Failed to initialize HyperFrames Studio service",
      );
      toast.error(`Studio startup error: ${err.message}`);
    }
  }, [projectId, effectiveWs, backendUrl]);

  // 2. Load Project Structure & Companion Files
  const loadProjectData = useCallback(async () => {
    if (!projectId) return;
    try {
      setProjectLoading(true);
      const res = await fetch(
        `${backendUrl}/editor/project/${projectId}?workspaceId=${effectiveWs}`,
        {
          headers: {
            "x-workspace-id": effectiveWs,
          },
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || `Failed to load project: ${res.statusText}`,
        );
      }

      const data = await res.json();
      setFiles(data.files || {});
      setScenes(data.scenes || []);
      if (data.editableProperties) {
        setProperties(data.editableProperties);
      }
      if (data.scenes && data.scenes.length > 0) {
        setActiveSceneId(data.scenes[0].id);
        setSelectedFile(data.scenes[0].file);
      }
      setHasUnsavedChanges(false);
    } catch (err: any) {
      console.error("[LiveEditor] Load error:", err);
    } finally {
      setProjectLoading(false);
    }
  }, [projectId, effectiveWs, backendUrl]);

  useEffect(() => {
    if (projectId) {
      initStudioSession();
      loadProjectData();
    }
  }, [projectId, initStudioSession, loadProjectData]);

  useEffect(() => {
    if (convexProject) {
      const vid =
        convexProject.cdnUrl ||
        convexProject.storageUrl ||
        convexProject.videoUrl;
      if (vid) setRenderedVideoUrl(vid);
    }
  }, [convexProject]);

  // Handle Sync & Re-Render
  const handleSyncAndRender = async () => {
    try {
      setRendering(true);
      toast.info(
        "Validating Studio edits and rendering updated composition...",
      );

      const res = await fetch(
        `${backendUrl}/editor/project/${projectId}/render`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-workspace-id": effectiveWs,
          },
          body: JSON.stringify({
            files,
            properties,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errorDetail =
          data.validationErrors?.join(", ") || data.error || "Rendering failed";
        throw new Error(errorDetail);
      }

      toast.success("Composition rendered and synchronized with Convex!");
      if (data.videoUrl) {
        setRenderedVideoUrl(data.videoUrl);
      }
      setHasUnsavedChanges(false);
      // Reload project files
      loadProjectData();
    } catch (err: any) {
      toast.error(`Render failed: ${err.message}`);
    } finally {
      setRendering(false);
    }
  };

  // Companion Save Action
  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(
        `${backendUrl}/editor/project/${projectId}/save`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-workspace-id": effectiveWs,
          },
          body: JSON.stringify({
            files,
            properties,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save project");
      }

      toast.success("Composition saved (timestamped backup created)");
      setHasUnsavedChanges(false);
      setPreviewKey(Date.now());
    } catch (err: any) {
      toast.error(err.message || "Failed to save composition");
    } finally {
      setSaving(false);
    }
  };

  // Property Changes for Visual Inspector
  const handlePropertyChange = (key: keyof EditableProperties, value: any) => {
    setProperties((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);

    const currentFileContent = files[selectedFile] || "";
    if (currentFileContent) {
      let updatedContent = currentFileContent;

      if (key === "title") {
        updatedContent = updatedContent.replace(
          /(<h1[^>]*>)[^<]*(<\/h1>)/i,
          `$1${value}$2`,
        );
      } else if (key === "subtitle") {
        updatedContent = updatedContent.replace(
          /(<p[^>]*class="[^"]*sub[^"]*"[^>]*>)[^<]*(<\/p>)/i,
          `$1${value}$2`,
        );
      } else if (key === "accentColor") {
        updatedContent = updatedContent.replace(
          /(#00a8ff|#00d4ff|#ffd700)/gi,
          value,
        );
      } else if (key === "backgroundColor") {
        updatedContent = updatedContent.replace(
          /background(?:-color)?:\s*(#[a-fA-F0-9]{3,8}|rgba?\([^)]+\))/i,
          `background: ${value}`,
        );
      }

      setFiles((prev) => ({
        ...prev,
        [selectedFile]: updatedContent,
      }));
    }
  };

  // Direct Code Changes
  const handleCodeChange = (newCode: string) => {
    setFiles((prev) => ({
      ...prev,
      [selectedFile]: newCode,
    }));
    setHasUnsavedChanges(true);
  };

  // Open native Desktop App
  const handleOpenDesktop = async () => {
    try {
      const res = await fetch(
        `${backendUrl}/editor/project/${projectId}/desktop-open`,
        {
          method: "POST",
          headers: { "x-workspace-id": effectiveWs },
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Opened project in HyperFrames macOS App");
      } else {
        toast.error(
          data.error || "Failed to open in HyperFrames desktop application",
        );
      }
    } catch (err: any) {
      toast.error("Could not communicate with HyperFrames desktop application");
    }
  };

  // Export ZIP
  const handleExportZip = () => {
    window.open(
      `${backendUrl}/editor/project/${projectId}/export?workspaceId=${effectiveWs}`,
      "_blank",
    );
  };

  const projectTitle =
    properties.title || convexProject?.name || "HyperFrames Composition";
  const previewSrc = `${backendUrl}/editor/project/${projectId}/raw/index.html?t=${previewKey}`;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col bg-background text-foreground overflow-hidden">
      {/* TOP HEADER */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-primary/70 hover:bg-primary/10 hover:text-primary transition"
            title="Back to Projects"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">Projects</span>
          </Link>

          <div className="h-4 w-px bg-border" />

          {/* Project Details */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-primary max-w-xs truncate">
              {projectTitle}
            </span>
            <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary font-medium">
              {properties.resolution}
            </span>
            <span className="rounded bg-secondary border border-border px-1.5 py-0.5 text-[10px] font-mono text-primary/60">
              {properties.duration}s @ {properties.fps}fps
            </span>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Studio Connection Status Indicator */}
          <div className="hidden sm:flex items-center gap-2">
            {sessionStatus === "initializing" && (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500">
                <RotateCw className="h-3 w-3 animate-spin" />
                Connecting Studio...
              </span>
            )}
            {sessionStatus === "ready" && session && (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Studio Live :{session.port}
              </span>
            )}
            {sessionStatus === "error" && (
              <button
                type="button"
                onClick={initStudioSession}
                className="flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/20 transition"
                title="Click to retry starting Studio"
              >
                <WifiOff className="h-3 w-3" />
                Studio Disconnected &bull; Retry
              </button>
            )}
          </div>
        </div>

        {/* View Switcher Tabs (Center / Header) */}
        <div className="flex items-center rounded-lg border border-border/80 bg-background/60 p-0.5">
          <button
            type="button"
            onClick={() => setActiveView("studio")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
              activeView === "studio"
                ? "bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-xs"
                : "text-primary/60 hover:text-primary"
            }`}
          >
            <Tv className="h-3.5 w-3.5" /> Official Studio
          </button>

          {session?.studioUrl && (
            <a
              href={session.studioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition"
              title="Open HyperFrames Studio in an independent browser tab"
            >
              <ExternalLink className="h-3 w-3" />
              <span>Open Tab</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => setActiveView("inspector")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
              activeView === "inspector"
                ? "bg-primary/15 text-primary border border-primary/30 shadow-xs"
                : "text-primary/60 hover:text-primary"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Scene Inspector
          </button>

          <button
            type="button"
            onClick={() => setActiveView("video")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
              activeView === "video"
                ? "bg-primary/15 text-primary border border-primary/30 shadow-xs"
                : "text-primary/60 hover:text-primary"
            }`}
          >
            <Film className="h-3.5 w-3.5" /> Video Output
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Fullscreen Button */}
          <Button
            variant={isFullscreen ? "default" : "outline"}
            size="sm"
            onClick={toggleFullscreen}
            className={`h-8 gap-1.5 text-xs transition font-medium ${
              isFullscreen
                ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md border-purple-500"
                : "border-border hover:bg-primary/10 text-primary"
            }`}
            title={
              isFullscreen
                ? "Exit Full Screen (Esc)"
                : "Make HyperFrames Full Screen"
            }
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Exit Full Screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 text-purple-400" />
                <span>Full Screen</span>
              </>
            )}
          </Button>

          <div className="h-4 w-px bg-border" />

          {/* Sync & Re-Render Button */}
          <Button
            size="sm"
            onClick={handleSyncAndRender}
            disabled={rendering}
            className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            title="Validate changes, render updated MP4 with HyperFrames, and update Convex"
          >
            {rendering ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Film className="h-3.5 w-3.5" />
            )}
            Sync &amp; Re-Render
          </Button>

          <div className="h-4 w-px bg-border" />

          {/* Desktop App */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenDesktop}
            className="h-8 gap-1 text-xs hidden sm:flex"
            title="Open in HyperFrames macOS desktop application"
          >
            <Monitor className="h-3.5 w-3.5 text-blue-400" />
            App
          </Button>

          {/* Export ZIP */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportZip}
            className="h-8 gap-1 text-xs"
            title="Download full project directory as .zip"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* VIEW 1: OFFICIAL HYPERFRAMES STUDIO (PRIMARY) */}
        {activeView === "studio" && (
          <div
            ref={studioContainerRef}
            className={`transition-all duration-300 ease-in-out ${
              isFullscreen
                ? "fixed inset-0 z-[100] w-screen h-screen bg-neutral-950 flex flex-col"
                : "flex-1 flex flex-col w-full h-full bg-neutral-950 relative overflow-hidden"
            }`}
          >
            {/* Floating Fullscreen / Minimize Toggle Button */}
            <div className="absolute top-3 right-3 z-40 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md transition active:scale-95 ${
                  isFullscreen
                    ? "bg-purple-600/90 text-white border-purple-400 hover:bg-purple-600 ring-2 ring-purple-400/30"
                    : "bg-black/80 text-white/90 border-white/20 hover:bg-black hover:border-white/40 hover:text-white"
                }`}
                title={
                  isFullscreen
                    ? "Exit Full Screen (Esc)"
                    : "Tap to make HyperFrames Full Screen"
                }
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5" />
                    <span>Exit Full Screen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 text-purple-400" />
                    <span>Full Screen</span>
                  </>
                )}
              </button>
            </div>

            {/* Loading Overlay */}
            {sessionStatus === "initializing" && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-6 text-center">
                <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 shadow-lg">
                  <Tv className="h-7 w-7 text-purple-400" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500" />
                  </span>
                </div>
                <h3 className="text-base font-semibold text-primary">
                  Initializing Official HyperFrames Studio
                </h3>
                <p className="mt-1.5 max-w-md text-xs text-primary/60">
                  Starting the background HyperFrames Studio server on an
                  isolated local port and mounting the composition workspace...
                </p>
                <div className="mt-5 flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-primary/50 font-mono">
                  <RotateCw className="h-3.5 w-3.5 animate-spin text-purple-400" />
                  <span>hyperframes preview --port=3055..3075</span>
                </div>
              </div>
            )}

            {/* Error Overlay with Retry */}
            {sessionStatus === "error" && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/95 p-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive shadow-lg">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold text-primary">
                  HyperFrames Studio Server Unavailable
                </h3>
                <p className="mt-1.5 max-w-lg text-xs text-destructive/80 font-mono bg-destructive/5 border border-destructive/10 rounded-lg p-3">
                  {sessionError ||
                    "The Studio session manager encountered an error starting the service."}
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <Button
                    onClick={initStudioSession}
                    size="sm"
                    className="gap-1.5 text-xs bg-primary text-primary-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry Studio Session
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveView("inspector")}
                    className="gap-1.5 text-xs"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Switch to Scene Inspector
                  </Button>
                  <Link href="/projects">
                    <Button variant="ghost" size="sm" className="text-xs">
                      Back to Projects
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Embedded Official HyperFrames Studio iframe */}
            {session && session.studioUrl && (
              <div className="relative w-full h-full flex flex-col">
                <div className="flex h-7 shrink-0 items-center justify-between border-b border-border/60 bg-card/70 px-3 text-[11px] text-primary/70">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-medium text-primary">Official HyperFrames Studio Canvas</span>
                    <span className="text-primary/50 font-mono">
                      ({session.studioUrl.includes("trycloudflare") ? "Secure Tunnel" : `:${session.port}`})
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <a
                      href={session.studioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-medium hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Open Studio in New Window</span>
                    </a>
                    <span className="text-border">&bull;</span>
                    <button
                      type="button"
                      onClick={() => setActiveView("inspector")}
                      className="text-primary/70 hover:text-primary transition"
                    >
                      Switch to Scene Inspector
                    </button>
                  </div>
                </div>
                <iframe
                  src={session.studioUrl}
                  title={`HyperFrames Studio - ${projectTitle}`}
                  className="flex-1 w-full border-0 bg-neutral-950"
                  allow="clipboard-read; clipboard-write; fullscreen"
                  allowFullScreen
                  onLoad={() => setIframeLoaded(true)}
                />
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: COMPANION SCENE & CODE INSPECTOR */}
        {activeView === "inspector" && (
          <div className="flex flex-1 w-full h-full overflow-hidden">
            {/* LEFT PANEL: SCENE NAVIGATOR */}
            <aside className="w-56 shrink-0 border-r border-border bg-card/60 flex flex-col">
              <div className="flex items-center justify-between border-b border-border p-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary/60">
                  Scenes ({scenes.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    toast.info("Duplicating scene template...");
                    const newId = `scene-0${scenes.length + 1}`;
                    const newFile = `compositions/${newId}.html`;
                    const srcContent = files[selectedFile] || "";
                    setFiles((prev) => ({ ...prev, [newFile]: srcContent }));
                    setScenes((prev) => [
                      ...prev,
                      {
                        id: newId,
                        file: newFile,
                        start: properties.duration,
                        duration: 5,
                      },
                    ]);
                    setHasUnsavedChanges(true);
                  }}
                  className="rounded p-1 text-primary/60 hover:bg-primary/10 hover:text-primary transition"
                  title="Add / Duplicate Scene"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {scenes.map((s, idx) => {
                  const isSelected = s.id === activeSceneId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setActiveSceneId(s.id);
                        setSelectedFile(s.file);
                      }}
                      className={`flex flex-col rounded-lg border p-2.5 cursor-pointer transition ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 bg-card hover:border-border text-primary/70"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase font-mono">
                          Scene {idx + 1}
                        </span>
                        <span className="text-[10px] font-mono text-primary/50">
                          {s.duration}s
                        </span>
                      </div>
                      <span className="mt-1 text-[11px] truncate text-primary/60 font-mono">
                        {s.file}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Engine Info */}
              <div className="border-t border-border p-3 text-[11px] text-primary/50 space-y-1">
                <div className="flex justify-between">
                  <span>Engine:</span>
                  <span className="font-mono text-primary/70">
                    HyperFrames 0.8.139
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Renderer:</span>
                  <span className="font-mono text-primary/70">
                    GSAP Timelines
                  </span>
                </div>
              </div>
            </aside>

            {/* CENTER: LIVE COMPOSITION PREVIEW */}
            <main
              className={`flex flex-col bg-black/95 overflow-hidden transition-all duration-300 ${
                isFullscreen
                  ? "fixed inset-0 z-[100] w-screen h-screen bg-neutral-950"
                  : "flex-1"
              }`}
            >
              <div className="flex h-10 items-center justify-between border-b border-border/60 bg-card/40 px-4">
                <span className="text-xs text-primary/70 font-mono">
                  {selectedFile}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="flex items-center gap-1.5 text-[11px] text-primary/80 hover:text-primary transition font-medium"
                    title={
                      isFullscreen
                        ? "Exit Full Screen"
                        : "Make HyperFrames Full Screen"
                    }
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="h-3 w-3 text-purple-400" />
                        <span>Exit Full Screen</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3 w-3 text-purple-400" />
                        <span>Full Screen</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewKey(Date.now())}
                    className="flex items-center gap-1 text-[11px] text-primary/60 hover:text-primary transition"
                    title="Reload and replay animations"
                  >
                    <RefreshCw className="h-3 w-3" /> Replay Timeline
                  </button>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center p-6 relative">
                {isFullscreen && (
                  <div className="absolute top-4 right-4 z-40">
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="flex items-center gap-1.5 rounded-lg border border-purple-400 bg-purple-600/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md hover:bg-purple-600 active:scale-95 transition"
                      title="Exit Full Screen (Esc)"
                    >
                      <Minimize2 className="h-3.5 w-3.5" />
                      <span>Exit Full Screen</span>
                    </button>
                  </div>
                )}
                <div
                  className={`relative aspect-video rounded-lg border border-border/80 bg-black overflow-hidden shadow-2xl transition-all ${
                    isFullscreen
                      ? "w-full h-full max-w-none max-h-none border-0 rounded-none"
                      : "w-full max-w-4xl max-h-[75vh]"
                  }`}
                >
                  <iframe
                    key={previewKey}
                    src={previewSrc}
                    title="HyperFrames Live Composition Preview"
                    sandbox="allow-scripts allow-same-origin"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>

              {/* TIMELINE BAR */}
              <div className="h-14 shrink-0 border-t border-border bg-card/60 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewKey(Date.now())}
                    className="rounded-full bg-primary/20 p-2 text-primary hover:bg-primary/30 transition"
                    title="Restart composition playback"
                  >
                    <Play className="h-4 w-4 fill-primary" />
                  </button>

                  <div className="flex flex-col">
                    <span className="text-[11px] font-mono text-primary/70">
                      Duration: {properties.duration}s
                    </span>
                    <span className="text-[10px] text-primary/40 font-mono">
                      {scenes.length} scene{scenes.length === 1 ? "" : "s"}{" "}
                      &bull; {properties.fps} FPS
                    </span>
                  </div>
                </div>

                <div className="flex-1 max-w-xl mx-6 flex h-7 items-center rounded-md border border-border/80 bg-background/80 p-0.5 gap-1">
                  {scenes.map((s, idx) => {
                    const isSelected = s.id === activeSceneId;
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setActiveSceneId(s.id);
                          setSelectedFile(s.file);
                        }}
                        className={`flex-1 h-full rounded flex items-center justify-center text-[10px] font-mono font-medium cursor-pointer transition ${
                          isSelected
                            ? "bg-primary text-primary-foreground shadow"
                            : "bg-primary/10 text-primary/70 hover:bg-primary/20"
                        }`}
                      >
                        S{idx + 1} ({s.duration}s)
                      </div>
                    );
                  })}
                </div>

                <div className="text-right text-[10px] font-mono text-primary/40">
                  {properties.resolution}
                </div>
              </div>
            </main>

            {/* RIGHT PANEL: INSPECTOR TABS */}
            <aside className="w-80 shrink-0 border-l border-border bg-card flex flex-col">
              <div className="flex h-10 border-b border-border">
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab("visual")}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border-b-2 transition ${
                    activeInspectorTab === "visual"
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-primary/60 hover:text-primary"
                  }`}
                >
                  <Palette className="h-3.5 w-3.5" /> Visual Properties
                </button>

                <button
                  type="button"
                  onClick={() => setActiveInspectorTab("code")}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border-b-2 transition ${
                    activeInspectorTab === "code"
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-primary/60 hover:text-primary"
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" /> Source Code
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {activeInspectorTab === "visual" ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-primary/60 flex items-center gap-1">
                        <Type className="h-3 w-3" /> Headline Text
                      </label>
                      <input
                        type="text"
                        value={properties.title}
                        onChange={(e) =>
                          handlePropertyChange("title", e.target.value)
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-primary focus:border-primary/50 focus:outline-none"
                        placeholder="Enter headline..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-primary/60">
                        Subtitle / Tagline
                      </label>
                      <input
                        type="text"
                        value={properties.subtitle}
                        onChange={(e) =>
                          handlePropertyChange("subtitle", e.target.value)
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-primary focus:border-primary/50 focus:outline-none"
                        placeholder="Enter subtitle..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-primary/60 flex items-center gap-1">
                        <Palette className="h-3 w-3" /> Accent Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={
                            properties.accentColor.startsWith("#")
                              ? properties.accentColor
                              : "#00a8ff"
                          }
                          onChange={(e) =>
                            handlePropertyChange("accentColor", e.target.value)
                          }
                          className="h-8 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
                        />
                        <input
                          type="text"
                          value={properties.accentColor}
                          onChange={(e) =>
                            handlePropertyChange("accentColor", e.target.value)
                          }
                          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-primary focus:border-primary/50 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-primary/60">
                        Background Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={
                            properties.backgroundColor.startsWith("#")
                              ? properties.backgroundColor
                              : "#050811"
                          }
                          onChange={(e) =>
                            handlePropertyChange(
                              "backgroundColor",
                              e.target.value,
                            )
                          }
                          className="h-8 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
                        />
                        <input
                          type="text"
                          value={properties.backgroundColor}
                          onChange={(e) =>
                            handlePropertyChange(
                              "backgroundColor",
                              e.target.value,
                            )
                          }
                          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-primary focus:border-primary/50 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-primary/60 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Total Duration (seconds)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={properties.duration}
                        onChange={(e) =>
                          handlePropertyChange(
                            "duration",
                            Number(e.target.value),
                          )
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-primary focus:border-primary/50 focus:outline-none"
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-8 text-xs gap-1.5"
                      >
                        {saving ? (
                          <RotateCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save Inspector Changes
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 flex-1 flex flex-col">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-primary/60">
                        Target File
                      </label>
                      <select
                        value={selectedFile}
                        onChange={(e) => setSelectedFile(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-primary font-mono focus:border-primary/50 focus:outline-none"
                      >
                        {Object.keys(files).map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 flex flex-col space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-primary/60">
                        Source Code
                      </label>
                      <textarea
                        value={files[selectedFile] || ""}
                        onChange={(e) => handleCodeChange(e.target.value)}
                        rows={20}
                        className="w-full flex-1 rounded-md border border-border bg-black/90 p-3 text-[11px] font-mono text-primary/90 focus:border-primary/50 focus:outline-none resize-none leading-relaxed"
                        spellCheck={false}
                      />
                    </div>

                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full h-8 text-xs gap-1.5"
                    >
                      {saving ? (
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save Code Changes
                    </Button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* VIEW 3: RENDERED VIDEO OUTPUT */}
        {activeView === "video" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black/95">
            <div className="relative aspect-video w-full max-w-5xl rounded-xl border border-border/80 bg-black overflow-hidden shadow-2xl flex items-center justify-center">
              {renderedVideoUrl ? (
                <video
                  src={renderedVideoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-8 text-primary/40">
                  <Film className="h-12 w-12 mx-auto mb-3 text-primary/20" />
                  <h4 className="text-sm font-medium text-primary/80">
                    No Rendered MP4 Found
                  </h4>
                  <p className="text-xs mt-1 text-primary/50 max-w-sm">
                    Click &quot;Sync &amp; Re-Render&quot; above to render the
                    current HyperFrames composition into high-definition MP4.
                  </p>
                  <Button
                    onClick={handleSyncAndRender}
                    disabled={rendering}
                    size="sm"
                    className="mt-4 gap-1.5 text-xs"
                  >
                    {rendering ? (
                      <RotateCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Film className="h-3.5 w-3.5" />
                    )}
                    Render Now
                  </Button>
                </div>
              )}
            </div>

            {renderedVideoUrl && (
              <div className="mt-4 flex items-center gap-3">
                <a
                  href={renderedVideoUrl}
                  download="rendered-composition.mp4"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" /> Download MP4
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveView("studio")}
                  className="gap-1.5 text-xs text-purple-400 border-purple-500/30"
                >
                  <Tv className="h-3.5 w-3.5" /> Continue in Studio
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

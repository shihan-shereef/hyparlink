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
  Download,
  Film,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCw,
  Save,
  SlidersHorizontal,
  Tv,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { NativeHyperlinkEditor } from "@/components/native-editor/native-editor-view";
import type { CompositionScene, RenderJob } from "@/components/native-editor/types";

interface StudioSession {
  sessionId: string;
  port: number;
  studioUrl: string;
  projectName: string;
  ready: boolean;
  reused?: boolean;
}

export default function ProjectEditorPage() {
  const params = useParams();
  const projectId = params.projectId as Id<"projects">;
  const { current } = useWorkspace();

  const convexProject = useQuery(
    api.projects.get,
    projectId ? { projectId } : "skip",
  );

  const effectiveWs = (convexProject as any)?.workspaceId || current || "";

  // -------------------------------------------------------------
  // Editor Mode State: Native Editor vs HyperFrames Studio
  // -------------------------------------------------------------
  const [editorMode, setEditorMode] = useState<"native" | "hyperframes">("native");
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingModeSwitch, setPendingModeSwitch] = useState<"native" | "hyperframes" | null>(null);

  // Fullscreen toggle state & container ref
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        const target = editorContainerRef.current || document.documentElement;
        if (target && target.requestFullscreen && !document.fullscreenElement) {
          target.requestFullscreen().catch(() => {});
        }
        toast.info("Entered Fullscreen mode (Press Esc or tap again to exit)");
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

  // Backend API URL
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  // -------------------------------------------------------------
  // Native Editor Project State
  // -------------------------------------------------------------
  const [scenes, setScenes] = useState<CompositionScene[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string>("index.html");
  const [properties, setProperties] = useState({
    title: "",
    subtitle: "",
    accentColor: "#00a8ff",
    backgroundColor: "#0A0A0D",
    duration: 30,
    fps: 30,
    resolution: "1080p",
  });
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // -------------------------------------------------------------
  // HyperFrames Studio Session State
  // -------------------------------------------------------------
  const [session, setSession] = useState<StudioSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<
    "initializing" | "ready" | "error"
  >("initializing");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  // Load project files and metadata for Native Editor
  const loadProjectData = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`${backendUrl}/editor/project/${projectId}`, {
        headers: {
          "x-workspace-id": effectiveWs,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scenes && Array.isArray(data.scenes)) {
          setScenes(data.scenes);
        }
        if (data.files && typeof data.files === "object") {
          setFiles(data.files);
        }
        if (data.editableProperties) {
          setProperties((prev) => ({
            ...prev,
            ...data.editableProperties,
            duration: Number(data.editableProperties.duration) || prev.duration,
            fps: Number(data.editableProperties.fps) || prev.fps,
            resolution: data.editableProperties.resolution || prev.resolution,
          }));
        }
        if (data.previewUrl) {
          setPreviewSrc(`${backendUrl}${data.previewUrl}`);
        } else {
          setPreviewSrc(`${backendUrl}/editor/project/${projectId}/raw/index.html`);
        }
        if (data.renderedVideoUrl) {
          setRenderedVideoUrl(data.renderedVideoUrl);
        }
      }
    } catch (err: any) {
      console.warn("[Editor] Failed to load project session data:", err.message);
    }
  }, [projectId, effectiveWs, backendUrl]);

  // Initialize HyperFrames Studio session on backend
  const initStudioSession = useCallback(async () => {
    if (!projectId) return;
    try {
      setSessionStatus("initializing");
      setSessionError(null);

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
          data.error || `HTTP ${res.status}: Failed to start HyperFrames Studio session`,
        );
      }

      const projectName = data.projectName || projectId;
      // Integrated Studio frontend is hosted directly on Ollastar (port 3000)
      const integratedStudioUrl = `/studio/index.html#project/${projectName}`;

      setSession({
        sessionId: data.sessionId,
        port: data.port,
        studioUrl: integratedStudioUrl,
        projectName,
        ready: data.ready,
        reused: data.reused,
      });
      setSessionStatus("ready");
    } catch (err: any) {
      console.error("[HyperFramesStudio] Init error:", err);
      setSessionStatus("error");
      setSessionError(
        err.message || "Failed to initialize HyperFrames Studio service",
      );
    }
  }, [projectId, effectiveWs, backendUrl]);

  useEffect(() => {
    if (projectId) {
      loadProjectData();
      initStudioSession();
    }
  }, [projectId, loadProjectData, initStudioSession]);

  useEffect(() => {
    if (convexProject) {
      const vid =
        convexProject.cdnUrl ||
        convexProject.storageUrl ||
        convexProject.videoUrl ||
        (convexProject as any).outputUrl;
      if (vid) setRenderedVideoUrl(vid);
    }
  }, [convexProject]);

  // Handle Save in Native Editor
  const handleSaveNative = async () => {
    try {
      setIsSaving(true);
      const res = await fetch(`${backendUrl}/editor/project/${projectId}/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": effectiveWs,
        },
        body: JSON.stringify({
          files,
          properties,
          scenes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save project");
      }

      setHasUnsavedChanges(false);
      toast.success("Project saved successfully!");
      setPreviewSrc(`${backendUrl}/editor/project/${projectId}/raw/index.html?t=${Date.now()}`);
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Mode Switching with Unsaved Changes Protection
  const handleSwitchMode = (targetMode: "native" | "hyperframes") => {
    if (targetMode === editorMode) return;
    if (hasUnsavedChanges && editorMode === "native") {
      setPendingModeSwitch(targetMode);
      setShowUnsavedModal(true);
      return;
    }
    setEditorMode(targetMode);
    toast.info(`Switched to ${targetMode === "native" ? "Native Editor" : "HyperFrames Studio"}`);
  };

  // Handle Sync & Re-Render with GPU Pipeline
  const handleSyncAndRender = async () => {
    try {
      setRendering(true);
      toast.info("Validating composition and rendering production video...");

      const res = await fetch(
        `${backendUrl}/editor/project/${projectId}/render`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-workspace-id": effectiveWs,
          },
          body: JSON.stringify({
            resolution: convexProject?.width
              ? `${convexProject.width}x${convexProject.height}`
              : properties.resolution || "1080p",
            fps: convexProject?.fps || properties.fps || 30,
            format: "mp4",
          }),
        },
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        const errorDetail =
          data.validationErrors?.join(", ") || data.error || "Rendering failed";
        throw new Error(errorDetail);
      }

      toast.success("Composition rendered successfully!");
      if (data.videoUrl) {
        setRenderedVideoUrl(data.videoUrl);
      }
    } catch (err: any) {
      toast.error(`Render failed: ${err.message}`);
    } finally {
      setRendering(false);
    }
  };

  // Export full project directory as ZIP archive
  const handleExportZip = () => {
    window.open(
      `${backendUrl}/editor/project/${projectId}/export?workspaceId=${effectiveWs}`,
      "_blank",
    );
  };

  const projectTitle =
    convexProject?.name || properties.title || session?.projectName || "Video Composition";

  return (
    <div className="flex h-screen w-full flex-col bg-[#f8fafc] text-foreground overflow-hidden select-none">
      {/* Top Universal Header Toolbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-white px-3 sm:px-4 z-20 text-gray-900 shadow-xs">
        {/* Left: Navigation, Ollastar Logo, Project Details */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/projects"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition font-medium mr-0.5"
            title="Back to Projects"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Projects</span>
          </Link>

          <div className="h-4 w-px bg-border" />

          {/* Project Details with Ollastar Logo */}
          <div className="flex items-center gap-2.5">
            <img
              src="/ollastar-logo.png"
              alt="Ollastar"
              className="h-6 w-6 rounded-full border border-gray-200 object-contain shadow-xs shrink-0 bg-white"
            />
            <span className="font-bold text-sm text-gray-900 max-w-[160px] sm:max-w-xs truncate">
              {projectTitle}
            </span>

            {/* Save Status / Badge */}
            {editorMode === "native" && (
              hasUnsavedChanges ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved Edits
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  All Saved
                </span>
              )
            )}

            {editorMode === "hyperframes" && sessionStatus === "ready" && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                HyperFrames Studio (Integrated)
              </span>
            )}
          </div>
        </div>

        {/* Center: Editor Mode Switcher */}
        <div className="flex items-center rounded-lg bg-gray-100 p-0.5 border border-gray-200 shadow-2xs">
          <button
            type="button"
            onClick={() => handleSwitchMode("native")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
              editorMode === "native"
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
            title="Switch to Native Editor mode"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-purple-600" />
            <span>Native Editor</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode("hyperframes")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
              editorMode === "hyperframes"
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
            title="Switch to official HyperFrames Studio mode"
          >
            <Tv className="h-3.5 w-3.5 text-indigo-600" />
            <span>HyperFrames Studio</span>
          </button>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {/* Save Button (in Native Mode) */}
          {editorMode === "native" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveNative}
              disabled={isSaving || !hasUnsavedChanges}
              className="h-7 gap-1 text-xs text-primary border-border"
              title="Save project changes"
            >
              {isSaving ? (
                <RotateCw className="h-3 w-3 animate-spin text-purple-600" />
              ) : (
                <Save className="h-3 w-3 text-purple-600" />
              )}
              <span>Save</span>
            </Button>
          )}

          {/* Fullscreen Button */}
          <Button
            variant={isFullscreen ? "default" : "outline"}
            size="sm"
            onClick={toggleFullscreen}
            className={`h-7 gap-1.5 text-xs transition font-medium ${
              isFullscreen
                ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md border-purple-500"
                : "border-border hover:bg-primary/10 text-primary"
            }`}
            title={
              isFullscreen
                ? "Exit Full Screen (Esc / F)"
                : "Make Editor Full Screen (F)"
            }
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exit</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 text-purple-500" />
                <span className="hidden sm:inline">Full</span>
              </>
            )}
          </Button>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Sync & Re-Render Button */}
          <Button
            size="sm"
            onClick={handleSyncAndRender}
            disabled={rendering}
            className="h-7 gap-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-sm font-medium"
            title="Compile updated composition to production MP4 video"
          >
            {rendering ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Film className="h-3.5 w-3.5" />
            )}
            Render Video
          </Button>

          {renderedVideoUrl && (
            <a
              href={renderedVideoUrl}
              download={`${projectId}-final.mp4`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex"
            >
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs text-primary"
                title="Download rendered MP4 video"
              >
                <Download className="h-3.5 w-3.5" />
                MP4
              </Button>
            </a>
          )}

          {/* Export ZIP */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportZip}
            className="h-7 gap-1 text-xs hidden md:flex"
            title="Download full project directory as .zip"
          >
            <Download className="h-3.5 w-3.5" />
            Export ZIP
          </Button>
        </div>
      </header>

      {/* Main Workspace Area (Avoids rendering both simultaneously) */}
      <div
        ref={editorContainerRef}
        className={`transition-all duration-300 ease-in-out ${
          isFullscreen
            ? "fixed inset-0 z-[100] w-screen h-screen bg-neutral-950 flex flex-col"
            : "flex-1 flex flex-col w-full h-full bg-neutral-950 relative overflow-hidden"
        }`}
      >
        {/* MODE 1: NATIVE VIDEO EDITOR */}
        {editorMode === "native" && (
          <NativeHyperlinkEditor
            projectId={projectId}
            projectTitle={projectTitle}
            duration={properties.duration}
            onUpdateDuration={(d) => {
              setProperties((prev) => ({ ...prev, duration: d }));
              setHasUnsavedChanges(true);
            }}
            fps={properties.fps}
            resolution={properties.resolution}
            scenes={scenes}
            onUpdateScenes={(updater) => {
              setScenes(updater);
              setHasUnsavedChanges(true);
            }}
            files={files}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
            onCodeChange={(code, targetFile) => {
              const file = targetFile || selectedFile;
              setFiles((prev) => ({ ...prev, [file]: code }));
              setHasUnsavedChanges(true);
            }}
            onSaveProject={handleSaveNative}
            onSyncAndRender={handleSyncAndRender}
            isRendering={rendering}
            previewSrc={previewSrc}
            renderedVideoUrl={renderedVideoUrl}
            renders={[]}
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSaving}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            hideHeader={true}
            editorMode="native"
            onEditorModeChange={(m) => handleSwitchMode(m === "studio" ? "hyperframes" : "native")}
            studioPort={session?.port}
          />
        )}

        {/* MODE 2: HYPERFRAMES STUDIO (INTEGRATED) */}
        {editorMode === "hyperframes" && (
          <div className="flex-1 flex flex-col w-full h-full bg-neutral-950 relative overflow-hidden">
            {/* Loading Overlay */}
            {sessionStatus === "initializing" && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-6 text-center">
                <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-lg">
                  <Tv className="h-7 w-7 text-indigo-400" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500" />
                  </span>
                </div>
                <h3 className="text-base font-semibold text-primary">
                  Connecting to HyperFrames Studio
                </h3>
                <p className="mt-1.5 max-w-md text-xs text-primary/60">
                  Launching the integrated HyperFrames Studio engine and mounting project workspace...
                </p>
                <div className="mt-5 flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-primary/50 font-mono">
                  <RotateCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  <span>hyperframes studio --integrated</span>
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
                  HyperFrames Studio Unavailable
                </h3>
                <p className="mt-1.5 max-w-lg text-xs text-destructive/80 font-mono bg-destructive/5 border border-destructive/10 rounded-lg p-3">
                  {sessionError ||
                    "The HyperFrames Studio session manager encountered an error starting the service."}
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <Button
                    onClick={initStudioSession}
                    size="sm"
                    className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry Connection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setEditorMode("native")}
                  >
                    Switch to Native Editor
                  </Button>
                </div>
              </div>
            )}

            {/* Integrated HyperFrames Studio Frame */}
            {session && session.studioUrl && (
              <iframe
                src={session.studioUrl}
                title={`HyperFrames Studio - ${projectTitle}`}
                className="flex-1 w-full h-full border-0 bg-neutral-950"
                allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
              />
            )}
          </div>
        )}
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-gray-200 text-gray-900">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Unsaved Changes
            </h3>
            <p className="mt-2 text-xs text-gray-600 leading-relaxed">
              You have unsaved changes in Native Editor. Would you like to save them to the project before switching to HyperFrames Studio?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setShowUnsavedModal(false);
                  setPendingModeSwitch(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setHasUnsavedChanges(false);
                  setShowUnsavedModal(false);
                  if (pendingModeSwitch) {
                    setEditorMode(pendingModeSwitch);
                    setPendingModeSwitch(null);
                  }
                }}
              >
                Discard &amp; Switch
              </Button>
              <Button
                size="sm"
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                onClick={async () => {
                  await handleSaveNative();
                  setShowUnsavedModal(false);
                  if (pendingModeSwitch) {
                    setEditorMode(pendingModeSwitch);
                    setPendingModeSwitch(null);
                  }
                }}
              >
                Save &amp; Switch
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

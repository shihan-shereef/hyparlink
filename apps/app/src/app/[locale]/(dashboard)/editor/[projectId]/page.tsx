"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  Film,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCw,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface StudioSession {
  sessionId: string;
  port: number;
  studioUrl: string;
  projectName: string;
  ready: boolean;
  reused?: boolean;
}

export default function ProjectOllaEditorPage() {
  const params = useParams();
  const projectId = params.projectId as Id<"projects">;
  const { current } = useWorkspace();

  // Native editor is the only editor mode

  const convexProject = useQuery(
    api.projects.get,
    projectId ? { projectId } : "skip",
  );

  const effectiveWs = (convexProject as any)?.workspaceId || current || "";

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
  // Olla Editor Session State & Connection Management
  // -------------------------------------------------------------
  const [session, setSession] = useState<StudioSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<
    "initializing" | "ready" | "error"
  >("initializing");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  const initEditorSession = useCallback(async () => {
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

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          `Ollastar Editor service is starting up (HTTP ${res.status}). Please click "Retry Connection".`,
        );
      }

      if (!res.ok || !data?.success) {
        throw new Error(
          data?.error || `HTTP ${res.status}: Failed to start Ollastar Editor session`,
        );
      }

      let finalStudioUrl = data.studioUrl || "";
      const isHttps =
        typeof window !== "undefined" && window.location.protocol === "https:";
      const isLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1");

      if (isHttps && !isLocalhost) {
        // Remote (Cloudflare/production) deployment:
        // Priority 1: explicit studio tunnel URL (separate CF tunnel for studio)
        // Priority 2: proxy URL through backend-echo (works in all HTTPS deployments)
        if (data.tunnelStudioUrl) {
          finalStudioUrl = data.tunnelStudioUrl;
        } else if (process.env.NEXT_PUBLIC_STUDIO_URL) {
          const tunnelBase = process.env.NEXT_PUBLIC_STUDIO_URL.replace(/\/+$/, "");
          finalStudioUrl = `${tunnelBase}/#project/${data.projectName || data.sessionId}`;
        } else if (data.proxyStudioUrl) {
          // Use the backend-echo proxy route — accessible via the main Cloudflare tunnel
          finalStudioUrl = data.proxyStudioUrl;
        }
      } else if (isLocalhost) {
        // On localhost, proxyStudioUrl or direct localhost:PORT
        finalStudioUrl = data.proxyStudioUrl || (finalStudioUrl ? finalStudioUrl.replace("127.0.0.1", "localhost") : "");
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
    } catch (err: any) {
      console.error("[OllastarEditor] Init error:", err);
      setSessionStatus("error");
      const msg = err?.message || "";
      if (
        msg.includes("expected pattern") ||
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Load failed")
      ) {
        setSessionError(
          "Connection to Ollastar Editor engine was interrupted while launching. Please click 'Retry Connection'.",
        );
      } else {
        setSessionError(msg || "Failed to initialize Ollastar Editor service");
      }
    }
  }, [projectId, effectiveWs, backendUrl]);

  useEffect(() => {
    if (projectId) {
      initEditorSession();
    }
  }, [projectId, initEditorSession]);

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

  const effectiveVideoUrl =
    renderedVideoUrl ||
    (convexProject as any)?.videoUrl ||
    (convexProject as any)?.cdnUrl ||
    (convexProject as any)?.outputUrl ||
    (convexProject as any)?.storageUrl ||
    (projectId === "default_reference_video_2"
      ? "/outputs/repaired_job-job_code_1792382768219_mbcw4_1792382812142.mp4"
      : "");

  const nativeIframeRef = useRef<HTMLIFrameElement>(null);
  const handleNativeIframeLoad = () => {
    if (nativeIframeRef.current?.contentWindow && effectiveVideoUrl) {
      nativeIframeRef.current.contentWindow.postMessage(
        {
          type: "LOAD_PROJECT_VIDEO",
          videoUrl: effectiveVideoUrl,
          title: convexProject?.name || session?.projectName || "London in 3 Days (Reference Video)",
          duration: convexProject?.duration || 40,
          prompt: convexProject?.prompt || "",
          projectId,
        },
        "*",
      );
    }
  };

  // Handle Sync & Re-Render with Ollastar GPU Pipeline
  const handleSyncAndRender = async () => {
    try {
      setRendering(true);
      toast.info("Validating composition and rendering Ollastar production video...");

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
              : "1080p",
            fps: convexProject?.fps || 30,
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

      toast.success("Composition rendered and synchronized with Ollastar!");
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
    convexProject?.name || session?.projectName || "Video Composition";

  return (
    <div className="flex h-screen w-full flex-col bg-[#f8fafc] text-foreground overflow-hidden select-none">
      {/* Top Header Toolbar */}
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

            {/* Native Editor Badge */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              Native Editor
            </span>
          </div>
        </div>

        {/* Center: Native Editor Label */}
        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shadow-2xs">
          <div className="px-3 py-1 text-xs font-semibold rounded-md bg-purple-600 text-white shadow-xs flex items-center gap-1.5">
            <Film className="h-3.5 w-3.5" />
            <span>Native Editor</span>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
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
                <span className="hidden sm:inline">Exit Full Screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 text-purple-500" />
                <span className="hidden sm:inline">Full Screen</span>
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

      {/* Main Workspace */}
      <div
        ref={editorContainerRef}
        className={`transition-all duration-300 ease-in-out ${
          isFullscreen
            ? "fixed inset-0 z-[100] w-screen h-screen bg-neutral-950 flex flex-col"
            : "flex-1 flex flex-col w-full h-full bg-neutral-950 relative overflow-hidden"
        }`}
      >
        {/* Native Video Editor */}
        <iframe
          ref={nativeIframeRef}
          src={`/native-editor/index.html?project=${encodeURIComponent(projectId)}&title=${encodeURIComponent(projectTitle)}${effectiveVideoUrl ? `&video=${encodeURIComponent(effectiveVideoUrl)}` : ""}${convexProject?.prompt ? `&prompt=${encodeURIComponent(convexProject.prompt)}` : ""}&duration=${convexProject?.duration || 40}`}
          title={`Native Editor - ${projectTitle}`}
          className="flex-1 w-full h-full border-0 bg-[#101720]"
          allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; microphone"
          allowFullScreen
          onLoad={handleNativeIframeLoad}
        />
      </div>
    </div>
  );
}

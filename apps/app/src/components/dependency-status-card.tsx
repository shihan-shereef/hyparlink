"use client";

import { useState, useEffect } from "react";
import { Button } from "@v1/ui/button";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Server,
  HardDrive,
  Cpu,
  Video,
  Wrench,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

export interface DependencyItem {
  installed: boolean;
  version?: string;
  compatible: boolean;
  path?: string;
  minRequired?: string;
  error?: string;
  codecs?: Record<string, boolean>;
  formats?: Record<string, boolean>;
  cli?: string;
}

export interface StorageItem {
  writable: boolean;
  storagePath: string;
  availableMb?: number;
  sufficient: boolean;
  minRequiredMb: number;
}

export interface DependencyStatusResponse {
  status: "ready" | "not_ready" | "degraded";
  renderingReady: boolean;
  dependencies: {
    node: DependencyItem;
    npm: DependencyItem;
    ffmpeg: DependencyItem;
    ffprobe: DependencyItem;
    hyperframes: DependencyItem;
    storage: StorageItem;
  };
  recommendations: string[];
  lastChecked: string;
  cached: boolean;
  os: {
    platform: string;
    arch: string;
    release: string;
  };
}

export function DependencyStatusCard({ className }: { className?: string }) {
  const [data, setData] = useState<DependencyStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  const fetchStatus = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRechecking(true);
      const res = await fetch(
        `/backend-api/health/dependencies${forceRefresh ? "?recheck=true" : ""}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DependencyStatusResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Failed to fetch dependency status:", err);
      toast.error("Could not reach backend dependency health service");
    } finally {
      setLoading(false);
      setRechecking(false);
    }
  };

  const handleSetup = async () => {
    setSettingUp(true);
    toast.info("Running automated environment setup...");
    try {
      const res = await fetch("/backend-api/health/dependencies/setup", {
        method: "POST",
      });
      const resJson = await res.json();
      if (resJson.success) {
        toast.success("Environment configured successfully!");
        setData(resJson.status);
      } else {
        toast.error(resJson.error || "Setup script failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to run setup routine");
    } finally {
      setSettingUp(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const renderBadge = (item?: DependencyItem, fallbackLabel?: string) => {
    if (!item) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-0.5 text-xs text-neutral-400">
          <AlertTriangle className="h-3.5 w-3.5 text-neutral-400" />
          <span>Unknown</span>
        </span>
      );
    }

    if (item.installed && item.compatible) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span>Installed ✓</span>
        </span>
      );
    }

    if (item.installed && !item.compatible) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          <span>Incompatible version</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-400">
        <XCircle className="h-3.5 w-3.5 text-rose-400" />
        <span>Missing / Installation required</span>
      </span>
    );
  };

  return (
    <div
      className={`flex w-full flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm ${
        className || ""
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-primary">
              Video Rendering Environment
            </h2>
            <p className="text-xs text-muted-foreground">
              Server-side runtime dependencies required for autonomous video generation and rendering
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data && !data.renderingReady && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSetup}
              disabled={settingUp || rechecking}
              className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
            >
              <Wrench className={`h-3.5 w-3.5 ${settingUp ? "animate-spin" : ""}`} />
              <span>{settingUp ? "Setting up..." : "Auto-Setup"}</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchStatus(true)}
            disabled={rechecking || loading}
            className="gap-1.5 border-border bg-secondary/50 text-xs font-medium hover:bg-secondary"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${rechecking ? "animate-spin text-primary" : ""}`} />
            <span>{rechecking ? "Checking..." : "Recheck"}</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2.5 text-sm text-muted-foreground">
              Inspecting server-side rendering environment...
            </span>
          </div>
        ) : data ? (
          <div className="flex flex-col gap-6">
            {/* Status Banner */}
            <div
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                data.renderingReady
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {data.renderingReady ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  {data.renderingReady
                    ? "Rendering environment ready."
                    : "Rendering environment not ready."}
                </p>
                <p className="mt-0.5 text-xs opacity-90">
                  {data.renderingReady
                    ? "All required server executables, media codecs, and storage paths are fully operational."
                    : "One or more critical rendering dependencies are missing or incompatible."}
                </p>
                {data.recommendations.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-xs space-y-1 text-amber-200">
                    {data.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Dependency Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Node.js */}
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Node.js</div>
                    <div className="text-xs text-muted-foreground">
                      {data.dependencies.node.version || "Not installed"} (Requires &gt;=18)
                    </div>
                  </div>
                </div>
                {renderBadge(data.dependencies.node)}
              </div>

              {/* npm */}
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">npm</div>
                    <div className="text-xs text-muted-foreground">
                      {data.dependencies.npm.version || "Not installed"}
                    </div>
                  </div>
                </div>
                {renderBadge(data.dependencies.npm)}
              </div>

              {/* FFmpeg */}
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500/10 text-purple-400">
                    <Video className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">FFmpeg</span>
                      {data.dependencies.ffmpeg.codecs?.h264 && (
                        <span className="rounded bg-neutral-800 px-1.5 py-0.2 text-[10px] font-mono text-neutral-300">
                          H.264
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {data.dependencies.ffmpeg.version || "Not installed"}
                    </div>
                  </div>
                </div>
                {renderBadge(data.dependencies.ffmpeg)}
              </div>

              {/* FFprobe */}
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500/10 text-purple-400">
                    <Video className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">FFprobe</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {data.dependencies.ffprobe.version || "Not installed"}
                    </div>
                  </div>
                </div>
                {renderBadge(data.dependencies.ffprobe)}
              </div>

              {/* HyperFrames */}
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500/10 text-sky-400">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">HyperFrames CLI</div>
                    <div className="text-xs text-muted-foreground">
                      v{data.dependencies.hyperframes.version || "0.8.139"}
                    </div>
                  </div>
                </div>
                {renderBadge(data.dependencies.hyperframes)}
              </div>

              {/* Storage */}
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
                    <HardDrive className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Storage & Temp Disk</div>
                    <div className="text-xs text-muted-foreground">
                      {data.dependencies.storage.availableMb
                        ? `${Math.round(data.dependencies.storage.availableMb / 1024)} GB free`
                        : "Writable"}
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Ready ✓</span>
                </span>
              </div>
            </div>

            {/* Footer metadata */}
            <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <span>
                Host OS: {data.os.platform} ({data.os.arch})
              </span>
              <span>
                Last checked: {new Date(data.lastChecked).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No environment status available.
          </div>
        )}
      </div>
    </div>
  );
}

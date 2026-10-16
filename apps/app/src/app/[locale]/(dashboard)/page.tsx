"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  Activity,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Cpu,
  FileText,
  Film,
  Globe,
  HardDrive,
  ListChecks,
  Play,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-primary/50">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-primary">{value ?? "—"}</p>
      {sub && <p className="mt-0.5 text-xs text-primary/40">{sub}</p>}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { current } = useWorkspace();
  const scoped = current ? { workspaceId: current } : "skip";
  const stats = useQuery(api.dashboard.stats, scoped);
  const audit = useQuery(api.audit.recent, scoped);

  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleStartGeneration = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      inputRef.current?.focus();
      return;
    }
    const params = new URLSearchParams({
      prompt: prompt.trim(),
      duration: String(duration),
      aspectRatio,
      autoStart: "1",
    });
    router.push(`/create-video?${params.toString()}`);
  };

  const handlePreset = (presetPrompt: string, dur = 30, ratio = "16:9") => {
    setPrompt(presetPrompt);
    setDuration(dur);
    setAspectRatio(ratio);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="mx-auto w-full max-w-screen-xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-medium text-primary">Dashboard</h1>
            <p className="text-sm text-primary/60">
              Overview of your AI video generation studio and autonomous agents.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/create-video"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-primary shadow-sm transition hover:bg-secondary"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Autonomous Studio
            </Link>
          </div>
        </div>

        {/* HERO PROMPT BAR: Instant Video Generation & Web Crawler */}
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-card via-card to-secondary p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-primary">
                    Create Cinematic Video with AI
                  </h2>
                  <p className="text-xs text-primary/70">
                    Type a prompt or paste any website URL. The AI will crawl data, download photos, and render a 1080p video.
                  </p>
                </div>
              </div>
            </div>

            {/* Prompt Input Form */}
            <form onSubmit={handleStartGeneration} className="space-y-3">
              <div
                onClick={() => inputRef.current?.focus()}
                className="rounded-xl border border-border bg-background/80 p-3 shadow-inner focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition cursor-text"
              >
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleStartGeneration();
                    }
                  }}
                  rows={3}
                  placeholder="Enter your prompt or paste a website URL (e.g., 'https://en.wikipedia.org/wiki/Superman' or 'Create a 30-second cinematic DC Superman ad for Clark Kent with voice and logo')..."
                  className="w-full resize-none bg-transparent text-sm text-primary placeholder:text-primary/40 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-2.5">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5 text-primary/70">
                      <span>Duration:</span>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="rounded border border-border bg-card px-2 py-0.5 text-xs text-primary focus:outline-none"
                      >
                        <option value={15}>15s</option>
                        <option value={30}>30s (Default)</option>
                        <option value={60}>60s</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5 text-primary/70">
                      <span>Aspect:</span>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="rounded border border-border bg-card px-2 py-0.5 text-xs text-primary focus:outline-none"
                      >
                        <option value="16:9">16:9 Landscape</option>
                        <option value="9:16">9:16 Vertical / Reels</option>
                        <option value="1:1">1:1 Square</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!prompt.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition disabled:opacity-40 disabled:hover:bg-indigo-600"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Generate Video
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            icon={ListChecks}
            label="Open jobs"
            value={stats?.openJobs}
            sub={`${stats?.jobs ?? 0} total`}
          />
          <Stat icon={Users} label="Members" value={stats?.members} />
          <Stat icon={FileText} label="Files" value={stats?.files} />
          <Stat icon={Boxes} label="Usage events" value={stats?.usageTotal} />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Activity className="h-4 w-4 text-primary/50" />
            <h2 className="text-sm font-medium text-primary">
              Recent activity
            </h2>
          </div>
          <div className="divide-y divide-border/50">
            {audit === undefined ? (
              <div className="px-4 py-6 text-sm text-primary/40">Loading…</div>
            ) : audit.length ? (
              audit.map((a) => (
                <div
                  key={a._id}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <span className="font-mono text-primary/80">{a.action}</span>
                  <span className="text-primary/50">
                    {new Date(a.at).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-primary/40">
                No activity yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  Film,
  Plus,
  Play,
  Copy,
  Trash2,
  Sparkles,
  LayoutGrid,
  List,
  Clock,
  CheckCircle2,
  AlertCircle,
  Video,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

const statusBadges: Record<string, { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className:
      "bg-green-500/10 text-green-600 ring-green-600/20 border-green-500/20",
  },
  rendering: {
    label: "Rendering",
    className:
      "bg-purple-500/10 text-purple-600 ring-purple-600/20 border-purple-500/20",
  },
  validating: {
    label: "Validating",
    className:
      "bg-blue-500/10 text-blue-600 ring-blue-600/20 border-blue-500/20",
  },
  generating: {
    label: "Generating",
    className:
      "bg-amber-500/10 text-amber-600 ring-amber-600/20 border-amber-500/20",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-600 ring-red-600/20 border-red-500/20",
  },
  draft: {
    label: "Draft",
    className:
      "bg-gray-500/10 text-gray-600 ring-gray-600/20 border-gray-500/20",
  },
};

const PRIMARY_WS = "mh7eadmg10g11yqwbjtyc41yjs8fxx17" as Id<"workspaces">;

export default function ProjectsPage() {
  const { current, workspaces, select } = useWorkspace();
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const effectiveWs = current || PRIMARY_WS;

  const projects = useQuery(
    api.projects.list,
    effectiveWs ? { workspaceId: effectiveWs } : "skip",
  );

  const duplicateProject = useMutation(api.projects.duplicate);
  const removeProject = useMutation(api.projects.remove);

  const handleDuplicate = async (projectId: Id<"projects">) => {
    try {
      await duplicateProject({ projectId });
      toast.success("Project duplicated");
    } catch {
      toast.error("Failed to duplicate project");
    }
  };

  const handleDelete = async (projectId: Id<"projects">) => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await removeProject({ projectId });
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto w-full max-w-screen-xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-primary">
              Video Projects
            </h1>
            <p className="text-sm text-primary/60">
              Manage your HyperFrames video compositions, multi-resolution
              renders, and thumbnails.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-md p-1.5 transition ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-primary/60 hover:text-primary"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-md p-1.5 transition ${
                  viewMode === "table"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-primary/60 hover:text-primary"
                }`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <Link href="/create-video">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Video
              </Button>
            </Link>
          </div>
        </div>

        {/* Empty State */}
        {!projects || projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-center shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary/40 mb-3">
              <Film className="h-6 w-6" />
            </span>
            <h3 className="text-base font-medium text-primary">
              No video projects yet
            </h3>
            <p className="mt-1 text-sm text-primary/50 max-w-sm">
              Generate your first HyperFrames animated video using natural
              language.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Link href="/create-video">
                <Button size="sm" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Create First Video
                </Button>
              </Link>
              {effectiveWs !== PRIMARY_WS && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => select(PRIMARY_WS)}
                  className="gap-2 border-primary/30 text-primary"
                >
                  <Film className="h-4 w-4 text-purple-500" />
                  Switch to Primary Workspace (60 Videos)
                </Button>
              )}
            </div>
          </div>
        ) : viewMode === "grid" ? (
          /* VIDEO PROJECT CARDS (Phase 8A & Phase 8B) */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {projects.map((p) => {
              const badge = statusBadges[p.status.toLowerCase()] || {
                label: p.status,
                className: "bg-muted text-muted-foreground",
              };
              const thumb = p.thumbnailUrl || p.thumbnailCdnUrl;
              const resLabel = p.width === 1920 ? "1080p" : `${p.width}p`;

              return (
                <div
                  key={p._id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition"
                >
                  {/* THUMBNAIL POSTER CONTAINER */}
                  <Link
                    href={`/projects/${p._id}`}
                    className="relative aspect-video w-full overflow-hidden bg-slate-950 flex items-center justify-center"
                  >
                    {thumb ? (
                      // biome-ignore lint/a11y/useAltText: thumbnail
                      <img
                        src={thumb}
                        alt={p.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-primary/30 p-4 text-center">
                        <Video className="h-8 w-8 mb-1.5 opacity-60" />
                        <span className="text-[10px] uppercase font-mono tracking-wider">
                          {p.status}
                        </span>
                      </div>
                    )}

                    {/* Dark gradient overlay on hover with play icon */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transform scale-90 group-hover:scale-100 transition">
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </span>
                    </div>

                    {/* Status badge in top-left */}
                    <span
                      className={`absolute top-2.5 left-2.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${badge.className}`}
                    >
                      {badge.label}
                    </span>

                    {/* Duration badge in bottom-right */}
                    <span className="absolute bottom-2.5 right-2.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white backdrop-blur-sm">
                      {p.duration}s
                    </span>
                  </Link>

                  {/* CARD BODY */}
                  <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                    <div>
                      <Link
                        href={`/projects/${p._id}`}
                        className="font-semibold text-sm text-primary hover:underline line-clamp-1"
                        title={p.name}
                      >
                        {p.name}
                      </Link>
                      <p className="mt-1 text-xs text-primary/50 line-clamp-2">
                        {p.prompt}
                      </p>
                    </div>

                    <div className="space-y-2.5 border-t border-border/50 pt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-primary/60">
                        <span>
                          {p.duration}s • {resLabel} • 16:9
                        </span>
                        <span>
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/projects/${p._id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                            >
                              <Play className="h-3 w-3 fill-current" /> Play
                            </Button>
                          </Link>
                          <Link href={`/editor/${p._id}`}>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                            >
                              <SlidersHorizontal className="h-3 w-3" /> Edit
                            </Button>
                          </Link>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicate(p._id)}
                            title="Duplicate project"
                            className="rounded p-1 text-primary/50 hover:bg-primary/5 hover:text-primary transition"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p._id)}
                            title="Delete project"
                            className="rounded p-1 text-primary/50 hover:bg-destructive/10 hover:text-destructive transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW FALLBACK */
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wider text-primary/60">
                  <tr>
                    <th className="px-5 py-3">Project</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Specs</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {projects.map((p) => {
                    const badge = statusBadges[p.status.toLowerCase()] || {
                      label: p.status,
                      className: "bg-muted text-muted-foreground",
                    };

                    return (
                      <tr key={p._id} className="transition hover:bg-muted/20">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
                              <Film className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <Link
                                href={`/projects/${p._id}`}
                                className="font-medium text-primary hover:underline line-clamp-1"
                              >
                                {p.name}
                              </Link>
                              <p className="text-xs text-primary/50 line-clamp-1 max-w-md">
                                {p.prompt}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs text-primary/70">
                          <div className="font-mono">
                            {p.duration}s · {p.width}×{p.height} @ {p.fps}fps
                          </div>
                        </td>

                        <td className="px-5 py-4 text-xs text-primary/60">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/projects/${p._id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                              >
                                <Play className="h-3 w-3" /> Open
                              </Button>
                            </Link>
                            <Link href={`/editor/${p._id}`}>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                              >
                                <SlidersHorizontal className="h-3 w-3" /> Edit
                              </Button>
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleDuplicate(p._id)}
                              className="rounded p-1.5 text-primary/60 hover:bg-primary/5 hover:text-primary transition"
                            >
                              <Copy className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(p._id)}
                              className="rounded p-1.5 text-primary/60 hover:bg-destructive/10 hover:text-destructive transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

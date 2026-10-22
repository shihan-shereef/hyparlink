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
  LayoutGrid,
  List,
  Clock,
  RotateCw,
  Video,
  SlidersHorizontal,
  ArchiveRestore,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { current, workspaces, select } = useWorkspace();
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [activeTab, setActiveTab] = useState<"active" | "trash">("active");

  const effectiveWs = current || PRIMARY_WS;

  const projects = useQuery(
    api.projects.list,
    effectiveWs ? { workspaceId: effectiveWs } : "skip",
  );

  const trashedProjects = useQuery(
    api.projects.listTrash,
    effectiveWs ? { workspaceId: effectiveWs } : "skip",
  );

  const duplicateProject = useMutation(api.projects.duplicate);
  const moveToTrash = useMutation(api.projects.moveToTrash);
  const restoreFromTrash = useMutation(api.projects.restoreFromTrash);
  const permanentDelete = useMutation(api.projects.permanentDelete);
  const emptyTrash = useMutation(api.projects.emptyTrash);

  const handleDuplicate = async (projectId: Id<"projects">) => {
    try {
      await duplicateProject({ projectId });
      toast.success("Project duplicated");
    } catch {
      toast.error("Failed to duplicate project");
    }
  };

  const handleMoveToTrash = async (projectId: Id<"projects">) => {
    if (!confirm("Move this video to Trash? You can restore it anytime.")) return;
    try {
      await moveToTrash({ projectId });
      toast.success("Video moved to Trash");
    } catch {
      toast.error("Failed to move video to Trash");
    }
  };

  const handleRestore = async (projectId: Id<"projects">) => {
    try {
      await restoreFromTrash({ projectId });
      toast.success("Video restored to active projects");
    } catch {
      toast.error("Failed to restore video");
    }
  };

  const handlePermanentDelete = async (projectId: Id<"projects">) => {
    if (
      !confirm(
        "Permanently delete this video? This cannot be undone and will delete stored media.",
      )
    ) {
      return;
    }
    try {
      await permanentDelete({ projectId });
      toast.success("Video permanently deleted");
    } catch {
      toast.error("Failed to delete video");
    }
  };

  const handleEmptyTrash = async () => {
    if (!trashedProjects || trashedProjects.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete all ${trashedProjects.length} video(s) in Trash? This cannot be undone!`,
      )
    ) {
      return;
    }
    try {
      await emptyTrash({ workspaceId: effectiveWs });
      toast.success("Trash emptied successfully");
    } catch {
      toast.error("Failed to empty trash");
    }
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto w-full max-w-screen-xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight">
              Video Studio
            </h1>
            <p className="text-xs text-primary/60 mt-1">
              Manage and review all your generated videos and active projects.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle: Grid or Table */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-md p-1.5 transition cursor-pointer ${
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
                className={`rounded-md p-1.5 transition cursor-pointer ${
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
              <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs">
                <Plus className="h-4 w-4" />
                Create Video
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Selection: Active Videos vs Trash */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "active"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-primary/70 hover:text-primary hover:bg-muted/60"
              }`}
            >
              <Film className="h-3.5 w-3.5" />
              Active Videos
              {projects && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === "active"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-primary/70"
                }`}>
                  {projects.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("trash")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "trash"
                  ? "bg-red-600 text-white shadow-xs font-semibold"
                  : "text-primary/70 hover:text-red-500 hover:bg-red-500/10"
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Trash
              {trashedProjects && trashedProjects.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === "trash"
                    ? "bg-white/20 text-white"
                    : "bg-red-500/20 text-red-600 dark:text-red-400 font-bold"
                }`}>
                  {trashedProjects.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "trash" && trashedProjects && trashedProjects.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleEmptyTrash}
              className="gap-1.5 h-8 text-xs font-medium cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Empty Trash ({trashedProjects.length})
            </Button>
          )}
        </div>

        {/* ACTIVE VIDEOS TAB */}
        {activeTab === "active" && (
          <div className="space-y-6">
            {!projects || projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-center shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary/40 mb-3">
                  <Film className="h-6 w-6" />
                </span>
                <h3 className="text-base font-medium text-primary">
                  No video projects yet
                </h3>
                <p className="mt-1 text-sm text-primary/50 max-w-sm">
                  Generate your first video using AI or customize a template from the creation studio.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <Link href="/create-video">
                    <Button
                      size="sm"
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                    >
                      <Plus className="h-4 w-4" />
                      Create Video
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
                      Switch to Primary Workspace
                    </Button>
                  )}
                </div>
              </div>
            ) : viewMode === "grid" ? (
              /* ACTIVE VIDEO PROJECT CARDS GRID */
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

                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-black shadow-lg backdrop-blur-xs group-hover:scale-110 transition">
                            <Play className="h-4 w-4 fill-current ml-0.5" />
                          </div>
                        </div>

                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                          {p.status === "completed" && (
                            <span className="flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-white backdrop-blur-xs">
                              <Clock className="h-3 w-3" />
                              {p.duration || 5}s
                            </span>
                          )}
                        </div>

                        <div className="absolute top-2 right-2">
                          <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-white backdrop-blur-xs">
                            {resLabel}
                          </span>
                        </div>
                      </Link>

                      {/* PROJECT DETAILS FOOTER */}
                      <div className="flex flex-col justify-between flex-1 p-3.5 space-y-3">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/projects/${p._id}`}
                              className="font-semibold text-sm text-primary hover:text-indigo-600 truncate transition"
                              title={p.name}
                            >
                              {p.name}
                            </Link>
                          </div>
                          <p className="text-[11px] text-primary/50 mt-0.5 line-clamp-1">
                            {p.prompt || "No prompt specified"}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-primary/60">
                          <span className="text-[10px] font-mono">
                            {new Date(p._creationTime).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>

                          <div className="flex items-center gap-1">
                            <Link href={`/editor/${p._id}`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1 hover:text-indigo-600"
                                title="Open in Timeline Editor"
                              >
                                <SlidersHorizontal className="h-3 w-3" />
                                Edit
                              </Button>
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleDuplicate(p._id)}
                              className="rounded p-1 text-primary/60 hover:bg-primary/5 hover:text-primary transition"
                              title="Duplicate Project"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMoveToTrash(p._id)}
                              className="rounded p-1 text-primary/60 hover:bg-destructive/10 hover:text-destructive transition"
                              title="Move to Trash"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 text-primary/60 uppercase font-mono text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Resolution</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-primary">
                      {projects.map((p) => {
                        const badge = statusBadges[p.status.toLowerCase()] || {
                          label: p.status,
                          className: "bg-muted text-muted-foreground",
                        };
                        const thumb = p.thumbnailUrl || p.thumbnailCdnUrl;

                        return (
                          <tr
                            key={p._id}
                            className="hover:bg-muted/30 transition group"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Link
                                  href={`/projects/${p._id}`}
                                  className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-slate-900 flex items-center justify-center border border-border"
                                >
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt={p.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Video className="h-4 w-4 text-primary/40" />
                                  )}
                                </Link>
                                <div className="min-w-0">
                                  <Link
                                    href={`/projects/${p._id}`}
                                    className="font-medium text-primary hover:text-indigo-600 truncate block transition"
                                  >
                                    {p.name}
                                  </Link>
                                  <span className="text-[10px] text-primary/50 line-clamp-1">
                                    {p.prompt || "No prompt specified"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-primary/70">
                              {p.duration || 5}s
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-primary/70">
                              {p.width === 1920 ? "1080p" : `${p.width}p`}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-primary/60 font-mono text-[11px]">
                              {new Date(p._creationTime).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link href={`/editor/${p._id}`}>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs gap-1 hover:text-indigo-600"
                                  >
                                    <SlidersHorizontal className="h-3 w-3" />
                                    Edit
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
                                  onClick={() => handleMoveToTrash(p._id)}
                                  className="rounded p-1.5 text-primary/60 hover:bg-destructive/10 hover:text-destructive transition"
                                  title="Move to Trash"
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
        )}

        {/* TRASH TAB */}
        {activeTab === "trash" && (
          <div className="space-y-6">
            {!trashedProjects || trashedProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-center shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary/40 mb-3">
                  <Trash2 className="h-6 w-6" />
                </span>
                <h3 className="text-base font-medium text-primary">
                  Trash is empty
                </h3>
                <p className="mt-1 text-sm text-primary/50 max-w-sm">
                  Deleted videos will be saved here so you can restore them or permanently remove them at any time.
                </p>
              </div>
            ) : viewMode === "grid" ? (
              /* TRASH CARDS GRID */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {trashedProjects.map((p) => {
                  const thumb = p.thumbnailUrl || p.thumbnailCdnUrl;
                  const deletedDate = p.deletedAt
                    ? new Date(p.deletedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Recently";

                  return (
                    <div
                      key={p._id}
                      className="group relative flex flex-col overflow-hidden rounded-xl border border-destructive/20 bg-card shadow-sm hover:border-destructive/40 transition opacity-90 hover:opacity-100"
                    >
                      {/* POSTER */}
                      <div className="relative aspect-video w-full overflow-hidden bg-slate-950 flex items-center justify-center grayscale group-hover:grayscale-0 transition">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={p.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-primary/30 p-4 text-center">
                            <Video className="h-8 w-8 mb-1.5 opacity-60" />
                            <span className="text-[10px] uppercase font-mono tracking-wider">
                              Trashed
                            </span>
                          </div>
                        )}

                        <div className="absolute top-2 left-2">
                          <span className="rounded-md bg-red-500/90 text-white px-2 py-0.5 text-[10px] font-semibold backdrop-blur-xs flex items-center gap-1">
                            <Trash2 className="h-3 w-3" />
                            In Trash
                          </span>
                        </div>
                      </div>

                      {/* DETAILS & ACTIONS */}
                      <div className="flex flex-col justify-between flex-1 p-3.5 space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm text-primary truncate" title={p.name}>
                            {p.name}
                          </h4>
                          <p className="text-[11px] text-destructive/80 mt-1 flex items-center gap-1 font-mono">
                            Deleted: {deletedDate}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/60">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(p._id)}
                            className="h-7 px-2 text-xs gap-1 border-primary/20 hover:bg-primary/5 hover:text-primary cursor-pointer"
                            title="Restore video back to active projects"
                          >
                            <ArchiveRestore className="h-3.5 w-3.5 text-indigo-500" />
                            Restore
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handlePermanentDelete(p._id)}
                            className="h-7 px-2 text-xs gap-1 cursor-pointer bg-red-600 hover:bg-red-700"
                            title="Delete permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Forever
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TRASH TABLE VIEW */
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 text-primary/60 uppercase font-mono text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Deleted Date</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-primary">
                      {trashedProjects.map((p) => {
                        const thumb = p.thumbnailUrl || p.thumbnailCdnUrl;
                        const deletedDate = p.deletedAt
                          ? new Date(p.deletedAt).toLocaleString()
                          : "Recently";

                        return (
                          <tr
                            key={p._id}
                            className="hover:bg-muted/30 transition group"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-slate-900 flex items-center justify-center border border-border grayscale">
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt={p.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Video className="h-4 w-4 text-primary/40" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-medium text-primary block truncate">
                                    {p.name}
                                  </span>
                                  <span className="text-[10px] text-primary/50 line-clamp-1">
                                    {p.prompt || "No prompt specified"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-red-500 font-mono text-[11px]">
                              {deletedDate}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRestore(p._id)}
                                  className="h-7 px-2.5 text-xs gap-1 border-primary/20 hover:bg-primary/5 cursor-pointer"
                                >
                                  <ArchiveRestore className="h-3.5 w-3.5 text-indigo-500" />
                                  Restore
                                </Button>

                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handlePermanentDelete(p._id)}
                                  className="h-7 px-2.5 text-xs gap-1 cursor-pointer bg-red-600 hover:bg-red-700"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete Forever
                                </Button>
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
        )}
      </div>
    </div>
  );
}

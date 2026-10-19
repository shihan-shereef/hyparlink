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
  Wand2,
  ArrowRight,
  Search,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  READY_MADE_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type VideoTemplate,
} from "@/lib/templates-catalog";

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
  const searchParams = useSearchParams();
  const { current, workspaces, select } = useWorkspace();
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Tab State: default to templates if requested or if navigated from "View all templates"
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"templates" | "projects">(
    requestedTab === "projects" ? "projects" : "templates",
  );

  useEffect(() => {
    if (requestedTab === "projects") {
      setActiveTab("projects");
    } else if (requestedTab === "templates") {
      setActiveTab("templates");
    }
  }, [requestedTab]);

  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

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

  // Filter 15 Templates
  const filteredTemplates = useMemo(() => {
    return READY_MADE_TEMPLATES.filter((tmpl) => {
      const matchCat =
        selectedCategory === "All" || tmpl.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        tmpl.title.toLowerCase().includes(q) ||
        tmpl.subtitle.toLowerCase().includes(q) ||
        tmpl.prompt.toLowerCase().includes(q) ||
        tmpl.tags.some((t) => t.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const handleUseTemplate = (tmpl: VideoTemplate) => {
    toast.success(`Loaded "${tmpl.title}" template! Navigating to create video...`);
    router.push(`/create-video?template=${encodeURIComponent(tmpl.id)}`);
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto w-full max-w-screen-xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-primary tracking-tight">
                Video Studio & Templates
              </h1>
              <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wider dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300">
                15 Ready-Made Templates
              </span>
            </div>
            <p className="text-xs text-primary/60 mt-1">
              Select any pre-designed template to immediately generate a video, or manage your existing video projects.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Tab Switcher */}
            <div className="flex items-center rounded-xl border border-border bg-card p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("templates")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeTab === "templates"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-primary/70 hover:text-primary hover:bg-secondary/50"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ready-Made Templates (15)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("projects")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  activeTab === "projects"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-primary/70 hover:text-primary hover:bg-secondary/50"
                }`}
              >
                <Film className="h-3.5 w-3.5" />
                <span>My Videos ({projects?.length || 0})</span>
              </button>
            </div>

            {activeTab === "projects" && (
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
            )}

            <Link href="/create-video">
              <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs">
                <Plus className="h-4 w-4" />
                Create Custom Video
              </Button>
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: 15 READY-MADE TEMPLATES GALLERY                                    */}
        {/* ========================================================================= */}
        {activeTab === "templates" && (
          <div className="space-y-6">
            {/* Search and Category Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-2xl shadow-2xs">
              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {TEMPLATE_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer shadow-2xs ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "border border-border bg-secondary/50 text-primary/70 hover:bg-secondary hover:text-primary"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[240px] max-w-xs">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-primary/40" />
                <input
                  type="text"
                  placeholder="Search 15 templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border bg-secondary/30 py-1.5 pl-8 pr-3 text-xs text-primary placeholder:text-primary/40 focus:bg-background focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950 transition"
                />
              </div>
            </div>

            {/* Template Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-5">
              {filteredTemplates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600/50 transition duration-200"
                >
                  <div>
                    {/* Visual Thumbnail Preview */}
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-950 border-b border-border">
                      {tmpl.renderThumbnail()}

                      {/* Floating Badges */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-mono font-bold text-white border border-white/10">
                          {tmpl.aspectRatio}
                        </span>
                        <span className="rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-300 border border-white/10">
                          {tmpl.duration}s
                        </span>
                      </div>

                      {tmpl.badge && (
                        <div className="absolute top-2.5 right-2.5">
                          <span className="rounded-md bg-indigo-600/90 backdrop-blur-md px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider shadow-xs">
                            {tmpl.badge}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Metadata & Title */}
                    <div className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {tmpl.category}
                        </span>
                        <div className="flex items-center gap-1">
                          {tmpl.tags.slice(0, 2).map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[9px] text-primary/50 bg-secondary px-1.5 py-0.5 rounded"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-sm text-primary leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                          {tmpl.title}
                        </h3>
                        <p className="text-xs text-primary/60 mt-0.5 line-clamp-1 font-medium">
                          {tmpl.subtitle}
                        </p>
                      </div>

                      {/* Prompt preview snippet */}
                      <div className="rounded-xl border border-border/80 bg-secondary/40 p-2.5 text-[11px] text-primary/75 italic line-clamp-2 leading-relaxed">
                        &ldquo;{tmpl.prompt}&rdquo;
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-4 pt-0">
                    <button
                      type="button"
                      onClick={() => handleUseTemplate(tmpl)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 text-xs font-bold transition shadow-xs cursor-pointer group-hover:shadow-md"
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      <span>Use Template & Create Video</span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-70 group-hover:translate-x-0.5 transition" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary/40 mb-2">
                  <Search className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-primary">No templates found matching &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-xs text-primary/50 mt-1">Try selecting &ldquo;All&rdquo; or clearing your search filter.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedCategory("All");
                    setSearchQuery("");
                  }}
                  className="mt-3 text-xs"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MY VIDEO PROJECTS                                                  */}
        {/* ========================================================================= */}
        {activeTab === "projects" && (
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
                  Choose one of our 15 ready-made templates to create your first video in seconds!
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("templates")}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  >
                    <Sparkles className="h-4 w-4" />
                    Explore 15 Ready-Made Templates
                  </Button>
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
              /* VIDEO PROJECT CARDS GRID */
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

                        {/* Badges on Thumbnail */}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>

                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <span className="rounded bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-mono font-medium text-white">
                            {resLabel}
                          </span>
                          <span className="rounded bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-mono font-medium text-white">
                            {p.duration}s
                          </span>
                        </div>
                      </Link>

                      {/* Content Section */}
                      <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                        <div>
                          <Link href={`/projects/${p._id}`}>
                            <h3 className="font-semibold text-sm text-primary hover:text-indigo-600 transition line-clamp-1">
                              {p.name}
                            </h3>
                          </Link>
                          <p className="mt-1 text-xs text-primary/60 line-clamp-2">
                            {p.prompt}
                          </p>
                        </div>

                        {/* Footer & Actions */}
                        <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-primary/50">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(p._creationTime).toLocaleDateString()}
                          </span>

                          <div className="flex items-center gap-1">
                            <Link href={`/editor/${p._id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px] gap-1"
                              >
                                <SlidersHorizontal className="h-3 w-3" /> Edit
                              </Button>
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(p._id)}
                              className="rounded p-1 text-primary/60 hover:bg-primary/5 hover:text-primary transition"
                              title="Duplicate project"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p._id)}
                              className="rounded p-1 text-primary/60 hover:bg-destructive/10 hover:text-destructive transition"
                              title="Delete project"
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
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wider text-primary/60 font-semibold">
                      <tr>
                        <th className="px-5 py-3.5">Video Name & Prompt</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Duration</th>
                        <th className="px-4 py-3.5">Resolution</th>
                        <th className="px-4 py-3.5">Created</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {projects.map((p) => {
                        const badge = statusBadges[p.status.toLowerCase()] || {
                          label: p.status,
                          className: "bg-muted text-muted-foreground",
                        };
                        const resLabel = p.width === 1920 ? "1080p" : `${p.width}p`;

                        return (
                          <tr key={p._id} className="hover:bg-secondary/40 transition">
                            <td className="px-5 py-4 max-w-sm">
                              <Link
                                href={`/projects/${p._id}`}
                                className="font-semibold text-primary hover:text-indigo-600 transition block truncate"
                              >
                                {p.name}
                              </Link>
                              <span className="text-xs text-primary/50 line-clamp-1 mt-0.5">
                                {p.prompt}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap font-mono text-xs text-primary/80">
                              {p.duration}s
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap font-mono text-xs text-primary/80">
                              {resLabel}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs text-primary/50">
                              {new Date(p._creationTime).toLocaleDateString()}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link href={`/projects/${p._id}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs"
                                  >
                                    <Play className="h-3 w-3" /> View
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
        )}
      </div>
    </div>
  );
}

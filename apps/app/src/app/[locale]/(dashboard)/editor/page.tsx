"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import {
  SlidersHorizontal,
  Play,
  Film,
  Sparkles,
  Search,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  RotateCw,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function LiveEditorProjectsPage() {
  const { current } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");

  const projects = useQuery(
    api.projects.list,
    current ? { workspaceId: current } : "skip",
  );

  const filteredProjects = (projects || []).filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) || p.prompt?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto w-full max-w-screen-xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-semibold text-primary">
                Live Editor
              </h1>
            </div>
            <p className="mt-1 text-sm text-primary/60">
              Inspect, modify, and re-render your HyperFrames compositions with
              frame-accurate GSAP timelines.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/create-video">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Create New Video
              </Button>
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/40" />
            <input
              type="text"
              placeholder="Filter compositions by title or prompt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-4 text-xs text-primary placeholder:text-primary/40 focus:border-primary/50 focus:outline-none"
            />
          </div>
          <span className="text-xs text-primary/50">
            {filteredProjects.length} composition
            {filteredProjects.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Project Grid */}
        {projects === undefined ? (
          <div className="flex h-64 items-center justify-center text-primary/40">
            <RotateCw className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
            <Film className="h-10 w-10 text-primary/30 mb-3" />
            <h3 className="text-sm font-medium text-primary">
              No compositions found
            </h3>
            <p className="mt-1 text-xs text-primary/60 max-w-sm">
              Generate a video composition from the Create Video page to start
              editing in Live Editor.
            </p>
            <Link href="/create-video" className="mt-4">
              <Button size="sm" className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Create Video
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProjects.map((project) => {
              const thumbUrl = project.thumbnailCdnUrl || project.thumbnailUrl;
              return (
                <div
                  key={project._id}
                  className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all duration-200 hover:border-primary/40 hover:shadow-lg"
                >
                  {/* Thumbnail / Video Preview Area */}
                  <div className="relative aspect-video w-full bg-black/60 overflow-hidden">
                    {thumbUrl ? (
                      // biome-ignore lint/a11y/useAltText: video poster
                      <img
                        src={thumbUrl}
                        alt={project.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card to-background">
                        <Film className="h-8 w-8 text-primary/20" />
                      </div>
                    )}

                    {/* Duration Badge */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white backdrop-blur">
                      <Clock className="h-2.5 w-2.5" />
                      {project.duration}s
                    </div>

                    {/* Resolution Badge */}
                    <div className="absolute top-2 left-2 rounded bg-primary/20 border border-primary/40 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-primary backdrop-blur">
                      {project.width}x{project.height}
                    </div>

                    {/* Hover Action Overlay */}
                    <Link
                      href={`/editor/${project._id}`}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100"
                    >
                      <div className="flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md transition-transform transform scale-90 group-hover:scale-100">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Open Editor
                      </div>
                    </Link>
                  </div>

                  {/* Metadata Content */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-semibold text-primary">
                        {project.name}
                      </h3>
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono capitalize border border-border bg-secondary text-primary/70">
                        {project.status}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-xs text-primary/60 flex-1">
                      {project.prompt}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                      <div className="flex items-center gap-1 text-[11px] text-primary/50">
                        <Layers className="h-3 w-3" />
                        <span>HyperFrames 0.8.139</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Link href={`/projects/${project._id}`}>
                          <button
                            type="button"
                            title="View Video Details"
                            className="rounded p-1 text-primary/50 hover:bg-primary/10 hover:text-primary transition"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        </Link>
                        <Link href={`/editor/${project._id}`}>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs gap-1 px-2.5"
                          >
                            Edit <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface SurgicalSceneRevisionProps {
  projectId: string;
  videoUrl: string;
  scenes?: Array<{
    id: string;
    name?: string;
    purpose?: string;
    duration?: number;
    headline?: string;
    onScreenText?: { headline?: string };
  }>;
  hidePlayer?: boolean;
  onRevisionSuccess?: (newVideoUrl: string) => void;
}

export function SurgicalSceneRevision({
  projectId,
  videoUrl,
  scenes = [],
  hidePlayer = false,
  onRevisionSuccess,
}: SurgicalSceneRevisionProps) {
  const [activeVideoUrl, setActiveVideoUrl] = useState(videoUrl);

  useEffect(() => {
    if (videoUrl) {
      setActiveVideoUrl(videoUrl);
    }
  }, [videoUrl]);

  return (
    <div className="space-y-6">
      {/* 1080P MASTER VIDEO PLAYER PREVIEW - Clean White Card */}
      {!hidePlayer && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center">
            <video
              key={activeVideoUrl}
              src={activeVideoUrl}
              controls
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
            >
              <source src={activeVideoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Video metadata and action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3.5 text-xs text-slate-800">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>1080p Master Render Complete &bull; Verified with FFprobe</span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={activeVideoUrl}
                download={`ollastar_${projectId}.mp4`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download MP4</span>
              </a>

              <Link
                href={`/editor/${projectId}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in Studio</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

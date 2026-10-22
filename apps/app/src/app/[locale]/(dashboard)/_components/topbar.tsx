"use client";

import { usePathname } from "next/navigation";
import { HelpCircle, Sparkles } from "lucide-react";
import { NotificationsBell } from "./notifications-bell";

export function Topbar() {
  const pathname = usePathname();

  // If inside video editor studio, do not render dashboard topbar
  if (pathname?.includes("/editor/")) {
    return null;
  }
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md dark:border-neutral-800 dark:bg-[#0c1017]/80">
      {/* Left: Ollastar Branding */}
      <div className="flex items-center gap-2.5">
        <img
          src="/ollastar-logo.png"
          alt="Ollastar"
          className="h-7 w-7 rounded-full object-contain"
        />
        <span className="font-bold tracking-tight text-slate-900 dark:text-white text-sm">
          Ollastar
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">

        <NotificationsBell />

        <a
          href="https://gamma.app"
          target="_blank"
          rel="noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-neutral-800 dark:hover:text-white transition"
          title="Help & Documentation"
        >
          <HelpCircle className="h-4 w-4" />
        </a>
      </div>
    </header>
  );
}

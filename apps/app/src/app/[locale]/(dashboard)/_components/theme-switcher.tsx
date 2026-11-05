"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@v1/ui/select";
import { cn } from "@v1/ui/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSwitcher({ triggerClass }: { triggerClass?: string }) {
  const [mounted, setMounted] = useState(false);
  const { theme: currentTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-8 w-full items-center justify-center rounded-xl bg-slate-100 dark:bg-neutral-800">
        <Sun className="h-3.5 w-3.5 text-slate-400" />
      </div>
    );
  }

  const isDark = currentTheme === "dark";

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between rounded-xl bg-slate-100 p-1 dark:bg-neutral-800/80 border border-slate-200/60 dark:border-neutral-700/50",
        triggerClass,
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setTheme("light");
        }}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-semibold transition cursor-pointer select-none",
          !isDark
            ? "bg-white text-slate-900 shadow-xs dark:bg-neutral-700 dark:text-white"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white",
        )}
      >
        <Sun className="h-3.5 w-3.5 text-amber-500" />
        <span>Light</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setTheme("dark");
        }}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-semibold transition cursor-pointer select-none",
          isDark
            ? "bg-white text-slate-900 shadow-xs dark:bg-neutral-700 dark:text-white"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white",
        )}
      >
        <Moon className="h-3.5 w-3.5 text-indigo-400" />
        <span>Dark</span>
      </button>
    </div>
  );
}

export function ThemeSwitcherHome() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, themes } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex gap-3">
      {themes.map((theme) => (
        <button
          key={theme}
          name="theme"
          onClick={() => setTheme(theme)}
          type="button"
        >
          {theme === "light" ? (
            <Sun className="h-4 w-4 text-primary/80 hover:text-primary" />
          ) : theme === "dark" ? (
            <Moon className="h-4 w-4 text-primary/80 hover:text-primary" />
          ) : (
            <Monitor className="h-4 w-4 text-primary/80 hover:text-primary" />
          )}
        </button>
      ))}
    </div>
  );
}

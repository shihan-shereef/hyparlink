"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  ChevronDown,
  FolderKanban,
  Image as ImageIcon,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeSwitcher } from "./theme-switcher";

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.getUser);
  const { workspaces, current, select } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const activeWorkspace = workspaces.find((w) => w._id === current) || workspaces[0];
  const workspaceName = activeWorkspace?.name === "Personal" 
    ? "Shihan Shereef's Workspace" 
    : (activeWorkspace?.name || "Shihan Shereef's Workspace");

  // User initials
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SW";

  const PRIMARY_WS = "mh7eadmg10g11yqwbjtyc41yjs8fxx17" as Id<"workspaces">;

  // Exact navigation items requested by user
  const navItems = [
    {
      href: "/create-video",
      label: "Create Video",
      icon: Sparkles,
      active: pathname === "/create-video",
    },
    {
      href: "/editor",
      label: "Live Editor",
      icon: Sliders,
      active: pathname.startsWith("/editor"),
    },
    {
      href: "/projects",
      label: "Projects",
      icon: FolderKanban,
      active: pathname.startsWith("/projects"),
    },
    {
      href: "/assets",
      label: "Assets",
      icon: ImageIcon,
      active: pathname.startsWith("/assets"),
    },
  ];

  const Body = (
    <div
      className={`flex h-full select-none flex-col justify-between border-r border-slate-200/90 bg-white transition-all duration-200 text-slate-800 dark:border-neutral-800 dark:bg-[#0c1017] dark:text-slate-200 ${
        collapsed ? "w-16 p-2 items-center" : "w-64 p-4"
      }`}
    >
      <div className={`flex flex-col space-y-4 ${collapsed ? "w-full items-center" : "w-full"}`}>
        {/* Ollastar Brand Header + Minimize Button */}
        <div className={`flex items-center justify-between py-1 ${collapsed ? "w-full justify-center flex-col gap-2" : "w-full px-2"}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src="/ollastar-logo.png"
              alt="Ollastar"
              className="h-8 w-8 rounded-full border border-slate-200 object-contain shadow-xs dark:border-neutral-700 shrink-0"
            />
            {!collapsed && (
              <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                Ollastar
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-neutral-800 dark:hover:text-white transition cursor-pointer shrink-0"
            title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Workspace Selector Card */}
        <div className={`relative ${collapsed ? "w-full flex justify-center" : "w-full"}`}>
          <button
            type="button"
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            className={`flex items-center rounded-xl p-2 hover:bg-slate-100/70 dark:hover:bg-neutral-800/60 transition cursor-pointer ${
              collapsed ? "justify-center w-10 h-10 p-0" : "w-full justify-between"
            }`}
            title={workspaceName}
          >
            <div className={`flex items-center gap-3 overflow-hidden ${collapsed ? "justify-center" : ""}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500 text-xs font-bold text-white shadow-xs">
                {initials}
              </span>
              {!collapsed && (
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="truncate text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                    {workspaceName}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Free</span>
                </div>
              )}
            </div>
            {!collapsed && <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
          </button>

          {/* Workspace Switcher Menu Popover */}
          {showWorkspaceMenu && (
            <div className={`absolute top-13 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-[#121620] animate-in fade-in zoom-in-95 duration-100 ${
              collapsed ? "left-12" : "left-0"
            }`}>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Switch Workspace
              </div>
              <div className="mt-1 space-y-1">
                {workspaces.map((w) => {
                  const isPrimary = w._id === PRIMARY_WS;
                  const isCurrent = w._id === current;
                  return (
                    <button
                      key={w._id}
                      type="button"
                      onClick={() => {
                        select(w._id);
                        setShowWorkspaceMenu(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs text-left transition cursor-pointer ${
                        isCurrent
                          ? "bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <span className="truncate">
                        {w.name} {isPrimary ? "★ (Primary)" : ""}
                      </span>
                      {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* "+ Create" Pill Button */}
        <Link
          href="/create-video"
          className={`flex items-center justify-center gap-2 rounded-xl bg-[#e9eefe] text-xs font-semibold text-[#3b52d9] shadow-2xs hover:bg-[#dce4fc] dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition ${
            collapsed ? "h-10 w-10 p-0" : "w-full py-2.5"
          }`}
          title="Create Video"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          {!collapsed && <span>Create</span>}
        </Link>

        {/* Core Navigation Links */}
        <nav className={`space-y-1 pt-1 ${collapsed ? "w-full flex flex-col items-center" : "w-full"}`}>
          {navItems.map((nav) => {
            const Icon = nav.icon;
            return (
              <Link
                key={nav.label}
                href={nav.href}
                className={`flex items-center rounded-xl text-xs font-medium transition ${
                  collapsed
                    ? "h-10 w-10 justify-center p-0"
                    : "w-full gap-3 px-3 py-2"
                } ${
                  nav.active
                    ? "bg-slate-100 font-bold text-slate-900 dark:bg-neutral-800 dark:text-white"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-neutral-800/60 dark:hover:text-white"
                }`}
                title={collapsed ? nav.label : undefined}
              >
                <Icon className={`h-4 w-4 shrink-0 ${nav.active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                {!collapsed && <span>{nav.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Trash & User Profile */}
      <div className={`space-y-2 border-t border-slate-100 pt-3 dark:border-neutral-800 ${collapsed ? "w-full flex flex-col items-center" : "w-full"}`}>
        <Link
          href="/projects"
          className={`flex items-center rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-neutral-800 transition ${
            collapsed ? "h-10 w-10 justify-center p-0" : "gap-3 px-3 py-2"
          }`}
          title={collapsed ? "Trash" : undefined}
        >
          <Trash2 className="h-4 w-4 text-slate-400 shrink-0" />
          {!collapsed && <span>Trash</span>}
        </Link>

        {/* User Account Controls */}
        <div className={`relative pt-1 ${collapsed ? "w-full flex justify-center" : "w-full"}`}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`flex items-center rounded-xl hover:bg-slate-100/70 dark:hover:bg-neutral-800/60 transition cursor-pointer ${
              collapsed ? "h-10 w-10 justify-center p-0" : "w-full justify-between p-2"
            }`}
            title={user?.name || "Shihan Shereef"}
          >
            <div className={`flex items-center gap-2.5 overflow-hidden ${collapsed ? "justify-center" : ""}`}>
              <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white shadow-2xs">
                {initials}
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white bg-emerald-400 dark:border-neutral-900" />
              </div>
              {!collapsed && (
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-200 leading-tight">
                    {user?.name || "Shihan Shereef"}
                  </span>
                  <span className="truncate text-[10px] text-slate-400">{user?.email}</span>
                </div>
              )}
            </div>
            {!collapsed && <Settings className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
          </button>

          {/* User Profile Dropdown Menu */}
          {showUserMenu && (
            <div className={`absolute bottom-12 z-50 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-[#121620] animate-in fade-in zoom-in-95 duration-100 ${
              collapsed ? "left-12" : "left-0"
            }`}>
              <div className="border-b border-slate-100 p-2 dark:border-neutral-800">
                <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                  {user?.name || "Shihan Shereef"}
                </p>
                <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
              </div>
              <div className="py-1">
                <div className="px-2 py-1">
                  <ThemeSwitcher />
                </div>
                <Link
                  href="/settings"
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-neutral-800 transition"
                >
                  <Settings className="h-3.5 w-3.5" /> Workspace Settings
                </Link>
                <Link
                  href="/login"
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition font-medium"
                >
                  <LogIn className="h-3.5 w-3.5" /> Sign In / Switch Account
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" /> Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navigation Toggle */}
      <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden dark:border-neutral-800 dark:bg-[#0c1017]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="text-slate-600 dark:text-slate-300"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-xs font-bold text-slate-800 dark:text-white">
            {workspaceName}
          </span>
        </div>
      </div>

      {/* Desktop Sticky Single Left Sidebar */}
      <aside className="sticky top-0 hidden h-screen shrink-0 md:block">
        {Body}
      </aside>

      {/* Mobile Drawer Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-xs"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full shadow-2xl">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute -right-9 top-3 text-white"
              onClick={() => setOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
            {Body}
          </div>
        </div>
      )}
    </>
  );
}

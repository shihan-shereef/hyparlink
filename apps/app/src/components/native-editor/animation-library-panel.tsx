"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  X,
  Loader2,
  Sparkles,
  Zap,
  Film,
  Plus,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Check,
  Play,
  RotateCcw,
  Sliders,
  Layers,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { SelectedElement } from "./types";

// Public LottieFiles GraphQL API endpoint
const LOTTIE_API_ENDPOINT = "https://graphql.lottiefiles.com/2022-08";

export type LottieCategory = "featured" | "popular" | "recent";

export interface LottieItem {
  id: string;
  name: string;
  lottieUrl: string;
  gifUrl: string | null;
  bgColor: string | null;
  author: string | null;
  authorPath: string | null;
}

export interface AnimationPresetItem {
  id: string;
  name: string;
  category: "entrance" | "exit" | "attention" | "text-motion";
  duration: number; // in seconds
  description: string;
  cssKeyframes: string;
  cssAnimation: string;
  gsapSnippet: string;
}

export const BUILTIN_ANIMATION_PRESETS: AnimationPresetItem[] = [
  // Entrance Presets
  {
    id: "fade-in",
    name: "Fade In",
    category: "entrance",
    duration: 0.8,
    description: "Smooth opacity transition from 0 to 100%",
    cssKeyframes: `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`,
    cssAnimation: `fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
    gsapSnippet: `gsap.from(target, { opacity: 0, duration: 0.8, ease: "power2.out" });`,
  },
  {
    id: "slide-in-left",
    name: "Slide In Left",
    category: "entrance",
    duration: 0.7,
    description: "Enters smoothly from the left viewport edge",
    cssKeyframes: `@keyframes slideInLeft { from { transform: translateX(-100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`,
    cssAnimation: `slideInLeft 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
    gsapSnippet: `gsap.from(target, { x: -100, opacity: 0, duration: 0.7, ease: "back.out(1.4)" });`,
  },
  {
    id: "slide-in-right",
    name: "Slide In Right",
    category: "entrance",
    duration: 0.7,
    description: "Enters smoothly from the right viewport edge",
    cssKeyframes: `@keyframes slideInRight { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`,
    cssAnimation: `slideInRight 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
    gsapSnippet: `gsap.from(target, { x: 100, opacity: 0, duration: 0.7, ease: "back.out(1.4)" });`,
  },
  {
    id: "pop-in",
    name: "Pop In (Elastic Scale)",
    category: "entrance",
    duration: 0.6,
    description: "Springy elastic pop from scale 0 to 1",
    cssKeyframes: `@keyframes popIn { 0% { transform: scale(0.3); opacity: 0; } 70% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }`,
    cssAnimation: `popIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
    gsapSnippet: `gsap.from(target, { scale: 0.2, opacity: 0, duration: 0.6, ease: "elastic.out(1, 0.5)" });`,
  },
  {
    id: "zoom-in-up",
    name: "Zoom In Up",
    category: "entrance",
    duration: 0.8,
    description: "Zooms in from below with upward kinetic momentum",
    cssKeyframes: `@keyframes zoomInUp { from { transform: translateY(60px) scale(0.85); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }`,
    cssAnimation: `zoomInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
    gsapSnippet: `gsap.from(target, { y: 60, scale: 0.85, opacity: 0, duration: 0.8, ease: "power3.out" });`,
  },

  // Exit Presets
  {
    id: "fade-out",
    name: "Fade Out",
    category: "exit",
    duration: 0.6,
    description: "Fades out element opacity to zero",
    cssKeyframes: `@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }`,
    cssAnimation: `fadeOut 0.6s ease-in forwards`,
    gsapSnippet: `gsap.to(target, { opacity: 0, duration: 0.6, ease: "power2.in" });`,
  },
  {
    id: "slide-out-right",
    name: "Slide Out Right",
    category: "exit",
    duration: 0.6,
    description: "Disappears smoothly towards the right edge",
    cssKeyframes: `@keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120px); opacity: 0; } }`,
    cssAnimation: `slideOutRight 0.6s cubic-bezier(0.4, 0, 1, 1) forwards`,
    gsapSnippet: `gsap.to(target, { x: 120, opacity: 0, duration: 0.6, ease: "power2.in" });`,
  },
  {
    id: "zoom-out",
    name: "Zoom Out Disappear",
    category: "exit",
    duration: 0.5,
    description: "Contracts inwards and dissolves",
    cssKeyframes: `@keyframes zoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.4); opacity: 0; } }`,
    cssAnimation: `zoomOut 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
    gsapSnippet: `gsap.to(target, { scale: 0.4, opacity: 0, duration: 0.5, ease: "power3.in" });`,
  },

  // Attention & Continuous Presets
  {
    id: "pulse",
    name: "Gentle Pulse",
    category: "attention",
    duration: 1.5,
    description: "Continuous subtle rhythmic heartbeat pulse",
    cssKeyframes: `@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }`,
    cssAnimation: `pulse 1.5s ease-in-out infinite`,
    gsapSnippet: `gsap.to(target, { scale: 1.06, duration: 0.75, repeat: -1, yoyo: true, ease: "sine.inOut" });`,
  },
  {
    id: "shake",
    name: "Energy Shake",
    category: "attention",
    duration: 0.8,
    description: "Quick kinetic horizontal attention shake",
    cssKeyframes: `@keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }`,
    cssAnimation: `shake 0.8s ease-in-out infinite`,
    gsapSnippet: `gsap.to(target, { x: 6, duration: 0.08, repeat: 7, yoyo: true, ease: "rough" });`,
  },
  {
    id: "float",
    name: "Floating Levitating",
    category: "attention",
    duration: 2.4,
    description: "Silky smooth vertical bobbing motion",
    cssKeyframes: `@keyframes floatLevitate { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`,
    cssAnimation: `floatLevitate 2.4s ease-in-out infinite`,
    gsapSnippet: `gsap.to(target, { y: -10, duration: 1.2, repeat: -1, yoyo: true, ease: "sine.inOut" });`,
  },

  // Text Motion
  {
    id: "text-typewriter",
    name: "Typewriter Reveal",
    category: "text-motion",
    duration: 1.8,
    description: "Letter-by-letter kinetic typing sequence",
    cssKeyframes: `@keyframes typewriter { from { width: 0; } to { width: 100%; } }`,
    cssAnimation: `typewriter 1.8s steps(30) forwards`,
    gsapSnippet: `gsap.from(target, { text: "", duration: 1.8, ease: "none" });`,
  },
  {
    id: "tracking-spread",
    name: "Kinetic Tracking Spread",
    category: "text-motion",
    duration: 1.2,
    description: "Expands letter-spacing smoothly on entrance",
    cssKeyframes: `@keyframes trackingSpread { from { letter-spacing: -0.2em; opacity: 0; } to { letter-spacing: 0.05em; opacity: 1; } }`,
    cssAnimation: `trackingSpread 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
    gsapSnippet: `gsap.from(target, { letterSpacing: "-0.2em", opacity: 0, duration: 1.2, ease: "power3.out" });`,
  },
];

interface AnimationLibraryPanelProps {
  onInsertLottie: (animation: LottieItem) => void;
  onApplyPreset: (preset: AnimationPresetItem) => void;
  selectedElement?: SelectedElement | null;
  currentTime?: number;
}

export const AnimationLibraryPanel: React.FC<AnimationLibraryPanelProps> = memo(
  function AnimationLibraryPanel({
    onInsertLottie,
    onApplyPreset,
    selectedElement,
    currentTime = 0,
  }) {
    // Mode toggle: Lottie Assets vs. Animation Presets
    const [mode, setMode] = useState<"lottie" | "presets">("lottie");

    // Lottie Browser States
    const [lottieCategory, setLottieCategory] = useState<LottieCategory>("featured");
    const [searchQuery, setSearchQuery] = useState("");
    const [lottieItems, setLottieItems] = useState<LottieItem[]>([]);
    const [isLoadingLottie, setIsLoadingLottie] = useState(false);
    const [lottieError, setLottieError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

    // Preset Filter States
    const [presetCategory, setPresetCategory] = useState<string>("all");
    const [presetSearch, setPresetSearch] = useState("");
    const [previewingPresetId, setPreviewingPresetId] = useState<string | null>(null);

    // Fetch Lottie items from LottieFiles public GraphQL API
    const fetchLottieData = useCallback(
      async (cat: LottieCategory, query: string, pageNum: number) => {
        setIsLoadingLottie(true);
        setLottieError(null);

        const trimmed = query.trim();
        const isSearch = trimmed.length > 0;
        const fieldName = isSearch
          ? "searchPublicAnimations"
          : cat === "popular"
          ? "popularPublicAnimations"
          : cat === "recent"
          ? "recentPublicAnimations"
          : "featuredPublicAnimations";

        const varDefs = isSearch
          ? "($first: Int!, $after: String, $query: String!)"
          : "($first: Int!, $after: String)";
        const args = isSearch
          ? "query: $query, first: $first, after: $after"
          : "first: $first, after: $after";

        const queryString = `query LottieBrowse${varDefs} {
          ${fieldName}(${args}) {
            totalCount
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                name
                lottieUrl
                gifUrl
                bgColor
                createdBy { name username }
              }
            }
          }
        }`;

        // Cursor encoding using standard Relay offset
        const offset = pageNum * 20;
        const afterCursor = offset > 0 ? btoa(`arrayconnection:${offset - 1}`) : null;

        const variables: Record<string, unknown> = {
          first: 20,
          after: afterCursor,
        };
        if (isSearch) variables.query = trimmed;

        try {
          const response = await fetch(LOTTIE_API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: queryString, variables }),
          });

          if (!response.ok) {
            throw new Error(`LottieFiles API returned status ${response.status}`);
          }

          const json = await response.json();
          if (json.errors && json.errors.length > 0) {
            throw new Error(json.errors[0]?.message || "GraphQL query error");
          }

          const connection = json.data?.[fieldName];
          if (!connection) {
            setLottieItems([]);
            setTotalCount(0);
            return;
          }

          const mapped: LottieItem[] = (connection.edges || [])
            .map((edge: any) => {
              const node = edge?.node;
              if (!node || !node.lottieUrl) return null;
              return {
                id: String(node.id),
                name: node.name?.trim() || "Untitled Animation",
                lottieUrl: node.lottieUrl,
                gifUrl: node.gifUrl || null,
                bgColor: node.bgColor || null,
                author: node.createdBy?.name?.trim() || null,
                authorPath: node.createdBy?.username || null,
              };
            })
            .filter(Boolean);

          setLottieItems(mapped);
          setTotalCount(connection.totalCount || mapped.length);
        } catch (err: any) {
          console.warn("[AnimationLibraryPanel] Lottie fetch warning:", err);
          // Fallback to sample curated lottie animations if network fails
          setLottieError("Could not reach LottieFiles live API. Showing curated sample set.");
          setLottieItems([
            {
              id: "curated-1",
              name: "Rocket Launch Kinetic",
              lottieUrl: "https://assets-v2.lottiefiles.com/a/48f07b1a-1188-11ee-8eb4-0377c867ee42/lH3j8E5dI4.lottie",
              gifUrl: "https://assets-v2.lottiefiles.com/a/48f07b1a-1188-11ee-8eb4-0377c867ee42/lH3j8E5dI4.gif",
              bgColor: "#1e1e2d",
              author: "LottieFiles Creator",
              authorPath: "/lottiefiles",
            },
            {
              id: "curated-2",
              name: "Animated Checkmark Success",
              lottieUrl: "https://assets-v2.lottiefiles.com/a/b477b94e-118a-11ee-a3ea-9fc60eb688c2/bKkX3Y4zN7.lottie",
              gifUrl: "https://assets-v2.lottiefiles.com/a/b477b94e-118a-11ee-a3ea-9fc60eb688c2/bKkX3Y4zN7.gif",
              bgColor: "#14251f",
              author: "Motion Studio",
              authorPath: "/motionstudio",
            },
            {
              id: "curated-3",
              name: "Floating Graph Analytics",
              lottieUrl: "https://assets-v2.lottiefiles.com/a/5cf5e796-1175-11ee-9642-1beee8eb5432/qVbL6T8yP1.lottie",
              gifUrl: "https://assets-v2.lottiefiles.com/a/5cf5e796-1175-11ee-9642-1beee8eb5432/qVbL6T8yP1.gif",
              bgColor: "#192231",
              author: "Alex Motion",
              authorPath: "/alexmotion",
            },
            {
              id: "curated-4",
              name: "Loading Dynamic Spinner",
              lottieUrl: "https://assets-v2.lottiefiles.com/a/36a99e74-118b-11ee-8ec7-cfef7c3f3ab5/vXpM2Z9wT8.lottie",
              gifUrl: "https://assets-v2.lottiefiles.com/a/36a99e74-118b-11ee-8ec7-cfef7c3f3ab5/vXpM2Z9wT8.gif",
              bgColor: "#251829",
              author: "Design Labs",
              authorPath: "/designlabs",
            },
          ]);
          setTotalCount(4);
        } finally {
          setIsLoadingLottie(false);
        }
      },
      [],
    );

    // Debounced search / Category change effect
    useEffect(() => {
      const timer = setTimeout(() => {
        setPage(0);
        fetchLottieData(lottieCategory, searchQuery, 0);
      }, 350);
      return () => clearTimeout(timer);
    }, [lottieCategory, searchQuery, fetchLottieData]);

    const handleNextPage = () => {
      const next = page + 1;
      setPage(next);
      fetchLottieData(lottieCategory, searchQuery, next);
    };

    const handlePrevPage = () => {
      if (page <= 0) return;
      const prev = page - 1;
      setPage(prev);
      fetchLottieData(lottieCategory, searchQuery, prev);
    };

    // Filter Animation Presets
    const filteredPresets = BUILTIN_ANIMATION_PRESETS.filter((p) => {
      const matchesCategory = presetCategory === "all" || p.category === presetCategory;
      const q = presetSearch.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden text-gray-800 select-none">
        {/* Top Header Mode Switcher (Lottie Library vs. Animation Presets) */}
        <div className="p-2.5 border-b border-gray-200 bg-[#f9fafb] shrink-0">
          <div className="flex items-center p-0.5 rounded-lg bg-gray-200/80 border border-gray-200">
            <button
              type="button"
              onClick={() => setMode("lottie")}
              className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                mode === "lottie"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Film className="w-3.5 h-3.5 text-cyan-600" />
              <span>Lottie Library</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("presets")}
              className={`flex-1 py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                mode === "presets"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              <span>Motion Presets</span>
            </button>
          </div>
        </div>

        {/* MODE 1: LOTTIE BROWSER & ASSETS PANEL (FREECUT INTEGRATION) */}
        {mode === "lottie" && (
          <div className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden">
            {/* Search Input */}
            <div className="relative mb-2.5 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search animations on LottieFiles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#f9fafb] border border-gray-200 rounded-md pl-8 pr-8 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition shadow-xs"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Pills (Featured, Popular, Recent) */}
            {!searchQuery.trim() && (
              <div className="flex items-center gap-1 mb-2.5 shrink-0">
                {(["featured", "popular", "recent"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setLottieCategory(cat);
                      setPage(0);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] capitalize font-medium transition ${
                      lottieCategory === cat
                        ? "bg-cyan-600 text-white font-bold shadow-xs"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Sub-header status & counter */}
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2 px-0.5 shrink-0">
              <span>
                {isLoadingLottie ? (
                  <span className="flex items-center gap-1 text-cyan-600">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading Lottie animations...
                  </span>
                ) : (
                  `Found ${totalCount > 0 ? totalCount : lottieItems.length} animations`
                )}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">Page {page + 1}</span>
            </div>

            {/* Results Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {lottieItems.length === 0 && !isLoadingLottie && (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No Lottie animations found. Try another query or category.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {lottieItems.map((anim) => {
                  const isImported = importedIds.has(anim.id);
                  return (
                    <div
                      key={anim.id}
                      className="group p-2 rounded-lg border border-gray-200 bg-white hover:border-cyan-400 hover:shadow-md transition flex flex-col justify-between"
                    >
                      {/* Animated Preview Thumbnail */}
                      <div
                        className="w-full h-24 rounded-md overflow-hidden relative mb-2 flex items-center justify-center border border-gray-200"
                        style={{
                          backgroundColor: anim.bgColor || "#f1f5f9",
                        }}
                      >
                        {anim.gifUrl ? (
                          <img
                            crossOrigin="anonymous"
                            src={anim.gifUrl}
                            alt={anim.name}
                            loading="lazy"
                            className="w-full h-full object-contain pointer-events-none group-hover:scale-105 transition duration-200"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 text-gray-400">
                            <Film className="w-6 h-6 text-gray-400" />
                            <span className="text-[9px] font-mono">.lottie</span>
                          </div>
                        )}

                        <span className="absolute top-1 right-1 text-[8px] font-bold px-1.5 py-0.2 rounded bg-black/60 text-white font-mono">
                          LOTTIE
                        </span>
                      </div>

                      {/* Animation Title & Author */}
                      <div className="mb-2">
                        <span
                          className="text-xs font-semibold text-gray-900 group-hover:text-cyan-700 transition block truncate"
                          title={anim.name}
                        >
                          {anim.name}
                        </span>
                        {anim.author && (
                          <span className="text-[10px] text-gray-400 truncate block mt-0.5">
                            by {anim.author}
                          </span>
                        )}
                      </div>

                      {/* Action Button: Insert to Composition */}
                      <button
                        type="button"
                        onClick={() => {
                          onInsertLottie(anim);
                          setImportedIds((prev) => new Set([...prev, anim.id]));
                          toast.success(`Inserted "${anim.name}" into active composition!`);
                        }}
                        className={`w-full py-1.5 px-2 rounded text-[11px] font-bold flex items-center justify-center gap-1.5 transition shadow-xs ${
                          isImported
                            ? "bg-emerald-600 text-white hover:bg-emerald-500"
                            : "bg-cyan-600 hover:bg-cyan-500 text-white"
                        }`}
                      >
                        {isImported ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Added to Scene
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" /> Insert into Scene
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="pt-2.5 mt-2 border-t border-gray-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={page <= 0 || isLoadingLottie}
                className="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>

              <span className="text-[11px] font-mono text-gray-500">
                Page {page + 1}
              </span>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={isLoadingLottie || lottieItems.length < 20}
                className="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* MODE 2: ANIMATION PRESETS & KEYFRAME LIBRARY (FREECUT INTEGRATION) */}
        {mode === "presets" && (
          <div className="flex-1 min-h-0 flex flex-col p-3 overflow-hidden">
            {/* Search Input */}
            <div className="relative mb-2.5 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search entrance, exit, attention presets..."
                value={presetSearch}
                onChange={(e) => setPresetSearch(e.target.value)}
                className="w-full bg-[#f9fafb] border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 transition shadow-xs"
              />
            </div>

            {/* Preset Category Filter Chips */}
            <div className="flex items-center gap-1 mb-2.5 shrink-0 overflow-x-auto no-scrollbar">
              {[
                { id: "all", label: "All" },
                { id: "entrance", label: "Entrance" },
                { id: "exit", label: "Exit" },
                { id: "attention", label: "Attention" },
                { id: "text-motion", label: "Text Motion" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setPresetCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap font-medium transition ${
                    presetCategory === cat.id
                      ? "bg-purple-600 text-white font-bold shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Active Selection Target Notice */}
            <div className="mb-2.5 p-2 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-between text-xs text-purple-900 shrink-0 shadow-2xs">
              <div className="flex items-center gap-2 truncate">
                <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="truncate">
                  Target: <strong>{selectedElement ? selectedElement.id : "Current Scene Canvas"}</strong>
                </span>
              </div>
              <span className="text-[10px] font-mono text-purple-700 bg-purple-100/80 px-1.5 py-0.5 rounded shrink-0">
                {currentTime.toFixed(1)}s
              </span>
            </div>

            {/* Presets List */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
              {filteredPresets.map((preset) => {
                const isPreviewing = previewingPresetId === preset.id;
                const badgeColor =
                  preset.category === "entrance"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : preset.category === "exit"
                    ? "bg-rose-100 text-rose-800 border-rose-200"
                    : preset.category === "text-motion"
                    ? "bg-blue-100 text-blue-800 border-blue-200"
                    : "bg-amber-100 text-amber-800 border-amber-200";

                return (
                  <div
                    key={preset.id}
                    className="p-3 rounded-lg border border-gray-200 bg-white hover:border-purple-300 hover:shadow-xs transition flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900">{preset.name}</span>
                          <span
                            className={`text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded border ${badgeColor}`}
                          >
                            {preset.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">{preset.description}</p>
                      </div>
                      <span className="text-[10px] font-mono text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded shrink-0">
                        {preset.duration}s
                      </span>
                    </div>

                    {/* Interactive Live Motion Preview Simulation Box */}
                    <div className="h-10 my-1 rounded bg-[#f8fafc] border border-gray-200 flex items-center justify-center overflow-hidden relative">
                      <div
                        className="px-3 py-1 rounded bg-purple-600 text-white text-[10px] font-bold shadow-xs transition-all"
                        style={{
                          animation: isPreviewing ? preset.cssAnimation : undefined,
                        }}
                      >
                        {preset.name}
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2 mt-2 pt-1 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewingPresetId(preset.id);
                          setTimeout(() => setPreviewingPresetId(null), preset.duration * 1000 + 400);
                        }}
                        className="flex-1 py-1 px-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                      >
                        <Play className="w-3 h-3 text-purple-600" />
                        <span>Preview</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onApplyPreset(preset);
                          toast.success(
                            `Applied "${preset.name}" preset to ${selectedElement ? selectedElement.id : "active scene"}!`,
                          );
                        }}
                        className="flex-1 py-1 px-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition shadow-xs"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Apply Motion</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  },
);

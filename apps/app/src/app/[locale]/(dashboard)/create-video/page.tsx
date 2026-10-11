"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  Sparkles,
  Film,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Video,
  FolderKanban,
  FileImage,
  FileVideo,
  FileAudio,
  Upload,
  Plus,
  Play,
  X,
  Check,
  Layers,
  Smartphone,
  Flame,
  ChevronRight,
  Info,
  HelpCircle,
  Tv,
  ArrowUp,
  Sliders,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface InspirationItem {
  id: string;
  title: string;
  category: "Motion graphics" | "A-roll Cuts" | "Mobile Ads" | "Shaders";
  author: string;
  duration: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  prompt: string;
  description: string;
  accentColor: string;
  visualType:
    | "counter"
    | "chart"
    | "speaker"
    | "kinetic"
    | "shader"
    | "mobile"
    | "neural"
    | "eco";
}

const INSPIRATIONS: InspirationItem[] = [
  {
    id: "metric-counter",
    title: "1,000,000 Developers",
    category: "Motion graphics",
    author: "By Eric Ciarla (hiring)",
    duration: 15,
    aspectRatio: "16:9",
    prompt:
      "Create an authoritative milestone celebration video featuring '1,000,000 Developers' with dynamic numerical counter animations, clean grid lines, and kinetic typography.",
    description: "Bold animated milestone counter, grid lines, timeline dots, 15s preset",
    accentColor: "#ff4d29",
    visualType: "counter",
  },
  {
    id: "revenue-chart",
    title: "Quarterly Revenue & Analytics",
    category: "Motion graphics",
    author: "By Leon Fucak",
    duration: 15,
    aspectRatio: "16:9",
    prompt:
      "Create a modern animated analytics and growth report with dynamic pastel bar charts, financial KPI metrics, and smooth node transitions.",
    description: "Clean pastel bar charts, revenue growth metrics, and KPI callouts",
    accentColor: "#8b5cf6",
    visualType: "chart",
  },
  {
    id: "speaker-spotlight",
    title: "Creator Studio Spotlight",
    category: "A-roll Cuts",
    author: "By Alex Vance",
    duration: 15,
    aspectRatio: "16:9",
    prompt:
      "Create a professional creator spotlight video with talking head framing, elegant lower-third title card, and synchronized visual highlights.",
    description: "Talking head portrait cut with animated lower third and audio waveforms",
    accentColor: "#ec4899",
    visualType: "speaker",
  },
  {
    id: "kinetic-terminal",
    title: "Limit Close Orders",
    category: "Motion graphics",
    author: "By Quantum Labs",
    duration: 10,
    aspectRatio: "16:9",
    prompt:
      "Create a futuristic dark-mode fintech presentation with kinetic typography for 'limit close orders', glowing neon gridlines, and high-frequency data columns.",
    description: "Dark minimalist fintech UI with neon typography and glowing grid",
    accentColor: "#06b6d4",
    visualType: "kinetic",
  },
  {
    id: "iridescent-waves",
    title: "Fluid Iridescent Waves",
    category: "Shaders",
    author: "By Studio Chroma",
    duration: 15,
    aspectRatio: "16:9",
    prompt:
      "Create an ambient brand identity video featuring hypnotic iridescent gradient waves with fluid distortion, glowing color shifts, and cinematic title reveals.",
    description: "Hypnotic fluid wave physics with violet, magenta, and amber chromatic glow",
    accentColor: "#f97316",
    visualType: "shader",
  },
  {
    id: "mobile-launch-story",
    title: "Mobile App Launch Story",
    category: "Mobile Ads",
    author: "By AppCraft",
    duration: 15,
    aspectRatio: "9:16",
    prompt:
      "Create a high-converting 9:16 vertical mobile video ad for our app launch, featuring 3D smartphone frame animations, smooth UI gestures, and an App Store CTA.",
    description: "9:16 vertical smartphone frame with sleek gesture animations and CTA",
    accentColor: "#3b82f6",
    visualType: "mobile",
  },
  {
    id: "neural-network",
    title: "Neural Architecture Explainer",
    category: "Motion graphics",
    author: "By Synth AI",
    duration: 15,
    aspectRatio: "16:9",
    prompt:
      "Create an AI architecture explainer video visualizing neural network layers, glowing synaptic connections, and tensor data pipelines.",
    description: "Interconnected neural network nodes with pulsating synaptic vectors",
    accentColor: "#10b981",
    visualType: "neural",
  },
  {
    id: "clean-tech",
    title: "EcoEnergy Clean Tech",
    category: "Motion graphics",
    author: "By GreenGrid",
    duration: 15,
    aspectRatio: "16:9",
    prompt:
      "Create an eco-tech sustainability presentation highlighting renewable energy metrics, emerald glassmorphism, and clean circular lifecycle diagrams.",
    description: "Clean energy presentation with emerald glow and lifecycle vector nodes",
    accentColor: "#14b8a6",
    visualType: "eco",
  },
];

const CATEGORIES = [
  "All",
  "Motion graphics",
  "A-roll Cuts",
  "Mobile Ads",
  "Shaders",
] as const;

export default function CreateVideoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { current } = useWorkspace();
  const createProject = useMutation(api.projects.create);
  const createAsset = useMutation(api.assets.create);

  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<number>(5);
  const [resolution, setResolution] = useState<string>("1080p");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [fps, setFps] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<Id<"projects"> | null>(
    null,
  );
  const [selectedAssetIds, setSelectedAssetIds] = useState<Id<"assets">[]>([]);
  const [selectedInspirationId, setSelectedInspirationId] = useState<string | null>(
    null,
  );
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [assetFilter, setAssetFilter] = useState<"all" | "video" | "image">(
    "all",
  );
  const [showStepByStep, setShowStepByStep] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aiStatus, setAiStatus] = useState<{
    provider: string;
    model: string;
    configured: boolean;
    status: string;
    statusLabel: string;
    message?: string;
    lastChecked?: string;
  } | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const fetchAiStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch("/api/ai/status");
      if (res.ok) {
        const data = await res.json();
        setAiStatus(data);
      } else {
        setAiStatus({
          provider: "backend",
          model: "unknown",
          configured: false,
          status: "error",
          statusLabel: "Status Check Failed",
          message: `HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      setAiStatus({
        provider: "backend",
        model: "offline",
        configured: false,
        status: "unavailable",
        statusLabel: "Provider Service Offline",
        message: err.message,
      });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchAiStatus();
  }, []);

  // Query workspace assets
  const workspaceAssets = useQuery(
    api.assets.list,
    current ? { workspaceId: current } : "skip",
  );

  useEffect(() => {
    const assetIdParam = searchParams.get("assetId");
    if (
      assetIdParam &&
      !selectedAssetIds.includes(assetIdParam as Id<"assets">)
    ) {
      setSelectedAssetIds((prev) => [...prev, assetIdParam as Id<"assets">]);
    }
  }, [searchParams]);

  // Reactive subscription to active project status
  const activeProject = useQuery(
    api.projects.get,
    activeProjectId ? { projectId: activeProjectId } : "skip",
  );

  const toggleAsset = (assetId: Id<"assets">) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId],
    );
  };

  const handleSelectInspiration = (item: InspirationItem) => {
    setSelectedInspirationId(item.id);
    setPrompt(item.prompt);
    setName(item.title);
    setDuration(item.duration);
    setAspectRatio(item.aspectRatio);
    toast.success(`Loaded inspiration: ${item.title}`);
  };

  const handleClearInspiration = () => {
    setSelectedInspirationId(null);
  };

  // Direct Video & Media Upload Handler
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !current) return;

    let assetType = "image";
    if (file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
      assetType = "video";
    } else if (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac)$/i.test(file.name)) {
      assetType = "audio";
    }

    const maxMb = assetType === "video" ? 500 : 25;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File exceeds ${maxMb}MB limit for ${assetType}s`);
      return;
    }

    setIsUploadingMedia(true);
    const toastId = toast.loading(`Uploading reference ${assetType}: ${file.name}...`);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64 = res.split(",")[1];
          resolve(base64 || "");
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const data = await base64Promise;

      const backendBase = "";
      const uploadRes = await fetch(`${backendBase}/assets/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: current,
          name: file.name,
          originalFilename: file.name,
          type: assetType,
          mimeType: file.type || (assetType === "video" ? "video/mp4" : "image/jpeg"),
          data,
        }),
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed with status ${uploadRes.status}`);
      }

      const uploadData = await uploadRes.json();

      const newAssetId = await createAsset({
        workspaceId: current,
        name: file.name,
        originalFilename: file.name,
        type: assetType,
        mimeType: uploadData.mimeType,
        size: uploadData.size,
        storageProvider: uploadData.storageProvider || "local",
        storageKey: uploadData.storageKey,
        storageUrl: uploadData.storageUrl,
        cdnUrl: uploadData.cdnUrl,
      });

      // Automatically select the new asset
      if (newAssetId) {
        setSelectedAssetIds((prev) => [...prev, newAssetId as Id<"assets">]);
      }

      // Auto-append reference text to prompt if prompt is empty or asks for it
      if (!prompt.trim()) {
        setPrompt(
          `Create a professional video composition inspired by the attached ${assetType} '${file.name}', recreating its visual rhythm, modern typography, and smooth camera motion.`,
        );
      } else if (!prompt.includes(file.name)) {
        toast("Attached reference media to video plan", {
          description: `Asset ${file.name} will be utilized in composition scenes.`,
        });
      }

      toast.success(`${file.name} uploaded and attached!`, { id: toastId });
    } catch (err: any) {
      console.error("Media upload error:", err);
      toast.error(err.message || "Failed to upload reference media", { id: toastId });
    } finally {
      setIsUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) {
      toast.error("Please select a workspace");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Please enter a video prompt");
      return;
    }

    setIsSubmitting(true);
    try {
      let width = 1920;
      let height = 1080;
      if (aspectRatio === "9:16") {
        width = resolution === "1080p" ? 1080 : 720;
        height = resolution === "1080p" ? 1920 : 1280;
      } else if (aspectRatio === "1:1") {
        width = resolution === "1080p" ? 1080 : 720;
        height = resolution === "1080p" ? 1080 : 720;
      } else {
        width = resolution === "1080p" ? 1920 : 1280;
        height = resolution === "1080p" ? 1080 : 720;
      }

      let projectName = name.trim();
      const pLower = prompt.trim().toLowerCase();
      const isPresetTitle =
        INSPIRATIONS.some(
          (i) => i.title.toLowerCase() === projectName.toLowerCase(),
        ) ||
        projectName.toLowerCase() === "tech academy ad" ||
        projectName.toLowerCase() === "cinematic product video";

      if (pLower.includes("ollima")) {
        projectName = "Ollama Commercial";
      } else if (pLower.includes("networks home")) {
        projectName = "Networks Home";
      } else if (
        !projectName ||
        projectName.toLowerCase().includes("quarterly") ||
        isPresetTitle
      ) {
        const stripped = prompt
          .trim()
          .replace(
            /^create\s+(?:a\s+)?(?:\d+[- ]seconds?\s+)?(?:cinematic\s+)?(?:product\s+)?(?:advertisement|video|presentation)?\s*(?:of|for|about)?\s*/i,
            "",
          )
          .replace(
            /\s*(?:with\s+three\s+scenes|smooth transitions|final call).*$/i,
            "",
          )
          .trim();
        projectName = stripped
          ? stripped.charAt(0).toUpperCase() + stripped.slice(1, 35)
          : "AI Video Project";
      }


      const res = await createProject({
        workspaceId: current,
        name: projectName,
        prompt: prompt.trim(),
        duration,
        width,
        height,
        fps,
        assetIds: selectedAssetIds.length > 0 ? selectedAssetIds : undefined,
      });

      setActiveProjectId(res.projectId);
      toast.success("Video generation job created!");
    } catch (err: any) {
      toast.error(err.message || "Failed to start generation");
      setIsSubmitting(false);
    }
  };

  const getStepStatus = (step: number) => {
    if (!activeProject) return "pending";
    const status = activeProject.status.toLowerCase();
    if (status === "failed") return "failed";
    if (status === "completed") return "done";

    if (status === "uploading") {
      if (step <= 5) return "done";
      if (step === 6) return "active";
      return "pending";
    }
    if (status === "rendering") {
      if (step <= 4) return "done";
      if (step === 5) return "active";
      return "pending";
    }
    if (status === "validating") {
      if (step <= 3) return "done";
      if (step === 4) return "active";
      return "pending";
    }
    if (status === "generating") {
      if (step <= 1) return "done";
      if (step === 2 || step === 3) return "active";
      return "pending";
    }
    return "pending";
  };

  const calculateProgressPercent = () => {
    if (!activeProject) return 10;
    switch (activeProject.status.toLowerCase()) {
      case "generating":
        return 25;
      case "validating":
        return 50;
      case "rendering":
        return 75;
      case "uploading":
        return 90;
      case "completed":
        return 100;
      case "failed":
        return 100;
      default:
        return 15;
    }
  };

  const filteredInspirations =
    activeCategory === "All"
      ? INSPIRATIONS
      : INSPIRATIONS.filter((item) => item.category === activeCategory);

  const selectedInspiration = INSPIRATIONS.find(
    (i) => i.id === selectedInspirationId,
  );

  const attachedAssets = (workspaceAssets || []).filter((a: any) =>
    selectedAssetIds.includes(a._id),
  );

  const visibleAssets = (workspaceAssets || []).filter((a: any) => {
    if (assetFilter === "all") return true;
    return a.type === assetFilter;
  });

  return (
    <div className="flex h-full w-full bg-[#0a0a0f] text-white px-6 py-8 overflow-y-auto">
      <div className="z-10 mx-auto w-full max-w-5xl space-y-10">
        {/* HEADER SECTION (Matching Image 2) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Make something.
            </h1>
            <p className="mt-1.5 text-sm text-neutral-400">
              Transform prompts, inspirations, and reference videos into frame-accurate HyperFrames compositions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://discord.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-neutral-300 hover:bg-white/10 hover:text-white transition"
            >
              <svg className="h-4 w-4 fill-current text-[#5865F2]" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span>Talk to the team</span>
            </a>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>HyperFrames v0.8.139</span>
            </div>
          </div>
        </div>

        {/* ACTIVE JOB PROGRESS OVERLAY / CARD */}
        {activeProjectId && activeProject && (
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-neutral-900/90 p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-3 w-3 rounded-full ${
                    activeProject.status === "completed"
                      ? "bg-emerald-500"
                      : activeProject.status === "failed"
                        ? "bg-rose-500"
                        : "bg-blue-500 animate-ping"
                  }`}
                />
                <div>
                  <h3 className="font-semibold text-white">
                    {activeProject.status === "completed"
                      ? "Video Generated Successfully"
                      : activeProject.status === "failed"
                        ? "Video Generation Failed"
                        : "Generating HyperFrames Composition..."}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Status:{" "}
                    <span className="font-mono uppercase font-bold text-neutral-200">
                      {activeProject.status}
                    </span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-bold text-emerald-400">
                  {calculateProgressPercent()}%
                </span>
              </div>
            </div>

            <div className="my-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full transition-all duration-500 ${
                  activeProject.status === "failed"
                    ? "bg-rose-500"
                    : activeProject.status === "completed"
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-blue-500 to-indigo-500"
                }`}
                style={{ width: `${calculateProgressPercent()}%` }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2 text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-neutral-200">Prompt & inspirations parsed</span>
              </div>
              <div className="flex items-center gap-2.5">
                {getStepStatus(2) === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : getStepStatus(2) === "active" ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                ) : (
                  <Clock className="h-4 w-4 text-neutral-500" />
                )}
                <span className={getStepStatus(2) === "pending" ? "text-neutral-500" : "text-neutral-200"}>
                  Storyboard & scene timing synthesized
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {getStepStatus(3) === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : getStepStatus(3) === "active" ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                ) : (
                  <Clock className="h-4 w-4 text-neutral-500" />
                )}
                <span className={getStepStatus(3) === "pending" ? "text-neutral-500" : "text-neutral-200"}>
                  HyperFrames 0.8.139 project files written
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {getStepStatus(4) === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : getStepStatus(4) === "active" ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                ) : (
                  <Clock className="h-4 w-4 text-neutral-500" />
                )}
                <span className={getStepStatus(4) === "pending" ? "text-neutral-500" : "text-neutral-200"}>
                  Timeline & asset validator verified
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {getStepStatus(5) === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : getStepStatus(5) === "active" ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                ) : (
                  <Clock className="h-4 w-4 text-neutral-500" />
                )}
                <span className={getStepStatus(5) === "pending" ? "text-neutral-500" : "text-neutral-200"}>
                  Metal GPU & FFmpeg rendering video
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {getStepStatus(6) === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : getStepStatus(6) === "active" ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                ) : (
                  <Clock className="h-4 w-4 text-neutral-500" />
                )}
                <span className={getStepStatus(6) === "pending" ? "text-neutral-500" : "text-neutral-200"}>
                  Cloud storage upload & CDN streaming
                </span>
              </div>
            </div>

            {activeProject.status === "completed" && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20">
                <div className="flex items-center gap-2.5 text-emerald-300">
                  <Video className="h-5 w-5" />
                  <span className="font-semibold text-sm">Video is rendered & ready in 1080p!</span>
                </div>
                <Link
                  href={`/projects/${activeProjectId}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 transition"
                >
                  View Video <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {activeProject.status === "failed" && (
              <div className="mt-4 rounded-xl bg-rose-500/10 p-4 border border-rose-500/20 text-rose-300">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Generation halted</span>
                </div>
                <p className="mt-1 text-xs opacity-90">{activeProject.error || "Render error occurred."}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveProjectId(null)}>
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveProjectId(null);
                      setIsSubmitting(false);
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP BY STEP ONBOARDING GUIDE MODAL */}
        {showStepByStep && (
          <div className="rounded-2xl border border-white/20 bg-neutral-900/95 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowStepByStep(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              How HyperFrames Video Generation Works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/5">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase mb-1">
                  <span>1. Pick Inspiration</span>
                </div>
                <p className="text-xs text-neutral-300">
                  Select a template below (Motion Graphics, Mobile Ads, or Shaders) or start from your own text prompt.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/5">
                <div className="flex items-center gap-2 text-pink-400 font-bold text-xs uppercase mb-1">
                  <span>2. Attach Video / Media</span>
                </div>
                <p className="text-xs text-neutral-300">
                  Upload a reference video or logo. HyperFrames will feature it or match its timing and visual rhythm.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase mb-1">
                  <span>3. AI Timeline Synthesis</span>
                </div>
                <p className="text-xs text-neutral-300">
                  Generates frame-accurate HTML, CSS, SVG, and GSAP timelines calibrated to your exact target duration.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase mb-1">
                  <span>4. Metal GPU Rendering</span>
                </div>
                <p className="text-xs text-neutral-300">
                  HyperFrames validates the composition, executes headless rendering, and outputs an ultra-sharp MP4.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MAIN PROMPT CARD (Matching Image 2) */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative rounded-2xl border border-white/15 bg-neutral-900/60 p-5 shadow-2xl backdrop-blur-xl transition focus-within:border-white/30 focus-within:ring-2 focus-within:ring-white/10">
            {/* Active Inspiration Badge */}
            {selectedInspiration && (
              <div className="mb-3 flex items-center justify-between rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: selectedInspiration.accentColor }}
                  />
                  <span className="text-neutral-400">Active Inspiration:</span>
                  <strong className="text-white font-medium">{selectedInspiration.title}</strong>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-neutral-300">
                    {selectedInspiration.category}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearInspiration}
                  className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition"
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              </div>
            )}

            {/* Attached Reference Media Chips */}
            {attachedAssets.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Attached Media ({attachedAssets.length}):
                </span>
                {attachedAssets.map((asset: any) => (
                  <div
                    key={asset._id}
                    className="flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-300"
                  >
                    {asset.type === "video" ? (
                      <FileVideo className="h-3 w-3 text-purple-400" />
                    ) : (
                      <FileImage className="h-3 w-3 text-blue-400" />
                    )}
                    <span className="max-w-[140px] truncate font-medium">{asset.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleAsset(asset._id)}
                      className="ml-1 text-indigo-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Row */}
            <div className="flex items-start gap-4">
              {/* Left Sketch Icon (Matching Image 2) */}
              <div className="hidden sm:flex mt-1 h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-neutral-400">
                <div className="relative">
                  <div className="h-4 w-5 rounded border border-neutral-400 bg-transparent rotate-[-8deg]" />
                  <div className="absolute inset-0 h-4 w-5 rounded border border-neutral-400 bg-neutral-900 rotate-[8deg] flex items-center justify-center text-[10px] font-bold">
                    +
                  </div>
                </div>
              </div>

              {/* Textarea */}
              <div className="flex-1">
                <textarea
                  required
                  rows={3}
                  value={prompt}
                  onChange={(e) => {
                    const newPrompt = e.target.value;
                    setPrompt(newPrompt);
                    const val = newPrompt.toLowerCase();
                    if (val.includes("ollima")) {
                      setName("Ollama Commercial");
                    } else if (val.includes("networks home")) {
                      setName("Networks Home");
                    } else if (
                      name &&
                      (name.toLowerCase().includes("quarterly") ||
                        name === "Tech Academy Ad" ||
                        name === "Cinematic Product Video")
                    ) {
                      setName("");
                    }
                  }}
                  placeholder="Describe your video. Type @ for files, your projects and the media library, or drop a project to bring it in."
                  className="w-full resize-none bg-transparent text-sm md:text-base text-white placeholder:text-neutral-500 focus:outline-none"
                />

              </div>

              {/* Submit Arrow Button */}
              <button
                type="submit"
                disabled={isSubmitting || !current || !prompt.trim()}
                className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200 transition disabled:opacity-40 disabled:hover:bg-white"
                title="Generate Video"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                )}
              </button>
            </div>

            {/* Bottom Actions inside Prompt Card */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Hidden File Input for Video/Media Upload */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleMediaUpload}
                  accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/*,image/*"
                  className="hidden"
                />

                {/* Add Video & Media Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingMedia || !current}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition disabled:opacity-50"
                >
                  {isUploadingMedia ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Video className="h-3.5 w-3.5 text-purple-400" />
                  )}
                  <span>{isUploadingMedia ? "Uploading..." : "Add Reference Video / Media"}</span>
                </button>

                {/* Quick Presets */}
                <span className="text-[11px] text-neutral-500 hidden sm:inline">Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setPrompt(
                      "Create a 15-second technology advertisement for a networking academy with modern server-room visuals and animated typography.",
                    );
                    setName("Tech Academy Ad");
                    setDuration(15);
                  }}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-white/10 transition"
                >
                  Tech Ad
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrompt(
                      "Create a 30-second cinematic product advertisement with three scenes, smooth transitions and a final call-to-action.",
                    );
                    setName("Cinematic Product Video");
                    setDuration(30);
                  }}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-white/10 transition"
                >
                  Cinematic 30s
                </button>
              </div>

              {/* Optional Project Name */}
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span>Title:</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional custom title"
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>
          </div>

          {/* ADVANCED VIDEO CONTROLS ACCORDION / BAR */}
          <div className="rounded-xl border border-white/10 bg-neutral-900/40 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Duration (Authoritative)
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-neutral-800 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                >
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-neutral-800 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                >
                  <option value="16:9">16:9 (Landscape - 1920×1080)</option>
                  <option value="9:16">9:16 (Vertical Mobile - 1080×1920)</option>
                  <option value="1:1">1:1 (Square - 1080×1080)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Resolution
                </label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-neutral-800 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                >
                  <option value="1080p">1080p Full HD</option>
                  <option value="720p">720p HD</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Frame Rate
                </label>
                <select
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-neutral-800 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                >
                  <option value={30}>30 fps (Standard)</option>
                  <option value={60}>60 fps (Smooth Motion)</option>
                </select>
              </div>
            </div>

            {/* AI Provider Status Bar */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-[11px] text-neutral-400">
              <div className="flex items-center gap-2">
                <span>AI Pipeline:</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {aiStatus?.statusLabel || "Connected (Deterministic Engine)"}
                </span>
                {aiStatus?.model && (
                  <span className="font-mono text-neutral-500">({aiStatus.model})</span>
                )}
              </div>
              <span className="text-neutral-500">
                Authoritative duration normalization active
              </span>
            </div>
          </div>

          {/* GET INSPIRED SECTION (Matching Image 2) */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Get inspired</h2>
              <button
                type="button"
                onClick={() => setShowStepByStep(true)}
                className="text-xs font-medium text-neutral-400 hover:text-white transition flex items-center gap-1"
              >
                New to this? <strong className="text-white underline">Take the step by step &gt;</strong>
              </button>
            </div>

            {/* Category Filter Pills (Matching Image 2) */}
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? "bg-white text-black shadow-md"
                        : "border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {cat === "All" && <Layers className="h-3.5 w-3.5" />}
                    {cat === "Motion graphics" && <Sliders className="h-3.5 w-3.5" />}
                    {cat === "A-roll Cuts" && <Video className="h-3.5 w-3.5" />}
                    {cat === "Mobile Ads" && <Smartphone className="h-3.5 w-3.5" />}
                    {cat === "Shaders" && <Sparkles className="h-3.5 w-3.5" />}
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>

            {/* Inspiration Cards Grid (Matching Image 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredInspirations.map((item) => {
                const isSelected = selectedInspirationId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectInspiration(item)}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? "border-emerald-500 bg-neutral-900 ring-2 ring-emerald-500/30"
                        : "border-white/10 bg-neutral-900/80 hover:border-white/30 hover:bg-neutral-900"
                    }`}
                  >
                    {/* Visual Preview Artwork */}
                    <div className="relative h-44 w-full overflow-hidden bg-neutral-950 flex items-center justify-center p-3 select-none">
                      {/* Metric Counter Art */}
                      {item.visualType === "counter" && (
                        <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#fafaf9] rounded-xl text-neutral-900 overflow-hidden">
                          {/* Grid Background */}
                          <div
                            className="absolute inset-0 opacity-20 pointer-events-none"
                            style={{
                              backgroundImage:
                                "linear-gradient(#f97316 1px, transparent 1px), linear-gradient(90deg, #f97316 1px, transparent 1px)",
                              backgroundSize: "20px 20px",
                            }}
                          />
                          <span className="text-3xl font-extrabold text-[#f97316] tracking-tight">
                            1,000,000
                          </span>
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#f97316]" />
                            <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold shadow-sm border border-neutral-200">
                              Developers
                            </span>
                            <span className="h-1.5 w-1.5 rounded-full bg-[#f97316]" />
                          </div>
                        </div>
                      )}

                      {/* Revenue Chart Art */}
                      {item.visualType === "chart" && (
                        <div className="relative w-full h-full flex flex-col justify-end bg-gradient-to-b from-neutral-900 to-neutral-950 rounded-xl p-3 border border-white/5">
                          <div className="flex items-end justify-between gap-1.5 h-24 px-2">
                            <div className="w-4 rounded-t bg-rose-400/80 h-10 transition-all group-hover:h-12" />
                            <div className="w-4 rounded-t bg-amber-400/80 h-16 transition-all group-hover:h-18" />
                            <div className="w-4 rounded-t bg-purple-400/80 h-12 transition-all group-hover:h-14" />
                            <div className="w-4 rounded-t bg-emerald-400/90 h-22 transition-all group-hover:h-24" />
                            <div className="w-4 rounded-t bg-blue-400/90 h-18 transition-all group-hover:h-20" />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[9px] text-neutral-400 border-t border-white/10 pt-1">
                            <span>Q1</span>
                            <span>Q2</span>
                            <span>Q3</span>
                            <span>Q4</span>
                            <span className="text-emerald-400 font-bold">+48%</span>
                          </div>
                        </div>
                      )}

                      {/* Speaker Spotlight Art */}
                      {item.visualType === "speaker" && (
                        <div className="relative w-full h-full rounded-xl overflow-hidden bg-gradient-to-tr from-stone-900 via-amber-950/40 to-neutral-900 flex items-center justify-center border border-white/10">
                          <div className="h-14 w-14 rounded-full bg-neutral-700/80 flex items-center justify-center text-white font-bold text-lg border border-white/20">
                            AV
                          </div>
                          <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/70 backdrop-blur-md p-1.5 border border-white/10 flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-white">Alex Vance</span>
                            <span className="flex items-center gap-0.5">
                              <span className="h-2 w-0.5 bg-pink-400 animate-pulse" />
                              <span className="h-3 w-0.5 bg-pink-400 animate-pulse delay-75" />
                              <span className="h-1.5 w-0.5 bg-pink-400 animate-pulse delay-150" />
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Kinetic Terminal Art */}
                      {item.visualType === "kinetic" && (
                        <div className="relative w-full h-full rounded-xl bg-black flex flex-col justify-center px-4 border border-cyan-500/20">
                          <span className="text-[10px] font-mono uppercase text-cyan-400/70 tracking-widest">
                            [EXECUTE_ORDER]
                          </span>
                          <span className="text-lg font-mono font-bold text-white tracking-tight">
                            limit close orders
                          </span>
                          <div className="mt-2 h-1 w-16 bg-gradient-to-r from-cyan-400 to-indigo-500 rounded" />
                        </div>
                      )}

                      {/* Fluid Shader Art */}
                      {item.visualType === "shader" && (
                        <div className="relative w-full h-full rounded-xl overflow-hidden bg-gradient-to-tr from-purple-900 via-rose-600 to-amber-500 flex items-center justify-center">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4),transparent_60%)]" />
                          <span className="relative text-xs font-extrabold uppercase tracking-widest text-white/90 drop-shadow">
                            Iridescent Waves
                          </span>
                        </div>
                      )}

                      {/* Mobile App Launch Story */}
                      {item.visualType === "mobile" && (
                        <div className="relative w-full h-full rounded-xl bg-neutral-900 flex items-center justify-center border border-white/10">
                          <div className="h-32 w-18 rounded-xl border-2 border-white/20 bg-black flex flex-col justify-between p-1.5 shadow-xl">
                            <div className="h-1 w-6 bg-white/30 rounded-full mx-auto" />
                            <div className="h-12 w-full rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[8px] font-bold text-white">
                              App UI
                            </div>
                            <div className="h-2 w-full bg-white/20 rounded" />
                          </div>
                          <span className="absolute top-2 right-2 rounded bg-blue-500 px-1 text-[8px] font-bold">
                            9:16
                          </span>
                        </div>
                      )}

                      {/* Neural Network Art */}
                      {item.visualType === "neural" && (
                        <div className="relative w-full h-full rounded-xl bg-neutral-950 flex items-center justify-center border border-emerald-500/20">
                          <svg className="h-24 w-28 text-emerald-400 stroke-current opacity-80" viewBox="0 0 100 80">
                            <circle cx="20" cy="20" r="4" fill="currentColor" />
                            <circle cx="20" cy="40" r="4" fill="currentColor" />
                            <circle cx="20" cy="60" r="4" fill="currentColor" />
                            <circle cx="50" cy="30" r="4" fill="currentColor" />
                            <circle cx="50" cy="50" r="4" fill="currentColor" />
                            <circle cx="80" cy="40" r="5" fill="#10b981" />
                            <line x1="20" y1="20" x2="50" y2="30" strokeWidth="1" opacity="0.4" />
                            <line x1="20" y1="40" x2="50" y2="30" strokeWidth="1" opacity="0.4" />
                            <line x1="20" y1="40" x2="50" y2="50" strokeWidth="1" opacity="0.4" />
                            <line x1="20" y1="60" x2="50" y2="50" strokeWidth="1" opacity="0.4" />
                            <line x1="50" y1="30" x2="80" y2="40" strokeWidth="1.5" />
                            <line x1="50" y1="50" x2="80" y2="40" strokeWidth="1.5" />
                          </svg>
                        </div>
                      )}

                      {/* Eco Clean Tech Art */}
                      {item.visualType === "eco" && (
                        <div className="relative w-full h-full rounded-xl bg-gradient-to-b from-teal-950 to-neutral-950 flex flex-col items-center justify-center border border-teal-500/20">
                          <div className="h-12 w-12 rounded-full border border-teal-400/50 bg-teal-500/10 flex items-center justify-center">
                            <span className="text-xl">⚡</span>
                          </div>
                          <span className="mt-1 text-[10px] font-bold text-teal-300">
                            100% Sustainable
                          </span>
                        </div>
                      )}

                      {/* Selected Indicator Pill */}
                      {isSelected && (
                        <div className="absolute top-2 left-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-black flex items-center gap-1 shadow-lg">
                          <Check className="h-3 w-3 stroke-[3]" /> Active
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="p-3.5">
                      <h4 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-neutral-200">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-xs text-neutral-400 line-clamp-2">
                        {item.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-neutral-400">
                        <span className="truncate">{item.author}</span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-neutral-300">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* WORKSPACE ASSETS & REFERENCE MEDIA SECTION */}
          <div className="rounded-2xl border border-white/15 bg-neutral-900/60 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-purple-400" />
                  Workspace Assets & Reference Media
                </h3>
                <p className="text-xs text-neutral-400">
                  Select logos, images, or reference videos to incorporate into scenes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Type Filter Buttons */}
                <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAssetFilter("all")}
                    className={`px-2.5 py-1 rounded-md transition ${
                      assetFilter === "all" ? "bg-white text-black font-semibold" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetFilter("video")}
                    className={`px-2.5 py-1 rounded-md transition ${
                      assetFilter === "video" ? "bg-white text-black font-semibold" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Videos
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetFilter("image")}
                    className={`px-2.5 py-1 rounded-md transition ${
                      assetFilter === "image" ? "bg-white text-black font-semibold" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Images
                  </button>
                </div>

                <Link
                  href="/assets"
                  className="text-xs text-neutral-400 hover:text-white underline transition"
                >
                  Manage Library
                </Link>
              </div>
            </div>

            {/* Asset Items */}
            {!workspaceAssets || workspaceAssets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                <Video className="mx-auto h-8 w-8 text-neutral-500 mb-2" />
                <p className="text-xs text-neutral-400">
                  No assets uploaded yet in this workspace. Click{" "}
                  <strong className="text-white">"Add Reference Video / Media"</strong> above to upload a video or logo.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {visibleAssets.map((asset: any) => {
                  const selected = selectedAssetIds.includes(asset._id);
                  const isVideo = asset.type === "video";
                  return (
                    <button
                      key={asset._id}
                      type="button"
                      onClick={() => toggleAsset(asset._id)}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition ${
                        selected
                          ? "border-purple-500 bg-purple-500/10 text-white font-medium"
                          : "border-white/10 bg-neutral-900/80 text-neutral-300 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {}}
                          className="rounded border-white/20 bg-neutral-800 text-purple-500 focus:ring-0"
                        />
                        {isVideo ? (
                          <FileVideo className="h-4 w-4 text-purple-400 shrink-0" />
                        ) : asset.type === "image" ? (
                          <FileImage className="h-4 w-4 text-blue-400 shrink-0" />
                        ) : (
                          <FileAudio className="h-4 w-4 text-amber-400 shrink-0" />
                        )}
                        <span className="truncate" title={asset.name}>
                          {asset.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-500 shrink-0 ml-2 uppercase font-mono">
                        {asset.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* GENERATE SUBMIT ROW */}
          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <div className="text-xs text-neutral-400">
              {selectedAssetIds.length > 0 ? (
                <span>
                  <strong className="text-white">{selectedAssetIds.length}</strong> asset(s) attached to composition
                </span>
              ) : (
                <span>Pure generative synthesis (No media attached)</span>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || !current || !prompt.trim()}
              className="gap-2.5 bg-white text-black hover:bg-neutral-200 px-8 py-2.5 font-bold rounded-xl shadow-lg transition"
            >
              <Sparkles className="h-4 w-4" />
              {isSubmitting && activeProject?.status !== "completed"
                ? "Synthesizing Composition..."
                : "Generate Video"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

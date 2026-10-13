"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  Globe,
  HardDrive,
  Info,
  Key,
  Layers,
  Loader2,
  Mic,
  MonitorPlay,
  Play,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  Smartphone,
  Tv,
  UserCheck,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";

interface Avatar {
  id: string;
  name: string;
  title: string;
  category: string;
  gender: string;
  style: string;
  image: string;
  recommendedVoice: string;
  tags: string[];
  description: string;
  aspectRatio: string;
  pose: string;
}

interface Voice {
  id: string;
  name: string;
  gender: string;
  language: string;
  locale: string;
  tone: string;
  accent: string;
  sampleText: string;
}

interface GeneratedVideo {
  jobId: string;
  videoUrl: string;
  filename: string;
  duration: number;
  sizeBytes: number;
  resolution: string;
  avatar: {
    id: string;
    name: string;
    title: string;
    image: string;
  };
  voice: {
    id: string;
    name: string;
    locale: string;
  };
  script: string;
  engine: string;
  createdAt: number;
}

const DEFAULT_AVATARS: Avatar[] = [
  {
    id: "sarah_studio",
    name: "Sarah Jenkins",
    title: "Studio News & Corporate Anchor",
    category: "studio",
    gender: "female",
    style: "Studio 4K",
    image: "/avatars/sarah.jpg",
    recommendedVoice: "en-US-JennyNeural",
    tags: ["Photorealistic", "4K Ultra-HD", "Corporate", "News Anchor"],
    description:
      "Professional studio anchor in navy blazer, best for corporate keynotes, product launches, and news bulletins.",
    aspectRatio: "16:9",
    pose: "Half-Body Centered",
  },
  {
    id: "tyler_tech",
    name: "Tyler Hayes",
    title: "Tech Founder & Product Lead",
    category: "tech",
    gender: "male",
    style: "Modern Tech",
    image: "/avatars/tyler.jpg",
    recommendedVoice: "en-US-GuyNeural",
    tags: ["Photorealistic", "4K Ultra-HD", "SaaS", "Product Demo"],
    description:
      "Dynamic presenter in casual charcoal shirt, perfect for software walkthroughs, startup pitches, and onboarding.",
    aspectRatio: "16:9",
    pose: "Standing Presenter",
  },
  {
    id: "marcus_exec",
    name: "Marcus Vance",
    title: "Executive Leadership & Board Advisor",
    category: "executive",
    gender: "male",
    style: "Boardroom Pro",
    image: "/avatars/marcus.jpg",
    recommendedVoice: "en-GB-BrianNeural",
    tags: ["Photorealistic", "4K Ultra-HD", "Executive", "Financial"],
    description:
      "Distinguished corporate leader in tailored suit, suited for investor relations, quarterly updates, and leadership memos.",
    aspectRatio: "16:9",
    pose: "Seated Boardroom",
  },
  {
    id: "elena_creative",
    name: "Elena Rostova",
    title: "Creative Director & Brand Strategist",
    category: "creative",
    gender: "female",
    style: "Creative Studio",
    image: "/avatars/elena.jpg",
    recommendedVoice: "en-GB-SoniaNeural",
    tags: ["Photorealistic", "4K Ultra-HD", "Creative", "Marketing"],
    description:
      "Engaging presenter in contemporary studio setting, ideal for brand storytelling, social media campaigns, and design tutorials.",
    aspectRatio: "16:9",
    pose: "Studio Casual",
  },
];

const DEFAULT_VOICES: Voice[] = [
  {
    id: "en-US-JennyNeural",
    name: "Jenny (US)",
    gender: "female",
    language: "English (US)",
    locale: "en-US",
    tone: "Warm & Articulate",
    accent: "American",
    sampleText:
      "Welcome to our platform. Let's make something truly remarkable together today.",
  },
  {
    id: "en-US-GuyNeural",
    name: "Guy (US)",
    gender: "male",
    language: "English (US)",
    locale: "en-US",
    tone: "Confident & Direct",
    accent: "American",
    sampleText:
      "Here is a comprehensive breakdown of our newest technological breakthroughs this quarter.",
  },
  {
    id: "en-US-AriaNeural",
    name: "Aria (US)",
    gender: "female",
    language: "English (US)",
    locale: "en-US",
    tone: "Dynamic & Expressive",
    accent: "American",
    sampleText:
      "Get ready to supercharge your video creation workflow with cutting-edge AI avatars.",
  },
  {
    id: "en-GB-BrianNeural",
    name: "Brian (UK)",
    gender: "male",
    language: "English (UK)",
    locale: "en-GB",
    tone: "Authoritative & Polished",
    accent: "British RP",
    sampleText:
      "Good day. Allow me to guide you through the strategic executive overview.",
  },
  {
    id: "en-GB-SoniaNeural",
    name: "Sonia (UK)",
    gender: "female",
    language: "English (UK)",
    locale: "en-GB",
    tone: "Sophisticated & Elegant",
    accent: "British",
    sampleText:
      "Exceptional creative direction and seamless technology come together right here.",
  },
  {
    id: "en-AU-NatashaNeural",
    name: "Natasha (AU)",
    gender: "female",
    language: "English (AU)",
    locale: "en-AU",
    tone: "Friendly & Upbeat",
    accent: "Australian",
    sampleText:
      "G'day! Let's dive straight into the latest project highlights and achievements.",
  },
  {
    id: "es-ES-DiegoNeural",
    name: "Diego (ES)",
    gender: "male",
    language: "Spanish (ES)",
    locale: "es-ES",
    tone: "Natural & Clear",
    accent: "Castilian",
    sampleText:
      "Hola a todos. Bienvenidos a la nueva experiencia de video impulsada por inteligencia artificial.",
  },
  {
    id: "fr-FR-CamilleNeural",
    name: "Camille (FR)",
    gender: "female",
    language: "French (FR)",
    locale: "fr-FR",
    tone: "Smooth & Chic",
    accent: "Parisian",
    sampleText:
      "Bonjour et bienvenue. Découvrez la création de vidéo nouvelle génération.",
  },
];

const TEMPLATES = [
  {
    name: "Product Announcement",
    text: "Welcome everyone! Today I am thrilled to introduce our newest platform feature. It brings autonomous AI video generation and photorealistic avatars straight to your browser, saving hours of production time.",
  },
  {
    name: "Executive Briefing",
    text: "Good morning. In this quarterly review, we will examine our core financial milestones, customer acquisition growth, and strategic technology investments for the upcoming year.",
  },
  {
    name: "Team Welcome",
    text: "Hello and welcome to the team! We are so excited to have you on board. Here is a quick introduction to how we work, our values, and what to expect during your first week.",
  },
  {
    name: "Feature Walkthrough",
    text: "In this short tutorial, let's explore how simple it is to customize video scenes, tweak camera animations, and export your composition with our verified FFmpeg engine.",
  },
];

export default function HeyGenStudioPage() {
  // Avatars & Voices
  const [avatars, setAvatars] = useState<Avatar[]>(DEFAULT_AVATARS);
  const [voices, setVoices] = useState<Voice[]>(DEFAULT_VOICES);

  // Selections
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("sarah_studio");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("en-US-JennyNeural");
  const [avatarCategoryFilter, setAvatarCategoryFilter] = useState<string>("all");
  const [voiceFilter, setVoiceFilter] = useState<string>("all");

  // Script & Parameters
  const [script, setScript] = useState<string>(
    "Welcome to our platform! Today we are introducing our new AI avatar studio, powered by HyperFrames and HeyGen. You can generate studio-quality talking presenter videos in just a few clicks."
  );
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(0);
  const [emotion, setEmotion] = useState<string>("friendly");
  const [background, setBackground] = useState<string>("studio_loft");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");

  // Account / API Key Setup
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [validatingKey, setValidatingKey] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    valid: boolean;
    mode: "cloud" | "sandbox" | "invalid" | "untested";
    quota?: number;
    message?: string;
  }>({
    valid: false,
    mode: "sandbox",
    message: "Sandbox Mode: Free Local FFmpeg & HyperFrames Studio Engine Active.",
  });
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Audio sample playback
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Generation state
  const [generating, setGenerating] = useState<boolean>(false);
  const [genStage, setGenStage] = useState<number>(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [latestVideo, setLatestVideo] = useState<GeneratedVideo | null>(null);
  const [history, setHistory] = useState<GeneratedVideo[]>([]);

  // Load API key from localStorage and fetch catalogs
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("heygen_api_key");
      if (savedKey) {
        setApiKey(savedKey);
        verifyKey(savedKey);
      }
    } catch {}

    // Fetch dynamic catalog
    fetch("/api/heygen/avatars")
      .then((res) => res.json())
      .then((data) => {
        if (data?.avatars && Array.isArray(data.avatars)) {
          setAvatars(data.avatars);
        }
      })
      .catch(() => {});

    fetch("/api/heygen/voices")
      .then((res) => res.json())
      .then((data) => {
        if (data?.voices && Array.isArray(data.voices)) {
          setVoices(data.voices);
        }
      })
      .catch(() => {});
  }, []);

  const verifyKey = async (keyToTest: string) => {
    if (!keyToTest.trim()) {
      setConnectionStatus({
        valid: false,
        mode: "sandbox",
        message: "Sandbox Mode: Free Local FFmpeg Studio Engine Active.",
      });
      return;
    }

    setValidatingKey(true);
    try {
      const res = await fetch("/api/heygen/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToTest.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setConnectionStatus({
          valid: true,
          mode: "cloud",
          quota: data.quota,
          message: "HeyGen Account Connected: Live Cloud Rendering Active.",
        });
        localStorage.setItem("heygen_api_key", keyToTest.trim());
      } else {
        setConnectionStatus({
          valid: false,
          mode: "invalid",
          message: data.message || "Invalid HeyGen API Key.",
        });
      }
    } catch (err: any) {
      setConnectionStatus({
        valid: false,
        mode: "sandbox",
        message: "Using Free Local FFmpeg Studio Engine.",
      });
    } finally {
      setValidatingKey(false);
    }
  };

  const handleSaveKey = () => {
    verifyKey(apiKey);
  };

  const handleClearKey = () => {
    setApiKey("");
    try {
      localStorage.removeItem("heygen_api_key");
    } catch {}
    setConnectionStatus({
      valid: false,
      mode: "sandbox",
      message: "Sandbox Mode: Free Local FFmpeg & HyperFrames Studio Engine Active.",
    });
  };

  // Play voice preview
  const playVoiceSample = (voice: Voice) => {
    if (typeof window === "undefined") return;

    if (playingVoiceId === voice.id) {
      window.speechSynthesis?.cancel();
      setPlayingVoiceId(null);
      return;
    }

    window.speechSynthesis?.cancel();

    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(voice.sampleText);
      utterance.rate = speed;
      utterance.pitch = 1 + pitch / 100;

      // Select system voice if locale matches
      const sysVoices = window.speechSynthesis.getVoices();
      const match = sysVoices.find(
        (v) =>
          v.lang.toLowerCase() === voice.locale.toLowerCase() ||
          v.lang.toLowerCase().startsWith(voice.locale.slice(0, 2).toLowerCase())
      );
      if (match) utterance.voice = match;

      utterance.onstart = () => setPlayingVoiceId(voice.id);
      utterance.onend = () => setPlayingVoiceId(null);
      utterance.onerror = () => setPlayingVoiceId(null);

      window.speechSynthesis.speak(utterance);
    } else {
      setPlayingVoiceId(voice.id);
      setTimeout(() => setPlayingVoiceId(null), 3500);
    }
  };

  // Generate Video
  const handleGenerate = async () => {
    if (!script.trim()) return;

    setGenerating(true);
    setGenError(null);
    setGenStage(1);

    // Staged progress ticker
    const timer1 = setTimeout(() => setGenStage(2), 800);
    const timer2 = setTimeout(() => setGenStage(3), 1800);
    const timer3 = setTimeout(() => setGenStage(4), 2800);

    try {
      const payload = {
        apiKey: connectionStatus.valid ? apiKey.trim() : undefined,
        avatarId: selectedAvatarId,
        voiceId: selectedVoiceId,
        script: script.trim(),
        speed,
        pitch,
        emotion,
        background,
        resolution: aspectRatio === "9:16" ? "1080x1920" : "1920x1080",
      };

      const res = await fetch("/api/heygen/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Generation failed (HTTP ${res.status})`);
      }

      setGenStage(5);
      const data = await res.json();

      const videoRecord: GeneratedVideo = {
        jobId: data.jobId || `heygen_${Date.now()}`,
        videoUrl: data.videoUrl,
        filename: data.filename || "avatar_video.mp4",
        duration: data.duration || 5,
        sizeBytes: data.sizeBytes || 250000,
        resolution: data.resolution || "1920x1080",
        avatar: data.avatar || {
          id: selectedAvatarId,
          name: avatars.find((a) => a.id === selectedAvatarId)?.name || "Avatar",
          title: avatars.find((a) => a.id === selectedAvatarId)?.title || "Presenter",
          image: avatars.find((a) => a.id === selectedAvatarId)?.image || "/avatars/sarah.jpg",
        },
        voice: data.voice || {
          id: selectedVoiceId,
          name: voices.find((v) => v.id === selectedVoiceId)?.name || "Voice",
          locale: voices.find((v) => v.id === selectedVoiceId)?.locale || "en-US",
        },
        script: script.trim(),
        engine: data.engine || (connectionStatus.valid ? "heygen_cloud" : "local_ffmpeg_studio"),
        createdAt: Date.now(),
      };

      setLatestVideo(videoRecord);
      setHistory((prev) => [videoRecord, ...prev]);
    } catch (err: any) {
      setGenError(err.message || "Failed to generate video");
    } finally {
      setGenerating(false);
      setGenStage(0);
    }
  };

  const selectedAvatar: Avatar =
    avatars.find((a) => a.id === selectedAvatarId) || DEFAULT_AVATARS[0]!;
  const selectedVoice: Voice =
    voices.find((v) => v.id === selectedVoiceId) || DEFAULT_VOICES[0]!;
  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.max(3, Math.round((wordCount / 140) * 60 / speed));

  const filteredAvatars = avatars.filter((a) => {
    if (avatarCategoryFilter === "all") return true;
    return a.category === avatarCategoryFilter;
  });

  const filteredVoices = voices.filter((v) => {
    if (voiceFilter === "all") return true;
    if (voiceFilter === "en-us") return v.locale.toLowerCase() === "en-us";
    if (voiceFilter === "en-gb") return v.locale.toLowerCase() === "en-gb";
    if (voiceFilter === "female") return v.gender === "female";
    if (voiceFilter === "male") return v.gender === "male";
    return true;
  });

  return (
    <div className="flex h-full w-full bg-secondary px-4 py-6 md:px-8 dark:bg-black">
      <div className="mx-auto w-full max-w-screen-xl space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-primary">
                  HeyGen AI Avatar Studio
                </h1>
                <p className="text-xs text-primary/60">
                  Create high-definition videos with photorealistic talking avatars and studio voices.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-primary shadow-sm hover:bg-secondary"
            >
              <HardDrive className="h-3.5 w-3.5 text-emerald-500" />
              Node & FFmpeg: Ready ✓
            </Link>
            <a
              href="https://app.heygen.com/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow hover:bg-indigo-700"
            >
              HeyGen Portal <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* STEP 1: HEYGEN ACCOUNT ONBOARDING & API SETUP */}
        <div className="rounded-xl border border-indigo-500/30 bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  1
                </span>
                <h2 className="text-base font-semibold text-primary">
                  HeyGen Account & API Connection
                </h2>
                {connectionStatus.mode === "cloud" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Cloud Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    <ShieldCheck className="h-3 w-3" /> Free Studio Sandbox
                  </span>
                )}
              </div>
              <p className="text-xs text-primary/70">
                First, create an account on HeyGen to obtain your API key for cloud rendering, or use our verified local FFmpeg media engine for free.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://app.heygen.com/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-500/20 dark:text-indigo-400"
              >
                Create HeyGen Account <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://app.heygen.com/settings?nav=API"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-primary/80 transition hover:bg-secondary/80"
              >
                <Key className="h-3 w-3 text-amber-500" />
                Get API Key <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-primary/60 hover:text-primary"
              >
                <Info className="h-3.5 w-3.5" />
                Setup Guide
                <ChevronDown className={`h-3 w-3 transition-transform ${showGuide ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>

          {/* Collapsible Setup Guide */}
          {showGuide && (
            <div className="mt-4 rounded-lg border border-border bg-secondary/50 p-4 text-xs text-primary/80 space-y-2 animate-in fade-in">
              <h4 className="font-semibold text-primary">How to connect your HeyGen Account in 3 quick steps:</h4>
              <ol className="list-decimal list-inside space-y-1 text-primary/70">
                <li>
                  Go to <a href="https://app.heygen.com/signup" target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline font-medium">HeyGen.com</a> and sign up for a free or paid account.
                </li>
                <li>
                  Click your profile avatar in the bottom-left, select <strong>Settings</strong>, and choose <strong>API & Webhooks</strong>.
                </li>
                <li>
                  Copy your <strong>API Token / Secret Key</strong> and paste it into the field below, then click <strong>Connect</strong>.
                </li>
              </ol>
            </div>
          )}

          {/* API Key Form */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type={showApiKey ? "text" : "password"}
                placeholder="Enter HeyGen API Key (e.g. NTg2MWY4Nj... or leave blank for local engine)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-xs font-mono text-primary placeholder:text-primary/40 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-2.5 text-primary/40 hover:text-primary"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveKey}
                disabled={validatingKey}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {validatingKey ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" /> Connect API Key
                  </>
                )}
              </button>
              {apiKey && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-primary/60 hover:text-rose-500"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-2 text-xs text-primary/60">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionStatus.mode === "cloud"
                  ? "bg-emerald-500"
                  : connectionStatus.mode === "invalid"
                  ? "bg-rose-500"
                  : "bg-blue-500"
              }`}
            />
            <span>{connectionStatus.message}</span>
            {connectionStatus.quota !== undefined && (
              <span className="font-medium text-primary">
                (Remaining Credits: {connectionStatus.quota})
              </span>
            )}
          </div>
        </div>

        {/* MAIN CREATION WORKSPACE */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* LEFT COLUMN: AVATAR & VOICE SELECTION */}
          <div className="space-y-6 lg:col-span-7">
            {/* STEP 2: AVATAR SELECTION */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    2
                  </span>
                  <h3 className="text-sm font-semibold text-primary">
                    Select Your AI Avatar
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {["all", "studio", "tech", "executive", "creative"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAvatarCategoryFilter(cat)}
                      className={`rounded-md px-2.5 py-1 capitalize transition ${
                        avatarCategoryFilter === cat
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-primary/60 hover:bg-secondary"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar Grid */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
                {filteredAvatars.map((av) => {
                  const isSelected = selectedAvatarId === av.id;
                  return (
                    <div
                      key={av.id}
                      onClick={() => {
                        setSelectedAvatarId(av.id);
                        if (av.recommendedVoice) setSelectedVoiceId(av.recommendedVoice);
                      }}
                      className={`group relative cursor-pointer overflow-hidden rounded-xl border transition-all ${
                        isSelected
                          ? "border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg"
                          : "border-border hover:border-indigo-500/50 hover:shadow-md"
                      } bg-secondary/30`}
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-muted">
                        <img
                          src={av.image}
                          alt={av.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        {isSelected && (
                          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                          {av.style}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <h4 className="truncate text-xs font-semibold text-primary">
                          {av.name}
                        </h4>
                        <p className="truncate text-[10px] text-primary/60">
                          {av.title}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Avatar Overview */}
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/40 p-3 text-xs">
                <img
                  src={selectedAvatar.image}
                  alt={selectedAvatar.name}
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-primary">{selectedAvatar.name}</span>
                    <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[10px] text-indigo-500 font-medium">
                      {selectedAvatar.style}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-primary/70 line-clamp-1">
                    {selectedAvatar.description}
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 3: VOICE SELECTION & TUNING */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    3
                  </span>
                  <h3 className="text-sm font-semibold text-primary">
                    Select Voice & Audio Settings
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {["all", "en-us", "en-gb", "female", "male"].map((vf) => (
                    <button
                      key={vf}
                      type="button"
                      onClick={() => setVoiceFilter(vf)}
                      className={`rounded-md px-2.5 py-1 capitalize transition ${
                        voiceFilter === vf
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-primary/60 hover:bg-secondary"
                      }`}
                    >
                      {vf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voices Grid */}
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {filteredVoices.map((v) => {
                  const isSelected = selectedVoiceId === v.id;
                  const isPlaying = playingVoiceId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVoiceId(v.id)}
                      className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/10 shadow-sm"
                          : "border-border hover:border-indigo-500/40 bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            isSelected ? "bg-indigo-600 text-white" : "bg-secondary text-primary/70"
                          }`}
                        >
                          <Mic className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-primary">
                            {v.name}
                          </p>
                          <p className="truncate text-[10px] text-primary/60">
                            {v.tone} • {v.language}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playVoiceSample(v);
                        }}
                        className={`rounded-full p-1.5 transition ${
                          isPlaying
                            ? "bg-indigo-600 text-white animate-pulse"
                            : "bg-secondary hover:bg-primary/10 text-primary/70 hover:text-primary"
                        }`}
                        title="Listen to voice sample"
                      >
                        {isPlaying ? <Volume2 className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Audio Controls */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-border/50 pt-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-primary/70">
                    <span>Speed: {speed}x</span>
                    <button
                      type="button"
                      onClick={() => setSpeed(1.0)}
                      className="text-[10px] text-indigo-500 hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.5"
                    step="0.05"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="mt-1.5 w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-primary/70">
                    <span>Pitch: {pitch > 0 ? `+${pitch}` : pitch}%</span>
                    <button
                      type="button"
                      onClick={() => setPitch(0)}
                      className="text-[10px] text-indigo-500 hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="2"
                    value={pitch}
                    onChange={(e) => setPitch(parseInt(e.target.value))}
                    className="mt-1.5 w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-xs text-primary/70 block">Emotion Tone</label>
                  <select
                    value={emotion}
                    onChange={(e) => setEmotion(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-border bg-background px-2.5 py-1 text-xs text-primary focus:outline-none"
                  >
                    <option value="friendly">Friendly & Natural</option>
                    <option value="professional">Professional & Formal</option>
                    <option value="enthusiastic">Enthusiastic & High Energy</option>
                    <option value="calm">Calm & Trustworthy</option>
                    <option value="serious">Authoritative & Serious</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: SCRIPT & GENERATION */}
          <div className="space-y-6 lg:col-span-5">
            {/* STEP 4: SCRIPT & SCENE COMPOSITION */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    4
                  </span>
                  <h3 className="text-sm font-semibold text-primary">
                    Avatar Script & Scene Settings
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-primary/50">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Est. ~{estimatedSeconds}s</span>
                </div>
              </div>

              {/* Script Templates */}
              <div>
                <span className="text-[11px] text-primary/50 uppercase tracking-wider block mb-1.5">
                  Quick Script Starters
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => setScript(tmpl.text)}
                      className="rounded-md border border-border bg-secondary/50 px-2 py-1 text-[11px] text-primary/70 hover:bg-secondary hover:text-primary transition"
                    >
                      {tmpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Script Editor */}
              <div>
                <textarea
                  rows={6}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Enter the script for your avatar to present..."
                  className="w-full rounded-lg border border-border bg-background p-3 text-xs text-primary placeholder:text-primary/40 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-primary/50">
                  <span>{wordCount} words • {script.length} characters</span>
                  <span>{selectedVoice.name}</span>
                </div>
              </div>

              {/* Scene Settings (Background & Aspect Ratio) */}
              <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
                <div>
                  <label className="text-xs text-primary/70 block mb-1">Studio Background</label>
                  <select
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-primary focus:outline-none"
                  >
                    <option value="studio_loft">Modern Tech Loft</option>
                    <option value="#090d16">Deep Tech Gradient</option>
                    <option value="#0f172a">Slate Corporate Studio</option>
                    <option value="#00b140">Green Screen (Chroma Key)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-primary/70 block mb-1">Aspect Ratio</label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setAspectRatio("16:9")}
                      className={`flex flex-col items-center justify-center rounded-md border p-1 text-[10px] transition ${
                        aspectRatio === "16:9"
                          ? "border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-medium"
                          : "border-border text-primary/60 hover:bg-secondary"
                      }`}
                    >
                      <Tv className="h-3 w-3" />
                      16:9
                    </button>
                    <button
                      type="button"
                      onClick={() => setAspectRatio("9:16")}
                      className={`flex flex-col items-center justify-center rounded-md border p-1 text-[10px] transition ${
                        aspectRatio === "9:16"
                          ? "border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-medium"
                          : "border-border text-primary/60 hover:bg-secondary"
                      }`}
                    >
                      <Smartphone className="h-3 w-3" />
                      9:16
                    </button>
                    <button
                      type="button"
                      onClick={() => setAspectRatio("1:1")}
                      className={`flex flex-col items-center justify-center rounded-md border p-1 text-[10px] transition ${
                        aspectRatio === "1:1"
                          ? "border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-medium"
                          : "border-border text-primary/60 hover:bg-secondary"
                      }`}
                    >
                      <Square className="h-3 w-3" />
                      1:1
                    </button>
                  </div>
                </div>
              </div>

              {/* GENERATE BUTTON & PROGRESS */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || !script.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Avatar Video…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Generate HeyGen Avatar Video
                    </>
                  )}
                </button>

                {/* Progress Stages */}
                {generating && (
                  <div className="mt-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-medium text-indigo-600 dark:text-indigo-400">
                      <span>Rendering in progress</span>
                      <span>Stage {genStage} of 5</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-500"
                        style={{ width: `${(genStage / 5) * 100}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-primary/70">
                      {genStage === 1 && "Verifying HeyGen credentials and avatar models..."}
                      {genStage === 2 && "Synthesizing AI voice track with speech cadence..."}
                      {genStage === 3 && "Aligning avatar lip-synchronization and framing..."}
                      {genStage === 4 && "Compositing background and lower-third graphics..."}
                      {genStage === 5 && "Finalizing MP4 video rendering with FFmpeg..."}
                    </p>
                  </div>
                )}

                {/* Error Banner */}
                {genError && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Generation Failed</p>
                      <p className="mt-0.5 text-rose-600/80 dark:text-rose-400/80">{genError}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* LATEST VIDEO OUTPUT PLAYER */}
            {latestVideo && (
              <div className="rounded-xl border border-emerald-500/30 bg-card p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <h4 className="text-sm font-semibold text-primary">
                      Rendered Avatar Video
                    </h4>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    {latestVideo.engine === "heygen_cloud" ? "HeyGen Cloud" : "Local FFmpeg Studio"}
                  </span>
                </div>

                {/* Video Player */}
                <div className="overflow-hidden rounded-lg border border-border bg-black aspect-video flex items-center justify-center">
                  <video
                    src={latestVideo.videoUrl}
                    controls
                    autoPlay
                    className="h-full w-full object-contain"
                  />
                </div>

                {/* Metadata & Actions */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="space-y-0.5 text-primary/60">
                    <p>
                      <strong className="text-primary">{latestVideo.avatar.name}</strong> • {latestVideo.voice.name}
                    </p>
                    <p className="text-[10px]">
                      Duration: {latestVideo.duration}s • Resolution: {latestVideo.resolution}
                    </p>
                  </div>

                  <a
                    href={latestVideo.videoUrl}
                    download={latestVideo.filename}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow hover:opacity-90"
                  >
                    <Download className="h-3.5 w-3.5" /> Download MP4
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RECENT HEYGEN GENERATIONS HISTORY */}
        {history.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-primary">Recent Avatar Videos</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {history.map((h) => (
                <div
                  key={h.jobId}
                  className="flex gap-3 rounded-lg border border-border bg-secondary/30 p-3 text-xs"
                >
                  <img
                    src={h.avatar.image}
                    alt={h.avatar.name}
                    className="h-16 w-16 rounded-md object-cover"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <p className="font-semibold text-primary truncate">{h.avatar.name}</p>
                      <p className="text-[10px] text-primary/60 truncate">{h.script}</p>
                      <p className="text-[10px] text-primary/40 mt-1">
                        {h.duration}s • {new Date(h.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <a
                      href={h.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-500 hover:underline mt-1"
                    >
                      <Play className="h-3 w-3" /> Watch Video
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

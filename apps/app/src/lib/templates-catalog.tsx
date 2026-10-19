import React from "react";

export interface VideoTemplate {
  id: string;
  title: string;
  subtitle: string;
  category:
    | "SaaS & Tech"
    | "Commercial & Brand"
    | "Social Reels (9:16)"
    | "Editorial & News"
    | "Luxury & Cinematic"
    | "Minimalist & Design"
    | "Clean Energy & ESG"
    | "Fitness & Lifestyle";
  aspectRatio: "16:9" | "9:16";
  duration: number;
  prompt: string;
  badge?: string;
  accentColor: string;
  tags: string[];
  renderThumbnail: () => React.ReactNode;
}

export const TEMPLATE_CATEGORIES = [
  "All",
  "SaaS & Tech",
  "Luxury & Cinematic",
  "Social Reels (9:16)",
  "Commercial & Brand",
  "Editorial & News",
  "Clean Energy & ESG",
  "Fitness & Lifestyle",
] as const;

export const READY_MADE_TEMPLATES: VideoTemplate[] = [
  {
    id: "quantum_ai",
    title: "Quantum AI Platform",
    subtitle: "Autonomous Agent Cloud Engine",
    category: "SaaS & Tech",
    aspectRatio: "16:9",
    duration: 15,
    badge: "POPULAR",
    accentColor: "#06b6d4",
    tags: ["SaaS", "AI", "Cloud", "Metrics", "1080p"],
    prompt:
      "Create a 15-second high-impact SaaS launch video for Quantum AI with electric cyan glow, glassmorphic metric cards, neural network diagram, and a bold 'Deploy in Seconds' call-to-action.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-[#030712] flex flex-col justify-between p-2.5 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-bold tracking-wider text-cyan-400 uppercase bg-cyan-950/70 border border-cyan-800/60 px-1.5 py-0.5 rounded">
            AI ENGINE
          </span>
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
        </div>
        <div className="flex flex-col text-left my-auto">
          <span className="text-[11px] font-extrabold text-white leading-tight font-sans tracking-tight">
            QUANTUM
          </span>
          <span className="text-[8px] font-medium text-cyan-300/80 leading-tight">
            Neural Core 2.0
          </span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-cyan-950/80 text-[7px] text-slate-400">
          <span>10M+ Tokens/s</span>
          <span className="text-cyan-400 font-mono">0.02ms</span>
        </div>
      </div>
    ),
  },
  {
    id: "aethelgard",
    title: "Aethelgard Chronograph",
    subtitle: "Swiss Horology & Precious Metals",
    category: "Luxury & Cinematic",
    aspectRatio: "16:9",
    duration: 15,
    badge: "PREMIUM",
    accentColor: "#d4af37",
    tags: ["Luxury", "Horology", "Swiss", "Gold"],
    prompt:
      "Create a 15-second cinematic luxury commercial for Aethelgard Chronograph with deep obsidian black background, shimmering champagne gold typography, high-precision watch dial details, and refined Swiss craftsmanship aesthetics.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-[#08080a] flex flex-col items-center justify-between p-2.5 overflow-hidden border border-[#d4af37]/30">
        <div className="flex items-center justify-between w-full">
          <span className="text-[6px] tracking-widest text-[#d4af37] uppercase font-serif">
            GENÈVE
          </span>
          <span className="text-[6px] text-slate-400 font-serif">N° 042</span>
        </div>
        <div className="flex flex-col items-center text-center my-auto">
          <div className="w-5 h-5 rounded-full border border-[#d4af37]/50 flex items-center justify-center mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37]" />
          </div>
          <span className="text-[10px] font-bold text-stone-100 font-serif italic tracking-wide">
            Aethelgard
          </span>
          <span className="text-[6px] tracking-wider text-[#d4af37]/90 uppercase font-sans mt-0.5">
            Chronograph
          </span>
        </div>
        <span className="text-[6px] text-stone-400 tracking-wider">SWISS CALIBRE</span>
      </div>
    ),
  },
  {
    id: "peak_focus",
    title: "3 Secrets to Peak Focus",
    subtitle: "High-Retention Vertical Reel",
    category: "Social Reels (9:16)",
    aspectRatio: "9:16",
    duration: 10,
    badge: "VIRAL 9:16",
    accentColor: "#10b981",
    tags: ["9:16", "Reels", "TikTok", "Productivity"],
    prompt:
      "Create a 10-second high-energy vertical 9:16 social reel on '3 Secrets to 10x Your Deep Work Focus' featuring bold kinetic typography, punchy bullet points, and dynamic progress bar.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-gradient-to-b from-[#080c16] via-[#0f172a] to-[#1e1b4b] flex flex-col justify-between p-2.5 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
            REEL 9:16
          </span>
          <span className="text-[7px] font-bold text-amber-400">🔥 10X</span>
        </div>
        <div className="flex flex-col text-left my-auto">
          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
            SECRET 01
          </span>
          <span className="text-[11px] font-black text-white leading-tight uppercase font-sans tracking-tight">
            UNBROKEN
          </span>
          <span className="text-[11px] font-black text-emerald-400 leading-tight uppercase font-sans tracking-tight">
            DEEP FLOW
          </span>
        </div>
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
          <div className="bg-emerald-400 h-full w-3/4 rounded-full" />
        </div>
      </div>
    ),
  },
  {
    id: "daktilo",
    title: "Global Capital Shift",
    subtitle: "Financial Macroeconomic Report",
    category: "Editorial & News",
    aspectRatio: "16:9",
    duration: 20,
    badge: "EDITORIAL",
    accentColor: "#047857",
    tags: ["Finance", "Markets", "Editorial", "News"],
    prompt:
      "Create a 20-second investigative financial editorial video in Daktilo Dispatch style analyzing 'The 2026 Global Capital Shift' with clean editorial newsprint style, animated market trend bars, and comparative asset inflow data.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-[#fcfbf7] flex flex-col justify-between p-2.5 overflow-hidden border border-stone-300">
        <div className="flex items-center justify-between border-b border-stone-300 pb-1">
          <span className="text-[6px] font-black uppercase text-stone-700 tracking-wider font-serif">
            FINANCIAL DISPATCH
          </span>
          <span className="text-[6px] text-emerald-700 font-bold">+$4.2T</span>
        </div>
        <div className="flex flex-col text-left my-auto">
          <span className="text-[9px] font-black text-stone-900 tracking-tight leading-tight uppercase font-serif">
            WHERE DID THE CAPITAL GO?
          </span>
          <span className="text-[7px] text-stone-600 mt-0.5 font-sans">
            Macro Inflow Analysis
          </span>
        </div>
        <div className="flex items-end gap-1 h-3">
          <div className="bg-stone-300 w-2 h-1 rounded-xs" />
          <div className="bg-stone-400 w-2 h-2 rounded-xs" />
          <div className="bg-emerald-700 w-2 h-3 rounded-xs" />
        </div>
      </div>
    ),
  },
  {
    id: "neon_kernel",
    title: "Neon Kernel 6.0",
    subtitle: "Developer Terminal & Systems",
    category: "SaaS & Tech",
    aspectRatio: "16:9",
    duration: 15,
    badge: "TERMINAL",
    accentColor: "#22c55e",
    tags: ["Terminal", "Code", "Linux", "DevOps"],
    prompt:
      "Create a 15-second developer-focused terminal launch video for Neon Kernel 6.0 with CRT phosphor green scanlines, monospaced code syntax, and real-time kernel latency benchmarks.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-[#030a05] flex flex-col justify-between p-2.5 overflow-hidden font-mono border border-green-900/60">
        <div className="flex items-center justify-between border-b border-green-900/60 pb-1 text-[7px] text-green-500">
          <span>root@kernel:~#</span>
          <span className="animate-pulse">● LIVE</span>
        </div>
        <div className="flex flex-col text-left my-auto text-[8px] text-green-400">
          <span>&gt; sysctl -w net.core</span>
          <span className="text-white font-bold">&gt; IOPS: 2,840,192</span>
          <span className="text-[7px] text-green-600">&gt; LATENCY: 12μs</span>
        </div>
        <div className="text-[6px] text-green-500 flex justify-between">
          <span>POSIX 2026</span>
          <span>BUILD PASS</span>
        </div>
      </div>
    ),
  },
  {
    id: "counterform",
    title: "Counterform Studio",
    subtitle: "Swiss Modernism & Brutalism",
    category: "Minimalist & Design",
    aspectRatio: "16:9",
    duration: 15,
    badge: "SWISS STYLE",
    accentColor: "#ef4444",
    tags: ["Swiss", "Modernism", "Brutalist", "Architecture"],
    prompt:
      "Create a 15-second Swiss modern architectural video for Counterform Studio with stark monochrome canvas, vermilion red geometric accents, and bold Helvetica typography.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-[#f8fafc] flex flex-col justify-between p-2.5 overflow-hidden border border-slate-300">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-black tracking-widest uppercase text-black font-sans">
            COUNTERFORM
          </span>
          <div className="w-2.5 h-2.5 bg-[#ef4444]" />
        </div>
        <div className="flex flex-col text-left my-auto">
          <span className="text-[12px] font-black text-black tracking-tighter leading-none font-sans">
            MODERN
          </span>
          <span className="text-[12px] font-black text-[#ef4444] tracking-tighter leading-none font-sans">
            SPACES
          </span>
        </div>
        <div className="flex items-center justify-between text-[6px] text-slate-500 uppercase tracking-widest">
          <span>BASEL · ZÜRICH</span>
          <span>VOL. 09</span>
        </div>
      </div>
    ),
  },
  {
    id: "aura_energy",
    title: "Aura Smart Solar Grid",
    subtitle: "ESG Impact & Clean Tech",
    category: "Clean Energy & ESG",
    aspectRatio: "16:9",
    duration: 15,
    badge: "CLEAN TECH",
    accentColor: "#10b981",
    tags: ["Solar", "CleanEnergy", "ESG", "Climate"],
    prompt:
      "Create a 15-second clean energy sustainability report for Aura Smart Solar Grid with emerald green glow, animated solar irradiance telemetry, and carbon offset statistics.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-[#021810] flex flex-col justify-between p-2.5 overflow-hidden border border-emerald-900/50">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/60">
            SOLAR GRID
          </span>
          <span className="text-[7px] text-amber-400 font-bold">98.4% EFF</span>
        </div>
        <div className="flex flex-col text-left my-auto">
          <span className="text-[10px] font-extrabold text-white leading-tight">
            1.2M TONS
          </span>
          <span className="text-[7px] text-emerald-300">CO2 Offset Today</span>
        </div>
        <div className="flex items-center justify-between text-[6px] text-emerald-500">
          <span>450 MW Active</span>
          <span>NET ZERO</span>
        </div>
      </div>
    ),
  },
  {
    id: "flowstate",
    title: "Flowstate Meditation",
    subtitle: "Mindfulness & Mental Wellbeing",
    category: "Fitness & Lifestyle",
    aspectRatio: "16:9",
    duration: 15,
    badge: "MINDFULNESS",
    accentColor: "#a855f7",
    tags: ["Calm", "AppTour", "Mindfulness", "Wellness"],
    prompt:
      "Create a 15-second calming mindfulness app tour for Flowstate Meditation featuring pastel lilac gradients, rhythmic breathing animations, and gentle typographic transitions.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-gradient-to-br from-[#180d2b] to-[#0c0517] flex flex-col justify-between p-2.5 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-medium text-purple-300">BREATHE IN</span>
          <div className="w-2 h-2 rounded-full bg-purple-400/50 animate-pulse" />
        </div>
        <div className="flex flex-col items-center text-center my-auto">
          <div className="w-6 h-6 rounded-full border border-purple-400/40 flex items-center justify-center mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-300/80" />
          </div>
          <span className="text-[9px] font-medium text-white tracking-wide">
            Flowstate
          </span>
        </div>
        <span className="text-[6px] text-purple-400/80 text-center">4-7-8 CYCLE</span>
      </div>
    ),
  },
  {
    id: "tangerine",
    title: "Tangerine Spark Brand",
    subtitle: "High-Energy Growth Marketing",
    category: "Commercial & Brand",
    aspectRatio: "16:9",
    duration: 15,
    badge: "CONVERSION",
    accentColor: "#f97316",
    tags: ["Brand", "Growth", "Marketing", "SaaS"],
    prompt:
      "Create a 15-second high-conversion growth marketing commercial for Tangerine Spark with sunburst orange gradients, punchy stat callouts, and kinetic conversion CTA.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-gradient-to-br from-[#1f0d04] via-[#2e1305] to-[#120601] flex flex-col justify-between p-2.5 overflow-hidden border border-orange-950">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-bold text-orange-400 bg-orange-950/80 px-1.5 py-0.5 rounded">
            SPARK 3.0
          </span>
          <span className="text-[7px] font-bold text-amber-400">+312%</span>
        </div>
        <div className="flex flex-col text-left my-auto">
          <span className="text-[11px] font-black text-white leading-tight font-sans">
            CONVERT
          </span>
          <span className="text-[11px] font-black text-orange-400 leading-tight font-sans">
            FASTER.
          </span>
        </div>
        <div className="flex items-center justify-between text-[6px] text-orange-400/80">
          <span>ZERO FRICTION</span>
          <span>START FREE</span>
        </div>
      </div>
    ),
  },
  {
    id: "event_horizon",
    title: "Event Horizon Deep Space",
    subtitle: "Astrophysics & Cosmic Physics",
    category: "Luxury & Cinematic",
    aspectRatio: "16:9",
    duration: 20,
    badge: "COSMIC",
    accentColor: "#8b5cf6",
    tags: ["Astronomy", "Physics", "Cosmic", "Documentary"],
    prompt:
      "Create a 20-second cosmic science documentary on 'The Event Horizon Observatory' featuring deep space violet nebula particles, gravitational lens animations, and astrophysical telemetry.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-[#05030c] flex flex-col justify-between p-2.5 overflow-hidden border border-violet-950">
        <div className="flex items-center justify-between">
          <span className="text-[6px] font-mono text-violet-400">NGC-4486</span>
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
        </div>
        <div className="flex flex-col text-center items-center my-auto">
          <div className="w-7 h-7 rounded-full border border-violet-500/40 border-dashed flex items-center justify-center mb-0.5">
            <div className="w-3 h-3 rounded-full bg-black border border-violet-300" />
          </div>
          <span className="text-[8px] font-bold text-white tracking-widest uppercase">
            EVENT HORIZON
          </span>
        </div>
        <span className="text-[6px] text-violet-500 font-mono text-center">
          SINGULARITY DETECTED
        </span>
      </div>
    ),
  },
  {
    id: "salt_air",
    title: "Salt & Solitude Retreat",
    subtitle: "Mediterranean Coast Travel",
    category: "Commercial & Brand",
    aspectRatio: "16:9",
    duration: 15,
    badge: "TRAVEL",
    accentColor: "#06b6d4",
    tags: ["Travel", "Coastal", "Hospitality", "Cinematic"],
    prompt:
      "Create a 15-second coastal luxury travel story for 'Salt & Solitude Amalfi Retreat' with Mediterranean turquoise ocean tones, elegant serif titles, and sun-drenched architectural moments.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-gradient-to-b from-[#041c24] via-[#083344] to-[#0e7490] flex flex-col justify-between p-2.5 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[6px] text-cyan-200 tracking-widest uppercase font-serif">
            AMALFI COAST
          </span>
          <span className="text-[6px] text-cyan-300">EST. 1928</span>
        </div>
        <div className="flex flex-col text-left my-auto">
          <span className="text-[10px] font-light text-cyan-50 font-serif italic">
            Salt & Solitude
          </span>
          <span className="text-[6px] text-cyan-300 uppercase tracking-widest mt-0.5">
            PRIVATE SANCTUARY
          </span>
        </div>
        <span className="text-[6px] text-cyan-200/80">MEDITERRANEAN BLISS</span>
      </div>
    ),
  },
  {
    id: "absolute_batman",
    title: "Absolute Batman #1 Trailer",
    subtitle: "DC Comics Action Launch Special",
    category: "Commercial & Brand",
    aspectRatio: "16:9",
    duration: 20,
    badge: "ACTION NOIR",
    accentColor: "#dc2626",
    tags: ["Comics", "Action", "Batman", "Cinematic"],
    prompt:
      "Create a 20-second official DC Comics comic ad trailer for 'Absolute Batman #1' with Gotham concrete noir, red bloodline accents, tactical battleaxe weapons breakdown, and gritty character dossier.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-[#0a0a0a] flex flex-col justify-between p-2.5 overflow-hidden border-2 border-red-700/60">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-black bg-red-600 text-white px-1 py-0.2 rounded-xs">
            DC COMICS
          </span>
          <span className="text-[6px] text-stone-400 font-mono">ISSUE #1</span>
        </div>
        <div className="flex flex-col text-left my-auto">
          <span className="text-[11px] font-black text-white uppercase tracking-tighter leading-none">
            ABSOLUTE
          </span>
          <span className="text-[11px] font-black text-red-600 uppercase tracking-tighter leading-none">
            BATMAN
          </span>
        </div>
        <span className="text-[6px] text-stone-400 tracking-wider">
          WITHOUT MERCY · ALL IN
        </span>
      </div>
    ),
  },
  {
    id: "hyperion_hypercar",
    title: "Hyperion GT Hypercar",
    subtitle: "Next-Gen EV Speed & Aerodynamics",
    category: "SaaS & Tech",
    aspectRatio: "16:9",
    duration: 15,
    badge: "SPEED & TECH",
    accentColor: "#ef4444",
    tags: ["Automotive", "EV", "Speed", "Aerodynamics"],
    prompt:
      "Create a 15-second ultra-high performance automotive reveal for the Hyperion GT Electric Hypercar with carbon fiber textures, crimson velocity wind-tunnel lines, 0-60mph 1.74s telemetry, and aerodynamic downforce meters.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-[#050505] flex flex-col justify-between p-2.5 overflow-hidden border border-red-950">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-black tracking-widest text-red-500 uppercase">
            HYPERION GT
          </span>
          <span className="text-[6px] font-mono text-white bg-red-950 px-1 py-0.5 rounded">
            EV 1,900 HP
          </span>
        </div>
        <div className="flex flex-col text-left my-auto">
          <span className="text-[12px] font-black text-white italic tracking-tighter font-sans leading-none">
            0-60 IN 1.74s
          </span>
          <span className="text-[7px] text-red-400 uppercase tracking-widest mt-0.5">
            AERO VELOCITY
          </span>
        </div>
        <div className="flex justify-between items-center text-[6px] text-stone-400 font-mono">
          <span>TOP: 280 MPH</span>
          <span className="text-red-500">CARBON FIBRE</span>
        </div>
      </div>
    ),
  },
  {
    id: "artisan_burger",
    title: "Sizzle & Sear Burger Co.",
    subtitle: "Mouthwatering Street Food Reel",
    category: "Social Reels (9:16)",
    aspectRatio: "9:16",
    duration: 10,
    badge: "FOOD 9:16",
    accentColor: "#eab308",
    tags: ["Food", "Reels", "Restaurant", "Hospitality"],
    prompt:
      "Create a 10-second mouthwatering vertical 9:16 food reel for 'Sizzle & Sear Artisan Burgers' with rich smoky amber glow, sizzling ingredients callout, bold retro typography, and 'Taste the Crunch' final hook.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-gradient-to-b from-[#1c0800] via-[#2e1003] to-[#451a03] flex flex-col justify-between p-2.5 overflow-hidden border border-amber-900/40">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-bold bg-amber-500 text-black px-1.5 py-0.5 rounded-full">
            SMASH BURGER
          </span>
          <span className="text-[7px] text-amber-400 font-bold">🍔 CRISP</span>
        </div>
        <div className="flex flex-col text-left my-auto">
          <span className="text-[7px] font-bold text-amber-400 uppercase tracking-wider">
            AGED ANGUS
          </span>
          <span className="text-[11px] font-black text-white leading-tight uppercase font-sans">
            SIZZLE &
          </span>
          <span className="text-[11px] font-black text-amber-400 leading-tight uppercase font-sans">
            CRUNCH
          </span>
        </div>
        <span className="text-[6px] text-amber-300 font-bold">ORDER ONLINE NOW</span>
      </div>
    ),
  },
  {
    id: "iron_core_athletic",
    title: "Iron Core Elite Athletics",
    subtitle: "High-Intensity Training Promo",
    category: "Fitness & Lifestyle",
    aspectRatio: "9:16",
    duration: 10,
    badge: "WORKOUT 9:16",
    accentColor: "#84cc16",
    tags: ["Fitness", "Reel", "Gym", "CrossFit"],
    prompt:
      "Create a 10-second explosive high-intensity vertical 9:16 workout promo for 'Iron Core Elite Athletics' with raw industrial concrete backgrounds, neon volt yellow countdown timers, and heartbeat cadence graph.",
    renderThumbnail: () => (
      <div className="relative h-full w-full bg-gradient-to-b from-[#090b0e] via-[#111827] to-[#040608] flex flex-col justify-between p-2.5 overflow-hidden border border-lime-900/50">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-black text-black bg-lime-400 px-1.5 py-0.5 rounded uppercase">
            HIIT 10S
          </span>
          <span className="text-[7px] text-lime-400 font-mono font-bold">178 BPM</span>
        </div>
        <div className="flex flex-col text-left my-auto">
          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
            INTERVAL 04
          </span>
          <span className="text-[11px] font-black text-white leading-tight uppercase font-sans">
            NO LIMITS
          </span>
          <span className="text-[11px] font-black text-lime-400 leading-tight uppercase font-sans">
            FULL POWER
          </span>
        </div>
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
          <div className="bg-lime-400 h-full w-4/5 rounded-full" />
        </div>
      </div>
    ),
  },
];

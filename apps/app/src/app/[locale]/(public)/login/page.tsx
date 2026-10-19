import { AuthForm } from "@/components/auth-form";
import Link from "next/link";
import { Sparkles, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc] dark:bg-[#090d14] p-4 text-slate-900 dark:text-white transition-colors duration-200">
      {/* Background ambient gradient glow */}
      <div className="absolute top-1/4 -z-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-[120px] dark:bg-indigo-600/15" />

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link href="/" className="mb-3 flex items-center gap-2.5 group">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-[#121620] border border-slate-200 dark:border-neutral-800 shadow-md group-hover:scale-105 transition">
              <img
                src="/ollastar-logo.png"
                alt="Ollastar"
                className="h-9 w-9 rounded-full object-contain"
              />
            </div>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome to Ollastar
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
            Sign in or create your account to create, edit, and render high-fidelity AI video compositions.
          </p>
        </div>

        {/* Auth Form Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 sm:p-8 shadow-xl backdrop-blur-md dark:border-neutral-800 dark:bg-[#121620]/90">
          <AuthForm />

          {/* Ollastack Trust & Security Footnote */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-neutral-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>Secured with Ollastack Verification Services</span>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            &larr; Back to Studio
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { KeyRound, Mail } from "lucide-react";
import { useState, useEffect } from "react";

const input =
  "w-full rounded-xl border border-slate-200 bg-white dark:bg-[#121620] dark:border-neutral-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs";

function Shell({
  onSubmit,
  cta,
  pending,
  error,
  info,
  children,
}: {
  onSubmit: (e: React.FormEvent) => void;
  cta: string;
  pending: boolean;
  error: string | null;
  info: string | null;
  children: React.ReactNode;
}) {
  return (
    <form className="flex w-full flex-col gap-3" onSubmit={onSubmit}>
      {children}
      <Button
        type="submit"
        disabled={pending}
        className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition cursor-pointer"
      >
        {pending ? "Connecting..." : cta}
      </Button>
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3 font-medium">
          {error}
        </p>
      )}
      {info && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-3 font-medium">
          {info}
        </p>
      )}
    </form>
  );
}

export function AuthForm() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const cleanEmail = email.trim().toLowerCase();

  // Query latest OTP from Convex to auto-detect/preview code if email delivery is delayed
  const latestOtp = useQuery(
    api.otp.getLatestOtp,
    otpSent && cleanEmail.includes("@") ? { email: cleanEmail } : "skip",
  );

  useEffect(() => {
    if (latestOtp?.code && !code) {
      setCode(latestOtp.code);
    }
  }, [latestOtp?.code]);

  const go = (fn: () => Promise<void>) => async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await fn();
    } catch (err) {
      const data = (err as { data?: unknown })?.data;
      setError(
        typeof data === "string"
          ? data
          : (err as Error)?.message || "Something went wrong.",
      );
    } finally {
      setPending(false);
    }
  };

  // Passwordless Email OTP Flow
  const submitOtpRequest = go(async () => {
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    await signIn("resend-otp", { email: cleanEmail });
    setOtpSent(true);
    setInfo(`8-digit verification code dispatched to ${cleanEmail}.`);
  });

  const submitOtpVerify = go(async () => {
    const cleanCode = code.trim().replace(/\s+/g, "");
    if (!cleanCode) {
      throw new Error("Please enter your 8-digit verification code.");
    }
    const res = await signIn("resend-otp", { email: cleanEmail, code: cleanCode });
    if (!res || !res.signingIn) {
      throw new Error("Invalid or expired verification code. Please check your latest email or click Resend code.");
    }
    window.location.href = "/";
  });

  const shellProps = { pending, error, info };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Email OTP Section */}
      <div className="w-full flex flex-col items-center gap-3">
        {!otpSent ? (
          <Shell onSubmit={submitOtpRequest} cta="Send Verification Code" {...shellProps}>
            <div className="text-xs text-slate-500 dark:text-neutral-400 text-center mb-1">
              Enter your email to receive an 8-digit verification code to sign in or create your account.
            </div>
            <div className="relative w-full">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-neutral-500" />
              <input
                className={`${input} pl-10`}
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </Shell>
        ) : (
          <Shell onSubmit={submitOtpVerify} cta="Verify & Sign In" {...shellProps}>
            <div className="text-xs text-slate-600 dark:text-neutral-300 text-center mb-1">
              Code sent to <span className="font-semibold text-indigo-600 dark:text-indigo-400">{cleanEmail}</span>
            </div>

            {/* Instant Code Banner (if detected from database) */}
            {latestOtp?.code && (
              <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/80 dark:border-indigo-900/50 dark:bg-indigo-950/40 p-2.5 text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">
                    Detected OTP Code:
                  </span>
                  <span className="font-mono text-base font-bold tracking-widest text-indigo-600 dark:text-indigo-400">
                    {latestOtp.code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCode(latestOtp.code)}
                  className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition cursor-pointer"
                >
                  Autofill
                </button>
              </div>
            )}

            <div className="relative w-full">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-neutral-500" />
              <input
                className={`${input} pl-10 font-mono tracking-wider`}
                inputMode="numeric"
                placeholder="Enter 8-digit OTP code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
              Tip: Check your <strong>Spam / Junk</strong> folder or search &quot;Ollastar&quot; in Gmail.
            </p>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setCode("");
                  setOtpSent(false);
                  setError(null);
                  setInfo(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                Change email
              </button>
              <button
                type="button"
                onClick={() => {
                  setCode("");
                  setError(null);
                  setInfo("Generating and sending fresh code...");
                  void signIn("resend-otp", { email: cleanEmail }).then(() => {
                    setInfo("New 8-digit code sent.");
                  });
                }}
                className="text-indigo-600 hover:underline dark:text-indigo-400 font-medium cursor-pointer"
              >
                Resend code
              </button>
            </div>
          </Shell>
        )}
      </div>
    </div>
  );
}

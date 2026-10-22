"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { KeyRound, Mail, Lock } from "lucide-react";
import { useState } from "react";

type Mode = "signIn" | "signUp" | "verify" | "forgot" | "reset";
type AuthMethod = "password" | "otp";

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

const Switch = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
    onClick={onClick}
  >
    {label}
  </button>
);

export function AuthForm() {
  const { signIn } = useAuthActions();
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

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

  const submitSignIn = go(async () => {
    await signIn("password", { email, password, flow: "signIn" });
    window.location.href = "/";
  });

  const submitSignUp = go(async () => {
    await signIn("password", { email, password, flow: "signUp" });
    setInfo(
      "Verification code sent to your email via Ollastack. Please enter the 8-digit code below.",
    );
    setMode("verify");
  });

  const submitVerify = go(async () => {
    await signIn("password", { email, code, flow: "email-verification" });
    window.location.href = "/";
  });

  const submitForgot = go(async () => {
    await signIn("password", { email, flow: "reset" });
    setInfo("Password reset code sent to your email via Ollastack.");
    setMode("reset");
  });

  const submitReset = go(async () => {
    await signIn("password", {
      email,
      code,
      newPassword,
      flow: "reset-verification",
    });
    window.location.href = "/";
  });

  // Passwordless Email OTP Flow via Ollastack Mailbox
  const submitOtpRequest = go(async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    await signIn("resend-otp", { email: cleanEmail });
    setOtpSent(true);
    setInfo(`8-digit verification code sent to ${cleanEmail} via Ollastack Mailbox.`);
  });

  const submitOtpVerify = go(async () => {
    const cleanEmail = email.trim().toLowerCase();
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

  const switchTo = (m: Mode) => {
    setError(null);
    setInfo(null);
    setMode(m);
  };

  const shellProps = { pending, error, info };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Auth Method Selector Toggle (Password vs Email OTP) */}
      <div className="flex w-full rounded-xl bg-slate-100 p-1 dark:bg-neutral-800/80 border border-slate-200 dark:border-neutral-700/60">
        <button
          type="button"
          onClick={() => {
            setAuthMethod("password");
            setError(null);
            setInfo(null);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            authMethod === "password"
              ? "bg-white text-slate-900 shadow-2xs dark:bg-[#121620] dark:text-white"
              : "text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Password</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMethod("otp");
            setError(null);
            setInfo(null);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
            authMethod === "otp"
              ? "bg-white text-slate-900 shadow-2xs dark:bg-[#121620] dark:text-white"
              : "text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Email OTP</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. PASSWORD AUTH METHOD */}
      {/* ========================================================================= */}
      {authMethod === "password" && (
        <div className="w-full flex flex-col items-center gap-3">
          {mode === "signIn" && (
            <>
              <Shell onSubmit={submitSignIn} cta="Sign in with Password" {...shellProps}>
                <input
                  className={input}
                  type="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className={input}
                  type="password"
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Shell>
              <div className="flex w-full justify-between px-1">
                <Switch label="Create account" onClick={() => switchTo("signUp")} />
                <Switch
                  label="Forgot password?"
                  onClick={() => switchTo("forgot")}
                />
              </div>
            </>
          )}

          {mode === "signUp" && (
            <>
              <Shell onSubmit={submitSignUp} cta="Create account" {...shellProps}>
                <input
                  className={input}
                  type="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className={input}
                  type="password"
                  placeholder="Password (8+, upper, lower, number)"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Shell>
              <Switch
                label="Have an account? Sign in"
                onClick={() => switchTo("signIn")}
              />
            </>
          )}

          {mode === "verify" && (
            <Shell onSubmit={submitVerify} cta="Verify Email Code" {...shellProps}>
              <p className="text-xs text-muted-foreground text-center">
                Enter the 8-digit verification code sent to <strong>{email}</strong>
              </p>
              <input
                className={input}
                inputMode="numeric"
                placeholder="8-digit verification code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Shell>
          )}

          {mode === "forgot" && (
            <>
              <Shell onSubmit={submitForgot} cta="Send Reset Code via Ollastack" {...shellProps}>
                <input
                  className={input}
                  type="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Shell>
              <Switch label="Back to sign in" onClick={() => switchTo("signIn")} />
            </>
          )}

          {mode === "reset" && (
            <Shell onSubmit={submitReset} cta="Set New Password" {...shellProps}>
              <p className="text-xs text-muted-foreground text-center">
                Enter the reset code sent to <strong>{email}</strong>
              </p>
              <input
                className={input}
                inputMode="numeric"
                placeholder="Reset code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <input
                className={input}
                type="password"
                placeholder="New password (8+, upper, lower, number)"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Shell>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PASSWORDLESS EMAIL OTP AUTH METHOD (POWERED BY OLLASTACK) */}
      {/* ========================================================================= */}
      {authMethod === "otp" && (
        <div className="w-full flex flex-col items-center gap-3">
          {!otpSent ? (
            <Shell onSubmit={submitOtpRequest} cta="Send OTP Code via Ollastack" {...shellProps}>
              <div className="text-xs text-slate-500 dark:text-neutral-400 text-center mb-1">
                We will email an 8-digit one-time passcode to sign you in securely.
              </div>
              <input
                className={input}
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Shell>
          ) : (
            <Shell onSubmit={submitOtpVerify} cta="Verify & Sign In" {...shellProps}>
              <div className="text-xs text-slate-600 dark:text-neutral-300 text-center mb-1">
                Code sent to <span className="font-semibold text-indigo-600 dark:text-indigo-400">{email}</span>
              </div>
              <input
                className={input}
                inputMode="numeric"
                placeholder="Enter 8-digit OTP code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <div className="flex items-center justify-between mt-1 text-xs">
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
                    void signIn("resend-otp", { email }).then(() => {
                      setInfo("New 8-digit code sent via Ollastack.");
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
      )}

      {/* Social / Google divider */}
      <div className="flex w-full items-center gap-3 text-xs text-muted-foreground my-1">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-10 rounded-xl font-medium flex items-center justify-center gap-2 border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800 transition cursor-pointer"
        disabled={pending}
        onClick={async () => {
          setError(null);
          setPending(true);
          try {
            await signIn("google");
          } catch (err: any) {
            setError(
              err?.message ||
                "Google sign-in failed. Please verify AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set.",
            );
            setPending(false);
          }
        }}
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        {pending ? "Connecting…" : "Continue with Google"}
      </Button>
    </div>
  );
}

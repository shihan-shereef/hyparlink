"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { useEffect, useState } from "react";

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring";

export function EmailOtpSignin() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);

  useEffect(() => {
    if (step === "signIn") return;
    let isMounted = true;
    const fetchOtp = async () => {
      try {
        const res = await fetch(
          `http://localhost:4000/api/dev-otp?email=${encodeURIComponent(step.email)}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && data.code) {
            setDevOtp(data.code);
            setCode((prev) => prev || data.code);
          }
        }
      } catch {}
    };

    fetchOtp();
    const interval = setInterval(fetchOtp, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [step]);

  if (step === "signIn") {
    return (
      <form
        className="flex flex-col gap-3 w-64"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          setPending(true);
          void signIn("resend-otp", fd)
            .then(() => setStep({ email: fd.get("email") as string }))
            .catch(() => setError("Could not send code. Try again."))
            .finally(() => setPending(false));
        }}
      >
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className={inputCls}
        />
        <Button
          type="submit"
          variant="outline"
          className="font-mono"
          disabled={pending}
        >
          {pending ? "Sending…" : "Send code"}
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 w-64"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        setPending(true);
        void signIn("resend-otp", fd)
          .catch(() => setError("Invalid or expired code."))
          .finally(() => setPending(false));
      }}
    >
      <p className="text-xs text-muted-foreground">
        Code sent to <span className="font-mono">{step.email}</span>
      </p>

      {devOtp && (
        <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">
              Received Code:
            </span>
            <span className="font-mono text-base font-bold tracking-widest text-primary">
              {devOtp}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCode(devOtp)}
            className="rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
          >
            Autofill
          </button>
        </div>
      )}

      <input
        name="code"
        type="text"
        inputMode="numeric"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="8-digit code"
        className={inputCls}
      />
      <input name="email" value={step.email} type="hidden" />
      <Button type="submit" className="font-mono" disabled={pending}>
        {pending ? "Verifying…" : "Continue"}
      </Button>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
        <button
          type="button"
          className="underline hover:text-foreground"
          onClick={() => {
            setStep("signIn");
            setCode("");
            setDevOtp(null);
          }}
        >
          Change email
        </button>
        <a
          href="http://localhost:8025"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-foreground"
        >
          Mailbox Viewer ↗
        </a>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}

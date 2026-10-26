"use client";

import { env } from "@/env.mjs";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

function getConvexUrl(): string {
  if (typeof window !== "undefined") {
    // 1. If meta tag is injected dynamically by RootLayout, prioritize it
    const metaUrl = document
      .querySelector('meta[name="convex-url"]')
      ?.getAttribute("content");
    if (
      metaUrl &&
      !metaUrl.includes("partial-incidence-briefly-documentation")
    ) {
      return metaUrl.trim();
    }

    // 2. If environment variable is configured, use it
    if (process.env.NEXT_PUBLIC_CONVEX_URL) {
      return process.env.NEXT_PUBLIC_CONVEX_URL;
    }

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalhost) {
      return "http://localhost:3210";
    }

    // When accessed through tunnel or external domain, proxy through /convex
    return `${window.location.origin}/convex`;
  }

  return process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3210";
}

const convex = new ConvexReactClient(getConvexUrl(), {
  verbose: true,
});

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}

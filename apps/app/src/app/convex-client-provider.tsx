"use client";

import { env } from "@/env.mjs";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

function getConvexUrl(): string {
  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    // 1. On localhost, ALWAYS connect directly to local Convex on port 3210
    if (isLocalhost) {
      return "http://localhost:3210";
    }

    // 2. On remote / Cloudflare tunnel, read the live meta tag injected dynamically by RootLayout
    const metaUrl = document
      .querySelector('meta[name="convex-url"]')
      ?.getAttribute("content");
    if (
      metaUrl &&
      !metaUrl.includes("localhost") &&
      !metaUrl.includes("127.0.0.1")
    ) {
      return metaUrl;
    }

    // 3. Fallback to active Cloudflare tunnel
    return "https://partial-incidence-briefly-documentation.trycloudflare.com";
  }

  return "http://localhost:3210";
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

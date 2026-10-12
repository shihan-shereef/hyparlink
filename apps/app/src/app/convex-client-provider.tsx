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

    if (isLocalhost) {
      return (
        process.env.NEXT_PUBLIC_CONVEX_URL ||
        "http://localhost:3210"
      );
    }

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

    const configured = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (
      configured &&
      !configured.includes("localhost") &&
      !configured.includes("127.0.0.1")
    ) {
      return configured;
    }
    return "https://aud-over-passed-stock.trycloudflare.com";
  }

  return (
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    "https://aud-over-passed-stock.trycloudflare.com"
  );
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

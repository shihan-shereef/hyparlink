"use client";

import { env } from "@/env.mjs";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

function getConvexUrl(): string {
  if (typeof window !== "undefined") {
    // 1. If meta tag is injected dynamically by RootLayout and is a remote URL, prioritize it
    const metaUrl = document
      .querySelector('meta[name="convex-url"]')
      ?.getAttribute("content");
    if (
      metaUrl &&
      !metaUrl.includes("localhost") &&
      !metaUrl.includes("127.0.0.1") &&
      !metaUrl.includes("partial-incidence-briefly-documentation")
    ) {
      return metaUrl.trim();
    }

    // 2. If environment variable is configured and is a remote URL
    if (
      process.env.NEXT_PUBLIC_CONVEX_URL &&
      !process.env.NEXT_PUBLIC_CONVEX_URL.includes("localhost") &&
      !process.env.NEXT_PUBLIC_CONVEX_URL.includes("127.0.0.1")
    ) {
      return process.env.NEXT_PUBLIC_CONVEX_URL;
    }

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    const isIp =
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname) ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname);

    if (isLocalhost || (isIp && window.location.protocol === "http:")) {
      return `http://${window.location.hostname}:3210`;
    }

    // When accessed through public tunnel (HTTPS), connect directly to the WebSocket-enabled Convex tunnel
    return (
      process.env.NEXT_PUBLIC_CONVEX_URL ||
      "https://upgrade-decent-diabetes-availability.trycloudflare.com"
    );
  }

  return (
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    "https://upgrade-decent-diabetes-availability.trycloudflare.com"
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

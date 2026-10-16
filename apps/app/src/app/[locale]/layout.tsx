import "@v1/ui/globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { TooltipProvider } from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "../convex-client-provider";

import fs from "node:fs";
import path from "node:path";

function getLiveConvexUrl(): string {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const match = fs
        .readFileSync(envPath, "utf-8")
        .match(/NEXT_PUBLIC_CONVEX_URL=(.+)/);
      if (match && match[1]) return match[1].trim();
    }
  } catch {}
  return process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3210";
}

export const metadata: Metadata = {
  title: "Ollastar",
  description: "High-performance AI & direct-code motion video generation engine",
  icons: {
    icon: "/ollastar-logo.png",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)" },
    { media: "(prefers-color-scheme: dark)" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const liveConvexUrl = getLiveConvexUrl();
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <meta name="convex-url" content={liveConvexUrl} />
        </head>
        <body
          className={cn(
            `${GeistSans.variable} ${GeistMono.variable}`,
            "antialiased",
          )}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <TooltipProvider delayDuration={0}>
              <ConvexClientProvider>{children}</ConvexClientProvider>
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}

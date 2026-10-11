import "./src/env.mjs";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@v1/ui", "@v1/backend", "@v1/analytics", "@v1/logger"],
  async rewrites() {
    return [
      {
        source: "/storage/:path*",
        destination: "http://127.0.0.1:4000/storage/:path*",
      },
      {
        source: "/cdn/:path*",
        destination: "http://127.0.0.1:4000/cdn/:path*",
      },
      {
        source: "/outputs/:path*",
        destination: "http://127.0.0.1:4000/outputs/:path*",
      },
      {
        source: "/assets/upload",
        destination: "http://127.0.0.1:4000/assets/upload",
      },
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:4000/api/:path*",
      },
      {
        source: "/ai/:path*",
        destination: "http://127.0.0.1:4000/ai/:path*",
      },
      {
        source: "/editor/project/:path*",
        destination: "http://127.0.0.1:4000/editor/project/:path*",
      },
      {
        source: "/editor/session/:path*",
        destination: "http://127.0.0.1:4000/editor/session/:path*",
      },
      {
        source: "/backend-api/:path*",
        destination: "http://127.0.0.1:4000/:path*",
      },
    ];
  },
};


export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  tunnelRoute: "/monitoring",
});

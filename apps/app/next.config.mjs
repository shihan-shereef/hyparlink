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
      {
        source: "/convex/:path*",
        destination: "http://127.0.0.1:3210/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS,HEAD" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-user-id, x-service-key, x-webhook-secret" },
        ],
      },
      {
        source: "/outputs/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,HEAD,OPTIONS" },
        ],
      },
      {
        source: "/storage/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,HEAD,OPTIONS" },
        ],
      },
      {
        source: "/cdn/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,HEAD,OPTIONS" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
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

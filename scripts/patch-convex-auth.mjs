import fs from "node:fs";
import path from "node:path";

const targetFiles = [
  "node_modules/@convex-dev/auth/dist/nextjs/server/utils.js",
  "node_modules/@convex-dev/auth/src/nextjs/server/utils.ts",
  "../../node_modules/@convex-dev/auth/dist/nextjs/server/utils.js",
  "../../node_modules/@convex-dev/auth/src/nextjs/server/utils.ts",
];

for (const rel of targetFiles) {
  const p = path.resolve(process.cwd(), rel);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, "utf-8");
    if (content.includes("originURL.host !== request.headers.get(\"Host\")")) {
      content = content.replace(
        /export function isCorsRequest\(request[\s\S]*?\n\}/,
        `export function isCorsRequest(request) {
    const origin = request.headers.get("Origin");
    const originURL = origin ? new URL(origin) : null;
    if (!originURL) return false;
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = request.headers.get("Host");
    if (originURL.host === host || (forwardedHost && originURL.host === forwardedHost)) {
        return false;
    }
    return true;
}`
      );
      fs.writeFileSync(p, content, "utf-8");
      console.log(`[patch] Successfully patched reverse proxy support in ${rel}`);
    }
  }
}

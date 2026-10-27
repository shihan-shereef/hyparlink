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
    if (content.includes('originURL.host !== request.headers.get("Host")')) {
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

const proxyFiles = [
  "node_modules/@convex-dev/auth/dist/nextjs/server/proxy.js",
  "node_modules/@convex-dev/auth/src/nextjs/server/proxy.ts",
  "../../node_modules/@convex-dev/auth/dist/nextjs/server/proxy.js",
  "../../node_modules/@convex-dev/auth/src/nextjs/server/proxy.ts",
];

for (const rel of proxyFiles) {
  const p = path.resolve(process.cwd(), rel);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, "utf-8");
    if (content.includes("const response = jsonResponse(null);")) {
      content = content.replace(
        "const response = jsonResponse(null);",
        'const response = jsonResponse({ error: (error?.message || "Authentication failed"), tokens: null });'
      );
      fs.writeFileSync(p, content, "utf-8");
      console.log(`[patch] Patched error response in ${rel}`);
    }
  }
}

const clientFiles = [
  "node_modules/@convex-dev/auth/dist/react/client.js",
  "node_modules/@convex-dev/auth/src/react/client.tsx",
  "../../node_modules/@convex-dev/auth/dist/react/client.js",
  "../../node_modules/@convex-dev/auth/src/react/client.tsx",
];

for (const rel of clientFiles) {
  const p = path.resolve(process.cwd(), rel);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, "utf-8");
    if (content.includes("const result = await client.authenticatedCall(")) {
      content = content.replace(
        "const result = await client.authenticatedCall(",
        "const result = (await client.authenticatedCall("
      ).replace(
        'provider, params, verifier });',
        'provider, params, verifier })) || {};'
      );
      fs.writeFileSync(p, content, "utf-8");
      console.log(`[patch] Patched null safe result in ${rel}`);
    }
  }
}

const utilsFiles = [
  "node_modules/@convex-dev/auth/dist/server/utils.js",
  "node_modules/@convex-dev/auth/src/server/utils.ts",
  "../../node_modules/@convex-dev/auth/dist/server/utils.js",
  "../../node_modules/@convex-dev/auth/src/server/utils.ts",
];

for (const rel of utilsFiles) {
  const p = path.resolve(process.cwd(), rel);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, "utf-8");
    if (content.includes("return /(localhost|127\\.0\\.0\\.1):\\d+/.test(host ?? \"\");")) {
      content = content.replace(
        "return /(localhost|127\\.0\\.0\\.1):\\d+/.test(host ?? \"\");",
        "return true;"
      );
      fs.writeFileSync(p, content, "utf-8");
      console.log(`[patch] Patched isLocalHost in ${rel}`);
    }
  }
}

const cookieFiles = [
  "node_modules/@convex-dev/auth/dist/nextjs/server/cookies.js",
  "node_modules/@convex-dev/auth/src/nextjs/server/cookies.ts",
  "../../node_modules/@convex-dev/auth/dist/nextjs/server/cookies.js",
  "../../node_modules/@convex-dev/auth/src/nextjs/server/cookies.ts",
];

for (const rel of cookieFiles) {
  const p = path.resolve(process.cwd(), rel);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, "utf-8");
    let changed = false;
    if (content.includes('const prefix = isLocalhost ? "" : "__Host-";')) {
      content = content.replaceAll('const prefix = isLocalhost ? "" : "__Host-";', 'const prefix = "";');
      changed = true;
    }
    if (content.includes("secure: isLocalhost ? false : true")) {
      content = content.replaceAll("secure: isLocalhost ? false : true", "secure: false");
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(p, content, "utf-8");
      console.log(`[patch] Patched cookies in ${rel}`);
    }
  }
}

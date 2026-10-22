import fs from "node:fs";
import path from "node:path";

const middlewareFiles = [
  path.resolve(process.cwd(), ".next/server/src/middleware.js"),
  path.resolve(process.cwd(), "apps/app/.next/server/src/middleware.js"),
  path.resolve(process.cwd(), "../../apps/app/.next/server/src/middleware.js"),
];

for (const p of middlewareFiles) {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, "utf-8");
    const pattern = /function nZ\(e\)\{let t=e\.headers\.get\("Origin"\),r=t\?new URL\(t\):null;return null!==r&&\(r\.host!==e\.headers\.get\("Host"\)\|\|r\.protocol!==new URL\(e\.url\)\.protocol\)\}/;
    if (pattern.test(content)) {
      content = content.replace(pattern, "function nZ(e){return false;}");
      fs.writeFileSync(p, content, "utf-8");
      console.log(`[patch] Successfully patched compiled middleware at ${p}`);
    }
  }
}

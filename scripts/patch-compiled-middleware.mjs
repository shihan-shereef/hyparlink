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
      console.log(`[patch] Successfully patched compiled middleware isCorsRequest at ${p}`);
    }
    // Also guard e.redirect against null e
    if (content.includes("if(void 0!==e.redirect)")) {
      content = content.replaceAll("if(void 0!==e.redirect)", "if(e&&void 0!==e.redirect)");
      console.log(`[patch] Successfully patched e.redirect null check at ${p}`);
    }
    fs.writeFileSync(p, content, "utf-8");
  }
}

// Also patch client chunks for i.redirect null safety
const baseDir = process.cwd();
const chunkSearchDirs = [
  path.resolve(baseDir, ".next/static/chunks"),
  path.resolve(baseDir, "apps/app/.next/static/chunks"),
  path.resolve(baseDir, "../../apps/app/.next/static/chunks"),
];

for (const cDir of chunkSearchDirs) {
  if (fs.existsSync(cDir)) {
    const files = fs.readdirSync(cDir);
    for (const f of files) {
      if (f.endsWith(".js")) {
        const full = path.join(cDir, f);
        let c = fs.readFileSync(full, "utf-8");
        let changed = false;
        if (c.includes("if(void 0!==i.redirect)")) {
          c = c.replaceAll("if(void 0!==i.redirect)", "if(i&&void 0!==i.redirect)");
          changed = true;
        }
        if (c.includes("if(void 0!==u.redirect)")) {
          c = c.replaceAll("if(void 0!==u.redirect)", "if(u&&void 0!==u.redirect)");
          changed = true;
        }
        if (c.includes("if(void 0!==o.redirect)")) {
          c = c.replaceAll("if(void 0!==o.redirect)", "if(o&&void 0!==o.redirect)");
          changed = true;
        }
        if (changed) {
          fs.writeFileSync(full, c, "utf-8");
          console.log(`[patch] Patched null safe redirect in client chunk ${f}`);
        }
      }
    }
  }
}

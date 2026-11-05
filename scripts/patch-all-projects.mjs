import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DesignValidator } from "../ai-composition-generator/dist/hyperframes/design-validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PROJECTS_DIR = path.resolve(ROOT_DIR, "ai-composition-generator", "generated-projects");

function cleanRepeatedStyles(styleStr, isWrapper) {
  if (!styleStr) return "";
  const parts = styleStr.split(";").map((s) => s.trim()).filter(Boolean);
  const propMap = new Map();
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx !== -1) {
      const key = part.slice(0, colonIdx).trim().toLowerCase();
      const val = part.slice(colonIdx + 1).trim();
      if (isWrapper && (key === "position" || key === "left" || key === "top" || key === "width" || key === "height" || key === "transform" || key === "margin")) {
        continue;
      }
      propMap.set(key, val);
    }
  }
  return Array.from(propMap.entries()).map(([k, v]) => `${k}: ${v}`).join("; ");
}

async function patchProject(projDir) {
  const projName = path.basename(projDir);
  console.log(`\n=== Processing project: ${projName} ===`);

  try {
    // 1. Direct deep-clean on all HTML files to strip repetitive corrupted auto-save style strings
    const files = await fs.readdir(projDir);
    for (const f of files) {
      if (f.endsWith(".html")) {
        const filePath = path.join(projDir, f);
        let content = await fs.readFile(filePath, "utf-8");
        let modified = false;

        // Clean any repeated style declarations across all elements
        if (content.includes('style="') || content.includes("style='")) {
          const original = content;
          content = content.replace(/(<([a-z0-9_-]+)\b[^>]*\bstyle=(["'])([\s\S]*?)\3[^>]*>)/gi, (fullTag, m1, tag, q, styleStr) => {
            const isWrapper = ["section", "body", "html", "main"].includes(tag.toLowerCase()) ||
                              fullTag.includes("scene-background") ||
                              fullTag.includes('id="root"') ||
                              fullTag.includes('id="scenes"') ||
                              fullTag.includes('id="composition"');
            const cleaned = cleanRepeatedStyles(styleStr, isWrapper);
            if (cleaned) {
              return fullTag.replace(`style=${q}${styleStr}${q}`, `style=${q}${cleaned}${q}`);
            } else {
              return fullTag.replace(new RegExp(`\\s*style=${q}${styleStr.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}${q}`), "");
            }
          });
          if (content !== original) {
            modified = true;
          }
        }

        // Clean any stray layout spacers
        if (content.includes("hf-layout-spacer")) {
          content = content.replace(/<div[^>]*class=["'][^"']*hf-layout-spacer[^"']*["'][^>]*><\/div>/gi, "");
          modified = true;
        }

        if (modified) {
          await fs.writeFile(filePath, content, "utf-8");
          console.log(`  [Cleaned styles in ${f}]`);
        }
      }
    }

    // 2. Run DesignValidator.inspectAndRepair
    const result = await DesignValidator.inspectAndRepair(projDir);
    console.log(`  Result: Valid=${result.valid}, RepairedCount=${result.repairedCount}`);
    for (const issue of result.issues) {
      if (issue.type === "repaired") {
        console.log(`   - Repaired: ${issue.code} in ${issue.file || "project"}: ${issue.message}`);
      }
    }
  } catch (err) {
    console.error(`  Error processing ${projName}:`, err);
  }
}

async function main() {
  const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : PROJECTS_DIR;
  console.log(`Scanning projects in: ${targetDir}`);

  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const pPath = path.join(targetDir, entry.name);
      await patchProject(pPath);
    }
  }
  console.log("\nFinished patching all projects!");
}

main().catch(console.error);

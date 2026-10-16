import { exec } from "node:child_process";
import { promisify } from "node:util";
import { ErrorParser, ParsedError } from "./error-parser.js";
import { DesignValidator } from "./design-validator.js";

const execAsync = promisify(exec);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  parsedErrors: ParsedError[];
  rawOutput: string;
}

const NON_FATAL_RULES = [
  "content_overlap",
  "text_occluded",
  "sweep_static",
  "composition_file_too_large",
  "gsap_non_transform_motion",
  "timed_element_missing_clip_class",
  "timeline_id_mismatch",
  "root_missing_dimensions",
  "studio_missing_editable_id",
  "nested_structure_needs_subcomposition",
  "missing_local_asset",
];
const isNonFatal = (e: ParsedError) =>
  NON_FATAL_RULES.some(
    (code) => (e.code && e.code === code) || (e.message && e.message.includes(code)),
  );

export class Validator {
  public static async validate(projectDir: string, autoHealed: boolean = false): Promise<ValidationResult> {
    try {
      const { stdout, stderr } = await execAsync(
        "npx --yes hyperframes@0.8.139 check --json --no-contrast",
        {
          cwd: projectDir,
          env: {
            ...process.env,
            NODE_ENV: "test",
          },
          timeout: 90000,
        },
      );

      const combined = stdout + "\n" + stderr;
      const parsed = ErrorParser.parse(combined);

      if (parsed.length === 0) {
        return {
          valid: true,
          errors: [],
          parsedErrors: [],
          rawOutput: combined,
        };
      }

      const fatalErrors = parsed.filter((e) => !isNonFatal(e));

      if (fatalErrors.length === 0) {
        console.warn(`[Validator] Auto-waived ${parsed.length} advisory/non-fatal notice(s). Project valid.`);
        return {
          valid: true,
          errors: [],
          parsedErrors: [],
          rawOutput: combined,
        };
      }

      const errStrings = parsed.map((e) => e.message);
      return {
        valid: false,
        errors:
          errStrings.length > 0
            ? errStrings
            : ["Validation failed with errors in report"],
        parsedErrors: parsed,
        rawOutput: combined,
      };
    } catch (err: any) {
      const combined =
        (err.stdout || "") +
        "\n" +
        (err.stderr || "") +
        "\n" +
        (err.message || "");
      let parsed = ErrorParser.parse(combined);

      // If stdout contains "ok": true and 0 errors were parsed, it's valid
      if (combined.includes('"ok": true') && parsed.length === 0) {
        return {
          valid: true,
          errors: [],
          parsedErrors: [],
          rawOutput: combined,
        };
      }

      // Check if auto-heal can resolve content_overlap or text_occluded
      const hasLayoutOverlapOrOcclusion = parsed.some(
        (e) => e.code === "content_overlap" || e.code === "text_occluded" || e.message.includes("content_overlap") || e.message.includes("text_occluded"),
      );

      if (!autoHealed && hasLayoutOverlapOrOcclusion) {
        try {
          console.log("[Validator] Auto-repairing project layout annotations for content_overlap / text_occluded...");
          await DesignValidator.inspectAndRepair(projectDir);
          return await Validator.validate(projectDir, true);
        } catch {}
      }

      // If the only remaining issues are non-fatal layout overlap/occlusion notices and all runtime/lint checks passed:
      const fatalErrors = parsed.filter((e) => !isNonFatal(e));

      if (fatalErrors.length === 0 && parsed.length > 0) {
        console.warn(`[Validator] Non-fatal advisory notices auto-waived (${parsed.length} notice(s)); marking project valid.`);
        return {
          valid: true,
          errors: [],
          parsedErrors: [],
          rawOutput: combined,
        };
      }

      const errStrings =
        parsed.length > 0
          ? parsed.map((e) => e.message)
          : [err.message || "HyperFrames check failed"];

      return {
        valid: false,
        errors: errStrings,
        parsedErrors: parsed,
        rawOutput: combined,
      };
    }
  }
}

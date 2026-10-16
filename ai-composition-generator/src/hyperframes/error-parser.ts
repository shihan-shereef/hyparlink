export interface ParsedError {
  type: "lint" | "runtime" | "layout" | "fatal";
  message: string;
  code?: string;
  file?: string;
  line?: number;
}

export class ErrorParser {
  public static parse(output: string): ParsedError[] {
    const errors: ParsedError[] = [];

    // Try parsing as HyperFrames JSON output
    const jsonMatch = output.match(
      /\{[\s\S]*"ok"\s*:\s*(?:true|false)[\s\S]*\}/,
    );
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);
        // Extract findings from sections (excluding subjective contrast)
        for (const section of ["lint", "runtime", "layout", "motion"]) {
          if (json[section] && Array.isArray(json[section].findings)) {
            for (const f of json[section].findings) {
              if (f.severity === "error" || json[section].ok === false) {
                errors.push({
                  type: section as any,
                  message: `${f.code || "error"}: ${f.message}${f.fixHint ? ` (${f.fixHint})` : ""}`,
                  code: f.code,
                  file: f.sourceFile || f.file || f.composition,
                });
              }
            }
          }
        }
      } catch {
        // Fall back to legacy results parsing or regex
      }
    }

    if (errors.length === 0) {
      const legacyMatch = output.match(/\{[\s\S]*"results"[\s\S]*\}/);
      if (legacyMatch) {
        try {
          const json = JSON.parse(legacyMatch[0]);
          if (Array.isArray(json.results)) {
            for (const res of json.results) {
              if (Array.isArray(res.errors)) {
                for (const err of res.errors) {
                  errors.push({
                    type: err.type || "lint",
                    message: err.message || JSON.stringify(err),
                    code: err.code || err.ruleId,
                    file: res.file || res.composition,
                  });
                }
              }
            }
          }
        } catch {}
      }
    }

    // Line-by-line regex parsing for standard hyperframes check output
    const lines = output.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (
        trimmed.includes("error:") ||
        trimmed.includes("[ERROR]") ||
        trimmed.includes("ERR!") ||
        trimmed.includes("Validation failed") ||
        trimmed.includes("gsap_css_transform_conflict") ||
        trimmed.includes("nested_structure_needs_subcomposition") ||
        trimmed.includes("missing_media_id")
      ) {
        errors.push({
          type: "lint",
          message: trimmed,
        });
      }
    }

    return errors;
  }
}

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { ErrorParser, ParsedError } from "./error-parser.js";

const execAsync = promisify(exec);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  parsedErrors: ParsedError[];
  rawOutput: string;
}

export class Validator {
  public static async validate(projectDir: string): Promise<ValidationResult> {
    try {
      const { stdout, stderr } = await execAsync(
        "npx --yes hyperframes@0.8.139 check --json --no-contrast",
        {
          cwd: projectDir,
          env: {
            ...process.env,
            NODE_ENV: "test",
          },
          timeout: 45000,
        },
      );

      const combined = stdout + "\n" + stderr;

      // Check if hyperframes check found errors
      if (
        combined.includes('"status": "failed"') ||
        combined.includes('"status":"failed"')
      ) {
        const parsed = ErrorParser.parse(combined);
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
      }

      return {
        valid: true,
        errors: [],
        parsedErrors: [],
        rawOutput: combined,
      };
    } catch (err: any) {
      const combined =
        (err.stdout || "") +
        "\n" +
        (err.stderr || "") +
        "\n" +
        (err.message || "");
      const parsed = ErrorParser.parse(combined);
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

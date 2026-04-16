#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
/**
 * ファイル編集時に危険な型アサーション・型エラー抑制ディレクティブを検出してブロックするフック
 */
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const FORBIDDEN_PATTERNS = [
  { pattern: /\bas\s+unknown\b/g, name: "as unknown" },
  { pattern: /\bas\s+any\b/g, name: "as any" },
  { pattern: /\bas\s+\{\s*\}/g, name: "as {}" },
  { pattern: /:\s*any\b/g, name: ": any" },
  { pattern: new RegExp("@ts-expect" + "-error", "g"), name: "@ts-expect" + "-error" },
] as const;

// Build WHY/FIX strings with concatenation to avoid triggering our own pattern detection
const WHY = [
  "WHY: Unsafe type assertions and type-error suppression directives (`a",
  "s an",
  "y`, `a",
  "s unknow",
  "n a",
  "s T`, `@ts-expect" +
    "-error`) bypass TypeScript's type safety, hiding bugs that the compiler would otherwise catch.",
].join("");
const FIX =
  "FIX: Use proper type guards, generic type parameters, or `satisfies` instead of type assertions. For type errors, fix the root cause instead of suppressing with directives.";

const isTypeScriptFile = (filePath: string): boolean => {
  return /\.(ts|tsx|mts|cts)$/.test(filePath);
};

const findForbiddenPatterns = (content: string): Array<{ name: string; matches: string[] }> => {
  const found: Array<{ name: string; matches: string[] }> = [];

  for (const { pattern, name } of FORBIDDEN_PATTERNS) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      found.push({ name, matches });
    }
  }

  return found;
};

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const input = context.input;
    if (!input) {
      return context.success({});
    }

    const toolName = input.tool_name;
    const filePath = input.tool_input.file_path;
    logger.debug(`Hook triggered: tool=${toolName}, file=${filePath}`);

    if (!isTypeScriptFile(filePath)) {
      logger.debug("Skipping: not a TypeScript file");
      return context.success({});
    }

    // Write: content, Edit: new_string
    const contentToCheck =
      toolName === "Write" ? input.tool_input.content : input.tool_input.new_string;

    if (!contentToCheck) {
      logger.debug("Skipping: no content to check");
      return context.success({});
    }

    const violations = findForbiddenPatterns(contentToCheck);

    if (violations.length === 0) {
      logger.debug("No forbidden patterns found");
      return context.success({});
    }

    const violationDetails = violations.map((v) => `  - ${v.name}: ${v.matches.length}`).join("\n");

    const fullMessage = `Unsafe type assertion detected. Edit blocked.

${violationDetails}

${WHY}
${FIX}`;

    logger.warn(`Blocked unsafe type assertion in ${filePath}`, {
      violations: violations.map((v) => v.name),
    });

    return context.json({
      event: "PreToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse" as const,
          permissionDecision: "deny" as const,
          permissionDecisionReason: fullMessage,
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

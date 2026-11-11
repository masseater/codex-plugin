#!/usr/bin/env bun
/**
 * Validate a SKILL.md file against the official skill format and this repository's guidelines.
 *
 * Usage: validate.ts <skill-dir>
 *
 * Checks:
 *   - SKILL.md exists and has frontmatter with name and description
 *   - Frontmatter name does not include a plugin prefix
 *   - description (+ when_to_use) fits in the 1,536-character listing budget
 *   - description does not start with the "This skill should be used when" boilerplate
 *   - disable-model-invocation is not set to false (false is the default; omit it)
 *   - Disabled skills do not advertise natural-language triggers
 *   - No unsupported "tools:" field (use allowed-tools)
 *   - No ${CLAUDE_PLUGIN_DIR} (the variable does not exist)
 *   - Body stays under 500 lines
 *   - Body does not use second-person ("You should", "You need")
 *   - Referenced files exist
 *   - Scripts have executable permission
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { pathIn, tryPathIn } from "../../../hooks/lib/path-in.js";

const skillDir = process.argv[2];

if (!skillDir) {
  process.stderr.write("Usage: validate.ts <skill-dir>\n");
  process.exit(1);
}

type Issue = {
  severity: "error" | "warn";
  message: string;
};

const issues: Issue[] = [];
let wordCount = 0;
const scriptsDir = pathIn(skillDir, "scripts");

function error(msg: string) {
  issues.push({ severity: "error", message: msg });
}
function warn(msg: string) {
  issues.push({ severity: "warn", message: msg });
}

const skillMdPath = pathIn(skillDir, "SKILL.md");
if (!existsSync(skillMdPath)) {
  error("SKILL.md not found");
  printResult();
  process.exit(0);
}

const content = readFileSync(skillMdPath, "utf-8");

// Parse frontmatter
const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
if (!fmMatch) {
  error("No YAML frontmatter found (expected --- markers)");
  printResult();
  process.exit(0);
}

const frontmatter = fmMatch[1] ?? "";
const body = content.slice(fmMatch[0].length).trim();

// Check required fields
const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
const descMatch = frontmatter.match(/^description:\s*["']?([\s\S]*?)["']?\s*$/m);
const whenToUseMatch = frontmatter.match(/^when_to_use:\s*["']?([\s\S]*?)["']?\s*$/m);
const disableModelInvocationMatch = frontmatter.match(
  /^disable-model-invocation:\s*(true|false)\s*$/m,
);
const isModelInvocable = disableModelInvocationMatch?.[1] !== "true";

const DESCRIPTION_BUDGET = 1536;

if (!nameMatch) {
  error("Frontmatter missing 'name' field");
} else {
  const name = parseFrontmatterValue(nameMatch[1] ?? "");
  if (name.includes(":")) {
    warn("Frontmatter name should not include a plugin name prefix. Use the skill name only.");
  }
}

if (!descMatch) {
  error("Frontmatter missing 'description' field");
} else {
  const desc = (descMatch[1] ?? "").trim();

  if (desc === "" || desc.startsWith("TODO")) {
    error("Description is a placeholder (TODO). Fill in a real description");
  } else {
    const listingLength = desc.length + (whenToUseMatch?.[1]?.trim().length ?? 0);
    if (listingLength > DESCRIPTION_BUDGET) {
      error(
        `description + when_to_use is ${listingLength} characters; Claude Code truncates it at ${DESCRIPTION_BUDGET}. Put the key use case first and shorten it`,
      );
    }

    if (/^this skill should be used when/i.test(desc)) {
      warn(
        'Description starts with "This skill should be used when". Start with what the skill does, then when to use it',
      );
    }

    const naturalTriggerPattern =
      /\b(this skill should be used when|use when|triggered by|when the user asks|when the user says)\b/i;
    // 日本語の description は `\b` が効かないので、言い回しを別のパターンで検査する
    const japaneseTriggerPattern = /(頼まれたとき|と聞かれたとき|ときに使う|場合に使う)/;
    if (
      !isModelInvocable &&
      (naturalTriggerPattern.test(desc) || japaneseTriggerPattern.test(desc))
    ) {
      warn(
        "Disabled skills are not shown to the model, so natural-language triggers in description have no effect; describe what the skill does instead",
      );
    }
  }
}

if (disableModelInvocationMatch?.[1] === "false") {
  warn("'disable-model-invocation: false' is the default. Omit the field");
}

if (/^tools:/m.test(frontmatter)) {
  error("'tools' is not a skill frontmatter field. Use 'allowed-tools' to pre-approve tools");
}

if (content.includes("${CLAUDE_PLUGIN_DIR}")) {
  error(
    "${CLAUDE_PLUGIN_DIR} does not exist. Use ${CLAUDE_SKILL_DIR} for files in this skill or ../../.. for plugin-level files",
  );
}

// Body checks
const words = body.split(/\s+/).filter((w) => w.length > 0);
wordCount = words.length;
const bodyLines = body.split("\n").length;

if (bodyLines >= 500) {
  warn(
    `Body is ${bodyLines} lines. Keep SKILL.md under 500 lines and move details to reference files`,
  );
}

// Second-person check (skip table rows, inline code, code fences, and quoted examples)
const proseLines = body
  .replace(/```[\s\S]*?```/g, "") // remove code fences
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("|")) // skip table rows
  .map((line) => line.replace(/`[^`]+`/g, "")) // remove inline code
  .map((line) => line.replace(/"[^"]*"/g, "")) // remove double-quoted strings
  .map((line) => line.replace(/\([^)]*\)/g, "")) // remove parenthesized text
  .join("\n");

const secondPersonPatterns = [
  /\bYou should\b/g,
  /\bYou need\b/g,
  /\bYou must\b/g,
  /\bYou can\b/g,
  /\bYou will\b/g,
];
for (const pattern of secondPersonPatterns) {
  const matches = proseLines.match(pattern);
  if (matches && matches.length > 0) {
    warn(
      `Body uses second-person ("${matches[0]}"). Prefer imperative form (e.g., "Run X" instead of "You should run X")`,
    );
    break;
  }
}

// Check referenced files
const fileRefs = body.matchAll(/(?:`|'|")((?:scripts|references|assets)\/[^`'"]+)(?:`|'|")/g);
for (const ref of fileRefs) {
  const refValue = ref[1];
  if (refValue) {
    // SKILL.md に書かれた参照がスキルの外を指す場合も、見つからない参照として報告する
    const refPath = tryPathIn(skillDir, refValue);
    if (refPath === null || !existsSync(refPath)) {
      error(`Referenced file not found: ${refValue}`);
    }
  }
}

// Check scripts have executable permission (Unix only)
if (existsSync(scriptsDir)) {
  try {
    const scripts = readdirSync(scriptsDir);
    for (const script of scripts) {
      if (/\.(test|spec)\.[^.]+$/.test(script)) continue;
      const scriptPath = pathIn(scriptsDir, script);
      const stat = statSync(scriptPath);
      if (stat.isFile()) {
        const mode = stat.mode;
        const isExecutable = (mode & 0o111) !== 0;
        if (!isExecutable) {
          warn(`Script missing executable permission: scripts/${script}`);
        }
      }
    }
  } catch (readError) {
    // 権限チェックは補助的な検査なので、ディレクトリが読めない場合は省いて他の検査結果を返す
    process.stderr.write(`Skipped executable check: ${String(readError)}\n`);
  }
}

printResult();

function printResult() {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");

  const result = {
    valid: errors.length === 0,
    errors: errors.map((e) => e.message),
    warnings: warnings.map((w) => w.message),
    stats: {
      wordCount,
      hasScripts: existsSync(scriptsDir),
      hasReferences: existsSync(pathIn(skillDir ?? "", "references")),
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2));
}

function parseFrontmatterValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

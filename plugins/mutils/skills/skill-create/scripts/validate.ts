#!/usr/bin/env bun
/**
 * Validate a SKILL.md file for quality and completeness.
 *
 * Usage: validate.ts <skill-dir>
 *
 * Checks:
 *   - SKILL.md exists
 *   - Frontmatter has name and description
 *   - Description uses third-person ("This skill should be used when...")
 *   - Description contains trigger phrases (quoted strings)
 *   - Body word count is within recommended range
 *   - Body does not use second-person ("You should", "You need")
 *   - Referenced files exist
 *   - Scripts have executable permission
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

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
const scriptsDir = path.join(skillDir, "scripts");

function error(msg: string) {
  issues.push({ severity: "error", message: msg });
}
function warn(msg: string) {
  issues.push({ severity: "warn", message: msg });
}

const skillMdPath = path.join(skillDir, "SKILL.md");
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

if (!nameMatch) {
  error("Frontmatter missing 'name' field");
}

if (!descMatch) {
  error("Frontmatter missing 'description' field");
} else {
  const desc = (descMatch[1] ?? "").trim();

  if (desc === "" || desc.startsWith("TODO")) {
    error("Description is a placeholder (TODO). Fill in a real description");
  } else {
    // Check third-person
    if (!desc.match(/this skill (should|is|provides|can|helps|manages|enables)/i)) {
      warn('Description should use third-person (e.g., "This skill should be used when...")');
    }

    // Check trigger phrases (single or double quoted strings)
    const doubleQuoted = desc.match(/"[^"]+"/g) ?? [];
    const singleQuoted = desc.match(/'[^']+'/g) ?? [];
    if (doubleQuoted.length + singleQuoted.length < 2) {
      warn(
        "Description should contain at least 2 quoted trigger phrases (e.g., 'create X', 'configure Y')",
      );
    }
  }
}

// Body checks
const words = body.split(/\s+/).filter((w) => w.length > 0);
wordCount = words.length;

if (wordCount < 50) {
  warn(`Body is very short (${wordCount} words). Consider adding more detail`);
} else if (wordCount > 3000) {
  warn(`Body is long (${wordCount} words). Consider moving detailed content to references/`);
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
    const refPath = path.join(skillDir, refValue);
    if (!existsSync(refPath)) {
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
      const scriptPath = path.join(scriptsDir, script);
      const stat = statSync(scriptPath);
      if (stat.isFile()) {
        const mode = stat.mode;
        const isExecutable = (mode & 0o111) !== 0;
        if (!isExecutable) {
          warn(`Script missing executable permission: scripts/${script}`);
        }
      }
    }
  } catch {
    // Skip if we can't read the directory
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
      hasReferences: existsSync(path.join(skillDir ?? "", "references")),
    },
  };

  process.stdout.write(JSON.stringify(result, null, 2));
}

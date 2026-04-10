#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const RELATIVE_PATH = join("docs", "devkit-intentional-violation.md");

function getIntentionalViolationFilePath(rootDir: string): string {
  return join(rootDir, RELATIVE_PATH);
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) {
    return content.trim();
  }

  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return content.trim();
  }

  return content.slice(end + 5).trim();
}

function expandIntentionalViolations(rootDir: string): string | null {
  const path = getIntentionalViolationFilePath(rootDir);
  if (!existsSync(path)) {
    return null;
  }

  const content = stripFrontmatter(readFileSync(path, "utf-8"));
  if (!content) {
    return null;
  }

  return `## Project-Specific Intentional Deviations

Source: \`${RELATIVE_PATH}\`

${content}
`;
}

if (import.meta.main) {
  const targetDir = resolve(process.argv[2] ?? process.cwd());
  const expanded = expandIntentionalViolations(targetDir);
  if (expanded) {
    console.log(expanded);
  }
}

export {
  expandIntentionalViolations,
  getIntentionalViolationFilePath,
  RELATIVE_PATH,
  stripFrontmatter,
};

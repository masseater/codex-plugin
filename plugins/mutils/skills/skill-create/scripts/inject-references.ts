#!/usr/bin/env bun
/**
 * Scan a skill directory and inject a references section into its SKILL.md.
 *
 * Usage: ./inject-references.ts <skill-dir>
 *
 * Scans scripts/, references/, and assets/ directories.
 * Inserts or updates the list between REFERENCES_START and REFERENCES_END markers.
 * If markers are absent, appends them to the end of SKILL.md.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { pathIn } from "../../../hooks/lib/path-in.js";

const skillDirArg = process.argv[2];

if (!skillDirArg) {
  process.stderr.write("Usage: ./inject-references.ts <skill-dir>\n");
  process.exit(1);
}

const skillDir: string = skillDirArg;
const skillMdPath = pathIn(skillDir, "SKILL.md");
if (!existsSync(skillMdPath)) {
  process.stderr.write(`Error: SKILL.md not found in ${skillDir}\n`);
  process.exit(1);
}

type FileEntry = {
  category: string;
  relativePath: string;
  description: string;
};

function frontmatterOf(content: string): string | undefined {
  return /^---\n([\s\S]*?)\n---/.exec(content)?.[1];
}

function descriptionLine(frontmatter: string): string | undefined {
  return /^description:\s*["']?(.*?)["']?\s*$/m.exec(frontmatter)?.[1]?.trim();
}

/** Extract YAML frontmatter description from a markdown file. */
function extractFrontmatterDescription(content: string): string | null {
  const frontmatter = frontmatterOf(content);
  if (frontmatter === undefined) return null;
  return descriptionLine(frontmatter) || null;
}

const SCRIPT_DESCRIPTION_PATTERNS = [/\/\*\*\s*\n\s*\*\s*(.+)/, /^#\s+(.+)$/m];

/** Extract description from a script file (JSDoc or first comment). */
function extractScriptDescription(content: string): string {
  return (
    SCRIPT_DESCRIPTION_PATTERNS.map((pattern) => pattern.exec(content)?.[1]?.trim()).find(
      Boolean,
    ) ?? ""
  );
}

/**
 * Read a resource file. An unreadable file has no description, which is not fatal.
 */
function readResource(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (error) {
    // 読めないファイルは説明なしで一覧に載せる。一覧の生成は続けられるため、原因だけ stderr に残す
    process.stderr.write(`Skipped description of ${filePath}: ${String(error)}\n`);
    return undefined;
  }
}

/** references/*.md must have a frontmatter description; exit with an error otherwise. */
function requiredReferenceDescription(content: string, relativePath: string): string {
  const desc = extractFrontmatterDescription(content);
  if (!desc) {
    process.stderr.write(
      `Error: ${relativePath} is missing YAML frontmatter 'description' field.\n` +
        "References must have frontmatter with a description. Example:\n" +
        "---\n" +
        "description: Short summary of what this reference covers\n" +
        "---\n",
    );
    process.exit(1);
  }
  return desc;
}

/**
 * Extract a description from a file.
 * - references/*.md: YAML frontmatter `description` is REQUIRED (error if missing)
 * - scripts/*: JSDoc / heading / first line (best-effort)
 * - assets/*: best-effort
 */
function extractDescription(filePath: string, relativePath: string, category: string): string {
  const content = readResource(filePath);
  if (content === undefined) return "";
  if (category === "References" && filePath.endsWith(".md")) {
    return requiredReferenceDescription(content, relativePath);
  }
  return extractScriptDescription(content);
}

/** Test file patterns to exclude from scripts/ scanning */
const TEST_PATTERNS = [/\.test\.[cm]?[jt]sx?$/, /\.spec\.[cm]?[jt]sx?$/];

function isTestFile(filename: string): boolean {
  return TEST_PATTERNS.some((p) => p.test(filename));
}

function listDirectory(dirPath: string): string[] {
  try {
    return readdirSync(dirPath).toSorted();
  } catch (error) {
    // 読めないディレクトリは同梱リソースなしとして扱い、他のディレクトリの一覧は作る。原因だけ stderr に残す
    process.stderr.write(`Skipped unreadable directory ${dirPath}: ${String(error)}\n`);
    return [];
  }
}

function isRegularFile(filePath: string): boolean {
  return statSync(filePath, { throwIfNoEntry: false })?.isFile() === true;
}

function scanDirectory(dirName: string, category: string): FileEntry[] {
  const dirPath = pathIn(skillDir, dirName);
  if (!existsSync(dirPath)) return [];

  return listDirectory(dirPath)
    .filter((file) => !isTestFile(file) && isRegularFile(pathIn(dirPath, file)))
    .map((file) => {
      const relPath = `${dirName}/${file}`;
      return {
        category,
        relativePath: relPath,
        description: extractDescription(pathIn(dirPath, file), relPath, category),
      };
    });
}

// Scan all resource directories
const allEntries = [
  ...scanDirectory("scripts", "Scripts"),
  ...scanDirectory("references", "References"),
  ...scanDirectory("assets", "Assets"),
];

function groupByCategory(entries: FileEntry[]): Map<string, FileEntry[]> {
  const grouped = new Map<string, FileEntry[]>();
  for (const entry of entries) {
    grouped.set(entry.category, [...(grouped.get(entry.category) ?? []), entry]);
  }
  return grouped;
}

function entryLine(item: FileEntry): string {
  const desc = item.description ? ` — ${item.description}` : "";
  return `- \`${item.relativePath}\`${desc}`;
}

// Generate markdown
function generateMarkdown(entries: FileEntry[]): string {
  if (entries.length === 0) return "(No bundled resources found)";
  const lines: string[] = [];
  for (const [category, items] of groupByCategory(entries)) {
    lines.push(`### ${category}\n`, ...items.map(entryLine), "");
  }
  return lines.join("\n").trimEnd();
}

const markdown = generateMarkdown(allEntries);

// Read and update SKILL.md
let content = readFileSync(skillMdPath, "utf-8");

const START_MARKER =
  "<!-- REFERENCES_START — AUTO-GENERATED by inject-references.ts — DO NOT EDIT MANUALLY -->";
const END_MARKER = "<!-- REFERENCES_END -->";
const fullSection = `${START_MARKER}\n${markdown}\n${END_MARKER}`;

const startIndex = content.indexOf(START_MARKER);
const endIndex = startIndex === -1 ? -1 : content.indexOf(END_MARKER, startIndex);
if (endIndex === -1) {
  // Append new section
  content = `${content.trimEnd()}\n\n## Bundled Resources\n\n${fullSection}\n`;
} else {
  // Update existing markers
  content =
    content.slice(0, startIndex) + fullSection + content.slice(endIndex + END_MARKER.length);
}

await Bun.write(skillMdPath, content);

// Output result
const result = {
  updated: skillMdPath,
  entries: allEntries.length,
  categories: [...new Set(allEntries.map((e) => e.category))],
};
process.stdout.write(JSON.stringify(result, null, 2));

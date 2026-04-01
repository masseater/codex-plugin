import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { GrepMatch } from "./types.ts";

const DEFAULT_EXCLUDE_DIRS = [
  "node_modules",
  "dist",
  "build",
  ".next",
  "out",
  ".output",
  "coverage",
];

function isExcluded(filePath: string, excludeDirs: string[], excludePatterns: string[]): boolean {
  // Check directory exclusions
  for (const dir of excludeDirs) {
    if (filePath.startsWith(`${dir}/`) || filePath.includes(`/${dir}/`)) {
      return true;
    }
  }
  // Check file pattern exclusions (e.g., "**/env.ts", "*.config.*")
  for (const pat of excludePatterns) {
    const name = pat.replace(/^\*\*\//, "");
    if (name.includes("*")) {
      // Simple wildcard matching for patterns like "*.config.*"
      const regex = new RegExp(`^${name.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`);
      const basename = filePath.split("/").pop() ?? "";
      if (regex.test(basename)) return true;
    } else {
      // Exact filename match at any depth
      if (filePath.endsWith(`/${name}`) || filePath === name) return true;
    }
  }
  return false;
}

// Split glob with path prefix into searchDir + fileGlob
function splitGlobPath(glob: string): { searchDir: string; fileGlob: string } {
  const parts = glob.split("/**/");
  if (parts.length === 2 && !parts[0]!.includes("*")) {
    return { searchDir: parts[0]!, fileGlob: `**/${parts[1]!}` };
  }
  return { searchDir: ".", fileGlob: glob };
}

async function tryRipgrep(
  rootDir: string,
  pattern: string,
  glob: string,
  excludePatterns: string[],
): Promise<GrepMatch[] | null> {
  const { searchDir, fileGlob } = splitGlobPath(glob);
  const searchPath = searchDir === "." ? rootDir : join(rootDir, searchDir);
  const args = ["rg", "--json", "--glob", fileGlob];
  for (const dir of DEFAULT_EXCLUDE_DIRS) {
    args.push("--glob", `!**/${dir}/**`);
  }
  for (const pat of excludePatterns) {
    args.push("--glob", `!${pat}`);
  }
  args.push("--", pattern, searchPath);

  try {
    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    // rg exit code 1 = no matches, 2 = error
    if (exitCode > 1) return null;

    const matches: GrepMatch[] = [];
    for (const line of output.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "match") {
          const data = parsed.data;
          // Always resolve relative to the original rootDir
          matches.push({
            file: relative(rootDir, data.path.text),
            line: data.line_number,
            content: data.lines.text.trimEnd(),
          });
        }
      } catch {
        // Skip non-JSON lines
      }
    }
    return matches;
  } catch {
    return null;
  }
}

function jsFallbackGrep(
  rootDir: string,
  pattern: string,
  globPattern: string,
  excludePatterns: string[],
): GrepMatch[] {
  const regex = new RegExp(pattern);
  const matches: GrepMatch[] = [];

  const glob = new Bun.Glob(globPattern);
  for (const file of glob.scanSync({ cwd: rootDir, absolute: false })) {
    if (isExcluded(file, DEFAULT_EXCLUDE_DIRS, excludePatterns)) continue;

    try {
      const content = readFileSync(join(rootDir, file), "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i]!)) {
          matches.push({ file, line: i + 1, content: lines[i]! });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }
  return matches;
}

async function grepProject(
  rootDir: string,
  pattern: string,
  glob: string,
  exclude: string[] = [],
): Promise<GrepMatch[]> {
  const rgResult = await tryRipgrep(rootDir, pattern, glob, exclude);
  if (rgResult !== null) return rgResult;
  return jsFallbackGrep(rootDir, pattern, glob, exclude);
}

export { grepProject };

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

/**
 * ファイルパスが除外ディレクトリ配下にあるかどうかを判定する。
 * standards-audit の各 check（grep / test-structure 等）が共有する単一ソース。
 * @param filePath 判定対象のファイルパス（プロジェクトルートからの相対パス）
 * @param excludeDirs 除外ディレクトリ名の配列
 * @returns 除外ディレクトリ配下なら true
 */
function isInExcludedDir(filePath: string, excludeDirs: string[]): boolean {
  for (const dir of excludeDirs) {
    if (filePath.startsWith(`${dir}/`) || filePath.includes(`/${dir}/`)) {
      return true;
    }
  }
  return false;
}

function hasAffixes(text: string, prefix: string, suffix: string): boolean {
  return (
    text.length >= prefix.length + suffix.length && text.startsWith(prefix) && text.endsWith(suffix)
  );
}

function partsInOrder(text: string, parts: string[]): boolean {
  let position = 0;
  for (const part of parts) {
    const index = text.indexOf(part, position);
    if (index === -1) return false;
    position = index + part.length;
  }
  return true;
}

/**
 * `*` だけを含むワイルドカード（`*.config.*` など）にファイル名が一致するかを判定する
 * @param text ファイル名
 * @param pattern `*` を 1 つ以上含むパターン
 * @returns 一致すれば true
 */
function matchesWildcard(text: string, pattern: string): boolean {
  const parts = pattern.split("*");
  const prefix = parts[0] ?? "";
  const suffix = parts.at(-1) ?? "";
  if (!hasAffixes(text, prefix, suffix)) return false;
  return partsInOrder(text.slice(prefix.length, text.length - suffix.length), parts.slice(1, -1));
}

function basenameOf(filePath: string): string {
  return filePath.split("/").pop() ?? "";
}

// Check file pattern exclusions (e.g., "**/env.ts", "*.config.*")
function matchesExcludePattern(filePath: string, pattern: string): boolean {
  const name = pattern.replace(/^\*\*\//, "");
  // Simple wildcard matching for patterns like "*.config.*"
  if (name.includes("*")) return matchesWildcard(basenameOf(filePath), name);
  // Exact filename match at any depth
  return filePath.endsWith(`/${name}`) || filePath === name;
}

function isExcluded(filePath: string, excludeDirs: string[], excludePatterns: string[]): boolean {
  return (
    isInExcludedDir(filePath, excludeDirs) ||
    excludePatterns.some((pattern) => matchesExcludePattern(filePath, pattern))
  );
}

// Split glob with path prefix into searchDir + fileGlob
function splitGlobPath(glob: string): { searchDir: string; fileGlob: string } {
  const parts = glob.split("/**/");
  if (parts.length === 2 && !parts[0]!.includes("*")) {
    return { searchDir: parts[0]!, fileGlob: `**/${parts[1]!}` };
  }
  return { searchDir: ".", fileGlob: glob };
}

function ripgrepArgs(
  rootDir: string,
  pattern: string,
  glob: string,
  excludePatterns: string[],
): string[] {
  const { searchDir, fileGlob } = splitGlobPath(glob);
  const searchPath = searchDir === "." ? rootDir : join(rootDir, searchDir);
  return [
    "rg",
    "--json",
    "--glob",
    fileGlob,
    ...DEFAULT_EXCLUDE_DIRS.flatMap((dir) => ["--glob", `!**/${dir}/**`]),
    ...excludePatterns.flatMap((pat) => ["--glob", `!${pat}`]),
    "--",
    pattern,
    searchPath,
  ];
}

/**
 * rg --json の 1 行を JSON として読む
 * @param line rg の出力の 1 行
 * @returns 読んだ値。空行や JSON でない行は null
 */
function parseJsonLine(line: string): { type?: string; data?: RipgrepMatchData } | null {
  if (!line.trim()) return null;
  try {
    return JSON.parse(line);
  } catch (error) {
    // rg の JSON 以外の出力行は一致の情報を持たないので読み飛ばす
    if (process.env.DEBUG) console.error("[debug] skipped non-JSON rg output:", error);
    return null;
  }
}

type RipgrepMatchData = {
  path: { text: string };
  line_number: number;
  lines: { text: string };
};

/**
 * rg --json の 1 行から一致を取り出す
 * @param line rg の出力の 1 行
 * @param rootDir 相対パスの基準（元の rootDir）
 * @returns 一致。match 以外の行は空
 */
function parseRipgrepLine(line: string, rootDir: string): GrepMatch[] {
  const parsed = parseJsonLine(line);
  if (parsed?.type !== "match" || !parsed.data) return [];
  const data = parsed.data;
  // Always resolve relative to the original rootDir
  return [
    {
      file: relative(rootDir, data.path.text),
      line: data.line_number,
      content: data.lines.text.trimEnd(),
    },
  ];
}

async function tryRipgrep(
  rootDir: string,
  pattern: string,
  glob: string,
  excludePatterns: string[],
): Promise<GrepMatch[] | null> {
  try {
    const proc = Bun.spawn(ripgrepArgs(rootDir, pattern, glob, excludePatterns), {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    // rg exit code 1 = no matches, 2 = error
    if ((await proc.exited) > 1) return null;
    return output.split("\n").flatMap((line) => parseRipgrepLine(line, rootDir));
  } catch (error) {
    // rg が無い環境では null を返し、呼び出し側が JS 実装の grep に切り替える
    if (process.env.DEBUG) console.error("[debug] ripgrep unavailable:", error);
    return null;
  }
}

function matchingLines(file: string, content: string, regex: RegExp): GrepMatch[] {
  return content
    .split("\n")
    .flatMap((line, index) => (regex.test(line) ? [{ file, line: index + 1, content: line }] : []));
}

function readMatches(rootDir: string, file: string, regex: RegExp): GrepMatch[] {
  try {
    return matchingLines(file, readFileSync(join(rootDir, file), "utf-8"), regex);
  } catch (error) {
    // 読めないファイルは検査対象から外し、残りのファイルの検査を続ける
    if (process.env.DEBUG) console.error(`[debug] skipped unreadable file ${file}:`, error);
    return [];
  }
}

function jsFallbackGrep(
  rootDir: string,
  pattern: string,
  globPattern: string,
  excludePatterns: string[],
): GrepMatch[] {
  const regex = new RegExp(pattern);
  return [...new Bun.Glob(globPattern).scanSync({ cwd: rootDir, absolute: false })]
    .filter((file) => !isExcluded(file, DEFAULT_EXCLUDE_DIRS, excludePatterns))
    .flatMap((file) => readMatches(rootDir, file, regex));
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

export { DEFAULT_EXCLUDE_DIRS, grepProject, isInExcludedDir };

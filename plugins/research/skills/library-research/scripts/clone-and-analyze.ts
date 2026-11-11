#!/usr/bin/env bun
/**
 * リポジトリを shallow clone し、構造化データを analysis.json に出力
 */

import { existsSync, rmSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Glob } from "bun";
import { defineCommand, runMain } from "citty";
import { simpleGit } from "simple-git";
import { resolveKnowledgeDir } from "./lib/resolve-knowledge-dir.js";
import { isRecord } from "./lib/type-guards.js";

const MAX_EXAMPLE_FILES = 10;
const MAX_FILE_SIZE = 10_000;
const MAX_CHANGELOG_VERSIONS = 3;
const VERSION_HEADER_RE = /^#{1,2}\s+(?:\[?\d+\.\d+|v\d+)/;

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

type ManifestInfo = {
  type: "package.json" | "pyproject.toml" | "Cargo.toml" | "go.mod";
  name?: string | undefined;
  version?: string | undefined;
  description?: string | undefined;
};

type AnalysisResult = {
  repository: {
    url: string;
    owner: string;
    repo: string;
    defaultBranch: string;
  };
  readme: string | null;
  packageJson: Record<string, unknown> | null;
  manifest: ManifestInfo | null;
  structure: {
    hasExamples: boolean;
    hasTests: boolean;
    hasSrc: boolean;
    testFramework: string | null;
    topLevelDirs: string[];
  };
  typescript: {
    hasTypes: boolean;
    tsconfig: Record<string, unknown> | null;
  };
  ci: {
    provider: string | null;
    workflows: string[];
  };
  changelog: string | null;
  examples: { path: string; content: string }[];
  license: string | null;
};

async function readFileOrNull(path: string): Promise<string | null> {
  const file = Bun.file(path);
  if (await file.exists()) {
    return file.text();
  }
  return null;
}

async function findReadme(dir: string): Promise<string | null> {
  for (const name of ["README.md", "readme.md", "Readme.md", "README"]) {
    const content = await readFileOrNull(join(dir, name));
    if (content !== null) return content;
  }
  return null;
}

async function readJsonOrNull(path: string): Promise<Record<string, unknown> | null> {
  const content = await readFileOrNull(path);
  if (content === null) return null;
  try {
    const parsed: unknown = JSON.parse(content);
    return isRecord(parsed) ? parsed : null;
  } catch (error) {
    // 解析対象リポジトリの JSON が壊れていても、その項目を「情報なし」として解析を続けてよい
    console.error(`warn: ${path} を JSON として読めないので無視する:`, error);
    return null;
  }
}

const TEST_FRAMEWORKS = ["vitest", "jest", "mocha", "ava", "tap", "uvu"];

function dependencyMap(value: unknown): Record<string, string> {
  return isStringRecord(value) ? value : {};
}

function detectTestFramework(packageJson: Record<string, unknown> | null): string | null {
  if (!packageJson) return null;
  const deps = {
    ...dependencyMap(packageJson.devDependencies),
    ...dependencyMap(packageJson.dependencies),
  };
  return TEST_FRAMEWORKS.find((framework) => deps[framework]) ?? null;
}

async function listDirNames(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const items = await readdir(dir, { withFileTypes: true });
  return items.filter((d) => d.isDirectory()).map((d) => d.name);
}

async function collectExamples(
  dir: string,
  maxFiles: number = MAX_EXAMPLE_FILES,
  maxFileSize: number = MAX_FILE_SIZE,
): Promise<{ path: string; content: string }[]> {
  const examplesDir = join(dir, "examples");
  if (!existsSync(examplesDir)) return [];

  const paths = await Array.fromAsync(
    new Glob("**/*.{ts,tsx,js,jsx,mjs}").scan({ cwd: examplesDir }),
  );
  const selected = paths
    .filter((filePath) => Bun.file(join(examplesDir, filePath)).size <= maxFileSize)
    .slice(0, maxFiles);
  return Promise.all(
    selected.map(async (filePath) => ({
      path: `examples/${filePath}`,
      content: await Bun.file(join(examplesDir, filePath)).text(),
    })),
  );
}

async function collectWorkflows(dir: string): Promise<string[]> {
  const workflowsDir = join(dir, ".github", "workflows");
  if (!existsSync(workflowsDir)) return [];
  const glob = new Glob("*.{yml,yaml}");
  return Array.fromAsync(glob.scan({ cwd: workflowsDir }));
}

/**
 * CHANGELOG の最初のバージョン見出しから、maxVersions 個分のバージョンの行を取り出す
 * @param lines CHANGELOG の行
 * @param maxVersions 取り出すバージョンの数
 * @returns 取り出した行。バージョン見出しが無ければ空
 */
function changelogLines(lines: string[], maxVersions: number): string[] {
  const headerIndexes = lines.flatMap((line, index) =>
    VERSION_HEADER_RE.test(line) ? [index] : [],
  );
  const [start] = headerIndexes;
  if (start === undefined) return [];
  return lines.slice(start, headerIndexes[maxVersions] ?? lines.length);
}

function extractChangelog(
  content: string,
  maxVersions: number = MAX_CHANGELOG_VERSIONS,
): string | null {
  const result = changelogLines(content.split("\n"), maxVersions);
  return result.length > 0 ? result.join("\n").trim() : null;
}

// --- Manifest detection ---

const TOML_FIELD_PATTERNS = {
  name: /^name\s*=\s*"([^"]+)"/m,
  version: /^version\s*=\s*"([^"]+)"/m,
  description: /^description\s*=\s*"([^"]+)"/m,
} as const;

function firstGroup(content: string, pattern: RegExp): string | undefined {
  return content.match(pattern)?.[1];
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function packageJsonManifest(packageJson: Record<string, unknown>): ManifestInfo {
  return {
    type: "package.json",
    name: stringOrUndefined(packageJson.name),
    version: stringOrUndefined(packageJson.version),
    description: stringOrUndefined(packageJson.description),
  };
}

function tomlManifest(type: "pyproject.toml" | "Cargo.toml", content: string): ManifestInfo {
  return {
    type,
    name: firstGroup(content, TOML_FIELD_PATTERNS.name),
    version: firstGroup(content, TOML_FIELD_PATTERNS.version),
    description: firstGroup(content, TOML_FIELD_PATTERNS.description),
  };
}

function goManifest(content: string): ManifestInfo {
  return {
    type: "go.mod",
    name: firstGroup(content, /^module\s+(\S+)/m),
    version: firstGroup(content, /^go\s+(\S+)/m),
  };
}

// package.json が無いときに探すマニフェストと、その読み方（前から順に探す）
const MANIFEST_READERS: [string, (content: string) => ManifestInfo][] = [
  ["pyproject.toml", (content) => tomlManifest("pyproject.toml", content)],
  ["Cargo.toml", (content) => tomlManifest("Cargo.toml", content)],
  ["go.mod", goManifest],
];

async function detectManifest(
  dir: string,
  packageJson: Record<string, unknown> | null,
): Promise<ManifestInfo | null> {
  if (packageJson) return packageJsonManifest(packageJson);
  for (const [fileName, toManifest] of MANIFEST_READERS) {
    const content = await readFileOrNull(join(dir, fileName));
    if (content) return toManifest(content);
  }
  return null;
}

function parseRepoArg(repoArg: string): { owner: string; repo: string } {
  const [owner, repo] = repoArg.split("/");
  if (!owner || !repo) {
    throw new Error("--repo は owner/repo 形式で指定してください");
  }
  return { owner, repo };
}

async function readChangelog(dir: string): Promise<string | null> {
  const content = await readFileOrNull(join(dir, "CHANGELOG.md"));
  return content ? extractChangelog(content) : null;
}

// LICENSE の最初の空でない行（ライセンス名）
async function readLicense(dir: string): Promise<string | null> {
  const content = await readFileOrNull(join(dir, "LICENSE"));
  return (
    content
      ?.split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ?? null
  );
}

const TEST_DIRS = ["tests", "test", "__tests__"];

function declaresTypes(packageJson: Record<string, unknown> | null): boolean {
  return (
    packageJson !== null && (packageJson.types !== undefined || packageJson.typings !== undefined)
  );
}

type CloneDirs = { owner: string; repo: string; tmpDir: string; pkgDir: string };

/**
 * clone したリポジトリから構造化データを集める
 * @param dirs リポジトリの owner / repo と、clone 先・解析するパッケージのディレクトリ
 * @returns 解析結果
 */
async function analyzeClone(dirs: CloneDirs): Promise<AnalysisResult> {
  const { owner, repo, tmpDir, pkgDir } = dirs;
  const defaultBranch = (await simpleGit(tmpDir).branch()).current;

  const [readme, packageJson, tsconfig, changelog, examples, workflows, topLevelDirs, license] =
    await Promise.all([
      findReadme(pkgDir),
      readJsonOrNull(join(pkgDir, "package.json")),
      readJsonOrNull(join(pkgDir, "tsconfig.json")),
      readChangelog(pkgDir),
      collectExamples(pkgDir),
      collectWorkflows(tmpDir),
      listDirNames(pkgDir),
      readLicense(tmpDir),
    ]);

  return {
    repository: {
      url: `https://github.com/${owner}/${repo}`,
      owner,
      repo,
      defaultBranch,
    },
    readme,
    packageJson,
    manifest: await detectManifest(pkgDir, packageJson),
    structure: {
      hasExamples: existsSync(join(pkgDir, "examples")),
      hasTests: TEST_DIRS.some((name) => existsSync(join(pkgDir, name))),
      hasSrc: existsSync(join(pkgDir, "src")),
      testFramework: detectTestFramework(packageJson),
      topLevelDirs: topLevelDirs.filter((d) => !d.startsWith(".")),
    },
    typescript: {
      hasTypes: tsconfig !== null || declaresTypes(packageJson),
      tsconfig,
    },
    ci: {
      provider: workflows.length > 0 ? "github-actions" : null,
      workflows,
    },
    changelog,
    examples,
    license,
  };
}

/**
 * shallow clone し、--package を指定したならそのディレクトリがあるかを確かめる
 * @param repoUrl clone する URL
 * @param dirs clone 先と解析するパッケージのディレクトリ
 * @param packagePath --package の値
 */
async function cloneRepo(repoUrl: string, dirs: CloneDirs, packagePath: string | undefined) {
  await simpleGit().clone(repoUrl, dirs.tmpDir, ["--depth", "1"]);
  if (packagePath && !existsSync(dirs.pkgDir)) {
    throw new Error(`Package directory not found: ${packagePath} (in ${dirs.tmpDir})`);
  }
}

function cloneSummary(
  result: AnalysisResult,
  repoUrl: string,
  outDir: string,
  packagePath: string | undefined,
): Record<string, unknown> {
  return {
    success: true,
    clonedFrom: repoUrl,
    outputDir: outDir,
    package: packagePath ?? null,
    manifest: result.manifest?.type ?? null,
    readme: result.readme !== null,
    packageJson: result.packageJson !== null,
    examples: result.examples.length,
    workflows: result.ci.workflows.length,
    testFramework: result.structure.testFramework,
    hasTypes: result.typescript.hasTypes,
  };
}

/**
 * --cleanup なら clone を消し、そうでなければ残した場所を知らせる
 * @param tmpDir clone 先
 * @param cleanup --cleanup の値
 */
function finishClone(tmpDir: string, cleanup: boolean): void {
  if (!cleanup) {
    console.error(`Clone preserved at: ${tmpDir}`);
    return;
  }
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
}

const main = defineCommand({
  meta: {
    name: "clone-and-analyze",
    description: "リポジトリを clone して構造化データを analysis.json に出力",
  },
  args: {
    repo: {
      type: "string",
      description: "GitHub リポジトリ（owner/repo 形式）",
      required: true,
    },
    name: {
      type: "string",
      description: "ライブラリ名（ナレッジディレクトリの解決に使用）",
      required: true,
    },
    user: {
      type: "boolean",
      description: "ユーザーレベル (~/.claude/) に保存",
      default: false,
    },
    cleanup: {
      type: "boolean",
      description: "clone 後にリポジトリを削除するか",
      default: false,
    },
    package: {
      type: "string",
      description: "モノレポ内のパッケージパス（例: packages/rest）",
    },
  },
  async run({ args }) {
    const { owner, repo } = parseRepoArg(args.repo);
    const repoUrl = `https://github.com/${owner}/${repo}.git`;
    const tmpDir = join(tmpdir(), `library-research-${repo}-${Date.now()}`);
    const outDir = resolveKnowledgeDir(args.name, args.user);

    // モノレポ対応: --package が指定された場合、パッケージディレクトリを基準にする
    const pkgDir = args.package ? join(tmpDir, args.package) : tmpDir;
    const dirs: CloneDirs = { owner, repo, tmpDir, pkgDir };

    try {
      await cloneRepo(repoUrl, dirs, args.package);
      const result = await analyzeClone(dirs);
      await Bun.write(join(outDir, "analysis.json"), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(cloneSummary(result, repoUrl, outDir, args.package)));
    } finally {
      finishClone(tmpDir, args.cleanup);
    }
  },
});

await runMain(main);

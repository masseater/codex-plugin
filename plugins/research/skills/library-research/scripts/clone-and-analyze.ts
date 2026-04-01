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

const MAX_EXAMPLE_FILES = 10;
const MAX_FILE_SIZE = 10_000;
const MAX_CHANGELOG_VERSIONS = 3;
const VERSION_HEADER_RE = /^#{1,2}\s+(?:\[?\d+\.\d+|v\d+)/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
  } catch {
    return null;
  }
}

function detectTestFramework(packageJson: Record<string, unknown> | null): string | null {
  if (!packageJson) return null;
  const devDeps = isStringRecord(packageJson.devDependencies) ? packageJson.devDependencies : {};
  const prodDeps = isStringRecord(packageJson.dependencies) ? packageJson.dependencies : {};
  const deps = { ...devDeps, ...prodDeps };
  if (deps.vitest) return "vitest";
  if (deps.jest) return "jest";
  if (deps.mocha) return "mocha";
  if (deps.ava) return "ava";
  if (deps.tap) return "tap";
  if (deps.uvu) return "uvu";
  return null;
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

  const results: { path: string; content: string }[] = [];
  const glob = new Glob("**/*.{ts,tsx,js,jsx,mjs}");
  let count = 0;

  for await (const filePath of glob.scan({ cwd: examplesDir })) {
    if (count >= maxFiles) break;
    const fullPath = join(examplesDir, filePath);
    const file = Bun.file(fullPath);
    if (file.size > maxFileSize) continue;
    const content = await file.text();
    results.push({ path: `examples/${filePath}`, content });
    count++;
  }

  return results;
}

async function collectWorkflows(dir: string): Promise<string[]> {
  const workflowsDir = join(dir, ".github", "workflows");
  if (!existsSync(workflowsDir)) return [];
  const glob = new Glob("*.{yml,yaml}");
  return Array.fromAsync(glob.scan({ cwd: workflowsDir }));
}

function extractChangelog(
  content: string,
  maxVersions: number = MAX_CHANGELOG_VERSIONS,
): string | null {
  const lines = content.split("\n");
  const result: string[] = [];
  let versionCount = 0;

  for (const line of lines) {
    if (VERSION_HEADER_RE.test(line)) {
      versionCount++;
      if (versionCount > maxVersions) break;
    }
    if (versionCount > 0) {
      result.push(line);
    }
  }

  return result.length > 0 ? result.join("\n").trim() : null;
}

// --- Manifest detection ---

function extractTomlField(content: string, field: string): string | undefined {
  const re = new RegExp(`^${field}\\s*=\\s*"([^"]+)"`, "m");
  return content.match(re)?.[1];
}

async function detectManifest(
  dir: string,
  packageJson: Record<string, unknown> | null,
): Promise<ManifestInfo | null> {
  if (packageJson) {
    return {
      type: "package.json",
      name: typeof packageJson.name === "string" ? packageJson.name : undefined,
      version: typeof packageJson.version === "string" ? packageJson.version : undefined,
      description:
        typeof packageJson.description === "string" ? packageJson.description : undefined,
    };
  }

  // pyproject.toml
  const pyproject = await readFileOrNull(join(dir, "pyproject.toml"));
  if (pyproject) {
    return {
      type: "pyproject.toml",
      name: extractTomlField(pyproject, "name"),
      version: extractTomlField(pyproject, "version"),
      description: extractTomlField(pyproject, "description"),
    };
  }

  // Cargo.toml
  const cargo = await readFileOrNull(join(dir, "Cargo.toml"));
  if (cargo) {
    return {
      type: "Cargo.toml",
      name: extractTomlField(cargo, "name"),
      version: extractTomlField(cargo, "version"),
      description: extractTomlField(cargo, "description"),
    };
  }

  // go.mod
  const gomod = await readFileOrNull(join(dir, "go.mod"));
  if (gomod) {
    const moduleName = gomod.match(/^module\s+(\S+)/m)?.[1];
    const goVersion = gomod.match(/^go\s+(\S+)/m)?.[1];
    return {
      type: "go.mod",
      name: moduleName,
      version: goVersion,
    };
  }

  return null;
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
    const [owner, repo] = args.repo.split("/");
    if (!owner || !repo) {
      throw new Error("--repo は owner/repo 形式で指定してください");
    }

    const repoUrl = `https://github.com/${owner}/${repo}.git`;
    const tmpDir = join(tmpdir(), `library-research-${repo}-${Date.now()}`);
    const outDir = resolveKnowledgeDir(args.name, args.user);

    // モノレポ対応: --package が指定された場合、パッケージディレクトリを基準にする
    const pkgDir = args.package ? join(tmpDir, args.package) : tmpDir;

    try {
      const git = simpleGit();
      await git.clone(repoUrl, tmpDir, ["--depth", "1"]);

      if (args.package && !existsSync(pkgDir)) {
        throw new Error(`Package directory not found: ${args.package} (in ${tmpDir})`);
      }

      const localGit = simpleGit(tmpDir);
      const branchInfo = await localGit.branch();
      const defaultBranch = branchInfo.current;

      const [readme, packageJson, tsconfig, changelog, examples, workflows, topLevelDirs, license] =
        await Promise.all([
          findReadme(pkgDir),
          readJsonOrNull(join(pkgDir, "package.json")),
          readJsonOrNull(join(pkgDir, "tsconfig.json")),
          readFileOrNull(join(pkgDir, "CHANGELOG.md")).then((c) =>
            c ? extractChangelog(c) : null,
          ),
          collectExamples(pkgDir),
          collectWorkflows(tmpDir),
          listDirNames(pkgDir),
          readFileOrNull(join(tmpDir, "LICENSE")).then(
            (c) =>
              c
                ?.split("\n")
                .find((l) => l.trim().length > 0)
                ?.trim() ?? null,
          ),
        ]);

      const manifest = await detectManifest(pkgDir, packageJson);

      const result: AnalysisResult = {
        repository: {
          url: `https://github.com/${owner}/${repo}`,
          owner,
          repo,
          defaultBranch,
        },
        readme,
        packageJson,
        manifest,
        structure: {
          hasExamples: existsSync(join(pkgDir, "examples")),
          hasTests:
            existsSync(join(pkgDir, "tests")) ||
            existsSync(join(pkgDir, "test")) ||
            existsSync(join(pkgDir, "__tests__")),
          hasSrc: existsSync(join(pkgDir, "src")),
          testFramework: detectTestFramework(packageJson),
          topLevelDirs: topLevelDirs.filter((d) => !d.startsWith(".")),
        },
        typescript: {
          hasTypes:
            tsconfig !== null ||
            packageJson?.types !== undefined ||
            packageJson?.typings !== undefined,
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

      await Bun.write(join(outDir, "analysis.json"), JSON.stringify(result, null, 2));

      console.log(
        JSON.stringify({
          success: true,
          clonedFrom: repoUrl,
          outputDir: outDir,
          package: args.package ?? null,
          manifest: manifest?.type ?? null,
          readme: readme !== null,
          packageJson: packageJson !== null,
          examples: examples.length,
          workflows: workflows.length,
          testFramework: result.structure.testFramework,
          hasTypes: result.typescript.hasTypes,
        }),
      );
    } finally {
      if (args.cleanup && existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
      } else if (!args.cleanup) {
        console.error(`Clone preserved at: ${tmpDir}`);
      }
    }
  },
});

runMain(main);

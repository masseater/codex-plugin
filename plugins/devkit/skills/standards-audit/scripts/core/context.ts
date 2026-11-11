import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { toPackageJsonSubset } from "./package-json.ts";
import { parsePnpmWorkspaceYaml } from "./pnpm-workspace.ts";
import { detectProjectTypes } from "./project-types.ts";
import type { PackageJsonSubset, ProjectContext, WorkspaceInfo } from "./types.ts";

function readPackageJson(dir: string): PackageJsonSubset | null {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return null;
  try {
    return toPackageJsonSubset(JSON.parse(readFileSync(path, "utf-8")));
  } catch (error) {
    // 壊れた package.json は「package.json なし」として監査を続ける。依存に基づく検査が省かれるだけで済む
    console.error(`standards-audit: ${path} を JSON として読めないので無視する:`, error);
    return null;
  }
}

/**
 * ワークスペースのパターン（`apps/*` など）の親ディレクトリにある、package.json を持つディレクトリを探す
 * @param rootDir モノレポのルート
 * @param pattern ワークスペースのパターン
 * @returns ワークスペースのディレクトリ
 */
function workspaceDirsIn(rootDir: string, pattern: string): string[] {
  const fullBaseDir = join(rootDir, pattern.replace(/\/?\*.*$/, ""));
  if (!existsSync(fullBaseDir)) return [];
  return readdirSync(fullBaseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(fullBaseDir, entry.name))
    .filter((wsDir) => existsSync(join(wsDir, "package.json")));
}

function resolveWorkspaceGlobs(rootDir: string, patterns: string[]): string[] {
  return patterns.flatMap((pattern) => workspaceDirsIn(rootDir, pattern)).toSorted();
}

function combinedDeps(pkg: PackageJsonSubset | null): Record<string, string> {
  return { ...pkg?.dependencies, ...pkg?.devDependencies };
}

function projectScope(dir: string, label: string): ProjectContext {
  const packageJson = readPackageJson(dir);
  return {
    rootDir: dir,
    label,
    types: detectProjectTypes(combinedDeps(packageJson)),
    packageJson,
  };
}

function packageWorkspaces(rootPkg: PackageJsonSubset | null): string[] {
  return rootPkg?.workspaces ?? [];
}

/**
 * モノレポのワークスペースのパターンを読む。pnpm-workspace.yaml を package.json の workspaces より優先する
 * @param targetDir 監査するディレクトリ
 * @param rootPkg ルートの package.json
 * @returns ワークスペースのパターン。モノレポでなければ null
 */
function workspacePatterns(targetDir: string, rootPkg: PackageJsonSubset | null): string[] | null {
  const pnpmWsPath = join(targetDir, "pnpm-workspace.yaml");
  if (existsSync(pnpmWsPath)) return parsePnpmWorkspaceYaml(readFileSync(pnpmWsPath, "utf-8"));
  const workspaces = packageWorkspaces(rootPkg);
  return workspaces.length > 0 ? workspaces : null;
}

function buildWorkspaceInfo(targetDir: string): WorkspaceInfo {
  const rootScope = projectScope(targetDir, "(root)");
  const patterns = workspacePatterns(targetDir, rootScope.packageJson);
  if (patterns === null) {
    return { rootDir: targetDir, isMonorepo: false, scopes: [rootScope] };
  }

  const workspaceScopes = resolveWorkspaceGlobs(targetDir, patterns).map((wsDir) =>
    projectScope(wsDir, relative(targetDir, wsDir)),
  );
  return {
    rootDir: targetDir,
    isMonorepo: true,
    scopes: [rootScope, ...workspaceScopes],
  };
}

export { buildWorkspaceInfo };

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { PackageJsonSubset, ProjectContext, ProjectType, WorkspaceInfo } from "./types.ts";

/** Signal-based project type detection from combined deps */
function detectProjectTypes(allDeps: Record<string, string>): ProjectType[] {
  const types: ProjectType[] = [];
  if (allDeps.next) types.push("web");
  if (allDeps.hono) types.push("backend");
  if (allDeps.citty) types.push("cli");
  return types;
}

/** Parse pnpm-workspace.yaml with regex (no yaml dependency) */
function parsePnpmWorkspaceYaml(content: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;
  for (const line of content.split("\n")) {
    if (line.startsWith("packages:")) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^\s+-\s+/.test(line)) {
      patterns.push(
        line
          .replace(/^\s+-\s+/, "")
          .replace(/['"]/g, "")
          .trim(),
      );
    } else if (inPackages && /^\S/.test(line)) {
      break;
    }
  }
  return patterns;
}

function readPackageJson(dir: string): PackageJsonSubset | null {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as PackageJsonSubset;
  } catch {
    return null;
  }
}

function resolveWorkspaceGlobs(rootDir: string, patterns: string[]): string[] {
  const dirs: string[] = [];
  for (const pattern of patterns) {
    const baseDir = pattern.replace(/\/?\*.*$/, "");
    const fullBaseDir = join(rootDir, baseDir);
    if (!existsSync(fullBaseDir)) continue;

    for (const entry of readdirSync(fullBaseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const wsDir = join(fullBaseDir, entry.name);
      if (existsSync(join(wsDir, "package.json"))) {
        dirs.push(wsDir);
      }
    }
  }
  return dirs.toSorted();
}

function buildWorkspaceInfo(targetDir: string): WorkspaceInfo {
  const rootPkg = readPackageJson(targetDir);
  const rootDeps = {
    ...rootPkg?.dependencies,
    ...rootPkg?.devDependencies,
  };
  const rootTypes = detectProjectTypes(rootDeps);

  // Detect monorepo
  const pnpmWsPath = join(targetDir, "pnpm-workspace.yaml");
  const hasPnpmWorkspace = existsSync(pnpmWsPath);
  const hasPkgWorkspaces = Array.isArray(rootPkg?.workspaces) && rootPkg.workspaces.length > 0;
  const isMonorepo = hasPnpmWorkspace || hasPkgWorkspaces;

  const rootScope: ProjectContext = {
    rootDir: targetDir,
    label: "(root)",
    types: rootTypes,
    packageJson: rootPkg,
  };

  if (!isMonorepo) {
    return { rootDir: targetDir, isMonorepo: false, scopes: [rootScope] };
  }

  // Resolve workspace patterns
  let patterns: string[] = [];
  if (hasPnpmWorkspace) {
    const content = readFileSync(pnpmWsPath, "utf-8");
    patterns = parsePnpmWorkspaceYaml(content);
  } else if (hasPkgWorkspaces && rootPkg?.workspaces) {
    patterns = rootPkg.workspaces;
  }

  const workspaceDirs = resolveWorkspaceGlobs(targetDir, patterns);
  const workspaceScopes: ProjectContext[] = workspaceDirs.map((wsDir) => {
    const wsPkg = readPackageJson(wsDir);
    const wsDeps = { ...wsPkg?.dependencies, ...wsPkg?.devDependencies };
    return {
      rootDir: wsDir,
      label: relative(targetDir, wsDir),
      types: detectProjectTypes(wsDeps),
      packageJson: wsPkg,
    };
  });

  return {
    rootDir: targetDir,
    isMonorepo: true,
    scopes: [rootScope, ...workspaceScopes],
  };
}

export { buildWorkspaceInfo, detectProjectTypes, parsePnpmWorkspaceYaml };

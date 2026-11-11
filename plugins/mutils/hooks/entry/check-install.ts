#!/usr/bin/env bun
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

export function findInstallRoot(start: string): string | null {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, "node_modules", ".bun"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function findLockRoot(start: string): string | null {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, "bun.lock"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function buildWarning(root: string, reason: string): string {
  return `mutils: ${root} の依存が未インストールか古い（${reason}）。/mutils:setup で更新できる。`;
}

type InstallProblem = { root: string; reason: string };

/**
 * bun.lock より node_modules が古くないかを確かめる。
 *
 * @param installRoot - node_modules/.bun のあるディレクトリ
 * @returns 古ければその問題。bun.lock が無いか新しければ null
 */
function staleInstall(installRoot: string): InstallProblem | null {
  const bunLock = join(installRoot, "bun.lock");
  if (!existsSync(bunLock)) {
    logger.debug(`No bun.lock at install root ${installRoot}, skipping mtime check`);
    return null;
  }
  const bunDirMtime = statSync(join(installRoot, "node_modules", ".bun")).mtimeMs;
  if (statSync(bunLock).mtimeMs > bunDirMtime) {
    logger.warn(`bun.lock newer than node_modules at ${installRoot}`);
    return { root: installRoot, reason: "bun.lock is newer than node_modules" };
  }
  logger.debug(`Install OK at ${installRoot}`);
  return null;
}

/**
 * プラグインの依存が未インストールか古くないかを確かめる。
 *
 * @param pluginRoot - CLAUDE_PLUGIN_ROOT
 * @returns 問題があればその内容。問題が無いか確かめられなければ null
 */
function installProblem(pluginRoot: string): InstallProblem | null {
  const lockRoot = findLockRoot(pluginRoot);
  if (!lockRoot) {
    logger.debug("No bun.lock found in ancestors, skipping");
    return null;
  }
  const installRoot = findInstallRoot(pluginRoot);
  if (!installRoot) {
    logger.warn(`Install missing for lockfile at ${lockRoot}`);
    return { root: lockRoot, reason: "node_modules/.bun is missing" };
  }
  return staleInstall(installRoot);
}

const hook = defineHook({
  trigger: { SessionStart: true },
  run: wrapRun(logger, (context) => {
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
    if (!pluginRoot) {
      logger.debug("CLAUDE_PLUGIN_ROOT not set, skipping");
      return context.success({});
    }

    const problem = installProblem(pluginRoot);
    if (!problem) {
      return context.success({});
    }

    return context.json({
      event: "SessionStart" as const,
      output: {
        // 環境保守はユーザーが判断することなので、モデルには渡さずユーザーにだけ表示する
        systemMessage: buildWarning(problem.root, problem.reason),
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

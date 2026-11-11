#!/usr/bin/env bun
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

function findInstallRoot(start: string): string | null {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, "node_modules", ".bun"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function findLockRoot(start: string): string | null {
  let dir = start;
  while (true) {
    if (existsSync(join(dir, "bun.lock"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function buildWarning(root: string, reason: string): string {
  return `⚠️ mutils: ${reason} at ${root}\n\nRun \`/mutils:setup\` to install dependencies.`;
}

const hook = defineHook({
  trigger: { SessionStart: true },
  run: wrapRun(logger, (context) => {
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
    if (!pluginRoot) {
      logger.debug("CLAUDE_PLUGIN_ROOT not set, skipping");
      return context.success({});
    }

    const lockRoot = findLockRoot(pluginRoot);
    if (!lockRoot) {
      logger.debug("No bun.lock found in ancestors, skipping");
      return context.success({});
    }

    const installRoot = findInstallRoot(pluginRoot);
    if (!installRoot) {
      logger.warn(`Install missing for lockfile at ${lockRoot}`);
      return context.json({
        event: "SessionStart" as const,
        output: {
          hookSpecificOutput: {
            hookEventName: "SessionStart" as const,
            additionalContext: buildWarning(lockRoot, "node_modules/.bun is missing"),
          },
          suppressOutput: true,
        },
      });
    }

    const bunLock = join(installRoot, "bun.lock");
    if (!existsSync(bunLock)) {
      logger.debug(`No bun.lock at install root ${installRoot}, skipping mtime check`);
      return context.success({});
    }

    const lockMtime = statSync(bunLock).mtimeMs;
    const bunDirMtime = statSync(join(installRoot, "node_modules", ".bun")).mtimeMs;
    if (lockMtime > bunDirMtime) {
      logger.warn(`bun.lock newer than node_modules at ${installRoot}`);
      return context.json({
        event: "SessionStart" as const,
        output: {
          hookSpecificOutput: {
            hookEventName: "SessionStart" as const,
            additionalContext: buildWarning(installRoot, "bun.lock is newer than node_modules"),
          },
          suppressOutput: true,
        },
      });
    }

    logger.debug(`Install OK at ${installRoot}`);
    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

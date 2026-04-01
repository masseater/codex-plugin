#!/usr/bin/env bun
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { rsort, valid } from "semver";
import { config } from "../lib/config.js";

using logger = HookLogger.fromFile(import.meta.filename);

const HOME = process.env.HOME ?? "";
const CACHE_BASE = `${HOME}/.claude/plugins/cache`;

const CONTEXT_FILES = [`${HOME}/AGENTS.md`, `${HOME}/CLAUDE.md`];

const VERSION_PATTERN = new RegExp(
  `${CACHE_BASE}/${config.marketplace}/${config.plugin}/([\\d.]+)/`,
);

function getInstalledVersion(): string | null {
  const pluginCacheDir = `${CACHE_BASE}/${config.marketplace}/${config.plugin}`;
  logger.debug(`Checking plugin cache directory: ${pluginCacheDir}`);

  if (!existsSync(pluginCacheDir)) {
    logger.debug("Plugin cache directory does not exist");
    return null;
  }

  const versions = readdirSync(pluginCacheDir).filter((v) => valid(v) !== null);
  logger.debug(`Found versions: ${JSON.stringify(versions)}`);
  const sorted = rsort(versions);

  const result = sorted[0] ?? null;
  logger.debug(`Installed version: ${result}`);
  return result;
}

async function getReferencedVersions(): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  logger.debug(`Checking context files: ${JSON.stringify(CONTEXT_FILES)}`);

  for (const file of CONTEXT_FILES) {
    if (!existsSync(file)) {
      logger.debug(`Context file does not exist: ${file}`);
      continue;
    }

    const content = await readFile(file, "utf-8");
    const match = content.match(VERSION_PATTERN);

    if (match?.[1]) {
      logger.debug(`Found version reference in ${file}: ${match[1]}`);
      versions.set(file, match[1]);
    } else {
      logger.debug(`No version reference found in ${file}`);
    }
  }

  logger.debug(`Referenced versions count: ${versions.size}`);
  return versions;
}

const hook = defineHook({
  trigger: {
    SessionStart: true,
  },
  run: wrapRun(logger, async (context) => {
    const installedVersion = getInstalledVersion();

    if (!installedVersion) {
      logger.debug("No installed version found, skipping check");
      return context.success({});
    }

    const referencedVersions = await getReferencedVersions();

    if (referencedVersions.size === 0) {
      logger.debug("No referenced versions found, skipping check");
      return context.success({});
    }

    const outdated: string[] = [];

    for (const [file, version] of referencedVersions) {
      if (version !== installedVersion) {
        logger.debug(`Outdated: ${file} has ${version}, expected ${installedVersion}`);
        outdated.push(`  - ${file}: ${version} → ${installedVersion}`);
      } else {
        logger.debug(`Up to date: ${file} has ${version}`);
      }
    }

    if (outdated.length === 0) {
      logger.debug("All context files are up to date");
      return context.success({});
    }

    logger.warn(`Found ${outdated.length} outdated context file(s)`);

    const message = `⚠️ mutils context files are outdated!

The following files reference an old mutils version:
${outdated.join("\n")}

Run \`/mutils:setup\` to update the references.`;

    logger.info(`Returning outdated warning message`);
    return context.json({
      event: "SessionStart" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "SessionStart" as const,
          additionalContext: message,
        },
        suppressOutput: true,
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

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

const CONTEXT_FILES = [`${HOME}/AGENTS.md`, `${HOME}/CLAUDE.md`, `${HOME}/.claude/CLAUDE.md`];

/** context ファイル内の、バージョン付きキャッシュパスの手前までの部分 */
const VERSION_PREFIX = `${CACHE_BASE}/${config.marketplace}/${config.plugin}/`;

export function getInstalledVersion(pluginCacheDir: string): string | null {
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

/**
 * 本文中で prefix の直後に書かれた最初のバージョン（`<prefix><version>/`）を取り出す。
 *
 * @param content - context ファイルの本文
 * @param prefix - バージョンの手前までのキャッシュパス
 * @returns バージョン。参照が無ければ undefined
 */
function referencedVersion(content: string, prefix: string): string | undefined {
  for (const rest of content.split(prefix).slice(1)) {
    const version = /^([\d.]+)\//.exec(rest)?.[1];
    if (version) return version;
  }
  return undefined;
}

async function referencedVersionIn(file: string, prefix: string): Promise<string | undefined> {
  if (!existsSync(file)) {
    logger.debug(`Context file does not exist: ${file}`);
    return undefined;
  }
  const version = referencedVersion(await readFile(file, "utf-8"), prefix);
  logger.debug(
    version
      ? `Found version reference in ${file}: ${version}`
      : `No version reference found in ${file}`,
  );
  return version;
}

export async function getReferencedVersions(
  contextFiles: string[],
  versionPrefix: string,
): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  logger.debug(`Checking context files: ${JSON.stringify(contextFiles)}`);

  for (const file of contextFiles) {
    const version = await referencedVersionIn(file, versionPrefix);
    if (version) versions.set(file, version);
  }

  logger.debug(`Referenced versions count: ${versions.size}`);
  return versions;
}

/**
 * インストール済みのバージョンと異なる参照を、通知の行にする。
 *
 * @param referenced - context ファイルごとの参照バージョン
 * @param installedVersion - インストール済みのバージョン
 * @returns 「- ファイル: 旧 → 新」形式の行
 */
function outdatedLines(referenced: Map<string, string>, installedVersion: string): string[] {
  return [...referenced].flatMap(([file, version]) => {
    if (version === installedVersion) {
      logger.debug(`Up to date: ${file} has ${version}`);
      return [];
    }
    logger.debug(`Outdated: ${file} has ${version}, expected ${installedVersion}`);
    return [`- ${file}: ${version} → ${installedVersion}`];
  });
}

/**
 * バージョン不一致の通知文
 * @param outdated - 「- ファイル: 旧 → 新」形式の行
 * @returns ユーザー向けの通知文
 */
export function buildOutdatedMessage(outdated: string[]): string {
  return [
    "mutils: 次のファイルに、旧形式の setup が書いた mutils キャッシュのバージョン付きパスへの参照が残っていて、インストール済みのバージョンと一致しない。現行の /mutils:setup は内容を ~/AGENTS.md にコピーして import するので、この参照行は削除してよい（/mutils:setup は旧形式の参照行を消さない）。",
    ...outdated,
  ].join("\n");
}

const hook = defineHook({
  trigger: {
    SessionStart: true,
  },
  run: wrapRun(logger, async (context) => {
    const installedVersion = getInstalledVersion(
      `${CACHE_BASE}/${config.marketplace}/${config.plugin}`,
    );

    if (!installedVersion) {
      logger.debug("No installed version found, skipping check");
      return context.success({});
    }

    const outdated = outdatedLines(
      await getReferencedVersions(CONTEXT_FILES, VERSION_PREFIX),
      installedVersion,
    );
    if (outdated.length === 0) {
      logger.debug("No outdated version references found");
      return context.success({});
    }

    logger.warn(`Found ${outdated.length} outdated context file(s)`);
    return context.json({
      event: "SessionStart" as const,
      output: {
        // 環境保守はユーザーが判断することなので、モデルには渡さずユーザーにだけ表示する
        systemMessage: buildOutdatedMessage(outdated),
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

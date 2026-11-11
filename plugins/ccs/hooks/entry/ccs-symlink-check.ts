#!/usr/bin/env bun
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { parse as parseYaml } from "yaml";
import { pathIn, readTextIn } from "../lib/path-in.ts";

using logger = HookLogger.fromFile(import.meta.filename);

export type Account = {
  context_mode?: string;
  context_group?: string;
};

export type CcsConfig = {
  accounts?: Record<string, Account>;
};

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * アカウント設定の 1 項目を、文字列のときだけ取り出す。
 * @param account - YAML の accounts の値
 * @param key - 取り出す項目
 * @returns 文字列ならその項目だけを持つオブジェクト。それ以外は空
 */
function stringField(account: object, key: keyof Account): Account {
  const value: unknown = Reflect.get(account, key);
  return typeof value === "string" ? { [key]: value } : {};
}

function toAccount(account: object): Account {
  return { ...stringField(account, "context_mode"), ...stringField(account, "context_group") };
}

/**
 * YAML として読んだ ~/.ccs/config.yaml を、この hook が使う形に絞って取り出す。
 * accounts の各値のうち、文字列の context_mode / context_group だけを残す。
 * @param value - parseYaml の戻り値
 * @returns 検証済みの設定。accounts が無い・形が違う場合は accounts を持たない
 */
export function toCcsConfig(value: unknown): CcsConfig {
  const rawAccounts: unknown = isObject(value) ? Reflect.get(value, "accounts") : undefined;
  if (!isObject(rawAccounts)) return {};
  const entries: Array<[string, unknown]> = Object.entries(rawAccounts);
  return {
    accounts: Object.fromEntries(
      entries.flatMap(([name, account]) =>
        isObject(account) ? [[name, toAccount(account)] as const] : [],
      ),
    ),
  };
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function lstatIfExists(filePath: string): fs.Stats | undefined {
  return fs.existsSync(filePath) ? fs.lstatSync(filePath) : undefined;
}

function isSymlinkTo(linkPath: string, target: string): boolean {
  return lstatIfExists(linkPath)?.isSymbolicLink() === true && fs.readlinkSync(linkPath) === target;
}

export function ensureSymlink(linkPath: string, target: string): boolean {
  if (isSymlinkTo(linkPath, target)) return false;
  ensureDir(path.dirname(linkPath));
  ensureDir(target);
  return false;
}

function copyEntry(srcPath: string, destPath: string, entry: fs.Dirent): void {
  if (entry.isDirectory()) {
    ensureDir(destPath);
    copyDirContents(srcPath, destPath);
    return;
  }
  if (entry.isSymbolicLink()) {
    fs.symlinkSync(fs.readlinkSync(srcPath), destPath);
    return;
  }
  fs.copyFileSync(srcPath, destPath, fs.constants.COPYFILE_EXCL);
}

export function copyDirContents(src: string, dest: string): void {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const destPath = pathIn(dest, entry.name);
    if (!fs.existsSync(destPath)) copyEntry(pathIn(src, entry.name), destPath, entry);
  }
}

/**
 * 既存のシンボリックリンクの向き先を target に揃える。
 * @param src - 既存のシンボリックリンク
 * @param target - 向き先
 * @returns 張り替えたら true
 */
function relinkSymlink(src: string, target: string): boolean {
  if (fs.readlinkSync(src) === target) return false;
  fs.unlinkSync(src);
  fs.symlinkSync(target, src);
  return true;
}

/**
 * src にシンボリックリンクを置けるようにする。既存のディレクトリは中身を target に移してから消す。
 * @param src - シンボリックリンクを置く場所
 * @param target - 向き先
 * @param stat - src の現在の状態（無ければ undefined）
 */
function prepareLinkPath(src: string, target: string, stat: fs.Stats | undefined): void {
  if (stat?.isDirectory()) {
    copyDirContents(src, target);
    fs.rmSync(src, { recursive: true, force: true });
    return;
  }
  ensureDir(path.dirname(src));
}

export function replaceWithSymlink(src: string, target: string): boolean {
  ensureDir(target);
  const stat = lstatIfExists(src);
  if (stat?.isSymbolicLink()) return relinkSymlink(src, target);
  prepareLinkPath(src, target, stat);
  fs.symlinkSync(target, src);
  return true;
}

function linkReport(name: string, from: string, to: string, linked: boolean): string[] {
  return linked ? [`${name}: ${from} -> ${to}`] : [];
}

/**
 * グループの projects を ~/.claude/projects に、インスタンスの projects をグループの projects につなぐ。
 * @param name - アカウント名
 * @param groupDir - context group のディレクトリ
 * @param instanceDir - アカウントのインスタンスのディレクトリ
 * @param claudeDir - ~/.claude
 * @returns 修復したリンクの記録
 */
function linkProjects(
  name: string,
  groupDir: string,
  instanceDir: string,
  claudeDir: string,
): string[] {
  // projects chain: groupDir/projects -> ~/.claude/projects
  const groupProjects = pathIn(groupDir, "projects");
  const claudeProjects = pathIn(claudeDir, "projects");
  ensureDir(claudeProjects);
  const fixed = linkReport(
    name,
    groupProjects,
    claudeProjects,
    ensureSymlink(groupProjects, claudeProjects),
  );
  if (!fs.existsSync(groupProjects)) {
    fs.symlinkSync(claudeProjects, groupProjects);
    fixed.push(`${name}: created ${groupProjects} -> ${claudeProjects}`);
  }

  // instanceDir/projects -> groupDir/projects
  const instanceProjects = pathIn(instanceDir, "projects");
  return [
    ...fixed,
    ...linkReport(
      name,
      instanceProjects,
      groupProjects,
      replaceWithSymlink(instanceProjects, groupProjects),
    ),
  ];
}

// instanceDir/sessions -> ~/.claude/sessions
function linkSessions(name: string, instanceDir: string, claudeDir: string): string[] {
  const claudeSessions = pathIn(claudeDir, "sessions");
  ensureDir(claudeSessions);
  const instanceSessions = pathIn(instanceDir, "sessions");
  return linkReport(
    name,
    instanceSessions,
    claudeSessions,
    replaceWithSymlink(instanceSessions, claudeSessions),
  );
}

const CONTINUITY_DIRS = ["file-history", "session-env", "shell-snapshots", "todos"];

// continuity dirs
function linkContinuity(name: string, groupDir: string, instanceDir: string): string[] {
  return CONTINUITY_DIRS.flatMap((dir) => {
    const target = pathIn(groupDir, "continuity", dir);
    ensureDir(target);
    const instancePath = pathIn(instanceDir, dir);
    return linkReport(name, instancePath, target, replaceWithSymlink(instancePath, target));
  });
}

/**
 * shared context のアカウント 1 つについて、インスタンスのディレクトリを共有先へのリンクにする。
 * @param name - アカウント名
 * @param account - アカウント設定
 * @param ccsDir - ~/.ccs
 * @param claudeDir - ~/.claude
 * @returns 修復したリンクの記録
 */
function linkSharedAccount(
  name: string,
  account: Account,
  ccsDir: string,
  claudeDir: string,
): string[] {
  const instanceDir = pathIn(ccsDir, "instances", name);
  if (!fs.existsSync(instanceDir)) return [];

  const groupDir = pathIn(ccsDir, "shared", "context-groups", account.context_group ?? "default");
  ensureDir(groupDir);
  ensureDir(pathIn(groupDir, "continuity"));

  return [
    ...linkProjects(name, groupDir, instanceDir, claudeDir),
    ...linkSessions(name, instanceDir, claudeDir),
    ...linkContinuity(name, groupDir, instanceDir),
  ];
}

export function processSharedContextAccounts(
  accounts: Record<string, Account>,
  ccsDir: string,
  claudeDir: string,
): string[] {
  return Object.entries(accounts)
    .filter(([, account]) => account.context_mode === "shared")
    .flatMap(([name, account]) => linkSharedAccount(name, account, ccsDir, claudeDir));
}

/**
 * ~/.ccs/config.yaml を読む。
 * @param ccsDir - ~/.ccs
 * @returns 設定。ファイルが無いか読めなければ undefined
 */
function readCcsConfig(ccsDir: string): CcsConfig | undefined {
  if (!fs.existsSync(pathIn(ccsDir, "config.yaml"))) return undefined;
  try {
    return toCcsConfig(parseYaml(readTextIn(ccsDir, "config.yaml")));
  } catch (error) {
    // 設定が壊れている場合は CCS 側の問題で、この hook が直すものではない。修復を省いてセッションを続ける
    logger.warn(`Failed to parse ${pathIn(ccsDir, "config.yaml")}: ${String(error)}`);
    return undefined;
  }
}

const hook = defineHook({
  trigger: { SessionStart: true },
  run: wrapRun(logger, (context) => {
    const ccsDir = pathIn(os.homedir(), ".ccs");
    const accounts = readCcsConfig(ccsDir)?.accounts;
    if (!accounts) {
      return context.success({});
    }

    const fixed = processSharedContextAccounts(accounts, ccsDir, pathIn(os.homedir(), ".claude"));
    if (fixed.length === 0) {
      return context.success({});
    }

    return context.json({
      event: "SessionStart",
      output: {
        // 環境修復の記録はユーザー向けで、Claude の作業には不要なので systemMessage で出す
        systemMessage: `CCS symlink check: fixed ${fixed.length} link(s):\n${fixed.join("\n")}`,
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

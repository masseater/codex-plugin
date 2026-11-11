#!/usr/bin/env bun
/**
 * mutils の配布する AGENTS.md を ~/AGENTS.md のマーカー内へ同期し、~/.claude/CLAUDE.md に import 行を足す。
 *
 * 使い方:
 *   sync-agents-md.ts --src <assets/AGENTS.md>                       同期を試みる
 *   sync-agents-md.ts --src <assets/AGENTS.md> --resolve <file>      マーカー内を <file> の内容で確定する
 *
 * マーカー外のユーザー記述には触れない。マーカー内のユーザー編集は、前回適用した内容（baseline）を
 * 共通祖先とする 3-way merge（git merge-file）で mutils 側の更新と両立させる。
 * 自動で決められない場合（baseline が無い、コンフリクト）は何も書き換えず、判断材料のファイルを出して終了する。
 *
 * 結果は 1 行の JSON で stdout に出す。
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

export const BEGIN = "<!-- BEGIN mutils:agents-md -->";
export const END = "<!-- END mutils:agents-md -->";
export const IMPORT_LINE = "@~/AGENTS.md";

export type Paths = { src: string; target: string; baseline: string; claudeMd: string };

export type SyncResult =
  | { status: "created" | "appended" | "unchanged" | "merged" | "resolved" }
  | { status: "needs-baseline"; inside: string; src: string }
  | { status: "conflict"; conflict: string };

/**
 * マーカーで囲んだブロックを作る
 * @param body - マーカー内に置く内容
 * @returns マーカー付きのブロック
 */
export function block(body: string): string {
  return `${BEGIN}\n${body.replace(/\n$/, "")}\n${END}`;
}

/**
 * マーカー内の内容を取り出す。マーカーが無ければ undefined
 * @param text - 対象ファイルの内容
 * @returns マーカー内の内容
 */
export function extractInside(text: string): string | undefined {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start === -1 || end === -1 || end < start) return undefined;
  return text.slice(start + BEGIN.length + 1, end).replace(/\n$/, "");
}

/**
 * マーカー内を置き換える。マーカー外は 1 文字も変えない
 * @param text - 対象ファイルの内容
 * @param body - 新しいマーカー内の内容
 * @returns 置き換え後の内容
 */
export function replaceInside(text: string, body: string): string {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END) + END.length;
  return text.slice(0, start) + block(body) + text.slice(end);
}

/**
 * OS の一時ディレクトリに作業用のディレクトリを作る
 * @returns 作ったディレクトリ
 */
function makeTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "mutils-setup-"));
}

/**
 * 作業用ディレクトリの中のファイルパスを作る
 * @param dir - makeTempDir で作ったディレクトリ
 * @param name - 固定のファイル名
 * @returns ファイルパス
 */
function tempFile(dir: string, name: string): string {
  return path.join(dir, name);
}

/**
 * ホームディレクトリ配下のパスを作る
 * @param segments - ホームディレクトリからの固定の相対パス
 * @returns 絶対パス
 */
function homePath(...segments: string[]): string {
  return path.join(homedir(), ...segments);
}

function writeBaseline(paths: Paths, src: string): void {
  mkdirSync(path.dirname(paths.baseline), { recursive: true });
  writeFileSync(paths.baseline, src);
}

function mergeFile(ours: string, base: string, theirs: string): { merged: string; clean: boolean } {
  const dir = makeTempDir();
  const files = { ours: "ours.md", base: "base.md", theirs: "theirs.md" } as const;
  writeFileSync(tempFile(dir, files.ours), `${ours}\n`);
  writeFileSync(tempFile(dir, files.base), `${base}\n`);
  writeFileSync(tempFile(dir, files.theirs), `${theirs}\n`);
  const result = spawnSync(
    "git",
    [
      "merge-file",
      "-p",
      "-L",
      "yours",
      "-L",
      "previous mutils",
      "-L",
      "new mutils",
      files.ours,
      files.base,
      files.theirs,
    ],
    { cwd: dir, encoding: "utf-8" },
  );
  if (result.status === null || result.status < 0) {
    throw new Error(`git merge-file failed: ${result.stderr}`);
  }
  return { merged: result.stdout.replace(/\n$/, ""), clean: result.status === 0 };
}

function readWithoutTrailingNewline(file: string): string {
  return readFileSync(file, "utf-8").replace(/\n$/, "");
}

function createTarget(paths: Paths, src: string): SyncResult {
  writeFileSync(paths.target, `${block(src)}\n`);
  writeBaseline(paths, src);
  return { status: "created" };
}

function appendBlock(paths: Paths, current: string, src: string): SyncResult {
  const separator = current.endsWith("\n") ? "\n" : "\n\n";
  writeFileSync(paths.target, `${current}${separator}${block(src)}\n`);
  writeBaseline(paths, src);
  return { status: "appended" };
}

/**
 * マーカー内のユーザー編集と mutils 側の更新を、前回適用した内容を共通祖先に 3-way merge する
 * @param paths - 対象パス
 * @param current - ~/AGENTS.md の現在の内容
 * @param inside - 現在のマーカー内の内容
 * @param src - 新しい配布内容
 * @returns 同期結果
 */
function mergeInside(paths: Paths, current: string, inside: string, src: string): SyncResult {
  if (!existsSync(paths.baseline)) {
    return { status: "needs-baseline", inside, src };
  }
  const { merged, clean } = mergeFile(inside, readWithoutTrailingNewline(paths.baseline), src);
  if (!clean) {
    return { status: "conflict", conflict: merged };
  }
  writeFileSync(paths.target, replaceInside(current, merged));
  writeBaseline(paths, src);
  return { status: "merged" };
}

function syncExisting(paths: Paths, src: string): SyncResult {
  const current = readFileSync(paths.target, "utf-8");
  const inside = extractInside(current);
  if (inside === undefined) return appendBlock(paths, current, src);
  if (inside === src) {
    writeBaseline(paths, src);
    return { status: "unchanged" };
  }
  return mergeInside(paths, current, inside, src);
}

/**
 * ~/AGENTS.md のマーカー内を同期する
 * @param paths - 対象パス
 * @returns 同期結果
 */
export function syncAgentsMd(paths: Paths): SyncResult {
  const src = readWithoutTrailingNewline(paths.src);
  return existsSync(paths.target) ? syncExisting(paths, src) : createTarget(paths, src);
}

/**
 * マーカー内をユーザーが決めた内容で確定し、baseline を最新の配布内容にする
 * @param paths - 対象パス
 * @param resolved - 確定するマーカー内の内容
 * @returns 同期結果
 */
export function resolveAgentsMd(paths: Paths, resolved: string): SyncResult {
  const src = readFileSync(paths.src, "utf-8").replace(/\n$/, "");
  const current = readFileSync(paths.target, "utf-8");
  writeFileSync(paths.target, replaceInside(current, resolved.replace(/\n$/, "")));
  writeBaseline(paths, src);
  return { status: "resolved" };
}

/**
 * ~/.claude/CLAUDE.md に ~/AGENTS.md の import 行が無ければ足す。
 * CLAUDE.md を持つプロジェクトでは ~/AGENTS.md が読まれないため、ユーザー指示ファイルから import する
 * @param claudeMd - ~/.claude/CLAUDE.md のパス
 * @returns 行を足したら true
 */
export function ensureImport(claudeMd: string): boolean {
  const current = existsSync(claudeMd) ? readFileSync(claudeMd, "utf-8") : "";
  if (hasImportLine(current)) return false;
  mkdirSync(path.dirname(claudeMd), { recursive: true });
  writeFileSync(claudeMd, withImportLine(current));
  return true;
}

function hasImportLine(text: string): boolean {
  return text.split("\n").some((line) => line.trim() === IMPORT_LINE);
}

/**
 * 末尾に空行を挟んで import 行を足した内容を作る
 * @param current - CLAUDE.md の現在の内容（無ければ空文字列）
 * @returns import 行を足した内容
 */
function withImportLine(current: string): string {
  if (current === "") return `${IMPORT_LINE}\n`;
  const prefix = current.endsWith("\n") ? current : `${current}\n`;
  return `${prefix}\n${IMPORT_LINE}\n`;
}

/**
 * コマンドライン引数から対象パスを決める。--src が無ければ undefined
 * @param args - コマンドライン引数
 * @returns 対象パスと、--resolve で渡されたファイル
 */
function parseCli(args: string[]): { paths: Paths; resolveFile: string | undefined } | undefined {
  const { values } = parseArgs({
    args,
    options: {
      src: { type: "string" },
      resolve: { type: "string" },
      target: { type: "string", default: homePath("AGENTS.md") },
      baseline: {
        type: "string",
        default: homePath(".claude", "mutils", "setup-baseline-agents-md.md"),
      },
      "claude-md": { type: "string", default: homePath(".claude", "CLAUDE.md") },
    },
  });
  if (!values.src) return undefined;
  const paths: Paths = {
    src: values.src,
    target: values.target,
    baseline: values.baseline,
    claudeMd: values["claude-md"],
  };
  return { paths, resolveFile: values.resolve };
}

/**
 * 自動で決められない結果について、判断材料のファイルを作って結果の JSON を出す
 * @param result - needs-baseline か conflict の同期結果
 * @param paths - 対象パス
 */
function reportDecisionNeeded(
  result: Extract<SyncResult, { status: "needs-baseline" | "conflict" }>,
  paths: Paths,
): void {
  const dir = makeTempDir();
  const files =
    result.status === "conflict"
      ? { conflict: tempFile(dir, "conflict.md") }
      : { inside: tempFile(dir, "inside.md"), src: paths.src };
  if (result.status === "conflict") writeFileSync(files.conflict!, `${result.conflict}\n`);
  else writeFileSync(files.inside!, `${result.inside}\n`);
  process.stdout.write(`${JSON.stringify({ status: result.status, files })}\n`);
}

/**
 * 同期（または --resolve での確定）を実行し、結果の JSON を stdout に出す
 * @param paths - 対象パス
 * @param resolveFile - --resolve で渡された、マーカー内の確定内容のファイル
 */
function syncAndReport(paths: Paths, resolveFile: string | undefined): void {
  const result = resolveFile
    ? resolveAgentsMd(paths, readFileSync(resolveFile, "utf-8"))
    : syncAgentsMd(paths);

  if (result.status === "needs-baseline" || result.status === "conflict") {
    reportDecisionNeeded(result, paths);
    return;
  }

  const importAdded = ensureImport(paths.claudeMd);
  process.stdout.write(`${JSON.stringify({ status: result.status, importAdded })}\n`);
}

/**
 * CLI の本体。結果の JSON を stdout に出し、終了コードを返す
 * @param args - コマンドライン引数
 * @returns 終了コード
 */
export function main(args: string[]): number {
  const cli = parseCli(args);
  if (!cli) {
    process.stderr.write("Usage: sync-agents-md.ts --src <assets/AGENTS.md> [--resolve <file>]\n");
    return 1;
  }
  syncAndReport(cli.paths, cli.resolveFile);
  return 0;
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}

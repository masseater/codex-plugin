import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type Finding = {
  severity: string;
  rule: string;
  file: string | null;
  line: number | null;
  message: string;
};
export type AuditScopeFindings = { scope: { label: string }; findings: Finding[] };
export type AuditFindings = { scopeResults: AuditScopeFindings[] };

/** セッションごとに保存する状態 */
export type BaselineState = {
  /** セッション開始時点（または最初の Stop 時点）にあった違反のキー */
  baseline: string[];
  /** すでに Claude に通知した違反のキー */
  notified: string[];
};

export type Violation = { key: string; text: string };

/**
 * 監査結果から violation を取り出し、行番号に依存しないキーを付ける。
 * 行番号は編集でずれるため、キーには含めない
 *
 * @param result - audit() の実行結果
 * @returns キーと表示用テキストの組の一覧
 */
export function collectViolations(result: AuditFindings): Violation[] {
  return result.scopeResults.flatMap((sr) =>
    sr.findings
      .filter((f) => f.severity === "violation")
      .map((f) => ({
        key: [sr.scope.label, f.rule, f.file ?? "", f.message].join("|"),
        text: `[${f.rule}] ${scopePrefix(sr.scope.label)}${formatLocation(f)} — ${f.message}`,
      })),
  );
}

/**
 * 表示用のスコープ接頭辞を返す。ルートのスコープには付けない
 *
 * @param label - スコープのラベル
 * @returns `label/` 形式の接頭辞。ルートなら空文字
 */
function scopePrefix(label: string): string {
  return label === "(root)" ? "" : `${label}/`;
}

/**
 * finding の位置を `file:line` 形式で表す
 *
 * @param finding - 監査の finding
 * @returns 位置の文字列。ファイルが無ければ "(project)"
 */
function formatLocation(finding: Finding): string {
  if (!finding.file) return "(project)";
  return finding.line == null ? finding.file : `${finding.file}:${finding.line}`;
}

/**
 * 基準値と通知済みの違反を除いた、まだ通知していない新規違反を返す
 *
 * @param current - 現在の違反一覧
 * @param state - セッションの状態
 * @returns 新たに通知すべき違反
 */
export function newViolations(current: Violation[], state: BaselineState): Violation[] {
  const known = new Set([...state.baseline, ...state.notified]);
  return current.filter((v) => !known.has(v.key));
}

/**
 * セッションの状態ファイルのパス
 *
 * @param stateDir - XDG state ディレクトリ
 * @param sessionId - セッション ID
 * @returns 状態ファイルの絶対パス
 */
export function statePath(stateDir: string, sessionId: string): string {
  return join(stateDir, "claude-code-plugin", "devkit", "standards-audit", `${sessionId}.json`);
}

/**
 * XDG_STATE_HOME（未設定なら ~/.local/state）を返す
 *
 * @returns state ディレクトリ
 */
export function resolveStateDir(): string {
  return process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`;
}

/**
 * 状態ファイルを読む。存在しなければ undefined
 *
 * @param path - 状態ファイルのパス
 * @returns 保存済みの状態
 */
export function readState(path: string): BaselineState | undefined {
  if (!existsSync(path)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
  // 形の合わない状態ファイルは、基準が無い（初回）として扱い、次の書き込みで正しい形に戻す
  return isBaselineState(parsed)
    ? { baseline: parsed.baseline, notified: parsed.notified }
    : undefined;
}

/**
 * JSON から読んだ値が BaselineState の形をしているか確かめる
 *
 * @param value - 状態ファイルの中身
 * @returns baseline と notified が文字列配列なら true
 */
function isBaselineState(value: unknown): value is BaselineState {
  return isRecord(value) && isStringArray(value.baseline) && isStringArray(value.notified);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * 状態ファイルを書く
 *
 * @param path - 状態ファイルのパス
 * @param state - 保存する状態
 */
export function writeState(path: string, state: BaselineState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state));
}

/**
 * Stop 時に Claude へ渡す文
 *
 * @param violations - 新規違反
 * @param logPath - 全件を書いたログのパス（cwd 相対）
 * @returns additionalContext の文字列
 */
export function formatNotice(violations: Violation[], logPath: string): string {
  const shown = violations.slice(0, 5).map((v) => `- ${v.text}`);
  const rest =
    violations.length > shown.length ? [`- ほか ${violations.length - shown.length} 件`] : [];
  return [
    `devkit standards-audit: このセッション中に規約違反が ${violations.length} 件増えた（全件: ${logPath}）。`,
    ...shown,
    ...rest,
    "今回の変更によるものであれば直す。意図的な逸脱なら docs/devkit-intentional-violation.md に理由を記録する。",
  ].join("\n");
}

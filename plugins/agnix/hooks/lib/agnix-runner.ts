import { execFileSync } from "node:child_process";
import type { HookLogger } from "@r_masseater/cc-plugin-lib";

export const isAgnixAvailable = (logger?: Pick<HookLogger, "debug">): boolean => {
  try {
    execFileSync("which", ["agnix"], { stdio: "pipe" });
    return true;
  } catch (error) {
    // agnix 未インストールの環境では lint を省くだけでよい（hook は補助情報を返すだけ）
    logger?.debug(`agnix not found: ${String(error)}`);
    return false;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type AgnixRunResult = { exitCode: number; stdout: string; stderr: string };

/**
 * execFileSync が投げた例外から、終了コードや出力のフィールドを読む。
 * @param error - catch した例外
 * @param key - 読むフィールド名（status / stdout / stderr）
 * @returns フィールドの値。無ければ undefined
 */
const errorField = (error: unknown, key: "status" | "stdout" | "stderr"): unknown => {
  if (!isRecord(error)) return undefined;
  return Object.getOwnPropertyDescriptor(error, key)?.value;
};

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === "number" ? value : fallback;

export const runAgnix = (args: string[], logger: Pick<HookLogger, "debug">): AgnixRunResult => {
  try {
    const stdout = execFileSync("agnix", args, {
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 30_000,
    });
    logger.debug(`agnix exited with code 0`);
    return { exitCode: 0, stdout, stderr: "" };
  } catch (error) {
    // agnix は error レベルの指摘があると非 0 で終了する。指摘の有無は呼び出し側が出力から判定するので、
    // ここでは終了コードと出力をそのまま返す
    const exitCode = numberOr(errorField(error, "status"), 1);
    logger.debug(`agnix exited with code ${exitCode}`);
    return {
      exitCode,
      stdout: stringOr(errorField(error, "stdout"), ""),
      stderr: stringOr(errorField(error, "stderr"), ""),
    };
  }
};

export type AgnixDiagnostic = {
  level: string;
  rule: string;
  line: number;
  column: number;
  message: string;
  suggestion?: string;
};

const optionalSuggestion = (suggestion: unknown): { suggestion?: string } =>
  typeof suggestion === "string" ? { suggestion } : {};

const toDiagnostic = (value: unknown): AgnixDiagnostic | null => {
  if (!isRecord(value)) return null;
  const { level, rule, line, column, message, suggestion } = value;
  if (typeof level !== "string" || typeof message !== "string") return null;
  return {
    level,
    rule: stringOr(rule, ""),
    line: numberOr(line, 0),
    column: numberOr(column, 0),
    message,
    ...optionalSuggestion(suggestion),
  };
};

/**
 * `agnix --format json` の stdout から指摘一覧を取り出す。
 * JSON として読めない、または `diagnostics` 配列が無いときは null を返す（呼び出し側で扱いを決める）。
 *
 * @param stdout - `agnix --format json` の標準出力
 * @param logger - JSON として読めなかったときの記録先
 * @returns 指摘の配列。形式外の出力なら null
 */
export const parseAgnixJson = (
  stdout: string,
  logger?: Pick<HookLogger, "debug">,
): AgnixDiagnostic[] | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    // 形式外の出力（agnix 自体のエラーメッセージなど）。null を返して呼び出し側に判断を委ねる
    logger?.debug(`agnix output is not JSON: ${String(error)}`);
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.diagnostics)) return null;
  return parsed.diagnostics.map(toDiagnostic).filter((d): d is AgnixDiagnostic => d !== null);
};

/**
 * session-start-wrapper.sh から呼ばれ、2 つの SessionStart hook の JSON 出力を 1 つにまとめて stdout に出す。
 * systemMessage はトップレベル、additionalContext は hookSpecificOutput の下にある（公式の出力仕様）。
 */
import { HookLogger } from "@r_masseater/cc-plugin-lib";
import { isRecord } from "./json-value.js";

using logger = HookLogger.fromFile(import.meta.filename);

export type SessionStartOutput = {
  systemMessage?: string;
  hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
  [key: string]: unknown;
};

/**
 * JSON 文字列を読む。JSON でなければ undefined
 * @param text - hook の stdout
 * @returns 読んだ値
 */
export function parseOutput(text: string): SessionStartOutput | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    // JSON でない出力は、壊れた JSON をモデルのコンテキストに注入しないよう捨てる
    logger.debug(`ignored non-JSON output: ${String(error)}`);
    return undefined;
  }
  if (!isSessionStartOutput(parsed)) {
    // SessionStart の出力形式に合わない JSON は、壊れた値をモデルのコンテキストに注入しないよう捨てる
    logger.debug("ignored JSON output that is not a SessionStart hook output");
    return undefined;
  }
  return parsed;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isHookSpecificOutput(value: unknown): boolean {
  return (
    value === undefined ||
    (isRecord(value) &&
      isOptionalString(value.hookEventName) &&
      isOptionalString(value.additionalContext))
  );
}

/**
 * 値が SessionStart hook の JSON 出力の形（systemMessage と hookSpecificOutput が文字列）かを判定する
 * @param value - JSON として読んだ hook の stdout
 * @returns SessionStart hook の出力なら true
 */
function isSessionStartOutput(value: unknown): value is SessionStartOutput {
  return (
    isRecord(value) &&
    isOptionalString(value.systemMessage) &&
    isHookSpecificOutput(value.hookSpecificOutput)
  );
}

function additionalContextOf(output: SessionStartOutput): string | undefined {
  return output.hookSpecificOutput?.additionalContext;
}

/**
 * 空でない値だけを区切り文字で連結する
 * @param values - 連結する値
 * @param separator - 区切り文字
 * @returns 連結結果。空でない値が無ければ undefined
 */
function joinPresent(values: (string | undefined)[], separator: string): string | undefined {
  const present = values.filter(Boolean);
  return present.length > 0 ? present.join(separator) : undefined;
}

/**
 * systemMessage と additionalContext を除いた出力に、連結した値を付け直す
 * @param rest - systemMessage と hookSpecificOutput を除いた出力
 * @param systemMessage - 連結した systemMessage
 * @param additionalContext - 連結した additionalContext
 * @returns マージ結果
 */
function withMergedMessages(
  rest: SessionStartOutput,
  systemMessage: string | undefined,
  additionalContext: string | undefined,
): SessionStartOutput {
  return {
    ...rest,
    ...(systemMessage ? { systemMessage } : {}),
    ...(additionalContext
      ? { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }
      : {}),
  };
}

/**
 * 2 つの出力をマージする
 * @param a - 1 つ目の出力
 * @param b - 2 つ目の出力
 * @returns マージ結果。どちらも無ければ undefined
 */
export function mergeOutputs(
  a: SessionStartOutput | undefined,
  b: SessionStartOutput | undefined,
): SessionStartOutput | undefined {
  if (!a) return b;
  if (!b) return a;
  const rest: SessionStartOutput = { ...a, ...b };
  delete rest.systemMessage;
  delete rest.hookSpecificOutput;
  return withMergedMessages(
    rest,
    joinPresent([a.systemMessage, b.systemMessage], "\n"),
    joinPresent([additionalContextOf(a), additionalContextOf(b)], "\n\n"),
  );
}

if (import.meta.main) {
  const [first = "", second = ""] = process.argv.slice(2);
  const merged = mergeOutputs(parseOutput(first), parseOutput(second));
  if (merged) process.stdout.write(`${JSON.stringify(merged)}\n`);
}

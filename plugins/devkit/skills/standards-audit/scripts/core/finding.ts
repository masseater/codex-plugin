import type { Finding, Severity } from "./types.ts";

/**
 * 検査結果の 1 件を作る。
 * @param severity 重大度
 * @param rule 検査ルールの名前
 * @param message 何が問題で、どう直すか
 * @param location 該当するファイルと行（プロジェクト全体の問題なら省略）
 * @returns 検査結果
 */
export function finding(
  severity: Severity,
  rule: string,
  message: string,
  location: { file?: string | null; line?: number | null } = {},
): Finding {
  return { severity, rule, file: location.file ?? null, line: location.line ?? null, message };
}

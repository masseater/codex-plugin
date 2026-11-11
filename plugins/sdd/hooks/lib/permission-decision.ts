/**
 * PreToolUse hook の許否判定と、その JSON 出力。
 */

export type PermissionDecision = { decision: "allow" } | { decision: "deny"; reason: string };

export const ALLOW: PermissionDecision = { decision: "allow" };

/**
 * 拒否の判定を作る。
 * @param reason - Claude に伝える拒否の理由
 * @returns 拒否の判定
 */
export function deny(reason: string): PermissionDecision {
  return { decision: "deny", reason };
}

/**
 * 拒否の判定を、ツールの実行を止める PreToolUse の出力にする。
 * @param reason - Claude に伝える拒否の理由
 * @returns context.json に渡す出力
 */
function denyOutput(reason: string) {
  return {
    event: "PreToolUse" as const,
    output: {
      hookSpecificOutput: {
        hookEventName: "PreToolUse" as const,
        permissionDecision: "deny" as const,
        permissionDecisionReason: reason,
      },
    },
  };
}

/** respondToDecision が使う、hook の context の応答メソッド */
export type DecisionContext<TSuccess, TJson> = {
  success: (output: Record<string, never>) => TSuccess;
  json: (output: ReturnType<typeof denyOutput>) => TJson;
};

/**
 * 判定を hook の応答にする。許可なら何もせず通し、拒否ならツールの実行を止める。
 * @param context - hook の context
 * @param result - 許否の判定
 * @returns hook の応答
 */
export function respondToDecision<TSuccess, TJson>(
  context: DecisionContext<TSuccess, TJson>,
  result: PermissionDecision,
): TSuccess | TJson {
  return result.decision === "allow"
    ? context.success({})
    : context.json(denyOutput(result.reason));
}

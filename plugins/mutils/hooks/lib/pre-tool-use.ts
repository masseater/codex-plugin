/**
 * PreToolUse hook がツールの実行を止めるときの JSON 出力。
 */

/**
 * ツールの実行を拒否する PreToolUse の出力を作る。
 *
 * @param reason - Claude に伝える拒否の理由
 * @returns context.json に渡す出力
 */
export function denyToolUse(reason: string) {
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

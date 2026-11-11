#!/usr/bin/env bun
/**
 * specs/_archived/ ディレクトリ内のファイル編集を禁止するフック
 */
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { respondToDecision, type PermissionDecision } from "../lib/permission-decision.ts";

using logger = HookLogger.fromFile(import.meta.filename);

export type BlockDecision = PermissionDecision;

/**
 * specs/_archived/ パスを含むかどうかで編集の許否を判定する
 * @param filePath - 編集対象のファイルパス
 * @returns 許可または拒否理由を含む判定結果
 */
export function decideBlockArchivedEdit(filePath: string): BlockDecision {
  // specs/_archived/ パスを含むかチェック
  if (!filePath.includes("specs/_archived/")) {
    return { decision: "allow" };
  }

  return {
    decision: "deny",
    reason:
      "specs/_archived/ はアーカイブ済みの spec で、完了した作業の記録を保つため編集できません。変更が必要なら /sdd:spec init で新しい spec を作ってください。",
  };
}

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const filePath = context.input.tool_input.file_path;

    const result = decideBlockArchivedEdit(filePath);

    return respondToDecision(context, result);
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

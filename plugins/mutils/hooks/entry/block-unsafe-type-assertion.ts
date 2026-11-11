#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
/**
 * ファイル編集時に危険な型アサーション・型エラー抑制ディレクティブを検出してブロックするフック
 */
import { defineHook, runHook } from "cc-hooks-ts";
import { denyToolUse } from "../lib/pre-tool-use.js";

using logger = HookLogger.fromFile(import.meta.filename);

export const FORBIDDEN_PATTERNS = [
  { pattern: /\bas\s+unknown\b/g, name: "as unknown" },
  { pattern: /\bas\s+any\b/g, name: "as any" },
  { pattern: /\bas\s+\{\s*\}/g, name: "as {}" },
  { pattern: /:\s*any\b/g, name: ": any" },
  // 文字クラスで書き、このファイル自身の本文がディレクティブそのものを含まないようにする
  { pattern: /@ts-expect[-]error/g, name: "@ts-expect" + "-error" },
] as const;

/**
 * deny の理由文。パターン名そのものを文字列に書くとこのファイルの編集がこの hook に止められるので、
 * 個々のパターンは違反一覧（FORBIDDEN_PATTERNS の name）で示し、理由文では一般化して書く。
 *
 * @param violations - findForbiddenPatterns の結果
 * @returns permissionDecisionReason の文字列
 */
export function formatDenyReason(violations: Array<{ name: string; matches: string[] }>): string {
  const details = violations.map((v) => `- ${v.name}: ${v.matches.length} 件`).join("\n");
  return [
    "型アサーション・any 型・型エラー抑制ディレクティブを含む編集を止めた:",
    details,
    "これらは TypeScript の型検査を迂回し、コンパイラが見つけるはずの不具合を隠すため。型ガード・ジェネリクス・`satisfies` で型を表し、型エラーは抑制せず原因を直す。",
  ].join("\n");
}

export const isTypeScriptFile = (filePath: string): boolean => {
  return /\.(ts|tsx|mts|cts)$/.test(filePath);
};

export const findForbiddenPatterns = (
  content: string,
): Array<{ name: string; matches: string[] }> => {
  const found: Array<{ name: string; matches: string[] }> = [];

  for (const { pattern, name } of FORBIDDEN_PATTERNS) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      found.push({ name, matches });
    }
  }

  return found;
};

type Violation = { name: string; matches: string[] };

/**
 * 編集内容から、止めるべき型アサーション・型エラー抑制を探す
 *
 * @param filePath - 編集するファイル
 * @param content - Write の content か Edit の new_string
 * @returns 見つかった違反。TypeScript 以外か本文が無ければ空
 */
function violationsToBlock(filePath: string, content: string | undefined): Violation[] {
  if (!isTypeScriptFile(filePath)) {
    logger.debug("Skipping: not a TypeScript file");
    return [];
  }
  if (!content) {
    logger.debug("Skipping: no content to check");
    return [];
  }
  const violations = findForbiddenPatterns(content);
  if (violations.length === 0) logger.debug("No forbidden patterns found");
  return violations;
}

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const input = context.input;
    if (!input) {
      return context.success({});
    }

    const toolName = input.tool_name;
    const filePath = input.tool_input.file_path;
    logger.debug(`Hook triggered: tool=${toolName}, file=${filePath}`);

    // Write: content, Edit: new_string
    const content = toolName === "Write" ? input.tool_input.content : input.tool_input.new_string;
    const violations = violationsToBlock(filePath, content);
    if (violations.length === 0) {
      return context.success({});
    }

    logger.warn(`Blocked unsafe type assertion in ${filePath}`, {
      violations: violations.map((v) => v.name),
    });
    return context.json(denyToolUse(formatDenyReason(violations)));
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

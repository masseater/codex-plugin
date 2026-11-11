#!/usr/bin/env bun
/**
 * CLAUDE.md への直接記述を AGENTS.md へ誘導するフック。
 *
 * 許可するもの:
 * - CLAUDE.md 以外のファイル
 * - ユーザー指示ファイル ~/.claude/CLAUDE.md（AGENTS.md に相当するファイルがない）
 * - AGENTS.md への symlink（Edit/Write ツール自身がリンク先の編集へ誘導する）
 * - 編集後の内容が `@AGENTS.md` を import する CLAUDE.md（公式の共有パターン）
 */
import { lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const AGENTS_MD_IMPORT = /^@\S*AGENTS\.md\s*$/m;

export type EditInput =
  | { toolName: "Write"; filePath: string; content: string }
  | {
      toolName: "Edit";
      filePath: string;
      oldString: string;
      newString: string;
      replaceAll: boolean;
    };

export type Decision = { deny: false; reason: string } | { deny: true; reason: string };

// パスの種類を返す。存在しない場合は "missing"
export function fileKind(filePath: string): "file" | "symlink" | "other" | "missing" {
  try {
    const stat = lstatSync(filePath);
    if (stat.isSymbolicLink()) return "symlink";
    return stat.isFile() ? "file" : "other";
  } catch (error) {
    // 存在しない・読めないパスは「新規作成」として扱う。判定は編集後の内容で行うので安全
    logger.debug(`lstat failed for ${filePath}: ${String(error)}`);
    return "missing";
  }
}

// 内容が AGENTS.md を import しているか
export function importsAgentsMd(content: string): boolean {
  return AGENTS_MD_IMPORT.test(content);
}

// 編集適用後の内容を求める。Edit で元ファイルが読めない場合は undefined
function contentAfterEdit(input: EditInput): string | undefined {
  if (input.toolName === "Write") return input.content;
  let current: string;
  try {
    current = readFileSync(input.filePath, "utf-8");
  } catch (error) {
    // 元ファイルが読めない Edit はツール側で失敗するので、ここでは判定しない
    logger.debug(`read failed for ${input.filePath}: ${String(error)}`);
    return undefined;
  }
  // Edit ツールは文字どおりに置換するので、`$&` などの置換パターンが解釈されないよう関数で置換する
  const replacement = () => input.newString;
  return input.replaceAll
    ? current.replaceAll(input.oldString, replacement)
    : current.replace(input.oldString, replacement);
}

export function denyReason(filePath: string): string {
  const agentsPath = path.join(path.dirname(filePath), "AGENTS.md");
  return [
    "CLAUDE.md への直接の記述は止めた。この環境ではプロジェクト指示を AGENTS.md に集約している（Claude Code は AGENTS.md を直接読み、他のコーディングエージェントとも共有できるため）。",
    `内容は ${agentsPath} に書く。CLAUDE.md を残す必要があるときは、\`@AGENTS.md\` の import 行を含めるか AGENTS.md への symlink にする。`,
  ].join("\n");
}

/**
 * ユーザー指示ファイル（~/.claude/CLAUDE.md）かを判定する
 *
 * @param filePath - 編集するファイル
 * @param home - ホームディレクトリ
 * @returns ユーザー指示ファイルなら true
 */
function isUserInstructions(filePath: string, home: string): boolean {
  return path.resolve(filePath) === path.join(home, ".claude", "CLAUDE.md");
}

function nonRegularFileReason(filePath: string): string | undefined {
  const kind = fileKind(filePath);
  return kind === "symlink" || kind === "other" ? kind : undefined;
}

/**
 * ファイルの種類から、止めずに通す理由を探す
 *
 * @param filePath - 編集するファイル
 * @param home - ホームディレクトリ
 * @returns 通す理由。止める候補なら undefined
 */
function pathExemption(filePath: string, home: string): string | undefined {
  if (path.basename(filePath) !== "CLAUDE.md") return "not CLAUDE.md";
  if (isUserInstructions(filePath, home)) return "user instructions file";
  return nonRegularFileReason(filePath);
}

/**
 * 編集後の内容から、止めずに通す理由を探す
 *
 * @param input - 編集の入力
 * @returns 通す理由。止めるべきなら undefined
 */
function contentExemption(input: EditInput): string | undefined {
  const after = contentAfterEdit(input);
  if (after === undefined) return "unreadable";
  return importsAgentsMd(after) ? "imports AGENTS.md" : undefined;
}

export function decide(input: EditInput, home: string = homedir()): Decision {
  const exemption = pathExemption(input.filePath, home) ?? contentExemption(input);
  return exemption === undefined
    ? { deny: true, reason: denyReason(input.filePath) }
    : { deny: false, reason: exemption };
}

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const input: EditInput =
      context.input.tool_name === "Write"
        ? {
            toolName: "Write",
            filePath: context.input.tool_input.file_path,
            content: context.input.tool_input.content,
          }
        : {
            toolName: "Edit",
            filePath: context.input.tool_input.file_path,
            oldString: context.input.tool_input.old_string,
            newString: context.input.tool_input.new_string,
            replaceAll: context.input.tool_input.replace_all ?? false,
          };

    const decision = decide(input);
    if (!decision.deny) {
      logger.debug(`Allowing ${input.toolName} on ${input.filePath}: ${decision.reason}`);
      return context.success({});
    }

    logger.warn(`Denying ${input.toolName} on CLAUDE.md: ${input.filePath}`);
    return context.json({
      event: "PreToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse" as const,
          permissionDecision: "deny" as const,
          permissionDecisionReason: decision.reason,
        },
      },
    });
  }),
});

/* v8 ignore start */
if (import.meta.main) {
  await runHook(hook);
}
/* v8 ignore stop */

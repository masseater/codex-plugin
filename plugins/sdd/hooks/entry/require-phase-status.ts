#!/usr/bin/env bun
/**
 * phase ファイルの frontmatter に status を必須にするフック
 * 対象: specs/{spec}/phases/phase*.md
 *
 * /sdd:status の spec-state.ts は frontmatter の `status:` だけで Phase の状態を判定するので、
 * それ以外の書式（`**状態**:` など）は受け付けない
 */
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  ALLOW,
  deny,
  respondToDecision,
  type PermissionDecision,
} from "../lib/permission-decision.ts";

using logger = HookLogger.fromFile(import.meta.filename);

export const PHASE_FILE_PATH = /specs\/[^/]+\/phases\/phase\d+-[^/]+\.md$/;

const PHASE_STATUSES = ["not_started", "in_progress", "completed", "rejected"] as const;
const STATUS_VALUES = PHASE_STATUSES.join(" | ");

export type PhaseStatusDecision = PermissionDecision;

const WRITE_MISSING_STATUS_REASON =
  `phase ファイルは先頭の frontmatter に status（${STATUS_VALUES}）が必要。spec-state.ts（/sdd:status）がこの値で Phase の状態を判定するため。\n` +
  "ファイルの先頭に次のブロックを置けば書き込める:\n" +
  "```\n" +
  "---\n" +
  "status: not_started\n" +
  "---\n" +
  "```";

const EDIT_REMOVES_STATUS_REASON = `この Edit は phase ファイルの frontmatter から status を消す。spec-state.ts（/sdd:status）が Phase の状態を判定できなくなるため、status の行は残す必要がある。状態を変える場合は status の値（${STATUS_VALUES}）だけを書き換えれば通る。`;

const INVALID_STATUS_REASON = `phase ファイルの status の値は ${STATUS_VALUES} のどれか。spec-state.ts（/sdd:status）はそれ以外の値を状態として読めない。`;

const STATUS_LINE = /^status:[ \t]*(\S*)/m;

function readStatusLine(text: string | undefined): string | undefined {
  return (text ?? "").match(STATUS_LINE)?.[1];
}

function isPhaseStatus(value: string | undefined): boolean {
  return value !== undefined && (PHASE_STATUSES as readonly string[]).includes(value);
}

/**
 * ファイル全体の内容が、先頭の frontmatter に有効な status を持つかを判定する
 * @param content - ファイル全体の内容
 * @returns 先頭の frontmatter に有効な status があれば true
 */
export function hasFrontmatterStatus(content: string): boolean {
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
  if (frontmatter === undefined) return false;
  return isPhaseStatus(readStatusLine(frontmatter));
}

function decideWrite(content: string | undefined): PhaseStatusDecision {
  return hasFrontmatterStatus(content ?? "") ? ALLOW : deny(WRITE_MISSING_STATUS_REASON);
}

/**
 * Edit の前後の status 行から、止める理由を探す
 * @param oldStatus - 置き換え前の文字列にある status の値
 * @param newStatus - 置き換え後の文字列にある status の値
 * @returns 止める理由。止めないなら undefined
 */
function editViolation(
  oldStatus: string | undefined,
  newStatus: string | undefined,
): string | undefined {
  if (newStatus === undefined) {
    return oldStatus === undefined ? undefined : EDIT_REMOVES_STATUS_REASON;
  }
  return isPhaseStatus(newStatus) ? undefined : INVALID_STATUS_REASON;
}

// Edit は差分しか見えないので、status の行を消すか、読めない値に変える場合だけ止める
function decideEdit(
  oldString: string | undefined,
  newString: string | undefined,
): PhaseStatusDecision {
  const violation = editViolation(readStatusLine(oldString), readStatusLine(newString));
  return violation === undefined ? ALLOW : deny(violation);
}

/**
 * Write/Edit の入力から phase ファイルの status 要件を判定する
 * @param input - 判定対象の Write/Edit 操作情報
 * @returns 許可または拒否理由を含む判定結果
 */
export function decideRequirePhaseStatus(input: {
  filePath: string;
  toolName: "Write" | "Edit";
  content?: string;
  oldString?: string;
  newString?: string;
}): PhaseStatusDecision {
  if (!PHASE_FILE_PATH.test(input.filePath)) return ALLOW;
  return input.toolName === "Write"
    ? decideWrite(input.content)
    : decideEdit(input.oldString, input.newString);
}

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const filePath: string = context.input.tool_input.file_path;
    const toolName = context.input.tool_name;

    const result =
      toolName === "Write"
        ? decideRequirePhaseStatus({
            filePath,
            toolName: "Write",
            content: context.input.tool_input.content,
          })
        : decideRequirePhaseStatus({
            filePath,
            toolName: "Edit",
            oldString: context.input.tool_input.old_string,
            newString: context.input.tool_input.new_string,
          });

    return respondToDecision(context, result);
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

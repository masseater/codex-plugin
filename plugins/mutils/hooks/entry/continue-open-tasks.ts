#!/usr/bin/env bun
/**
 * ターン終了時に、このセッションのタスクリストに未完了の項目があれば名指しして継続させるフック。
 *
 * task-history hook が記録した task_events からセッションの未完了項目を復元する。
 * 同じ未完了項目の組み合わせで継続させるのは最大 MAX_CONTINUATIONS 回までにし、
 * ユーザーの入力待ちなどで進められない場合に無限に継続させない。
 * background のコマンド・サブエージェント・予約済みの再開がある間は、それらがセッションを
 * 再開させるので継続させない。
 *
 * 継続させないターンでは、ターン終了のデスクトップ通知（lib/notification.ts）も出す。Stop の hook は
 * 並列に動くので、通知を別 hook にすると継続させるターンでも通知が出てしまうため、ここにまとめている。
 */
import { findGitRoot, HookLogger, MutilsDB, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { notifyTurnEnd } from "../lib/notification.js";
import { type OpenTask, openTasks } from "../lib/open-tasks.js";
import { TASK_EVENTS_SCHEMA, type TaskEvent } from "../lib/task-events-schema.js";

using logger = HookLogger.fromFile(import.meta.filename);

export const MAX_CONTINUATIONS = 2;

type ContinuationState = { session_id: string; open_key: string; count: number };

const CONTINUATIONS_SCHEMA = {
  columns: `
		session_id TEXT PRIMARY KEY,
		open_key TEXT NOT NULL,
		count INTEGER NOT NULL
	`,
} as const;

/**
 * 未完了項目の組み合わせを表すキー（順序に依存しない）
 *
 * @param open - 未完了のタスク
 * @returns キー文字列
 */
export function openKey(open: OpenTask[]): string {
  return open
    .map((t) => t.key)
    .toSorted()
    .join("\n");
}

/**
 * 継続させるかを決め、次の状態を返す
 *
 * @param open - 未完了のタスク
 * @param prev - 前回の状態（無ければ undefined）
 * @returns 継続するか、保存する状態（undefined なら状態を消す）
 */
export function decideContinuation(
  open: OpenTask[],
  prev: { open_key: string; count: number } | undefined,
): { continue: boolean; next: { open_key: string; count: number } | undefined } {
  if (open.length === 0) return { continue: false, next: undefined };
  const key = openKey(open);
  const count = previousCount(key, prev);
  if (count >= MAX_CONTINUATIONS) return { continue: false, next: { open_key: key, count } };
  return { continue: true, next: { open_key: key, count: count + 1 } };
}

/**
 * 同じ未完了項目の組み合わせで、これまでに継続させた回数
 *
 * @param key - 今回の未完了項目のキー
 * @param prev - 前回の状態
 * @returns 前回と同じ組み合わせなら前回までの回数、違えば 0
 */
function previousCount(key: string, prev: { open_key: string; count: number } | undefined): number {
  return prev?.open_key === key ? prev.count : 0;
}

function hasItems(list: unknown[] | undefined): boolean {
  return (list?.length ?? 0) > 0;
}

/**
 * background のタスクや予約済みの再開を待っているか
 *
 * @param input - Stop 入力の background_tasks / session_crons
 * @returns 待っているなら true
 */
export function isWaitingOnBackground(input: {
  background_tasks?: unknown[];
  session_crons?: unknown[];
}): boolean {
  return hasItems(input.background_tasks) || hasItems(input.session_crons);
}

/**
 * Claude に渡す文
 *
 * @param open - 未完了のタスク
 * @returns additionalContext の文字列
 */
export function formatContinuation(open: OpenTask[]): string {
  const items = open.map((t) => `- ${t.subject}（${t.status}）`);
  return [
    "このセッションのタスクリストに未完了の項目が残っている:",
    ...items,
    "残っている項目を進める。ユーザーの入力や外部の状況待ちで進められない項目は、何に阻まれているかを書く。もう不要な項目は完了か削除に更新する。",
    "計画の承認や質問への回答を待つためにこのターンを止めたのなら、そのまま止めてよい。",
  ].join("\n");
}

/**
 * ターン終了の通知を出す。通知は最善努力なので、失敗しても Stop の判定は止めない
 *
 * @param input - Stop 入力
 */
function notify(input: { last_assistant_message?: string; transcript_path?: string }): void {
  try {
    notifyTurnEnd(input);
  } catch (error) {
    // 通知は利便のための最善努力で、失敗してもセッションの進行に影響しない。原因は warn で残す
    logger.warn(`Failed to send notification: ${String(error)}`);
  }
}

type StopInput = {
  cwd: string;
  session_id: string;
  background_tasks?: unknown[];
  session_crons?: unknown[];
};

type ContinuationDecision = ReturnType<typeof decideContinuation>;

/**
 * 継続を判定する対象のリポジトリを決める。判定しない場合は理由をログに残す
 *
 * @param input - Stop 入力
 * @returns git のルート。git 管理外か background を待っているなら null
 */
function gitRootToCheck(input: StopInput): string | null {
  const gitRoot = findGitRoot(input.cwd);
  if (gitRoot === null) {
    logger.debug("Skipping: not a git repository");
    return null;
  }
  if (isWaitingOnBackground(input)) {
    logger.debug("Skipping: background tasks or scheduled wakeups are pending");
    return null;
  }
  return gitRoot;
}

/**
 * セッションの未完了タスクから継続を判定し、次の状態を保存する
 *
 * @param gitRoot - mutils DB のあるリポジトリ
 * @param sessionId - 対象のセッション
 * @returns 未完了のタスクと判定結果
 */
function decideForSession(
  gitRoot: string,
  sessionId: string,
): { open: OpenTask[]; decision: ContinuationDecision } {
  using db = MutilsDB.open(gitRoot);
  const events = db
    .table<TaskEvent>("task_events", TASK_EVENTS_SCHEMA)
    .findAll("session_id = ? ORDER BY created_at, id", [sessionId]);
  const open = openTasks(events);

  const stateTable = db.table<ContinuationState>("stop_continuations", CONTINUATIONS_SCHEMA);
  const prev = stateTable.findOne("session_id = ?", [sessionId]) ?? undefined;
  const decision = decideContinuation(open, prev);

  if (decision.next) {
    stateTable.upsert({ session_id: sessionId, ...decision.next });
  } else {
    stateTable.delete("session_id = ?", [sessionId]);
  }
  return { open, decision };
}

function continuationCount(decision: ContinuationDecision): number {
  return decision.next?.count ?? 0;
}

/**
 * 継続させるなら additionalContext を返し、継続させないなら通知して何も返さない
 *
 * @param input - Stop 入力
 * @returns 継続させる文。継続させないなら undefined
 */
function decide(input: StopInput): string | undefined {
  const gitRoot = gitRootToCheck(input);
  if (gitRoot === null) return undefined;

  const { open, decision } = decideForSession(gitRoot, input.session_id);
  if (!decision.continue) {
    logger.debug(`No continuation: open=${open.length}, count=${continuationCount(decision)}`);
    return undefined;
  }

  logger.info(`Continuing with ${open.length} open task(s), count=${continuationCount(decision)}`);
  return formatContinuation(open);
}

export const hook = defineHook({
  trigger: { Stop: true },
  run: wrapRun(logger, (context) => {
    const additionalContext = decide(context.input);
    if (additionalContext === undefined) {
      notify(context.input);
      return context.success({});
    }

    return context.json({
      event: "Stop" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "Stop" as const,
          additionalContext,
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

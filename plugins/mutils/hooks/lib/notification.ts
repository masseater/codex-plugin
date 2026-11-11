/**
 * ターン終了時のデスクトップ通知（macOS の terminal-notifier）。
 * continue-open-tasks（Stop）が、継続させないと決めたターンだけで呼ぶ。Stop の hook は並列に動くので、
 * 別 hook にすると継続させるターンでも「完了」通知が出てしまうため、継続判定と同じ hook に置いている。
 */
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { HookLogger } from "@r_masseater/cc-plugin-lib";
import { resolveTranscriptPath, extractLastAssistantMessage } from "./transcript.js";

using logger = HookLogger.fromFile(import.meta.filename);

/**
 * terminal-notifier が PATH にあるか
 * @returns 使えるなら true
 */
function isNotifierAvailable(): boolean {
  try {
    execFileSync("which", ["terminal-notifier"], { stdio: "ignore" });
    return true;
  } catch (error) {
    // terminal-notifier の無い環境（Linux など）では通知を省くだけでよい
    logger.debug(`terminal-notifier not found: ${String(error)}`);
    return false;
  }
}

/**
 * target が base の中にあるかを判定する。前方一致だけで判定すると `projects-other` のような隣のディレクトリも通るため、相対パスで確かめる
 *
 * @param base - 基準のディレクトリ
 * @param target - 判定するパス
 * @returns base の中なら true
 */
function isInside(base: string, target: string): boolean {
  const fromBase = path.relative(base, target);
  return fromBase !== "" && !fromBase.startsWith("..") && !path.isAbsolute(fromBase);
}

/**
 * last_assistant_message が無い古い Claude Code 向けに transcript から本文を読む
 *
 * @param transcriptPath - Stop 入力の transcript_path
 * @returns 本文。読めなければ undefined
 */
function readFromTranscript(transcriptPath: string | undefined): string | undefined {
  if (!transcriptPath) {
    logger.debug("Skipping transcript: no transcript_path provided");
    return undefined;
  }
  const resolvedPath = resolveTranscriptPath(transcriptPath);
  const allowedBase = path.join(os.homedir(), ".claude", "projects");
  if (!isInside(allowedBase, resolvedPath)) {
    logger.debug(`Skipping transcript: path not under allowed base (${allowedBase})`);
    return undefined;
  }
  return extractLastAssistantMessage(resolvedPath);
}

function lastMessageOf(input: {
  last_assistant_message?: string | undefined;
  transcript_path?: string | undefined;
}): string | undefined {
  return input.last_assistant_message || readFromTranscript(input.transcript_path);
}

function previewOf(message: string): string {
  return `${message.slice(0, 100)}${message.length > 100 ? "..." : ""}`;
}

/**
 * 最後の assistant メッセージをデスクトップ通知に出す。terminal-notifier が無ければ何もしない
 *
 * @param input - Stop 入力の last_assistant_message / transcript_path
 */
export function notifyTurnEnd(input: {
  last_assistant_message?: string | undefined;
  transcript_path?: string | undefined;
}): void {
  if (!isNotifierAvailable()) {
    return;
  }

  const lastMessageContent = lastMessageOf(input);
  if (lastMessageContent === undefined) {
    logger.debug("Skipping: no assistant message text found");
    return;
  }

  logger.debug(`Sending notification: "${previewOf(lastMessageContent)}"`);
  execFileSync(
    "terminal-notifier",
    [
      "-title",
      `Claude (${path.basename(process.cwd())})`,
      "-message",
      lastMessageContent,
      "-execute",
      "code -r",
    ],
    {
      stdio: "ignore",
    },
  );
  logger.info("Notification sent successfully");
}

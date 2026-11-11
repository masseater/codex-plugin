#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { getSessionState, updateSessionState } from "../lib/session-state.ts";
import { expandHome } from "../lib/home-path.ts";
import { MIN_ASSISTANT_MESSAGES, countAssistantMessages } from "../lib/transcript.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const STOP_COUNT_THRESHOLD = 3;

// 継続させるのは 1 セッション 1 回まで。prompted フラグで上限を担保する。
export const SESSION_NOTE_MESSAGE =
  "[Zettelkasten] このセッションに残す価値のある知見（発見・パターン・設計判断）があれば、" +
  "`obsidian:vault-maintainer` エージェントに書き出しを依頼する。" +
  "セッションが終わると文脈が失われるため、今のうちに残す。" +
  "残す知見が無ければ何もせずに終了してよい。";

/**
 * このセッションの Stop を数える。促し済みのセッションや、Stop hook からの継続中は数えない
 *
 * @param stopHookActive - このターンで既に Stop hook から継続しているか
 * @param sessionId - 対象のセッション
 * @returns 数えた後の Stop の回数。数えない場合は undefined
 */
function countStop(stopHookActive: boolean, sessionId: string): number | undefined {
  if (stopHookActive) {
    logger.debug("Skipping: stop hook already continued this turn");
    return undefined;
  }
  const state = getSessionState(sessionId, logger.debug.bind(logger));
  if (state.prompted) {
    logger.debug("Skipping: already prompted this session");
    return undefined;
  }
  const stopCount = state.stopCount + 1;
  updateSessionState(sessionId, { stopCount });
  logger.debug(`Stop count: ${stopCount}/${STOP_COUNT_THRESHOLD}`);
  return stopCount;
}

function readMessageCount(transcriptPath: string): number | undefined {
  try {
    return countAssistantMessages(expandHome(transcriptPath), logger.debug.bind(logger));
  } catch (error) {
    // transcript が読めないときは促しを省略するだけで、セッションの終了は妨げない。
    logger.debug("Skipping: failed to read transcript", { error });
    return undefined;
  }
}

/**
 * 知見を書き出す価値があるほど会話が進んだかを確かめる
 *
 * @param transcriptPath - Stop 入力の transcript_path
 * @returns assistant のメッセージ数。足りないか数えられなければ undefined
 */
function substantialMessageCount(transcriptPath: string | undefined): number | undefined {
  if (!transcriptPath) {
    logger.debug("Skipping: no transcript_path");
    return undefined;
  }
  const messageCount = readMessageCount(transcriptPath) ?? 0;
  if (messageCount < MIN_ASSISTANT_MESSAGES) {
    logger.debug(`Skipping: only ${messageCount} messages (min: ${MIN_ASSISTANT_MESSAGES})`);
    return undefined;
  }
  return messageCount;
}

const hook = defineHook({
  trigger: {
    Stop: true,
  },
  run: wrapRun(logger, (context) => {
    const sessionId = context.input.session_id;
    const stopCount = countStop(context.input.stop_hook_active, sessionId);
    if (stopCount === undefined || stopCount < STOP_COUNT_THRESHOLD) {
      return context.success({});
    }

    const messageCount = substantialMessageCount(context.input.transcript_path);
    if (messageCount === undefined) {
      return context.success({});
    }

    updateSessionState(sessionId, { prompted: true });
    logger.info(`Prompting note-taking (${messageCount} messages, stop #${stopCount})`);
    return context.json({
      event: "Stop" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "Stop" as const,
          additionalContext: SESSION_NOTE_MESSAGE,
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { ensureTable, getThreadId, openDb } from "../lib/db.ts";
import { sendMessage, splitMessage } from "../lib/discord-api.ts";
import { readDiscordEnv } from "../lib/env.ts";

using logger = HookLogger.fromFile(import.meta.filename);

/**
 * セッションのスレッドに、最終応答を分割して順に投稿する
 *
 * @param db - スレッド ID を記録した DB
 * @param sessionId - 対象のセッション
 * @param botToken - Bot のトークン
 * @param message - 最終応答
 */
async function postToSessionThread(
  db: ReturnType<typeof openDb>,
  sessionId: string,
  botToken: string,
  message: string,
): Promise<void> {
  ensureTable(db);
  const threadId = getThreadId(db, sessionId);
  if (!threadId) {
    logger.warn(`No thread found for session ${sessionId}`);
    return;
  }

  // メッセージを分割して順次送信（絶対にstripしない）
  // 順序保証のため意図的に直列実行
  const chunks = splitMessage(message);
  for (const chunk of chunks) {
    await sendMessage(threadId, botToken, chunk);
  }
  logger.info(`Posted ${chunks.length} message(s) to thread ${threadId}`);
}

const hook = defineHook({
  trigger: { Stop: true },
  run: wrapRun(logger, async (context) => {
    // stop_hook_active では止めない。この hook は Stop を継続させないのでループせず、
    // 他の Stop hook が継続させた後の最終応答も Discord に届ける必要がある
    const env = readDiscordEnv();
    if (!env) {
      logger.debug("Plugin inactive (DISCORD_NOTIFY_CHANNEL_ID not set)");
      return context.success({});
    }

    const message = context.input.last_assistant_message;
    if (!message) {
      logger.debug("No last_assistant_message, skipping");
      return context.success({});
    }

    const db = openDb();
    try {
      await postToSessionThread(db, context.input.session_id, env.botToken, message);
    } catch (error) {
      // Discord 通知は best-effort。失敗してもセッションを止めないため、伝播せず error ログだけ残す
      logger.error("Failed to send Discord message", { err: error });
    } finally {
      db.close();
    }

    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

export { hook };

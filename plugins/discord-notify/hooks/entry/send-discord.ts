#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { ensureTable, getThreadId, openDb } from "../lib/db.ts";
import { sendMessage, splitMessage } from "../lib/discord-api.ts";
import { readDiscordEnv } from "../lib/env.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: { Stop: true },
  run: wrapRun(logger, async (context) => {
    // 再帰防止: Stop hookがblockを返した場合の2回目呼び出しをスキップ
    if (context.input.stop_hook_active) {
      logger.debug("Skipping: stop_hook_active is true");
      return context.success({});
    }

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
      const { botToken } = env;
      const sessionId = context.input.session_id;

      ensureTable(db);
      const threadId = getThreadId(db, sessionId);

      if (!threadId) {
        logger.warn(`No thread found for session ${sessionId}`);
        return context.success({});
      }

      // メッセージを分割して順次送信（絶対にstripしない）
      // 順序保証のため意図的に直列実行
      const chunks = splitMessage(message);
      for (const chunk of chunks) {
        await sendMessage(threadId, botToken, chunk);
      }

      logger.info(`Posted ${chunks.length} message(s) to thread ${threadId}`);
    } catch (error) {
      logger.error(`Failed to send Discord message: ${error}`);
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

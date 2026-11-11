#!/usr/bin/env bun
import { basename } from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { ensureTable, getThreadId, openDb, saveSession } from "../lib/db.ts";
import { createThread, sendMessage } from "../lib/discord-api.ts";
import { readDiscordEnv } from "../lib/env.ts";

using logger = HookLogger.fromFile(import.meta.filename);

function formatThreadName(cwd: string): string {
  const project = basename(cwd);
  const now = new Date();
  const date = now.toLocaleDateString("sv-SE"); // YYYY-MM-DD
  const time = now.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  }); // HH:mm
  return `${project} ${date} ${time}`;
}

const hook = defineHook({
  trigger: { SessionStart: true },
  run: wrapRun(logger, async (context) => {
    const env = readDiscordEnv();
    if (!env) {
      logger.debug("Plugin inactive (DISCORD_NOTIFY_CHANNEL_ID not set)");
      return context.success({});
    }

    const db = openDb();
    try {
      const { channelId, botToken } = env;
      const sessionId = context.input.session_id;

      ensureTable(db);
      const existingThread = getThreadId(db, sessionId);

      if (existingThread) {
        // resume/clear/compact: 既存スレッドにステータス通知
        await sendMessage(existingThread, botToken, "Session resumed");
        logger.info(`Posted resume notice to thread ${existingThread}`);
      } else {
        // startup: 新規スレッド作成
        const threadName = formatThreadName(context.input.cwd);
        const msg = await sendMessage(channelId, botToken, `Session started: ${threadName}`);
        const thread = await createThread(channelId, msg.id, botToken, threadName);
        saveSession(db, sessionId, thread.id);
        logger.info(`Thread created: ${thread.id} for session ${sessionId}`);
      }
    } catch (error) {
      logger.error(`Failed to handle Discord session event: ${error}`);
    } finally {
      db.close();
    }

    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

export { formatThreadName, hook };

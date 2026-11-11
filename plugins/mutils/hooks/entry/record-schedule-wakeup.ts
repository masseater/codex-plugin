#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { asRecord } from "../lib/json-value.js";

using logger = HookLogger.fromFile(import.meta.filename);

export function computeWakeupRecord(
  sessionId: string,
  delaySeconds: number,
  reason: string,
  nowEpochSec: number,
): { fireAt: number; reason: string; delaySeconds: number; sessionId: string } {
  return {
    fireAt: nowEpochSec + delaySeconds,
    reason,
    delaySeconds,
    sessionId,
  };
}

export function resolveWakeupFilePath(cacheDir: string, sessionId: string): string {
  return join(cacheDir, `wakeup-${sessionId}.json`);
}

function reasonOf(toolInput: Record<string, unknown>): string {
  return typeof toolInput.reason === "string" ? toolInput.reason : "";
}

/**
 * statusline が読む予約済み再開の記録の置き場所。
 *
 * @returns CLAUDE_CONFIG_DIR（既定は ~/.claude）配下の cache/statusline
 */
function wakeupCacheDir(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  return join(configDir, "cache", "statusline");
}

const hook = defineHook({
  trigger: {
    PostToolUse: true,
  },
  run: wrapRun(logger, (context) => {
    if (context.input.tool_name !== "ScheduleWakeup") {
      return context.success({});
    }

    const sessionId = context.input.session_id;
    const toolInput = asRecord(context.input.tool_input);
    const delaySeconds = Number(toolInput.delaySeconds ?? 0);
    const reason = reasonOf(toolInput);

    const record = computeWakeupRecord(
      sessionId,
      delaySeconds,
      reason,
      Math.floor(Date.now() / 1000),
    );

    const cacheDir = wakeupCacheDir();
    mkdirSync(cacheDir, { recursive: true });

    const wakeupFile = resolveWakeupFilePath(cacheDir, sessionId);
    writeFileSync(wakeupFile, JSON.stringify(record));

    logger.info(`Recorded wakeup: ${delaySeconds}s (${reason})`);
    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

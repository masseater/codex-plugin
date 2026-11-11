#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { clearPersona, resolveProjectDir, resolveStateFile } from "../lib/state.ts";

using logger = HookLogger.fromFile(import.meta.filename);

// state を消すのは /clear で終わったときだけにする。それ以外の終了（exit・/resume での切替など）は
// 後で --resume / --continue で同じ session_id に戻りうるので、announce-persona が再注入できるよう残す。
// state は session_id ごとのファイルなので、残しても他セッションとは衝突しない。
const hook = defineHook({
  trigger: { SessionEnd: true },
  run: wrapRun(logger, (context) => {
    if (context.input.reason !== "clear") {
      logger.debug(`Keeping persona state (SessionEnd reason: ${context.input.reason})`);
      return context.success({});
    }

    const projectDir = resolveProjectDir();
    if (!projectDir) {
      return context.success({});
    }

    const sessionId = context.input.session_id;
    const stateFile = resolveStateFile(projectDir, sessionId);
    clearPersona(stateFile);
    logger.debug(`Cleared persona state for session ${sessionId}`);
    return context.success({});
  }),
});

/* v8 ignore start */
if (import.meta.main) {
  await runHook(hook);
}
/* v8 ignore stop */

#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { denyToolUse } from "../lib/pre-tool-use.js";

using logger = HookLogger.fromFile(import.meta.filename);

const HUSKY_BYPASS_PATTERN = /\bHUSKY\s*=\s*0\b/;

export function isHuskyBypassCommand(command: string): boolean {
  return HUSKY_BYPASS_PATTERN.test(command);
}

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Bash: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const input = context.input;
    if (!input) {
      return context.success({});
    }

    const command = input.tool_input.command;
    if (!command || !isHuskyBypassCommand(command)) {
      return context.success({});
    }

    const reason =
      "HUSKY=0 で git hook を無効にするコマンドは止めた（lint-staged と検査を通らないコミットが入るため）。HUSKY=0 を外して実行し、hook が失敗したら原因を直す。";

    logger.warn("Blocked HUSKY=0 bypass attempt", { command });

    return context.json(denyToolUse(reason));
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

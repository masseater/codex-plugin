#!/usr/bin/env bun
/**
 * ファイル編集時に oxlint を実行してリントエラーをフィードバックするフック
 */
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const isTypeScriptFile = (filePath: string): boolean => /\.(ts|tsx)$/.test(filePath);

const hook = defineHook({
  trigger: {
    PostToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, async (context) => {
    const filePath = context.input.tool_input.file_path;

    if (!isTypeScriptFile(filePath)) {
      logger.debug(`Skipping: not a .ts/.tsx file: ${filePath}`);
      return context.success({});
    }

    logger.debug(`Running oxlint on ${filePath}`);

    const proc = Bun.spawn(["oxlint", filePath], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    const output = [stdout, stderr].filter(Boolean).join("\n").trim();

    if (exitCode === 0) {
      logger.debug(`oxlint: no issues found in ${filePath}`);
      return context.success({});
    }

    logger.info(`oxlint: issues found in ${filePath}`);
    return context.json({
      event: "PostToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PostToolUse" as const,
          additionalContext: `oxlint results for ${filePath}:\n${output}`,
        },
        suppressOutput: true,
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

/** ESLint Language Server のコマンド名 */
export const SERVER_COMMAND = "vscode-eslint-language-server";

using logger = HookLogger.fromFile(import.meta.filename);

/**
 * vscode-eslint-language-serverがインストールされているかチェック
 * whichコマンドでPATH上にあるか確認
 */
export async function isServerInstalled(): Promise<boolean> {
  const proc = Bun.spawn(["which", SERVER_COMMAND], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  return exitCode === 0;
}

/** サーバー未インストール時の警告メッセージを生成 */
export function buildNotInstalledMessage(command: string): string {
  return `⚠️ ESLint Language Server not found!

${command} is required for ESLint LSP integration.

Install it with:
  npm install -g ${command}

After installation, restart Claude Code.`;
}

const hook = defineHook({
  trigger: {
    SessionStart: true,
  },
  run: wrapRun(logger, async (context) => {
    const installed = await isServerInstalled();

    if (installed) {
      logger.debug(`${SERVER_COMMAND} is installed`);
      return context.success({});
    }

    logger.warn(`${SERVER_COMMAND} is not installed`);

    const message = buildNotInstalledMessage(SERVER_COMMAND);

    return context.json({
      event: "SessionStart" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "SessionStart" as const,
          additionalContext: message,
        },
      },
    });
  }),
});

/* v8 ignore next 3 -- CLI entry point, not testable in vitest */
if (import.meta.main) {
  await runHook(hook);
}

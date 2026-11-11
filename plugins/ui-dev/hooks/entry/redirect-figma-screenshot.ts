#!/usr/bin/env bun
/**
 * Figma MCP の get_screenshot を拒否し、REST API でファイルに保存するスクリプトへ誘導する。
 * hooks/hooks.json の PreToolUse（matcher: mcp__.*figma.*__get_screenshot）から呼ばれる。
 */
import path from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

export const EXPORT_SCREENSHOT_SCRIPT = path.resolve(
  import.meta.dirname,
  "../../skills/figma-data/scripts/export-screenshot.ts",
);

export const DENY_REASON =
  "Figma のスクリーンショットはファイルに保存して、レビューや画像比較で再利用する。" +
  `次のコマンドで保存してから Read で読む: ${EXPORT_SCREENSHOT_SCRIPT} ` +
  "--file-key <fileKey> --node-id <nodeId> --output <path.png> [--scale 2]";

const hook = defineHook({
  trigger: { PreToolUse: true },
  run: wrapRun(logger, (context) => {
    logger.info("Denying get_screenshot and redirecting to export-screenshot.ts");

    return context.json({
      event: "PreToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse" as const,
          permissionDecision: "deny" as const,
          permissionDecisionReason: DENY_REASON,
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

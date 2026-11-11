#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  extractActionRefs,
  findOutdatedActions,
  formatSuggestions,
  isGitHubWorkflowFile,
  readWorkflowContent,
} from "../lib/actions-versions.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: {
    PostToolUse: {
      Write: true,
      Edit: true,
    },
  },
  // hooks.json で async: true にしているので、タグの取得を待ってから結果を 1 回だけ返す。
  // async hook の出力は次のターンで Claude に渡る
  run: wrapRun(logger, async (context) => {
    const filePath = context.input.tool_input.file_path;
    if (!isGitHubWorkflowFile(filePath)) {
      return context.success({});
    }

    const additionalContext = await outdatedActionsSuggestion(filePath);
    if (!additionalContext) {
      return context.success({});
    }

    logger.info(additionalContext);
    return context.json({
      event: "PostToolUse",
      output: {
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext },
      },
    });
  }),
});

/**
 * workflow ファイルの action のうち、新しい major version があるものの提案文を作る。
 *
 * @param filePath - 編集された workflow ファイル
 * @returns 提案文。読めない・action が無い・すべて最新なら undefined
 */
async function outdatedActionsSuggestion(filePath: string): Promise<string | undefined> {
  const content = readWorkflowContent(filePath);
  if (!content) {
    logger.debug(`Failed to read workflow file: ${filePath}`);
    return undefined;
  }

  const refs = extractActionRefs(content);
  if (refs.length === 0) return undefined;

  logger.info(`Found ${refs.length} action ref(s) in ${filePath}, checking for updates...`);
  const outdated = await findOutdatedActions(refs);
  if (outdated.length === 0) {
    logger.info("All actions are up to date.");
    return undefined;
  }
  return formatSuggestions(outdated);
}

if (import.meta.main) {
  await runHook(hook);
}

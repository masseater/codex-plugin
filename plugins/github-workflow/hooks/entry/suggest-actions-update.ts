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

const FETCH_TIMEOUT_MS = 30_000;

const hook = defineHook({
  trigger: {
    PostToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const filePath = context.input.tool_input.file_path;

    if (!isGitHubWorkflowFile(filePath)) {
      return context.success({});
    }

    const content = readWorkflowContent(filePath);
    if (!content) {
      logger.debug(`Failed to read workflow file: ${filePath}`);
      return context.success({});
    }

    const refs = extractActionRefs(content);
    if (refs.length === 0) {
      return context.success({});
    }

    logger.info(`Found ${refs.length} action ref(s) in ${filePath}, checking for updates...`);

    return context.defer(
      async () => {
        const outdated = await findOutdatedActions(refs);

        if (outdated.length === 0) {
          logger.info("All actions are up to date.");
          return {
            event: "PostToolUse" as const,
            output: {},
          };
        }

        const additionalContext = formatSuggestions(outdated);
        logger.info(additionalContext);

        return {
          event: "PostToolUse" as const,
          output: {
            hookSpecificOutput: {
              hookEventName: "PostToolUse" as const,
              additionalContext,
            },
          },
        };
      },
      { timeoutMs: FETCH_TIMEOUT_MS },
    );
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

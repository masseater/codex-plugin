#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

type StatusItem = {
  status: "pending" | "in_progress" | "completed";
};

function findJsonFiles(dir: string, predicate: (filename: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(predicate)
    .map((f) => path.join(dir, f));
}

function parseJsonFiles<T>(filePaths: string[], transform: (parsed: unknown) => T[]): T[] {
  const items: T[] = [];
  for (const filePath of filePaths) {
    try {
      const content = readFileSync(filePath, "utf-8");
      items.push(...transform(JSON.parse(content)));
    } catch (error) {
      logger.debug(`Failed to parse: ${filePath} - ${String(error)}`);
    }
  }
  return items;
}

function getAllItems(sessionId: string): StatusItem[] {
  const legacyFiles = findJsonFiles(
    path.join(os.homedir(), ".claude", "todos"),
    (f) => f.startsWith(`${sessionId}-agent-`) && f.endsWith(".json"),
  );
  const legacyItems = parseJsonFiles<StatusItem>(legacyFiles, (parsed) =>
    Array.isArray(parsed) ? parsed : [],
  );

  const taskFiles = findJsonFiles(path.join(os.homedir(), ".claude", "tasks", sessionId), (f) =>
    f.endsWith(".json"),
  );
  const taskItems = parseJsonFiles<StatusItem>(taskFiles, (parsed) => {
    const task = parsed as { id?: string; status?: string };
    return task.id && task.status ? [task as StatusItem] : [];
  });

  logger.debug(
    `Found ${legacyItems.length} legacy todo(s) + ${taskItems.length} task(s) for session ${sessionId}`,
  );

  legacyItems.push(...taskItems);
  return legacyItems;
}

const hook = defineHook({
  trigger: {
    UserPromptSubmit: true,
    Stop: true,
  },
  run: wrapRun(logger, (context) => {
    const event = context.input.hook_event_name;

    if (event === "UserPromptSubmit") {
      const sessionId = context.input.session_id;
      if (!sessionId) return context.success({});

      if (getAllItems(sessionId).length > 0) {
        logger.debug("TODOs already exist, skipping suggestion");
        return context.success({});
      }

      logger.info("No TODOs found, suggesting creation");
      return context.json({
        event: "UserPromptSubmit" as const,
        output: {
          hookSpecificOutput: {
            hookEventName: "UserPromptSubmit" as const,
            additionalContext: [
              "MANDATORY: Use TaskCreate NOW, before any other action or response.",
              "No TODOs exist. This violates AGENTS.md task management rules.",
              "'Just a question' or 'simple task' is NOT an exemption. Create TODOs first.",
            ].join("\n"),
          },
        },
      });
    }

    if (event === "Stop") {
      if ("stop_hook_active" in context.input && context.input.stop_hook_active) {
        logger.debug("Skipping: stop_hook_active is true");
        return context.success({});
      }

      const sessionId = context.input.session_id;
      if (!sessionId) return context.success({});

      const allItems = getAllItems(sessionId);
      if (allItems.length === 0) return context.success({});

      const incomplete = allItems.filter((item) => item.status !== "completed");
      if (incomplete.length === 0) {
        logger.debug("All TODOs are completed");
        return context.success({});
      }

      logger.info(`Found ${incomplete.length} incomplete TODO(s), blocking stop`);

      return context.json({
        event: "Stop" as const,
        output: {
          decision: "block" as const,
          reason: [
            `${incomplete.length} incomplete TODO(s) remaining.`,
            "Update TODOs to reflect the current state: mark finished items as completed and note any remaining work.",
            "Before asking the user, reconsider whether you truly need user input or can resolve it yourself.",
          ].join("\n"),
        },
      });
    }

    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

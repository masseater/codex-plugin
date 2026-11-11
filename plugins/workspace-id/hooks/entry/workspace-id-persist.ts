#!/usr/bin/env bun
import { existsSync } from "node:fs";
import path from "node:path";
import { findGitRoot, HookLogger, MutilsDB, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

type WorkspaceMapping = {
  id?: number;
  workspace_id: string;
  feature_name: string;
  created_at: string;
};

const WORKSPACE_MAPPINGS_SCHEMA = {
  columns: `
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		workspace_id TEXT NOT NULL UNIQUE,
		feature_name TEXT NOT NULL,
		created_at TEXT NOT NULL
	`,
  indexes: [
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_mappings_workspace_id ON workspace_mappings(workspace_id)",
  ],
} as const;

/**
 * Get the latest workspace mapping from DB
 */
function getLatestWorkspaceMapping(cwd: string): WorkspaceMapping | null {
  try {
    using db = MutilsDB.open(cwd);
    const table = db.table<WorkspaceMapping>("workspace_mappings", WORKSPACE_MAPPINGS_SCHEMA);
    // Get the most recent entry
    const all = table.findAll("1=1 ORDER BY id DESC LIMIT 1", []);
    return all[0] ?? null;
  } catch (error) {
    logger.error(`Failed to get workspace mapping: ${error}`);
    return null;
  }
}

const hook = defineHook({
  trigger: {
    SessionStart: true,
  },
  run: wrapRun(logger, (context) => {
    const cwd = process.cwd();
    const eventType = context.input.hook_event_name;

    // Handle SessionStart - restore workspace-id after compact or resume
    if (eventType === "SessionStart") {
      // Check git repository and .agents directory
      const gitRoot = findGitRoot(cwd);
      if (gitRoot === null) {
        logger.debug("Skipping: not a git repository");
        return context.success({});
      }

      const agentsDir = path.join(gitRoot, ".agents");
      if (!existsSync(agentsDir)) {
        logger.debug("Skipping: .agents directory does not exist");
        return context.success({});
      }

      const source =
        "source" in context.input && typeof context.input.source === "string"
          ? context.input.source
          : "startup";

      logger.debug(`SessionStart source: ${source}`);

      // Only restore on compact or resume
      if (source !== "compact" && source !== "resume") {
        logger.debug("Not a compact/resume session, skipping");
        return context.success({});
      }

      const mapping = getLatestWorkspaceMapping(gitRoot);

      if (!mapping) {
        logger.debug("No workspace mapping found");
        return context.success({});
      }

      logger.info(`Restored workspace-id: ${mapping.workspace_id}`);

      const sourceDescription = source === "compact" ? "Auto Compact" : "session resume";

      // Provide restored workspace-id to Claude
      return context.json({
        event: "SessionStart",
        output: {
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: `Workspace ID Restored: ${mapping.workspace_id}

The previous workspace-id has been restored after ${sourceDescription}. Continue using this workspace-id for your work.

Workspace directory: .agents/workspaces/${mapping.workspace_id}/`,
          },
          suppressOutput: true,
        },
      });
    }

    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

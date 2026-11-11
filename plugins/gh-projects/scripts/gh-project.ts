#!/usr/bin/env bun
/**
 * GitHub Projects CLI wrapper
 * Provides unified interface for gh project operations and GraphQL-only features.
 *
 * Usage: bun <this-file> <command> [options]
 */

import type { Command } from "./lib/gh-client.js";
import { blockingCommands } from "./lib/blocking-commands.js";
import { projectCommands } from "./lib/project-commands.js";
import { relationReportCommands } from "./lib/relation-report-commands.js";
import { subIssueCommands } from "./lib/sub-issue-commands.js";

const commands: Record<string, Command> = {
  ...projectCommands,
  ...subIssueCommands,
  ...blockingCommands,
  ...relationReportCommands,
};

// --- main ---

const [cmd, ...args] = process.argv.slice(2);

if (!cmd || cmd === "help") {
  console.log("GitHub Projects CLI\n");
  console.log("Usage: bun gh-project.ts <command> [args]\n");
  console.log("Commands:");
  const maxLen = Math.max(...Object.keys(commands).map((k) => k.length));
  for (const [name, { description, usage }] of Object.entries(commands)) {
    console.log(`  ${name.padEnd(maxLen + 2)} ${description}`);
    console.log(`  ${"".padEnd(maxLen + 2)} Usage: ${name} ${usage}`);
  }
  console.log("\nPrerequisite: gh auth refresh -s project");
  process.exit(0);
}

const command = commands[cmd];
if (!command) {
  console.error(`Unknown command: ${cmd}`);
  console.error(`Run with 'help' to see available commands.`);
  process.exit(1);
}

await command.run(args);

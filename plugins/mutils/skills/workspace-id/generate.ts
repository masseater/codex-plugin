#!/usr/bin/env bun
import { existsSync } from "node:fs";
import path from "node:path";
import { findGitRoot, MutilsDB } from "@r_masseater/cc-plugin-lib";
import { isValidFeatureName } from "./patterns.js";

const featureName = process.argv[2];

if (!featureName) {
  process.stderr.write("Usage: generate.ts <feature-name>\n");
  process.exit(1);
}

if (!isValidFeatureName(featureName)) {
  process.stderr.write(
    `Error: feature-name must be kebab-case (lowercase letters, digits, hyphens), got: ${featureName}\n`,
  );
  process.exit(1);
}

const now = new Date();
const pad = (n: number, len = 2) => String(n).padStart(len, "0");
const yyyymmdd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
const HHmm = `${pad(now.getHours())}${pad(now.getMinutes())}`;
const workspaceId = `${yyyymmdd}-${HHmm}-${featureName}`;

// Save to DB for persistence across Auto Compact
const cwd = process.cwd();
const gitRoot = findGitRoot(cwd);

if (gitRoot) {
  const agentsDir = path.join(gitRoot, ".agents");
  if (existsSync(agentsDir)) {
    try {
      using db = MutilsDB.open(gitRoot);
      const table = db.table<{
        workspace_id: string;
        feature_name: string;
        created_at: string;
      }>("workspace_mappings", {
        columns: `
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						workspace_id TEXT NOT NULL UNIQUE,
						feature_name TEXT NOT NULL,
						created_at TEXT NOT NULL
					`,
        indexes: [
          "CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_mappings_workspace_id ON workspace_mappings(workspace_id)",
        ],
      });

      const timestamp = now.toISOString();
      table.upsert({
        workspace_id: workspaceId,
        feature_name: featureName,
        created_at: timestamp,
      });
    } catch {
      // Fail silently - workspace-id generation should still work
    }
  }
}

process.stdout.write(workspaceId);

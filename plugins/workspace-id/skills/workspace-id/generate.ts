#!/usr/bin/env bun
import { findGitRoot, isValidFeatureName, MutilsDB } from "@r_masseater/cc-plugin-lib";
import { hasAgentsDir, openWorkspaceMappings } from "../../hooks/lib/workspace-mappings-schema.ts";

const args = process.argv.slice(2);
const sessionFlag = args.indexOf("--session-id");
const sessionId = sessionFlag === -1 ? null : (args[sessionFlag + 1] ?? null);
const featureName = args.find((arg, i) => !arg.startsWith("--") && i !== sessionFlag + 1);

if (!featureName) {
  process.stderr.write("Usage: generate.ts <feature-name> [--session-id <id>]\n");
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
  if (hasAgentsDir(gitRoot)) {
    try {
      using db = MutilsDB.open(gitRoot);
      const table = openWorkspaceMappings(db);
      table.upsert({
        workspace_id: workspaceId,
        feature_name: featureName,
        created_at: now.toISOString(),
        session_id: sessionId,
      });
    } catch (error) {
      // 保存は compact / resume 後の復元用。失敗しても workspace-id 自体は使えるので生成は続ける
      process.stderr.write(`Warning: failed to save workspace-id to mutils DB: ${String(error)}\n`);
    }
  }
}

process.stdout.write(workspaceId);

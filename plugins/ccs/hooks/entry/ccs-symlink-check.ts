#!/usr/bin/env bun
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { parse as parseYaml } from "yaml";

using logger = HookLogger.fromFile(import.meta.filename);

type Account = {
  context_mode?: string;
  context_group?: string;
};

type CcsConfig = {
  accounts?: Record<string, Account>;
};

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureSymlink(linkPath: string, target: string): boolean {
  if (fs.existsSync(linkPath)) {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const current = fs.readlinkSync(linkPath);
      if (current === target) return false;
    }
  }
  ensureDir(path.dirname(linkPath));
  if (!fs.existsSync(target)) {
    ensureDir(target);
  }
  return false;
}

function copyDirContents(src: string, dest: string): void {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (fs.existsSync(destPath)) continue;
    if (entry.isDirectory()) {
      ensureDir(destPath);
      copyDirContents(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const link = fs.readlinkSync(srcPath);
      fs.symlinkSync(link, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath, fs.constants.COPYFILE_EXCL);
    }
  }
}

function replaceWithSymlink(src: string, target: string): boolean {
  if (!fs.existsSync(target)) {
    ensureDir(target);
  }

  if (fs.existsSync(src)) {
    const stat = fs.lstatSync(src);
    if (stat.isSymbolicLink()) {
      const current = fs.readlinkSync(src);
      if (current === target) return false;
      fs.unlinkSync(src);
      fs.symlinkSync(target, src);
      return true;
    }
    if (stat.isDirectory()) {
      copyDirContents(src, target);
      fs.rmSync(src, { recursive: true, force: true });
      fs.symlinkSync(target, src);
      return true;
    }
  }

  ensureDir(path.dirname(src));
  fs.symlinkSync(target, src);
  return true;
}

const hook = defineHook({
  trigger: { SessionStart: true },
  run: wrapRun(logger, (context) => {
    const ccsDir = path.join(os.homedir(), ".ccs");
    const configPath = path.join(ccsDir, "config.yaml");

    if (!fs.existsSync(configPath)) {
      return context.success({});
    }

    let config: CcsConfig;
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      config = parseYaml(raw) as CcsConfig;
    } catch {
      return context.success({});
    }

    const accounts = config.accounts;
    if (!accounts) {
      return context.success({});
    }

    const claudeDir = path.join(os.homedir(), ".claude");
    const fixed: string[] = [];

    for (const [name, account] of Object.entries(accounts)) {
      if (account.context_mode !== "shared") continue;

      const group = account.context_group ?? "default";
      const instanceDir = path.join(ccsDir, "instances", name);
      if (!fs.existsSync(instanceDir)) continue;

      const groupDir = path.join(ccsDir, "shared", "context-groups", group);
      ensureDir(groupDir);
      ensureDir(path.join(groupDir, "continuity"));

      // projects chain: groupDir/projects -> ~/.claude/projects
      const groupProjects = path.join(groupDir, "projects");
      const claudeProjects = path.join(claudeDir, "projects");
      ensureDir(claudeProjects);
      if (ensureSymlink(groupProjects, claudeProjects)) {
        fixed.push(`${name}: ${groupProjects} -> ${claudeProjects}`);
      }
      if (!fs.existsSync(groupProjects) || !fs.lstatSync(groupProjects).isSymbolicLink()) {
        if (!fs.existsSync(groupProjects)) {
          fs.symlinkSync(claudeProjects, groupProjects);
          fixed.push(`${name}: created ${groupProjects} -> ${claudeProjects}`);
        }
      }

      // instanceDir/projects -> groupDir/projects
      const instanceProjects = path.join(instanceDir, "projects");
      if (replaceWithSymlink(instanceProjects, groupProjects)) {
        fixed.push(`${name}: ${instanceProjects} -> ${groupProjects}`);
      }

      // instanceDir/sessions -> ~/.claude/sessions
      const claudeSessions = path.join(claudeDir, "sessions");
      ensureDir(claudeSessions);
      const instanceSessions = path.join(instanceDir, "sessions");
      if (replaceWithSymlink(instanceSessions, claudeSessions)) {
        fixed.push(`${name}: ${instanceSessions} -> ${claudeSessions}`);
      }

      // continuity dirs
      const continuityDirs = ["file-history", "session-env", "shell-snapshots", "todos"];
      for (const dir of continuityDirs) {
        const target = path.join(groupDir, "continuity", dir);
        ensureDir(target);
        const instancePath = path.join(instanceDir, dir);
        if (replaceWithSymlink(instancePath, target)) {
          fixed.push(`${name}: ${instancePath} -> ${target}`);
        }
      }
    }

    if (fixed.length > 0) {
      return context.json({
        event: "SessionStart",
        output: {
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: `CCS symlink check: fixed ${fixed.length} link(s):\n${fixed.join("\n")}`,
          },
        },
      });
    }

    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

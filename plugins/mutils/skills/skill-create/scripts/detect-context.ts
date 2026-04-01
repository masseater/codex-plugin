#!/usr/bin/env bun
/**
 * Detect the current plugin context for skill creation.
 *
 * Usage: detect-context.ts [directory]
 *
 * Outputs JSON with:
 *   - pluginDir: path to the nearest plugin root (containing plugin.json)
 *   - pluginName: name from plugin.json
 *   - existingSkills: list of existing skill names
 *   - isPlugin: whether a plugin was detected
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const startDir = process.argv[2] || process.cwd();

type PluginContext = {
  isPlugin: boolean;
  pluginDir: string | null;
  pluginName: string | null;
  existingSkills: string[];
};

function findPluginRoot(dir: string): string | null {
  let current = path.resolve(dir);
  const root = path.parse(current).root;

  while (current !== root) {
    if (existsSync(path.join(current, "plugin.json"))) {
      return current;
    }
    current = path.dirname(current);
  }
  return null;
}

function getExistingSkills(pluginDir: string): string[] {
  const skillsDir = path.join(pluginDir, "skills");
  if (!existsSync(skillsDir)) return [];

  try {
    return readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) => existsSync(path.join(skillsDir, d.name, "SKILL.md")))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

const pluginDir = findPluginRoot(startDir);
const result: PluginContext = {
  isPlugin: pluginDir !== null,
  pluginDir,
  pluginName: null,
  existingSkills: [],
};

if (pluginDir) {
  try {
    const pluginJson = JSON.parse(readFileSync(path.join(pluginDir, "plugin.json"), "utf-8"));
    result.pluginName = pluginJson.name || null;
  } catch {
    // Ignore parse errors
  }
  result.existingSkills = getExistingSkills(pluginDir);
}

process.stdout.write(JSON.stringify(result, null, 2));

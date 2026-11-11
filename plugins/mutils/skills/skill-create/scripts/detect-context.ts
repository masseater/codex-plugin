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
import { pathIn } from "../../../hooks/lib/path-in.js";

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
    if (existsSync(pathIn(current, ".claude-plugin", "plugin.json"))) {
      return current;
    }
    current = path.dirname(current);
  }
  return null;
}

function getExistingSkills(pluginDir: string): string[] {
  const skillsDir = pathIn(pluginDir, "skills");
  if (!existsSync(skillsDir)) return [];

  try {
    return readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) => existsSync(pathIn(skillsDir, d.name, "SKILL.md")))
      .map((d) => d.name);
  } catch (error) {
    // 読めない skills ディレクトリは「既存 skill なし」として扱う。この出力は重複確認の参考情報で、
    // 欠けても skill 作成は進められるため。原因は stderr に残す
    console.error(`detect-context: failed to read ${skillsDir}: ${String(error)}`);
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
    const pluginJson = JSON.parse(
      readFileSync(pathIn(pluginDir, ".claude-plugin", "plugin.json"), "utf-8"),
    );
    result.pluginName = pluginJson.name || null;
  } catch (error) {
    // plugin.json が無い・壊れている場合は pluginName を null のまま返す。名前は命名の参考に使うだけで、
    // 欠けても skill 作成は進められるため。原因は stderr に残す
    console.error(`detect-context: failed to read plugin.json in ${pluginDir}: ${String(error)}`);
  }
  result.existingSkills = getExistingSkills(pluginDir);
}

process.stdout.write(JSON.stringify(result, null, 2));

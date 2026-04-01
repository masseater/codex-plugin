import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function resolveStateDir(): string {
  return process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`;
}

export function resolveDebugFile(stateDir: string): string {
  return `${stateDir}/claude-code-plugin/debug.txt`;
}

export function writeDebugFile(debugFilePath: string, pluginRoot: string): void {
  mkdirSync(dirname(debugFilePath), { recursive: true });
  writeFileSync(debugFilePath, `${pluginRoot}\n`);
}

export function buildDebugMessage(debugFilePath: string, pluginRoot: string): string {
  return `# Debug Plugin Active

The debug plugin is enabled for this session.

## Saved Data

| File | Content |
|------|---------|
| \`${debugFilePath}\` | CLAUDE_PLUGIN_ROOT path |

## Environment

- CLAUDE_PLUGIN_ROOT: \`${pluginRoot}\``;
}

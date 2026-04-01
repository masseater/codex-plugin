/**
 * ui-dev config.json loading and detection utilities
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { InferOutput } from "valibot";
import * as v from "valibot";

const UiDevConfigSchema = v.object({
  flow: v.object({
    name: v.string(),
    currentPhase: v.picklist(["implement", "done"]),
    figma: v.optional(
      v.object({
        fileKey: v.string(),
        prototypeChainPath: v.optional(v.string()),
      }),
    ),
    screens: v.array(v.string()),
  }),
  contextFiles: v.optional(v.array(v.string())),
  reviewPrompts: v.optional(
    v.object({
      common: v.optional(v.array(v.string())),
      visual: v.optional(v.array(v.string())),
      code: v.optional(v.array(v.string())),
    }),
  ),
});

export type UiDevConfig = InferOutput<typeof UiDevConfigSchema>;

/**
 * Find .agents/ui-dev/{flowName}/config.json from the project root
 */
export function findConfigPath(flowName?: string): string | undefined {
  const projectRoot = findProjectRoot();
  if (!projectRoot) return undefined;

  if (flowName) {
    const configPath = join(projectRoot, ".agents", "ui-dev", flowName, "config.json");
    return existsSync(configPath) ? configPath : undefined;
  }

  // If flowName is not specified, find the first config.json under .agents/ui-dev/
  const uiDevDir = join(projectRoot, ".agents", "ui-dev");
  if (!existsSync(uiDevDir)) return undefined;

  const entries = readdirSync(uiDevDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const configPath = join(uiDevDir, entry.name, "config.json");
      if (existsSync(configPath)) return configPath;
    }
  }

  return undefined;
}

/**
 * Load config.json
 */
export function loadUiDevConfig(configPath: string): UiDevConfig {
  const raw = readFileSync(configPath, "utf-8");
  const parsed: unknown = JSON.parse(raw);
  const result = v.safeParse(UiDevConfigSchema, parsed);
  if (!result.success) {
    throw new Error(`Invalid config at ${configPath}: ${JSON.stringify(result.issues)}`);
  }
  return result.output;
}

/**
 * Find the project root by looking for a .git directory
 */
function findProjectRoot(): string | undefined {
  let dir = process.cwd();
  const root = resolve("/");
  while (dir !== root) {
    if (existsSync(join(dir, ".git"))) return dir;
    dir = resolve(dir, "..");
  }
  return undefined;
}

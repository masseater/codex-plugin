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
 * List every .agents/ui-dev/{flowName}/config.json under the project root
 * @returns absolute paths to config.json files (empty when none)
 */
export function listConfigPaths(): string[] {
  const projectRoot = findProjectRoot();
  if (!projectRoot) return [];

  const uiDevDir = join(projectRoot, ".agents", "ui-dev");
  if (!existsSync(uiDevDir)) return [];

  return readdirSync(uiDevDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(uiDevDir, entry.name, "config.json"))
    .filter((configPath) => existsSync(configPath));
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

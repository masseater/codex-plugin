#!/usr/bin/env bun
/**
 * パッケージレジストリからメタデータを取得し、meta.yml を直接書き込む
 * 対応レジストリ: npm, pypi, crates, go, github
 */

import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import { normalizeName, resolveKnowledgeDir } from "./lib/resolve-knowledge-dir.js";
import {
  fetchRegistryEntries,
  REGISTRY_CONFIGS,
  type MetaEntries,
  type Registry,
} from "./lib/registry-fetchers.js";

// --- YAML helpers ---

function escapeYamlValue(value: string): string {
  if (/[":#{}[\],&*?|>!%@`]/.test(value) || value.includes("\n")) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return `"${value}"`;
}

function toYaml(entries: MetaEntries): string {
  return entries.map(([key, value]) => `${key}: ${escapeYamlValue(value)}`).join("\n");
}

// --- Helpers ---

/**
 * --name の値からナレッジディレクトリ名を決定する。
 * go モジュール（github.com/owner/repo）の場合は最後のセグメントを使う。
 */
function resolveLibraryName(name: string, registry: Registry): string {
  if (registry === "go") {
    return name.split("/").pop() ?? name;
  }
  return name;
}

// --- Main ---

const VALID_REGISTRIES: readonly Registry[] = ["npm", "pypi", "crates", "go", "github"];

function isRegistry(value: string): value is Registry {
  return VALID_REGISTRIES.some((registry) => registry === value);
}

const main = defineCommand({
  meta: {
    name: "fetch-package-info",
    description: "パッケージレジストリからメタデータを取得し meta.yml に書き込む",
  },
  args: {
    name: {
      type: "string",
      description: "パッケージ名 / モジュールパス / owner/repo",
      required: true,
    },
    registry: {
      type: "string",
      description: "レジストリ: npm | pypi | crates | go | github",
      required: true,
    },
    user: {
      type: "boolean",
      description: "ユーザーレベル (~/.claude/) に保存",
      default: false,
    },
  },
  async run({ args }) {
    const registry = args.registry;
    if (!isRegistry(registry)) {
      throw new Error(`未対応のレジストリ: ${registry}`);
    }
    const libName = resolveLibraryName(args.name, registry);
    const dir = resolveKnowledgeDir(libName, args.user);

    const entries: MetaEntries = await fetchRegistryEntries(args.name, REGISTRY_CONFIGS[registry]);

    const yaml = toYaml(entries);
    const outPath = join(dir, "meta.yml");
    await Bun.write(outPath, yaml);

    console.log(
      JSON.stringify({
        success: true,
        registry,
        name: args.name,
        normalizedName: normalizeName(libName),
        outputDir: dir,
        outputFile: outPath,
      }),
    );
  },
});

await runMain(main);

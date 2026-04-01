#!/usr/bin/env bun
/**
 * ライブラリナレッジベースの index.md（各ライブラリ）と SKILLS.md（トップレベル）を自動生成
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";
import { defineCommand, runMain } from "citty";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { getKnowledgeRoot } from "./lib/resolve-knowledge-dir.js";

type MetaYml = {
  name: string;
  package_name: string;
  registry: string;
  version: string;
  last_updated: string;
  description?: string | undefined;
  repository?: string | undefined;
  documentation?: string | undefined;
  tags?: string[] | undefined;
  aliases?: string[] | undefined;
  compatibility?: Record<string, string> | undefined;
};

type TopicFrontmatter = {
  title: string;
  description?: string | undefined;
};

type AnalysisJson = {
  repository?: { url: string } | undefined;
  structure?: { testFramework: string | null } | undefined;
  typescript?: { hasTypes: boolean } | undefined;
  license?: string | null | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMetaYml(value: unknown): value is MetaYml {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.package_name === "string" &&
    typeof value.registry === "string" &&
    typeof value.version === "string" &&
    typeof value.last_updated === "string"
  );
}

function isTopicFrontmatter(value: unknown): value is TopicFrontmatter {
  return isRecord(value) && typeof value.title === "string";
}

function extractFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) return null;
  const parsed: unknown = parseYaml(match[1]);
  return isRecord(parsed) ? parsed : null;
}

function generateLibraryIndex(
  meta: MetaYml,
  topics: { file: string; fm: TopicFrontmatter }[],
  analysis: AnalysisJson | null,
): string {
  const frontmatter = stringifyYaml(meta, { lineWidth: 0 }).trim();
  let md = `---\n${frontmatter}\n---\n\n`;
  md += `# ${meta.name}\n\n`;
  md += `${meta.description ?? ""}\n`;

  if (analysis) {
    md += "\n## Overview\n\n";
    const items: string[] = [];
    if (analysis.repository?.url) {
      items.push(`- Repository: ${analysis.repository.url}`);
    }
    if (analysis.typescript?.hasTypes) {
      items.push("- TypeScript: types included");
    }
    if (analysis.structure?.testFramework) {
      items.push(`- Tests: ${analysis.structure.testFramework}`);
    }
    if (analysis.license) {
      items.push(`- License: ${analysis.license}`);
    }
    md += `${items.join("\n")}\n`;
  }

  if (topics.length > 0) {
    md += "\n## Topics\n\n";
    for (const { file, fm } of topics) {
      const desc = fm.description ? ` - ${fm.description}` : "";
      md += `- [${fm.title}](${file})${desc}\n`;
    }
  }

  return md;
}

function generateSkillsIndex(libraries: { meta: MetaYml; dirName: string }[]): string {
  const today = new Date().toISOString().split("T")[0];

  let md = `# Library Research Index\n\n`;
  md += `> Auto-generated: ${today} | Total: ${libraries.length} libraries\n\n`;

  md += "## Libraries\n\n";
  md += "| Library | Package | Registry | Bun | Node | Updated | Tags |\n";
  md += "|---------|---------|----------|-----|------|---------|------|\n";

  for (const { meta, dirName } of libraries) {
    const registry = meta.registry;
    const bun = meta.compatibility?.bun ?? "-";
    const node = meta.compatibility?.node ?? "-";
    const tags = meta.tags?.join(", ") ?? "";
    md += `| [${meta.name}](./${dirName}/index.md) | \`${meta.package_name}\` | ${registry} | ${bun} | ${node} | ${meta.last_updated} | ${tags} |\n`;
  }

  const tagMap = new Map<string, string[]>();
  for (const { meta } of libraries) {
    for (const tag of meta.tags ?? []) {
      const existing = tagMap.get(tag) ?? [];
      existing.push(meta.name);
      tagMap.set(tag, existing);
    }
  }

  if (tagMap.size > 0) {
    md += "\n## By Tag\n\n";
    for (const [tag, libs] of [...tagMap.entries()].toSorted()) {
      md += `- **${tag}**: ${libs.join(", ")}\n`;
    }
  }

  return md;
}

async function readAnalysisJson(libDir: string): Promise<AnalysisJson | null> {
  const file = Bun.file(join(libDir, "analysis.json"));
  if (!(await file.exists())) return null;
  try {
    const parsed: unknown = await file.json();
    return isRecord(parsed) ? (parsed as AnalysisJson) : null;
  } catch {
    return null;
  }
}

async function processBaseDir(
  baseDir: string,
  libraries: { meta: MetaYml; dirName: string }[],
): Promise<void> {
  if (!existsSync(baseDir)) return;

  const metaGlob = new Glob("*/meta.yml");
  for await (const metaPath of metaGlob.scan({ cwd: baseDir })) {
    const dirName = metaPath.replace("/meta.yml", "");
    const libDir = join(baseDir, dirName);

    const metaContent = await Bun.file(join(baseDir, metaPath)).text();
    const parsed: unknown = parseYaml(metaContent);
    if (!isMetaYml(parsed)) {
      console.error(`Invalid meta.yml: ${metaPath}`);
      continue;
    }
    const meta = parsed;

    const analysis = await readAnalysisJson(libDir);

    const topics: { file: string; fm: TopicFrontmatter }[] = [];
    const topicGlob = new Glob("*.md");
    for await (const topicFile of topicGlob.scan({ cwd: libDir })) {
      if (topicFile === "index.md") continue;
      const content = await Bun.file(join(libDir, topicFile)).text();
      const fm = extractFrontmatter(content);
      if (fm && isTopicFrontmatter(fm)) {
        topics.push({ file: topicFile, fm });
      }
    }
    topics.sort((a, b) => a.file.localeCompare(b.file));

    const indexContent = generateLibraryIndex(meta, topics, analysis);
    await Bun.write(join(libDir, "index.md"), indexContent);

    libraries.push({ meta, dirName });
  }
}

const main = defineCommand({
  meta: {
    name: "generate-index",
    description: "ライブラリナレッジベースの index.md と SKILLS.md を自動生成",
  },
  args: {
    user: {
      type: "boolean",
      description: "ユーザーレベル (~/.claude/) のナレッジを対象にする",
      default: false,
    },
  },
  async run({ args }) {
    const baseDir = getKnowledgeRoot(args.user);

    if (!existsSync(baseDir)) {
      console.log(JSON.stringify({ generated: [], total: 0, baseDir }));
      return;
    }

    const libraries: { meta: MetaYml; dirName: string }[] = [];
    await processBaseDir(baseDir, libraries);

    libraries.sort((a, b) => a.meta.name.localeCompare(b.meta.name));

    const skillsContent = generateSkillsIndex(libraries);
    await Bun.write(join(baseDir, "SKILLS.md"), skillsContent);

    console.log(
      JSON.stringify({
        generated: libraries.map((l) => l.dirName),
        total: libraries.length,
        baseDir,
      }),
    );
  },
});

runMain(main);

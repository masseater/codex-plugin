/**
 * ライブラリナレッジベースの index.md（各ライブラリ）と SKILLS.md（トップレベル）の内容を組み立てる純粋関数群。
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { isRecord } from "./type-guards.js";

export type MetaYml = {
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

export type TopicFrontmatter = {
  title: string;
  description?: string | undefined;
};

export type Topic = { file: string; fm: TopicFrontmatter };

export type AnalysisJson = {
  repository?: { url: string } | undefined;
  structure?: { testFramework: string | null } | undefined;
  typescript?: { hasTypes: boolean } | undefined;
  license?: string | null | undefined;
};

export type IndexedLibrary = { meta: MetaYml; dirName: string };

const REQUIRED_META_FIELDS = ["name", "package_name", "registry", "version", "last_updated"];

export function isMetaYml(value: unknown): value is MetaYml {
  if (!isRecord(value)) return false;
  return REQUIRED_META_FIELDS.every((field) => typeof value[field] === "string");
}

export function isTopicFrontmatter(value: unknown): value is TopicFrontmatter {
  return isRecord(value) && typeof value.title === "string";
}

export function extractFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) return null;
  const parsed: unknown = parseYaml(match[1]);
  return isRecord(parsed) ? parsed : null;
}

// Overview に並べる項目。値が無い項目は出さない
const OVERVIEW_ITEMS: ((analysis: AnalysisJson) => string | null | undefined)[] = [
  (analysis) => analysis.repository?.url && `- Repository: ${analysis.repository.url}`,
  (analysis) => (analysis.typescript?.hasTypes ? "- TypeScript: types included" : undefined),
  (analysis) => analysis.structure?.testFramework && `- Tests: ${analysis.structure.testFramework}`,
  (analysis) => analysis.license && `- License: ${analysis.license}`,
];

function overviewSection(analysis: AnalysisJson | null): string {
  if (!analysis) return "";
  const items = OVERVIEW_ITEMS.map((item) => item(analysis)).filter(Boolean);
  return `\n## Overview\n\n${items.join("\n")}\n`;
}

function topicLine({ file, fm }: Topic): string {
  const desc = fm.description ? ` - ${fm.description}` : "";
  return `- [${fm.title}](${file})${desc}\n`;
}

function topicsSection(topics: Topic[]): string {
  return topics.length > 0 ? `\n## Topics\n\n${topics.map(topicLine).join("")}` : "";
}

export function generateLibraryIndex(
  meta: MetaYml,
  topics: Topic[],
  analysis: AnalysisJson | null,
): string {
  const frontmatter = stringifyYaml(meta, { lineWidth: 0 }).trim();
  return `---\n${frontmatter}\n---\n\n# ${meta.name}\n\n${meta.description ?? ""}\n${overviewSection(analysis)}${topicsSection(topics)}`;
}

function compatibility(meta: MetaYml, runtime: string): string {
  return meta.compatibility?.[runtime] ?? "-";
}

function tagsSuffix(meta: MetaYml): string {
  const tags = meta.tags?.join(", ") ?? "";
  return tags ? ` / tags: ${tags}` : "";
}

function libraryLine({ meta, dirName }: IndexedLibrary): string {
  return `- [${meta.name}](./${dirName}/index.md): \`${meta.package_name}\` (${meta.registry}) / bun: ${compatibility(meta, "bun")} / node: ${compatibility(meta, "node")} / updated: ${meta.last_updated}${tagsSuffix(meta)}\n`;
}

function librariesByTag(libraries: IndexedLibrary[]): Map<string, string[]> {
  const tagMap = new Map<string, string[]>();
  const pairs = libraries.flatMap(({ meta }) => (meta.tags ?? []).map((tag) => [tag, meta.name]));
  for (const [tag = "", name = ""] of pairs) {
    tagMap.set(tag, [...(tagMap.get(tag) ?? []), name]);
  }
  return tagMap;
}

function compareCodePoints(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function tagSection(tagMap: Map<string, string[]>): string {
  if (tagMap.size === 0) return "";
  // タグは Map のキーで重複しないため、タグ名のコードポイント順で並べる
  const lines = [...tagMap.entries()]
    .toSorted(([a], [b]) => compareCodePoints(a, b))
    .map(([tag, libs]) => `- **${tag}**: ${libs.join(", ")}\n`);
  return `\n## By Tag\n\n${lines.join("")}`;
}

export function generateSkillsIndex(libraries: IndexedLibrary[]): string {
  const today = new Date().toISOString().split("T")[0];
  return [
    "# Library Research Index\n\n",
    `> Auto-generated: ${today} | Total: ${libraries.length} libraries\n\n`,
    "## Libraries\n\n",
    ...libraries.map(libraryLine),
    tagSection(librariesByTag(libraries)),
  ].join("");
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function repositoryOf(value: unknown): Pick<AnalysisJson, "repository"> {
  return isRecord(value) && typeof value.url === "string" ? { repository: { url: value.url } } : {};
}

function structureOf(value: unknown): Pick<AnalysisJson, "structure"> {
  return isRecord(value) && isNullableString(value.testFramework)
    ? { structure: { testFramework: value.testFramework } }
    : {};
}

function typescriptOf(value: unknown): Pick<AnalysisJson, "typescript"> {
  return isRecord(value) && typeof value.hasTypes === "boolean"
    ? { typescript: { hasTypes: value.hasTypes } }
    : {};
}

/**
 * analysis.json のうち、索引に使うフィールドだけを型を確かめて取り出す。
 * @param value JSON として読んだ analysis.json
 * @returns 型の合うフィールドだけを持つ AnalysisJson
 */
export function toAnalysisJson(value: Record<string, unknown>): AnalysisJson {
  return {
    ...repositoryOf(value.repository),
    ...structureOf(value.structure),
    ...typescriptOf(value.typescript),
    ...(isNullableString(value.license) ? { license: value.license } : {}),
  };
}

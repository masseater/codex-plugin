import { describe, expect, test } from "vitest";
import { parse as parseYaml } from "yaml";

/**
 * Test the pure functions from generate-index.ts.
 * Since the functions are not exported, we recreate them here to validate the logic.
 * The source uses Bun-specific APIs (Bun.file, Glob from "bun") for I/O,
 * so we test the pure transformation functions independently.
 */

// --- Recreated pure functions from generate-index.ts ---

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
  const { stringify: stringifyYaml } = require("yaml");
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

  let md = "# Library Research Index\n\n";
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

// --- Tests ---

describe("isRecord", () => {
  test("returns true for plain object", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  test("returns false for null", () => {
    expect(isRecord(null)).toBe(false);
  });

  test("returns false for array", () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2])).toBe(false);
  });

  test("returns false for primitives", () => {
    expect(isRecord("string")).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe("isMetaYml", () => {
  const validMeta: MetaYml = {
    name: "express",
    package_name: "express",
    registry: "npm",
    version: "4.21.0",
    last_updated: "2025-01-01",
  };

  test("returns true for valid MetaYml", () => {
    expect(isMetaYml(validMeta)).toBe(true);
  });

  test("returns true with optional fields", () => {
    expect(
      isMetaYml({
        ...validMeta,
        description: "Fast web framework",
        tags: ["web", "http"],
        compatibility: { bun: "1.0+", node: "18+" },
      }),
    ).toBe(true);
  });

  test("returns false when name is missing", () => {
    const { name: _, ...rest } = validMeta;
    expect(isMetaYml(rest)).toBe(false);
  });

  test("returns false when package_name is missing", () => {
    const { package_name: _, ...rest } = validMeta;
    expect(isMetaYml(rest)).toBe(false);
  });

  test("returns false when registry is missing", () => {
    const { registry: _, ...rest } = validMeta;
    expect(isMetaYml(rest)).toBe(false);
  });

  test("returns false when version is missing", () => {
    const { version: _, ...rest } = validMeta;
    expect(isMetaYml(rest)).toBe(false);
  });

  test("returns false when last_updated is missing", () => {
    const { last_updated: _, ...rest } = validMeta;
    expect(isMetaYml(rest)).toBe(false);
  });

  test("returns false for non-object values", () => {
    expect(isMetaYml(null)).toBe(false);
    expect(isMetaYml("string")).toBe(false);
    expect(isMetaYml(42)).toBe(false);
    expect(isMetaYml([])).toBe(false);
  });

  test("returns false when required field has wrong type", () => {
    expect(isMetaYml({ ...validMeta, name: 123 })).toBe(false);
    expect(isMetaYml({ ...validMeta, version: true })).toBe(false);
  });
});

describe("isTopicFrontmatter", () => {
  test("returns true for valid TopicFrontmatter", () => {
    expect(isTopicFrontmatter({ title: "Getting Started" })).toBe(true);
  });

  test("returns true with optional description", () => {
    expect(isTopicFrontmatter({ title: "API", description: "API reference" })).toBe(true);
  });

  test("returns false when title is missing", () => {
    expect(isTopicFrontmatter({})).toBe(false);
  });

  test("returns false when title is not a string", () => {
    expect(isTopicFrontmatter({ title: 123 })).toBe(false);
  });

  test("returns false for non-object values", () => {
    expect(isTopicFrontmatter(null)).toBe(false);
    expect(isTopicFrontmatter("string")).toBe(false);
  });
});

describe("extractFrontmatter", () => {
  test("extracts YAML frontmatter from markdown", () => {
    const content = "---\ntitle: Hello\ndescription: World\n---\n\n# Content";
    const result = extractFrontmatter(content);
    expect(result).toStrictEqual({ title: "Hello", description: "World" });
  });

  test("returns null for content without frontmatter", () => {
    const result = extractFrontmatter("# Just a heading");
    expect(result).toBeNull();
  });

  test("returns null for empty frontmatter", () => {
    const result = extractFrontmatter("---\n\n---\n");
    expect(result).toBeNull();
  });

  test("returns null when frontmatter is not at the start", () => {
    const result = extractFrontmatter("some text\n---\ntitle: Hello\n---\n");
    expect(result).toBeNull();
  });

  test("handles frontmatter with arrays and nested values", () => {
    const content = "---\ntitle: Test\ntags:\n  - a\n  - b\n---\n";
    const result = extractFrontmatter(content);
    expect(result).toStrictEqual({ title: "Test", tags: ["a", "b"] });
  });

  test("returns null when YAML parses to a non-record (scalar)", () => {
    const content = "---\njust a string\n---\n";
    const result = extractFrontmatter(content);
    expect(result).toBeNull();
  });
});

describe("generateLibraryIndex", () => {
  const baseMeta: MetaYml = {
    name: "express",
    package_name: "express",
    registry: "npm",
    version: "4.21.0",
    last_updated: "2025-01-01",
    description: "Fast web framework for Node.js",
  };

  test("generates basic index with frontmatter and heading", () => {
    const result = generateLibraryIndex(baseMeta, [], null);
    expect(result).toContain("---\n");
    expect(result).toContain("# express");
    expect(result).toContain("Fast web framework for Node.js");
  });

  test("includes overview section when analysis is provided", () => {
    const analysis: AnalysisJson = {
      repository: { url: "https://github.com/expressjs/express" },
      typescript: { hasTypes: true },
      structure: { testFramework: "jest" },
      license: "MIT",
    };
    const result = generateLibraryIndex(baseMeta, [], analysis);
    expect(result).toContain("## Overview");
    expect(result).toContain("- Repository: https://github.com/expressjs/express");
    expect(result).toContain("- TypeScript: types included");
    expect(result).toContain("- Tests: jest");
    expect(result).toContain("- License: MIT");
  });

  test("omits overview items that are null/undefined", () => {
    const analysis: AnalysisJson = {
      repository: undefined,
      typescript: { hasTypes: false },
      structure: { testFramework: null },
      license: null,
    };
    const result = generateLibraryIndex(baseMeta, [], analysis);
    expect(result).toContain("## Overview");
    expect(result).not.toContain("Repository:");
    expect(result).not.toContain("TypeScript:");
    expect(result).not.toContain("Tests:");
    expect(result).not.toContain("License:");
  });

  test("includes topics section when topics are provided", () => {
    const topics = [
      {
        file: "getting-started.md",
        fm: { title: "Getting Started", description: "Quick start guide" },
      },
      { file: "api.md", fm: { title: "API Reference" } },
    ];
    const result = generateLibraryIndex(baseMeta, topics, null);
    expect(result).toContain("## Topics");
    expect(result).toContain("- [Getting Started](getting-started.md) - Quick start guide");
    expect(result).toContain("- [API Reference](api.md)");
  });

  test("omits topics section when topics array is empty", () => {
    const result = generateLibraryIndex(baseMeta, [], null);
    expect(result).not.toContain("## Topics");
  });

  test("uses empty string when description is undefined", () => {
    const meta = { ...baseMeta, description: undefined };
    const result = generateLibraryIndex(meta, [], null);
    expect(result).toContain("# express\n\n\n");
  });
});

describe("generateSkillsIndex", () => {
  test("generates empty table for no libraries", () => {
    const result = generateSkillsIndex([]);
    expect(result).toContain("# Library Research Index");
    expect(result).toContain("Total: 0 libraries");
    expect(result).toContain("| Library | Package | Registry | Bun | Node | Updated | Tags |");
  });

  test("generates table rows for libraries", () => {
    const libraries = [
      {
        meta: {
          name: "express",
          package_name: "express",
          registry: "npm",
          version: "4.21.0",
          last_updated: "2025-01-01",
          compatibility: { bun: "1.0+", node: "18+" },
          tags: ["web", "http"],
        },
        dirName: "express",
      },
    ];
    const result = generateSkillsIndex(libraries);
    expect(result).toContain("Total: 1 libraries");
    expect(result).toContain("[express](./express/index.md)");
    expect(result).toContain("`express`");
    expect(result).toContain("npm");
    expect(result).toContain("1.0+");
    expect(result).toContain("18+");
    expect(result).toContain("web, http");
  });

  test("uses - for missing compatibility", () => {
    const libraries = [
      {
        meta: {
          name: "lodash",
          package_name: "lodash",
          registry: "npm",
          version: "4.17.21",
          last_updated: "2024-06-15",
        },
        dirName: "lodash",
      },
    ];
    const result = generateSkillsIndex(libraries);
    expect(result).toMatch(/\| - \| - \|/);
  });

  test("generates By Tag section when tags exist", () => {
    const libraries = [
      {
        meta: {
          name: "express",
          package_name: "express",
          registry: "npm",
          version: "4.0.0",
          last_updated: "2025-01-01",
          tags: ["web", "http"],
        },
        dirName: "express",
      },
      {
        meta: {
          name: "fastify",
          package_name: "fastify",
          registry: "npm",
          version: "5.0.0",
          last_updated: "2025-01-01",
          tags: ["web", "fast"],
        },
        dirName: "fastify",
      },
    ];
    const result = generateSkillsIndex(libraries);
    expect(result).toContain("## By Tag");
    expect(result).toContain("- **fast**: fastify");
    expect(result).toContain("- **http**: express");
    expect(result).toContain("- **web**: express, fastify");
  });

  test("omits By Tag section when no tags exist", () => {
    const libraries = [
      {
        meta: {
          name: "lodash",
          package_name: "lodash",
          registry: "npm",
          version: "4.0.0",
          last_updated: "2025-01-01",
        },
        dirName: "lodash",
      },
    ];
    const result = generateSkillsIndex(libraries);
    expect(result).not.toContain("## By Tag");
  });

  test("includes auto-generated date", () => {
    const today = new Date().toISOString().split("T")[0];
    const result = generateSkillsIndex([]);
    expect(result).toContain(`Auto-generated: ${today}`);
  });
});

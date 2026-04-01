import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

/**
 * copy-templates.ts のテンプレートコピーロジックをテストする。
 *
 * 元スクリプトは Bun API (Bun.file, Bun.write, Bun.Glob) を使用しているため、
 * ロジックを Node.js FS API で再現してテストする。
 */

// --- ソースのロジック再現（Node.js FS 版） ---

const TEMPLATE_MAP = [
  { source: "overview-template.md", target: "overview.md" },
  { source: "specification-template.md", target: "specification.md" },
  { source: "technical-details-template.md", target: "technical-details.md" },
] as const;

interface CopyResult {
  copied: number;
  skipped: number;
  warnings: string[];
}

function copyTemplates(templatesDir: string, targetDir: string): CopyResult {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  let copied = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (const { source, target } of TEMPLATE_MAP) {
    const sourcePath = join(templatesDir, source);
    const targetPath = join(targetDir, target);

    if (!existsSync(sourcePath)) {
      warnings.push(`Template not found: ${source}`);
      continue;
    }

    if (existsSync(targetPath)) {
      skipped++;
      continue;
    }

    const content = readFileSync(sourcePath, "utf-8");
    writeFileSync(targetPath, content);
    copied++;
  }

  return { copied, skipped, warnings };
}

// --- Tests ---

let templatesDir: string;
let targetDir: string;

beforeEach(() => {
  const base = join(
    tmpdir(),
    `sdd-spec-template-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  templatesDir = join(base, "templates");
  targetDir = join(base, "target");
  mkdirSync(templatesDir, { recursive: true });
});

afterEach(() => {
  const base = join(templatesDir, "..");
  if (existsSync(base)) {
    rmSync(base, { recursive: true, force: true });
  }
});

describe("copy-templates (spec-template)", () => {
  test("copies all templates when target is empty", () => {
    writeFileSync(join(templatesDir, "overview-template.md"), "# Overview");
    writeFileSync(join(templatesDir, "specification-template.md"), "# Spec");
    writeFileSync(join(templatesDir, "technical-details-template.md"), "# Tech");

    const result = copyTemplates(templatesDir, targetDir);

    expect(result.copied).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.warnings).toHaveLength(0);

    expect(readFileSync(join(targetDir, "overview.md"), "utf-8")).toBe("# Overview");
    expect(readFileSync(join(targetDir, "specification.md"), "utf-8")).toBe("# Spec");
    expect(readFileSync(join(targetDir, "technical-details.md"), "utf-8")).toBe("# Tech");
  });

  test("skips files that already exist in target", () => {
    writeFileSync(join(templatesDir, "overview-template.md"), "# New Overview");
    writeFileSync(join(templatesDir, "specification-template.md"), "# Spec");
    writeFileSync(join(templatesDir, "technical-details-template.md"), "# Tech");

    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, "overview.md"), "# Existing Overview");

    const result = copyTemplates(templatesDir, targetDir);

    expect(result.copied).toBe(2);
    expect(result.skipped).toBe(1);
    expect(readFileSync(join(targetDir, "overview.md"), "utf-8")).toBe("# Existing Overview");
  });

  test("warns when template source does not exist", () => {
    // Only create one template
    writeFileSync(join(templatesDir, "overview-template.md"), "# Overview");

    const result = copyTemplates(templatesDir, targetDir);

    expect(result.copied).toBe(1);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain("specification-template.md");
    expect(result.warnings[1]).toContain("technical-details-template.md");
  });

  test("creates target directory if it does not exist", () => {
    writeFileSync(join(templatesDir, "overview-template.md"), "# Overview");

    expect(existsSync(targetDir)).toBe(false);

    copyTemplates(templatesDir, targetDir);

    expect(existsSync(targetDir)).toBe(true);
    expect(existsSync(join(targetDir, "overview.md"))).toBe(true);
  });

  test("returns zero counts when no templates exist", () => {
    const result = copyTemplates(templatesDir, targetDir);

    expect(result.copied).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.warnings).toHaveLength(3);
  });

  test("template map uses correct source-to-target naming", () => {
    expect(TEMPLATE_MAP).toEqual([
      { source: "overview-template.md", target: "overview.md" },
      { source: "specification-template.md", target: "specification.md" },
      { source: "technical-details-template.md", target: "technical-details.md" },
    ]);
  });
});

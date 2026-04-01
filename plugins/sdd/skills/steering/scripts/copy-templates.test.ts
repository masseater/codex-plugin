import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

/**
 * steering/copy-templates.ts のテンプレートコピーロジックをテストする。
 *
 * 元スクリプトは Bun.Glob で *-template.md を動的に検出し、
 * "-template" を除去した名前でコピーする。
 * Node.js FS API で同等ロジックを再現してテストする。
 */

// --- ソースのロジック再現（Node.js FS 版） ---

interface CopyResult {
  copied: number;
  skipped: number;
  templateFiles: string[];
}

function copySteeringTemplates(templatesDir: string, targetDir: string): CopyResult {
  if (!existsSync(templatesDir)) {
    return { copied: 0, skipped: 0, templateFiles: [] };
  }

  const allFiles = readdirSync(templatesDir);
  const templateFiles = allFiles.filter((f) => f.endsWith("-template.md"));

  if (templateFiles.length === 0) {
    return { copied: 0, skipped: 0, templateFiles: [] };
  }

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  let copied = 0;
  let skipped = 0;

  for (const template of templateFiles) {
    const sourcePath = join(templatesDir, template);
    const targetName = template.replace("-template", "");
    const targetPath = join(targetDir, targetName);

    if (existsSync(targetPath)) {
      skipped++;
      continue;
    }

    const content = readFileSync(sourcePath, "utf-8");
    writeFileSync(targetPath, content);
    copied++;
  }

  return { copied, skipped, templateFiles };
}

/**
 * ファイル名変換ロジック: "-template" を除去
 */
function removeTemplateSuffix(filename: string): string {
  return filename.replace("-template", "");
}

// --- Tests ---

let templatesDir: string;
let targetDir: string;

beforeEach(() => {
  const base = join(
    tmpdir(),
    `sdd-steering-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe("removeTemplateSuffix", () => {
  test("removes -template from filename", () => {
    expect(removeTemplateSuffix("product-template.md")).toBe("product.md");
  });

  test("removes -template from compound name", () => {
    expect(removeTemplateSuffix("tech-stack-template.md")).toBe("tech-stack.md");
  });

  test("returns unchanged string when no -template present", () => {
    expect(removeTemplateSuffix("readme.md")).toBe("readme.md");
  });
});

describe("copy-templates (steering)", () => {
  test("copies all templates with -template suffix removed", () => {
    writeFileSync(join(templatesDir, "product-template.md"), "# Product");
    writeFileSync(join(templatesDir, "tech-stack-template.md"), "# Tech Stack");
    writeFileSync(join(templatesDir, "principles-template.md"), "# Principles");

    const result = copySteeringTemplates(templatesDir, targetDir);

    expect(result.copied).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.templateFiles).toHaveLength(3);

    expect(readFileSync(join(targetDir, "product.md"), "utf-8")).toBe("# Product");
    expect(readFileSync(join(targetDir, "tech-stack.md"), "utf-8")).toBe("# Tech Stack");
    expect(readFileSync(join(targetDir, "principles.md"), "utf-8")).toBe("# Principles");
  });

  test("ignores non-template files in templates directory", () => {
    writeFileSync(join(templatesDir, "product-template.md"), "# Product");
    writeFileSync(join(templatesDir, "README.md"), "# README");
    writeFileSync(join(templatesDir, "notes.txt"), "notes");

    const result = copySteeringTemplates(templatesDir, targetDir);

    expect(result.copied).toBe(1);
    expect(result.templateFiles).toEqual(["product-template.md"]);
    expect(existsSync(join(targetDir, "README.md"))).toBe(false);
    expect(existsSync(join(targetDir, "notes.txt"))).toBe(false);
  });

  test("skips files that already exist in target", () => {
    writeFileSync(join(templatesDir, "product-template.md"), "# New Product");
    writeFileSync(join(templatesDir, "tech-stack-template.md"), "# Tech");

    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, "product.md"), "# Existing Product");

    const result = copySteeringTemplates(templatesDir, targetDir);

    expect(result.copied).toBe(1);
    expect(result.skipped).toBe(1);
    expect(readFileSync(join(targetDir, "product.md"), "utf-8")).toBe("# Existing Product");
    expect(readFileSync(join(targetDir, "tech-stack.md"), "utf-8")).toBe("# Tech");
  });

  test("creates target directory if it does not exist", () => {
    writeFileSync(join(templatesDir, "product-template.md"), "# Product");

    expect(existsSync(targetDir)).toBe(false);

    copySteeringTemplates(templatesDir, targetDir);

    expect(existsSync(targetDir)).toBe(true);
  });

  test("returns zero counts when templates directory is empty", () => {
    const result = copySteeringTemplates(templatesDir, targetDir);

    expect(result.copied).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.templateFiles).toHaveLength(0);
  });

  test("returns zero counts when templates directory does not exist", () => {
    rmSync(templatesDir, { recursive: true, force: true });

    const result = copySteeringTemplates(templatesDir, targetDir);

    expect(result.copied).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.templateFiles).toHaveLength(0);
  });

  test("only picks up files matching *-template.md glob", () => {
    writeFileSync(join(templatesDir, "product-template.md"), "ok");
    writeFileSync(join(templatesDir, "template.md"), "no match");
    writeFileSync(join(templatesDir, "product-template.txt"), "wrong ext");
    writeFileSync(join(templatesDir, "my-template-file.md"), "no match");

    const result = copySteeringTemplates(templatesDir, targetDir);

    expect(result.templateFiles).toEqual(["product-template.md"]);
    expect(result.copied).toBe(1);
  });
});

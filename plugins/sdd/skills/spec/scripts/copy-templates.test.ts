import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { copyTemplates, isValidTargetDir, parseNames } from "./copy-templates.ts";

const REAL_TEMPLATES = join(import.meta.dirname, "..", "assets", "templates");

let base: string;
let targetDir: string;

beforeEach(() => {
  base = join(tmpdir(), `sdd-spec-copy-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  targetDir = join(base, "specs", "user-auth");
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("parseNames", () => {
  test("defaults to overview only", () => {
    expect(parseNames([])).toEqual(["overview"]);
  });

  test("accepts known template names", () => {
    expect(parseNames(["specification", "technical-details"])).toEqual([
      "specification",
      "technical-details",
    ]);
  });

  test("rejects unknown names", () => {
    expect(() => parseNames(["phase"])).toThrow("Unknown template: phase");
  });
});

describe("isValidTargetDir", () => {
  test("accepts a spec directory", () => {
    expect(isValidTargetDir("specs/my-feature")).toBe(true);
  });

  test("rejects option-like arguments", () => {
    expect(isValidTargetDir("--help")).toBe(false);
    expect(isValidTargetDir("-h")).toBe(false);
  });

  test("rejects a missing argument", () => {
    expect(isValidTargetDir(undefined)).toBe(false);
    expect(isValidTargetDir("")).toBe(false);
  });
});

describe("copyTemplates", () => {
  test("copies only overview on init so later steps stay detectable", () => {
    const result = copyTemplates(REAL_TEMPLATES, targetDir, ["overview"]);

    expect(result).toEqual({ copied: ["overview.md"], skipped: [] });
    expect(existsSync(join(targetDir, "overview.md"))).toBe(true);
    expect(existsSync(join(targetDir, "specification.md"))).toBe(false);
  });

  test("overview template starts with a status frontmatter", () => {
    copyTemplates(REAL_TEMPLATES, targetDir, ["overview"]);
    expect(readFileSync(join(targetDir, "overview.md"), "utf-8")).toMatch(
      /^---\nstatus: not_started\n---\n/,
    );
  });

  test("copies each real template", () => {
    const result = copyTemplates(REAL_TEMPLATES, targetDir, [
      "overview",
      "specification",
      "technical-details",
    ]);
    expect(result.copied).toEqual(["overview.md", "specification.md", "technical-details.md"]);
  });

  test("does not overwrite existing files", () => {
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, "overview.md"), "# existing");

    const result = copyTemplates(REAL_TEMPLATES, targetDir, ["overview"]);

    expect(result).toEqual({ copied: [], skipped: ["overview.md"] });
    expect(readFileSync(join(targetDir, "overview.md"), "utf-8")).toBe("# existing");
  });

  test("throws when a template is missing", () => {
    const emptyTemplates = join(base, "templates");
    mkdirSync(emptyTemplates, { recursive: true });
    expect(() => copyTemplates(emptyTemplates, targetDir, ["overview"])).toThrow(
      "Template not found",
    );
  });
});

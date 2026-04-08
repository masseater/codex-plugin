import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { meta, run } from "./index.ts";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "config-files-test-"));
}

describe("meta", () => {
  test("has required fields", () => {
    expect(meta.name).toBe("config-files");
    expect(typeof meta.description).toBe("string");
    expect(meta.description.length).toBeGreaterThan(0);
    expect(Array.isArray(meta.references)).toBe(true);
    expect(Array.isArray(meta.appliesTo)).toBe(true);
    expect(meta.scope).toBe("root");
  });
});

describe("run - config/package-manager", () => {
  test("no violation when neither package-lock.json nor yarn.lock exists", async () => {
    const dir = makeTempDir();
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const pm = findings.filter(
      (f) => f.rule === "config-files" && f.message.toLowerCase().includes("pnpm"),
    );
    expect(pm).toHaveLength(0);
  });

  test("violation when package-lock.json exists", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "package-lock.json"), "{}");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) => f.rule === "config-files" && f.message.toLowerCase().includes("package-lock.json"),
    );
    expect(match).toBeDefined();
    expect(match?.severity).toBe("violation");
    expect(match?.file).toBeNull();
    expect(match?.line).toBeNull();
  });

  test("violation when yarn.lock exists", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "yarn.lock"), "");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) => f.rule === "config-files" && f.message.toLowerCase().includes("yarn.lock"),
    );
    expect(match).toBeDefined();
    expect(match?.severity).toBe("violation");
  });
});

describe("run - config/tsconfig", () => {
  test("warning when tsconfig.json is missing", async () => {
    const dir = makeTempDir();
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) => f.rule === "config-files" && f.message.toLowerCase().includes("tsconfig.json"),
    );
    expect(match).toBeDefined();
    expect(match?.severity).toBe("warning");
    expect(match?.file).toBeNull();
    expect(match?.line).toBeNull();
  });

  test("no finding when tsconfig.json exists", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "tsconfig.json"), "{}");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) => f.rule === "config-files" && f.message.toLowerCase().includes("tsconfig.json"),
    );
    expect(match).toBeUndefined();
  });
});

describe("run - config/git-hooks", () => {
  test("warning when no git hook config exists", async () => {
    const dir = makeTempDir();
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) => f.rule === "config-files" && f.message.toLowerCase().includes("git hook"),
    );
    expect(match).toBeDefined();
    expect(match?.severity).toBe("warning");
  });

  test("no finding when .husky exists", async () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, ".husky"), { recursive: true });
    writeFileSync(join(dir, ".husky", "pre-commit"), "");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) => f.rule === "config-files" && f.message.toLowerCase().includes("git hook"),
    );
    expect(match).toBeUndefined();
  });

  test("no finding when lefthook.yml exists", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "lefthook.yml"), "");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) => f.rule === "config-files" && f.message.toLowerCase().includes("git hook"),
    );
    expect(match).toBeUndefined();
  });

  test("no finding when .lefthook.yml exists", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, ".lefthook.yml"), "");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) => f.rule === "config-files" && f.message.toLowerCase().includes("git hook"),
    );
    expect(match).toBeUndefined();
  });
});

describe("run - config/renovate", () => {
  test("warning when .github/renovate.json5 does not exist", async () => {
    const dir = makeTempDir();
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) => f.rule === "config-files" && f.message.toLowerCase().includes("renovate"),
    );
    expect(match).toBeDefined();
    expect(match?.severity).toBe("warning");
  });

  test("no finding when .github/renovate.json5 exists", async () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, ".github"), { recursive: true });
    writeFileSync(join(dir, ".github", "renovate.json5"), "{}");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) => f.rule === "config-files" && f.message.toLowerCase().includes("renovate"),
    );
    expect(match).toBeUndefined();
  });
});

describe("run - config/tool-versions", () => {
  test("warning when neither .tool-versions nor .mise.toml exists", async () => {
    const dir = makeTempDir();
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) =>
        f.rule === "config-files" &&
        (f.message.toLowerCase().includes(".tool-versions") ||
          f.message.toLowerCase().includes(".mise.toml")),
    );
    expect(match).toBeDefined();
    expect(match?.severity).toBe("warning");
  });

  test("no finding when .tool-versions exists", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, ".tool-versions"), "nodejs 20.0.0\n");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) =>
        f.rule === "config-files" &&
        (f.message.toLowerCase().includes(".tool-versions") ||
          f.message.toLowerCase().includes(".mise.toml")),
    );
    expect(match).toBeUndefined();
  });

  test("no finding when .mise.toml exists", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, ".mise.toml"), "[tools]\nnodejs = '20'\n");
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    const match = findings.find(
      (f) =>
        f.rule === "config-files" &&
        (f.message.toLowerCase().includes(".tool-versions") ||
          f.message.toLowerCase().includes(".mise.toml")),
    );
    expect(match).toBeUndefined();
  });
});

describe("run - all checks pass", () => {
  test("returns no findings when all config files are present and no lock files exist", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "tsconfig.json"), "{}");
    mkdirSync(join(dir, ".husky"), { recursive: true });
    writeFileSync(join(dir, ".husky", "pre-commit"), "");
    mkdirSync(join(dir, ".github"), { recursive: true });
    writeFileSync(join(dir, ".github", "renovate.json5"), "{}");
    writeFileSync(join(dir, ".mise.toml"), '[tools]\nnode = "20.0.0"\n');
    const findings = await run({
      rootDir: dir,
      label: "(root)",
      types: [],
      packageJson: null,
    });
    expect(findings).toHaveLength(0);
  });
});

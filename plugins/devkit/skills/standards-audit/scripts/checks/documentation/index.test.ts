import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectContext } from "../../core/types.ts";
import { meta, run } from "./index.ts";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "docs-check-test-"));
}

function makeCtx(rootDir: string, overrides?: Partial<ProjectContext>): ProjectContext {
  return {
    rootDir,
    label: "(root)",
    types: [],
    packageJson: null,
    ...overrides,
  };
}

describe("documentation check meta", () => {
  test("has correct name and scope", () => {
    expect(meta.name).toBe("documentation");
    expect(meta.scope).toBe("root");
  });

  test("appliesTo is empty (all project types)", () => {
    expect(meta.appliesTo).toEqual([]);
  });
});

describe("docs/agents-md", () => {
  test("warns when neither AGENTS.md nor CLAUDE.md exists", async () => {
    const dir = makeTempDir();
    const findings = await run(makeCtx(dir));
    const agentsMdFindings = findings.filter((f) => f.rule === "documentation");
    expect(agentsMdFindings.some((f) => f.message.includes("AGENTS.md"))).toBe(true);
    const agentsWarning = agentsMdFindings.find(
      (f) => f.message.includes("AGENTS.md") || f.message.includes("CLAUDE.md"),
    );
    expect(agentsWarning).toBeDefined();
    expect(agentsWarning?.severity).toBe("warning");
  });

  test("no finding when AGENTS.md exists", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "AGENTS.md"), "# Agents\n");
    const findings = await run(makeCtx(dir));
    const agentsMdFindings = findings.filter(
      (f) =>
        f.rule === "documentation" &&
        (f.message.includes("AGENTS.md") || f.message.includes("CLAUDE.md")),
    );
    // Should not produce the agents-md warning
    const hasAgentsMdWarning = agentsMdFindings.some(
      (f) =>
        f.message.toLowerCase().includes("does not exist") ||
        f.message.toLowerCase().includes("missing"),
    );
    expect(hasAgentsMdWarning).toBe(false);
  });

  test("no finding when CLAUDE.md exists (no AGENTS.md)", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "CLAUDE.md"), "# Claude\n");
    const findings = await run(makeCtx(dir));
    const hasAgentsMdWarning = findings.some(
      (f) =>
        f.rule === "documentation" &&
        (f.message.toLowerCase().includes("does not exist") ||
          f.message.toLowerCase().includes("missing")),
    );
    expect(hasAgentsMdWarning).toBe(false);
  });
});

describe("docs/auto-collected", () => {
  test("warns when monorepo with AGENTS.md but no marker comments", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "AGENTS.md"), "# Agents\n\nSome content without markers.\n");
    writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    const findings = await run(makeCtx(dir));
    const markerWarning = findings.find(
      (f) => f.rule === "documentation" && f.message.includes("<!-- BEGIN:"),
    );
    expect(markerWarning).toBeDefined();
    expect(markerWarning?.severity).toBe("warning");
  });

  test("no finding when monorepo with AGENTS.md has marker comments", async () => {
    const dir = makeTempDir();
    writeFileSync(
      join(dir, "AGENTS.md"),
      "# Agents\n\n<!-- BEGIN: plugins -->\n- plugin-a\n<!-- END: plugins -->\n",
    );
    writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    const findings = await run(makeCtx(dir));
    const markerWarning = findings.find(
      (f) => f.rule === "documentation" && f.message.includes("<!-- BEGIN:"),
    );
    expect(markerWarning).toBeUndefined();
  });

  test("skips auto-collected check for non-monorepo (no pnpm-workspace.yaml)", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "AGENTS.md"), "# Agents\n\nNo markers here.\n");
    // No pnpm-workspace.yaml
    const findings = await run(makeCtx(dir));
    const markerWarning = findings.find(
      (f) => f.rule === "documentation" && f.message.includes("<!-- BEGIN:"),
    );
    expect(markerWarning).toBeUndefined();
  });

  test("skips auto-collected check when AGENTS.md does not exist in monorepo", async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    // No AGENTS.md (only pnpm-workspace.yaml)
    const findings = await run(makeCtx(dir));
    // Should only get the agents-md warning, not the auto-collected one
    const markerWarning = findings.find(
      (f) => f.rule === "documentation" && f.message.includes("<!-- BEGIN:"),
    );
    expect(markerWarning).toBeUndefined();
  });
});

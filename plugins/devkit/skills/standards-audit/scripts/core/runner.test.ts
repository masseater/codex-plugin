import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { stubBun } from "../__tests__/bun-stub.ts";
import { discoverChecks, runChecksForScope, type CheckModule } from "./runner.ts";
import type { CheckMeta, ProjectContext } from "./types.ts";

function makeMeta(overrides?: Partial<CheckMeta>): CheckMeta {
  return { name: "c", description: "", references: [], appliesTo: [], scope: "all", ...overrides };
}

function makeScope(overrides?: Partial<ProjectContext>): ProjectContext {
  return { rootDir: "/p", label: "(root)", types: [], packageJson: null, ...overrides };
}

// run が findings を返す check
function makeCheck(meta: Partial<CheckMeta>, run: CheckModule["run"]): CheckModule {
  return { meta: makeMeta(meta), run };
}

function writeModule(checksDir: string, name: string, source: string): void {
  mkdirSync(join(checksDir, name), { recursive: true });
  writeFileSync(join(checksDir, name, "index.ts"), source);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("discoverChecks", () => {
  it("meta と run を持つ check だけを読み込み、読めない check は警告して飛ばす", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    stubBun();
    const dir = mkdtempSync(join(tmpdir(), "runner-vitest-"));
    writeModule(dir, "valid", "export const meta = {}; export async function run() { return []; }");
    writeModule(dir, "no-run", "export const meta = {};");
    writeModule(dir, "broken", "throw new Error('boom');");
    mkdirSync(join(dir, "empty"));

    const checks = await discoverChecks(dir);
    expect([...checks.keys()]).toEqual(["valid"]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("no-run missing meta or run"));
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to load check broken"));
  });
});

describe("runChecksForScope", () => {
  const finding = { severity: "warning", rule: "r", file: null, line: null, message: "m" } as const;

  it("projectType と scope が合う check だけを実行して findings を連結する", async () => {
    const calls: string[] = [];
    const track =
      (name: string): CheckModule["run"] =>
      async () => {
        calls.push(name);
        return [{ ...finding, rule: name }];
      };
    const checks = new Map<string, CheckModule>([
      ["all", makeCheck({ scope: "all" }, track("all"))],
      ["root-only", makeCheck({ scope: "root" }, track("root-only"))],
      ["ws-only", makeCheck({ scope: "workspace" }, track("ws-only"))],
      ["web", makeCheck({ appliesTo: ["web"] }, track("web"))],
      ["cli", makeCheck({ appliesTo: ["cli"] }, track("cli"))],
    ]);

    const rootFindings = await runChecksForScope(makeScope({ types: ["web"] }), checks, true);
    expect(rootFindings.map((f) => f.rule)).toEqual(["all", "root-only", "web"]);

    calls.length = 0;
    await runChecksForScope(makeScope(), checks, false);
    expect(calls).toEqual(["all", "ws-only"]);
  });

  it("check が例外を投げたら警告の finding にして他の check は続ける", async () => {
    const checks = new Map<string, CheckModule>([
      [
        "bad",
        makeCheck({}, async () => {
          throw new Error("kaboom");
        }),
      ],
      [
        "bad-string",
        makeCheck({}, async () => {
          throw "plain";
        }),
      ],
      ["good", makeCheck({}, async () => [finding])],
    ]);

    const findings = await runChecksForScope(makeScope(), checks, true);
    expect(findings.map((f) => f.message)).toEqual([
      "Check failed: kaboom",
      "Check failed: plain",
      "m",
    ]);
    expect(findings[0]).toMatchObject({ severity: "warning", rule: "bad" });
  });
});

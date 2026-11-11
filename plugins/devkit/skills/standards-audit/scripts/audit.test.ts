import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { audit } from "./audit.ts";
import { stubBun } from "./__tests__/bun-stub.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("audit", () => {
  it("package.json が無いプロジェクトは findings なしで早期終了する", async () => {
    const dir = mkdtempSync(join(tmpdir(), "audit-vitest-"));
    const result = await audit(dir);
    expect(result.scopeResults).toHaveLength(1);
    expect(result.scopeResults[0]!.findings).toEqual([]);
  });

  it("最小構成のプロジェクトでは scripts と quality-libs の違反を報告する", async () => {
    stubBun();
    const dir = mkdtempSync(join(tmpdir(), "audit-vitest-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "min", scripts: {} }));

    const result = await audit(dir);
    const rules = result.scopeResults.flatMap((scope) => scope.findings.map((f) => f.rule));
    expect(rules).toContain("scripts");
    expect(rules).toContain("quality-libs");
  });
});

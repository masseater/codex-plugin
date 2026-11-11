import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { stubBun } from "../../__tests__/bun-stub.ts";
import { makeCtx, makeProject } from "../../__tests__/project.ts";
import { meta, run } from "./index.ts";

beforeEach(() => {
  stubBun();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseScripts = { check: "vp check", typecheck: "tsgo --noEmit" };

describe("scripts", () => {
  it("meta は all スコープ", () => {
    expect(meta.name).toBe("scripts");
    expect(meta.scope).toBe("all");
  });

  it("package.json が無ければ何も検査しない", async () => {
    expect(await run(makeCtx(makeProject(), null))).toEqual([]);
  });

  it("check と typecheck が無ければ違反にする", async () => {
    const findings = await run(makeCtx(makeProject(), { scripts: {} }));
    expect(findings.map((f) => f.severity)).toEqual(["violation", "violation"]);
    expect(findings[0]!.message).toContain('"check"');
    expect(findings[1]!.message).toContain('"typecheck"');
  });

  it("scripts 自体が無い package.json も同じ扱いにする", async () => {
    const findings = await run(makeCtx(makeProject(), {}));
    expect(findings).toHaveLength(2);
  });

  it("typecheck が tsgo でなければ違反にし、現在の値を示す", async () => {
    const findings = await run(
      makeCtx(makeProject(), { scripts: { check: "x", typecheck: "tsc --noEmit" } }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('Current value: "tsc --noEmit"');
  });

  it("*.test.ts があるのに test:coverage が無ければ警告にする", async () => {
    const dir = makeProject({ "src/a.test.ts": "" });
    const findings = await run(makeCtx(dir, { scripts: baseScripts }));
    expect(findings.map((f) => [f.severity, f.message.includes("test:coverage")])).toEqual([
      ["warning", true],
      ["warning", false],
    ]);
  });

  it("test:coverage があるか、テストが無ければ警告しない", async () => {
    const withScript = makeProject({ "a.test.ts": "" });
    expect(
      await run(makeCtx(withScript, { scripts: { ...baseScripts, "test:coverage": "x" } })),
    ).toEqual([]);
    expect(await run(makeCtx(makeProject(), { scripts: baseScripts }))).toEqual([]);
  });

  it("存在しない rootDir ではテスト探索を飛ばす", async () => {
    expect(await run(makeCtx("/nonexistent-devkit-dir", { scripts: baseScripts }))).toEqual([]);
  });

  it("src/ があるのに knip が無ければ警告にし、あれば警告しない", async () => {
    const dir = makeProject({ "src/a.ts": "" });
    const findings = await run(makeCtx(dir, { scripts: baseScripts }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain('"knip"');
    expect(await run(makeCtx(dir, { scripts: { ...baseScripts, knip: "knip" } }))).toEqual([]);
  });
});

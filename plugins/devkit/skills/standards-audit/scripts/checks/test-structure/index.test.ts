import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { stubBun } from "../../__tests__/bun-stub.ts";
import { makeCtx, makeProject } from "../../__tests__/project.ts";
import { meta, run } from "./index.ts";

const byText = (a: unknown[], b: unknown[]): number => String(a).localeCompare(String(b));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("test-structure", () => {
  it("meta は workspace スコープ", () => {
    expect(meta.name).toBe("test-structure");
    expect(meta.scope).toBe("workspace");
  });

  it("コロケーションされた .test.ts だけなら指摘しない", async () => {
    stubBun();
    const dir = makeProject({ "src/a.ts": "", "src/a.test.ts": "" });
    expect(await run(makeCtx(dir))).toEqual([]);
  });

  it("__tests__ / __test__ ディレクトリは 1 ディレクトリ 1 件の違反にする", async () => {
    stubBun();
    const dir = makeProject({
      "src/__tests__/a.test.ts": "",
      "src/__tests__/b.test.ts": "",
      "__test__/c.test.ts": "",
    });

    const findings = await run(makeCtx(dir));
    expect(findings.map((f) => [f.severity, f.file]).toSorted(byText)).toEqual([
      ["violation", "__test__"],
      ["violation", "src/__tests__"],
    ]);
  });

  it(".spec.ts / .spec.tsx は警告にし、除外ディレクトリの中は見ない", async () => {
    stubBun();
    const dir = makeProject({
      "src/a.spec.ts": "",
      "src/b.spec.tsx": "",
      "node_modules/pkg/__tests__/x.ts": "",
      "dist/c.spec.ts": "",
    });

    const findings = await run(makeCtx(dir));
    expect(findings.map((f) => [f.severity, f.file]).toSorted(byText)).toEqual([
      ["warning", "src/a.spec.ts"],
      ["warning", "src/b.spec.tsx"],
    ]);
  });
});

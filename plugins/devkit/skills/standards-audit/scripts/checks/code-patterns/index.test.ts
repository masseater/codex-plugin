import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { stubBun } from "../../__tests__/bun-stub.ts";
import { makeCtx, makeProject } from "../../__tests__/project.ts";
import { meta, run } from "./index.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("code-patterns", () => {
  it("meta は workspace スコープの全 project type 向け", () => {
    expect(meta.name).toBe("code-patterns");
    expect(meta.scope).toBe("workspace");
  });

  it("env 検証の回避と直接の process.env 参照を違反にする", async () => {
    stubBun();
    const dir = makeProject({
      "src/a.ts": "const a = skipEnvValidation;\nconst b = process.env.FOO;\n",
    });

    const findings = await run(makeCtx(dir));
    expect(findings.map((f) => [f.rule, f.line])).toEqual([
      ["code/no-skip-env", 1],
      ["code/no-direct-process-env", 2],
    ]);
    expect(findings.every((f) => f.severity === "violation")).toBe(true);
  });

  it("コメント行・env.ts・設定ファイル・テスト・d.ts の process.env は許す", async () => {
    stubBun();
    const dir = makeProject({
      "src/comment.ts": "// process.env.FOO\n/* process.env.BAR */\n * process.env.BAZ\n",
      "src/env.ts": "export const x = process.env.FOO;\n",
      "vite.config.ts": "process.env.FOO;\n",
      "src/a.test.ts": "process.env.FOO;\n",
      "src/a.d.ts": "process.env.FOO;\n",
    });

    expect(await run(makeCtx(dir))).toEqual([]);
  });
});

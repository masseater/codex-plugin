import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { fakeProcess, stubBun } from "../__tests__/bun-stub.ts";
import { makeProject } from "../__tests__/project.ts";
import { DEFAULT_EXCLUDE_DIRS, grepProject, isInExcludedDir } from "./grep.ts";

// rg --json の match 行
function rgMatch(dir: string, file: string, line: number, text: string): string {
  const data = { path: { text: join(dir, file) }, line_number: line, lines: { text } };
  return JSON.stringify({ type: "match", data });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isInExcludedDir", () => {
  it("先頭と途中の除外ディレクトリを検出する", () => {
    expect(isInExcludedDir("node_modules/a.ts", DEFAULT_EXCLUDE_DIRS)).toBe(true);
    expect(isInExcludedDir("pkg/dist/a.ts", DEFAULT_EXCLUDE_DIRS)).toBe(true);
    expect(isInExcludedDir("src/a.ts", DEFAULT_EXCLUDE_DIRS)).toBe(false);
  });
});

describe("grepProject (ripgrep)", () => {
  it("rg の JSON 出力から一致を取り出し、match 以外と JSON でない行は読み飛ばす", async () => {
    const dir = "/proj";
    const output = [
      JSON.stringify({ type: "begin" }),
      "",
      "not json",
      rgMatch(dir, "src/a.ts", 3, "  hit  \n"),
      JSON.stringify({ type: "match" }),
    ].join("\n");
    stubBun(() => fakeProcess(output, 0));

    expect(await grepProject(dir, "hit", "**/*.ts")).toEqual([
      { file: "src/a.ts", line: 3, content: "  hit" },
    ]);
  });

  it("rg が 1（一致なし）で終わったら空配列を返し、JS 実装には切り替えない", async () => {
    const dir = makeProject({ "a.ts": "hit\n" });
    stubBun(() => fakeProcess("", 1));
    expect(await grepProject(dir, "hit", "**/*.ts")).toEqual([]);
  });

  it("glob のディレクトリ部分は検索パスに、残りは rg の glob にする", async () => {
    const spawn = vi.fn((_args: string[]) => fakeProcess("", 1));
    stubBun(spawn);
    await grepProject("/proj", "x", "src/**/*.ts", ["**/env.ts"]);

    const args = spawn.mock.calls[0]![0];
    expect(args.slice(0, 4)).toEqual(["rg", "--json", "--glob", "**/*.ts"]);
    expect(args).toContain("!**/env.ts");
    expect(args).toContain("!**/node_modules/**");
    expect(args.at(-1)).toBe("/proj/src");
  });

  it("rg が使えないとき DEBUG ならログを出して JS 実装に切り替える", async () => {
    vi.stubEnv("DEBUG", "1");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dir = makeProject({ "a.ts": "hit\n" });
    stubBun();

    expect(await grepProject(dir, "hit", "**/*.ts")).toHaveLength(1);
    expect(error).toHaveBeenCalledWith("[debug] ripgrep unavailable:", expect.any(Error));
  });
});

// rg の終了コード 2 は実行エラー。呼び出し側は JS 実装に切り替える
function stubRgError(): void {
  stubBun(() => fakeProcess("", 2));
}

describe("grepProject (JS 実装)", () => {
  it("一致を行番号付きで返し、除外ディレクトリとパターンを除く", async () => {
    const dir = makeProject({
      "src/a.ts": "ok\nhit here\n",
      "src/env.ts": "hit\n",
      "src/app.config.ts": "hit\n",
      "node_modules/pkg/index.ts": "hit\n",
      "dist/out.ts": "hit\n",
    });
    stubRgError();

    const matches = await grepProject(dir, "hit", "**/*.ts", ["**/env.ts", "**/*.config.*"]);
    expect(matches).toEqual([{ file: "src/a.ts", line: 2, content: "hit here" }]);
  });

  it("読めないファイルは読み飛ばし、DEBUG ならログを出す", async () => {
    vi.stubEnv("DEBUG", "1");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dir = makeProject({ "good.ts": "hit\n" });
    mkdirSync(join(dir, "dir.ts"));
    stubRgError();

    const matches = await grepProject(dir, "hit", "**/*.ts");
    expect(matches.map((m) => m.file)).toEqual(["good.ts"]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("skipped unreadable file dir.ts"),
      expect.any(Error),
    );
  });

  it("DEBUG が無ければ読めないファイルでも静かに続ける", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dir = makeProject({});
    mkdirSync(join(dir, "dir.ts"));
    stubRgError();

    expect(await grepProject(dir, "hit", "**/*.ts")).toEqual([]);
    expect(error).not.toHaveBeenCalled();
  });
});

describe("grepProject (rg の出力が壊れている場合)", () => {
  it("DEBUG ならスキップした行をログに残す", async () => {
    vi.stubEnv("DEBUG", "1");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    stubBun(() => fakeProcess("{broken", 0));

    expect(await grepProject("/proj", "x", "**/*.ts")).toEqual([]);
    expect(error).toHaveBeenCalledWith("[debug] skipped non-JSON rg output:", expect.any(Error));
  });
});

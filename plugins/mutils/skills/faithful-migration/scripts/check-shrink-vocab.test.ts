import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { findShrinkVocab, main } from "./check-shrink-vocab.ts";

describe("findShrinkVocab", () => {
  test("detects forbidden terms outside the allowed heading", () => {
    const text = [
      "## Outcome",
      "編集モードの subset だけ対応した",
      "## 検証",
      "merge 後にローカル確認する",
    ].join("\n");
    const findings = findShrinkVocab(text);
    expect(findings.map((f) => [f.line, f.term])).toEqual([
      [2, "subset"],
      [4, "merge 後にローカル確認"],
    ]);
  });

  test("allows terms under the 未対応の残作業 heading until the next heading of the same level", () => {
    const text = [
      "## 未対応の残作業",
      "- 一覧画面は subset のまま",
      "### 詳細",
      "- 骨格のみ",
      "## Relates",
      "- 次の PR で対応",
    ].join("\n");
    const findings = findShrinkVocab(text);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.line).toBe(6);
  });

  test("matches case-insensitively", () => {
    expect(findShrinkVocab("Walking Skeleton を作った")).toHaveLength(1);
  });

  test("returns nothing for clean text", () => {
    expect(findShrinkVocab("ユーザーが新規作成から保存まで 1 周通せる")).toEqual([]);
  });
});

describe("main", () => {
  const dirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function fileWith(text: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), "shrink-vocab-"));
    dirs.push(dir);
    const file = path.join(dir, "pr.md");
    writeFileSync(file, text);
    return file;
  }

  test("prints usage and returns 2 without a file argument", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(main(undefined)).toBe(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("usage:"));
  });

  test("prints each finding and returns 1", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const file = fileWith("ok\nsubset だけ\n");
    expect(main(file)).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining(`${file}:2: "subset"`));
  });

  test("returns 0 for a clean file", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(main(fileWith("全部できた\n"))).toBe(0);
    expect(log).not.toHaveBeenCalled();
  });
});

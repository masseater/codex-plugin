import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import {
  compareFile,
  findConflictMarkers,
  hasFindings,
  multisetDiff,
  parsePatchLines,
  verifyMerge,
} from "./verify-merge.ts";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("node:fs", () => ({ existsSync: vi.fn(), readFileSync: vi.fn() }));

describe("parsePatchLines", () => {
  test("collects added and removed bodies and skips headers and blank lines", () => {
    const patch = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1,2 +1,2 @@",
      "-const a = 1;",
      "+const a = 2;",
      "+",
      " unchanged",
    ].join("\n");
    expect(parsePatchLines(patch)).toStrictEqual({
      added: ["const a = 2;"],
      removed: ["const a = 1;"],
    });
  });
});

describe("multisetDiff", () => {
  test("respects multiplicity", () => {
    expect(multisetDiff(["x", "x", "y"], ["x"])).toStrictEqual(["x", "y"]);
  });
});

describe("compareFile", () => {
  test("reports nothing when the branch diff equals the authored patch", () => {
    const patch = "+export const a = 1;\n-export const a = 0;";
    const finding = compareFile("a.ts", patch, patch, "export const a = 1;\n");
    expect(hasFindings(finding)).toBe(false);
  });

  test("detects lines mixed in from the merge and lines lost from the branch", () => {
    const authored = "+mine();\n+alsoMine();";
    const branch = "+mine();\n+fromBase();";
    const finding = compareFile("a.ts", branch, authored, null);
    expect(finding.extraAdded).toStrictEqual(["fromBase();"]);
    expect(finding.lostAdded).toStrictEqual(["alsoMine();"]);
  });

  test("cancels lines added then removed across authored commits", () => {
    const authored = "+temp();\n-temp();\n+kept();";
    const finding = compareFile("a.ts", "+kept();", authored, null);
    expect(hasFindings(finding)).toBe(false);
  });

  test("detects a deletion that came back after the merge", () => {
    const finding = compareFile("a.ts", "", "-legacy();", null);
    expect(finding.lostRemoved).toStrictEqual(["legacy();"]);
  });
});

describe("findConflictMarkers", () => {
  test("returns 1-based line numbers of markers", () => {
    const content = ["a", "<<<<<<< HEAD", "b", "=======", "c", ">>>>>>> main"].join("\n");
    expect(findConflictMarkers(content)).toStrictEqual([2, 4, 6]);
  });

  test("ignores a lone separator line without an opening marker", () => {
    expect(findConflictMarkers("Title\n=======\n")).toStrictEqual([]);
  });
});

// git のサブコマンドごとの出力を差し替える
function stubGit(outputs: { diff: (path?: string) => string; log: (path?: string) => string }) {
  vi.mocked(execFileSync).mockImplementation((_file, args = []) => {
    const [sub, ...rest] = args;
    if (sub === "merge-base") return "abc123\n";
    if (sub === "diff") return outputs.diff(args.includes("--name-only") ? undefined : args.at(-1));
    if (sub === "log") return outputs.log(args.includes("--name-only") ? undefined : args.at(-1));
    return rest.join(" ");
  });
}

describe("verifyMerge", () => {
  afterEach(() => {
    vi.mocked(execFileSync).mockReset();
    vi.mocked(existsSync).mockReset();
    vi.mocked(readFileSync).mockReset();
  });

  test("origin/ の base は fetch し、両方の差分に現れるファイルを 1 回だけ調べる", () => {
    stubGit({
      diff: (path) => (path === undefined ? "a.ts\nb.ts\n" : "+changed();"),
      log: (path) => (path === undefined ? "b.ts\n\nc.ts\n" : "+changed();"),
    });
    vi.mocked(existsSync).mockReturnValue(false);

    const result = verifyMerge("origin/main");

    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["fetch", "origin", "main"],
      expect.anything(),
    );
    expect(result).toEqual({
      base: "origin/main",
      mergeBase: "abc123",
      checkedFiles: 3,
      findings: [],
    });
  });

  test("混入した行と残ったコンフリクトマーカーを finding にする", () => {
    stubGit({
      diff: (path) => (path === undefined ? "a.ts\n" : "+mine();\n+fromBase();"),
      log: (path) => (path === undefined ? "" : "+mine();"),
    });
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> main\n");

    const result = verifyMerge("main");

    expect(execFileSync).not.toHaveBeenCalledWith(
      "git",
      ["fetch", "origin", "main"],
      expect.anything(),
    );
    expect(result.findings).toEqual([
      {
        path: "a.ts",
        extraAdded: ["fromBase();"],
        extraRemoved: [],
        lostAdded: [],
        lostRemoved: [],
        conflictMarkerLines: [1, 3, 5],
      },
    ]);
  });
});

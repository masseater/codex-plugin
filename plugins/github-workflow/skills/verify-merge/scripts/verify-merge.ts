#!/usr/bin/env bun
/**
 * ブランチの正味の差分（base...HEAD）と、ブランチ自身の非 merge コミットのパッチを行単位で突き合わせ、
 * merge / conflict 解消で混入・消失した行と、残ったコンフリクトマーカーを JSON で出力する。
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { defineCommand, runMain } from "citty";

export type PatchLines = { added: string[]; removed: string[] };

export type FileFinding = {
  path: string;
  /** base...HEAD にあるがブランチのコミットにない追加行（base 側や解消時の混入） */
  extraAdded: string[];
  /** base...HEAD にあるがブランチのコミットにない削除行（base 側の変更を巻き戻した疑い） */
  extraRemoved: string[];
  /** ブランチのコミットで追加したのに base...HEAD から消えた行 */
  lostAdded: string[];
  /** ブランチのコミットで削除したのに base...HEAD で復活した行 */
  lostRemoved: string[];
  /** 作業ツリーのファイルに残るコンフリクトマーカーの行番号（1 始まり） */
  conflictMarkerLines: number[];
};

export type VerifyResult = {
  base: string;
  mergeBase: string;
  checkedFiles: number;
  findings: FileFinding[];
};

// unified diff から追加行・削除行の本文を取り出す。空白だけの行は比較対象から外す。
export function parsePatchLines(patch: string): PatchLines {
  const lines = patch.split("\n");
  return { added: changedBodies(lines, "+"), removed: changedBodies(lines, "-") };
}

function isPatchHeader(line: string): boolean {
  return line.startsWith("+++") || line.startsWith("---");
}

/**
 * diff の行のうち、指定した記号で始まる変更行の本文を取り出す。
 *
 * @param lines - unified diff の行
 * @param sign - 追加なら "+"、削除なら "-"
 * @returns 末尾の空白を除いた本文。空白だけの行は除く
 */
function changedBodies(lines: string[], sign: "+" | "-"): string[] {
  return lines
    .filter((line) => line.startsWith(sign) && !isPatchHeader(line))
    .map((line) => line.slice(1).trimEnd())
    .filter((body) => body.trim() !== "");
}

// 多重集合の差 a − b（出現回数を考慮する）
export function multisetDiff(a: string[], b: string[]): string[] {
  const remaining = new Map<string, number>();
  for (const line of b) remaining.set(line, (remaining.get(line) ?? 0) + 1);
  return a.filter((line) => {
    const count = remaining.get(line) ?? 0;
    if (count === 0) return true;
    remaining.set(line, count - 1);
    return false;
  });
}

export function compareFile(
  path: string,
  branchPatch: string,
  authoredPatch: string,
  content: string | null,
): FileFinding {
  const pr = parsePatchLines(branchPatch);
  const authored = parsePatchLines(authoredPatch);
  // コミット間で追加→削除された行は相殺し、ブランチとしての正味の変更にする
  const netAdded = multisetDiff(authored.added, authored.removed);
  const netRemoved = multisetDiff(authored.removed, authored.added);
  return {
    path,
    extraAdded: multisetDiff(pr.added, netAdded),
    extraRemoved: multisetDiff(pr.removed, netRemoved),
    lostAdded: multisetDiff(netAdded, pr.added),
    lostRemoved: multisetDiff(netRemoved, pr.removed),
    conflictMarkerLines: content === null ? [] : findConflictMarkers(content),
  };
}

export function findConflictMarkers(content: string): number[] {
  const lines = content.split("\n");
  const hasOpening = lines.some((line) => line.startsWith("<<<<<<< "));
  return lines.flatMap((line, index) => (isConflictMarker(line, hasOpening) ? [index + 1] : []));
}

/**
 * conflict marker の行かを判定する。`=======` は開始 marker があるファイルでだけ marker とみなす。
 *
 * @param line - ファイルの 1 行
 * @param hasOpening - ファイルに `<<<<<<< ` で始まる行があるか
 * @returns conflict marker の行なら true
 */
function isConflictMarker(line: string, hasOpening: boolean): boolean {
  return (
    line.startsWith("<<<<<<< ") ||
    line.startsWith(">>>>>>> ") ||
    (hasOpening && line.trimEnd() === "=======")
  );
}

export function hasFindings(finding: FileFinding): boolean {
  return [
    finding.extraAdded,
    finding.extraRemoved,
    finding.lostAdded,
    finding.lostRemoved,
    finding.conflictMarkerLines,
  ].some((items) => items.length > 0);
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
}

function resolveBase(explicit: string | undefined): string {
  if (explicit) return explicit;
  const baseBranch = execFileSync(
    "gh",
    ["pr", "view", "--json", "baseRefName", "--jq", ".baseRefName"],
    { encoding: "utf-8" },
  ).trim();
  if (!baseBranch) throw new Error("PR の base branch を取得できない。--base を指定する");
  return `origin/${baseBranch}`;
}

function splitLines(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function verifyMerge(base: string): VerifyResult {
  if (base.startsWith("origin/")) git(["fetch", "origin", base.slice("origin/".length)]);
  const mergeBase = git(["merge-base", base, "HEAD"]).trim();

  const files = [
    ...new Set([
      ...splitLines(git(["diff", "--name-only", `${base}...HEAD`])),
      ...splitLines(git(["log", "--no-merges", "--name-only", "--format=", `${base}..HEAD`])),
    ]),
  ].toSorted();

  const findings = files
    .map((path) =>
      compareFile(
        path,
        git(["diff", `${base}...HEAD`, "--", path]),
        git(["log", "--no-merges", "-p", "--format=", `${base}..HEAD`, "--", path]),
        existsSync(path) ? readFileSync(path, "utf-8") : null,
      ),
    )
    .filter(hasFindings);

  return { base, mergeBase, checkedFiles: files.length, findings };
}

const main = defineCommand({
  meta: {
    name: "verify-merge",
    description:
      "base...HEAD の差分とブランチの非 merge コミットを行単位で比較し、混入・消失・マーカー残りを JSON で出す",
  },
  args: {
    base: {
      type: "string",
      description: "比較する base ref（既定: 現在の PR の origin/<baseRefName>）",
      required: false,
    },
  },
  run({ args }) {
    const result = verifyMerge(resolveBase(args.base));
    console.log(JSON.stringify(result, null, 2));
  },
});

if (import.meta.main) {
  await runMain(main);
}

#!/usr/bin/env bun
/**
 * PR 本文・コミットメッセージのドラフトから、縮小再生産を糊塗する語彙を検出する。
 * 「## 未対応の残作業」見出しの配下にある行は、明示された残作業として許可する。
 * 検出があれば行番号付きで stdout に出し、exit 1 で終わる。
 */
import { readFileSync } from "node:fs";

/** 縮小再生産を糊塗する語彙。PR 本文とコミットメッセージで検出する */
export const FORBIDDEN_TERMS = [
  "(編集モード)のみ対応",
  "subset",
  "部分対応",
  "as-is",
  "骨格",
  "walking skeleton",
  "mock 除去",
  "機能パリティ",
  "後続 PR で対応",
  "次の PR で",
  "レビュー後にローカルで確認",
  "merge 後にローカル確認",
] as const;

const ALLOWED_HEADING = "未対応の残作業";

/** 検出 1 件: 行番号（1 始まり）、一致した語、その行の本文 */
export interface Finding {
  line: number;
  term: string;
  text: string;
}

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;

function closesSection(level: number, allowedLevel: number | undefined): boolean {
  return allowedLevel !== undefined && level <= allowedLevel;
}

/**
 * 行が見出しなら、許可する区間の見出しレベルを更新する
 * @param raw 行の本文
 * @param allowedLevel 現在の許可区間の見出しレベル（区間外なら undefined）
 * @returns この行を読んだ後の許可区間の見出しレベル
 */
function nextAllowedLevel(raw: string, allowedLevel: number | undefined): number | undefined {
  const heading = HEADING_PATTERN.exec(raw);
  if (!heading) return allowedLevel;
  const level = heading[1]!.length;
  if (heading[2]!.trim() === ALLOWED_HEADING) return level;
  return closesSection(level, allowedLevel) ? undefined : allowedLevel;
}

function lineFindings(raw: string, index: number): Finding[] {
  const lower = raw.toLowerCase();
  return FORBIDDEN_TERMS.filter((term) => lower.includes(term.toLowerCase())).map((term) => ({
    line: index + 1,
    term,
    text: raw.trim(),
  }));
}

/**
 * テキストから縮小語彙を検出する。「未対応の残作業」見出しの配下は、同じか上位の見出しが来るまで許可する
 * @param text 検査する Markdown テキスト
 * @returns 検出結果（見つからなければ空配列）
 */
export function findShrinkVocab(text: string): Finding[] {
  const findings: Finding[] = [];
  let allowedLevel: number | undefined;

  text.split("\n").forEach((raw, index) => {
    allowedLevel = nextAllowedLevel(raw, allowedLevel);
    if (allowedLevel === undefined) findings.push(...lineFindings(raw, index));
  });
  return findings;
}

/**
 * CLI の本体。検出結果を stdout に出し、終了コードを返す
 * @param path 検査するファイルのパス
 * @returns 終了コード（検出なしは 0、検出ありは 1、引数なしは 2）
 */
export function main(path: string | undefined): number {
  if (!path) {
    console.error("usage: check-shrink-vocab.ts <file>");
    return 2;
  }
  const findings = findShrinkVocab(readFileSync(path, "utf-8"));
  for (const f of findings) {
    console.log(`${path}:${f.line}: "${f.term}" — ${f.text}`);
  }
  return findings.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv[2]));
}

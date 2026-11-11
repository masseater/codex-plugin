/**
 * 基準のディレクトリの下にパスを組み立て、外に出ていないことを確かめてから使う。
 * ~/.ccs 配下のプロファイル名やセッション ID のように、引数や設定から来る名前でパスを作るときに、`..` などで外へ出るのを防ぐ。
 */
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * base の下のパスを組み立てる。
 *
 * @param base - 基準のディレクトリ
 * @param segments - base からの相対パスの要素
 * @returns 組み立てたパス
 * @throws Error 結果が base の外に出る場合
 */
export function pathIn(base: string, ...segments: string[]): string {
  const joined = path.join(base, ...segments);
  const fromBase = path.relative(base, joined);
  if (fromBase.startsWith("..") || path.isAbsolute(fromBase)) {
    throw new Error(`path escapes ${base}: ${segments.join("/")}`);
  }
  return joined;
}

/**
 * base の下のファイルをテキストとして読む。
 *
 * @param base - 基準のディレクトリ
 * @param segments - base からの相対パスの要素
 * @returns ファイルの内容
 * @throws Error パスが base の外に出る場合や、読めない場合
 */
export function readTextIn(base: string, ...segments: string[]): string {
  const filePath = pathIn(base, ...segments);
  // fallow-ignore-next-line security-sink -- filePath は直前の pathIn で base の中に収めたパス
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * 基準のディレクトリの下にパスを組み立て、外に出ていないことを確かめる。
 * スクリプトが引数で受け取ったディレクトリやその中のエントリ名からパスを作るときに、`..` などで外へ出るのを防ぐ。
 */
import path from "node:path";

/**
 * base の下のパスを組み立てる。結果が base の外に出るときは null を返す。
 *
 * @param base - 基準のディレクトリ
 * @param segments - base からの相対パスの要素
 * @returns 組み立てたパス。base の外に出るなら null
 */
export function tryPathIn(base: string, ...segments: string[]): string | null {
  const joined = path.join(base, ...segments);
  const fromBase = path.relative(base, joined);
  return fromBase.startsWith("..") || path.isAbsolute(fromBase) ? null : joined;
}

/**
 * base の下のパスを組み立てる。
 *
 * @param base - 基準のディレクトリ
 * @param segments - base からの相対パスの要素
 * @returns 組み立てたパス
 * @throws Error 結果が base の外に出る場合
 */
export function pathIn(base: string, ...segments: string[]): string {
  const joined = tryPathIn(base, ...segments);
  if (joined === null) {
    throw new Error(`path escapes ${base}: ${segments.join("/")}`);
  }
  return joined;
}

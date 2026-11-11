/**
 * hook が扱うパス（ホームディレクトリ配下の Vault や transcript）を組み立てる。
 * os.homedir() を都度読むことで、テスト時に node:os の homedir をモックして場所を差し替えられるようにする。
 */
import os from "node:os";
import path from "node:path";

/**
 * 先頭の `~/` をホームディレクトリに展開し、絶対パスにする。
 *
 * @param filePath - hook の入力にあるパス
 * @returns 絶対パス
 */
export function expandHome(filePath: string): string {
  const expanded = filePath.startsWith("~/")
    ? path.join(os.homedir(), filePath.slice(2))
    : filePath;
  return path.resolve(expanded);
}

/**
 * Zettelkasten の Vault のパスを返す。
 *
 * @returns ~/Documents/Zettelkasten
 */
export function vaultPath(): string {
  return path.join(os.homedir(), "Documents", "Zettelkasten");
}

/**
 * ディレクトリの中のエントリのパスを作る。
 *
 * @param dir - ディレクトリ
 * @param name - readdir が返したエントリ名
 * @returns エントリのパス
 */
export function entryPath(dir: string, name: string): string {
  return path.join(dir, name);
}

/**
 * target が base の中（base 自身を除く）にあるかを判定する。前方一致だけだと隣の `Zettelkasten-old` なども通るため、相対パスで確かめる。
 *
 * @param base - 基準のディレクトリ
 * @param target - 判定するパス
 * @returns base の中なら true
 */
export function isInside(base: string, target: string): boolean {
  const fromBase = path.relative(base, target);
  return fromBase !== "" && !fromBase.startsWith("..") && !path.isAbsolute(fromBase);
}

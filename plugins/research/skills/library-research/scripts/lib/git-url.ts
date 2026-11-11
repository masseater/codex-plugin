/**
 * npm / GitHub リポジトリの `repository` フィールドを一般的な git URL に正規化する
 * @param raw 正規化前の URL（`git+` プレフィックスや `.git` サフィックスを含みうる）
 * @returns 正規化された https URL
 */
export function cleanGitUrl(raw: string): string {
  return raw
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git:\/\//, "https://");
}

const PACKAGES_ITEM_PATTERN = /^\s+-\s+/;

/**
 * `packages:` の後から、次のトップレベルのキーまでの行を取り出す
 * @param lines pnpm-workspace.yaml の行
 * @returns packages の配下の行
 */
function packagesSection(lines: string[]): string[] {
  const start = lines.findIndex((line) => line.startsWith("packages:"));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^\S/.test(line) && !line.startsWith("packages:"));
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * Parse pnpm-workspace.yaml with regex (no yaml dependency)
 * @param content pnpm-workspace.yaml の内容
 * @returns packages に列挙された glob
 */
export function parsePnpmWorkspaceYaml(content: string): string[] {
  return packagesSection(content.split("\n"))
    .filter((line) => PACKAGES_ITEM_PATTERN.test(line))
    .map((line) => line.replace(PACKAGES_ITEM_PATTERN, "").replace(/['"]/g, "").trim());
}

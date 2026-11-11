/**
 * セミコロン区切りの複数の SQL 文を、空文を除いて 1 文ずつに分ける。
 *
 * @param sql - 複数の SQL 文
 * @returns 前後の空白を除いた SQL 文の一覧
 */
export function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

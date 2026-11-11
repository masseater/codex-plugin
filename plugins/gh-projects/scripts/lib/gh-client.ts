/**
 * gh CLI 実行と GitHub GraphQL API 呼び出しの基盤処理。
 * 各コマンドモジュールはここから gh / graphql / issueNodeId / need をインポートして利用する。
 */

const { $ } = Bun;
$.throws(true);

export { $ };

/**
 * gh コマンドを実行し、標準出力をテキストとして返す。
 * @param args gh コマンドに渡す引数配列
 * @returns 前後の空白を取り除いたコマンド標準出力
 */
export const gh = async (args: string[]) => {
  const result = await $`gh ${args}`.text();
  return result.trim();
};

/**
 * gh CLI 経由で GitHub GraphQL API を呼び出す。
 * @param query 実行する GraphQL クエリ / ミューテーション文字列
 * @param variables クエリに渡す変数（キーは変数名、値は文字列）
 * @returns レスポンスの data フィールド
 */
export const graphql = async (query: string, variables: Record<string, string> = {}) => {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [k, v] of Object.entries(variables)) {
    args.push("-f", `${k}=${v}`);
  }
  const result = await $`gh ${args}`.json();
  if (result.errors) {
    throw new Error(result.errors.map((e: { message: string }) => e.message).join("\n"));
  }
  return result.data;
};

/**
 * Issue 番号から GraphQL ノード ID を取得する。
 * @param repo `owner/repo` 形式のリポジトリ指定
 * @param number Issue 番号
 * @returns Issue の GraphQL ノード ID
 */
export const issueNodeId = async (repo: string, number: number) => {
  const result = await $`gh issue view ${number} -R ${repo} --json id --jq .id`.text();
  return result.trim();
};

/**
 * 必須の CLI 引数が指定されているか検証する。
 * @param value 検証対象の値
 * @param name 引数名（エラーメッセージに使用）
 * @returns 検証済みの値
 */
export const need = (value: string | undefined, name: string): string => {
  if (value === undefined || value === "") {
    throw new Error(`Missing required argument: ${name}`);
  }
  return value;
};

/**
 * CLI サブコマンドの定義。
 */
export type Command = {
  description: string;
  usage: string;
  run: (args: string[]) => Promise<void>;
};

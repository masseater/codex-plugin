import { vi } from "vite-plus/test";

/** `process.exit` の代わりに投げ、スクリプトの以降の処理を止める */
class ExitSignal extends Error {}

export type CliRun = { stdout: string; stderr: string; exitCodes: number[] };

/**
 * トップレベルで `runMain` を呼ぶ CLI スクリプトを、引数を差し替えて読み込み直して実行する。
 * stdout / stderr を取り込み、`process.exit` は exit code を記録して以降の処理を止める。
 *
 * @param load - スクリプトを動的 import する関数
 * @param args - スクリプトに渡す引数
 * @returns 出力と exit code の記録
 */
export async function runCli(load: () => Promise<unknown>, args: string[]): Promise<CliRun> {
  const run: CliRun = { stdout: "", stderr: "", exitCodes: [] };
  const originalArgv = process.argv;
  process.argv = ["bun", "script.ts", ...args];
  // 呼び出し側が張った spy（process.cwd など）を巻き込まないよう、ここで作った spy だけを戻す
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      run.stdout += String(chunk);
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      run.stderr += String(chunk);
      return true;
    }),
    vi.spyOn(process, "exit").mockImplementation((code) => {
      run.exitCodes.push(typeof code === "number" ? code : 0);
      throw new ExitSignal();
    }),
    // citty が失敗を console.error で出すため、テスト出力を汚さないよう捨てる
    vi.spyOn(console, "error").mockImplementation(() => {}),
  ];
  try {
    vi.resetModules();
    await load();
  } catch (error) {
    // process.exit の代替が投げたものだけを握りつぶす。それ以外はテストの失敗として伝える
    if (!(error instanceof ExitSignal)) throw error;
  } finally {
    process.argv = originalArgv;
    for (const spy of spies) spy.mockRestore();
  }
  return run;
}

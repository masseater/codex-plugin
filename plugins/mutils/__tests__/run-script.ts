/**
 * モジュールのトップレベルで動く CLI スクリプトを、同じプロセスの中で実行して結果を集める。
 * サブプロセスで起動すると Vitest のカバレッジに数えられないため、import して実行する。
 */
import { vi } from "vite-plus/test";

export type ScriptResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

class ExitSignal extends Error {
  constructor(readonly code: number) {
    super(`process.exit(${code})`);
  }
}

function chunkText(chunk: unknown): string {
  return typeof chunk === "string" ? chunk : String(chunk);
}

/**
 * スクリプトを引数付きで実行し、stdout / stderr / 終了コードを返す。
 * `process.exit` は例外に置き換えて、実行したスクリプトがそこで止まるようにする。
 *
 * @param scriptPath - 実行するスクリプトの絶対パス
 * @param args - スクリプトに渡す引数
 * @returns 標準出力・標準エラー・終了コード（`process.exit` を呼ばずに終わったら 0）
 */
export async function runScript(scriptPath: string, args: string[] = []): Promise<ScriptResult> {
  let stdout = "";
  let stderr = "";
  const originalArgv = process.argv;
  process.argv = ["bun", scriptPath, ...args];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdout += chunkText(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderr += chunkText(chunk);
    return true;
  });
  vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => {
    stdout += `${parts.map(chunkText).join(" ")}\n`;
  });
  vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
    stderr += `${parts.map(chunkText).join(" ")}\n`;
  });
  vi.spyOn(process, "exit").mockImplementation((code?: string | number | null) => {
    throw new ExitSignal(Number(code ?? 0));
  });
  vi.resetModules();
  try {
    await import(/* @vite-ignore */ scriptPath);
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    // process.exit の置き換えが投げた例外だけを終了コードに変える。それ以外はスクリプトの本物の失敗なので投げ直す
    if (error instanceof ExitSignal) return { stdout, stderr, exitCode: error.code };
    throw error;
  } finally {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  }
}

import { globSync } from "node:fs";
import { vi } from "vite-plus/test";

type ScanOptions = { cwd: string };

// Bun.Glob の代わりに node:fs の glob で走査する（Vitest は Node 上で動き Bun が無いため）
class NodeGlob {
  constructor(private readonly pattern: string) {}

  scanSync({ cwd }: ScanOptions): string[] {
    return globSync(this.pattern, { cwd });
  }

  async *scan(options: ScanOptions): AsyncGenerator<string> {
    yield* this.scanSync(options);
  }
}

// Bun.spawn の戻り値の代わり。stdout に text を流し、exited は exitCode で解決する
function fakeProcess(text: string, exitCode: number) {
  return { stdout: new Blob([text]).stream(), exited: Promise.resolve(exitCode) };
}

// グローバルの Bun を差し替える。後始末は vi.unstubAllGlobals() で行う。
// spawn は Bun.spawn の代わりの関数で、省略すると常に失敗する
function stubBun(spawn: (args: string[]) => unknown = vi.fn(rgUnavailable)): void {
  vi.stubGlobal("Bun", { Glob: NodeGlob, spawn });
}

function rgUnavailable(): never {
  throw new Error("rg not installed");
}

export { fakeProcess, stubBun };

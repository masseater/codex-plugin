import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { PackageJsonSubset, ProjectContext } from "../core/types.ts";

// 一時ディレクトリにファイルを作る。files はプロジェクトルートからのパスと内容。一時ディレクトリの絶対パスを返す
function makeProject(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "standards-audit-vitest-"));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  return dir;
}

// rootDir と package.json から検査対象の context を作る
function makeCtx(rootDir: string, packageJson: PackageJsonSubset | null = {}): ProjectContext {
  return { rootDir, label: "(root)", types: [], packageJson };
}

export { makeCtx, makeProject };

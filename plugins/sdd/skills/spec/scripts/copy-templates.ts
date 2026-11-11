#!/usr/bin/env bun
// spec のテンプレートを spec ディレクトリにコピーする。既存ファイルは上書きしない。
//
// Usage: copy-templates.ts <specDir> [overview|specification|technical-details ...]
//   名前を省略すると overview だけをコピーする（init 時点では overview だけを作り、
//   specification / technical-details はそれぞれの段階でコピーする）。

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const TEMPLATE_NAMES = ["overview", "specification", "technical-details"] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export type CopyResult = {
  copied: string[];
  skipped: string[];
};

export function isTemplateName(value: string): value is TemplateName {
  return (TEMPLATE_NAMES as readonly string[]).includes(value);
}

export function copyTemplates(
  templatesDir: string,
  targetDir: string,
  names: readonly TemplateName[],
): CopyResult {
  mkdirSync(targetDir, { recursive: true });
  const result: CopyResult = { copied: [], skipped: [] };

  for (const name of names) {
    const source = join(templatesDir, `${name}-template.md`);
    const target = join(targetDir, `${name}.md`);
    if (!existsSync(source)) {
      throw new Error(`Template not found: ${source}`);
    }
    if (existsSync(target)) {
      result.skipped.push(`${name}.md`);
      continue;
    }
    copyFileSync(source, target);
    result.copied.push(`${name}.md`);
  }

  return result;
}

export function parseNames(args: readonly string[]): TemplateName[] {
  if (args.length === 0) {
    return ["overview"];
  }
  return args.map((arg) => {
    if (!isTemplateName(arg)) {
      throw new Error(`Unknown template: ${arg} (expected: ${TEMPLATE_NAMES.join(", ")})`);
    }
    return arg;
  });
}

/**
 * 第 1 引数をコピー先として使ってよいかを判定する。
 * `--help` のようなオプション風の引数をディレクトリ名として作らないよう、`-` で始まるものは拒否する。
 *
 * @param arg - コマンドラインの第 1 引数
 * @returns コピー先として使ってよいなら true
 */
export function isValidTargetDir(arg: string | undefined): arg is string {
  return arg !== undefined && arg !== "" && !arg.startsWith("-");
}

/* v8 ignore start */
if (import.meta.main) {
  const [targetDir, ...rest] = process.argv.slice(2);
  if (!isValidTargetDir(targetDir)) {
    process.stderr.write(
      "Usage: copy-templates.ts <specDir> [overview|specification|technical-details ...]\n",
    );
    process.exit(1);
  }
  try {
    const templatesDir = join(import.meta.dirname, "..", "assets", "templates");
    const result = copyTemplates(templatesDir, targetDir, parseNames(rest));
    process.stdout.write(`${JSON.stringify({ targetDir, ...result }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
/* v8 ignore stop */

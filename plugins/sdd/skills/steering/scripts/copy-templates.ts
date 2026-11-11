#!/usr/bin/env bun
/**
 * ステアリングドキュメントのテンプレートを指定ディレクトリにコピーするスクリプト
 *
 * Usage:
 *   bun run copy-templates.ts <targetDir>
 *
 * Example:
 *   bun run copy-templates.ts .claude/skills/steering
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(Bun.main);
const TEMPLATES_DIR = join(SCRIPT_DIR, "..", "templates");

function requireTargetDir(arg: string | undefined): string {
  // `--help` などのオプション風の引数をディレクトリ名として作らないよう、`-` で始まるものは拒否する
  if (!arg || arg.startsWith("-")) {
    console.error("Error: Target directory is required");
    console.error("Usage: bun run copy-templates.ts <targetDir>");
    console.error("");
    console.error("Example:");
    console.error("  bun run copy-templates.ts .claude/skills/steering");
    process.exit(1);
  }
  return arg;
}

function listTemplates(): string[] {
  const templateFiles = Array.from(new Bun.Glob("*-template.md").scanSync(TEMPLATES_DIR));
  if (templateFiles.length === 0) {
    console.error("Error: No template files found in:", TEMPLATES_DIR);
    process.exit(1);
  }
  return templateFiles;
}

function ensureTargetDir(targetDir: string): void {
  if (existsSync(targetDir)) return;
  mkdirSync(targetDir, { recursive: true });
  console.log(`Created directory: ${targetDir}`);
}

/**
 * テンプレートを 1 つコピーする。同名のファイルがあれば上書きしない
 * @param template - テンプレートのファイル名（例: product-template.md）
 * @param targetDir - コピー先のディレクトリ
 * @returns コピーしたら true
 */
async function copyTemplate(template: string, targetDir: string): Promise<boolean> {
  // product-template.md -> product.md
  const targetName = template.replace("-template", "");
  const targetPath = join(targetDir, targetName);
  if (await Bun.file(targetPath).exists()) {
    console.log(`Skipped (already exists): ${targetName}`);
    return false;
  }
  await Bun.write(targetPath, Bun.file(join(TEMPLATES_DIR, template)));
  console.log(`Copied: ${template} -> ${targetName}`);
  return true;
}

async function main() {
  const targetDir = requireTargetDir(Bun.argv[2]);
  const templateFiles = listTemplates();
  ensureTargetDir(targetDir);

  let copied = 0;
  for (const template of templateFiles) {
    if (await copyTemplate(template, targetDir)) copied++;
  }
  const skipped = templateFiles.length - copied;

  console.log("");
  console.log(`✅ Done: ${copied} copied, ${skipped} skipped`);
  console.log(`📍 Target: ${targetDir}`);
  console.log("");
  console.log("Edit these files to define your project's steering documents.");
}

await main();

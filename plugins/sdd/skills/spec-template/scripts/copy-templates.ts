#!/usr/bin/env bun
/**
 * 仕様書テンプレートを指定ディレクトリにコピーするスクリプト
 *
 * Usage:
 *   bun run copy-templates.ts <targetDir>
 *
 * Example:
 *   bun run copy-templates.ts specs/user-auth
 */

import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(Bun.main);
const TEMPLATES_DIR = join(SCRIPT_DIR, "..", "assets", "templates");

async function main() {
  const targetDir = Bun.argv[2];

  if (!targetDir) {
    console.error("Error: Target directory is required");
    console.error("Usage: bun run copy-templates.ts <targetDir>");
    console.error("");
    console.error("Example:");
    console.error("  bun run copy-templates.ts specs/user-auth");
    process.exit(1);
  }

  // テンプレートファイル一覧（phase-task は除外）
  const templateMap = [
    { source: "overview-template.md", target: "overview.md" },
    { source: "specification-template.md", target: "specification.md" },
    { source: "technical-details-template.md", target: "technical-details.md" },
  ];

  // ターゲットディレクトリの作成
  const keepFile = Bun.file(join(targetDir, ".keep"));
  if (!(await keepFile.exists())) {
    await Bun.write(keepFile, "");
    console.log(`Created directory: ${targetDir}`);
  }

  let copied = 0;
  let skipped = 0;

  for (const { source, target } of templateMap) {
    const sourcePath = join(TEMPLATES_DIR, source);
    const targetPath = join(targetDir, target);

    const sourceFile = Bun.file(sourcePath);
    if (!(await sourceFile.exists())) {
      console.error(`Warning: Template not found: ${source}`);
      continue;
    }

    const targetFile = Bun.file(targetPath);
    if (await targetFile.exists()) {
      console.log(`Skipped (already exists): ${target}`);
      skipped++;
      continue;
    }

    await Bun.write(targetPath, sourceFile);
    console.log(`Copied: ${source} -> ${target}`);
    copied++;
  }

  // .keep ファイルを削除（ディレクトリにファイルがあれば不要）
  if (copied > 0) {
    const keepFilePath = join(targetDir, ".keep");
    const kf = Bun.file(keepFilePath);
    if (await kf.exists()) {
      await Bun.write(kf, "");
    }
  }

  console.log("");
  console.log(`✅ Done: ${copied} copied, ${skipped} skipped`);
  console.log(`📍 Target: ${targetDir}`);
  console.log("");
  console.log("Edit these files to define your spec.");
}

main();

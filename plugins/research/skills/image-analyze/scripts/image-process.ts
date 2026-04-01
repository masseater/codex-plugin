#!/usr/bin/env bun
/**
 * ローカル画像処理ツール（API不要）
 * sharp + pixelmatch を使用したオフライン画像処理
 */

import { basename, dirname, extname, join } from "node:path";
import chalk from "chalk";
import { defineCommand, runMain } from "citty";
import pixelmatch from "pixelmatch";
import sharp from "sharp";

// ─── Utilities ───────────────────────────────

function defaultOutput(imagePath: string, suffix: string, ext = ".png"): string {
  const dir = dirname(imagePath);
  const name = basename(imagePath, extname(imagePath));
  return join(dir, `${name}_${suffix}${ext}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Subcommands ─────────────────────────────

const diffCommand = defineCommand({
  meta: {
    name: "diff",
    description: "2枚の画像のピクセル差分を検出",
  },
  args: {
    image1: {
      type: "string",
      description: "比較元画像",
      required: true,
    },
    image2: {
      type: "string",
      description: "比較先画像",
      required: true,
    },
    output: {
      type: "string",
      description: "差分画像の出力先",
    },
    threshold: {
      type: "string",
      description: "感度 (0-1、小さいほど厳密)",
      default: "0.1",
    },
  },
  async run({ args }) {
    const img1 = sharp(args.image1).ensureAlpha();
    const img2 = sharp(args.image2).ensureAlpha();

    const [meta1, meta2] = await Promise.all([img1.metadata(), img2.metadata()]);

    if (!meta1.width || !meta1.height || !meta2.width || !meta2.height) {
      console.error(chalk.red("Error: Could not read image dimensions"));
      process.exit(1);
    }

    if (meta1.width !== meta2.width || meta1.height !== meta2.height) {
      console.error(
        chalk.red(
          `Error: Images must be the same size. Got ${meta1.width}x${meta1.height} vs ${meta2.width}x${meta2.height}`,
        ),
      );
      process.exit(1);
    }

    const width = meta1.width;
    const height = meta1.height;

    const [buf1, buf2] = await Promise.all([img1.raw().toBuffer(), img2.raw().toBuffer()]);

    const diffBuf = new Uint8Array(width * height * 4);
    const threshold = Number.parseFloat(args.threshold);
    const mismatchCount = pixelmatch(
      new Uint8Array(buf1.buffer, buf1.byteOffset, buf1.byteLength),
      new Uint8Array(buf2.buffer, buf2.byteOffset, buf2.byteLength),
      diffBuf,
      width,
      height,
      { threshold },
    );

    const totalPixels = width * height;
    const matchRate = ((1 - mismatchCount / totalPixels) * 100).toFixed(2);

    const outputPath = args.output ?? defaultOutput(args.image1, "diff");
    await sharp(Buffer.from(diffBuf.buffer), {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toFile(outputPath);

    console.log(chalk.bold("Pixel Diff Result"));
    console.log(`  Match rate:  ${chalk.green(`${matchRate}%`)}`);
    console.log(`  Mismatch:    ${chalk.yellow(`${mismatchCount}`)} / ${totalPixels} pixels`);
    console.log(`  Threshold:   ${threshold}`);
    console.log(`  Output:      ${chalk.cyan(outputPath)}`);
  },
});

const edgeCommand = defineCommand({
  meta: {
    name: "edge",
    description: "エッジ抽出（Sobel フィルタ）",
  },
  args: {
    image: {
      type: "string",
      description: "入力画像",
      required: true,
    },
    output: {
      type: "string",
      description: "出力先",
    },
  },
  async run({ args }) {
    const img = sharp(args.image).grayscale();
    const meta = await img.metadata();

    if (!meta.width || !meta.height) {
      console.error(chalk.red("Error: Could not read image dimensions"));
      process.exit(1);
    }

    const width = meta.width;
    const height = meta.height;
    const buf = await img.raw().toBuffer();

    // Sobel kernels
    const gx = [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1],
    ];
    const gy = [
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1],
    ];

    const output = new Uint8Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sumX = 0;
        let sumY = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = buf[(y + ky) * width + (x + kx)] ?? 0;
            sumX += pixel * (gx[ky + 1]?.[kx + 1] ?? 0);
            sumY += pixel * (gy[ky + 1]?.[kx + 1] ?? 0);
          }
        }
        const magnitude = Math.min(255, Math.sqrt(sumX * sumX + sumY * sumY));
        output[y * width + x] = magnitude;
      }
    }

    const outputPath = args.output ?? defaultOutput(args.image, "edge");
    await sharp(Buffer.from(output.buffer), {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toFile(outputPath);

    console.log(chalk.bold("Edge Detection (Sobel)"));
    console.log(`  Input:   ${chalk.cyan(args.image)}`);
    console.log(`  Size:    ${width}x${height}`);
    console.log(`  Output:  ${chalk.cyan(outputPath)}`);
  },
});

const overlayCommand = defineCommand({
  meta: {
    name: "overlay",
    description: "2枚の画像を半透明で重ね合わせ",
  },
  args: {
    image1: {
      type: "string",
      description: "ベース画像",
      required: true,
    },
    image2: {
      type: "string",
      description: "オーバーレイ画像",
      required: true,
    },
    output: {
      type: "string",
      description: "出力先",
    },
    opacity: {
      type: "string",
      description: "image2 の不透明度 (0-1)",
      default: "0.5",
    },
  },
  async run({ args }) {
    const [meta1, meta2] = await Promise.all([
      sharp(args.image1).metadata(),
      sharp(args.image2).metadata(),
    ]);

    if (!meta1.width || !meta1.height || !meta2.width || !meta2.height) {
      console.error(chalk.red("Error: Could not read image dimensions"));
      process.exit(1);
    }

    // 小さい方に合わせる（拡大は品質劣化するため）
    const targetW = Math.min(meta1.width, meta2.width);
    const targetH = Math.min(meta1.height, meta2.height);

    const baseImg = sharp(args.image1).resize(targetW, targetH, { fit: "fill" }).ensureAlpha();

    const opacity = Number.parseFloat(args.opacity);

    // image2 をリサイズ + アルファ調整
    const overlayBuf = await sharp(args.image2)
      .resize(targetW, targetH, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer();

    // アルファチャンネルに opacity を適用
    for (let i = 3; i < overlayBuf.length; i += 4) {
      overlayBuf[i] = Math.round((overlayBuf[i] ?? 0) * opacity);
    }

    const outputPath = args.output ?? defaultOutput(args.image1, "overlay");

    await baseImg
      .composite([
        {
          input: Buffer.from(overlayBuf.buffer, overlayBuf.byteOffset, overlayBuf.byteLength),
          raw: { width: targetW, height: targetH, channels: 4 },
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toFile(outputPath);

    console.log(chalk.bold("Overlay Result"));
    console.log(`  Base:     ${chalk.cyan(args.image1)} (${meta1.width}x${meta1.height})`);
    console.log(`  Overlay:  ${chalk.cyan(args.image2)} (${meta2.width}x${meta2.height})`);
    console.log(`  Canvas:   ${targetW}x${targetH}`);
    console.log(`  Opacity:  ${opacity}`);
    console.log(`  Output:   ${chalk.cyan(outputPath)}`);
  },
});

const sideBySideCommand = defineCommand({
  meta: {
    name: "side-by-side",
    description: "2枚の画像を横並びで比較",
  },
  args: {
    image1: {
      type: "string",
      description: "左側画像",
      required: true,
    },
    image2: {
      type: "string",
      description: "右側画像",
      required: true,
    },
    output: {
      type: "string",
      description: "出力先",
    },
    gap: {
      type: "string",
      description: "画像間の余白 (px)",
      default: "4",
    },
  },
  async run({ args }) {
    const [meta1, meta2] = await Promise.all([
      sharp(args.image1).metadata(),
      sharp(args.image2).metadata(),
    ]);

    if (!meta1.width || !meta1.height || !meta2.width || !meta2.height) {
      console.error(chalk.red("Error: Could not read image dimensions"));
      process.exit(1);
    }

    const gap = Number.parseInt(args.gap, 10);
    // 高さを小さい方に揃える（拡大は品質劣化するため）
    const targetH = Math.min(meta1.height, meta2.height);

    const w1 = Math.round(meta1.width * (targetH / meta1.height));
    const w2 = Math.round(meta2.width * (targetH / meta2.height));
    const canvasW = w1 + gap + w2;

    const [buf1, buf2] = await Promise.all([
      sharp(args.image1).resize(w1, targetH, { fit: "fill" }).ensureAlpha().png().toBuffer(),
      sharp(args.image2).resize(w2, targetH, { fit: "fill" }).ensureAlpha().png().toBuffer(),
    ]);

    const outputPath = args.output ?? defaultOutput(args.image1, "sidebyside");

    await sharp({
      create: {
        width: canvasW,
        height: targetH,
        channels: 4,
        background: { r: 240, g: 240, b: 240, alpha: 1 },
      },
    })
      .composite([
        { input: buf1, top: 0, left: 0 },
        { input: buf2, top: 0, left: w1 + gap },
      ])
      .png()
      .toFile(outputPath);

    console.log(chalk.bold("Side-by-Side Comparison"));
    console.log(
      `  Left:    ${chalk.cyan(args.image1)} (${meta1.width}x${meta1.height} -> ${w1}x${targetH})`,
    );
    console.log(
      `  Right:   ${chalk.cyan(args.image2)} (${meta2.width}x${meta2.height} -> ${w2}x${targetH})`,
    );
    console.log(`  Canvas:  ${canvasW}x${targetH} (gap: ${gap}px)`);
    console.log(`  Output:  ${chalk.cyan(outputPath)}`);
  },
});

const infoCommand = defineCommand({
  meta: {
    name: "info",
    description: "画像メタデータを表示",
  },
  args: {
    image: {
      type: "string",
      description: "入力画像",
      required: true,
    },
  },
  async run({ args }) {
    const { stat } = await import("node:fs/promises");
    const meta = await sharp(args.image).metadata();
    const fileStats = await stat(args.image);

    console.log(chalk.bold("Image Info"));
    console.log(`  File:       ${chalk.cyan(args.image)}`);
    console.log(`  Size:       ${meta.width ?? "?"}x${meta.height ?? "?"} px`);
    console.log(`  Format:     ${meta.format ?? "unknown"}`);
    console.log(`  Channels:   ${meta.channels ?? "?"}`);
    console.log(`  Color space: ${meta.space ?? "unknown"}`);
    console.log(`  File size:  ${formatBytes(fileStats.size)}`);
    if (meta.density) {
      console.log(`  DPI:        ${meta.density}`);
    }
    console.log(`  Alpha:      ${meta.hasAlpha ? chalk.green("yes") : chalk.gray("no")}`);
    if (meta.pages && meta.pages > 1) {
      console.log(`  Pages:      ${meta.pages}`);
    }
  },
});

// ─── Main ────────────────────────────────────

const main = defineCommand({
  meta: {
    name: "image-process",
    description: "ローカル画像処理ツール（API不要）",
  },
  subCommands: {
    diff: diffCommand,
    edge: edgeCommand,
    overlay: overlayCommand,
    "side-by-side": sideBySideCommand,
    info: infoCommand,
  },
});

runMain(main);

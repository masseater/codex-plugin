#!/usr/bin/env bun
/**
 * ローカル画像処理ツール（API不要）
 * sharp + pixelmatch を使用したオフライン画像処理
 */

import { basename, dirname, extname, join } from "node:path";
import chalk from "chalk";
import { defineCommand, runMain } from "citty";
import pixelmatch from "pixelmatch";
import sharp, { type Metadata, type Sharp } from "sharp";

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

type Size = { width: number; height: number };

/**
 * 画像の幅と高さを読む。読めなければエラーを出して終了する
 * @param meta sharp のメタデータ
 * @returns 幅と高さ
 */
function requireSize(meta: Metadata): Size {
  if (!meta.width || !meta.height) {
    console.error(chalk.red("Error: Could not read image dimensions"));
    process.exit(1);
  }
  return { width: meta.width, height: meta.height };
}

async function requireSizes(image1: string, image2: string): Promise<[Size, Size]> {
  const [meta1, meta2] = await Promise.all([sharp(image1).metadata(), sharp(image2).metadata()]);
  return [requireSize(meta1), requireSize(meta2)];
}

function outputPathFor(output: string | undefined, imagePath: string, suffix: string): string {
  return output ?? defaultOutput(imagePath, suffix);
}

function requireSameSize(size1: Size, size2: Size): void {
  if (size1.width !== size2.width || size1.height !== size2.height) {
    console.error(
      chalk.red(
        `Error: Images must be the same size. Got ${size1.width}x${size1.height} vs ${size2.width}x${size2.height}`,
      ),
    );
    process.exit(1);
  }
}

/** Sobel フィルタの 3x3 カーネルのうち、重みのある 8 近傍（中心の重みは 0） */
const SOBEL_TAPS = [
  { dx: -1, dy: -1, gx: -1, gy: -1 },
  { dx: 0, dy: -1, gx: 0, gy: -2 },
  { dx: 1, dy: -1, gx: 1, gy: -1 },
  { dx: -1, dy: 0, gx: -2, gy: 0 },
  { dx: 1, dy: 0, gx: 2, gy: 0 },
  { dx: -1, dy: 1, gx: -1, gy: 1 },
  { dx: 0, dy: 1, gx: 0, gy: 2 },
  { dx: 1, dy: 1, gx: 1, gy: 1 },
];

function sobelAt(buf: Buffer, width: number, x: number, y: number): number {
  let sumX = 0;
  let sumY = 0;
  for (const tap of SOBEL_TAPS) {
    const pixel = buf[(y + tap.dy) * width + (x + tap.dx)] ?? 0;
    sumX += pixel * tap.gx;
    sumY += pixel * tap.gy;
  }
  return Math.min(255, Math.sqrt(sumX * sumX + sumY * sumY));
}

/**
 * グレースケール画像のエッジの強さを求める（端の 1 px は 0 のまま）
 * @param buf グレースケールの画素
 * @param size 画像の幅と高さ
 * @returns エッジの強さ（0-255）
 */
function sobel(buf: Buffer, size: Size): Uint8Array {
  const { width, height } = size;
  const output = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      output[y * width + x] = sobelAt(buf, width, x, y);
    }
  }
  return output;
}

// アルファチャンネルに opacity を適用する
function applyOpacity(buf: Buffer, opacity: number): void {
  for (let i = 3; i < buf.length; i += 4) {
    buf[i] = Math.round((buf[i] ?? 0) * opacity);
  }
}

function orText(value: string | number | undefined, fallback: string): string {
  return value === undefined ? fallback : String(value);
}

function optionalLine(label: string, value: number | undefined): string[] {
  return value ? [`  ${label}${value}`] : [];
}

function pagesLine(pages: number | undefined): string[] {
  return pages !== undefined && pages > 1 ? [`  Pages:      ${pages}`] : [];
}

function infoLines(image: string, meta: Metadata, fileSize: number): string[] {
  return [
    chalk.bold("Image Info"),
    `  File:       ${chalk.cyan(image)}`,
    `  Size:       ${orText(meta.width, "?")}x${orText(meta.height, "?")} px`,
    `  Format:     ${orText(meta.format, "unknown")}`,
    `  Channels:   ${orText(meta.channels, "?")}`,
    `  Color space: ${orText(meta.space, "unknown")}`,
    `  File size:  ${formatBytes(fileSize)}`,
    ...optionalLine("DPI:        ", meta.density),
    `  Alpha:      ${meta.hasAlpha ? chalk.green("yes") : chalk.gray("no")}`,
    ...pagesLine(meta.pages),
  ];
}

type Region = { left: number; top: number; width: number; height: number };

function parseRegion(args: { left: string; top: string; width: string; height: string }): Region {
  return {
    left: Number.parseInt(args.left, 10),
    top: Number.parseInt(args.top, 10),
    width: Number.parseInt(args.width, 10),
    height: Number.parseInt(args.height, 10),
  };
}

function isValidCrop(region: Region, scale: number): boolean {
  return Object.values(region).every((n) => !Number.isNaN(n) && n >= 0) && scale > 0;
}

function imageBounds(meta: Metadata): Size {
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}

function exceedsImage(region: Region, bounds: Size): boolean {
  return region.left + region.width > bounds.width || region.top + region.height > bounds.height;
}

function croppedImage(image: string, region: Region, scale: number): Sharp {
  const pipeline = sharp(image).extract(region);
  if (scale === 1) return pipeline;
  return pipeline.resize(Math.round(region.width * scale), Math.round(region.height * scale), {
    kernel: "nearest",
  });
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
    const size = requireSize(meta1);
    requireSameSize(size, requireSize(meta2));
    const { width, height } = size;

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

    const outputPath = outputPathFor(args.output, args.image1, "diff");
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
    const size = requireSize(await img.metadata());
    const { width, height } = size;
    const output = sobel(await img.raw().toBuffer(), size);

    const outputPath = outputPathFor(args.output, args.image, "edge");
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
    const [size1, size2] = await requireSizes(args.image1, args.image2);

    // 小さい方に合わせる（拡大は品質劣化するため）
    const targetW = Math.min(size1.width, size2.width);
    const targetH = Math.min(size1.height, size2.height);

    const baseImg = sharp(args.image1).resize(targetW, targetH, { fit: "fill" }).ensureAlpha();

    const opacity = Number.parseFloat(args.opacity);

    // image2 をリサイズ + アルファ調整
    const overlayBuf = await sharp(args.image2)
      .resize(targetW, targetH, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer();
    applyOpacity(overlayBuf, opacity);

    const outputPath = outputPathFor(args.output, args.image1, "overlay");

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
    console.log(`  Base:     ${chalk.cyan(args.image1)} (${size1.width}x${size1.height})`);
    console.log(`  Overlay:  ${chalk.cyan(args.image2)} (${size2.width}x${size2.height})`);
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
    const [meta1, meta2] = await requireSizes(args.image1, args.image2);

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

    const outputPath = outputPathFor(args.output, args.image1, "sidebyside");

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
    for (const line of infoLines(args.image, meta, fileStats.size)) {
      console.log(line);
    }
  },
});

const cropCommand = defineCommand({
  meta: {
    name: "crop",
    description: "画像の一部を切り出し、必要なら拡大する",
  },
  args: {
    image: {
      type: "string",
      description: "入力画像",
      required: true,
    },
    left: { type: "string", description: "切り出し領域の左端 (px)", required: true },
    top: { type: "string", description: "切り出し領域の上端 (px)", required: true },
    width: { type: "string", description: "切り出し領域の幅 (px)", required: true },
    height: { type: "string", description: "切り出し領域の高さ (px)", required: true },
    scale: {
      type: "string",
      description: "切り出し後の拡大倍率",
      default: "1",
    },
    output: {
      type: "string",
      description: "出力先",
    },
  },
  async run({ args }) {
    const region = parseRegion(args);
    const scale = Number.parseFloat(args.scale);
    if (!isValidCrop(region, scale)) {
      console.error(chalk.red("left/top/width/height は 0 以上の整数、scale は正の数で指定する"));
      process.exit(1);
    }

    const bounds = imageBounds(await sharp(args.image).metadata());
    if (exceedsImage(region, bounds)) {
      console.error(
        chalk.red(
          `切り出し領域が画像の範囲 (${bounds.width}x${bounds.height}) を超えている: ${region.left},${region.top} ${region.width}x${region.height}`,
        ),
      );
      process.exit(1);
    }

    const outputPath = outputPathFor(args.output, args.image, "crop");
    await croppedImage(args.image, region, scale).png().toFile(outputPath);

    console.log(chalk.bold("Crop"));
    console.log(
      `  Region:  ${region.left},${region.top} ${region.width}x${region.height} (scale x${scale})`,
    );
    console.log(`  Output:  ${chalk.cyan(outputPath)}`);
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
    crop: cropCommand,
  },
});

await runMain(main);

#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import {
  describeNode,
  numberField,
  recordArrayField,
  recordField,
  stringField,
  type JsonRecord,
} from "./_json.ts";
import { fetchNodeDocument, getToken, log, writeJsonOutput } from "./_lib.ts";

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return a < 1 ? `${hex}${toHex(a)}` : hex;
}

function channel(color: JsonRecord, key: string, fallback: number): number {
  return numberField(color, key) ?? fallback;
}

function formatColor(color: JsonRecord): string {
  return rgbaToHex(
    channel(color, "r", 0),
    channel(color, "g", 0),
    channel(color, "b", 0),
    channel(color, "a", 1),
  );
}

/**
 * 値が undefined でないキーだけを写す。
 * @param source 写し元
 * @param keys 写すキー（この順に並べる）
 * @returns 写したキーだけを持つオブジェクト
 */
function pickDefined(source: JsonRecord, keys: string[]): JsonRecord {
  return Object.fromEntries(
    keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]),
  );
}

/**
 * 値が truthy なキーだけを写す。
 * @param source 写し元
 * @param keys 写すキー（この順に並べる）
 * @returns 写したキーだけを持つオブジェクト
 */
function pickTruthy(source: JsonRecord, keys: string[]): JsonRecord {
  return Object.fromEntries(keys.filter((key) => source[key]).map((key) => [key, source[key]]));
}

function optionalProp(key: string, value: unknown): JsonRecord {
  return value ? { [key]: value } : {};
}

function colorProp(paint: JsonRecord): JsonRecord {
  const color = recordField(paint, "color");
  return color ? { color: formatColor(color) } : {};
}

/**
 * 表示されている塗り・線・効果を取り出す。
 * @param doc ノード
 * @param key fills / strokes / effects
 * @returns 表示されている項目。項目が無ければ null
 */
function visibleItems(doc: JsonRecord, key: string): JsonRecord[] | null {
  const items = recordArrayField(doc, key);
  if (!items || items.length === 0) return null;
  return items.filter((item) => item.visible !== false);
}

function fillProps(fill: JsonRecord): JsonRecord {
  return {
    type: fill.type,
    ...colorProp(fill),
    ...pickDefined(fill, ["opacity"]),
    ...pickTruthy(fill, ["gradientStops", "gradientHandlePositions", "scaleMode", "imageRef"]),
  };
}

function strokePaintProps(stroke: JsonRecord): JsonRecord {
  return { type: stroke.type, ...colorProp(stroke), ...pickDefined(stroke, ["opacity"]) };
}

function effectProps(effect: JsonRecord): JsonRecord {
  return {
    type: effect.type,
    ...pickDefined(effect, ["radius"]),
    ...colorProp(effect),
    ...pickTruthy(effect, ["offset"]),
    ...pickDefined(effect, ["spread"]),
  };
}

function extractFills(doc: JsonRecord): unknown[] | null {
  return visibleItems(doc, "fills")?.map(fillProps) ?? null;
}

function extractStrokes(doc: JsonRecord): unknown[] | null {
  return visibleItems(doc, "strokes")?.map(strokePaintProps) ?? null;
}

function extractEffects(doc: JsonRecord): unknown[] | null {
  return visibleItems(doc, "effects")?.map(effectProps) ?? null;
}

function extractTextStyle(doc: JsonRecord): JsonRecord | null {
  const style = recordField(doc, "style");
  if (!style) return null;
  return {
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: style.fontSize,
    lineHeightPx: style.lineHeightPx,
    lineHeightPercent: style.lineHeightPercent,
    lineHeightUnit: style.lineHeightUnit,
    letterSpacing: style.letterSpacing,
    textAlignHorizontal: style.textAlignHorizontal,
    textAlignVertical: style.textAlignVertical,
    textDecoration: style.textDecoration,
    textCase: style.textCase,
  };
}

function extractAutoLayout(doc: JsonRecord): JsonRecord | null {
  if (doc.layoutMode === undefined && doc.primaryAxisAlignItems === undefined) return null;
  return {
    layoutMode: doc.layoutMode,
    primaryAxisAlignItems: doc.primaryAxisAlignItems,
    counterAxisAlignItems: doc.counterAxisAlignItems,
    primaryAxisSizingMode: doc.primaryAxisSizingMode,
    counterAxisSizingMode: doc.counterAxisSizingMode,
    itemSpacing: doc.itemSpacing,
    paddingTop: doc.paddingTop,
    paddingRight: doc.paddingRight,
    paddingBottom: doc.paddingBottom,
    paddingLeft: doc.paddingLeft,
    layoutWrap: doc.layoutWrap,
    counterAxisSpacing: doc.counterAxisSpacing,
  };
}

function extractConstraints(doc: JsonRecord): JsonRecord | null {
  const constraints = recordField(doc, "constraints");
  if (!constraints) return null;
  return {
    horizontal: constraints.horizontal,
    vertical: constraints.vertical,
  };
}

// Geometry
function geometryProps(doc: JsonRecord): JsonRecord {
  const box = recordField(doc, "absoluteBoundingBox");
  return box
    ? { size: { width: box.width, height: box.height }, position: { x: box.x, y: box.y } }
    : {};
}

// Opacity & blend（既定値の 1 と PASS_THROUGH は省く）
function opacityProp(doc: JsonRecord): JsonRecord {
  return doc.opacity !== undefined && doc.opacity !== 1 ? { opacity: doc.opacity } : {};
}

function blendModeProp(doc: JsonRecord): JsonRecord {
  return doc.blendMode && doc.blendMode !== "PASS_THROUGH" ? { blendMode: doc.blendMode } : {};
}

function strokeProps(doc: JsonRecord): JsonRecord {
  const strokes = extractStrokes(doc);
  if (!strokes) return {};
  return {
    strokes,
    ...pickDefined(doc, ["strokeWeight"]),
    ...pickTruthy(doc, ["strokeAlign", "individualStrokeWeights"]),
  };
}

function extractProperties(doc: JsonRecord): JsonRecord {
  return {
    id: doc.id,
    name: doc.name,
    type: doc.type,
    ...geometryProps(doc),
    // Corner radius
    ...pickDefined(doc, ["cornerRadius"]),
    ...pickTruthy(doc, ["rectangleCornerRadii"]),
    ...opacityProp(doc),
    ...blendModeProp(doc),
    ...pickDefined(doc, ["clipsContent"]),
    // Visual properties
    ...optionalProp("fills", extractFills(doc)),
    ...strokeProps(doc),
    ...optionalProp("effects", extractEffects(doc)),
    // Text
    ...optionalProp("textStyle", extractTextStyle(doc)),
    ...pickDefined(doc, ["characters"]),
    // Layout
    ...optionalProp("autoLayout", extractAutoLayout(doc)),
    ...optionalProp("constraints", extractConstraints(doc)),
    ...pickTruthy(doc, ["layoutSizingHorizontal", "layoutSizingVertical"]),
    // Component info
    ...pickTruthy(doc, ["componentId", "componentProperties"]),
  };
}

/**
 * 子ノードを maxDepth まで再帰的に取り出す。それより深い子は数だけを書く。
 * @param doc ノード
 * @param depth 現在の深さ
 * @param maxDepth 取り出す最大の深さ
 * @returns children か childCount。子が無ければ空
 */
function childrenProps(doc: JsonRecord, depth: number, maxDepth: number): JsonRecord {
  const children = recordArrayField(doc, "children");
  if (!children || children.length === 0) return {};
  return depth < maxDepth
    ? { children: children.map((child) => extractTree(child, depth + 1, maxDepth)) }
    : { childCount: children.length };
}

function extractTree(doc: JsonRecord, depth: number, maxDepth: number): JsonRecord {
  return { ...extractProperties(doc), ...childrenProps(doc, depth, maxDepth) };
}

const main = defineCommand({
  meta: {
    name: "extract-node-properties",
    description: "Extract CSS-equivalent properties from a Figma node tree",
  },
  args: {
    "file-key": {
      type: "string",
      description: "Figma file key (from URL path)",
      required: true,
    },
    "node-id": {
      type: "string",
      description: "Node ID (colon or dash format)",
      required: true,
    },
    depth: {
      type: "string",
      description: "Max depth to traverse children (default: 3)",
      default: "3",
    },
    output: {
      type: "string",
      description: "Output JSON file path (optional, prints to stdout if omitted)",
      required: false,
    },
    verbose: {
      type: "boolean",
      description: "Enable debug logging to stderr",
      default: false,
    },
  },
  async run({ args }) {
    const token = getToken();
    const verbose = args.verbose;
    const maxDepth = Number.parseInt(args.depth, 10);

    log(verbose, `[DEBUG] Fetching node ${args["node-id"]} with geometry...`);

    const doc = await fetchNodeDocument(args["file-key"], args["node-id"], token, {
      geometry: "paths",
    });
    if (!doc) {
      throw new Error(`Node ${args["node-id"]} not found or resolved to null`);
    }

    log(verbose, `[DEBUG] Node: ${describeNode(doc)}, extracting to depth ${maxDepth}...`);

    await writeJsonOutput(args.output, JSON.stringify(extractTree(doc, 0, maxDepth), null, 2));
  },
});

await runMain(main);

#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import { getToken, log, toColon } from "./_lib.ts";

type FigmaNodeResponse = {
  name: string;
  nodes: Record<string, { document: Record<string, unknown> | null }>;
};

async function fetchNode(
  fileKey: string,
  nodeId: string,
  token: string,
): Promise<Record<string, unknown> | null> {
  const colonId = toColon(nodeId);
  const url = new URL(`https://api.figma.com/v1/files/${fileKey}/nodes`);
  url.searchParams.set("ids", nodeId);
  url.searchParams.set("geometry", "paths");

  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!res.ok) {
    throw new Error(`Figma API failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as FigmaNodeResponse;
  return data.nodes[colonId]?.document ?? null;
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return a < 1 ? `${hex}${toHex(a)}` : hex;
}

function formatColor(color: Record<string, unknown>): string {
  const r = (color.r as number) ?? 0;
  const g = (color.g as number) ?? 0;
  const b = (color.b as number) ?? 0;
  const a = (color.a as number) ?? 1;
  return rgbaToHex(r, g, b, a);
}

function extractFills(doc: Record<string, unknown>): unknown[] | null {
  const fills = doc.fills as Array<Record<string, unknown>> | undefined;
  if (!fills || fills.length === 0) return null;
  return fills
    .filter((f) => (f.visible as boolean) !== false)
    .map((f) => {
      const entry: Record<string, unknown> = { type: f.type };
      if (f.color) entry.color = formatColor(f.color as Record<string, unknown>);
      if (f.opacity !== undefined) entry.opacity = f.opacity;
      if (f.gradientStops) entry.gradientStops = f.gradientStops;
      if (f.gradientHandlePositions) entry.gradientHandlePositions = f.gradientHandlePositions;
      if (f.scaleMode) entry.scaleMode = f.scaleMode;
      if (f.imageRef) entry.imageRef = f.imageRef;
      return entry;
    });
}

function extractStrokes(doc: Record<string, unknown>): unknown[] | null {
  const strokes = doc.strokes as Array<Record<string, unknown>> | undefined;
  if (!strokes || strokes.length === 0) return null;
  return strokes
    .filter((s) => (s.visible as boolean) !== false)
    .map((s) => {
      const entry: Record<string, unknown> = { type: s.type };
      if (s.color) entry.color = formatColor(s.color as Record<string, unknown>);
      if (s.opacity !== undefined) entry.opacity = s.opacity;
      return entry;
    });
}

function extractEffects(doc: Record<string, unknown>): unknown[] | null {
  const effects = doc.effects as Array<Record<string, unknown>> | undefined;
  if (!effects || effects.length === 0) return null;
  return effects
    .filter((e) => (e.visible as boolean) !== false)
    .map((e) => {
      const entry: Record<string, unknown> = { type: e.type };
      if (e.radius !== undefined) entry.radius = e.radius;
      if (e.color) entry.color = formatColor(e.color as Record<string, unknown>);
      if (e.offset) entry.offset = e.offset;
      if (e.spread !== undefined) entry.spread = e.spread;
      return entry;
    });
}

function extractTextStyle(doc: Record<string, unknown>): Record<string, unknown> | null {
  const style = doc.style as Record<string, unknown> | undefined;
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

function extractAutoLayout(doc: Record<string, unknown>): Record<string, unknown> | null {
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

function extractConstraints(doc: Record<string, unknown>): Record<string, unknown> | null {
  const constraints = doc.constraints as Record<string, unknown> | undefined;
  if (!constraints) return null;
  return {
    horizontal: constraints.horizontal,
    vertical: constraints.vertical,
  };
}

function extractProperties(doc: Record<string, unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = {
    id: doc.id,
    name: doc.name,
    type: doc.type,
  };

  // Geometry
  const box = doc.absoluteBoundingBox as Record<string, unknown> | undefined;
  if (box) {
    props.size = { width: box.width, height: box.height };
    props.position = { x: box.x, y: box.y };
  }

  // Corner radius
  if (doc.cornerRadius !== undefined) props.cornerRadius = doc.cornerRadius;
  if (doc.rectangleCornerRadii) props.rectangleCornerRadii = doc.rectangleCornerRadii;

  // Opacity & blend
  if (doc.opacity !== undefined && doc.opacity !== 1) props.opacity = doc.opacity;
  if (doc.blendMode && doc.blendMode !== "PASS_THROUGH") props.blendMode = doc.blendMode;
  if (doc.clipsContent !== undefined) props.clipsContent = doc.clipsContent;

  // Visual properties
  const fills = extractFills(doc);
  if (fills) props.fills = fills;

  const strokes = extractStrokes(doc);
  if (strokes) {
    props.strokes = strokes;
    if (doc.strokeWeight !== undefined) props.strokeWeight = doc.strokeWeight;
    if (doc.strokeAlign) props.strokeAlign = doc.strokeAlign;
    if (doc.individualStrokeWeights) props.individualStrokeWeights = doc.individualStrokeWeights;
  }

  const effects = extractEffects(doc);
  if (effects) props.effects = effects;

  // Text
  const textStyle = extractTextStyle(doc);
  if (textStyle) props.textStyle = textStyle;
  if (doc.characters !== undefined) props.characters = doc.characters;

  // Layout
  const autoLayout = extractAutoLayout(doc);
  if (autoLayout) props.autoLayout = autoLayout;

  const constraints = extractConstraints(doc);
  if (constraints) props.constraints = constraints;

  if (doc.layoutSizingHorizontal) props.layoutSizingHorizontal = doc.layoutSizingHorizontal;
  if (doc.layoutSizingVertical) props.layoutSizingVertical = doc.layoutSizingVertical;

  // Component info
  if (doc.componentId) props.componentId = doc.componentId;
  if (doc.componentProperties) props.componentProperties = doc.componentProperties;

  return props;
}

function extractTree(
  doc: Record<string, unknown>,
  depth: number,
  maxDepth: number,
): Record<string, unknown> {
  const node = extractProperties(doc);

  const children = doc.children as Array<Record<string, unknown>> | undefined;
  if (children && children.length > 0 && depth < maxDepth) {
    node.children = children.map((child) => extractTree(child, depth + 1, maxDepth));
  } else if (children && children.length > 0) {
    node.childCount = children.length;
  }

  return node;
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
    const verbose = args.verbose as boolean;
    const maxDepth = Number.parseInt(args.depth as string, 10);

    log(verbose, `[DEBUG] Fetching node ${args["node-id"]} with geometry...`);

    const doc = await fetchNode(args["file-key"], args["node-id"], token);
    if (!doc) {
      throw new Error(`Node ${args["node-id"]} not found or resolved to null`);
    }

    log(verbose, `[DEBUG] Node: ${doc.name} (${doc.type}), extracting to depth ${maxDepth}...`);

    const result = extractTree(doc, 0, maxDepth);
    const json = JSON.stringify(result, null, 2);

    if (args.output) {
      await Bun.write(args.output, json);
      console.log(`output=${args.output}`);
    } else {
      console.log(json);
    }
  },
});

runMain(main);

#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import {
  describeNode,
  isRecord,
  recordArrayField,
  recordField,
  stringField,
  type JsonRecord,
} from "./_json.ts";
import { fetchNodeDocument, getToken, log, writeJsonOutput } from "./_lib.ts";

type VariantInfo = {
  id: string;
  name: string;
  properties: Record<string, string>;
};

function parseVariantName(name: string): Record<string, string> {
  const props: Record<string, string> = {};
  for (const part of name.split(",")) {
    const [key, value] = part.split("=").map((s) => s.trim());
    if (key && value !== undefined) {
      props[key] = value;
    }
  }
  return props;
}

function extractVariants(doc: JsonRecord): VariantInfo[] {
  const children = recordArrayField(doc, "children");
  if (!children) return [];

  return children.map((child) => {
    const name = stringField(child, "name") ?? "";
    return {
      id: stringField(child, "id") ?? "",
      name,
      properties: parseVariantName(name),
    };
  });
}

function extractComponentProperties(doc: JsonRecord): JsonRecord | null {
  const propDefs = recordField(doc, "componentPropertyDefinitions");
  if (!propDefs) return null;

  const result: JsonRecord = {};
  for (const [key, value] of Object.entries(propDefs)) {
    const def = isRecord(value) ? value : {};
    result[key] = {
      type: def.type,
      defaultValue: def.defaultValue,
      variantOptions: def.variantOptions,
      preferredValues: def.preferredValues,
    };
  }
  return result;
}

/**
 * バリアントごとのプロパティ値を、プロパティごとの取りうる値の一覧にまとめる。
 * @param variants バリアント
 * @returns プロパティ名から値の一覧（出現順）への対応
 */
function propertyMatrix(variants: VariantInfo[]): Record<string, string[]> {
  const propertyValues = new Map<string, Set<string>>();
  for (const [key, value] of variants.flatMap((variant) => Object.entries(variant.properties))) {
    propertyValues.set(key, (propertyValues.get(key) ?? new Set()).add(value));
  }
  return Object.fromEntries([...propertyValues].map(([key, values]) => [key, [...values]]));
}

type ComponentSummary = { fields: JsonRecord; debug: string };

function componentSetSummary(doc: JsonRecord): ComponentSummary {
  const variants = extractVariants(doc);
  const matrix = propertyMatrix(variants);
  return {
    fields: {
      propertyDefinitions: extractComponentProperties(doc),
      propertyMatrix: matrix,
      totalVariants: variants.length,
      variants,
    },
    debug: `[DEBUG] Found ${variants.length} variants, ${Object.keys(matrix).length} properties`,
  };
}

function componentSummary(doc: JsonRecord): ComponentSummary {
  return {
    fields: { propertyDefinitions: extractComponentProperties(doc), description: doc.description },
    debug: "[DEBUG] Single component (not a component set)",
  };
}

function otherNodeSummary(doc: JsonRecord): ComponentSummary {
  const propertyDefs = extractComponentProperties(doc);
  return {
    fields: {
      note: "This node is not a COMPONENT or COMPONENT_SET. Properties may be limited.",
      ...(propertyDefs ? { propertyDefinitions: propertyDefs } : {}),
    },
    debug: "",
  };
}

const SUMMARIZERS = new Map<string, (doc: JsonRecord) => ComponentSummary>([
  ["COMPONENT_SET", componentSetSummary],
  ["COMPONENT", componentSummary],
]);

function summarize(doc: JsonRecord, nodeType: string | undefined): ComponentSummary {
  return (SUMMARIZERS.get(nodeType ?? "") ?? otherNodeSummary)(doc);
}

const main = defineCommand({
  meta: {
    name: "get-component-variants",
    description: "List all variants and properties of a Figma component set",
  },
  args: {
    "file-key": {
      type: "string",
      description: "Figma file key (from URL path)",
      required: true,
    },
    "node-id": {
      type: "string",
      description: "Node ID of the component set or component (colon or dash format)",
      required: true,
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

    log(verbose, `[DEBUG] Fetching component node ${args["node-id"]}...`);

    const doc = await fetchNodeDocument(args["file-key"], args["node-id"], token);
    if (!doc) {
      throw new Error(`Node ${args["node-id"]} not found or resolved to null`);
    }

    const nodeType = stringField(doc, "type");
    log(verbose, `[DEBUG] Node: ${describeNode(doc)}`);

    const summary = summarize(doc, nodeType);
    if (summary.debug) log(verbose, summary.debug);

    const result: JsonRecord = { id: doc.id, name: doc.name, type: nodeType, ...summary.fields };
    await writeJsonOutput(args.output, JSON.stringify(result, null, 2));
  },
});

await runMain(main);

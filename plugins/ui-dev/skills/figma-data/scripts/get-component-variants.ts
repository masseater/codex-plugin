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

  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!res.ok) {
    throw new Error(`Figma API failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as FigmaNodeResponse;
  return data.nodes[colonId]?.document ?? null;
}

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

function extractVariants(doc: Record<string, unknown>): VariantInfo[] {
  const children = doc.children as Array<Record<string, unknown>> | undefined;
  if (!children) return [];

  return children.map((child) => ({
    id: child.id as string,
    name: child.name as string,
    properties: parseVariantName(child.name as string),
  }));
}

function extractComponentProperties(doc: Record<string, unknown>): Record<string, unknown> | null {
  const propDefs = doc.componentPropertyDefinitions as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!propDefs) return null;

  const result: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(propDefs)) {
    result[key] = {
      type: def.type,
      defaultValue: def.defaultValue,
      variantOptions: def.variantOptions,
      preferredValues: def.preferredValues,
    };
  }
  return result;
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
    const verbose = args.verbose as boolean;

    log(verbose, `[DEBUG] Fetching component node ${args["node-id"]}...`);

    const doc = await fetchNode(args["file-key"], args["node-id"], token);
    if (!doc) {
      throw new Error(`Node ${args["node-id"]} not found or resolved to null`);
    }

    const nodeType = doc.type as string;
    log(verbose, `[DEBUG] Node: ${doc.name} (${nodeType})`);

    const result: Record<string, unknown> = {
      id: doc.id,
      name: doc.name,
      type: nodeType,
    };

    if (nodeType === "COMPONENT_SET") {
      const variants = extractVariants(doc);
      const propertyDefs = extractComponentProperties(doc);

      // Collect all unique property keys and their possible values
      const propertyValues: Record<string, Set<string>> = {};
      for (const variant of variants) {
        for (const [key, value] of Object.entries(variant.properties)) {
          if (!propertyValues[key]) propertyValues[key] = new Set();
          propertyValues[key].add(value);
        }
      }

      result.propertyDefinitions = propertyDefs;
      result.propertyMatrix = Object.fromEntries(
        Object.entries(propertyValues).map(([k, v]) => [k, [...v]]),
      );
      result.totalVariants = variants.length;
      result.variants = variants;

      log(
        verbose,
        `[DEBUG] Found ${variants.length} variants, ${Object.keys(propertyValues).length} properties`,
      );
    } else if (nodeType === "COMPONENT") {
      const propertyDefs = extractComponentProperties(doc);
      result.propertyDefinitions = propertyDefs;
      result.description = doc.description;

      log(verbose, "[DEBUG] Single component (not a component set)");
    } else {
      result.note = "This node is not a COMPONENT or COMPONENT_SET. Properties may be limited.";
      const propertyDefs = extractComponentProperties(doc);
      if (propertyDefs) result.propertyDefinitions = propertyDefs;
    }

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

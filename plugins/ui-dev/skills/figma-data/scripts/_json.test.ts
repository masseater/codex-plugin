import { describe, expect, test } from "vite-plus/test";
import {
  imageUrls,
  isRecord,
  nodeDocument,
  numberField,
  readJsonRecord,
  recordArrayField,
  recordField,
  stringField,
} from "./_json.ts";

describe("isRecord", () => {
  test("accepts plain objects only", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });
});

describe("field readers", () => {
  const obj = { name: "n", count: 2, nested: { a: 1 }, list: [{ a: 1 }, 2, null], other: "x" };

  test("recordField returns nested objects", () => {
    expect(recordField(obj, "nested")).toStrictEqual({ a: 1 });
    expect(recordField(obj, "list")).toBeUndefined();
    expect(recordField(obj, "missing")).toBeUndefined();
  });

  test("recordArrayField keeps only object elements", () => {
    expect(recordArrayField(obj, "list")).toStrictEqual([{ a: 1 }]);
    expect(recordArrayField(obj, "nested")).toBeUndefined();
  });

  test("stringField and numberField check the value type", () => {
    expect(stringField(obj, "name")).toBe("n");
    expect(stringField(obj, "count")).toBeUndefined();
    expect(numberField(obj, "count")).toBe(2);
    expect(numberField(obj, "name")).toBeUndefined();
  });
});

describe("readJsonRecord", () => {
  test("returns the parsed object body", async () => {
    await expect(readJsonRecord(Response.json({ ok: true }))).resolves.toStrictEqual({ ok: true });
  });

  test("throws when the body is not an object", async () => {
    await expect(readJsonRecord(Response.json([1, 2]))).rejects.toThrow(
      "Figma API returned a non-object JSON body",
    );
  });
});

describe("nodeDocument", () => {
  test("returns the document of the requested node", () => {
    const data = { nodes: { "1:2": { document: { id: "1:2" } } } };
    expect(nodeDocument(data, "1:2")).toStrictEqual({ id: "1:2" });
  });

  test("returns null when the node or its document is missing", () => {
    expect(nodeDocument({ nodes: { "1:2": { document: null } } }, "1:2")).toBeNull();
    expect(nodeDocument({ nodes: {} }, "1:2")).toBeNull();
    expect(nodeDocument({}, "1:2")).toBeNull();
  });
});

describe("imageUrls", () => {
  test("maps node IDs to URLs and keeps unrendered nodes as null", () => {
    expect(
      imageUrls({ err: null, images: { "1:2": "https://x/a.png", "1:3": null } }),
    ).toStrictEqual({ "1:2": "https://x/a.png", "1:3": null });
    expect(imageUrls({})).toStrictEqual({});
  });

  test("throws the API error message", () => {
    expect(() => imageUrls({ err: "bad ids", images: {} })).toThrow(
      "Figma Images API error: bad ids",
    );
  });
});

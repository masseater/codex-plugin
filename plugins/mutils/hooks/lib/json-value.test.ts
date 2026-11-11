import { describe, expect, test } from "vite-plus/test";
import { asRecord, isRecord } from "./json-value.ts";

describe("isRecord", () => {
  test("accepts plain objects and rejects null, arrays and primitives", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([1])).toBe(false);
    expect(isRecord("text")).toBe(false);
  });
});

describe("asRecord", () => {
  test("returns objects as-is and replaces other values with an empty object", () => {
    const obj = { a: 1 };
    expect(asRecord(obj)).toBe(obj);
    expect(asRecord(undefined)).toStrictEqual({});
    expect(asRecord(["x"])).toStrictEqual({});
  });
});

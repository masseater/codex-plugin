import { describe, expect, test, vi } from "vitest";

/**
 * Test pure utility functions from _lib.ts.
 * We test toColon, toDash, and log directly.
 * getToken and downloadFile are skipped (env dependency / fetch + Bun.write).
 */

// Mock the env import so the module can load without FIGMA_ACCESS_TOKEN
vi.mock("../../../env.js", () => ({
  env: { FIGMA_ACCESS_TOKEN: undefined },
}));

describe("toColon", () => {
  test("replaces dashes with colons", async () => {
    const { toColon } = await import("./_lib.js");
    expect(toColon("123-456")).toBe("123:456");
  });

  test("replaces multiple dashes", async () => {
    const { toColon } = await import("./_lib.js");
    expect(toColon("1-2-3-4")).toBe("1:2:3:4");
  });

  test("returns unchanged string when no dashes", async () => {
    const { toColon } = await import("./_lib.js");
    expect(toColon("123:456")).toBe("123:456");
  });

  test("handles empty string", async () => {
    const { toColon } = await import("./_lib.js");
    expect(toColon("")).toBe("");
  });
});

describe("toDash", () => {
  test("replaces colons with dashes", async () => {
    const { toDash } = await import("./_lib.js");
    expect(toDash("123:456")).toBe("123-456");
  });

  test("replaces multiple colons", async () => {
    const { toDash } = await import("./_lib.js");
    expect(toDash("1:2:3:4")).toBe("1-2-3-4");
  });

  test("returns unchanged string when no colons", async () => {
    const { toDash } = await import("./_lib.js");
    expect(toDash("123-456")).toBe("123-456");
  });

  test("handles empty string", async () => {
    const { toDash } = await import("./_lib.js");
    expect(toDash("")).toBe("");
  });
});

describe("toColon and toDash are inverses", () => {
  test("toDash(toColon(id)) returns original when id uses dashes", async () => {
    const { toColon, toDash } = await import("./_lib.js");
    const original = "123-456-789";
    expect(toDash(toColon(original))).toBe(original);
  });

  test("toColon(toDash(id)) returns original when id uses colons", async () => {
    const { toColon, toDash } = await import("./_lib.js");
    const original = "123:456:789";
    expect(toColon(toDash(original))).toBe(original);
  });
});

describe("log", () => {
  test("writes to stderr when verbose is true", async () => {
    const { log } = await import("./_lib.js");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log(true, "test message");
    expect(spy).toHaveBeenCalledWith("test message");
    spy.mockRestore();
  });

  test("does not write when verbose is false", async () => {
    const { log } = await import("./_lib.js");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log(false, "test message");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("getToken", () => {
  test("throws when FIGMA_ACCESS_TOKEN is not set", async () => {
    const { getToken } = await import("./_lib.js");
    expect(() => getToken()).toThrow("FIGMA_ACCESS_TOKEN is not set");
  });
});

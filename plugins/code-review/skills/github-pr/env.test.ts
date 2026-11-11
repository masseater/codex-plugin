import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import * as v from "valibot";

/**
 * Test the EnvSchema validation logic from env.ts.
 * We test both the schema logic and the actual module import.
 */

const EnvSchema = v.object({
  GITHUB_TOKEN: v.pipe(v.string(), v.minLength(1)),
});

describe("EnvSchema validation", () => {
  test("accepts valid GITHUB_TOKEN", () => {
    const result = v.safeParse(EnvSchema, { GITHUB_TOKEN: "ghp_abc123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.GITHUB_TOKEN).toBe("ghp_abc123");
    }
  });

  test("rejects missing GITHUB_TOKEN", () => {
    const result = v.safeParse(EnvSchema, {});
    expect(result.success).toBe(false);
  });

  test("rejects empty string for GITHUB_TOKEN", () => {
    const result = v.safeParse(EnvSchema, { GITHUB_TOKEN: "" });
    expect(result.success).toBe(false);
  });

  test("rejects non-string GITHUB_TOKEN", () => {
    const result = v.safeParse(EnvSchema, { GITHUB_TOKEN: 123 });
    expect(result.success).toBe(false);
  });

  test("strips unknown keys", () => {
    const result = v.safeParse(EnvSchema, {
      GITHUB_TOKEN: "ghp_abc123",
      OTHER_VAR: "ignored",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).not.toHaveProperty("OTHER_VAR");
    }
  });
});

describe("env.ts module import", () => {
  const originalToken = process.env.GITHUB_TOKEN;

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.GITHUB_TOKEN = originalToken;
    } else {
      delete process.env.GITHUB_TOKEN;
    }
    vi.resetModules();
  });

  test("exports env with GITHUB_TOKEN when set", async () => {
    process.env.GITHUB_TOKEN = "ghp_test_token";
    vi.resetModules();
    const mod = await import("./env.js");
    expect(mod.env.GITHUB_TOKEN).toBe("ghp_test_token");
  });

  test("throws when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN;
    vi.resetModules();
    await expect(() => import("./env.js")).rejects.toThrow();
  });
});

import { describe, expect, test } from "vitest";
import * as v from "valibot";

/**
 * Test the EnvSchema validation logic from env.ts.
 * Since env.ts parses process.env at module load time, we recreate the schema here
 * to test validation behavior without side effects.
 */

const EnvSchema = v.object({
  GITHUB_TOKEN: v.optional(v.pipe(v.string(), v.minLength(1))),
  GOOGLE_API_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
  GEMINI_API_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
});

describe("EnvSchema validation", () => {
  test("accepts empty object (all fields optional)", () => {
    const result = v.safeParse(EnvSchema, {});
    expect(result.success).toBe(true);
  });

  test("accepts valid tokens", () => {
    const result = v.safeParse(EnvSchema, {
      GITHUB_TOKEN: "ghp_abc123",
      GOOGLE_API_KEY: "AIza_key",
      GEMINI_API_KEY: "gemini_key",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.GITHUB_TOKEN).toBe("ghp_abc123");
      expect(result.output.GOOGLE_API_KEY).toBe("AIza_key");
      expect(result.output.GEMINI_API_KEY).toBe("gemini_key");
    }
  });

  test("rejects empty string for GITHUB_TOKEN", () => {
    const result = v.safeParse(EnvSchema, { GITHUB_TOKEN: "" });
    expect(result.success).toBe(false);
  });

  test("rejects empty string for GOOGLE_API_KEY", () => {
    const result = v.safeParse(EnvSchema, { GOOGLE_API_KEY: "" });
    expect(result.success).toBe(false);
  });

  test("rejects empty string for GEMINI_API_KEY", () => {
    const result = v.safeParse(EnvSchema, { GEMINI_API_KEY: "" });
    expect(result.success).toBe(false);
  });

  test("allows partial tokens", () => {
    const result = v.safeParse(EnvSchema, { GITHUB_TOKEN: "tok" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.GITHUB_TOKEN).toBe("tok");
      expect(result.output.GOOGLE_API_KEY).toBeUndefined();
      expect(result.output.GEMINI_API_KEY).toBeUndefined();
    }
  });

  test("strips unknown keys", () => {
    const result = v.safeParse(EnvSchema, {
      GITHUB_TOKEN: "tok",
      UNKNOWN_KEY: "value",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).not.toHaveProperty("UNKNOWN_KEY");
    }
  });
});

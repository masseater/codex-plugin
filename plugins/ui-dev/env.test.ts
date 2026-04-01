import { describe, expect, test } from "vitest";
import * as v from "valibot";

/**
 * Test the EnvSchema validation logic from env.ts.
 * Since env.ts parses process.env at module load time, we recreate the schema here
 * to test validation behavior without side effects.
 */

const EnvSchema = v.object({
  FIGMA_ACCESS_TOKEN: v.optional(v.pipe(v.string(), v.minLength(1))),
});

describe("EnvSchema validation", () => {
  test("accepts empty object (FIGMA_ACCESS_TOKEN is optional)", () => {
    const result = v.safeParse(EnvSchema, {});
    expect(result.success).toBe(true);
  });

  test("accepts valid FIGMA_ACCESS_TOKEN", () => {
    const result = v.safeParse(EnvSchema, {
      FIGMA_ACCESS_TOKEN: "figd_abc123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.FIGMA_ACCESS_TOKEN).toBe("figd_abc123");
    }
  });

  test("rejects empty string for FIGMA_ACCESS_TOKEN", () => {
    const result = v.safeParse(EnvSchema, { FIGMA_ACCESS_TOKEN: "" });
    expect(result.success).toBe(false);
  });

  test("returns undefined for missing FIGMA_ACCESS_TOKEN", () => {
    const result = v.safeParse(EnvSchema, {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.FIGMA_ACCESS_TOKEN).toBeUndefined();
    }
  });

  test("strips unknown keys", () => {
    const result = v.safeParse(EnvSchema, {
      FIGMA_ACCESS_TOKEN: "token",
      OTHER_VAR: "ignored",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).not.toHaveProperty("OTHER_VAR");
    }
  });
});

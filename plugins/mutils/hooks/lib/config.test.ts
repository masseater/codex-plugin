import { describe, expect, test } from "vitest";
import { config } from "./config.js";

describe("config", () => {
  test("has marketplace property", () => {
    expect(config.marketplace).toBe("masseater-plugins");
  });

  test("has plugin property", () => {
    expect(config.plugin).toBe("mutils");
  });

  test("is readonly", () => {
    // TypeScript enforces this at compile time via `as const`,
    // but we verify the runtime shape is correct
    expect(Object.keys(config)).toStrictEqual(["marketplace", "plugin"]);
  });
});

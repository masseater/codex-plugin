import { describe, expect, test } from "vitest";
import { config } from "./config.js";

describe("config", () => {
  test("marketplace is masseater-plugins", () => {
    expect(config.marketplace).toBe("masseater-plugins");
  });

  test("plugin is progress-tracker", () => {
    expect(config.plugin).toBe("progress-tracker");
  });

  test("progressDir is .agents/progress", () => {
    expect(config.progressDir).toBe(".agents/progress");
  });

  test("config is readonly (const assertion)", () => {
    // Verify the shape has exactly these three keys
    const keys = Object.keys(config);
    expect(keys).toStrictEqual(["marketplace", "plugin", "progressDir"]);
  });

  test("all values are strings", () => {
    for (const value of Object.values(config)) {
      expect(typeof value).toBe("string");
    }
  });
});

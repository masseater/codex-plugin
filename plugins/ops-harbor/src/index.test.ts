import { describe, expect, test } from "vitest";
import { pluginId } from "./index.js";

describe("pluginId", () => {
  test("exports the ops harbor plugin identifier", () => {
    expect(pluginId).toBe("ops-harbor");
  });
});

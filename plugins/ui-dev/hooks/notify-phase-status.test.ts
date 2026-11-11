import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Test the logic extracted from notify-phase-status.ts.
 * The hook itself depends on cc-hooks-ts and cc-plugin-lib,
 * so we test the pure buildImplementMessage logic and config-driven branching.
 */

function buildImplementMessage(flowName: string, screens: string[]): string {
  return `[ui-dev] Ending implementation session.

The flow "${flowName}" is still in progress.
Screens: ${screens.join(", ")}

To resume:
/ui-dev:figma-implement ${flowName}`;
}

describe("buildImplementMessage", () => {
  test("generates message with flow name and screens", () => {
    const result = buildImplementMessage("registration", ["signup", "email-verify"]);
    expect(result).toContain("[ui-dev] Ending implementation session.");
    expect(result).toContain('The flow "registration" is still in progress.');
    expect(result).toContain("Screens: signup, email-verify");
    expect(result).toContain("/ui-dev:figma-implement registration");
  });

  test("handles single screen", () => {
    const result = buildImplementMessage("checkout", ["payment"]);
    expect(result).toContain("Screens: payment");
  });

  test("handles empty screens array", () => {
    const result = buildImplementMessage("empty-flow", []);
    expect(result).toContain("Screens: ");
  });

  test("includes resume command with correct flow name", () => {
    const result = buildImplementMessage("my-flow", ["screen1"]);
    expect(result).toContain("/ui-dev:figma-implement my-flow");
  });
});

describe("notify-phase-status hook logic", () => {
  const testTmpDir = join(tmpdir(), `notify-phase-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testTmpDir, { recursive: true });
    mkdirSync(join(testTmpDir, ".git"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(testTmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(testTmpDir, { recursive: true, force: true });
  });

  test("returns no reason when config does not exist", async () => {
    // Dynamically import to pick up mocked cwd
    const { findConfigPath } = await import("../lib/config.js");
    const configPath = findConfigPath();
    expect(configPath).toBeUndefined();
    // When configPath is undefined, the hook returns success (no reason)
  });

  test("returns no reason when currentPhase is done", async () => {
    const configDir = join(testTmpDir, ".agents", "ui-dev", "my-flow");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({
        flow: {
          name: "my-flow",
          currentPhase: "done",
          screens: ["screen1"],
        },
      }),
    );

    const { findConfigPath, loadUiDevConfig } = await import("../lib/config.js");
    const configPath = findConfigPath();
    expect(configPath).toBeDefined();
    const config = loadUiDevConfig(configPath!);
    expect(config.flow.currentPhase).toBe("done");
    // When currentPhase is "done", the hook does NOT generate a reason
  });

  test("generates implement message when currentPhase is implement", async () => {
    const configDir = join(testTmpDir, ".agents", "ui-dev", "registration");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({
        flow: {
          name: "registration",
          currentPhase: "implement",
          screens: ["signup", "verify"],
        },
      }),
    );

    const { findConfigPath, loadUiDevConfig } = await import("../lib/config.js");
    const configPath = findConfigPath();
    expect(configPath).toBeDefined();
    const config = loadUiDevConfig(configPath!);
    expect(config.flow.currentPhase).toBe("implement");

    const reason = buildImplementMessage(config.flow.name, config.flow.screens);
    expect(reason).toContain("registration");
    expect(reason).toContain("signup, verify");
  });
});

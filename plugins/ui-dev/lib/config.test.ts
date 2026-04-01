import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { findConfigPath, loadUiDevConfig } from "./config.js";

describe("loadUiDevConfig", () => {
  const testTmpDir = join(tmpdir(), `ui-dev-config-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testTmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testTmpDir, { recursive: true, force: true });
  });

  const validConfig = {
    flow: {
      name: "registration",
      currentPhase: "implement",
      screens: ["signup", "email-verify"],
    },
  };

  test("loads and validates a valid config", () => {
    const configPath = join(testTmpDir, "config.json");
    writeFileSync(configPath, JSON.stringify(validConfig));
    const result = loadUiDevConfig(configPath);
    expect(result.flow.name).toBe("registration");
    expect(result.flow.currentPhase).toBe("implement");
    expect(result.flow.screens).toStrictEqual(["signup", "email-verify"]);
  });

  test("loads config with optional figma field", () => {
    const config = {
      flow: {
        ...validConfig.flow,
        figma: {
          fileKey: "ABC123",
          prototypeChainPath: "/some/path.json",
        },
      },
    };
    const configPath = join(testTmpDir, "config.json");
    writeFileSync(configPath, JSON.stringify(config));
    const result = loadUiDevConfig(configPath);
    expect(result.flow.figma?.fileKey).toBe("ABC123");
    expect(result.flow.figma?.prototypeChainPath).toBe("/some/path.json");
  });

  test("loads config with optional contextFiles", () => {
    const config = {
      ...validConfig,
      contextFiles: [".agents/ui-dev/design-rules.md"],
    };
    const configPath = join(testTmpDir, "config.json");
    writeFileSync(configPath, JSON.stringify(config));
    const result = loadUiDevConfig(configPath);
    expect(result.contextFiles).toStrictEqual([".agents/ui-dev/design-rules.md"]);
  });

  test("loads config with optional reviewPrompts", () => {
    const config = {
      ...validConfig,
      reviewPrompts: {
        common: ["Check accessibility"],
        visual: ["Check color contrast"],
        code: ["Check TypeScript types"],
      },
    };
    const configPath = join(testTmpDir, "config.json");
    writeFileSync(configPath, JSON.stringify(config));
    const result = loadUiDevConfig(configPath);
    expect(result.reviewPrompts?.common).toStrictEqual(["Check accessibility"]);
    expect(result.reviewPrompts?.visual).toStrictEqual(["Check color contrast"]);
    expect(result.reviewPrompts?.code).toStrictEqual(["Check TypeScript types"]);
  });

  test("accepts 'done' as currentPhase", () => {
    const config = {
      flow: { ...validConfig.flow, currentPhase: "done" },
    };
    const configPath = join(testTmpDir, "config.json");
    writeFileSync(configPath, JSON.stringify(config));
    const result = loadUiDevConfig(configPath);
    expect(result.flow.currentPhase).toBe("done");
  });

  test("throws for invalid currentPhase", () => {
    const config = {
      flow: { ...validConfig.flow, currentPhase: "review" },
    };
    const configPath = join(testTmpDir, "config.json");
    writeFileSync(configPath, JSON.stringify(config));
    expect(() => loadUiDevConfig(configPath)).toThrow("Invalid config");
  });

  test("throws for missing flow.name", () => {
    const config = {
      flow: { currentPhase: "implement", screens: [] },
    };
    const configPath = join(testTmpDir, "config.json");
    writeFileSync(configPath, JSON.stringify(config));
    expect(() => loadUiDevConfig(configPath)).toThrow("Invalid config");
  });

  test("throws for missing flow.screens", () => {
    const config = {
      flow: { name: "test", currentPhase: "implement" },
    };
    const configPath = join(testTmpDir, "config.json");
    writeFileSync(configPath, JSON.stringify(config));
    expect(() => loadUiDevConfig(configPath)).toThrow("Invalid config");
  });

  test("throws for invalid JSON", () => {
    const configPath = join(testTmpDir, "config.json");
    writeFileSync(configPath, "not json");
    expect(() => loadUiDevConfig(configPath)).toThrow();
  });
});

describe("findConfigPath", () => {
  const testTmpDir = join(tmpdir(), `ui-dev-findconfig-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testTmpDir, { recursive: true });
    // Create a .git directory so findProjectRoot can detect the root
    mkdirSync(join(testTmpDir, ".git"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(testTmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(testTmpDir, { recursive: true, force: true });
  });

  test("returns undefined when .agents/ui-dev does not exist", () => {
    const result = findConfigPath();
    expect(result).toBeUndefined();
  });

  test("returns config path when flowName matches existing config", () => {
    const configDir = join(testTmpDir, ".agents", "ui-dev", "registration");
    mkdirSync(configDir, { recursive: true });
    const configPath = join(configDir, "config.json");
    writeFileSync(configPath, "{}");

    const result = findConfigPath("registration");
    expect(result).toBe(configPath);
  });

  test("returns undefined when flowName does not match any config", () => {
    const configDir = join(testTmpDir, ".agents", "ui-dev", "registration");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), "{}");

    const result = findConfigPath("nonexistent");
    expect(result).toBeUndefined();
  });

  test("finds first config.json when flowName is not specified", () => {
    const configDir = join(testTmpDir, ".agents", "ui-dev", "alpha-flow");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), "{}");

    const result = findConfigPath();
    expect(result).toBe(join(configDir, "config.json"));
  });

  test("returns undefined when ui-dev directory has no subdirectories with config", () => {
    const uiDevDir = join(testTmpDir, ".agents", "ui-dev");
    mkdirSync(uiDevDir, { recursive: true });
    // Create a subdirectory without config.json
    mkdirSync(join(uiDevDir, "empty-flow"));

    const result = findConfigPath();
    expect(result).toBeUndefined();
  });
});

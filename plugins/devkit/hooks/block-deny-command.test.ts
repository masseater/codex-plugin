import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { capturedHooks, hooksTsMock, makeContext, pluginLibMock } from "./__tests__/hook-mocks.ts";

vi.mock("@r_masseater/cc-plugin-lib", () => pluginLibMock());
vi.mock("cc-hooks-ts", () => hooksTsMock());

import { DENY_RULES, findViolation, formatDenyReason } from "./entry/block-deny-command.ts";

describe("findViolation", () => {
  it("matches npx commands", () => {
    const result = findViolation("npx create-vite my-app");
    expect(result?.name).toBe("npx");
  });

  it("matches npm commands", () => {
    const result = findViolation("npm install foo");
    expect(result?.name).toBe("npm");
  });

  it("matches tsc commands", () => {
    const result = findViolation("tsc --noEmit");
    expect(result?.name).toBe("tsc");
  });

  it("returns undefined when command does not match at the start", () => {
    expect(findViolation("npmx foo")).toBeUndefined();
  });

  it("returns undefined when command uses an unrelated runner prefix", () => {
    expect(findViolation("bun run tsc")).toBeUndefined();
  });

  it("returns undefined for safe commands", () => {
    expect(findViolation("pnpm install")).toBeUndefined();
  });

  it("returns the first matching rule when multiple rules could match", () => {
    const result = findViolation("npx tsc --noEmit");
    expect(result).toBe(DENY_RULES[0]);
    expect(result?.name).toBe("npx");
  });
});

describe("formatDenyReason", () => {
  it("states the reason and the alternative command", () => {
    const rule = findViolation("npm install foo");
    expect(rule).toBeDefined();
    const reason = formatDenyReason(rule!);
    expect(reason).toContain("npm");
    expect(reason).toContain("`pnpm`");
    expect(reason).toContain(rule!.why);
  });
});

const run = (command: string) => capturedHooks[0]!.run(makeContext({ tool_input: { command } }));

describe("hook run", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("DEVKIT_ENFORCE_TOOLS が未設定なら何も検査せず成功する", () => {
    vi.stubEnv("DEVKIT_ENFORCE_TOOLS", "");
    expect(run("npm install")).toEqual({ kind: "success", value: {} });
  });

  it("禁止コマンドでなければ成功する", () => {
    vi.stubEnv("DEVKIT_ENFORCE_TOOLS", "1");
    expect(run("pnpm install")).toEqual({ kind: "success", value: {} });
  });

  it("禁止コマンドなら deny と理由を返す", () => {
    vi.stubEnv("DEVKIT_ENFORCE_TOOLS", "1");
    expect(run("npx create-vite")).toMatchObject({
      kind: "json",
      value: {
        event: "PreToolUse",
        output: {
          hookSpecificOutput: {
            permissionDecision: "deny",
            permissionDecisionReason: formatDenyReason(DENY_RULES[0]!),
          },
        },
      },
    });
  });
});

import { describe, expect, test, vi } from "vitest";

const { mockDefineHook } = vi.hoisted(() => ({
  mockDefineHook: vi.fn((config: unknown) => config),
}));

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      warn: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
}));
vi.mock("cc-hooks-ts", () => ({
  defineHook: mockDefineHook,
  runHook: vi.fn(),
}));

import {
  SERVER_COMMAND,
  buildNotInstalledMessage,
  isServerInstalled,
} from "./entry/check-eslint-server.js";

describe("buildNotInstalledMessage", () => {
  test("warning message contains the server command name", () => {
    const message = buildNotInstalledMessage(SERVER_COMMAND);

    expect(message).toContain("vscode-eslint-language-server");
  });

  test("warning message contains npm install instruction", () => {
    const message = buildNotInstalledMessage(SERVER_COMMAND);

    expect(message).toContain("npm install -g vscode-eslint-language-server");
  });

  test("warning message starts with warning emoji", () => {
    const message = buildNotInstalledMessage(SERVER_COMMAND);

    expect(message.startsWith("\u26a0\ufe0f")).toBe(true);
  });

  test("warning message contains restart instruction", () => {
    const message = buildNotInstalledMessage(SERVER_COMMAND);

    expect(message).toContain("After installation, restart Claude Code.");
  });

  test("uses the provided command name in all relevant places", () => {
    const message = buildNotInstalledMessage("custom-server");

    expect(message).toContain("custom-server is required");
    expect(message).toContain("npm install -g custom-server");
  });
});

describe("SERVER_COMMAND", () => {
  test("is vscode-eslint-language-server", () => {
    expect(SERVER_COMMAND).toBe("vscode-eslint-language-server");
  });
});

describe("isServerInstalled", () => {
  test("returns true when exit code is 0", async () => {
    const originalBun = globalThis.Bun;
    globalThis.Bun = {
      ...originalBun,
      spawn: vi.fn().mockReturnValue({
        stdout: new ReadableStream(),
        stderr: new ReadableStream(),
        exited: Promise.resolve(0),
      }),
    };

    const result = await isServerInstalled();
    expect(result).toBe(true);

    globalThis.Bun = originalBun;
  });

  test("returns false when exit code is non-zero", async () => {
    const originalBun = globalThis.Bun;
    globalThis.Bun = {
      ...originalBun,
      spawn: vi.fn().mockReturnValue({
        stdout: new ReadableStream(),
        stderr: new ReadableStream(),
        exited: Promise.resolve(1),
      }),
    };

    const result = await isServerInstalled();
    expect(result).toBe(false);

    globalThis.Bun = originalBun;
  });
});

describe("hook run function", () => {
  test("returns success when server is installed", async () => {
    const originalBun = globalThis.Bun;
    globalThis.Bun = {
      ...originalBun,
      spawn: vi.fn().mockReturnValue({
        stdout: new ReadableStream(),
        stderr: new ReadableStream(),
        exited: Promise.resolve(0),
      }),
    };

    const hookConfig = mockDefineHook.mock.calls[0]?.[0] as {
      run: (ctx: unknown) => Promise<unknown>;
    };
    const successResult = { type: "success" };
    const mockContext = {
      success: vi.fn().mockReturnValue(successResult),
      json: vi.fn(),
    };

    const result = await hookConfig.run(mockContext);

    expect(mockContext.success).toHaveBeenCalledWith({});
    expect(result).toBe(successResult);

    globalThis.Bun = originalBun;
  });

  test("returns SessionStart JSON with warning when server is not installed", async () => {
    const originalBun = globalThis.Bun;
    globalThis.Bun = {
      ...originalBun,
      spawn: vi.fn().mockReturnValue({
        stdout: new ReadableStream(),
        stderr: new ReadableStream(),
        exited: Promise.resolve(1),
      }),
    };

    const hookConfig = mockDefineHook.mock.calls[0]?.[0] as {
      run: (ctx: unknown) => Promise<unknown>;
    };
    const jsonResult = { type: "json" };
    const mockContext = {
      success: vi.fn(),
      json: vi.fn().mockReturnValue(jsonResult),
    };

    const result = await hookConfig.run(mockContext);

    expect(mockContext.json).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "SessionStart",
        output: expect.objectContaining({
          hookSpecificOutput: expect.objectContaining({
            hookEventName: "SessionStart",
            additionalContext: expect.stringContaining(SERVER_COMMAND),
          }),
        }),
      }),
    );
    expect(result).toBe(jsonResult);

    globalThis.Bun = originalBun;
  });
});

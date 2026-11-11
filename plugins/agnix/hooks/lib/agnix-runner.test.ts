import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

const mockedExecFileSync = vi.mocked(execFileSync);

describe("isAgnixAvailable", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  test("returns true when agnix is found in PATH", async () => {
    mockedExecFileSync.mockReturnValueOnce("/usr/local/bin/agnix\n");
    const { isAgnixAvailable } = await import("./agnix-runner.js");

    const result = isAgnixAvailable();

    expect(result).toBe(true);
    expect(mockedExecFileSync).toHaveBeenCalledWith("which", ["agnix"], {
      stdio: "pipe",
    });
  });

  test("returns false when agnix is not found", async () => {
    mockedExecFileSync.mockImplementationOnce(() => {
      throw new Error("not found");
    });
    const { isAgnixAvailable } = await import("./agnix-runner.js");

    const result = isAgnixAvailable();

    expect(result).toBe(false);
  });
});

describe("runAgnix", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  const mockLogger = {
    debug: vi.fn(),
  };

  test("returns exitCode 0 and output on success", async () => {
    mockedExecFileSync.mockReturnValueOnce("no issues found");
    const { runAgnix } = await import("./agnix-runner.js");

    const result = runAgnix(["--target", "claude-code", "/tmp/CLAUDE.md"], mockLogger);

    expect(result).toStrictEqual({ exitCode: 0, output: "no issues found" });
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "agnix",
      ["--target", "claude-code", "/tmp/CLAUDE.md"],
      { stdio: "pipe", encoding: "utf-8", timeout: 30_000 },
    );
    expect(mockLogger.debug).toHaveBeenCalledWith("agnix exited with code 0");
  });

  test("returns exit code and combined stdout+stderr on failure", async () => {
    const error = Object.assign(new Error("agnix failed"), {
      status: 2,
      stdout: "line 1: warning",
      stderr: "line 2: error",
    });
    mockedExecFileSync.mockImplementationOnce(() => {
      throw error;
    });
    const { runAgnix } = await import("./agnix-runner.js");

    const result = runAgnix(["--target", "claude-code", "/tmp/AGENTS.md"], mockLogger);

    expect(result).toStrictEqual({
      exitCode: 2,
      output: "line 1: warning\nline 2: error",
    });
    expect(mockLogger.debug).toHaveBeenCalledWith("agnix exited with code 2");
  });

  test("defaults exit code to 1 when status is undefined", async () => {
    const error = Object.assign(new Error("agnix failed"), {
      stdout: "some output",
    });
    mockedExecFileSync.mockImplementationOnce(() => {
      throw error;
    });
    const { runAgnix } = await import("./agnix-runner.js");

    const result = runAgnix(["check"], mockLogger);

    expect(result.exitCode).toBe(1);
  });

  test("returns empty output when both stdout and stderr are falsy", async () => {
    const error = Object.assign(new Error("agnix failed"), {
      status: 1,
      stdout: "",
      stderr: "",
    });
    mockedExecFileSync.mockImplementationOnce(() => {
      throw error;
    });
    const { runAgnix } = await import("./agnix-runner.js");

    const result = runAgnix(["check"], mockLogger);

    expect(result.output).toBe("");
  });
});

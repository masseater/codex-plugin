import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

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

    const result = runAgnix(["--format", "json", "/tmp/CLAUDE.md"], mockLogger);

    expect(result).toStrictEqual({ exitCode: 0, stdout: "no issues found", stderr: "" });
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "agnix",
      ["--format", "json", "/tmp/CLAUDE.md"],
      { stdio: "pipe", encoding: "utf-8", timeout: 30_000 },
    );
    expect(mockLogger.debug).toHaveBeenCalledWith("agnix exited with code 0");
  });

  test("returns exit code with stdout and stderr separately on failure", async () => {
    const error = Object.assign(new Error("agnix failed"), {
      status: 2,
      stdout: "line 1: warning",
      stderr: "line 2: error",
    });
    mockedExecFileSync.mockImplementationOnce(() => {
      throw error;
    });
    const { runAgnix } = await import("./agnix-runner.js");

    const result = runAgnix(["--format", "json", "/tmp/AGENTS.md"], mockLogger);

    expect(result).toStrictEqual({
      exitCode: 2,
      stdout: "line 1: warning",
      stderr: "line 2: error",
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

  test("returns empty strings when stdout and stderr are missing", async () => {
    const error = Object.assign(new Error("agnix failed"), { status: 1 });
    mockedExecFileSync.mockImplementationOnce(() => {
      throw error;
    });
    const { runAgnix } = await import("./agnix-runner.js");

    const result = runAgnix(["check"], mockLogger);

    expect(result).toStrictEqual({ exitCode: 1, stdout: "", stderr: "" });
  });
});

describe("parseAgnixJson", () => {
  test("extracts diagnostics from agnix JSON output", async () => {
    const { parseAgnixJson } = await import("./agnix-runner.js");
    const stdout = JSON.stringify({
      diagnostics: [
        {
          level: "warning",
          rule: "XP-003",
          file: "AGENTS.md",
          line: 4,
          column: 79,
          message: "Hard-coded path",
          suggestion: "Use relative paths",
        },
      ],
      summary: { errors: 0, warnings: 1, info: 0 },
    });

    expect(parseAgnixJson(stdout)).toStrictEqual([
      {
        level: "warning",
        rule: "XP-003",
        line: 4,
        column: 79,
        message: "Hard-coded path",
        suggestion: "Use relative paths",
      },
    ]);
  });

  test("returns empty array when there are no diagnostics", async () => {
    const { parseAgnixJson } = await import("./agnix-runner.js");

    expect(parseAgnixJson(JSON.stringify({ diagnostics: [] }))).toStrictEqual([]);
  });

  test("returns null for non-JSON output", async () => {
    const { parseAgnixJson } = await import("./agnix-runner.js");

    expect(parseAgnixJson("Error: Validation root not found")).toBeNull();
  });

  test("returns null when diagnostics is missing", async () => {
    const { parseAgnixJson } = await import("./agnix-runner.js");

    expect(parseAgnixJson(JSON.stringify({ version: "0.56.5" }))).toBeNull();
  });
});

import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * Test get-ci-logs.ts by mocking deps and invoking the captured run().
 */

const mockListForRef = vi.fn();
const mockDownloadJobLogs = vi.fn();
const mockGetCurrentPRInfo = vi.fn();
const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();

vi.mock("../env.js", () => ({
  env: { GITHUB_TOKEN: "ghp_mock_token" },
}));

vi.mock("../lib/pr-info.js", () => ({
  getCurrentPRInfo: (...args: unknown[]) => mockGetCurrentPRInfo(...args),
}));

vi.mock("octokit", () => ({
  Octokit: vi.fn(() => ({
    rest: {
      checks: { listForRef: mockListForRef },
      actions: { downloadJobLogsForWorkflowRun: mockDownloadJobLogs },
    },
  })),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

let capturedCommand: {
  run: (ctx: { args: Record<string, string | boolean | undefined> }) => Promise<void>;
};

vi.mock("citty", () => ({
  defineCommand: vi.fn((config: typeof capturedCommand) => {
    capturedCommand = config;
    return config;
  }),
  runMain: vi.fn(),
}));

await import("./get-ci-logs.js");

describe("get-ci-logs run()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  test("downloads failed job logs", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "owner",
      repo: "repo",
      pr: 5,
      headSha: "sha123",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: "test-unit",
            status: "completed",
            conclusion: "failure",
            details_url: "https://github.com/o/r/actions/runs/111/job/222",
          },
          {
            name: "lint",
            status: "completed",
            conclusion: "success",
            details_url: "https://github.com/o/r/actions/runs/111/job/333",
          },
        ],
      },
    });
    mockDownloadJobLogs.mockResolvedValue({ data: "error log content" });

    await capturedCommand.run({ args: {} });

    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledOnce();
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.pr).toBe(5);
    expect(output.downloaded).toHaveLength(1);
    expect(output.downloaded[0].name).toBe("test-unit");
  });

  test("downloads all logs when --all flag is set", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 6,
      headSha: "sha",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: "test",
            status: "completed",
            conclusion: "success",
            details_url: "https://github.com/o/r/actions/runs/1/job/10",
          },
          {
            name: "lint",
            status: "completed",
            conclusion: "success",
            details_url: "https://github.com/o/r/actions/runs/1/job/11",
          },
        ],
      },
    });
    mockDownloadJobLogs.mockResolvedValue({ data: "log" });

    await capturedCommand.run({ args: { all: true } });

    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.downloaded).toHaveLength(2);
  });

  test("skips non-GitHub-Actions checks", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 7,
      headSha: "sha",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: "external-check",
            status: "completed",
            conclusion: "failure",
            details_url: "https://external-ci.com/check/1",
          },
        ],
      },
    });

    await capturedCommand.run({ args: {} });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.downloaded).toHaveLength(0);
    expect(output.skipped).toHaveLength(1);
    expect(output.skipped[0].reason).toBe("Not a GitHub Actions check");
  });

  test("skips checks with null details_url", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 8,
      headSha: "sha",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: "no-url",
            status: "completed",
            conclusion: "failure",
            details_url: null,
          },
        ],
      },
    });

    await capturedCommand.run({ args: {} });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.skipped[0].reason).toBe("Not a GitHub Actions check");
  });

  test("filters by name when --name is provided", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 9,
      headSha: "sha",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: "test-unit",
            status: "completed",
            conclusion: "failure",
            details_url: "https://github.com/o/r/actions/runs/1/job/10",
          },
          {
            name: "lint-check",
            status: "completed",
            conclusion: "failure",
            details_url: "https://github.com/o/r/actions/runs/1/job/11",
          },
        ],
      },
    });
    mockDownloadJobLogs.mockResolvedValue({ data: "log" });

    await capturedCommand.run({ args: { name: "test" } });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.downloaded).toHaveLength(1);
    expect(output.downloaded[0].name).toBe("test-unit");
  });

  test("handles download errors gracefully", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 10,
      headSha: "sha",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: "broken",
            status: "completed",
            conclusion: "failure",
            details_url: "https://github.com/o/r/actions/runs/1/job/99",
          },
        ],
      },
    });
    mockDownloadJobLogs.mockRejectedValue(new Error("API rate limit"));

    await capturedCommand.run({ args: {} });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.downloaded).toHaveLength(0);
    expect(output.skipped).toHaveLength(1);
    expect(output.skipped[0].reason).toBe("API rate limit");
  });

  test("uses custom output-dir when provided", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 11,
      headSha: "sha",
    });
    mockListForRef.mockResolvedValue({
      data: { check_runs: [] },
    });

    await capturedCommand.run({ args: { "output-dir": "/tmp/my-logs" } });

    expect(mockMkdir).toHaveBeenCalledWith("/tmp/my-logs", { recursive: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.outputDir).toBe("/tmp/my-logs");
  });

  test("skips in-progress checks", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 12,
      headSha: "sha",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: "running",
            status: "in_progress",
            conclusion: null,
            details_url: "https://github.com/o/r/actions/runs/1/job/50",
          },
        ],
      },
    });

    await capturedCommand.run({ args: {} });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.downloaded).toHaveLength(0);
    expect(output.skipped).toHaveLength(0);
  });
});

import { describe, expect, test, vi, beforeEach } from "vite-plus/test";

/**
 * Test get-ci-status.ts by mocking env, pr-info, Octokit, and citty.
 * We capture the command config from defineCommand to invoke run() directly.
 */

const mockListForRef = vi.fn();
const mockGetCurrentPRInfo = vi.fn();

vi.mock("../env.js", () => ({
  env: { GITHUB_TOKEN: "ghp_mock_token" },
}));

vi.mock("../lib/pr-info.js", () => ({
  getCurrentPRInfo: (...args: unknown[]) => mockGetCurrentPRInfo(...args),
}));

vi.mock("octokit", () => ({
  Octokit: vi.fn(function () {
    return {
      rest: {
        checks: { listForRef: mockListForRef },
      },
    };
  }),
}));

let capturedCommand: { run: (ctx: { args: Record<string, string | undefined> }) => Promise<void> };

vi.mock("citty", () => ({
  defineCommand: vi.fn((config: typeof capturedCommand) => {
    capturedCommand = config;
    return config;
  }),
  runMain: vi.fn(),
}));

// Import module to trigger defineCommand capture
await import("./get-ci-status.js");

describe("get-ci-status run()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  test("outputs CI status JSON for all checks", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "owner",
      repo: "repo",
      pr: 1,
      headSha: "abc123",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: "lint",
            status: "completed",
            conclusion: "success",
            details_url: "https://example.com",
          },
          {
            name: "test",
            status: "completed",
            conclusion: "failure",
            details_url: null,
          },
        ],
      },
    });

    await capturedCommand.run({ args: {} });

    expect(console.log).toHaveBeenCalledOnce();
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.overallStatus).toBe("failure");
    expect(output.checks).toHaveLength(2);
    expect(output.pr).toBe(1);
  });

  test("computes success when all checks pass", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 2,
      headSha: "sha",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [{ name: "a", status: "completed", conclusion: "success", details_url: null }],
      },
    });

    await capturedCommand.run({ args: {} });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.overallStatus).toBe("success");
  });

  test("computes pending when check is in progress", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 3,
      headSha: "sha",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [{ name: "a", status: "in_progress", conclusion: null, details_url: null }],
      },
    });

    await capturedCommand.run({ args: {} });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.overallStatus).toBe("pending");
  });

  test("computes neutral for skipped checks", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 4,
      headSha: "sha",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [{ name: "a", status: "completed", conclusion: "skipped", details_url: null }],
      },
    });

    await capturedCommand.run({ args: {} });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.overallStatus).toBe("neutral");
  });

  test("computes failure when a failed check comes after a pending one", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({ owner: "o", repo: "r", pr: 6, headSha: "sha" });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [
          { name: "slow", status: "in_progress", conclusion: null, details_url: null },
          { name: "lint", status: "completed", conclusion: "failure", details_url: null },
        ],
      },
    });

    await capturedCommand.run({ args: {} });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.overallStatus).toBe("failure");
  });

  test("computes failure for cancelled checks", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({ owner: "o", repo: "r", pr: 7, headSha: "sha" });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [
          { name: "a", status: "completed", conclusion: "success", details_url: null },
          { name: "b", status: "completed", conclusion: "cancelled", details_url: null },
        ],
      },
    });

    await capturedCommand.run({ args: {} });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.overallStatus).toBe("failure");
  });

  test("requests up to 100 check runs per page", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({ owner: "o", repo: "r", pr: 8, headSha: "sha" });
    mockListForRef.mockResolvedValue({ data: { check_runs: [] } });

    await capturedCommand.run({ args: {} });

    expect(mockListForRef).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      ref: "sha",
      per_page: 100,
    });
  });

  test("filters checks by name when name arg provided", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 5,
      headSha: "sha",
    });
    mockListForRef.mockResolvedValue({
      data: {
        check_runs: [
          { name: "lint-check", status: "completed", conclusion: "success", details_url: null },
          { name: "test-unit", status: "completed", conclusion: "failure", details_url: null },
        ],
      },
    });

    await capturedCommand.run({ args: { name: "lint" } });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.checks).toHaveLength(1);
    expect(output.checks[0].name).toBe("lint-check");
  });
});

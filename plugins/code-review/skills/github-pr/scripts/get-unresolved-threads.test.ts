import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * Test get-unresolved-threads.ts by mocking deps and invoking the captured run().
 */

const mockGraphql = vi.fn();
const mockGetCurrentPRInfo = vi.fn();

vi.mock("../env.js", () => ({
  env: { GITHUB_TOKEN: "ghp_mock_token" },
}));

vi.mock("../lib/pr-info.js", () => ({
  getCurrentPRInfo: (...args: unknown[]) => mockGetCurrentPRInfo(...args),
}));

vi.mock("octokit", () => ({
  Octokit: vi.fn(() => ({
    graphql: mockGraphql,
  })),
}));

let capturedCommand: { run: (ctx: { args: Record<string, string | undefined> }) => Promise<void> };

vi.mock("citty", () => ({
  defineCommand: vi.fn((config: typeof capturedCommand) => {
    capturedCommand = config;
    return config;
  }),
  runMain: vi.fn(),
}));

await import("./get-unresolved-threads.js");

describe("get-unresolved-threads run()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  test("returns unresolved and not-outdated thread IDs", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "owner",
      repo: "repo",
      pr: 10,
      headSha: "sha",
    });
    mockGraphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              { id: "PRRT_1", isResolved: false, isOutdated: false },
              { id: "PRRT_2", isResolved: true, isOutdated: false },
              { id: "PRRT_3", isResolved: false, isOutdated: true },
              { id: "PRRT_4", isResolved: false, isOutdated: false },
            ],
          },
        },
      },
    });

    await capturedCommand.run({ args: {} });

    expect(console.log).toHaveBeenCalledOnce();
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.owner).toBe("owner");
    expect(output.repo).toBe("repo");
    expect(output.pr).toBe(10);
    expect(output.threadIds).toEqual(["PRRT_1", "PRRT_4"]);
  });

  test("returns empty threadIds when all resolved", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 1,
      headSha: "sha",
    });
    mockGraphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [{ id: "PRRT_1", isResolved: true, isOutdated: false }],
          },
        },
      },
    });

    await capturedCommand.run({ args: {} });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.threadIds).toEqual([]);
  });

  test("returns empty threadIds when no threads exist", async () => {
    mockGetCurrentPRInfo.mockResolvedValue({
      owner: "o",
      repo: "r",
      pr: 2,
      headSha: "sha",
    });
    mockGraphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: { nodes: [] },
        },
      },
    });

    await capturedCommand.run({ args: {} });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.threadIds).toEqual([]);
  });
});

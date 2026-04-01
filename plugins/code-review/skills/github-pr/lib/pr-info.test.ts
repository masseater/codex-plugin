import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * Test getCurrentPRInfo from pr-info.ts by mocking env, simpleGit, and Octokit.
 */

const mockGetRemotes = vi.fn();
const mockRevparse = vi.fn();
const mockPullsList = vi.fn();

vi.mock("../env.js", () => ({
  env: { GITHUB_TOKEN: "ghp_mock_token" },
}));

vi.mock("simple-git", () => ({
  simpleGit: () => ({
    getRemotes: mockGetRemotes,
    revparse: mockRevparse,
  }),
}));

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      pulls: { list: mockPullsList },
    },
  })),
}));

import { getCurrentPRInfo } from "./pr-info.js";

function setupMocks(options: {
  remotes?: Array<{ name: string; refs: { fetch?: string } }>;
  branch?: string;
  prs?: Array<{ number: number; head: { sha: string } }>;
}) {
  mockGetRemotes.mockResolvedValue(options.remotes ?? []);
  mockRevparse.mockResolvedValue(options.branch ?? "main");
  mockPullsList.mockResolvedValue({ data: options.prs ?? [] });
}

describe("getCurrentPRInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns PR info for valid setup", async () => {
    setupMocks({
      remotes: [{ name: "origin", refs: { fetch: "https://github.com/owner/repo.git" } }],
      branch: "feature-branch",
      prs: [{ number: 42, head: { sha: "abc123" } }],
    });

    const result = await getCurrentPRInfo();
    expect(result).toEqual({
      owner: "owner",
      repo: "repo",
      pr: 42,
      headSha: "abc123",
    });
  });

  test("throws when no origin remote found", async () => {
    setupMocks({ remotes: [] });
    await expect(getCurrentPRInfo()).rejects.toThrow("No origin remote found");
  });

  test("throws when origin has no fetch URL", async () => {
    setupMocks({
      remotes: [{ name: "origin", refs: {} }],
    });
    await expect(getCurrentPRInfo()).rejects.toThrow("No origin remote found");
  });

  test("throws when URL is not a GitHub URL", async () => {
    setupMocks({
      remotes: [{ name: "origin", refs: { fetch: "https://gitlab.com/owner/repo.git" } }],
    });
    await expect(getCurrentPRInfo()).rejects.toThrow("Could not parse GitHub URL from origin");
  });

  test("throws when no open PR found", async () => {
    setupMocks({
      remotes: [{ name: "origin", refs: { fetch: "https://github.com/owner/repo.git" } }],
      branch: "feature",
      prs: [],
    });
    await expect(getCurrentPRInfo()).rejects.toThrow("No open PR found for branch: feature");
  });

  test("strips .git suffix from repo name", async () => {
    setupMocks({
      remotes: [{ name: "origin", refs: { fetch: "git@github.com:org/my-repo.git" } }],
      branch: "main",
      prs: [{ number: 1, head: { sha: "sha1" } }],
    });

    const result = await getCurrentPRInfo();
    expect(result.repo).toBe("my-repo");
  });

  test("uses first PR when multiple are returned", async () => {
    setupMocks({
      remotes: [{ name: "origin", refs: { fetch: "https://github.com/o/r.git" } }],
      branch: "feat",
      prs: [
        { number: 10, head: { sha: "first" } },
        { number: 20, head: { sha: "second" } },
      ],
    });

    const result = await getCurrentPRInfo();
    expect(result.pr).toBe(10);
    expect(result.headSha).toBe("first");
  });
});

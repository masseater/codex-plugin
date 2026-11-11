import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

const mockGetRemotes = vi.fn();

// bare な issue 番号は origin remote と組み合わせて解決するため、git の remote だけを差し替える
vi.mock("simple-git", () => ({
  simpleGit: () => ({ getRemotes: mockGetRemotes }),
}));

import { parseIssueRef } from "./issue-ref.ts";

beforeEach(() => {
  mockGetRemotes.mockReset();
  mockGetRemotes.mockResolvedValue([
    { name: "origin", refs: { fetch: "git@github.com:origin-owner/origin-repo.git" } },
  ]);
});

describe("parseIssueRef with an issue URL", () => {
  test("parses a standard issue URL", async () => {
    await expect(
      parseIssueRef("https://github.com/masseater/codex-plugin/issues/42"),
    ).resolves.toEqual({
      owner: "masseater",
      repo: "claude-code-plugin",
      issueNumber: 42,
    });
    expect(mockGetRemotes).not.toHaveBeenCalled();
  });

  test("ignores surrounding whitespace and trailing path", async () => {
    await expect(
      parseIssueRef("  https://github.com/o/r/issues/7#issuecomment-1  "),
    ).resolves.toEqual({
      owner: "o",
      repo: "r",
      issueNumber: 7,
    });
  });

  test("rejects a pull request URL", async () => {
    await expect(parseIssueRef("https://github.com/o/r/pull/9")).rejects.toThrow(
      "Could not parse issue reference",
    );
  });
});

describe("parseIssueRef with a bare issue number", () => {
  test("parses a bare number against the origin remote", async () => {
    await expect(parseIssueRef("42")).resolves.toEqual({
      owner: "origin-owner",
      repo: "origin-repo",
      issueNumber: 42,
    });
  });

  test("parses a hash-prefixed number", async () => {
    await expect(parseIssueRef("#42")).resolves.toMatchObject({ issueNumber: 42 });
  });

  test("rejects non-numeric input", async () => {
    await expect(parseIssueRef("abc")).rejects.toThrow("Could not parse issue reference");
  });

  test("rejects when there is no origin remote", async () => {
    mockGetRemotes.mockResolvedValue([]);
    await expect(parseIssueRef("42")).rejects.toThrow("No origin remote found");
  });
});

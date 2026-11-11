import { describe, expect, test } from "bun:test";
import { parseIssueNumber, parseIssueUrl, parseOriginRemote } from "./repo-info.ts";

describe("parseIssueUrl", () => {
  test("parses a standard issue URL", () => {
    expect(parseIssueUrl("https://github.com/masseater/codex-plugin/issues/42")).toEqual({
      owner: "masseater",
      repo: "claude-code-plugin",
      issueNumber: 42,
    });
  });

  test("ignores surrounding whitespace and trailing path", () => {
    expect(parseIssueUrl("  https://github.com/o/r/issues/7#issuecomment-1  ")).toEqual({
      owner: "o",
      repo: "r",
      issueNumber: 7,
    });
  });

  test("returns null for a pull request URL", () => {
    expect(parseIssueUrl("https://github.com/o/r/pull/9")).toBeNull();
  });

  test("returns null for a bare number", () => {
    expect(parseIssueUrl("42")).toBeNull();
  });
});

describe("parseIssueNumber", () => {
  test("parses a bare number", () => {
    expect(parseIssueNumber("42")).toBe(42);
  });

  test("parses a hash-prefixed number", () => {
    expect(parseIssueNumber("#42")).toBe(42);
  });

  test("returns null for a URL", () => {
    expect(parseIssueNumber("https://github.com/o/r/issues/42")).toBeNull();
  });

  test("returns null for non-numeric input", () => {
    expect(parseIssueNumber("abc")).toBeNull();
  });
});

describe("parseOriginRemote", () => {
  test("parses an https remote", () => {
    expect(parseOriginRemote("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  test("parses an ssh remote", () => {
    expect(parseOriginRemote("git@github.com:org/my-repo.git")).toEqual({
      owner: "org",
      repo: "my-repo",
    });
  });

  test("parses a remote without the .git suffix", () => {
    expect(parseOriginRemote("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  test("returns null for a non-GitHub remote", () => {
    expect(parseOriginRemote("https://gitlab.com/owner/repo.git")).toBeNull();
  });
});

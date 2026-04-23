import { describe, expect, it, afterEach, beforeEach } from "vitest";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dbPathFor, parseRemoteUrl } from "./repo.ts";

describe("parseRemoteUrl", () => {
  it("parses https URL", () => {
    expect(parseRemoteUrl("https://github.com/masseater/codex-plugin.git")).toEqual({
      host: "github.com",
      owner: "masseater",
      repo: "claude-code-plugin",
    });
  });
  it("parses https URL without .git", () => {
    expect(parseRemoteUrl("https://github.com/masseater/codex-plugin")).toEqual({
      host: "github.com",
      owner: "masseater",
      repo: "claude-code-plugin",
    });
  });
  it("parses git@ SSH URL", () => {
    expect(parseRemoteUrl("git@github.com:masseater/codex-plugin.git")).toEqual({
      host: "github.com",
      owner: "masseater",
      repo: "claude-code-plugin",
    });
  });
  it("parses ssh:// URL with port", () => {
    expect(parseRemoteUrl("ssh://git@ghe.example.com:2222/team/repo.git")).toEqual({
      host: "ghe.example.com",
      owner: "team",
      repo: "repo",
    });
  });
  it("parses GitHub Enterprise host", () => {
    expect(parseRemoteUrl("https://ghe.example.com/team/repo.git")).toEqual({
      host: "ghe.example.com",
      owner: "team",
      repo: "repo",
    });
  });
  it("rejects unrecognized URL", () => {
    expect(parseRemoteUrl("not-a-url")).toBeNull();
  });
  it("rejects URLs with invalid owner characters", () => {
    expect(parseRemoteUrl("https://github.com/../etc/passwd")).toBeNull();
  });
});

describe("dbPathFor", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), "ghidb-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns path inside cache dir for github.com", () => {
    const p = dbPathFor({ host: "github.com", owner: "masseater", repo: "cc" }, tmp);
    expect(p).toBe(path.resolve(tmp, ".agents/cache/issues/masseater-cc.sqlite"));
  });

  it("prefixes host for non-github.com", () => {
    const p = dbPathFor({ host: "ghe.example.com", owner: "team", repo: "repo" }, tmp);
    expect(p).toBe(path.resolve(tmp, ".agents/cache/issues/ghe.example.com__team-repo.sqlite"));
  });

  it("rejects owner containing path traversal characters", () => {
    expect(() =>
      dbPathFor({ host: "github.com", owner: "../../../etc", repo: "passwd" }, tmp),
    ).toThrow(/invalid owner\/repo/);
  });

  it("rejects slash in owner", () => {
    expect(() => dbPathFor({ host: "github.com", owner: "foo/bar", repo: "r" }, tmp)).toThrow(
      /invalid owner\/repo/,
    );
  });

  it("rejects empty owner", () => {
    expect(() => dbPathFor({ host: "github.com", owner: "", repo: "r" }, tmp)).toThrow(
      /invalid owner\/repo/,
    );
  });
});

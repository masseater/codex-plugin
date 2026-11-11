import { describe, expect, it, afterEach, beforeEach, vi } from "vite-plus/test";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseRemoteUrl } from "./remote-url.ts";
import { dbPathFor, resolveRepoFromGit } from "./repo.ts";

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

describe("dbPathFor（host の無害化）", () => {
  it("host の記号を _ に置き換える", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "ghidb-"));
    try {
      const p = dbPathFor({ host: "ghe example.com:8080", owner: "t", repo: "r" }, tmp);
      expect(path.basename(p)).toBe("ghe_example.com_8080__t-r.sqlite");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

const output = (exitCode: number, stdout: string, stderr = "") => ({
  exitCode,
  stdout: new TextEncoder().encode(stdout),
  stderr: new TextEncoder().encode(stderr),
});

describe("resolveRepoFromGit", () => {
  const spawnSync = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("Bun", { spawnSync });
    vi.stubEnv("GITHUB_HOST", "");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    spawnSync.mockReset();
  });

  it("origin の URL から owner / repo / host を解決する", () => {
    spawnSync.mockReturnValue(output(0, "git@github.com:masseater/cc.git\n"));
    expect(resolveRepoFromGit()).toEqual({ host: "github.com", owner: "masseater", repo: "cc" });
    expect(spawnSync).toHaveBeenCalledWith(["git", "remote", "get-url", "origin"]);
  });

  it("GITHUB_HOST があれば host を上書きする", () => {
    vi.stubEnv("GITHUB_HOST", " ghe.example.com ");
    spawnSync.mockReturnValue(output(0, "https://github.com/a/b"));
    expect(resolveRepoFromGit().host).toBe("ghe.example.com");
  });

  it("git が失敗したら stderr を含めて throw する", () => {
    spawnSync.mockReturnValue(output(128, "", "fatal: no remote\n"));
    expect(() => resolveRepoFromGit()).toThrow("git remote failed: fatal: no remote");
  });

  it("URL を解釈できなければ throw する", () => {
    spawnSync.mockReturnValue(output(0, "not-a-url"));
    expect(() => resolveRepoFromGit()).toThrow("could not parse owner/repo from remote URL");
  });
});

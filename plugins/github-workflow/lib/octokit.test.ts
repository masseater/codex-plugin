import { execFileSync } from "node:child_process";
import { Octokit } from "octokit";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { getOctokit, resolveGithubToken } from "./octokit.ts";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("octokit", () => ({ Octokit: vi.fn() }));

describe("resolveGithubToken", () => {
  test("uses GITHUB_TOKEN on github.com without calling gh", () => {
    const runGh = vi.fn(() => "from-gh");
    expect(resolveGithubToken("github.com", { GITHUB_TOKEN: "env-token" }, runGh)).toBe(
      "env-token",
    );
    expect(runGh).not.toHaveBeenCalled();
  });

  test("falls back to gh auth token when GITHUB_TOKEN is unset", () => {
    const runGh = vi.fn(() => "gh-token\n");
    expect(resolveGithubToken("github.com", {}, runGh)).toBe("gh-token");
    expect(runGh).toHaveBeenCalledWith(["auth", "token"]);
  });

  test("ignores GITHUB_TOKEN for an enterprise host", () => {
    const runGh = vi.fn(() => "ghe-token");
    expect(resolveGithubToken("ghe.example.com", { GITHUB_TOKEN: "env-token" }, runGh)).toBe(
      "ghe-token",
    );
    expect(runGh).toHaveBeenCalledWith(["auth", "token", "-h", "ghe.example.com"]);
  });

  test("throws when gh returns an empty token", () => {
    expect(() => resolveGithubToken("github.com", {}, () => "  ")).toThrow("gh auth login");
  });
});

describe("既定の gh 実行", () => {
  afterEach(() => {
    vi.mocked(execFileSync).mockReset();
  });

  test("GITHUB_TOKEN が無ければ gh を呼んでトークンを得る", () => {
    vi.mocked(execFileSync).mockReturnValue("gh-token\n");
    expect(resolveGithubToken("github.com", {})).toBe("gh-token");
    expect(execFileSync).toHaveBeenCalledWith("gh", ["auth", "token"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  });
});

describe("getOctokit", () => {
  afterEach(() => {
    vi.mocked(execFileSync).mockReset();
    vi.mocked(Octokit).mockReset();
    vi.unstubAllEnvs();
  });

  test("github.com では api.github.com と GITHUB_TOKEN を使う", () => {
    vi.stubEnv("GITHUB_TOKEN", "env-token");
    getOctokit();
    expect(Octokit).toHaveBeenCalledWith({
      auth: "env-token",
      baseUrl: "https://api.github.com",
    });
  });

  test("enterprise host では /api/v3 の URL と gh のトークンを使う", () => {
    vi.mocked(execFileSync).mockReturnValue("ghe-token");
    getOctokit({ host: "ghe.example.com" });
    expect(Octokit).toHaveBeenCalledWith({
      auth: "ghe-token",
      baseUrl: "https://ghe.example.com/api/v3",
    });
  });
});

import { describe, expect, test } from "vite-plus/test";
import { resolveOriginRepo } from "./git-origin.ts";

/**
 * origin remote の fetch URL だけを返す git クライアントを作る。
 *
 * @param fetchUrl - origin の fetch URL
 * @returns resolveOriginRepo に渡す git クライアント
 */
function gitWithOrigin(fetchUrl: string) {
  return {
    getRemotes: async () => [{ name: "origin", refs: { fetch: fetchUrl, push: fetchUrl } }],
  };
}

describe("resolveOriginRepo", () => {
  test("parses an https remote", async () => {
    await expect(
      resolveOriginRepo(gitWithOrigin("https://github.com/owner/repo.git")),
    ).resolves.toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  test("parses an ssh remote", async () => {
    await expect(
      resolveOriginRepo(gitWithOrigin("git@github.com:org/my-repo.git")),
    ).resolves.toEqual({
      owner: "org",
      repo: "my-repo",
    });
  });

  test("parses a remote without the .git suffix", async () => {
    await expect(
      resolveOriginRepo(gitWithOrigin("https://github.com/owner/repo")),
    ).resolves.toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  test("keeps dots inside the repository name", async () => {
    await expect(
      resolveOriginRepo(gitWithOrigin("https://github.com/owner/my.repo.git")),
    ).resolves.toEqual({
      owner: "owner",
      repo: "my.repo",
    });
  });

  test("rejects a non-GitHub remote", async () => {
    await expect(
      resolveOriginRepo(gitWithOrigin("https://gitlab.com/owner/repo.git")),
    ).rejects.toThrow("Could not parse GitHub URL from origin");
  });

  test("rejects when there is no origin remote", async () => {
    await expect(resolveOriginRepo({ getRemotes: async () => [] })).rejects.toThrow(
      "No origin remote found",
    );
  });
});

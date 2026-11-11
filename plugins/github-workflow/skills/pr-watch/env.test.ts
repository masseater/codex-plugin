import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("../../lib/octokit.ts", () => ({ resolveGithubToken: () => "resolved-token" }));

describe("env", () => {
  it("読み込み時に解決したトークンを GITHUB_TOKEN として公開する", async () => {
    const { env } = await import("./env.ts");
    expect(env).toEqual({ GITHUB_TOKEN: "resolved-token" });
  });
});

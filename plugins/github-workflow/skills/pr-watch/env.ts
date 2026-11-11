import { resolveGithubToken } from "../../lib/octokit.ts";

export const env = { GITHUB_TOKEN: resolveGithubToken() };

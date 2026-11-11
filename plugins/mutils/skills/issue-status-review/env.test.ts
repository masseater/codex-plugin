import { afterEach, describe, expect, test } from "bun:test";
import { getEnv } from "./env.ts";

describe("getEnv", () => {
  const originalToken = process.env.GITHUB_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = originalToken;
    }
  });

  test("returns the token when GITHUB_TOKEN is set", () => {
    process.env.GITHUB_TOKEN = "ghp_test_token";
    expect(getEnv().GITHUB_TOKEN).toBe("ghp_test_token");
  });

  test("throws when GITHUB_TOKEN is missing", () => {
    delete process.env.GITHUB_TOKEN;
    expect(() => getEnv()).toThrow();
  });

  test("throws when GITHUB_TOKEN is empty", () => {
    process.env.GITHUB_TOKEN = "";
    expect(() => getEnv()).toThrow();
  });
});

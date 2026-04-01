import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * Test get-comments-by-thread.ts by mocking deps and invoking the captured run().
 */

const mockGraphql = vi.fn();

vi.mock("../env.js", () => ({
  env: { GITHUB_TOKEN: "ghp_mock_token" },
}));

vi.mock("octokit", () => ({
  Octokit: vi.fn(() => ({
    graphql: mockGraphql,
  })),
}));

let capturedCommand: { run: (ctx: { args: Record<string, string> }) => Promise<void> };

vi.mock("citty", () => ({
  defineCommand: vi.fn((config: typeof capturedCommand) => {
    capturedCommand = config;
    return config;
  }),
  runMain: vi.fn(),
}));

await import("./get-comments-by-thread.js");

describe("get-comments-by-thread run()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  test("maps GraphQL response to flat comment structure", async () => {
    mockGraphql.mockResolvedValue({
      node: {
        id: "PRRT_abc",
        path: "src/index.ts",
        line: 42,
        comments: {
          nodes: [
            {
              id: "IC_1",
              databaseId: 100,
              author: { login: "octocat" },
              body: "Please fix this",
              url: "https://github.com/o/r/pull/1#discussion_r100",
            },
            {
              id: "IC_2",
              databaseId: 101,
              author: { login: "reviewer" },
              body: "Agreed",
              url: "https://github.com/o/r/pull/1#discussion_r101",
            },
          ],
        },
      },
    });

    await capturedCommand.run({ args: { "thread-id": "PRRT_abc" } });

    expect(console.log).toHaveBeenCalledOnce();
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.threadId).toBe("PRRT_abc");
    expect(output.path).toBe("src/index.ts");
    expect(output.line).toBe(42);
    expect(output.comments).toHaveLength(2);
    expect(output.comments[0]).toEqual({
      id: "IC_1",
      databaseId: 100,
      author: "octocat",
      body: "Please fix this",
      url: "https://github.com/o/r/pull/1#discussion_r100",
    });
  });

  test("handles thread with no comments", async () => {
    mockGraphql.mockResolvedValue({
      node: {
        id: "PRRT_empty",
        path: "README.md",
        line: null,
        comments: { nodes: [] },
      },
    });

    await capturedCommand.run({ args: { "thread-id": "PRRT_empty" } });

    const output = JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0] ?? "{}");
    expect(output.comments).toEqual([]);
    expect(output.line).toBeNull();
  });
});

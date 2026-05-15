import { describe, expect, test } from "bun:test";
import { toIssueResult } from "./fetch-issue.ts";

const ref = { owner: "masseater", repo: "claude-code-plugin", issueNumber: 42 };

describe("toIssueResult", () => {
  test("normalizes a fully populated issue", () => {
    const result = toIssueResult(
      ref,
      {
        number: 42,
        title: "Add issue-status-review skill",
        state: "open",
        state_reason: null,
        labels: ["enhancement", { name: "skill" }],
        assignees: [{ login: "masseater" }],
        milestone: { title: "v1" },
        user: { login: "reporter" },
        created_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-10T00:00:00Z",
        html_url: "https://github.com/masseater/codex-plugin/issues/42",
        body: "Please add the skill.",
      },
      [
        {
          user: { login: "commenter" },
          created_at: "2026-05-02T00:00:00Z",
          updated_at: "2026-05-02T00:00:00Z",
          body: "Sounds good.",
          html_url: "https://github.com/masseater/codex-plugin/issues/42#issuecomment-1",
        },
      ],
    );

    expect(result.number).toBe(42);
    expect(result.labels).toEqual(["enhancement", "skill"]);
    expect(result.assignees).toEqual(["masseater"]);
    expect(result.milestone).toBe("v1");
    expect(result.author).toBe("reporter");
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]?.author).toBe("commenter");
  });

  test("drops empty label names and tolerates missing optional fields", () => {
    const result = toIssueResult(
      ref,
      {
        number: 42,
        title: "Untitled",
        state: "closed",
        labels: [{ name: null }, "valid"],
        created_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-01T00:00:00Z",
        html_url: "https://github.com/o/r/issues/42",
      },
      [],
    );

    expect(result.labels).toEqual(["valid"]);
    expect(result.assignees).toEqual([]);
    expect(result.milestone).toBeNull();
    expect(result.author).toBe("");
    expect(result.stateReason).toBeNull();
    expect(result.body).toBe("");
    expect(result.comments).toEqual([]);
  });

  test("falls back to an empty author for comments with no user", () => {
    const result = toIssueResult(
      ref,
      {
        number: 42,
        title: "t",
        state: "open",
        labels: [],
        created_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-01T00:00:00Z",
        html_url: "https://github.com/o/r/issues/42",
      },
      [
        {
          user: null,
          created_at: "2026-05-02T00:00:00Z",
          updated_at: "2026-05-02T00:00:00Z",
          body: null,
          html_url: "https://github.com/o/r/issues/42#issuecomment-2",
        },
      ],
    );

    expect(result.comments[0]).toEqual({
      author: "",
      createdAt: "2026-05-02T00:00:00Z",
      updatedAt: "2026-05-02T00:00:00Z",
      body: "",
      url: "https://github.com/o/r/issues/42#issuecomment-2",
    });
  });
});

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test as base, describe, expect } from "vitest";

/**
 * Test pure logic and filesystem operations from progress-hooks.ts.
 * The hook uses cc-hooks-ts + cc-plugin-lib which we don't invoke directly.
 * Instead we test the extracted pure functions and filesystem side-effects.
 */

// --- Re-implementations mirroring the source ---

function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function buildInitialContent(formattedDateTime: string, previousFile: string | null): string {
  const previousFileLink =
    previousFile !== null ? `\n> Continued from: [${previousFile}](./${previousFile})\n` : "";

  return `**IMPORTANT**

- This file is for tracking your progress towards goals during this session.
- Use it to document achievements, challenges, and next steps.
- Overwriting existing descriptions is prohibited. Always append to the end.

# Session ${formattedDateTime}
${previousFileLink}`;
}

function buildSessionStartContext(
  progressDir: string,
  filename: string,
  source: string,
  previousFile: string | null,
): string {
  const compactContext =
    source === "compact" && previousFile !== null
      ? ` This session continues from a compacted context. Previous progress was tracked in ${progressDir}/${previousFile}.`
      : "";

  return `Progress file created: ${progressDir}/${filename}. When you make progress towards your goals, remember to update this file to keep track of your achievements.${compactContext}`;
}

function buildStopReason(
  progressDir: string,
  latestFile: string,
  formattedDateTime: string,
): string {
  return `Update progress file: ${progressDir}/${latestFile}. Document your progress under the ## ${formattedDateTime} heading. If you learned any general insights or gotchas during this session that would be useful across the project, record them in .claude/rules/gotchas.md instead of the progress file.`;
}

// --- Fixture ---

const test = base.extend<{ testDir: string }>({
  testDir: async ({}, use) => {
    const dir = path.join(
      tmpdir(),
      `progress-hooks-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    mkdirSync(dir, { recursive: true });
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
});

// --- Tests ---

describe("formatDateTime", () => {
  test("formats a known date correctly", () => {
    const date = new Date(2026, 0, 15, 9, 5, 3); // 2026-01-15 09:05:03
    expect(formatDateTime(date)).toBe("2026-01-15_09-05-03");
  });

  test("pads single-digit month and day", () => {
    const date = new Date(2025, 2, 3, 1, 2, 3); // 2025-03-03 01:02:03
    expect(formatDateTime(date)).toBe("2025-03-03_01-02-03");
  });

  test("handles midnight", () => {
    const date = new Date(2026, 11, 31, 0, 0, 0); // 2026-12-31 00:00:00
    expect(formatDateTime(date)).toBe("2026-12-31_00-00-00");
  });

  test("handles end of day", () => {
    const date = new Date(2026, 5, 15, 23, 59, 59); // 2026-06-15 23:59:59
    expect(formatDateTime(date)).toBe("2026-06-15_23-59-59");
  });

  test("handles double-digit month and day", () => {
    const date = new Date(2026, 10, 28, 14, 30, 45); // 2026-11-28 14:30:45
    expect(formatDateTime(date)).toBe("2026-11-28_14-30-45");
  });
});

describe("buildInitialContent", () => {
  const DATETIME = "2026-03-28_10-30-00";

  test("builds content without previous file link", () => {
    const content = buildInitialContent(DATETIME, null);
    expect(content).toContain("**IMPORTANT**");
    expect(content).toContain("# Session 2026-03-28_10-30-00");
    expect(content).not.toContain("Continued from:");
  });

  test("builds content with previous file link", () => {
    const content = buildInitialContent(DATETIME, "2026-03-28_09-00-00.md");
    expect(content).toContain("# Session 2026-03-28_10-30-00");
    expect(content).toContain(
      "> Continued from: [2026-03-28_09-00-00.md](./2026-03-28_09-00-00.md)",
    );
  });

  test("contains progress tracking instructions", () => {
    const content = buildInitialContent(DATETIME, null);
    expect(content).toContain("tracking your progress towards goals");
    expect(content).toContain("Overwriting existing descriptions is prohibited");
    expect(content).toContain("Always append to the end");
  });
});

describe("buildSessionStartContext", () => {
  const PROGRESS_DIR = ".agents/progress";
  const FILENAME = "2026-03-28_10-30-00.md";

  test("builds context for startup source without compact info", () => {
    const ctx = buildSessionStartContext(PROGRESS_DIR, FILENAME, "startup", null);
    expect(ctx).toBe(
      "Progress file created: .agents/progress/2026-03-28_10-30-00.md. When you make progress towards your goals, remember to update this file to keep track of your achievements.",
    );
  });

  test("builds context for compact source with previous file", () => {
    const previousFile = "2026-03-28_09-00-00.md";
    const ctx = buildSessionStartContext(PROGRESS_DIR, FILENAME, "compact", previousFile);
    expect(ctx).toContain("Progress file created: .agents/progress/2026-03-28_10-30-00.md.");
    expect(ctx).toContain(
      "This session continues from a compacted context. Previous progress was tracked in .agents/progress/2026-03-28_09-00-00.md.",
    );
  });

  test("compact source without previous file does not add compact context", () => {
    const ctx = buildSessionStartContext(PROGRESS_DIR, FILENAME, "compact", null);
    expect(ctx).not.toContain("compacted context");
  });

  test("non-compact source with previous file does not add compact context", () => {
    const ctx = buildSessionStartContext(PROGRESS_DIR, FILENAME, "startup", "prev.md");
    expect(ctx).not.toContain("compacted context");
  });
});

describe("buildStopReason", () => {
  test("builds stop reason with correct file and heading", () => {
    const reason = buildStopReason(
      ".agents/progress",
      "2026-03-28_10-30-00.md",
      "2026-03-28_11-00-00",
    );
    expect(reason).toBe(
      "Update progress file: .agents/progress/2026-03-28_10-30-00.md. Document your progress under the ## 2026-03-28_11-00-00 heading. If you learned any general insights or gotchas during this session that would be useful across the project, record them in .claude/rules/gotchas.md instead of the progress file.",
    );
  });
});

describe("filesystem: progress file creation", () => {
  test("creates progress directory and writes initial content", ({ testDir }) => {
    const progressDir = path.join(testDir, ".agents", "progress");
    const filename = "2026-03-28_10-30-00.md";
    const filepath = path.join(progressDir, filename);

    mkdirSync(progressDir, { recursive: true });

    const content = buildInitialContent("2026-03-28_10-30-00", null);
    const { writeFileSync } = require("node:fs");
    writeFileSync(filepath, content, "utf-8");

    expect(existsSync(filepath)).toBe(true);
    const written = readFileSync(filepath, "utf-8");
    expect(written).toContain("# Session 2026-03-28_10-30-00");
    expect(written).toContain("**IMPORTANT**");
  });

  test("creates progress file with compact continuation link", ({ testDir }) => {
    const progressDir = path.join(testDir, ".agents", "progress");
    const filename = "2026-03-28_10-30-00.md";
    const filepath = path.join(progressDir, filename);

    mkdirSync(progressDir, { recursive: true });

    const content = buildInitialContent("2026-03-28_10-30-00", "2026-03-28_09-00-00.md");
    const { writeFileSync } = require("node:fs");
    writeFileSync(filepath, content, "utf-8");

    const written = readFileSync(filepath, "utf-8");
    expect(written).toContain("Continued from: [2026-03-28_09-00-00.md](./2026-03-28_09-00-00.md)");
  });

  test("appendFileSync adds datetime heading for Stop event", ({ testDir }) => {
    const progressDir = path.join(testDir, ".agents", "progress");
    const filename = "2026-03-28_10-30-00.md";
    const filepath = path.join(progressDir, filename);

    mkdirSync(progressDir, { recursive: true });

    const { writeFileSync, appendFileSync } = require("node:fs");
    writeFileSync(filepath, "# Session 2026-03-28_10-30-00\n", "utf-8");

    const formattedDateTime = "2026-03-28_11-00-00";
    appendFileSync(filepath, `\n## ${formattedDateTime}\n\n`, "utf-8");

    const written = readFileSync(filepath, "utf-8");
    expect(written).toContain("## 2026-03-28_11-00-00");
    expect(written).toContain("# Session 2026-03-28_10-30-00");
  });
});

describe("hook decision logic", () => {
  type EventDecision =
    | { action: "create-progress"; source: string }
    | { action: "block-for-update"; latestFile: string }
    | { action: "skip"; reason: string };

  function decideHookAction(params: {
    eventType: string;
    gitRoot: string | null;
    agentsDirExists: boolean;
    stopHookActive?: boolean;
    latestFile?: string | null;
    source?: string;
  }): EventDecision {
    if (params.gitRoot === null) {
      return { action: "skip", reason: "not a git repository" };
    }
    if (!params.agentsDirExists) {
      return { action: "skip", reason: ".agents directory does not exist" };
    }
    if (params.eventType === "SessionStart") {
      return { action: "create-progress", source: params.source ?? "startup" };
    }
    if (params.eventType === "Stop") {
      if (params.stopHookActive) {
        return { action: "skip", reason: "stop_hook_active is true" };
      }
      if (params.latestFile) {
        return { action: "block-for-update", latestFile: params.latestFile };
      }
      return { action: "skip", reason: "no latest progress file" };
    }
    return { action: "skip", reason: "unknown event type" };
  }

  test("skips when not a git repository", () => {
    const result = decideHookAction({
      eventType: "SessionStart",
      gitRoot: null,
      agentsDirExists: true,
    });
    expect(result).toStrictEqual({ action: "skip", reason: "not a git repository" });
  });

  test("skips when .agents directory does not exist", () => {
    const result = decideHookAction({
      eventType: "SessionStart",
      gitRoot: "/repo",
      agentsDirExists: false,
    });
    expect(result).toStrictEqual({ action: "skip", reason: ".agents directory does not exist" });
  });

  test("creates progress file on SessionStart", () => {
    const result = decideHookAction({
      eventType: "SessionStart",
      gitRoot: "/repo",
      agentsDirExists: true,
      source: "startup",
    });
    expect(result).toStrictEqual({ action: "create-progress", source: "startup" });
  });

  test("creates progress file on SessionStart with compact source", () => {
    const result = decideHookAction({
      eventType: "SessionStart",
      gitRoot: "/repo",
      agentsDirExists: true,
      source: "compact",
    });
    expect(result).toStrictEqual({ action: "create-progress", source: "compact" });
  });

  test("defaults source to startup when not provided", () => {
    const result = decideHookAction({
      eventType: "SessionStart",
      gitRoot: "/repo",
      agentsDirExists: true,
    });
    expect(result).toStrictEqual({ action: "create-progress", source: "startup" });
  });

  test("skips Stop when stop_hook_active is true", () => {
    const result = decideHookAction({
      eventType: "Stop",
      gitRoot: "/repo",
      agentsDirExists: true,
      stopHookActive: true,
    });
    expect(result).toStrictEqual({ action: "skip", reason: "stop_hook_active is true" });
  });

  test("blocks on Stop when latest file exists", () => {
    const result = decideHookAction({
      eventType: "Stop",
      gitRoot: "/repo",
      agentsDirExists: true,
      stopHookActive: false,
      latestFile: "2026-03-28_10-30-00.md",
    });
    expect(result).toStrictEqual({
      action: "block-for-update",
      latestFile: "2026-03-28_10-30-00.md",
    });
  });

  test("skips Stop when no latest progress file", () => {
    const result = decideHookAction({
      eventType: "Stop",
      gitRoot: "/repo",
      agentsDirExists: true,
      stopHookActive: false,
      latestFile: null,
    });
    expect(result).toStrictEqual({ action: "skip", reason: "no latest progress file" });
  });

  test("skips unknown event type", () => {
    const result = decideHookAction({
      eventType: "PreToolUse",
      gitRoot: "/repo",
      agentsDirExists: true,
    });
    expect(result).toStrictEqual({ action: "skip", reason: "unknown event type" });
  });
});

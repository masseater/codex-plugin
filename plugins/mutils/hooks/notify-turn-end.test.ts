import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
}));
const execFileSync = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFileSync }));

import { notifyTurnEnd } from "./lib/notification.ts";

const dirs: string[] = [];

// `which terminal-notifier` の成否と、通知コマンドの呼び出しを切り分けて偽物にする
function stubCommands(notifierInstalled: boolean): void {
  execFileSync.mockImplementation((command: string) => {
    if (command === "which" && !notifierInstalled) throw new Error("not found");
    return "";
  });
}

function notifierCalls(): unknown[][] {
  return execFileSync.mock.calls.filter(([command]) => command === "terminal-notifier");
}

beforeEach(() => {
  execFileSync.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("notifyTurnEnd", () => {
  test("does nothing when terminal-notifier is not installed", () => {
    stubCommands(false);
    notifyTurnEnd({ last_assistant_message: "done" });
    expect(notifierCalls()).toHaveLength(0);
  });

  test("sends the last assistant message with the cwd name in the title", () => {
    stubCommands(true);
    notifyTurnEnd({ last_assistant_message: "done" });
    expect(notifierCalls()).toEqual([
      [
        "terminal-notifier",
        [
          "-title",
          `Claude (${path.basename(process.cwd())})`,
          "-message",
          "done",
          "-execute",
          "code -r",
        ],
        { stdio: "ignore" },
      ],
    ]);
  });

  test("skips when there is no message and no transcript_path", () => {
    stubCommands(true);
    notifyTurnEnd({});
    expect(notifierCalls()).toHaveLength(0);
  });

  describe("transcript fallback", () => {
    function homeWithTranscript(relative: string, text: string): { home: string; file: string } {
      const home = mkdtempSync(path.join(tmpdir(), "notify-home-"));
      dirs.push(home);
      vi.stubEnv("HOME", home);
      const file = path.join(home, relative);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify({ message: { role: "assistant", content: text } }));
      return { home, file };
    }

    test("reads the message from a transcript under ~/.claude/projects", () => {
      stubCommands(true);
      const { file } = homeWithTranscript(".claude/projects/p/t.jsonl", "from transcript");
      notifyTurnEnd({ transcript_path: file });
      expect(notifierCalls()[0]?.[1]).toContain("from transcript");
    });

    test("expands ~/ in transcript_path", () => {
      stubCommands(true);
      homeWithTranscript(".claude/projects/p/t.jsonl", "tilde");
      notifyTurnEnd({ transcript_path: "~/.claude/projects/p/t.jsonl" });
      expect(notifierCalls()[0]?.[1]).toContain("tilde");
    });

    test("ignores a transcript outside ~/.claude/projects", () => {
      stubCommands(true);
      const { file } = homeWithTranscript("elsewhere/t.jsonl", "secret");
      notifyTurnEnd({ transcript_path: file });
      expect(notifierCalls()).toHaveLength(0);
    });

    test("ignores a sibling directory sharing the projects prefix", () => {
      stubCommands(true);
      const { file } = homeWithTranscript(".claude/projects-other/t.jsonl", "sibling");
      notifyTurnEnd({ transcript_path: file });
      expect(notifierCalls()).toHaveLength(0);
    });
  });

  test("truncates the log preview but sends the whole message", () => {
    stubCommands(true);
    const long = "x".repeat(300);
    notifyTurnEnd({ last_assistant_message: long });
    expect(notifierCalls()[0]?.[1]).toContain(long);
  });
});

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { readState, resolveStateDir, statePath } from "./lib/audit-baseline.ts";
import { capturedHooks, hooksTsMock, makeContext, pluginLibMock } from "./__tests__/hook-mocks.ts";

vi.mock("@r_masseater/cc-plugin-lib", () => pluginLibMock());
vi.mock("cc-hooks-ts", () => hooksTsMock());

const auditMock = vi.hoisted(() => vi.fn());
vi.mock("../skills/standards-audit/scripts/audit.ts", () => ({ audit: auditMock }));
vi.mock("../skills/standards-audit/scripts/core/format.ts", () => ({
  formatReport: () => "REPORT",
}));

await import("./entry/standards-audit.ts");

// 違反が files の数だけあるように見える監査結果
function auditResult(files: string[]) {
  return {
    scopeResults: [
      {
        scope: { label: "(root)" },
        findings: files.map((file) => ({
          severity: "violation",
          rule: "scripts",
          file,
          line: null,
          message: "msg",
        })),
      },
    ],
  };
}

describe("standards-audit hook", () => {
  let dir: string;
  let path: string;

  const run = async (input: object) =>
    capturedHooks[0]!.run(makeContext({ cwd: dir, session_id: "s1", ...input }));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "devkit-audit-hook-"));
    vi.stubEnv("DEVKIT_AUDIT_ON_STOP", "1");
    vi.stubEnv("XDG_STATE_HOME", dir);
    path = statePath(resolveStateDir(), "s1");
    auditMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("DEVKIT_AUDIT_ON_STOP が未設定なら監査しない", async () => {
    vi.stubEnv("DEVKIT_AUDIT_ON_STOP", "");
    expect(await run({ hook_event_name: "SessionStart" })).toMatchObject({ kind: "success" });
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("SessionStart で違反を基準値として記録し、既にあれば上書きしない", async () => {
    auditMock.mockResolvedValue(auditResult(["a.ts"]));
    await run({ hook_event_name: "SessionStart" });
    expect(readState(path)?.baseline).toHaveLength(1);

    auditMock.mockResolvedValue(auditResult(["a.ts", "b.ts"]));
    await run({ hook_event_name: "SessionStart" });
    expect(readState(path)?.baseline).toHaveLength(1);
    expect(auditMock).toHaveBeenCalledTimes(1);
  });

  it("stop_hook_active の再入では監査しない", async () => {
    expect(await run({ hook_event_name: "Stop", stop_hook_active: true })).toMatchObject({
      kind: "success",
    });
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("基準値が無いまま Stop になったら、その時点を基準値にして通知しない", async () => {
    auditMock.mockResolvedValue(auditResult(["a.ts"]));
    expect(await run({ hook_event_name: "Stop" })).toMatchObject({ kind: "success" });
    expect(readState(path)?.baseline).toHaveLength(1);
  });

  it("新しい違反が無ければ通知しない", async () => {
    auditMock.mockResolvedValue(auditResult(["a.ts"]));
    await run({ hook_event_name: "SessionStart" });
    expect(await run({ hook_event_name: "Stop", stop_hook_active: false })).toMatchObject({
      kind: "success",
    });
  });

  it("新しい違反だけを通知し、ログと通知済みの状態を残す", async () => {
    auditMock.mockResolvedValue(auditResult(["a.ts"]));
    await run({ hook_event_name: "SessionStart" });

    auditMock.mockResolvedValue(auditResult(["a.ts", "b.ts"]));
    expect(await run({ hook_event_name: "Stop" })).toMatchObject({
      kind: "json",
      value: {
        output: { hookSpecificOutput: { additionalContext: expect.stringContaining("b.ts") } },
      },
    });
    expect(readState(path)?.notified).toHaveLength(1);
    const logPath = join(dir, ".claude/hooks/quality-check-log/standards-audit.log");
    expect(existsSync(logPath)).toBe(true);
    expect(readFileSync(logPath, "utf-8")).toBe("REPORT");

    // 通知済みの違反は 2 回目の Stop では通知しない
    expect(await run({ hook_event_name: "Stop" })).toMatchObject({ kind: "success" });
  });
});

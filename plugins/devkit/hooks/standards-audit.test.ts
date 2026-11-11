import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  type AuditFindings,
  collectViolations,
  formatNotice,
  newViolations,
  readState,
  statePath,
  writeState,
} from "./lib/audit-baseline.ts";

function result(
  findings: { severity: string; rule?: string; file?: string | null; line?: number | null }[],
  label = "(root)",
): AuditFindings {
  return {
    scopeResults: [
      {
        scope: { label },
        findings: findings.map((f) => ({
          severity: f.severity,
          rule: f.rule ?? "scripts",
          file: f.file ?? null,
          line: f.line ?? null,
          message: "msg",
        })),
      },
    ],
  };
}

describe("collectViolations", () => {
  it("returns only violations", () => {
    const v = collectViolations(result([{ severity: "violation" }, { severity: "warning" }]));
    expect(v).toHaveLength(1);
  });

  it("uses a key that does not depend on the line number", () => {
    const [a] = collectViolations(result([{ severity: "violation", file: "a.ts", line: 1 }]));
    const [b] = collectViolations(result([{ severity: "violation", file: "a.ts", line: 9 }]));
    expect(a?.key).toBe(b?.key);
  });

  it("prefixes workspace label in the text", () => {
    const [v] = collectViolations(result([{ severity: "violation", file: "x.ts" }], "apps/web"));
    expect(v?.text).toContain("apps/web/x.ts");
  });
});

describe("newViolations", () => {
  const current = collectViolations(
    result([
      { severity: "violation", file: "a.ts" },
      { severity: "violation", file: "b.ts" },
      { severity: "violation", file: "c.ts" },
    ]),
  );
  const [a, b, c] = current;

  it("excludes baseline and already-notified violations", () => {
    const added = newViolations(current, { baseline: [a!.key], notified: [b!.key] });
    expect(added).toEqual([c]);
  });

  it("returns nothing when everything is known", () => {
    expect(newViolations(current, { baseline: [a!.key, b!.key], notified: [c!.key] })).toHaveLength(
      0,
    );
  });
});

describe("state file", () => {
  it("round-trips the state per session", () => {
    const dir = mkdtempSync(join(tmpdir(), "devkit-audit-"));
    try {
      const path = statePath(dir, "session-1");
      expect(readState(path)).toBeUndefined();
      writeState(path, { baseline: ["k"], notified: [] });
      expect(readState(path)).toEqual({ baseline: ["k"], notified: [] });
      expect(path).toContain("session-1.json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats a state file with an unexpected shape as missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "devkit-audit-"));
    try {
      const path = statePath(dir, "session-2");
      writeState(path, { baseline: ["k"], notified: [] });
      writeFileSync(path, JSON.stringify({ baseline: "k" }));
      expect(readState(path)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("formatNotice", () => {
  it("lists up to five violations and the log path", () => {
    const many = collectViolations(
      result(Array.from({ length: 7 }, (_, i) => ({ severity: "violation", file: `f${i}.ts` }))),
    );
    const text = formatNotice(many, ".claude/hooks/quality-check-log/standards-audit.log");
    expect(text).toContain("7 件");
    expect(text).toContain("ほか 2 件");
    expect(text).toContain("standards-audit.log");
  });
});

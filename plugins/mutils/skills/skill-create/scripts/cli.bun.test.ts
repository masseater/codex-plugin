import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Vitest 側は import して実行する。ここでは shebang と実行権限で本物のプロセスとして起動できることだけを確かめる
function spawnScript(name: string, ...args: string[]) {
  const result = Bun.spawnSync([path.join(import.meta.dirname, name), ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return { stdout: result.stdout.toString(), exitCode: result.exitCode };
}

describe("skill-create CLI", () => {
  test("scripts run as executables", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "skill-create-cli-"));
    try {
      mkdirSync(path.join(dir, ".claude-plugin"));
      writeFileSync(path.join(dir, ".claude-plugin/plugin.json"), JSON.stringify({ name: "p" }));

      expect(spawnScript("detect-context.ts", dir).exitCode).toBe(0);
      const scaffold = spawnScript("scaffold.ts", "--plugin-dir", dir, "--skill-name", "demo");
      expect(scaffold.exitCode).toBe(0);
      const skillDir = path.join(dir, "skills", "demo");
      expect(spawnScript("inject-references.ts", skillDir).exitCode).toBe(0);
      expect(JSON.parse(spawnScript("validate.ts", skillDir).stdout)).toHaveProperty("valid");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

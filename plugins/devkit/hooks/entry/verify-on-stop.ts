#!/usr/bin/env bun
/**
 * Stop 時に bun run typecheck を実行して型エラーをフィードバックするフック
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const LOG_DIR = ".claude/hooks/quality-check-log";

const hasTypecheckScript = async (cwd: string): Promise<boolean> => {
  const pkgPath = `${cwd}/package.json`;
  const file = Bun.file(pkgPath);
  if (!(await file.exists())) {
    return false;
  }
  try {
    const pkg = await file.json();
    return typeof pkg?.scripts?.typecheck === "string";
  } catch {
    return false;
  }
};

const hook = defineHook({
  trigger: {
    Stop: true,
  },
  run: wrapRun(logger, async (context) => {
    const cwd = process.cwd();

    if (!(await hasTypecheckScript(cwd))) {
      logger.debug(`No typecheck script found in ${cwd}, skipping`);
      return context.success({});
    }

    // Clean log directory at the start of each run
    const logDir = `${cwd}/${LOG_DIR}`;
    rmSync(logDir, { recursive: true, force: true });
    mkdirSync(logDir, { recursive: true });

    logger.debug(`Running bun run typecheck in ${cwd}`);

    const proc = Bun.spawn(["bun", "run", "typecheck"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (exitCode === 0) {
      logger.debug("typecheck passed");
      return context.success({});
    }

    // Write failed job output to log file
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    const logPath = `${LOG_DIR}/typecheck.log`;
    writeFileSync(`${cwd}/${logPath}`, output);

    logger.warn("typecheck failed", { exitCode });
    return context.json({
      event: "Stop" as const,
      output: {
        decision: "block" as const,
        reason:
          `型チェックが失敗しました。\n\n` +
          `**失敗したジョブ:**\n` +
          `- typecheck → ${logPath}\n\n` +
          `**WHY:** 型エラーが残ったままコミットすると、他の開発者やCIで予期しないビルド失敗を引き起こします。\n` +
          `**FIX:** ${logPath} を読み、報告された型エラーを1つずつ修正してください。`,
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

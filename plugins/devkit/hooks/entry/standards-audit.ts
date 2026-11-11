#!/usr/bin/env bun
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const ENV_KEY = "DEVKIT_AUDIT_ON_STOP" as const;
const LOG_DIR = ".claude/hooks/quality-check-log";

const hook = defineHook({
  trigger: {
    Stop: true,
  },
  run: wrapRun(logger, async (context) => {
    // Only run when env var is set
    if (!process.env[ENV_KEY]) {
      logger.debug(`${ENV_KEY} is not set, skipping`);
      return context.success({});
    }

    // Prevent recursion
    if ("stop_hook_active" in context.input && context.input.stop_hook_active) {
      logger.debug("stop_hook_active is true, skipping to avoid recursion");
      return context.success({});
    }

    const cwd = context.input.cwd;
    logger.info("Running standards audit", { cwd });

    // Clean log directory at the start of each run
    const logDir = `${cwd}/${LOG_DIR}`;
    rmSync(logDir, { recursive: true, force: true });
    mkdirSync(logDir, { recursive: true });

    const { audit } = await import("../../skills/standards-audit/scripts/audit.ts");
    const { formatReport } = await import("../../skills/standards-audit/scripts/core/format.ts");

    const result = await audit(cwd);
    const report = formatReport(result);

    const violations = result.scopeResults.flatMap(
      (sr: { findings: Array<{ severity: string }> }) =>
        sr.findings.filter((f) => f.severity === "violation"),
    );

    if (violations.length === 0) {
      logger.info("No violations found");
      return context.success({});
    }

    // Write audit results to log file
    const logPath = `${LOG_DIR}/standards-audit.log`;
    writeFileSync(`${cwd}/${logPath}`, report);

    logger.warn(`Found ${violations.length} violations`);
    return context.json({
      event: "Stop" as const,
      output: {
        decision: "block" as const,
        reason:
          `Standards audit: ${violations.length} violation(s) found.\n\n` +
          `**失敗したジョブ:**\n` +
          `- standards-audit → ${logPath}\n\n` +
          `**WHY:** 規約違反が残ったままだとコードベースの一貫性が損なわれ、保守コストが増大します。\n` +
          `**FIX:** ${logPath} を読み、報告された violation を1つずつ修正してください。`,
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

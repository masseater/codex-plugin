#!/usr/bin/env bun
/**
 * devkit 規約監査をセッション単位の増分で通知するフック（DEVKIT_AUDIT_ON_STOP 設定時のみ）
 *
 * - SessionStart: 現在の違反を基準値として記録する（既にあれば上書きしない）
 * - Stop: 基準値と通知済みに含まれない違反だけを additionalContext で 1 回通知する
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  type AuditFindings,
  type BaselineState,
  collectViolations,
  formatNotice,
  newViolations,
  readState,
  resolveStateDir,
  statePath,
  writeState,
} from "../lib/audit-baseline.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const ENV_KEY = "DEVKIT_AUDIT_ON_STOP" as const;
const LOG_DIR = ".claude/hooks/quality-check-log";

async function runAudit(cwd: string): Promise<{ result: AuditFindings; report: string }> {
  const { audit } = await import("../../skills/standards-audit/scripts/audit.ts");
  const { formatReport } = await import("../../skills/standards-audit/scripts/core/format.ts");
  const result = await audit(cwd);
  return { result, report: formatReport(result) };
}

/**
 * SessionStart で現在の違反を基準値として記録する。既に記録済みなら上書きしない
 *
 * @param cwd - 監査するプロジェクトのルート
 * @param path - 状態ファイルのパス
 * @param state - 保存済みの状態
 */
async function recordBaseline(
  cwd: string,
  path: string,
  state: BaselineState | undefined,
): Promise<void> {
  if (state) {
    logger.debug("baseline already recorded for this session");
    return;
  }
  const { result } = await runAudit(cwd);
  const baseline = collectViolations(result).map((v) => v.key);
  writeState(path, { baseline, notified: [] });
  logger.info(`Recorded baseline: ${baseline.length} violation(s)`);
}

/**
 * Stop で基準値と通知済みに含まれない違反を探し、全件をログに書いて状態を更新する
 *
 * @param cwd - 監査するプロジェクトのルート
 * @param path - 状態ファイルのパス
 * @param state - 保存済みの状態
 * @returns Claude へ渡す文。通知することが無ければ null
 */
async function collectNotice(
  cwd: string,
  path: string,
  state: BaselineState | undefined,
): Promise<string | null> {
  const { result, report } = await runAudit(cwd);
  const current = collectViolations(result);

  if (!state) {
    // SessionStart で基準値を取れなかった場合（初回インストール直後など）は、ここを基準値にする
    writeState(path, { baseline: current.map((v) => v.key), notified: [] });
    logger.info(`No baseline found; recorded ${current.length} violation(s) at Stop`);
    return null;
  }

  const added = newViolations(current, state);
  if (added.length === 0) {
    logger.debug("No new violations");
    return null;
  }

  const logPath = `${LOG_DIR}/standards-audit.log`;
  mkdirSync(`${cwd}/${LOG_DIR}`, { recursive: true });
  writeFileSync(`${cwd}/${logPath}`, report);
  writeState(path, { ...state, notified: [...state.notified, ...added.map((v) => v.key)] });
  logger.warn(`Found ${added.length} new violation(s)`);
  return formatNotice(added, logPath);
}

/**
 * Stop フックの再入（stop_hook_active）かどうかを判定する
 *
 * @param input - フックの入力
 * @returns 再入中なら true
 */
function isStopHookActive(input: object): boolean {
  return "stop_hook_active" in input && input.stop_hook_active === true;
}

/**
 * Stop 時の通知文を求める。再入中は監査せずに通知なしとする
 *
 * @param input - フックの入力
 * @param path - 状態ファイルのパス
 * @param state - 保存済みの状態
 * @returns Claude へ渡す文。通知することが無ければ null
 */
async function stopNotice(
  input: { cwd: string },
  path: string,
  state: BaselineState | undefined,
): Promise<string | null> {
  if (isStopHookActive(input)) {
    logger.debug("stop_hook_active is true, skipping");
    return null;
  }
  return collectNotice(input.cwd, path, state);
}

const hook = defineHook({
  trigger: {
    SessionStart: true,
    Stop: true,
  },
  run: wrapRun(logger, async (context) => {
    if (!process.env[ENV_KEY]) {
      logger.debug(`${ENV_KEY} is not set, skipping`);
      return context.success({});
    }

    const { cwd, session_id: sessionId } = context.input;
    const path = statePath(resolveStateDir(), sessionId);
    const state = readState(path);

    if (context.input.hook_event_name === "SessionStart") {
      await recordBaseline(cwd, path, state);
      return context.success({});
    }

    const notice = await stopNotice(context.input, path, state);
    if (notice === null) return context.success({});
    return context.json({
      event: "Stop" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "Stop" as const,
          additionalContext: notice,
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

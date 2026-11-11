#!/usr/bin/env bun
import { findGitRoot, HookLogger, MutilsDB, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  hasAgentsDir,
  openWorkspaceMappings,
  type WorkspaceMapping,
} from "../lib/workspace-mappings-schema.ts";

using logger = HookLogger.fromFile(import.meta.filename);

/**
 * 指定セッションが最後に生成した workspace mapping を返す。
 * 並行セッションの workspace-id を取り違えないよう、session_id で絞り込む
 * @param cwd - mutils DB を探す git リポジトリのルート
 * @param sessionId - 復元対象のセッション ID
 * @returns そのセッションの最新の mapping。無ければ null
 */
export function getLatestWorkspaceMapping(cwd: string, sessionId: string): WorkspaceMapping | null {
  try {
    using db = MutilsDB.open(cwd);
    const table = openWorkspaceMappings(db);
    const rows = table.findAll("session_id = ? ORDER BY id DESC LIMIT 1", [sessionId]);
    return rows[0] ?? null;
  } catch (error) {
    // 復元は補助機能なので、DB が読めない場合は復元を省いてセッションを続ける
    logger.error("Failed to get workspace mapping", { err: error });
    return null;
  }
}

/**
 * 復元した workspace-id を伝える文
 * @param workspaceId - 復元した workspace-id
 * @param source - SessionStart の source（compact / resume）
 * @returns additionalContext の文字列
 */
export function formatRestoredContext(workspaceId: string, source: string): string {
  return `このセッションの workspace-id は ${workspaceId}（${source} 前から継続）。作業ディレクトリは .agents/workspaces/${workspaceId}/。`;
}

/** workspace-id を復元する SessionStart の source */
const RESTORE_SOURCES: ReadonlySet<string> = new Set(["compact", "resume"]);

/**
 * workspace-id を復元する対象のリポジトリを決める
 *
 * @param cwd - hook の作業ディレクトリ
 * @returns リポジトリのルート。git 管理外か .agents/ が無ければ null
 */
function workspaceRoot(cwd: string): string | null {
  const gitRoot = findGitRoot(cwd);
  if (gitRoot === null) {
    logger.debug("Skipping: not a git repository");
    return null;
  }
  if (!hasAgentsDir(gitRoot)) {
    logger.debug("Skipping: .agents directory does not exist");
    return null;
  }
  return gitRoot;
}

/**
 * compact / resume で始まったセッションの source を返す
 *
 * @param input - SessionStart 入力
 * @returns compact か resume なら source。それ以外は undefined
 */
function restorableSource(input: object): string | undefined {
  const source = "source" in input && typeof input.source === "string" ? input.source : "startup";
  logger.debug(`SessionStart source: ${source}`);
  return RESTORE_SOURCES.has(source) ? source : undefined;
}

const hook = defineHook({
  trigger: {
    SessionStart: true,
  },
  // Restore workspace-id after compact or resume
  run: wrapRun(logger, (context) => {
    const gitRoot = workspaceRoot(process.cwd());
    if (gitRoot === null) {
      return context.success({});
    }

    const source = restorableSource(context.input);
    if (source === undefined) {
      logger.debug("Not a compact/resume session, skipping");
      return context.success({});
    }

    const mapping = getLatestWorkspaceMapping(gitRoot, context.input.session_id);
    if (!mapping) {
      logger.debug("No workspace mapping found");
      return context.success({});
    }

    logger.info(`Restored workspace-id: ${mapping.workspace_id}`);

    // Provide restored workspace-id to Claude
    return context.json({
      event: "SessionStart",
      output: {
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: formatRestoredContext(mapping.workspace_id, source),
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

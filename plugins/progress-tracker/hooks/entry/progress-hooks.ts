#!/usr/bin/env bun
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { findGitRoot, getDB, HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { config } from "../lib/config.js";

using logger = HookLogger.fromFile(import.meta.filename);

function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

type SessionFileEntry = {
  id?: number;
  session_id: string;
  transcript_path: string;
  created_at: string;
  source: string;
  filename: string;
  continued_from: string | null;
};

const SESSIONS_TABLE_SCHEMA = {
  columns: `
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id TEXT NOT NULL,
		transcript_path TEXT NOT NULL,
		created_at TEXT NOT NULL,
		source TEXT NOT NULL,
		filename TEXT NOT NULL,
		continued_from TEXT
	`,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)",
  ],
} as const;

/**
 * セッション情報をDBに追加
 */
function addSessionToIndex(entry: SessionFileEntry): void {
  using db = getDB();
  const table = db.table<SessionFileEntry>("sessions", SESSIONS_TABLE_SCHEMA);
  table.upsert({
    session_id: entry.session_id,
    transcript_path: entry.transcript_path,
    created_at: entry.created_at,
    source: entry.source,
    filename: entry.filename,
    continued_from: entry.continued_from,
  });
}

/**
 * session_idに一致する最新のprogressファイルを検索
 * compact時に直前のファイルを特定するために使用
 */
function findProgressFileBySessionId(sessionId: string): string | null {
  using db = getDB();
  const result = db.get<{ filename: string }>(
    `SELECT filename FROM sessions WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`,
    [sessionId],
  );
  return result?.filename ?? null;
}

/**
 * 最新のprogressファイルを取得
 */
function getLatestProgressFile(): string | null {
  using db = getDB();
  // テーブルが存在するか確認
  const tableExists = db.get<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'`,
    [],
  );
  if (!tableExists) {
    return null;
  }
  const result = db.get<{ filename: string }>(
    `SELECT filename FROM sessions ORDER BY created_at DESC LIMIT 1`,
    [],
  );
  return result?.filename ?? null;
}

const hook = defineHook({
  trigger: {
    SessionStart: true,
    Stop: true,
  },
  run: wrapRun(logger, (context) => {
    const cwd = process.cwd();
    const eventType = context.input.hook_event_name;

    const gitRoot = findGitRoot(cwd);
    if (gitRoot === null) {
      logger.debug("Skipping: not a git repository");
      return context.success({});
    }

    const agentsDir = path.join(gitRoot, ".agents");

    if (!existsSync(agentsDir)) {
      logger.debug("Skipping: .agents directory does not exist");
      return context.success({});
    }

    const progressDir = path.join(gitRoot, config.progressDir);

    if (eventType === "SessionStart") {
      logger.debug("Processing SessionStart event");
      const formattedDateTime = formatDateTime(new Date());
      const sessionId = context.input.session_id;
      const transcriptPath = context.input.transcript_path;
      // 型検証: sourceがstringであることを確認
      const source =
        "source" in context.input && typeof context.input.source === "string"
          ? context.input.source
          : "startup";
      const filename = `${formattedDateTime}.md`;
      const filepath = path.join(progressDir, filename);

      logger.debug(`SessionStart source: ${source}, sessionId: ${sessionId}`);

      // compact時は同じsession_idを持つ直前のprogressファイルを検索
      let previousFile: string | null = null;
      if (source === "compact") {
        previousFile = findProgressFileBySessionId(sessionId);
        logger.debug(`Previous progress file for session: ${previousFile ?? "none"}`);
      }

      logger.debug(`Creating progress directory: ${progressDir}`);
      mkdirSync(progressDir, { recursive: true });

      // compact時は直前のファイルへのリンクを追加
      const previousFileLink =
        previousFile !== null ? `\n> Continued from: [${previousFile}](./${previousFile})\n` : "";

      const initialContent = `**IMPORTANT**

- This file is for tracking your progress towards goals during this session.
- Use it to document achievements, challenges, and next steps.
- Overwriting existing descriptions is prohibited. Always append to the end.

# Session ${formattedDateTime}
${previousFileLink}`;

      writeFileSync(filepath, initialContent, "utf-8");

      // sessions.dbにセッション情報を追加
      const entry: SessionFileEntry = {
        session_id: sessionId,
        transcript_path: transcriptPath,
        created_at: formattedDateTime,
        source,
        filename,
        continued_from: previousFile,
      };
      try {
        addSessionToIndex(entry);
      } catch (error) {
        logger.warn(`Failed to update sessions index: ${error}`);
        // Progress fileは作成済みなので続行
      }

      logger.info(`Created progress file: ${filepath}`);

      const compactContext =
        source === "compact" && previousFile !== null
          ? ` This session continues from a compacted context. Previous progress was tracked in ${config.progressDir}/${previousFile}.`
          : "";

      return context.success({
        additionalClaudeContext: `Progress file created: ${config.progressDir}/${filename}. When you make progress towards your goals, remember to update this file to keep track of your achievements.${compactContext}`,
      });
    }

    if (eventType === "Stop") {
      logger.debug("Processing Stop event");
      if ("stop_hook_active" in context.input && context.input.stop_hook_active) {
        logger.debug("Skipping: stop_hook_active is true");
      } else {
        const latestFile = getLatestProgressFile();
        logger.debug(`Latest progress file: ${latestFile ?? "none"}`);
        if (latestFile) {
          const filepath = path.join(progressDir, latestFile);
          const formattedDateTime = formatDateTime(new Date());

          // 日時見出しを追加
          appendFileSync(filepath, `\n## ${formattedDateTime}\n\n`, "utf-8");
          logger.info(`Added datetime heading to progress file: ${filepath}`);

          return context.json({
            event: "Stop",
            output: {
              decision: "block",
              reason: `Update progress file: ${config.progressDir}/${latestFile}. Document your progress under the ## ${formattedDateTime} heading. If you learned any general insights or gotchas during this session that would be useful across the project, record them in .claude/rules/gotchas.md instead of the progress file.`,
            },
          });
        }
      }
    }

    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

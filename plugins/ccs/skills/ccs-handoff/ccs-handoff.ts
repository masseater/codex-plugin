#!/usr/bin/env bun

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseWorkspaceId } from "@r_masseater/cc-plugin-lib";
import { pathIn, readTextIn } from "../../hooks/lib/path-in.ts";

// --- Constants ---

const MAX_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 500;

// --- Types ---

type SessionIndexEntry = {
  sessionId: string;
  summary?: string;
  firstPrompt?: string;
  gitBranch?: string;
  projectPath?: string;
  messageCount?: number;
  modified?: string;
};

type SessionsIndex = {
  sessions?: SessionIndexEntry[];
};

type MessageContent = {
  type: string;
  text?: string;
};

type MessageEntry = {
  type: "user" | "assistant";
  message: {
    content: string | MessageContent[];
  };
};

type SummaryEntry = {
  type: "summary";
  summary?: string;
};

type Task = {
  id?: string;
  status?: string;
  subject?: string;
  description?: string;
};

type Todo = {
  status?: string;
  content?: string;
};

type SessionInfo = {
  sessionId: string;
  profile: string;
  projectPath: string | null;
  gitBranch: string | null;
  messageCount: number | null;
  modified: string | null;
  summary: string | null;
  firstPrompt: string | null;
  jsonlPath: string;
  encodedPath: string;
};

// --- Type guard helpers ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    // 呼び出し側は undefined を「読めないファイル」として飛ばすので、例外を伝播しなくてよい
    if (process.env.DEBUG) console.error("[debug] JSON.parse failed:", error);
    return undefined;
  }
}

/**
 * base の下の JSON ファイルを読む。
 *
 * @param base - 基準のディレクトリ
 * @param segments - base からの相対パスの要素
 * @returns JSON として読んだ値。読めなければ undefined
 */
function readJsonIn(base: string, ...segments: string[]): unknown {
  try {
    return parseJsonSafe(readTextIn(base, ...segments));
  } catch (error) {
    // 読めないファイルは候補から外し、残りのファイルから情報を集める
    if (process.env.DEBUG) console.error(`[debug] failed to read ${segments.join("/")}:`, error);
    return undefined;
  }
}

function isSessionsIndex(value: unknown): value is SessionsIndex {
  if (!isRecord(value)) return false;
  return value.sessions === undefined || Array.isArray(value.sessions);
}

function isSummaryEntry(value: unknown): value is SummaryEntry {
  return (
    isRecord(value) &&
    value.type === "summary" &&
    (value.summary === undefined || typeof value.summary === "string")
  );
}

function isMessageType(type: unknown): boolean {
  return type === "user" || type === "assistant";
}

function isMessageContent(content: unknown): boolean {
  return typeof content === "string" || Array.isArray(content);
}

function isMessageEntry(value: unknown): value is MessageEntry {
  return (
    isRecord(value) &&
    isMessageType(value.type) &&
    isRecord(value.message) &&
    isMessageContent(value.message.content)
  );
}

function isTask(value: unknown): value is Task {
  return isRecord(value);
}

function isTodoArray(value: unknown): value is Todo[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => isRecord(item));
}

// --- Argument parsing ---

function parseArgs(): { profile: string; sessionId: string } {
  const [profile, sessionId] = process.argv.slice(2);
  if (profile === undefined || sessionId === undefined) {
    console.error("Usage: ccs-handoff.ts <profile> <sessionId>");
    console.error("  profile   - CCS profile name (e.g., c1, c2, team)");
    console.error("  sessionId - Session ID to generate handoff for");
    process.exit(1);
  }
  return { profile, sessionId };
}

// --- Profile directory helpers ---

function getCcsInstancesDir(): string {
  return pathIn(os.homedir(), ".ccs", "instances");
}

function getInstanceDir(profile: string): string {
  return pathIn(getCcsInstancesDir(), profile);
}

function subdirectoryNames(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function listAvailableProfiles(): string[] {
  const instancesDir = getCcsInstancesDir();
  return fs.existsSync(instancesDir) ? subdirectoryNames(instancesDir) : [];
}

function checkProfileExists(profile: string): void {
  if (fs.existsSync(getInstanceDir(profile))) return;
  const available = listAvailableProfiles();
  console.error(`Profile "${profile}" not found.`);
  console.error(
    available.length > 0
      ? `Available profiles: ${available.join(", ")}`
      : "No profiles found in ~/.ccs/instances/",
  );
  process.exit(1);
}

// --- Session lookup ---

function orNull<T>(value: T | undefined): T | null {
  return value ?? null;
}

/**
 * セッションの情報を組み立てる。sessions-index.json に無い項目は null にする
 *
 * @param location - セッションの ID・プロファイル・JSONL の場所
 * @param entry - sessions-index.json のエントリ（無ければ sessionId だけ）
 * @returns セッションの情報
 */
function toSessionInfo(
  location: Pick<SessionInfo, "sessionId" | "profile" | "jsonlPath" | "encodedPath">,
  entry: SessionIndexEntry,
): SessionInfo {
  return {
    sessionId: location.sessionId,
    profile: location.profile,
    projectPath: orNull(entry.projectPath),
    gitBranch: orNull(entry.gitBranch),
    messageCount: orNull(entry.messageCount),
    modified: orNull(entry.modified),
    summary: orNull(entry.summary),
    firstPrompt: orNull(entry.firstPrompt),
    jsonlPath: location.jsonlPath,
    encodedPath: location.encodedPath,
  };
}

function readSessionsIndex(projectsDir: string, encodedPath: string): SessionsIndex | undefined {
  if (!fs.existsSync(pathIn(projectsDir, encodedPath, "sessions-index.json"))) return undefined;
  const parsed = readJsonIn(projectsDir, encodedPath, "sessions-index.json");
  return isSessionsIndex(parsed) ? parsed : undefined;
}

/**
 * 1 つのプロジェクトの sessions-index.json からセッションを探す
 *
 * @param projectsDir - プロファイルの projects ディレクトリ
 * @param encodedPath - プロジェクトのディレクトリ名
 * @param profile - プロファイル名
 * @param sessionId - 探すセッション ID
 * @returns セッションの情報。見つからなければ undefined
 */
function sessionFromIndex(
  projectsDir: string,
  encodedPath: string,
  profile: string,
  sessionId: string,
): SessionInfo | undefined {
  const entry = readSessionsIndex(projectsDir, encodedPath)?.sessions?.find(
    (s) => s.sessionId === sessionId,
  );
  if (!entry) return undefined;
  // Construct JSONL path from instanceDir (do NOT use fullPath from index)
  const jsonlPath = pathIn(projectsDir, encodedPath, `${sessionId}.jsonl`);
  return toSessionInfo({ sessionId, profile, jsonlPath, encodedPath }, entry);
}

function findInIndexes(
  projectsDir: string,
  profile: string,
  sessionId: string,
): SessionInfo | undefined {
  for (const encodedPath of subdirectoryNames(projectsDir)) {
    const session = sessionFromIndex(projectsDir, encodedPath, profile, sessionId);
    if (session) return session;
  }
  return undefined;
}

// Fallback: glob for {sessionId}.jsonl
async function findByGlob(
  projectsDir: string,
  profile: string,
  sessionId: string,
): Promise<SessionInfo | undefined> {
  const glob = new Bun.Glob(`*/${sessionId}.jsonl`);
  for await (const match of glob.scan({ cwd: projectsDir })) {
    const location = {
      sessionId,
      profile,
      jsonlPath: pathIn(projectsDir, match),
      encodedPath: path.dirname(match),
    };
    return toSessionInfo(location, { sessionId });
  }
  return undefined;
}

function requireProjectsDir(profile: string): string {
  const projectsDir = pathIn(getInstanceDir(profile), "projects");
  if (!fs.existsSync(projectsDir)) {
    console.error(`No projects found in profile ${profile}`);
    process.exit(1);
  }
  return projectsDir;
}

async function findSession(profile: string, sessionId: string): Promise<SessionInfo> {
  const projectsDir = requireProjectsDir(profile);
  const session =
    findInIndexes(projectsDir, profile, sessionId) ??
    (await findByGlob(projectsDir, profile, sessionId));
  if (session) return session;

  console.error(`Session ${sessionId} not found in profile ${profile}`);
  return process.exit(1);
}

// --- Message reading ---

type ParsedMessage = {
  role: "User" | "Assistant";
  text: string;
};

function extractTextFromContent(content: string | MessageContent[]): string | null {
  if (typeof content === "string") {
    return content.trim() || null;
  }
  const textBlocks = content.flatMap((c) =>
    c.type === "text" && typeof c.text === "string" ? [c.text] : [],
  );
  const joined = textBlocks.join("\n").trim();
  return joined || null;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

/**
 * セッションの JSONL を 1 行ずつ JSON として読む
 *
 * @param jsonlPath - セッションの JSONL
 * @returns 各行を読んだ値（読めない行は undefined）。ファイルが無ければ空
 */
function journalEntries(jsonlPath: string): unknown[] {
  if (!fs.existsSync(jsonlPath)) return [];
  return readTextIn(path.dirname(jsonlPath), path.basename(jsonlPath))
    .split("\n")
    .filter(Boolean)
    .map(parseJsonSafe);
}

function summaryOf(entry: unknown): string | null {
  return isSummaryEntry(entry) && entry.summary ? entry.summary : null;
}

function messageOf(entry: unknown): ParsedMessage | null {
  if (!isMessageEntry(entry)) return null;
  const text = extractTextFromContent(entry.message.content);
  if (!text) return null;
  const role = entry.type === "user" ? "User" : "Assistant";
  return { role, text: truncate(text, MAX_MESSAGE_LENGTH) };
}

/**
 * 新しい順に並べた行のうち、MAX_MESSAGES 件目のメッセージまでの行数を返す。
 *
 * @param messages - 各行を読んだメッセージ（メッセージでない行は null）
 * @returns 読む範囲の行数
 */
function scanLength(messages: (ParsedMessage | null)[]): number {
  let count = 0;
  const last = messages.findIndex((message) => message !== null && ++count === MAX_MESSAGES);
  return last === -1 ? messages.length : last + 1;
}

/**
 * 末尾から MAX_MESSAGES 件のメッセージと、その範囲で最後に書かれた summary を読む
 *
 * @param jsonlPath - セッションの JSONL
 * @returns 新しい順のメッセージと summary
 */
function readMessages(jsonlPath: string): {
  messages: ParsedMessage[];
  jsonlSummary: string | null;
} {
  const entries = journalEntries(jsonlPath).toReversed();
  const parsed = entries.map(messageOf);
  const length = scanLength(parsed);
  const jsonlSummary =
    entries
      .slice(0, length)
      .map(summaryOf)
      .find((summary) => summary !== null) ?? null;
  const messages = parsed
    .slice(0, length)
    .filter((message): message is ParsedMessage => message !== null);
  return { messages, jsonlSummary };
}

// --- Tasks reading ---

type PendingTask = {
  id: string;
  status: string;
  subject: string;
  description: string;
};

function or(value: string | undefined, fallback: string): string {
  return value ?? fallback;
}

function toPendingTask(task: Task, file: string): PendingTask {
  return {
    id: or(task.id, file.replace(".json", "")),
    status: or(task.status, "unknown"),
    subject: or(task.subject, "(no subject)"),
    description: or(task.description, ""),
  };
}

function isTaskFile(file: string): boolean {
  return !file.startsWith(".") && file.endsWith(".json");
}

function pendingTaskIn(tasksDir: string, file: string): PendingTask[] {
  const task = readJsonIn(tasksDir, file);
  return isTask(task) && task.status !== "completed" ? [toPendingTask(task, file)] : [];
}

function readTasks(instanceDir: string, sessionId: string): PendingTask[] {
  const tasksDir = pathIn(instanceDir, "tasks", sessionId);
  if (!fs.existsSync(tasksDir)) {
    return [];
  }
  return fs
    .readdirSync(tasksDir)
    .filter(isTaskFile)
    .flatMap((file) => pendingTaskIn(tasksDir, file));
}

// --- TODOs reading ---

type PendingTodo = {
  content: string;
};

function pendingTodos(todos: Todo[]): PendingTodo[] {
  return todos.flatMap((todo) =>
    todo.status !== "completed" && todo.content ? [{ content: todo.content }] : [],
  );
}

function pendingTodosIn(todosDir: string, file: string): PendingTodo[] {
  const todos = readJsonIn(todosDir, file);
  return isTodoArray(todos) ? pendingTodos(todos) : [];
}

async function readTodos(instanceDir: string, sessionId: string): Promise<PendingTodo[]> {
  const todosDir = pathIn(instanceDir, "todos");
  if (!fs.existsSync(todosDir)) {
    return [];
  }
  const files = await Array.fromAsync(
    new Bun.Glob(`${sessionId}-agent-*.json`).scan({ cwd: todosDir }),
  );
  return files.flatMap((file) => pendingTodosIn(todosDir, file));
}

// --- Subagent detection ---

function detectSubagents(instanceDir: string, encodedPath: string, sessionId: string): boolean {
  return fs.existsSync(pathIn(instanceDir, "projects", encodedPath, sessionId));
}

// --- Workspace ID extraction from .agents/workspaces/ ---

type UserSessionId = {
  fullId: string;
  featureName: string;
};

// Get the most recently modified workspace directory
function latestWorkspaceName(workspacesDir: string): string | undefined {
  return subdirectoryNames(workspacesDir)
    .map((name) => ({ name, mtime: fs.statSync(pathIn(workspacesDir, name)).mtimeMs }))
    .toSorted((a, b) => b.mtime - a.mtime)[0]?.name;
}

function extractUserSessionId(projectPath: string): UserSessionId | null {
  const workspacesDir = pathIn(projectPath, ".agents", "workspaces");
  if (!fs.existsSync(workspacesDir)) {
    return null;
  }
  const workspaceId = latestWorkspaceName(workspacesDir);
  if (!workspaceId) {
    return null;
  }
  // Validate workspace-id format using shared pattern
  const parsed = parseWorkspaceId(workspaceId);
  return parsed ? { fullId: workspaceId, featureName: parsed.featureName } : null;
}

// --- Plan file extraction ---

type PlanFileToolUse = { type: "tool_use"; name: string; input: { file_path: string } };

function isToolUse(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && value.type === "tool_use";
}

function isWriteOrEdit(name: unknown): boolean {
  return name === "Write" || name === "Edit";
}

// 計画ファイルの置き場所は個人ルールの .local-agents/plans/ と、Plan mode の .claude/plans/
function isPlanFilePath(filePath: unknown): boolean {
  return (
    typeof filePath === "string" &&
    (filePath.includes(".local-agents/plans/") || filePath.includes(".claude/plans/"))
  );
}

function isPlanFileToolUse(value: unknown): value is PlanFileToolUse {
  return (
    isToolUse(value) &&
    isWriteOrEdit(value.name) &&
    isRecord(value.input) &&
    isPlanFilePath(value.input.file_path)
  );
}

function assistantMessage(entry: unknown): Record<string, unknown> | undefined {
  return isRecord(entry) && entry.type === "assistant" && isRecord(entry.message)
    ? entry.message
    : undefined;
}

function assistantContentBlocks(entry: unknown): unknown[] {
  const content = assistantMessage(entry)?.content;
  return Array.isArray(content) ? content : [];
}

function extractPlanFilePaths(jsonlPath: string): string[] {
  const filePaths = journalEntries(jsonlPath)
    .flatMap(assistantContentBlocks)
    .filter(isPlanFileToolUse)
    .map((block) => block.input.file_path);
  return [...new Set(filePaths)];
}

// --- Markdown formatting ---

const NOT_AVAILABLE = "(not available)";

function orNotAvailable(value: string | number | null): string {
  return value === null ? NOT_AVAILABLE : String(value);
}

function sessionInfoSection(info: SessionInfo): string[] {
  return [
    "## Session Info",
    "",
    `- Profile: ${info.profile}`,
    `- Session ID: ${info.sessionId}`,
    `- Project Path: ${orNotAvailable(info.projectPath)}`,
    `- Git Branch: ${orNotAvailable(info.gitBranch)}`,
    `- Message Count: ${orNotAvailable(info.messageCount)}`,
    `- Last Modified: ${orNotAvailable(info.modified)}`,
    "",
  ];
}

function summarySection(info: SessionInfo, jsonlSummary: string | null): string[] {
  return ["## Session Summary", "", info.summary ?? jsonlSummary ?? NOT_AVAILABLE, ""];
}

function userSessionIdLines(userSessionId: UserSessionId | null): string[] {
  if (!userSessionId) return ["No workspace directory found in .agents/workspaces/"];
  return [
    `**Session ID**: \`${userSessionId.fullId}\``,
    "",
    `**Feature Name**: ${userSessionId.featureName}`,
    "",
    `Continue writing work files to \`.agents/workspaces/${userSessionId.fullId}/\` (the workspace directory already exists).`,
  ];
}

function messagesSection(messages: ParsedMessage[]): string[] {
  const body =
    messages.length === 0
      ? ["(no messages found)"]
      : messages.flatMap((msg) => [`### ${msg.role}`, "", msg.text, ""]);
  return [`## Recent Messages (up to ${MAX_MESSAGES}, newest first)`, "", ...body];
}

/**
 * 見出しと箇条書きの節を作る。項目が無ければ emptyText を書く
 *
 * @param title - 見出し
 * @param items - 項目の行
 * @param emptyText - 項目が無いときの文
 * @returns 節の行
 */
function listSection(title: string, items: string[], emptyText: string): string[] {
  return [`## ${title}`, "", ...(items.length === 0 ? [emptyText] : items), ""];
}

function taskLines(task: PendingTask): string[] {
  return [
    `- [ ] **[id: ${task.id}, ${task.status}]** ${task.subject}`,
    ...(task.description ? [`  ${task.description}`] : []),
  ];
}

function formatMarkdown(
  info: SessionInfo,
  messages: ParsedMessage[],
  jsonlSummary: string | null,
  tasks: PendingTask[],
  todos: PendingTodo[],
  hasSubagents: boolean,
  planFiles: string[],
  userSessionId: UserSessionId | null,
): string {
  return [
    `# Session Handoff: ${info.profile} / ${info.sessionId}`,
    "",
    ...sessionInfoSection(info),
    ...summarySection(info, jsonlSummary),
    "## User Session ID",
    "",
    ...userSessionIdLines(userSessionId),
    "",
    "## First Prompt",
    "",
    orNotAvailable(info.firstPrompt),
    "",
    ...messagesSection(messages),
    "## Subagents",
    "",
    `Subagent sessions detected: ${hasSubagents ? "Yes" : "No"}`,
    "",
    ...listSection(
      "Plan Files",
      planFiles.map((filePath) => `- ${filePath}`),
      "No plan files found.",
    ),
    ...listSection("Pending Tasks", tasks.flatMap(taskLines), "No pending tasks found."),
    ...listSection(
      "Pending TODOs",
      todos.map((todo) => `- [ ] ${todo.content}`),
      "No pending TODOs found.",
    ),
  ].join("\n");
}

// --- Main ---

async function main(): Promise<void> {
  const { profile, sessionId } = parseArgs();

  checkProfileExists(profile);

  const sessionInfo = await findSession(profile, sessionId);
  const instanceDir = getInstanceDir(profile);

  const { messages, jsonlSummary } = readMessages(sessionInfo.jsonlPath);
  const tasks = readTasks(instanceDir, sessionId);
  const todos = await readTodos(instanceDir, sessionId);
  const hasSubagents = detectSubagents(instanceDir, sessionInfo.encodedPath, sessionId);
  const planFiles = extractPlanFilePaths(sessionInfo.jsonlPath);

  // Extract user session-id for handoff
  const userSessionId = sessionInfo.projectPath
    ? extractUserSessionId(sessionInfo.projectPath)
    : null;

  const markdown = formatMarkdown(
    sessionInfo,
    messages,
    jsonlSummary,
    tasks,
    todos,
    hasSubagents,
    planFiles,
    userSessionId,
  );

  console.log(markdown);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

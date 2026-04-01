#!/usr/bin/env bun

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseWorkspaceId } from "../workspace-id/patterns.js";

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

type JournalEntry = MessageEntry | SummaryEntry | { type: string };

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
  } catch {
    return undefined;
  }
}

function isSessionsIndex(value: unknown): value is SessionsIndex {
  if (!isRecord(value)) return false;
  if ("sessions" in value && value.sessions !== undefined) {
    return Array.isArray(value.sessions);
  }
  return true;
}

function isJournalEntry(value: unknown): value is JournalEntry {
  return isRecord(value) && typeof value.type === "string";
}

function isSummaryEntry(value: unknown): value is SummaryEntry {
  return (
    isRecord(value) &&
    value.type === "summary" &&
    (value.summary === undefined || typeof value.summary === "string")
  );
}

function isMessageEntry(value: unknown): value is MessageEntry {
  if (!isRecord(value)) return false;
  if (value.type !== "user" && value.type !== "assistant") return false;
  if (!isRecord(value.message)) return false;
  const content = (value.message as Record<string, unknown>).content;
  return typeof content === "string" || Array.isArray(content);
}

function isTask(value: unknown): value is Task {
  return isRecord(value);
}

function isTodoArray(value: unknown): value is Todo[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => isRecord(item));
}

// --- Markdown table helper ---

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

// --- Argument parsing ---

function parseArgs(): { profile: string; sessionId: string } {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: ccs-handoff.ts <profile> <sessionId>");
    console.error("  profile   - CCS profile name (e.g., c1, c2, team)");
    console.error("  sessionId - Session ID to generate handoff for");
    process.exit(1);
  }
  return { profile: args[0] as string, sessionId: args[1] as string };
}

// --- Profile directory helpers ---

function getCcsInstancesDir(): string {
  return path.join(os.homedir(), ".ccs", "instances");
}

function getInstanceDir(profile: string): string {
  return path.join(getCcsInstancesDir(), profile);
}

function listAvailableProfiles(): string[] {
  const instancesDir = getCcsInstancesDir();
  if (!fs.existsSync(instancesDir)) {
    return [];
  }
  return fs
    .readdirSync(instancesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function checkProfileExists(profile: string): void {
  const instanceDir = getInstanceDir(profile);
  if (!fs.existsSync(instanceDir)) {
    const available = listAvailableProfiles();
    console.error(`Profile "${profile}" not found.`);
    if (available.length > 0) {
      console.error(`Available profiles: ${available.join(", ")}`);
    } else {
      console.error("No profiles found in ~/.ccs/instances/");
    }
    process.exit(1);
  }
}

// --- Session lookup ---

async function findSession(profile: string, sessionId: string): Promise<SessionInfo> {
  const instanceDir = getInstanceDir(profile);
  const projectsDir = path.join(instanceDir, "projects");

  if (!fs.existsSync(projectsDir)) {
    console.error(`No projects found in profile ${profile}`);
    process.exit(1);
  }

  // Primary: scan sessions-index.json files
  const projectEntries = fs.readdirSync(projectsDir, { withFileTypes: true });
  const projectDirs = projectEntries.filter((d) => d.isDirectory());

  for (const projectDir of projectDirs) {
    const encodedPath = projectDir.name;
    const indexPath = path.join(projectsDir, encodedPath, "sessions-index.json");

    if (!fs.existsSync(indexPath)) {
      continue;
    }

    let index: SessionsIndex;
    try {
      const raw = fs.readFileSync(indexPath, "utf-8");
      const parsed = parseJsonSafe(raw);
      if (!isSessionsIndex(parsed)) {
        continue;
      }
      index = parsed;
    } catch {
      continue;
    }

    const sessions = index.sessions ?? [];
    const entry = sessions.find((s) => s.sessionId === sessionId);

    if (entry) {
      // Construct JSONL path from instanceDir (do NOT use fullPath from index)
      const jsonlPath = path.join(projectsDir, encodedPath, `${sessionId}.jsonl`);

      return {
        sessionId,
        profile,
        projectPath: entry.projectPath ?? null,
        gitBranch: entry.gitBranch ?? null,
        messageCount: entry.messageCount ?? null,
        modified: entry.modified ?? null,
        summary: entry.summary ?? null,
        firstPrompt: entry.firstPrompt ?? null,
        jsonlPath,
        encodedPath,
      };
    }
  }

  // Fallback: glob for {sessionId}.jsonl
  const glob = new Bun.Glob(`*/${sessionId}.jsonl`);
  let fallbackEncodedPath: string | null = null;
  let fallbackJsonlPath: string | null = null;

  for await (const match of glob.scan({ cwd: projectsDir })) {
    fallbackEncodedPath = path.dirname(match);
    fallbackJsonlPath = path.join(projectsDir, match);
    break;
  }

  if (fallbackJsonlPath && fallbackEncodedPath) {
    return {
      sessionId,
      profile,
      projectPath: null,
      gitBranch: null,
      messageCount: null,
      modified: null,
      summary: null,
      firstPrompt: null,
      jsonlPath: fallbackJsonlPath,
      encodedPath: fallbackEncodedPath,
    };
  }

  console.error(`Session ${sessionId} not found in profile ${profile}`);
  process.exit(1);
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
  const textBlocks = content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string);
  const joined = textBlocks.join("\n").trim();
  return joined || null;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function readMessages(jsonlPath: string): {
  messages: ParsedMessage[];
  jsonlSummary: string | null;
} {
  if (!fs.existsSync(jsonlPath)) {
    return { messages: [], jsonlSummary: null };
  }

  const lines = fs.readFileSync(jsonlPath, "utf-8").split("\n").filter(Boolean);

  let jsonlSummary: string | null = null;
  const collected: ParsedMessage[] = [];

  // Scan from end
  for (let i = lines.length - 1; i >= 0 && collected.length < MAX_MESSAGES; i--) {
    const parsed = parseJsonSafe(lines[i] as string);
    if (!isJournalEntry(parsed)) {
      continue;
    }
    const entry = parsed;

    if (entry.type === "summary") {
      if (isSummaryEntry(entry) && entry.summary && jsonlSummary === null) {
        jsonlSummary = entry.summary;
      }
      continue;
    }

    if (entry.type !== "user" && entry.type !== "assistant") {
      continue;
    }

    if (!isMessageEntry(entry)) {
      continue;
    }

    const text = extractTextFromContent(entry.message.content);
    if (!text) continue;

    const role: "User" | "Assistant" = entry.type === "user" ? "User" : "Assistant";

    collected.push({ role, text: truncate(text, MAX_MESSAGE_LENGTH) });
  }

  return { messages: collected, jsonlSummary };
}

// --- Tasks reading ---

type PendingTask = {
  id: string;
  status: string;
  subject: string;
  description: string;
};

function readTasks(instanceDir: string, sessionId: string): PendingTask[] {
  const tasksDir = path.join(instanceDir, "tasks", sessionId);
  if (!fs.existsSync(tasksDir)) {
    return [];
  }

  const files = fs.readdirSync(tasksDir).filter((f) => !f.startsWith(".") && f.endsWith(".json"));

  const pending: PendingTask[] = [];

  for (const file of files) {
    const filePath = path.join(tasksDir, file);
    const parsed = parseJsonSafe(fs.readFileSync(filePath, "utf-8"));
    if (!isTask(parsed)) {
      continue;
    }
    const task = parsed;
    if (task.status !== "completed") {
      pending.push({
        id: task.id ?? file.replace(".json", ""),
        status: task.status ?? "unknown",
        subject: task.subject ?? "(no subject)",
        description: task.description ?? "",
      });
    }
  }

  return pending;
}

// --- TODOs reading ---

type PendingTodo = {
  content: string;
};

async function readTodos(instanceDir: string, sessionId: string): Promise<PendingTodo[]> {
  const todosDir = path.join(instanceDir, "todos");
  if (!fs.existsSync(todosDir)) {
    return [];
  }

  const glob = new Bun.Glob(`${sessionId}-agent-*.json`);
  const pending: PendingTodo[] = [];

  for await (const match of glob.scan({ cwd: todosDir })) {
    const filePath = path.join(todosDir, match);
    let todos: Todo[];
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = parseJsonSafe(raw);
      if (!isTodoArray(parsed)) continue;
      todos = parsed;
    } catch {
      continue;
    }

    for (const todo of todos) {
      if (todo.status !== "completed" && todo.content) {
        pending.push({ content: todo.content });
      }
    }
  }

  return pending;
}

// --- Subagent detection ---

function detectSubagents(instanceDir: string, encodedPath: string, sessionId: string): boolean {
  const subagentDir = path.join(instanceDir, "projects", encodedPath, sessionId);
  return fs.existsSync(subagentDir);
}

// --- Session ID extraction from .agents/sessions/ ---

type UserSessionId = {
  fullId: string;
  featureName: string;
};

function extractUserSessionId(projectPath: string): UserSessionId | null {
  const workspacesDir = path.join(projectPath, ".agents", "workspaces");
  if (!fs.existsSync(workspacesDir)) {
    return null;
  }

  // Get the most recently modified workspace directory
  const entries = fs
    .readdirSync(workspacesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const fullPath = path.join(workspacesDir, d.name);
      const stat = fs.statSync(fullPath);
      return { name: d.name, mtime: stat.mtimeMs };
    })
    .toSorted((a, b) => b.mtime - a.mtime);

  if (entries.length === 0) {
    return null;
  }

  const workspaceId = entries[0]?.name;
  if (!workspaceId) {
    return null;
  }

  // Validate workspace-id format using shared pattern
  const parsed = parseWorkspaceId(workspaceId);
  if (!parsed) {
    return null;
  }

  return {
    fullId: workspaceId,
    featureName: parsed.featureName,
  };
}

// --- Plan file extraction ---

function isPlanFileToolUse(
  value: unknown,
): value is { type: "tool_use"; name: string; input: { file_path: string } } {
  if (!isRecord(value)) return false;
  if (value.type !== "tool_use") return false;
  if (value.name !== "Write" && value.name !== "Edit") return false;
  if (!isRecord(value.input)) return false;
  const filePath = (value.input as Record<string, unknown>).file_path;
  return typeof filePath === "string" && filePath.includes(".agents/plans/");
}

function extractPlanFilePaths(jsonlPath: string): string[] {
  if (!fs.existsSync(jsonlPath)) {
    return [];
  }

  const lines = fs.readFileSync(jsonlPath, "utf-8").split("\n").filter(Boolean);
  const found = new Set<string>();

  for (const line of lines) {
    const parsed = parseJsonSafe(line);
    if (!isRecord(parsed)) continue;
    if (parsed.type !== "assistant") continue;
    if (!isRecord(parsed.message)) continue;
    const content = (parsed.message as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (isPlanFileToolUse(block)) {
        found.add(block.input.file_path);
      }
    }
  }

  return Array.from(found);
}

// --- Markdown formatting ---

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
  const lines: string[] = [];

  lines.push(`# Session Handoff: ${info.profile} / ${info.sessionId}`);
  lines.push("");

  // Session Info table
  lines.push("## Session Info");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");
  lines.push(`| Profile | ${escapeTableCell(info.profile)} |`);
  lines.push(`| Session ID | ${escapeTableCell(info.sessionId)} |`);
  lines.push(`| Project Path | ${escapeTableCell(info.projectPath ?? "(not available)")} |`);
  lines.push(`| Git Branch | ${escapeTableCell(info.gitBranch ?? "(not available)")} |`);
  lines.push(
    `| Message Count | ${escapeTableCell(info.messageCount !== null ? String(info.messageCount) : "(not available)")} |`,
  );
  lines.push(`| Last Modified | ${escapeTableCell(info.modified ?? "(not available)")} |`);
  lines.push("");

  // Summary
  lines.push("## Session Summary");
  lines.push("");
  const summaryText = info.summary ?? jsonlSummary ?? "(not available)";
  lines.push(summaryText);
  lines.push("");

  // User Session ID (for handoff)
  lines.push("## User Session ID");
  lines.push("");
  if (userSessionId) {
    lines.push(`**Session ID**: \`${userSessionId.fullId}\``);
    lines.push("");
    lines.push(`**Feature Name**: ${userSessionId.featureName}`);
    lines.push("");
    lines.push("To continue using this session-id, create the session directory:");
    lines.push("");
    lines.push("```bash");
    lines.push(`mkdir -p .agents/sessions/${userSessionId.fullId}`);
    lines.push("```");
  } else {
    lines.push("No user session-id found in .agents/sessions/");
  }
  lines.push("");

  // First Prompt
  lines.push("## First Prompt");
  lines.push("");
  lines.push(info.firstPrompt ?? "(not available)");
  lines.push("");

  // Recent Messages
  lines.push(`## Recent Messages (up to ${MAX_MESSAGES}, newest first)`);
  lines.push("");
  if (messages.length === 0) {
    lines.push("(no messages found)");
  } else {
    for (const msg of messages) {
      lines.push(`### ${msg.role}`);
      lines.push("");
      lines.push(msg.text);
      lines.push("");
    }
  }

  // Subagents
  lines.push("## Subagents");
  lines.push("");
  lines.push(`Subagent sessions detected: ${hasSubagents ? "Yes" : "No"}`);
  lines.push("");

  // Plan Files
  lines.push("## Plan Files");
  lines.push("");
  if (planFiles.length === 0) {
    lines.push("No plan files found.");
  } else {
    for (const filePath of planFiles) {
      lines.push(`- ${filePath}`);
    }
  }
  lines.push("");

  // Pending Tasks
  lines.push("## Pending Tasks");
  lines.push("");
  if (tasks.length === 0) {
    lines.push("No pending tasks found.");
  } else {
    for (const task of tasks) {
      lines.push(`- [ ] **[id: ${task.id}, ${task.status}]** ${task.subject}`);
      if (task.description) {
        lines.push(`  ${task.description}`);
      }
    }
  }
  lines.push("");

  // Pending TODOs
  lines.push("## Pending TODOs");
  lines.push("");
  if (todos.length === 0) {
    lines.push("No pending TODOs found.");
  } else {
    for (const todo of todos) {
      lines.push(`- [ ] ${todo.content}`);
    }
  }
  lines.push("");

  return lines.join("\n");
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

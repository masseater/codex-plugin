import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface SessionState {
  stopCount: number;
  prompted: boolean;
}

type DebugLog = (message: string, meta?: Record<string, unknown>) => void;

const DEFAULT_STATE: SessionState = { stopCount: 0, prompted: false };

function resolveStatePath(sessionId: string): string {
  const stateDir = process.env.XDG_STATE_HOME ?? `${process.env.HOME}/.local/state`;
  return `${stateDir}/claude-code-plugin/obsidian/${sessionId}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 状態ファイルの JSON を、型の合わない項目を既定値にして読む。
 * @param parsed - 状態ファイルを JSON として読んだ値
 * @returns セッションの状態
 */
function toSessionState(parsed: unknown): SessionState {
  if (!isRecord(parsed)) return { ...DEFAULT_STATE };
  const { stopCount, prompted } = parsed;
  return {
    stopCount: typeof stopCount === "number" ? stopCount : DEFAULT_STATE.stopCount,
    prompted: typeof prompted === "boolean" ? prompted : DEFAULT_STATE.prompted,
  };
}

function getSessionState(sessionId: string, debug?: DebugLog): SessionState {
  try {
    return toSessionState(JSON.parse(readFileSync(resolveStatePath(sessionId), "utf-8")));
  } catch (error) {
    // 初回の Stop では状態ファイルがまだ無い。壊れている場合も初期状態から数え直せば、
    // 促しが 1 回余分に出るだけで済む。
    debug?.("Session state not readable; using default", { error });
    return { ...DEFAULT_STATE };
  }
}

function updateSessionState(sessionId: string, patch: Partial<SessionState>): void {
  const filePath = resolveStatePath(sessionId);
  mkdirSync(dirname(filePath), { recursive: true });
  const current = getSessionState(sessionId);
  writeFileSync(filePath, JSON.stringify({ ...current, ...patch }));
}

export { getSessionState, updateSessionState };
export type { DebugLog, SessionState };

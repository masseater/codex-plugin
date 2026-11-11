import { readFileSync } from "node:fs";
import type { DebugLog } from "./session-state.ts";

const MIN_ASSISTANT_MESSAGES = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageOf(entry: Record<string, unknown>): Record<string, unknown> | undefined {
  return isRecord(entry.message) ? entry.message : undefined;
}

function isAssistant(
  entry: Record<string, unknown>,
  message: Record<string, unknown> | undefined,
): boolean {
  return entry.type === "assistant" || message?.role === "assistant";
}

function textOf(block: unknown): string {
  return isRecord(block) && typeof block.text === "string" ? block.text : "";
}

function contentText(content: unknown): string {
  return Array.isArray(content) ? content.map(textOf).join("").trim() : "";
}

/**
 * transcript の 1 行が、空でないテキストを持つ assistant メッセージかを判定する。
 * @param entry - JSON として読んだ transcript の 1 行
 * @returns 数えるべき assistant メッセージなら true
 */
function isAssistantTextEntry(entry: unknown): boolean {
  if (!isRecord(entry)) return false;
  const message = messageOf(entry);
  return isAssistant(entry, message) && contentText(message?.content).length > 0;
}

function parseLine(line: string, debug: DebugLog | undefined): unknown {
  try {
    return JSON.parse(line);
  } catch (error) {
    // 書き込み途中の行など、JSON として読めない行は数えないだけでよい（件数は目安のため）。
    debug?.("Skipping unparsable transcript line", { error });
    return undefined;
  }
}

function countAssistantMessages(transcriptPath: string, debug?: DebugLog): number {
  return readFileSync(transcriptPath, "utf-8")
    .split("\n")
    .filter((line) => line.trim())
    .filter((line) => isAssistantTextEntry(parseLine(line, debug))).length;
}

export { countAssistantMessages, MIN_ASSISTANT_MESSAGES };

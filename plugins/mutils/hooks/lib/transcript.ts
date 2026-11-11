/**
 * Claude Code の transcript（JSONL）から、最後の assistant メッセージの本文を読む。
 */
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { HookLogger } from "@r_masseater/cc-plugin-lib";
import { isRecord } from "./json-value.js";

using logger = HookLogger.fromFile(import.meta.filename);

/**
 * transcript_path の先頭の `~/` をホームディレクトリに展開し、絶対パスにする。
 *
 * @param transcriptPath - Stop 入力の transcript_path
 * @returns 絶対パス
 */
export function resolveTranscriptPath(transcriptPath: string): string {
  const expanded = transcriptPath.startsWith("~/")
    ? path.join(os.homedir(), transcriptPath.slice(2))
    : transcriptPath;
  return path.resolve(expanded);
}

function isTextType(type: unknown): boolean {
  return type === undefined || type === "text";
}

function isTextBlock(block: unknown): block is { text: string } {
  return (
    isRecord(block) && isTextType(block.type) && typeof block.text === "string" && block.text !== ""
  );
}

function joinTexts(texts: string[]): string | undefined {
  return texts.length > 0 ? texts.join("\n") : undefined;
}

/**
 * message.content からテキストを取り出す。文字列ならそのまま、配列なら text ブロックだけを連結する（thinking ブロックは飛ばす）。
 *
 * @param content - transcript の message.content
 * @returns テキスト。空なら undefined
 */
function contentText(content: unknown): string | undefined {
  if (typeof content === "string") return content.trim() ? content : undefined;
  if (!Array.isArray(content)) return undefined;
  return joinTexts(content.filter(isTextBlock).map((block) => block.text));
}

function isAssistantRole(role: unknown): boolean {
  return role === undefined || role === "assistant";
}

/**
 * transcript の 1 行から、assistant が書いたテキストを取り出す。
 * @param entry - JSON として読んだ transcript の 1 行
 * @returns テキスト。assistant のテキストでなければ undefined
 */
function assistantTextOf(entry: unknown): string | undefined {
  if (!isRecord(entry) || !isRecord(entry.message)) return undefined;
  if (!isAssistantRole(entry.message.role)) return undefined;
  return contentText(entry.message.content);
}

function parseTranscriptLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch (error) {
    // 書き込み途中の行は読めないことがある。通知は最善努力なので、その行を飛ばして遡れば足りる
    logger.debug(`Skipping unparsable transcript line: ${String(error)}`);
    return undefined;
  }
}

/**
 * transcript から最後の assistant メッセージの本文テキストを取り出す。
 * Stop 入力の last_assistant_message が無いときの代替。transcript は非同期に書かれるため、
 * 末尾から遡って text ブロックを持つ最初の assistant メッセージを使う（thinking ブロックは飛ばす）。
 *
 * @param transcriptPath - transcript ファイルの絶対パス
 * @returns 本文テキスト。見つからなければ undefined
 */
export function extractLastAssistantMessage(transcriptPath: string): string | undefined {
  const lines = readFileSync(transcriptPath, "utf-8")
    .split("\n")
    .filter((line) => line.trim());

  for (const line of lines.toReversed()) {
    const text = assistantTextOf(parseTranscriptLine(line));
    if (text !== undefined) return text;
  }
  return undefined;
}

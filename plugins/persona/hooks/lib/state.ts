import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const PERSONAS = ["planner", "worker"] as const;
export type Persona = (typeof PERSONAS)[number];

export function isPersona(value: string): value is Persona {
  return (PERSONAS as readonly string[]).includes(value);
}

export function resolveProjectDir(): string | undefined {
  return process.env.CLAUDE_PROJECT_DIR;
}

export function resolveStateFile(projectDir: string, sessionId: string): string {
  return `${projectDir}/.agents/tmp/persona/${sessionId}`;
}

export function readPersona(stateFile: string): Persona | undefined {
  if (!existsSync(stateFile)) {
    return undefined;
  }
  try {
    const raw = readFileSync(stateFile, "utf-8").trim();
    return isPersona(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function writePersona(stateFile: string, persona: Persona): void {
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, `${persona}\n`);
}

export function clearPersona(stateFile: string): void {
  rmSync(stateFile, { force: true });
}

export const PLANNER_PROMPT = `[Persona: planner]
あなたは「planner」として振る舞う。
- ユーザーの提案を鵜呑みにせず、設計上のトレードオフ・抜け漏れ・前提条件を批判的に検証する
- 実装の詳細やコード提案は控え、要件・スコープ・代替案の議論に集中する
- 曖昧な点は AskUserQuestion で深掘りする
- 詳細な振る舞いガイドが必要なら Skill ツールで \`persona:planner\` を読む`;

export const WORKER_PROMPT = `[Persona: worker]
あなたは「worker」として振る舞う。
- 与えられたタスクを忠実に最小スコープで実行する
- 設計議論・代替案の提示はせず、指示された範囲だけを完遂する
- 不明点があっても自己解決を優先し、ユーザーへの質問は最終手段
- 詳細な振る舞いガイドが必要なら Skill ツールで \`persona:worker\` を読む`;

export function personaPrompt(persona: Persona): string {
  return persona === "planner" ? PLANNER_PROMPT : WORKER_PROMPT;
}

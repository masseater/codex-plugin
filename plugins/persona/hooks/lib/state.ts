import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const PLANNER_PROMPT = `[Persona: planner]
設計議論の相手を務め、実装はしない。実装は計画の承認後に worker が行う。
- ユーザーの提案と判断の両方について、壊れるケース・暗黙の前提・より単純な代替案を示す
- 入出力の形式・ファイル構成・命名は具体例付きで会話の中で定義し、worker に判断を残さない。計画ファイルにはその結論を書き、コード片は書かない
- 議論が収束したら plan:define の形式で計画ファイルを作る`;

const WORKER_PROMPT = `[Persona: worker]
承認済みの計画や指示を、その範囲で最後まで実行する。
- 設計の再議論や指示にない変更はしない。範囲外で気づいたことは完了報告に 1 行で残す
- 細かな判断は既存のパターンに合わせて自分で決め、ユーザーの入力がないと進められないときだけ質問する`;

const IDEALIST_PROMPT = `[Persona: idealist]
理想の姿だけを定義する。制約・妥協・実現方法は planner と worker が扱うので、ここでは扱わない。
- 1 サイクル（理想を定義 → それが実現した世界にまだ残る不満を探す → 解消した理想に定義し直す）ごとに、ユーザーの反応を待つ。収束を宣言するのはユーザー
- 内容は大胆に、表現は箇条書きの plain な日本語で書く
- 各サイクルの理想と残った不満を .local-agents/idealist/ に記録する`;

const ORCHESTRATOR_PROMPT = `[Persona: orchestrator]
タスクを独立した単位に分けて Agent ツールで委譲し、依存順序と進捗を管理する。
- 自分ではファイルを編集しない。委譲先の作業と競合させないため。数回のツール呼び出しで終わる細かな単位は 1 つにまとめて委譲する
- 設計判断が要る場面では planner への切替を提案する
- 完了はテスト・型チェックなど具体的な確認手段の結果で判定する`;

const SPARRING_PROMPT = `[Persona: sparring]
ユーザーの壁打ち相手として、考えの整理と言語化を助ける。
- 思考を一段深める質問を 1 回に 1 つ投げ、自分の意見は呼び水として短く添える
- 結論やまとめを急がず、ユーザーが終了を示すまで深掘りを続ける`;

const PATHFINDER_PROMPT = `[Persona: pathfinder]
このリポジトリの事前知識を持たない新規参入者として作業し、知識なしで作業を完遂できる状態かを確かめる。
- つまずき（足りないドキュメント・原因を示さないエラー・暗黙の前提）は黙って回避せず、原因を .local-agents/pathfinder/ に記録する
- 原因に応じた恒久対処（ドキュメント追記・エラーメッセージ改善・スクリプト化）を、提案で止めずに実施する`;

type PersonaDefinition = {
  prompt: string;
  statuslineLabel: string;
};

const PERSONA_DEFINITIONS = {
  planner: { prompt: PLANNER_PROMPT, statuslineLabel: "🧭 planner" },
  worker: { prompt: WORKER_PROMPT, statuslineLabel: "🔨 worker" },
  idealist: { prompt: IDEALIST_PROMPT, statuslineLabel: "🪄 idealist" },
  orchestrator: { prompt: ORCHESTRATOR_PROMPT, statuslineLabel: "🎭 orchestrator" },
  sparring: { prompt: SPARRING_PROMPT, statuslineLabel: "🪞 sparring" },
  pathfinder: { prompt: PATHFINDER_PROMPT, statuslineLabel: "👣 pathfinder" },
} as const satisfies Record<string, PersonaDefinition>;

export type Persona = keyof typeof PERSONA_DEFINITIONS;
export function isPersona(value: string): value is Persona {
  return Object.hasOwn(PERSONA_DEFINITIONS, value);
}

export function resolveProjectDir(): string | undefined {
  return process.env.CLAUDE_PROJECT_DIR;
}

export function resolveStateFile(projectDir: string, sessionId: string): string {
  return `${projectDir}/.local-agents/tmp/persona/${sessionId}`;
}

// 最後にコンテキストへ注入した persona を記録するファイル。
// state ファイル本体は statusline.sh も読むので 1 行の persona 名のまま保ち、注入記録は別ファイルに分ける。
function resolveInjectedFile(stateFile: string): string {
  return `${stateFile}.injected`;
}

function readPersonaFile(file: string): Persona | undefined {
  if (!existsSync(file)) {
    return undefined;
  }
  const raw = readFileSync(file, "utf-8").trim();
  return isPersona(raw) ? raw : undefined;
}

export function readPersona(stateFile: string): Persona | undefined {
  return readPersonaFile(stateFile);
}

export function writePersona(stateFile: string, persona: Persona): void {
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, `${persona}\n`);
}

export function clearPersona(stateFile: string): void {
  rmSync(stateFile, { force: true });
  rmSync(resolveInjectedFile(stateFile), { force: true });
}

export function readInjectedPersona(stateFile: string): Persona | undefined {
  return readPersonaFile(resolveInjectedFile(stateFile));
}

export function markInjected(stateFile: string, persona: Persona): void {
  const injectedFile = resolveInjectedFile(stateFile);
  mkdirSync(dirname(injectedFile), { recursive: true });
  writeFileSync(injectedFile, `${persona}\n`);
}

function personaGuidePath(persona: Persona): string {
  return resolve(import.meta.dirname, "../../personas", `${persona}.md`);
}

export function personaPrompt(persona: Persona): string {
  return `${PERSONA_DEFINITIONS[persona].prompt}
- この persona はユーザーが明示的に選んだモードなので、個人ルール（~/AGENTS.md）と食い違う点はこの persona の方針を優先する
- 判断に迷ったら詳細ガイド ${personaGuidePath(persona)} を Read する`;
}

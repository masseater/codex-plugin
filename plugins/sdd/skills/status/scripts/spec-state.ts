#!/usr/bin/env bun
// specs/ 配下の各 spec の状態を読み取り、次に実行する skill を決める。
//
// Usage: spec-state.ts [specsDir=specs] [specName]
// 出力: SpecState の JSON 配列（specName を渡すとその spec だけ）

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PHASE_STATUSES = ["not_started", "in_progress", "completed", "rejected"] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number] | "unknown";

export type ResearchItem = { name: string; done: boolean };
export type PhaseFile = {
  number: number;
  name: string;
  file: string;
  status: PhaseStatus;
  tasksTotal: number;
  tasksDone: number;
};
export type NextAction = { command: string; reason: string };
export type SpecState = {
  name: string;
  status: PhaseStatus;
  hasSpecification: boolean;
  hasTechnicalDetails: boolean;
  research: ResearchItem[];
  unclearCount: number;
  plannedPhases: { number: number; name: string }[];
  phaseFiles: PhaseFile[];
  next: NextAction;
};

const PHASE_FILE_PATTERN = /^phase(\d+)-(.+)\.md$/;
const UNCLEAR_MARK = "**不明**";

function isKnownPhaseStatus(value: string): value is (typeof PHASE_STATUSES)[number] {
  return PHASE_STATUSES.some((status) => status === value);
}

export function readFrontmatterStatus(content: string): PhaseStatus {
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  const status = frontmatter?.[1]?.match(/^status:\s*(\S+)/m)?.[1];
  return status !== undefined && isKnownPhaseStatus(status) ? status : "unknown";
}

// 見出し `## <title>` から次の `## ` 見出しまでの本文を返す
export function extractSection(content: string, title: string): string {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

function parseCheckboxes(section: string): { label: string; done: boolean }[] {
  return [...section.matchAll(/^- \[([ xX])\] (.+)$/gm)].map((match) => ({
    done: match[1] !== " ",
    label: (match[2] ?? "").trim(),
  }));
}

export function parseResearch(overview: string): ResearchItem[] {
  return parseCheckboxes(extractSection(overview, "調査項目")).map(({ label, done }) => ({
    name: label.split(" — ")[0]?.trim() ?? label,
    done,
  }));
}

export function parsePlannedPhases(overview: string): { number: number; name: string }[] {
  const section = extractSection(overview, "Phase 構成");
  return [...section.matchAll(/^### Phase (\d+):\s*(.+)$/gm)].map((match) => ({
    number: Number(match[1]),
    name: (match[2] ?? "").trim(),
  }));
}

export function parsePhaseFile(fileName: string, content: string): PhaseFile | undefined {
  const match = fileName.match(PHASE_FILE_PATTERN);
  if (!match) return undefined;
  const tasks = parseCheckboxes(extractSection(content, "タスク"));
  return {
    number: Number(match[1]),
    name: match[2] ?? "",
    file: fileName,
    status: readFrontmatterStatus(content),
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((task) => task.done).length,
  };
}

function countUnclear(content: string): number {
  return content.split(UNCLEAR_MARK).length - 1;
}

export type SpecSummary = Omit<SpecState, "next">;

function isClosedStatus(status: string | undefined): boolean {
  return status === "completed" || status === "rejected";
}

function hasPendingTasks(file: PhaseFile): boolean {
  return file.tasksTotal === 0 || file.tasksDone < file.tasksTotal;
}

function researchStep(state: SpecSummary): NextAction | undefined {
  const pending = state.research.filter((item) => !item.done).length;
  if (pending === 0) return undefined;
  return {
    command: `/sdd:spec research ${state.name}`,
    reason: `未完了の調査項目が ${pending} 件ある`,
  };
}

function specificationStep(state: SpecSummary): NextAction | undefined {
  if (state.hasSpecification) return undefined;
  return { command: `/sdd:spec requirements ${state.name}`, reason: "specification.md がない" };
}

function technicalStep(state: SpecSummary): NextAction | undefined {
  if (state.hasTechnicalDetails) return undefined;
  return { command: `/sdd:spec technical ${state.name}`, reason: "technical-details.md がない" };
}

function clarifyStep(state: SpecSummary): NextAction | undefined {
  if (state.unclearCount === 0) return undefined;
  return {
    command: `/sdd:spec clarify ${state.name}`,
    reason: `**不明** が ${state.unclearCount} 箇所ある`,
  };
}

function phasePlanStep(state: SpecSummary): NextAction | undefined {
  if (state.plannedPhases.length > 0) return undefined;
  return {
    command: `/sdd:phase plan ${state.name}`,
    reason: `overview.md に Phase 構成がない。Phase 構成を決める前に /sdd:validate spec ${state.name} で仕様書を検証する`,
  };
}

/**
 * 1 つの Phase について次の作業を決める
 * @param spec - spec 名
 * @param number - Phase 番号
 * @param file - その Phase の phase ファイル（無ければ undefined）
 * @returns 次の作業。完了・却下済みの Phase なら undefined
 */
function phaseStep(
  spec: string,
  number: number,
  file: PhaseFile | undefined,
): NextAction | undefined {
  if (!file) {
    return {
      command: `/sdd:phase breakdown ${spec} ${number}`,
      reason: `Phase ${number} の phase ファイルがない`,
    };
  }
  if (isClosedStatus(file.status)) return undefined;
  return hasPendingTasks(file)
    ? {
        command: `/sdd:phase implement ${spec} ${number}`,
        reason: `Phase ${number} のタスクが ${file.tasksDone}/${file.tasksTotal} 完了`,
      }
    : {
        command: `/sdd:validate phase ${spec} ${number}`,
        reason: `Phase ${number} の全タスクが完了し、検証待ち`,
      };
}

function phasesStep(state: SpecSummary): NextAction | undefined {
  for (const planned of state.plannedPhases) {
    const file = state.phaseFiles.find((phase) => phase.number === planned.number);
    const step = phaseStep(state.name, planned.number, file);
    if (step) return step;
  }
  return undefined;
}

function completionStep(state: SpecSummary): NextAction | undefined {
  if (isClosedStatus(state.status)) return undefined;
  return {
    command: `overview.md の status を completed にする`,
    reason: "全 Phase が完了している",
  };
}

/** 次の作業を決める規則。前から順に、最初に当てはまったものを使う */
const NEXT_STEPS: ((state: SpecSummary) => NextAction | undefined)[] = [
  researchStep,
  specificationStep,
  technicalStep,
  clarifyStep,
  phasePlanStep,
  phasesStep,
  completionStep,
];

export function decideNext(state: SpecSummary): NextAction {
  for (const step of NEXT_STEPS) {
    const next = step(state);
    if (next) return next;
  }
  return { command: "/sdd:archive", reason: `spec が ${state.status}` };
}

function readIfExists(path: string): string[] {
  return existsSync(path) ? [readFileSync(path, "utf-8")] : [];
}

/**
 * phases/ の phase ファイルを読む
 * @param specDir - spec のディレクトリ
 * @returns phase ファイル（番号順）と、その本文
 */
function readPhaseFiles(specDir: string): { files: PhaseFile[]; contents: string[] } {
  const phasesDir = join(specDir, "phases");
  if (!existsSync(phasesDir)) return { files: [], contents: [] };
  const parsed = readdirSync(phasesDir)
    .toSorted()
    .flatMap((fileName) => {
      const content = readFileSync(join(phasesDir, fileName), "utf-8");
      const file = parsePhaseFile(fileName, content);
      return file ? [{ file, content }] : [];
    });
  return {
    files: parsed.map((entry) => entry.file).toSorted((a, b) => a.number - b.number),
    contents: parsed.map((entry) => entry.content),
  };
}

export function readSpecState(specsDir: string, name: string): SpecState | undefined {
  const specDir = join(specsDir, name);
  const overviewPath = join(specDir, "overview.md");
  if (!existsSync(overviewPath)) return undefined;

  const overview = readFileSync(overviewPath, "utf-8");
  const specificationPath = join(specDir, "specification.md");
  const technicalPath = join(specDir, "technical-details.md");
  const phases = readPhaseFiles(specDir);
  const docs = [
    overview,
    ...readIfExists(specificationPath),
    ...readIfExists(technicalPath),
    ...phases.contents,
  ];

  const state: SpecSummary = {
    name,
    status: readFrontmatterStatus(overview),
    hasSpecification: existsSync(specificationPath),
    hasTechnicalDetails: existsSync(technicalPath),
    research: parseResearch(overview),
    unclearCount: docs.reduce((sum, doc) => sum + countUnclear(doc), 0),
    plannedPhases: parsePlannedPhases(overview),
    phaseFiles: phases.files,
  };
  return { ...state, next: decideNext(state) };
}

export function listSpecNames(specsDir: string): string[] {
  if (!existsSync(specsDir)) return [];
  return readdirSync(specsDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith("_") && entry.name !== "research",
    )
    .map((entry) => entry.name)
    .toSorted();
}

export function readAllSpecStates(specsDir: string, specName?: string): SpecState[] {
  const names = specName ? [specName] : listSpecNames(specsDir);
  return names
    .map((name) => readSpecState(specsDir, name))
    .filter((state): state is SpecState => state !== undefined);
}

/* v8 ignore start */
if (import.meta.main) {
  const [specsDir = "specs", specName] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(readAllSpecStates(specsDir, specName), null, 2)}\n`);
}
/* v8 ignore stop */

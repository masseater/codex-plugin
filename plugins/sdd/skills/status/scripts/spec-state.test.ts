import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  extractSection,
  listSpecNames,
  parsePhaseFile,
  parsePlannedPhases,
  parseResearch,
  readAllSpecStates,
  readFrontmatterStatus,
} from "./spec-state.ts";

const OVERVIEW_TEMPLATE = readFileSync(
  join(import.meta.dirname, "..", "..", "spec", "assets", "templates", "overview-template.md"),
  "utf-8",
);
const PHASE_TEMPLATE = readFileSync(
  join(import.meta.dirname, "..", "..", "phase", "assets", "phase-template.md"),
  "utf-8",
);

let specsDir: string;

beforeEach(() => {
  specsDir = join(
    tmpdir(),
    `sdd-spec-state-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    "specs",
  );
  mkdirSync(specsDir, { recursive: true });
});

afterEach(() => {
  rmSync(join(specsDir, ".."), { recursive: true, force: true });
});

function writeSpec(name: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(specsDir, name, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
}

const overview = (opts: { status?: string; research?: string; phases?: string }) => `---
status: ${opts.status ?? "in_progress"}
---

# demo

## 調査項目

${opts.research ?? "なし"}

## Phase 構成

${opts.phases ?? ""}
`;

const phase = (status: string, tasks: string) => `---
status: ${status}
---

# Phase

## タスク

${tasks}

## 完了条件

- [ ] 全タスクが完了している
`;

const nextFor = (name: string) => readAllSpecStates(specsDir, name)[0]?.next.command;

describe("parsers", () => {
  test("reads status from frontmatter", () => {
    expect(readFrontmatterStatus("---\nstatus: completed\n---\n# x")).toBe("completed");
    expect(readFrontmatterStatus("# no frontmatter")).toBe("unknown");
    expect(readFrontmatterStatus("---\nstatus: done\n---\n")).toBe("unknown");
  });

  test("extracts a section up to the next h2", () => {
    expect(extractSection("## A\na\n## B\nb", "A").trim()).toBe("a");
    expect(extractSection("## A\na", "Z")).toBe("");
  });

  test("parses research checkboxes", () => {
    const text = overview({
      research: "- [ ] JWT 比較 — 認証方式の選定\n- [x] DB 選定 — 結論: PostgreSQL",
    });
    expect(parseResearch(text)).toEqual([
      { name: "JWT 比較", done: false },
      { name: "DB 選定", done: true },
    ]);
  });

  test("parses planned phases", () => {
    const text = overview({
      phases: "### Phase 1: 基盤\n- 目標: x\n\n### Phase 2: API\n- 目標: y",
    });
    expect(parsePlannedPhases(text)).toEqual([
      { number: 1, name: "基盤" },
      { number: 2, name: "API" },
    ]);
  });

  test("counts only task checkboxes, not completion criteria", () => {
    const parsed = parsePhaseFile(
      "phase1-core.md",
      phase("in_progress", "- [x] 1.1 a\n- [ ] 1.2 b"),
    );
    expect(parsed).toMatchObject({
      number: 1,
      name: "core",
      status: "in_progress",
      tasksTotal: 2,
      tasksDone: 1,
    });
    expect(parsePhaseFile("notes.md", "")).toBeUndefined();
  });

  test("templates are parseable", () => {
    expect(readFrontmatterStatus(OVERVIEW_TEMPLATE)).toBe("not_started");
    expect(readFrontmatterStatus(PHASE_TEMPLATE)).toBe("not_started");
    expect(parsePhaseFile("phase1-x.md", PHASE_TEMPLATE)?.tasksTotal).toBe(2);
  });
});

describe("listSpecNames", () => {
  test("skips archived and research directories", () => {
    for (const dir of ["b-spec", "a-spec", "_archived", "research"]) mkdirSync(join(specsDir, dir));
    expect(listSpecNames(specsDir)).toEqual(["a-spec", "b-spec"]);
  });

  test("returns empty when specs dir is missing", () => {
    expect(listSpecNames(join(specsDir, "missing"))).toEqual([]);
  });
});

describe("next action", () => {
  test("ignores directories without overview.md", () => {
    mkdirSync(join(specsDir, "empty"));
    expect(readAllSpecStates(specsDir)).toEqual([]);
  });

  test("fresh spec from the template asks to fill its research items", () => {
    writeSpec("demo", { "overview.md": OVERVIEW_TEMPLATE });
    expect(nextFor("demo")).toBe("/sdd:spec research demo");
  });

  test("pending research comes first", () => {
    writeSpec("demo", { "overview.md": overview({ research: "- [ ] JWT 比較 — 理由" }) });
    expect(nextFor("demo")).toBe("/sdd:spec research demo");
  });

  test("then requirements, technical details, clarify, plan", () => {
    writeSpec("demo", { "overview.md": overview({}) });
    expect(nextFor("demo")).toBe("/sdd:spec requirements demo");

    writeSpec("demo", { "specification.md": "# spec" });
    expect(nextFor("demo")).toBe("/sdd:spec technical demo");

    writeSpec("demo", { "technical-details.md": "**不明**: DB\n- 案 A\n- 案 B" });
    expect(nextFor("demo")).toBe("/sdd:spec clarify demo");

    writeSpec("demo", { "technical-details.md": "DB は PostgreSQL" });
    expect(nextFor("demo")).toBe("/sdd:phase plan demo");
  });

  test("walks the phase cycle: breakdown, implement, validate", () => {
    const phases = "### Phase 1: 基盤\n\n### Phase 2: API";
    writeSpec("demo", {
      "overview.md": overview({ phases }),
      "specification.md": "",
      "technical-details.md": "",
    });
    expect(nextFor("demo")).toBe("/sdd:phase breakdown demo 1");

    writeSpec("demo", {
      "phases/phase1-base.md": phase("in_progress", "- [x] 1.1 a\n- [ ] 1.2 b"),
    });
    expect(nextFor("demo")).toBe("/sdd:phase implement demo 1");

    writeSpec("demo", {
      "phases/phase1-base.md": phase("in_progress", "- [x] 1.1 a\n- [x] 1.2 b"),
    });
    expect(nextFor("demo")).toBe("/sdd:validate phase demo 1");

    writeSpec("demo", { "phases/phase1-base.md": phase("completed", "- [x] 1.1 a") });
    expect(nextFor("demo")).toBe("/sdd:phase breakdown demo 2");
  });

  test("asks to close the spec, then to archive it", () => {
    writeSpec("demo", {
      "overview.md": overview({ phases: "### Phase 1: 基盤" }),
      "specification.md": "",
      "technical-details.md": "",
      "phases/phase1-base.md": phase("completed", "- [x] 1.1 a"),
    });
    expect(nextFor("demo")).toBe("overview.md の status を completed にする");

    writeSpec("demo", {
      "overview.md": overview({ status: "completed", phases: "### Phase 1: 基盤" }),
    });
    expect(nextFor("demo")).toBe("/sdd:archive");
  });

  test("counts unclear marks across spec documents", () => {
    writeSpec("demo", {
      "overview.md": overview({}),
      "specification.md": "**不明**: a",
      "technical-details.md": "**不明**: b",
      "phases/phase1-x.md": phase("not_started", "- [ ] 1.1 **不明**: c"),
    });
    expect(readAllSpecStates(specsDir, "demo")[0]?.unclearCount).toBe(3);
  });
});

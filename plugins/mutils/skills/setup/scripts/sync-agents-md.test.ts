import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import {
  BEGIN,
  END,
  ensureImport,
  extractInside,
  main,
  type Paths,
  replaceInside,
  resolveAgentsMd,
  syncAgentsMd,
} from "./sync-agents-md.ts";

const dirs: string[] = [];

function setup(src: string): Paths {
  const dir = mkdtempSync(path.join(tmpdir(), "sync-agents-md-"));
  dirs.push(dir);
  const paths: Paths = {
    src: path.join(dir, "src.md"),
    target: path.join(dir, "AGENTS.md"),
    baseline: path.join(dir, "mutils", "baseline.md"),
    claudeMd: path.join(dir, ".claude", "CLAUDE.md"),
  };
  writeFileSync(paths.src, src);
  return paths;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs.length = 0;
});

describe("markers", () => {
  test("extract and replace keep text outside the markers", () => {
    const text = `before\n${BEGIN}\nold\n${END}\nafter\n`;
    expect(extractInside(text)).toBe("old");
    expect(replaceInside(text, "new")).toBe(`before\n${BEGIN}\nnew\n${END}\nafter\n`);
  });
});

describe("syncAgentsMd", () => {
  test("creates, then reports unchanged", () => {
    const paths = setup("a\nb\n");
    expect(syncAgentsMd(paths).status).toBe("created");
    expect(syncAgentsMd(paths).status).toBe("unchanged");
  });

  test("appends a block to an existing file without markers", () => {
    const paths = setup("a\n");
    writeFileSync(paths.target, "mine\n");
    expect(syncAgentsMd(paths).status).toBe("appended");
    expect(readFileSync(paths.target, "utf-8").startsWith("mine\n")).toBe(true);
  });

  test("merges user edits with upstream updates", () => {
    const paths = setup("a\nb\nc\n");
    syncAgentsMd(paths);
    writeFileSync(paths.target, readFileSync(paths.target, "utf-8").replace("a\n", "A\n"));
    writeFileSync(paths.src, "a\nb\nC\n");
    expect(syncAgentsMd(paths).status).toBe("merged");
    expect(extractInside(readFileSync(paths.target, "utf-8"))).toBe("A\nb\nC");
  });

  test("reports a conflict without writing", () => {
    const paths = setup("a\nb\nc\n");
    syncAgentsMd(paths);
    const edited = readFileSync(paths.target, "utf-8").replace("c\n", "mine\n");
    writeFileSync(paths.target, edited);
    writeFileSync(paths.src, "a\nb\ntheirs\n");
    const result = syncAgentsMd(paths);
    expect(result.status).toBe("conflict");
    expect(readFileSync(paths.target, "utf-8")).toBe(edited);
  });

  test("asks for a decision when the baseline is missing", () => {
    const paths = setup("a\n");
    writeFileSync(paths.target, `${BEGIN}\nmine\n${END}\n`);
    expect(syncAgentsMd(paths)).toEqual({ status: "needs-baseline", inside: "mine", src: "a" });
  });

  test("resolve writes the decision and updates the baseline", () => {
    const paths = setup("a\n");
    writeFileSync(paths.target, `${BEGIN}\nmine\n${END}\n`);
    resolveAgentsMd(paths, "decided\n");
    expect(extractInside(readFileSync(paths.target, "utf-8"))).toBe("decided");
    expect(readFileSync(paths.baseline, "utf-8")).toBe("a");
  });
});

describe("ensureImport", () => {
  test("adds the import once", () => {
    const paths = setup("a\n");
    expect(ensureImport(paths.claudeMd)).toBe(true);
    expect(ensureImport(paths.claudeMd)).toBe(false);
    expect(readFileSync(paths.claudeMd, "utf-8")).toBe("@~/AGENTS.md\n");
  });

  test("appends after existing content", () => {
    const paths = setup("a\n");
    ensureImport(paths.claudeMd);
    writeFileSync(paths.claudeMd, "# mine");
    ensureImport(paths.claudeMd);
    expect(readFileSync(paths.claudeMd, "utf-8")).toBe("# mine\n\n@~/AGENTS.md\n");
  });
});

describe("main", () => {
  let stdout = "";
  let stderr = "";

  function capture(): void {
    stdout = "";
    stderr = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      stdout += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderr += String(chunk);
      return true;
    });
  }

  function argsFor(paths: Paths, ...extra: string[]): string[] {
    return [
      "--src",
      paths.src,
      "--target",
      paths.target,
      "--baseline",
      paths.baseline,
      "--claude-md",
      paths.claudeMd,
      ...extra,
    ];
  }

  test("requires --src", () => {
    capture();
    expect(main([])).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  test("syncs, adds the import and reports it as JSON", () => {
    const paths = setup("a\n");
    capture();
    expect(main(argsFor(paths))).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ status: "created", importAdded: true });
    expect(readFileSync(paths.claudeMd, "utf-8")).toBe("@~/AGENTS.md\n");
  });

  test("writes the inside text for a decision when the baseline is missing", () => {
    const paths = setup("a\n");
    writeFileSync(paths.target, `${BEGIN}\nmine\n${END}\n`);
    capture();
    expect(main(argsFor(paths))).toBe(0);
    const out = JSON.parse(stdout);
    expect(out.status).toBe("needs-baseline");
    expect(readFileSync(out.files.inside, "utf-8")).toBe("mine\n");
    expect(out.files.src).toBe(paths.src);
  });

  test("writes the conflict text for a decision", () => {
    const paths = setup("a\nb\nc\n");
    syncAgentsMd(paths);
    writeFileSync(paths.target, readFileSync(paths.target, "utf-8").replace("c\n", "mine\n"));
    writeFileSync(paths.src, "a\nb\ntheirs\n");
    capture();
    expect(main(argsFor(paths))).toBe(0);
    const out = JSON.parse(stdout);
    expect(out.status).toBe("conflict");
    expect(readFileSync(out.files.conflict, "utf-8")).toContain("<<<<<<<");
  });

  test("--resolve confirms the decision", () => {
    const paths = setup("a\n");
    writeFileSync(paths.target, `${BEGIN}\nmine\n${END}\n`);
    const decided = path.join(path.dirname(paths.src), "decided.md");
    writeFileSync(decided, "decided\n");
    capture();
    expect(main(argsFor(paths, "--resolve", decided))).toBe(0);
    expect(JSON.parse(stdout).status).toBe("resolved");
    expect(extractInside(readFileSync(paths.target, "utf-8"))).toBe("decided");
  });

  test("defaults target, baseline and CLAUDE.md to paths under HOME", () => {
    const paths = setup("a\n");
    const home = path.dirname(paths.src);
    vi.stubEnv("HOME", home);
    capture();
    expect(main(["--src", paths.src])).toBe(0);
    expect(readFileSync(path.join(home, "AGENTS.md"), "utf-8")).toContain(BEGIN);
    expect(readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf-8")).toBe("@~/AGENTS.md\n");
  });
});

describe("syncAgentsMd edge cases", () => {
  test("separates the appended block with a blank line when the file lacks a trailing newline", () => {
    const paths = setup("a\n");
    writeFileSync(paths.target, "mine");
    syncAgentsMd(paths);
    expect(readFileSync(paths.target, "utf-8")).toBe(`mine\n\n${BEGIN}\na\n${END}\n`);
  });

  test("extractInside ignores a reversed marker pair", () => {
    expect(extractInside(`${END}\nx\n${BEGIN}`)).toBeUndefined();
  });
});

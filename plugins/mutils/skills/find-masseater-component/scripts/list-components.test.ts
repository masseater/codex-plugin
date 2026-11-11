import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

const spawnSync = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawnSync }));

import { filterComponents, formatComponents, main, parseComponentList } from "./list-components.ts";

const AGENTS_MD = `# x

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** \`alpha\`: Does alpha things.
- **agent** \`beta-agent\`: Reviews beta.
- **hook** \`gamma\`: PreToolUse (\`Bash\`)

<!-- END:component-list -->

- **skill** \`outside\`: not in the list
`;

describe("parseComponentList", () => {
  test("reads bullets between the markers only", () => {
    expect(parseComponentList("p", AGENTS_MD)).toEqual([
      { plugin: "p", type: "skill", name: "alpha", description: "Does alpha things." },
      { plugin: "p", type: "agent", name: "beta-agent", description: "Reviews beta." },
      { plugin: "p", type: "hook", name: "gamma", description: "PreToolUse (`Bash`)" },
    ]);
  });

  test("returns nothing without markers", () => {
    expect(parseComponentList("p", "- **skill** `a`: b")).toEqual([]);
  });
});

describe("filterComponents / formatComponents", () => {
  const components = parseComponentList("p", AGENTS_MD);

  test("matches any keyword case-insensitively", () => {
    expect(filterComponents(components, ["BETA", "gamma"]).map((c) => c.name)).toEqual([
      "beta-agent",
      "gamma",
    ]);
  });

  test("formats grouped by plugin with namespaced names", () => {
    const text = formatComponents(filterComponents(components, ["alpha"]));
    expect(text).toBe("## p\n- skill `p:alpha`: Does alpha things.");
  });

  test("says so when nothing matches", () => {
    expect(formatComponents([])).toBe("該当するコンポーネントはない。");
  });
});

describe("main", () => {
  const dirs: string[] = [];
  let stdout = "";
  let stderr = "";

  beforeEach(() => {
    stdout = "";
    stderr = "";
    spawnSync.mockReset().mockReturnValue({ status: 1, stdout: "" });
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      stdout += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderr += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  // plugins/<name>/AGENTS.md を持つリポジトリの形のディレクトリを作る
  function makeRepo(parent?: string): string {
    const root = parent ?? mkdtempSync(path.join(tmpdir(), "list-components-"));
    if (!parent) dirs.push(root);
    mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
    mkdirSync(path.join(root, "plugins", "p"), { recursive: true });
    writeFileSync(path.join(root, "plugins", "p", "AGENTS.md"), AGENTS_MD);
    // AGENTS.md の無い plugin と、ディレクトリでないエントリは読み飛ばされる
    mkdirSync(path.join(root, "plugins", "empty"));
    writeFileSync(path.join(root, "plugins", "file.txt"), "x");
    return root;
  }

  test("lists components of --root filtered by keywords", () => {
    const root = makeRepo();
    expect(main(["--root", root, "alpha"])).toBe(0);
    expect(stdout).toBe("## p\n- skill `p:alpha`: Does alpha things.\n");
  });

  test("uses the git root of the cwd when --root is absent", () => {
    const root = makeRepo();
    spawnSync.mockReturnValue({ status: 0, stdout: `${root}\n` });
    expect(main(["beta"])).toBe(0);
    expect(stdout).toContain("p:beta-agent");
  });

  test("falls back to the marketplace clone when the git root is not the repository", () => {
    const home = mkdtempSync(path.join(tmpdir(), "list-components-home-"));
    dirs.push(home);
    vi.stubEnv("HOME", home);
    makeRepo(path.join(home, ".claude", "plugins", "marketplaces", "masseater-plugins"));
    const notRepo = mkdtempSync(path.join(tmpdir(), "list-components-plain-"));
    dirs.push(notRepo);
    spawnSync.mockReturnValue({ status: 0, stdout: `${notRepo}\n` });
    expect(main(["gamma"])).toBe(0);
    expect(stdout).toContain("p:gamma");
  });

  test("fails with guidance when no repository is found", () => {
    const home = mkdtempSync(path.join(tmpdir(), "list-components-home-"));
    dirs.push(home);
    vi.stubEnv("HOME", home);
    expect(main([])).toBe(1);
    expect(stderr).toContain("--root");
  });
});

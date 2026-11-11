import { describe, expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  expandIntentionalViolations,
  getIntentionalViolationFilePath,
  RELATIVE_PATH,
  stripFrontmatter,
} from "./expand-intentional-violations.ts";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "expand-intentional-violations-"));
}

describe("expand-intentional-violations", () => {
  test("returns the expected file path", () => {
    const dir = makeTempDir();
    expect(getIntentionalViolationFilePath(dir)).toBe(join(dir, RELATIVE_PATH));
  });

  test("returns null when the file is missing", () => {
    const dir = makeTempDir();
    expect(expandIntentionalViolations(dir)).toBeNull();
  });

  test("strips yaml frontmatter when present", () => {
    const content = `---
name: note
description: desc
---

# Body
`;
    expect(stripFrontmatter(content)).toBe("# Body");
  });

  test("expands file content when the file exists", () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(
      join(dir, "docs", "devkit-intentional-violation.md"),
      `---
name: devkit-intentional-violation
description: desc
---

## ecosystem/bun-runtime

- Reason: Intentional Bun usage
`,
    );

    const expanded = expandIntentionalViolations(dir);
    expect(expanded).toContain("## Project-Specific Intentional Deviations");
    expect(expanded).toContain("Source: `docs/devkit-intentional-violation.md`");
    expect(expanded).toContain("## ecosystem/bun-runtime");
  });

  test("frontmatter が閉じていなければ全体を本文として扱う", () => {
    expect(stripFrontmatter("---\nname: x\n\n# Body\n")).toBe("---\nname: x\n\n# Body");
  });

  test("frontmatter が無ければ前後の空白だけ除く", () => {
    expect(stripFrontmatter("\n# Body\n\n")).toBe("# Body");
  });

  test("本文が空ならnullを返す", () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, RELATIVE_PATH), "---\nname: x\n---\n\n");
    expect(expandIntentionalViolations(dir)).toBeNull();
  });
});

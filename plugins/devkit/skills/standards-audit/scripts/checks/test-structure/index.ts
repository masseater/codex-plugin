import { DEFAULT_EXCLUDE_DIRS, isInExcludedDir } from "../../core/grep.ts";
import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

function isExcluded(filePath: string): boolean {
  return isInExcludedDir(filePath, DEFAULT_EXCLUDE_DIRS);
}

const meta: CheckMeta = {
  name: "test-structure",
  description:
    "Ensures tests use co-located .test.ts files instead of __tests__/ directories or .spec.ts files",
  references: ["test.md"],
  appliesTo: [],
  scope: "workspace",
};

// Check for __tests__/ and __test__/ directories
const TESTS_DIR_PATTERNS = ["**/__tests__/**/*", "**/__test__/**/*"];

// Check for .spec.ts and .spec.tsx files
const SPEC_PATTERNS = ["**/*.spec.ts", "**/*.spec.tsx"];

/** テストディレクトリの名前と、パス中のその区切りを探す正規表現（__tests__ を優先する） */
const TESTS_DIR_SEGMENTS: [RegExp, string][] = [
  [/(^|\/)__tests__(\/|$)/, "__tests__"],
  [/(^|\/)__test__(\/|$)/, "__test__"],
];

function scanFiles(rootDir: string, pattern: string): string[] {
  return [...new Bun.Glob(pattern).scanSync({ cwd: rootDir, absolute: false })].filter(
    (file) => !isExcluded(file),
  );
}

/**
 * ファイルのパスから、それを含む __tests__ / __test__ ディレクトリのパスを取り出す
 * @param file プロジェクトルートからのファイルパス
 * @returns ディレクトリのパス。含まれていなければ null
 */
function testsDirOf(file: string): string | null {
  for (const [pattern, dirName] of TESTS_DIR_SEGMENTS) {
    const match = pattern.exec(file);
    if (match) return `${file.slice(0, match.index + (match[1] ?? "").length)}${dirName}`;
  }
  return null;
}

async function run(ctx: ProjectContext): Promise<Finding[]> {
  const testsDirs = new Set(
    TESTS_DIR_PATTERNS.flatMap((pattern) => scanFiles(ctx.rootDir, pattern))
      .map(testsDirOf)
      .filter((dirPath): dirPath is string => dirPath !== null),
  );
  const dirFindings = [...testsDirs].map((dirPath): Finding => ({
    severity: "violation",
    rule: "test-structure",
    file: dirPath,
    line: null,
    message: `Rename ${dirPath} to co-located .test.ts files (no __tests__/ directories)`,
  }));
  const specFindings = SPEC_PATTERNS.flatMap((pattern) => scanFiles(ctx.rootDir, pattern)).map(
    (file): Finding => ({
      severity: "warning",
      rule: "test-structure",
      file,
      line: null,
      message: `Rename ${file} to use .test.ts instead of .spec.ts`,
    }),
  );
  return [...dirFindings, ...specFindings];
}

export { meta, run };

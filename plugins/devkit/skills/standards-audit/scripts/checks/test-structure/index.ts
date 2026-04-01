import type { CheckMeta, Finding, ProjectContext } from "../../core/types.ts";

const EXCLUDE_DIRS = ["node_modules", "dist", "build", ".next", "coverage"];

function isExcluded(filePath: string): boolean {
  for (const dir of EXCLUDE_DIRS) {
    if (filePath.startsWith(`${dir}/`) || filePath.includes(`/${dir}/`)) {
      return true;
    }
  }
  return false;
}

const meta: CheckMeta = {
  name: "test-structure",
  description:
    "Ensures tests use co-located .test.ts files instead of __tests__/ directories or .spec.ts files",
  references: ["test.md"],
  appliesTo: [],
  scope: "workspace",
};

async function run(ctx: ProjectContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Check for __tests__/ and __test__/ directories
  const testsDirPatterns = ["**/__tests__/**/*", "**/__test__/**/*"];
  const seenDirs = new Set<string>();

  for (const pattern of testsDirPatterns) {
    const glob = new Bun.Glob(pattern);
    for (const file of glob.scanSync({ cwd: ctx.rootDir, absolute: false })) {
      if (isExcluded(file)) continue;

      // Extract the __tests__ or __test__ directory path by finding the segment
      const testsSegmentIndex = file.search(/\/__tests__(\/|$)|^__tests__(\/|$)/);
      const testSegmentIndex = file.search(/\/__test__(\/|$)|^__test__(\/|$)/);
      const segmentIndex = testsSegmentIndex !== -1 ? testsSegmentIndex : testSegmentIndex;
      if (segmentIndex === -1) continue;

      const isLeadingSlash = segmentIndex > 0;
      const segmentStart = isLeadingSlash ? segmentIndex + 1 : segmentIndex;
      const isDirNameTests = file.slice(segmentStart).startsWith("__tests__");
      const dirName = isDirNameTests ? "__tests__" : "__test__";
      const dirPath = isLeadingSlash ? `${file.slice(0, segmentIndex)}/${dirName}` : dirName;

      if (seenDirs.has(dirPath)) continue;
      seenDirs.add(dirPath);

      findings.push({
        severity: "violation",
        rule: "test-structure",
        file: dirPath,
        line: null,
        message: `Rename ${dirPath} to co-located .test.ts files (no __tests__/ directories)`,
      });
    }
  }

  // Check for .spec.ts and .spec.tsx files
  const specPatterns = ["**/*.spec.ts", "**/*.spec.tsx"];

  for (const pattern of specPatterns) {
    const glob = new Bun.Glob(pattern);
    for (const file of glob.scanSync({ cwd: ctx.rootDir, absolute: false })) {
      if (isExcluded(file)) continue;

      findings.push({
        severity: "warning",
        rule: "test-structure",
        file,
        line: null,
        message: `Rename ${file} to use .test.ts instead of .spec.ts`,
      });
    }
  }

  return findings;
}

export { meta, run };

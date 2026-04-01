type Severity = "violation" | "warning";

type Finding = {
  severity: Severity;
  /** Check module name (directory name under checks/) */
  rule: string;
  /** Relative file path from project root, or null for project-level */
  file: string | null;
  /** Line number, or null */
  line: number | null;
  /** Concise, actionable message: what is wrong + how to fix */
  message: string;
};

type ProjectType = "web" | "backend" | "cli";

type PackageJsonSubset = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[];
};

type ProjectContext = {
  /** Absolute path to the project/workspace root */
  rootDir: string;
  /** Display label (e.g., "(root)" or "apps/web") */
  label: string;
  /** Detected project types */
  types: ProjectType[];
  /** Parsed package.json content (null if missing) */
  packageJson: PackageJsonSubset | null;
};

type WorkspaceInfo = {
  /** Absolute path to the monorepo/project root */
  rootDir: string;
  /** Whether this is a monorepo */
  isMonorepo: boolean;
  /** All audit scopes (single-element array for non-monorepo) */
  scopes: ProjectContext[];
};

type CheckMeta = {
  name: string;
  description: string;
  /** Which reference file(s) this check covers */
  references: string[];
  /** Which project types this check applies to (empty = all) */
  appliesTo: ProjectType[];
  /** Where this check runs */
  scope: "root" | "workspace" | "all";
};

type GrepMatch = {
  file: string;
  line: number;
  content: string;
};

export type {
  CheckMeta,
  Finding,
  GrepMatch,
  PackageJsonSubset,
  ProjectContext,
  ProjectType,
  Severity,
  WorkspaceInfo,
};

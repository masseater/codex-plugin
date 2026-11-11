import type { Finding, ProjectContext, WorkspaceInfo } from "./types.ts";

type ScopeResult = {
  scope: ProjectContext;
  findings: Finding[];
};

type AuditResult = {
  workspace: WorkspaceInfo;
  scopeResults: ScopeResult[];
};

function formatLocation(f: Finding): string {
  if (f.file && f.line != null) return `\`${f.file}:${f.line}\``;
  if (f.file) return `\`${f.file}\``;
  return "(project-level)";
}

function fileKey(finding: Finding): string {
  return finding.file ?? "\uffff";
}

function lineKey(finding: Finding): number {
  return finding.line ?? Number.MAX_SAFE_INTEGER;
}

function compareFindings(a: Finding, b: Finding): number {
  const fileA = fileKey(a);
  const fileB = fileKey(b);
  return fileA === fileB ? lineKey(a) - lineKey(b) : fileA.localeCompare(fileB);
}

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].toSorted(compareFindings);
}

function severitySection(findings: Finding[], heading: string): string[] {
  if (findings.length === 0) return [];
  return [
    heading,
    "",
    ...sortFindings(findings).map((f) => `- [${f.rule}] ${formatLocation(f)} — ${f.message}`),
    "",
  ];
}

function bySeverity(findings: Finding[]): { violations: Finding[]; warnings: Finding[] } {
  return {
    violations: findings.filter((f) => f.severity === "violation"),
    warnings: findings.filter((f) => f.severity === "warning"),
  };
}

function formatScopeFindings(findings: Finding[], headingPrefix: string): string[] {
  const { violations, warnings } = bySeverity(findings);
  return [
    ...severitySection(violations, `${headingPrefix} Violations`),
    ...severitySection(warnings, `${headingPrefix} Warnings`),
  ];
}

function singleScopeLines({ scope, findings }: ScopeResult): string[] {
  const typeStr = scope.types.length > 0 ? scope.types.join(", ") : "unknown";
  const header = [`Type: ${typeStr}`, ""];
  if (findings.length === 0) return [...header, "All checks passed."];
  const { violations, warnings } = bySeverity(findings);
  return [
    ...header,
    ...formatScopeFindings(findings, "###"),
    `Summary: ${violations.length} violations, ${warnings.length} warnings`,
  ];
}

// Sort: (root) first, then alphabetical
function compareScopes(a: ScopeResult, b: ScopeResult): number {
  if (a.scope.label === "(root)") return -1;
  if (b.scope.label === "(root)") return 1;
  return a.scope.label.localeCompare(b.scope.label);
}

function scopeHeading(scope: ProjectContext): string {
  const typeStr = scope.types.join(", ");
  return typeStr ? `### ${scope.label} (${typeStr})` : `### ${scope.label}`;
}

function monorepoScopeLines({ scope, findings }: ScopeResult): string[] {
  const body =
    findings.length === 0 ? ["All checks passed.", ""] : formatScopeFindings(findings, "####");
  return [scopeHeading(scope), "", ...body];
}

function monorepoLines(scopeResults: ScopeResult[]): string[] {
  const sorted = scopeResults.toSorted(compareScopes);
  const { violations, warnings } = bySeverity(sorted.flatMap((result) => result.findings));
  return [
    "Type: monorepo",
    "",
    ...sorted.flatMap(monorepoScopeLines),
    `Summary: ${violations.length} violations, ${warnings.length} warnings across ${sorted.length} scopes`,
  ];
}

function formatReport(result: AuditResult): string {
  const { workspace, scopeResults } = result;
  return [
    "## Standards Audit Report",
    "",
    `Project: ${workspace.rootDir}`,
    ...(workspace.isMonorepo ? monorepoLines(scopeResults) : singleScopeLines(scopeResults[0]!)),
  ].join("\n");
}

export { formatReport };
export type { AuditResult, ScopeResult };

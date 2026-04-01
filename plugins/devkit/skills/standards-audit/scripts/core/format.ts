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

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].toSorted((a, b) => {
    const fileA = a.file ?? "\uffff";
    const fileB = b.file ?? "\uffff";
    if (fileA !== fileB) return fileA.localeCompare(fileB);
    const lineA = a.line ?? Number.MAX_SAFE_INTEGER;
    const lineB = b.line ?? Number.MAX_SAFE_INTEGER;
    return lineA - lineB;
  });
}

function formatScopeFindings(findings: Finding[], headingPrefix: string): string[] {
  const lines: string[] = [];
  const violations = findings.filter((f) => f.severity === "violation");
  const warnings = findings.filter((f) => f.severity === "warning");

  if (violations.length > 0) {
    lines.push(`${headingPrefix} Violations`);
    lines.push("");
    for (const f of sortFindings(violations)) {
      lines.push(`- [${f.rule}] ${formatLocation(f)} — ${f.message}`);
    }
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push(`${headingPrefix} Warnings`);
    lines.push("");
    for (const f of sortFindings(warnings)) {
      lines.push(`- [${f.rule}] ${formatLocation(f)} — ${f.message}`);
    }
    lines.push("");
  }

  return lines;
}

function formatReport(result: AuditResult): string {
  const { workspace, scopeResults } = result;
  const lines: string[] = [];

  lines.push("## Standards Audit Report");
  lines.push("");
  lines.push(`Project: ${workspace.rootDir}`);

  if (!workspace.isMonorepo) {
    const { scope, findings } = scopeResults[0]!;
    const typeStr = scope.types.length > 0 ? scope.types.join(", ") : "unknown";
    lines.push(`Type: ${typeStr}`);
    lines.push("");

    if (findings.length === 0) {
      lines.push("All checks passed.");
      return lines.join("\n");
    }

    lines.push(...formatScopeFindings(findings, "###"));

    const violations = findings.filter((f: Finding) => f.severity === "violation");
    const warnings = findings.filter((f: Finding) => f.severity === "warning");
    lines.push(`Summary: ${violations.length} violations, ${warnings.length} warnings`);
  } else {
    lines.push("Type: monorepo");
    lines.push("");

    let totalViolations = 0;
    let totalWarnings = 0;

    // Sort: (root) first, then alphabetical
    const sorted = [...scopeResults].toSorted((a, b) => {
      if (a.scope.label === "(root)") return -1;
      if (b.scope.label === "(root)") return 1;
      return a.scope.label.localeCompare(b.scope.label);
    });

    for (const { scope, findings } of sorted) {
      const typeStr = scope.types.join(", ");
      const heading = typeStr ? `### ${scope.label} (${typeStr})` : `### ${scope.label}`;
      lines.push(heading);
      lines.push("");

      const violations = findings.filter((f) => f.severity === "violation");
      const warnings = findings.filter((f) => f.severity === "warning");
      totalViolations += violations.length;
      totalWarnings += warnings.length;

      if (findings.length === 0) {
        lines.push("All checks passed.");
        lines.push("");
      } else {
        lines.push(...formatScopeFindings(findings, "####"));
      }
    }

    lines.push(
      `Summary: ${totalViolations} violations, ${totalWarnings} warnings across ${sorted.length} scopes`,
    );
  }

  return lines.join("\n");
}

export { formatReport };
export type { AuditResult, ScopeResult };

#!/usr/bin/env bun
import { join } from "node:path";
import { buildWorkspaceInfo } from "./core/context.ts";
import type { AuditResult } from "./core/format.ts";
import { formatReport } from "./core/format.ts";
import { discoverChecks, runChecksForScope } from "./core/runner.ts";
import type { Finding } from "./core/types.ts";

async function audit(targetDir: string): Promise<AuditResult> {
  const workspace = buildWorkspaceInfo(targetDir);

  // Non-Node.js project: return early with empty findings
  if (!workspace.scopes[0]?.packageJson) {
    return {
      workspace,
      scopeResults: [{ scope: workspace.scopes[0]!, findings: [] }],
    };
  }

  const checksDir = join(import.meta.dir, "checks");
  const checks = await discoverChecks(checksDir);

  const scopeResults = await Promise.all(
    workspace.scopes.map(async (scope, index) => {
      const isRoot = index === 0;
      const findings = await runChecksForScope(scope, checks, isRoot);
      return { scope, findings };
    }),
  );

  return { workspace, scopeResults };
}

// Standalone execution
if (import.meta.main) {
  const targetDir = process.argv[2] ?? process.cwd();

  const result = await audit(targetDir);
  const report = formatReport(result);
  console.log(report);

  const violations = result.scopeResults.flatMap((sr) =>
    sr.findings.filter((f: Finding) => f.severity === "violation"),
  );
  if (violations.length > 0) {
    process.exit(1);
  }
}

export { audit };

import type { CheckMeta, Finding, ProjectContext } from "./types.ts";

type CheckModule = {
  meta: CheckMeta;
  run: (ctx: ProjectContext) => Promise<Finding[]>;
};

async function discoverChecks(checksDir: string): Promise<Map<string, CheckModule>> {
  const checks = new Map<string, CheckModule>();
  const glob = new Bun.Glob("*/index.ts");

  for (const entry of glob.scanSync({ cwd: checksDir })) {
    const checkName = entry.split("/")[0]!;
    const modulePath = `${checksDir}/${entry}`;

    try {
      const mod = await import(modulePath);
      if (!mod.meta || !mod.run) {
        console.error(`[standards-audit] Check ${checkName} missing meta or run export, skipping`);
        continue;
      }
      checks.set(checkName, { meta: mod.meta, run: mod.run });
    } catch (err) {
      console.error(`[standards-audit] Failed to load check ${checkName}: ${err}`);
    }
  }

  return checks;
}

async function runChecksForScope(
  scope: ProjectContext,
  checks: Map<string, CheckModule>,
  isRoot: boolean,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  const tasks = [...checks.entries()].map(async ([name, check]) => {
    // Filter by appliesTo
    if (check.meta.appliesTo.length > 0) {
      const hasMatch = check.meta.appliesTo.some((t) =>
        scope.types.includes(t as ProjectContext["types"][number]),
      );
      if (!hasMatch) return [];
    }

    // Filter by scope
    if (check.meta.scope === "root" && !isRoot) return [];
    if (check.meta.scope === "workspace" && isRoot) return [];

    try {
      return await check.run(scope);
    } catch (error) {
      return [
        {
          severity: "warning" as const,
          rule: name,
          file: null,
          line: null,
          message: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      ];
    }
  });

  const results = await Promise.all(tasks);
  for (const result of results) {
    findings.push(...result);
  }

  return findings;
}

export { discoverChecks, runChecksForScope };
export type { CheckModule };

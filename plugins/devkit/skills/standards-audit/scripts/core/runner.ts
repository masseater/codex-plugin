import type { CheckMeta, Finding, ProjectContext } from "./types.ts";

type CheckModule = {
  meta: CheckMeta;
  run: (ctx: ProjectContext) => Promise<Finding[]>;
};

/**
 * check のモジュールを 1 つ読み込む
 * @param checksDir checks/ ディレクトリ
 * @param entry checks/ からの index.ts のパス
 * @returns check の名前とモジュール。読み込めないか meta / run が無ければ null
 */
async function loadCheck(checksDir: string, entry: string): Promise<[string, CheckModule] | null> {
  const checkName = entry.split("/")[0]!;
  try {
    const mod = await import(`${checksDir}/${entry}`);
    if (!mod.meta || !mod.run) {
      console.error(`[standards-audit] Check ${checkName} missing meta or run export, skipping`);
      return null;
    }
    return [checkName, { meta: mod.meta, run: mod.run }];
  } catch (err) {
    // 1 つの check が読み込めなくても他の check は実行できるので、警告して飛ばす
    console.error(`[standards-audit] Failed to load check ${checkName}: ${String(err)}`);
    return null;
  }
}

async function discoverChecks(checksDir: string): Promise<Map<string, CheckModule>> {
  const checks = new Map<string, CheckModule>();
  for (const entry of new Bun.Glob("*/index.ts").scanSync({ cwd: checksDir })) {
    const loaded = await loadCheck(checksDir, entry);
    if (loaded) checks.set(...loaded);
  }
  return checks;
}

// Filter by appliesTo
function matchesProjectTypes(meta: CheckMeta, scope: ProjectContext): boolean {
  return meta.appliesTo.length === 0 || meta.appliesTo.some((t) => scope.types.includes(t));
}

// Filter by scope: root はルートだけ、workspace はワークスペースだけ、all はどちらでも
function matchesScope(checkScope: CheckMeta["scope"], isRoot: boolean): boolean {
  return checkScope === "all" || (checkScope === "root") === isRoot;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runCheck(
  name: string,
  check: CheckModule,
  scope: ProjectContext,
): Promise<Finding[]> {
  try {
    return await check.run(scope);
  } catch (error) {
    return [
      {
        severity: "warning" as const,
        rule: name,
        file: null,
        line: null,
        message: `Check failed: ${errorMessage(error)}`,
      },
    ];
  }
}

async function runChecksForScope(
  scope: ProjectContext,
  checks: Map<string, CheckModule>,
  isRoot: boolean,
): Promise<Finding[]> {
  const applicable = [...checks.entries()].filter(
    ([, check]) => matchesProjectTypes(check.meta, scope) && matchesScope(check.meta.scope, isRoot),
  );
  const results = await Promise.all(
    applicable.map(([name, check]) => runCheck(name, check, scope)),
  );
  return results.flat();
}

export { discoverChecks, runChecksForScope };
export type { CheckModule };

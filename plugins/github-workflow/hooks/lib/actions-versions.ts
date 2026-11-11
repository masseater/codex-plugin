import { readFileSync } from "node:fs";
import { parse } from "yaml";

type ActionRef = {
  path: string;
  repo: string;
  current: string;
};

type OutdatedAction = {
  name: string;
  current: string;
  latest: string;
};

function isGitHubWorkflowFile(filePath: string): boolean {
  return /\.github\//.test(filePath) && /\.ya?ml$/.test(filePath);
}

function parseMajorVersion(version: string): number | null {
  const match = version.match(/^v(\d+)/);
  return match ? Number(match[1]) : null;
}

function readWorkflowContent(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return undefined;
  }
}

function parseActionRef(uses: string): ActionRef | null {
  const match = uses.match(/^([^@\s]+)@(v\d+(?:\.\d+)*)$/);
  if (!match) return null;

  const path = match[1]!;
  const current = match[2]!;
  const parts = path.split("/");
  if (parts.length < 2) return null;

  return { path, repo: `${parts[0]}/${parts[1]}`, current };
}

function collectUsesValues(node: unknown): string[] {
  const values: string[] = [];
  if (node === null || node === undefined || typeof node !== "object") return values;

  if (Array.isArray(node)) {
    for (const item of node) {
      values.push(...collectUsesValues(item));
    }
    return values;
  }

  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key === "uses" && typeof value === "string") {
      values.push(value);
    } else {
      values.push(...collectUsesValues(value));
    }
  }
  return values;
}

function extractActionRefs(content: string): ActionRef[] {
  let doc: unknown;
  try {
    doc = parse(content);
  } catch {
    return [];
  }

  const usesValues = collectUsesValues(doc);
  const seen = new Set<string>();
  const refs: ActionRef[] = [];

  for (const uses of usesValues) {
    const ref = parseActionRef(uses);
    if (!ref) continue;

    const key = `${ref.path}@${ref.current}`;
    if (seen.has(key)) continue;
    seen.add(key);

    refs.push(ref);
  }

  return refs;
}

function pickMaxMajorVersion(tags: string[]): string | null {
  let maxMajor = -1;
  for (const tag of tags) {
    const major = parseMajorVersion(tag);
    if (major !== null && major > maxMajor) {
      maxMajor = major;
    }
  }
  return maxMajor >= 0 ? `v${maxMajor}` : null;
}

async function fetchLatestMajorVersion(repo: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["gh", "api", `repos/${repo}/tags?per_page=50`, "--jq", ".[].name"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;

    const stdout = await new Response(proc.stdout).text();
    const tags = stdout.trim().split("\n").filter(Boolean);

    return pickMaxMajorVersion(tags);
  } catch {
    return null;
  }
}

async function findOutdatedActions(refs: ActionRef[]): Promise<OutdatedAction[]> {
  const uniqueRepos = [...new Set(refs.map((r) => r.repo))];

  const latestByRepo = new Map<string, string>();
  const results = await Promise.all(
    uniqueRepos.map(async (repo) => {
      const latest = await fetchLatestMajorVersion(repo);
      return { repo, latest };
    }),
  );
  for (const { repo, latest } of results) {
    if (latest) latestByRepo.set(repo, latest);
  }

  const outdated: OutdatedAction[] = [];
  for (const ref of refs) {
    const latest = latestByRepo.get(ref.repo);
    if (!latest) continue;

    const currentMajor = parseMajorVersion(ref.current);
    const latestMajor = parseMajorVersion(latest);

    if (currentMajor === null || latestMajor === null) continue;
    if (currentMajor >= latestMajor) continue;

    outdated.push({ name: ref.path, current: ref.current, latest });
  }

  return outdated;
}

function formatSuggestions(outdated: OutdatedAction[]): string {
  const lines = ["[GitHub Actions Update] Outdated actions detected:", ""];

  for (const action of outdated) {
    lines.push(`- ${action.name}: ${action.current} → ${action.latest}`);
  }

  lines.push("");
  lines.push("Update these to the latest major versions.");

  return lines.join("\n");
}

export {
  collectUsesValues,
  extractActionRefs,
  fetchLatestMajorVersion,
  findOutdatedActions,
  formatSuggestions,
  isGitHubWorkflowFile,
  parseActionRef,
  parseMajorVersion,
  pickMaxMajorVersion,
  readWorkflowContent,
};
export type { ActionRef, OutdatedAction };

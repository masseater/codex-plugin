import type { ProjectType } from "./types.ts";

/** プロジェクトの種類と、それを示す依存パッケージ */
const PROJECT_TYPE_SIGNALS: [string, ProjectType][] = [
  ["next", "web"],
  ["hono", "backend"],
  ["citty", "cli"],
];

/**
 * Signal-based project type detection from combined deps
 * @param allDeps dependencies と devDependencies をまとめたもの
 * @returns 検出したプロジェクトの種類
 */
export function detectProjectTypes(allDeps: Record<string, string>): ProjectType[] {
  return PROJECT_TYPE_SIGNALS.filter(([dep]) => allDeps[dep]).map(([, type]) => type);
}

#!/usr/bin/env bun
import { basename } from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  type AgnixDiagnostic,
  type AgnixRunResult,
  isAgnixAvailable,
  parseAgnixJson,
  runAgnix,
} from "../lib/agnix-runner.js";

using logger = HookLogger.fromFile(import.meta.filename);

export const CONFIG_FILE_PATTERNS = [
  /(?:^|\/)(CLAUDE|AGENTS|SKILL)\.md$/,
  /(?:^|\/)(hooks|plugin|settings)\.json$/,
  /\.mcp\.json$/,
  /(?:^|\/)\.claude\/rules\/.*\.md$/,
];

export const isConfigFile = (filePath: string): boolean =>
  CONFIG_FILE_PATTERNS.some((pattern) => pattern.test(filePath));

export const formatDiagnostic = (d: AgnixDiagnostic): string => {
  const rule = d.rule ? ` [${d.rule}]` : "";
  const suggestion = d.suggestion ? `（${d.suggestion}）` : "";
  return `- ${d.line}:${d.column} ${d.level}${rule} ${d.message}${suggestion}`;
};

// モデルに渡す lint 結果。修正コマンドを添えて、そのまま直せるようにする
export const formatLintContext = (filePath: string, body: string): string =>
  [
    `agnix が ${basename(filePath)} で指摘した内容:`,
    body.trim(),
    `安全な自動修正は \`agnix --fix-safe ${filePath}\` で適用できる。`,
  ].join("\n");

const diagnosticsBody = (diagnostics: AgnixDiagnostic[]): string | null =>
  diagnostics.length === 0 ? null : diagnostics.map(formatDiagnostic).join("\n");

const failureOutput = (result: AgnixRunResult): string | null =>
  [result.stdout, result.stderr].filter((s) => s.trim() !== "").join("\n") || null;

/**
 * agnix の実行結果から、モデルに返す指摘の本文を作る。指摘が無ければ null。
 * agnix は warning だけのときも終了コード 0 を返すので、終了コードではなく JSON の diagnostics で判定する。
 *
 * @param result - `agnix --format json` の実行結果
 * @param log - 解析の失敗を記録するロガー
 * @returns モデルに返す指摘の本文。指摘が無ければ null
 */
export const buildLintBody = (
  result: AgnixRunResult,
  log: Pick<HookLogger, "debug" | "warn">,
): string | null => {
  const diagnostics = parseAgnixJson(result.stdout, log);
  if (diagnostics !== null) {
    return diagnosticsBody(diagnostics);
  }
  if (result.exitCode !== 0) {
    // JSON を出せずに失敗した（agnix 自体のエラー）。原因を Claude が判断できるよう出力をそのまま渡す
    return failureOutput(result);
  }
  // 終了コード 0 なのに JSON を読めない: agnix の出力形式が変わった可能性がある。
  // 編集自体は成功しているので hook は何も返さず、調査できるよう warn で残す
  log.warn(`agnix exited 0 but output could not be parsed: ${result.stdout.slice(0, 200)}`);
  return null;
};

const hook = defineHook({
  trigger: {
    PostToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const filePath = context.input.tool_input.file_path;

    if (!isConfigFile(filePath)) {
      return context.success({});
    }

    if (!isAgnixAvailable(logger)) {
      logger.debug("agnix not found in PATH, skipping");
      return context.success({});
    }

    const body = buildLintBody(runAgnix(["--format", "json", filePath], logger), logger);

    if (body === null) {
      logger.debug(`agnix: no issues found in ${basename(filePath)}`);
      return context.success({});
    }

    logger.info(`agnix: issues found in ${basename(filePath)}`);
    return context.json({
      event: "PostToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PostToolUse" as const,
          additionalContext: formatLintContext(filePath, body),
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

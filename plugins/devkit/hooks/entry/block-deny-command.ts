#!/usr/bin/env bun
/**
 * 禁止されたコマンドの使用を検出してブロックするフック
 *
 * 環境変数 DEVKIT_ENFORCE_TOOLS が設定されている場合のみ有効
 * 禁止コマンドのリストは DENY_RULES で定義し、拡張可能な構造
 */
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

/** 禁止コマンドのルール定義 */
export type DenyRule = {
  /** コマンド名（正規表現パターン） */
  pattern: RegExp;
  /** 表示名 */
  name: string;
  /** 代替として推奨するコマンド */
  alternative: string;
  /** なぜこのコマンドが禁止されているか */
  why: string;
};

/**
 * 禁止コマンドルール一覧
 * 新しいルールを追加する場合はここに追記する
 */
export const DENY_RULES: readonly DenyRule[] = [
  {
    pattern: /^npx\s/,
    name: "npx",
    alternative: "pnpx",
    why: "lockfile を参照せず任意のバージョンを取得しうるため",
  },
  {
    pattern: /^npm\s/,
    name: "npm",
    alternative: "pnpm",
    why: "プロジェクトのパッケージマネージャーと食い違い、lockfile が不整合になるため",
  },
  {
    pattern: /^tsc\b/,
    name: "tsc",
    alternative: "tsgo",
    why: "型チェックは tsgo に統一しており、tsc は設定済みのツールチェーンと合わないため",
  },
] as const;

/** 環境変数名 */
const ENV_KEY = "DEVKIT_ENFORCE_TOOLS" as const;

/**
 * コマンドが禁止ルールに違反しているかチェック
 *
 * @param command - チェック対象のコマンド文字列
 * @returns マッチした最初の禁止ルール、なければ undefined
 */
export const findViolation = (command: string): DenyRule | undefined => {
  return DENY_RULES.find((rule) => rule.pattern.test(command));
};

/**
 * deny 時に Claude へ渡す理由文を組み立てる
 *
 * @param rule - 違反した禁止ルール
 * @returns 理由と代替コマンドを含む 1 行の文
 */
export const formatDenyReason = (rule: DenyRule): string =>
  `${rule.name} はこのプロジェクトでは使わない（${rule.why}）。代わりに \`${rule.alternative}\` を使う。`;

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Bash: true,
    },
  },
  run: wrapRun(logger, (context) => {
    // 環境変数が設定されていない場合は無効
    if (!process.env[ENV_KEY]) {
      logger.debug(`${ENV_KEY} is not set, skipping`);
      return context.success({});
    }

    const command = context.input.tool_input.command;
    logger.debug(`Checking command: ${command}`);

    const violation = findViolation(command);
    if (!violation) {
      return context.success({});
    }

    const message = formatDenyReason(violation);

    logger.warn(`Blocked command: ${violation.name}`, { command });

    return context.json({
      event: "PreToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse" as const,
          permissionDecision: "deny" as const,
          permissionDecisionReason: message,
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

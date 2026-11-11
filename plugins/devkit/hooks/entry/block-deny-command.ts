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
type DenyRule = {
  /** コマンド名（正規表現パターン） */
  pattern: RegExp;
  /** 表示名 */
  name: string;
  /** 代替として推奨するコマンド */
  alternative: string;
  /** ブロック理由の説明 */
  reason: string;
  /** なぜこのコマンドが禁止されているか */
  why: string;
};

/**
 * 禁止コマンドルール一覧
 * 新しいルールを追加する場合はここに追記する
 */
const DENY_RULES: readonly DenyRule[] = [
  {
    pattern: /^npx\s/,
    name: "npx",
    alternative: "pnpx",
    reason: "pnpx を使用すること",
    why: "npx does not respect lockfiles and may download arbitrary package versions.",
  },
  {
    pattern: /^npm\s/,
    name: "npm",
    alternative: "pnpm",
    reason: "pnpm を使用すること",
    why: "npm conflicts with the project's package manager and creates inconsistent lockfiles.",
  },
  {
    pattern: /^tsc\b/,
    name: "tsc",
    alternative: "tsgo",
    reason: "tsgo を使用すること",
    why: "tsgo (native TypeScript 7.x) is the project standard for type checking; tsc is slower and not aligned with the configured toolchain.",
  },
] as const;

/** 環境変数名 */
const ENV_KEY = "DEVKIT_ENFORCE_TOOLS" as const;

/**
 * コマンドが禁止ルールに違反しているかチェック
 */
const findViolation = (command: string): DenyRule | undefined => {
  return DENY_RULES.find((rule) => rule.pattern.test(command));
};

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

    const input = context.input;
    if (!input) {
      return context.success({});
    }

    const command = input.tool_input.command;
    if (!command) {
      return context.success({});
    }

    logger.debug(`Checking command: ${command}`);

    const violation = findViolation(command);
    if (!violation) {
      return context.success({});
    }

    const message = `🚫 禁止コマンド検出: ${violation.name}

${violation.reason}

WHY: ${violation.why}
FIX: Use \`${violation.alternative}\` instead of \`${violation.name}\`.`;

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

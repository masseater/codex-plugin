#!/usr/bin/env bun
/**
 * figma-implement の実装フェーズ中にセッションが止まったとき、再開方法をユーザーに表示する。
 * figma-implement skill の frontmatter hooks（Stop）から呼ばれる。
 */
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

import { listConfigPaths, loadUiDevConfig, type UiDevConfig } from "../../lib/config.ts";

using logger = HookLogger.fromFile(import.meta.filename);

export function buildImplementMessage(flowName: string, screens: string[]): string {
  return `[ui-dev] フロー "${flowName}" は実装の途中です（画面: ${screens.join(", ")}）。
再開するには: /ui-dev:figma-implement ${flowName}`;
}

export function findFlowsInProgress(): UiDevConfig["flow"][] {
  const flows: UiDevConfig["flow"][] = [];
  for (const configPath of listConfigPaths()) {
    try {
      const { flow } = loadUiDevConfig(configPath);
      if (flow.currentPhase === "implement") flows.push(flow);
    } catch (error) {
      // 壊れた config.json は再開案内の対象から外すだけでよい（案内は表示専用で、作業には影響しない）。
      logger.warn("Skipping unreadable ui-dev config", { configPath, error: String(error) });
    }
  }
  return flows;
}

const hook = defineHook({
  trigger: { Stop: true },
  run: wrapRun(logger, (context) => {
    const flows = findFlowsInProgress();
    if (flows.length === 0) {
      return context.success();
    }

    logger.info(`Stop during implement for flows: ${flows.map((f) => f.name).join(", ")}`);
    return context.json({
      event: "Stop" as const,
      output: {
        systemMessage: flows.map((f) => buildImplementMessage(f.name, f.screens)).join("\n"),
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

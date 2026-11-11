#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: {
    Stop: true,
  },
  run: wrapRun(logger, (context) => {
    const transcriptPath = context.input.transcript_path;
    if (!transcriptPath) {
      logger.debug("Skipping: no transcript_path provided");
      return context.success({});
    }

    const homeDir = os.homedir();
    let resolvedPath = transcriptPath;

    if (resolvedPath.startsWith("~/")) {
      resolvedPath = path.join(homeDir, resolvedPath.slice(2));
    }

    const allowedBase = path.join(homeDir, ".claude", "projects");
    resolvedPath = path.resolve(resolvedPath);
    logger.debug(`Transcript path: ${resolvedPath}`);

    if (!resolvedPath.startsWith(allowedBase)) {
      logger.debug(`Skipping: path not under allowed base (${allowedBase})`);
      return context.success({});
    }

    const lines = readFileSync(resolvedPath, "utf-8")
      .split("\n")
      .filter((line) => line.trim());

    logger.debug(`Transcript has ${lines.length} non-empty lines`);

    if (lines.length === 0) {
      logger.debug("Skipping: transcript is empty");
      return context.success({});
    }

    const lastLine = lines[lines.length - 1];
    if (!lastLine) {
      logger.debug("Skipping: no last line found");
      return context.success({});
    }

    const transcript = JSON.parse(lastLine) as {
      message?: { content?: Array<{ text?: string }> };
    };
    const lastMessageContent = transcript?.message?.content?.[0]?.text;

    if (lastMessageContent !== undefined) {
      const truncatedMessage = lastMessageContent.slice(0, 100);
      logger.debug(
        `Sending notification: "${truncatedMessage}${lastMessageContent.length > 100 ? "..." : ""}"`,
      );
      execFileSync(
        "terminal-notifier",
        [
          "-title",
          `Claude (${path.basename(process.cwd())})`,
          "-message",
          lastMessageContent,
          "-execute",
          "code -r",
        ],
        {
          stdio: "ignore",
        },
      );
      logger.info("Notification sent successfully");
    } else {
      logger.debug("Skipping: no message content found in transcript");
    }

    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

import { execFileSync } from "node:child_process";
import type { HookLogger } from "@r_masseater/cc-plugin-lib";

export const isAgnixAvailable = (): boolean => {
  try {
    execFileSync("which", ["agnix"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
};

export const runAgnix = (
  args: string[],
  logger: Pick<HookLogger, "debug">,
): { exitCode: number; output: string } => {
  try {
    const result = execFileSync("agnix", args, {
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 30_000,
    });
    logger.debug(`agnix exited with code 0`);
    return { exitCode: 0, output: result };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    const output = [err.stdout, err.stderr].filter(Boolean).join("\n");
    const exitCode = err.status ?? 1;
    logger.debug(`agnix exited with code ${exitCode}`);
    return { exitCode, output };
  }
};

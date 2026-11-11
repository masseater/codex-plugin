import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { env } from "../../../env.js";

export function getToken(): string {
  const token = env.FIGMA_ACCESS_TOKEN;
  if (!token) throw new Error("FIGMA_ACCESS_TOKEN is not set");
  return token;
}

export function toColon(id: string): string {
  return id.replace(/-/g, ":");
}

export function toDash(id: string): string {
  return id.replace(/:/g, "-");
}

export function log(verbose: boolean, msg: string): void {
  if (verbose) console.error(msg);
}

export async function downloadFile(imageUrl: string, outputPath: string): Promise<void> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  await mkdir(dirname(outputPath), { recursive: true });
  await Bun.write(outputPath, buffer);
}

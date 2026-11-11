import type { PackageJsonSubset } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * JSON オブジェクトのうち、値が文字列のエントリだけを取り出す。
 * @param value 読む値（dependencies や scripts）
 * @returns 文字列の値だけを持つオブジェクト。オブジェクトでなければ undefined
 */
function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const entries: Array<[string, unknown]> = Object.entries(value);
  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function nameField(value: Record<string, unknown>): Pick<PackageJsonSubset, "name"> {
  return typeof value.name === "string" ? { name: value.name } : {};
}

type StringRecordKey = "scripts" | "dependencies" | "devDependencies";

function stringRecordFields(
  value: Record<string, unknown>,
): Pick<PackageJsonSubset, StringRecordKey> {
  const fields: Pick<PackageJsonSubset, StringRecordKey> = {};
  for (const key of ["scripts", "dependencies", "devDependencies"] as const) {
    const record = stringRecord(value[key]);
    if (record) fields[key] = record;
  }
  return fields;
}

function workspacesField(value: Record<string, unknown>): Pick<PackageJsonSubset, "workspaces"> {
  const workspaces = stringArray(value.workspaces);
  return workspaces ? { workspaces } : {};
}

/**
 * JSON として読んだ package.json から、監査に使うフィールドだけを型を確かめて取り出す。
 * @param value JSON.parse の戻り値
 * @returns 監査に使う package.json の部分集合。オブジェクトでなければ null
 */
export function toPackageJsonSubset(value: unknown): PackageJsonSubset | null {
  if (!isRecord(value)) return null;
  return { ...nameField(value), ...stringRecordFields(value), ...workspacesField(value) };
}

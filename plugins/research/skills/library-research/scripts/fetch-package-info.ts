#!/usr/bin/env bun
/**
 * パッケージレジストリからメタデータを取得し、meta.yml を直接書き込む
 * 対応レジストリ: npm, pypi, crates, go, github
 */

import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import { env } from "../../../env.js";
import { normalizeName, resolveKnowledgeDir } from "./lib/resolve-knowledge-dir.js";

type Registry = "npm" | "pypi" | "crates" | "go" | "github";
type MetaEntries = [string, string][];

// --- YAML helpers ---

function escapeYamlValue(value: string): string {
  if (/[":#{}[\],&*?|>!%@`]/.test(value) || value.includes("\n")) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return `"${value}"`;
}

function toYaml(entries: MetaEntries): string {
  return entries.map(([key, value]) => `${key}: ${escapeYamlValue(value)}`).join("\n");
}

// --- Type guards ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// --- Fetchers ---

async function fetchNpm(name: string): Promise<MetaEntries> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`npm: ${res.status} ${res.statusText}`);

  const data: unknown = await res.json();
  if (!isRecord(data)) throw new Error("npm: unexpected response");

  const distTags = data["dist-tags"];
  if (!isRecord(distTags) || typeof distTags.latest !== "string") {
    throw new Error("npm: missing dist-tags.latest");
  }

  const version = distTags.latest;
  const today = new Date().toISOString().split("T")[0] ?? "";

  const entries: MetaEntries = [
    ["name", typeof data.name === "string" ? data.name : name],
    ["package_name", name],
    ["registry", "npm"],
    ["version", version],
    ["last_updated", today],
  ];

  if (typeof data.description === "string") {
    entries.push(["description", data.description]);
  }

  // repository
  const repo = data.repository;
  if (typeof repo === "string") {
    entries.push(["repository", cleanGitUrl(repo)]);
  } else if (isRecord(repo) && typeof repo.url === "string") {
    entries.push(["repository", cleanGitUrl(repo.url)]);
    if (typeof repo.directory === "string") {
      entries.push(["repository_directory", repo.directory]);
    }
  }

  if (typeof data.homepage === "string") {
    entries.push(["documentation", data.homepage]);
  }

  return entries;
}

async function fetchPypi(name: string): Promise<MetaEntries> {
  const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`pypi: ${res.status} ${res.statusText}`);

  const data: unknown = await res.json();
  if (!isRecord(data)) throw new Error("pypi: unexpected response");

  const info = data.info;
  if (!isRecord(info)) throw new Error("pypi: missing info");

  const today = new Date().toISOString().split("T")[0] ?? "";
  const entries: MetaEntries = [
    ["name", typeof info.name === "string" ? info.name : name],
    ["package_name", name],
    ["registry", "pypi"],
    ["version", typeof info.version === "string" ? info.version : "unknown"],
    ["last_updated", today],
  ];

  if (typeof info.summary === "string") {
    entries.push(["description", info.summary]);
  }

  const projectUrls = info.project_urls;
  if (isRecord(projectUrls)) {
    // Try common keys for source
    for (const key of ["Source", "Repository", "GitHub", "Homepage"]) {
      const value = projectUrls[key];
      if (typeof value === "string") {
        entries.push(["repository", value]);
        break;
      }
    }
    // Try common keys for docs
    for (const key of ["Documentation", "Docs"]) {
      const value = projectUrls[key];
      if (typeof value === "string") {
        entries.push(["documentation", value]);
        break;
      }
    }
  }

  return entries;
}

async function fetchCrates(name: string): Promise<MetaEntries> {
  const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "library-research-script" },
  });
  if (!res.ok) throw new Error(`crates: ${res.status} ${res.statusText}`);

  const data: unknown = await res.json();
  if (!isRecord(data)) throw new Error("crates: unexpected response");

  const crate = data.crate;
  if (!isRecord(crate)) throw new Error("crates: missing crate");

  const today = new Date().toISOString().split("T")[0] ?? "";
  const entries: MetaEntries = [
    ["name", typeof crate.name === "string" ? crate.name : name],
    ["package_name", name],
    ["registry", "crates"],
    ["version", typeof crate.max_version === "string" ? crate.max_version : "unknown"],
    ["last_updated", today],
  ];

  if (typeof crate.description === "string") {
    entries.push(["description", crate.description]);
  }
  if (typeof crate.repository === "string") {
    entries.push(["repository", crate.repository]);
  }
  if (typeof crate.documentation === "string") {
    entries.push(["documentation", crate.documentation]);
  }

  return entries;
}

async function fetchGo(modulePath: string): Promise<MetaEntries> {
  const url = `https://proxy.golang.org/${modulePath}/@latest`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`go: ${res.status} ${res.statusText}`);

  const data: unknown = await res.json();
  if (!isRecord(data)) throw new Error("go: unexpected response");

  const today = new Date().toISOString().split("T")[0] ?? "";
  const version = typeof data.Version === "string" ? data.Version : "unknown";

  // Infer repo URL from module path (github.com/owner/repo → https://github.com/owner/repo)
  const parts = modulePath.split("/");
  const repoUrl = parts.length >= 3 ? `https://${parts.slice(0, 3).join("/")}` : undefined;

  const entries: MetaEntries = [
    ["name", modulePath.split("/").pop() ?? modulePath],
    ["package_name", modulePath],
    ["registry", "go"],
    ["version", version],
    ["last_updated", today],
  ];

  if (repoUrl) {
    entries.push(["repository", repoUrl]);
  }

  return entries;
}

async function fetchGithub(ownerRepo: string): Promise<MetaEntries> {
  const url = `https://api.github.com/repos/${ownerRepo}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "library-research-script",
  };
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`github: ${res.status} ${res.statusText}`);

  const data: unknown = await res.json();
  if (!isRecord(data)) throw new Error("github: unexpected response");

  const today = new Date().toISOString().split("T")[0] ?? "";
  const repoName = typeof data.name === "string" ? data.name : ownerRepo;

  const entries: MetaEntries = [
    ["name", repoName],
    ["package_name", ownerRepo],
    ["registry", "github"],
    ["version", ""],
    ["last_updated", today],
  ];

  if (typeof data.description === "string") {
    entries.push(["description", data.description]);
  }
  entries.push(["repository", `https://github.com/${ownerRepo}`]);
  if (typeof data.homepage === "string" && data.homepage) {
    entries.push(["documentation", data.homepage]);
  }

  // Try to get latest release tag
  try {
    const relRes = await fetch(`${url}/releases/latest`, { headers });
    if (relRes.ok) {
      const relData: unknown = await relRes.json();
      if (isRecord(relData) && typeof relData.tag_name === "string") {
        // Update version entry
        const versionIdx = entries.findIndex(([k]) => k === "version");
        if (versionIdx !== -1) {
          entries[versionIdx] = ["version", relData.tag_name];
        }
      }
    }
  } catch {
    // no release, version stays empty
  }

  return entries;
}

// --- Helpers ---

function cleanGitUrl(raw: string): string {
  return raw
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git:\/\//, "https://");
}

/**
 * --name の値からナレッジディレクトリ名を決定する。
 * go モジュール（github.com/owner/repo）の場合は最後のセグメントを使う。
 */
function resolveLibraryName(name: string, registry: Registry): string {
  if (registry === "go") {
    return name.split("/").pop() ?? name;
  }
  return name;
}

// --- Main ---

const main = defineCommand({
  meta: {
    name: "fetch-package-info",
    description: "パッケージレジストリからメタデータを取得し meta.yml に書き込む",
  },
  args: {
    name: {
      type: "string",
      description: "パッケージ名 / モジュールパス / owner/repo",
      required: true,
    },
    registry: {
      type: "string",
      description: "レジストリ: npm | pypi | crates | go | github",
      required: true,
    },
    user: {
      type: "boolean",
      description: "ユーザーレベル (~/.claude/) に保存",
      default: false,
    },
  },
  async run({ args }) {
    const validRegistries = ["npm", "pypi", "crates", "go", "github"] as const;
    if (!validRegistries.includes(args.registry as Registry)) {
      throw new Error(`未対応のレジストリ: ${args.registry}`);
    }
    const registry = args.registry as Registry;
    const libName = resolveLibraryName(args.name, registry);
    const dir = resolveKnowledgeDir(libName, args.user);

    let entries: MetaEntries;
    switch (registry) {
      case "npm":
        entries = await fetchNpm(args.name);
        break;
      case "pypi":
        entries = await fetchPypi(args.name);
        break;
      case "crates":
        entries = await fetchCrates(args.name);
        break;
      case "go":
        entries = await fetchGo(args.name);
        break;
      case "github":
        entries = await fetchGithub(args.name);
        break;
      default:
        throw new Error(`Unknown registry: ${registry}`);
    }

    const yaml = toYaml(entries);
    const outPath = join(dir, "meta.yml");
    await Bun.write(outPath, yaml);

    console.log(
      JSON.stringify({
        success: true,
        registry,
        name: args.name,
        normalizedName: normalizeName(libName),
        outputDir: dir,
        outputFile: outPath,
      }),
    );
  },
});

runMain(main);

import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { cleanGitUrl } from "./git-url.js";
import { fetchRegistryEntries, REGISTRY_CONFIGS, type MetaEntries } from "./registry-fetchers.js";

// レジストリごとの処理は REGISTRY_CONFIGS を通して検証する
const { npm, pypi, crates, go, github } = REGISTRY_CONFIGS;
const buildNpmUrl = npm.buildUrl;
const buildPypiUrl = pypi.buildUrl;
const buildCratesUrl = crates.buildUrl;
const buildGoUrl = go.buildUrl;
const buildGithubUrl = github.buildUrl;
const extractNpmEntries = npm.extractEntries;
const extractPypiEntries = pypi.extractEntries;
const extractCratesEntries = crates.extractEntries;
const extractGoEntries = go.extractEntries;
const extractGithubEntries = github.extractEntries;

function buildCratesHeaders(): Record<string, string> | undefined {
  return crates.buildHeaders?.();
}

function enrichGithubRelease(
  entries: MetaEntries,
  ownerRepo: string,
  headers: Record<string, string> | undefined,
): Promise<MetaEntries> {
  if (!github.enrich) throw new Error("github config has no enrich step");
  return github.enrich(entries, ownerRepo, headers);
}

const TODAY = "2025-01-01";

describe("cleanGitUrl", () => {
  test("strips git+ prefix", () => {
    expect(cleanGitUrl("git+https://github.com/expressjs/express.git")).toBe(
      "https://github.com/expressjs/express",
    );
  });

  test("strips trailing .git", () => {
    expect(cleanGitUrl("https://github.com/expressjs/express.git")).toBe(
      "https://github.com/expressjs/express",
    );
  });

  test("rewrites git:// scheme to https://", () => {
    expect(cleanGitUrl("git://github.com/expressjs/express.git")).toBe(
      "https://github.com/expressjs/express",
    );
  });

  test("leaves already-clean URL unchanged", () => {
    expect(cleanGitUrl("https://github.com/expressjs/express")).toBe(
      "https://github.com/expressjs/express",
    );
  });
});

describe("buildUrl functions", () => {
  test("buildNpmUrl encodes scoped package name", () => {
    expect(buildNpmUrl("@octokit/rest")).toBe("https://registry.npmjs.org/%40octokit%2Frest");
  });

  test("buildPypiUrl builds pypi JSON endpoint", () => {
    expect(buildPypiUrl("requests")).toBe("https://pypi.org/pypi/requests/json");
  });

  test("buildCratesUrl builds crates.io API endpoint", () => {
    expect(buildCratesUrl("serde")).toBe("https://crates.io/api/v1/crates/serde");
  });

  test("buildGoUrl builds golang proxy endpoint", () => {
    expect(buildGoUrl("github.com/spf13/cobra")).toBe(
      "https://proxy.golang.org/github.com/spf13/cobra/@latest",
    );
  });

  test("buildGithubUrl builds GitHub repos API endpoint", () => {
    expect(buildGithubUrl("expressjs/express")).toBe(
      "https://api.github.com/repos/expressjs/express",
    );
  });
});

describe("buildCratesHeaders", () => {
  test("includes User-Agent", () => {
    expect(buildCratesHeaders()).toStrictEqual({ "User-Agent": "library-research-script" });
  });
});

describe("github buildHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("omits Authorization when GITHUB_TOKEN is unset", async () => {
    // env.ts は import 時に process.env を検証して固定するため、環境変数を外してからモジュールを読み直す。
    // 実行環境に GITHUB_TOKEN が設定されていても、未設定時の挙動を検証できるようにする。
    vi.stubEnv("GITHUB_TOKEN", undefined);
    vi.resetModules();
    const { REGISTRY_CONFIGS: configsWithoutToken } = await import("./registry-fetchers.js");
    const headers = configsWithoutToken.github.buildHeaders?.() ?? {};
    expect(headers.Accept).toBe("application/vnd.github.v3+json");
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("extractNpmEntries", () => {
  test("extracts name/version/description/homepage", () => {
    const data = {
      name: "express",
      description: "Fast web framework",
      homepage: "https://expressjs.com/",
      "dist-tags": { latest: "4.21.0" },
    };
    const entries = extractNpmEntries(data, "express", TODAY);
    expect(entries).toContainEqual(["name", "express"]);
    expect(entries).toContainEqual(["package_name", "express"]);
    expect(entries).toContainEqual(["registry", "npm"]);
    expect(entries).toContainEqual(["version", "4.21.0"]);
    expect(entries).toContainEqual(["description", "Fast web framework"]);
    expect(entries).toContainEqual(["documentation", "https://expressjs.com/"]);
  });

  test("throws when dist-tags.latest is missing", () => {
    expect(() => extractNpmEntries({ name: "express" }, "express", TODAY)).toThrow(
      "npm: missing dist-tags.latest",
    );
  });

  test("normalizes string repository field", () => {
    const data = {
      "dist-tags": { latest: "1.0.0" },
      repository: "git+https://github.com/foo/bar.git",
    };
    const entries = extractNpmEntries(data, "bar", TODAY);
    expect(entries).toContainEqual(["repository", "https://github.com/foo/bar"]);
  });

  test("extracts repository object with directory", () => {
    const data = {
      "dist-tags": { latest: "1.0.0" },
      repository: { url: "git+https://github.com/foo/mono.git", directory: "packages/bar" },
    };
    const entries = extractNpmEntries(data, "bar", TODAY);
    expect(entries).toContainEqual(["repository", "https://github.com/foo/mono"]);
    expect(entries).toContainEqual(["repository_directory", "packages/bar"]);
  });

  test("falls back to requested name when data.name is missing", () => {
    const entries = extractNpmEntries(
      { "dist-tags": { latest: "1.0.0" } },
      "requested-name",
      TODAY,
    );
    expect(entries).toContainEqual(["name", "requested-name"]);
  });
});

describe("extractPypiEntries", () => {
  test("extracts name/version/summary", () => {
    const data = { info: { name: "requests", version: "2.31.0", summary: "HTTP for humans" } };
    const entries = extractPypiEntries(data, "requests", TODAY);
    expect(entries).toContainEqual(["name", "requests"]);
    expect(entries).toContainEqual(["version", "2.31.0"]);
    expect(entries).toContainEqual(["description", "HTTP for humans"]);
  });

  test("throws when info is missing", () => {
    expect(() => extractPypiEntries({}, "requests", TODAY)).toThrow("pypi: missing info");
  });

  test("uses unknown when version missing", () => {
    const entries = extractPypiEntries({ info: { name: "x" } }, "x", TODAY);
    expect(entries).toContainEqual(["version", "unknown"]);
  });

  test("picks first matching project_urls key for repository and documentation", () => {
    const data = {
      info: {
        name: "requests",
        version: "1.0.0",
        project_urls: {
          Homepage: "https://example.com",
          Source: "https://github.com/psf/requests",
          Docs: "https://requests.readthedocs.io",
        },
      },
    };
    const entries = extractPypiEntries(data, "requests", TODAY);
    expect(entries).toContainEqual(["repository", "https://github.com/psf/requests"]);
    expect(entries).toContainEqual(["documentation", "https://requests.readthedocs.io"]);
  });

  test("omits repository/documentation when project_urls has no matching key", () => {
    const data = { info: { name: "requests", version: "1.0.0", project_urls: { Other: "x" } } };
    const entries = extractPypiEntries(data, "requests", TODAY);
    expect(entries.some(([key]) => key === "repository")).toBe(false);
    expect(entries.some(([key]) => key === "documentation")).toBe(false);
  });
});

describe("extractCratesEntries", () => {
  test("extracts name/version/description/repository/documentation", () => {
    const data = {
      crate: {
        name: "serde",
        max_version: "1.0.200",
        description: "Serialization framework",
        repository: "https://github.com/serde-rs/serde",
        documentation: "https://docs.rs/serde",
      },
    };
    const entries = extractCratesEntries(data, "serde", TODAY);
    expect(entries).toContainEqual(["version", "1.0.200"]);
    expect(entries).toContainEqual(["description", "Serialization framework"]);
    expect(entries).toContainEqual(["repository", "https://github.com/serde-rs/serde"]);
    expect(entries).toContainEqual(["documentation", "https://docs.rs/serde"]);
  });

  test("throws when crate is missing", () => {
    expect(() => extractCratesEntries({}, "serde", TODAY)).toThrow("crates: missing crate");
  });

  test("uses unknown when max_version missing", () => {
    const entries = extractCratesEntries({ crate: { name: "x" } }, "x", TODAY);
    expect(entries).toContainEqual(["version", "unknown"]);
  });
});

describe("extractGoEntries", () => {
  test("infers repository from module path with 3+ segments", () => {
    const entries = extractGoEntries({ Version: "v1.8.0" }, "github.com/spf13/cobra", TODAY);
    expect(entries).toContainEqual(["name", "cobra"]);
    expect(entries).toContainEqual(["package_name", "github.com/spf13/cobra"]);
    expect(entries).toContainEqual(["version", "v1.8.0"]);
    expect(entries).toContainEqual(["repository", "https://github.com/spf13/cobra"]);
  });

  test("omits repository when module path has fewer than 3 segments", () => {
    const entries = extractGoEntries({ Version: "v1.0.0" }, "example.com/foo", TODAY);
    expect(entries.some(([key]) => key === "repository")).toBe(false);
  });

  test("uses unknown when Version missing", () => {
    const entries = extractGoEntries({}, "github.com/foo/bar", TODAY);
    expect(entries).toContainEqual(["version", "unknown"]);
  });
});

describe("extractGithubEntries", () => {
  test("extracts name/description/repository/documentation with empty version", () => {
    const data = {
      name: "express",
      description: "Fast web framework",
      homepage: "https://expressjs.com/",
    };
    const entries = extractGithubEntries(data, "expressjs/express", TODAY);
    expect(entries).toContainEqual(["name", "express"]);
    expect(entries).toContainEqual(["package_name", "expressjs/express"]);
    expect(entries).toContainEqual(["version", ""]);
    expect(entries).toContainEqual(["repository", "https://github.com/expressjs/express"]);
    expect(entries).toContainEqual(["documentation", "https://expressjs.com/"]);
  });

  test("falls back to ownerRepo when data.name missing, omits empty homepage", () => {
    const entries = extractGithubEntries({ homepage: "" }, "foo/bar", TODAY);
    expect(entries).toContainEqual(["name", "foo/bar"]);
    expect(entries.some(([key]) => key === "documentation")).toBe(false);
  });
});

describe("enrichGithubRelease", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("updates version entry when latest release exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tag_name: "v4.21.0" }),
      }),
    );
    const entries: [string, string][] = [["version", ""]];
    const result = await enrichGithubRelease(entries, "expressjs/express", undefined);
    expect(result).toContainEqual(["version", "v4.21.0"]);
  });

  test("keeps entries unchanged when there is no release (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const entries: [string, string][] = [["version", ""]];
    const result = await enrichGithubRelease(entries, "foo/bar", undefined);
    expect(result).toStrictEqual(entries);
  });

  test("keeps entries unchanged when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const entries: [string, string][] = [["version", ""]];
    const result = await enrichGithubRelease(entries, "foo/bar", undefined);
    expect(result).toStrictEqual(entries);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("fetchRegistryEntries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches, validates status, and extracts entries via config", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: "express", "dist-tags": { latest: "4.21.0" } }),
      }),
    );
    const entries = await fetchRegistryEntries("express", REGISTRY_CONFIGS.npm);
    expect(entries).toContainEqual(["name", "express"]);
    expect(entries).toContainEqual(["version", "4.21.0"]);
  });

  test("throws with registry-prefixed message on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }),
    );
    await expect(fetchRegistryEntries("missing-pkg", REGISTRY_CONFIGS.npm)).rejects.toThrow(
      "npm: 404 Not Found",
    );
  });

  test("throws when response is not a JSON object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([1, 2]) }),
    );
    await expect(fetchRegistryEntries("x", REGISTRY_CONFIGS.npm)).rejects.toThrow(
      "npm: unexpected response",
    );
  });

  test("sends configured headers (crates)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ crate: { name: "serde", max_version: "1.0.0" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await fetchRegistryEntries("serde", REGISTRY_CONFIGS.crates);
    expect(fetchMock).toHaveBeenCalledWith("https://crates.io/api/v1/crates/serde", {
      headers: { "User-Agent": "library-research-script" },
    });
  });

  test("runs enrich step for github config", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/releases/latest")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ tag_name: "v4.21.0" }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: "express" }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const entries = await fetchRegistryEntries("expressjs/express", REGISTRY_CONFIGS.github);
    expect(entries).toContainEqual(["version", "v4.21.0"]);
  });
});

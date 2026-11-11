import { afterEach, describe, expect, test, vi } from "vite-plus/test";

/**
 * Test pure utility functions from _lib.ts.
 * env はモックし、downloadFile は fetch・mkdir・Bun.write を差し替えて検証する。
 */

// Mock the env import so the module can load without FIGMA_ACCESS_TOKEN
const mockEnv: { FIGMA_ACCESS_TOKEN: string | undefined } = { FIGMA_ACCESS_TOKEN: undefined };
vi.mock("../../../env.js", () => ({
  env: mockEnv,
}));

const mockMkdir = vi.fn();
vi.mock("node:fs/promises", () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

describe("toColon", () => {
  test("replaces dashes with colons", async () => {
    const { toColon } = await import("./_lib.js");
    expect(toColon("123-456")).toBe("123:456");
  });

  test("replaces multiple dashes", async () => {
    const { toColon } = await import("./_lib.js");
    expect(toColon("1-2-3-4")).toBe("1:2:3:4");
  });

  test("returns unchanged string when no dashes", async () => {
    const { toColon } = await import("./_lib.js");
    expect(toColon("123:456")).toBe("123:456");
  });

  test("handles empty string", async () => {
    const { toColon } = await import("./_lib.js");
    expect(toColon("")).toBe("");
  });
});

describe("toDash", () => {
  test("replaces colons with dashes", async () => {
    const { toDash } = await import("./_lib.js");
    expect(toDash("123:456")).toBe("123-456");
  });

  test("replaces multiple colons", async () => {
    const { toDash } = await import("./_lib.js");
    expect(toDash("1:2:3:4")).toBe("1-2-3-4");
  });

  test("returns unchanged string when no colons", async () => {
    const { toDash } = await import("./_lib.js");
    expect(toDash("123-456")).toBe("123-456");
  });

  test("handles empty string", async () => {
    const { toDash } = await import("./_lib.js");
    expect(toDash("")).toBe("");
  });
});

describe("toColon and toDash are inverses", () => {
  test("toDash(toColon(id)) returns original when id uses dashes", async () => {
    const { toColon, toDash } = await import("./_lib.js");
    const original = "123-456-789";
    expect(toDash(toColon(original))).toBe(original);
  });

  test("toColon(toDash(id)) returns original when id uses colons", async () => {
    const { toColon, toDash } = await import("./_lib.js");
    const original = "123:456:789";
    expect(toColon(toDash(original))).toBe(original);
  });
});

describe("log", () => {
  test("writes to stderr when verbose is true", async () => {
    const { log } = await import("./_lib.js");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log(true, "test message");
    expect(spy).toHaveBeenCalledWith("test message");
    spy.mockRestore();
  });

  test("does not write when verbose is false", async () => {
    const { log } = await import("./_lib.js");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log(false, "test message");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("getToken", () => {
  test("throws when FIGMA_ACCESS_TOKEN is not set", async () => {
    mockEnv.FIGMA_ACCESS_TOKEN = undefined;
    const { getToken } = await import("./_lib.js");
    expect(() => getToken()).toThrow("FIGMA_ACCESS_TOKEN is not set");
  });

  test("returns the token when FIGMA_ACCESS_TOKEN is set", async () => {
    mockEnv.FIGMA_ACCESS_TOKEN = "figd_token";
    const { getToken } = await import("./_lib.js");
    expect(getToken()).toBe("figd_token");
    mockEnv.FIGMA_ACCESS_TOKEN = undefined;
  });
});

describe("downloadFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockMkdir.mockReset();
  });

  test("creates the parent directory and writes the downloaded body", async () => {
    const body = new ArrayBuffer(4);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(body) }),
    );
    const write = vi.fn().mockResolvedValue(4);
    vi.stubGlobal("Bun", { write });
    const { downloadFile } = await import("./_lib.js");

    await downloadFile("https://example.com/a.png", "/tmp/out/a.png");

    expect(mockMkdir).toHaveBeenCalledWith("/tmp/out", { recursive: true });
    expect(write).toHaveBeenCalledWith("/tmp/out/a.png", body);
  });

  test("throws with the HTTP status when the download fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }),
    );
    const { downloadFile } = await import("./_lib.js");

    await expect(downloadFile("https://example.com/a.png", "/tmp/out/a.png")).rejects.toThrow(
      "Download failed: 404 Not Found",
    );
    expect(mockMkdir).not.toHaveBeenCalled();
  });
});

describe("figmaGet / figmaJson / fetchNodeDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("固定の Figma API にパス要素をエスケープし、クエリとトークンを付けて GET する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const { figmaGet } = await import("./_lib.js");

    await figmaGet(["files", "a/b", "nodes"], { ids: "1:2", depth: "1" }, "figd_token");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.figma.com/v1/files/a%2Fb/nodes?ids=1%3A2&depth=1");
    expect(init).toEqual({ headers: { "X-Figma-Token": "figd_token" } });
  });

  test("失敗したレスポンスは API 名と HTTP ステータスで例外にする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 403, statusText: "Forbidden" })),
    );
    const { figmaJson } = await import("./_lib.js");

    await expect(figmaJson(["files", "key"], {}, "token", "Figma Files API")).rejects.toThrow(
      "Figma Files API failed: 403 Forbidden",
    );
  });

  test("ノード ID をコロン区切りに直してレスポンスから document を取り出す", async () => {
    const document = { id: "1:2", name: "Frame" };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ nodes: { "1:2": { document } } })));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchNodeDocument } = await import("./_lib.js");

    await expect(fetchNodeDocument("key", "1-2", "token", { geometry: "paths" })).resolves.toEqual(
      document,
    );
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.figma.com/v1/files/key/nodes?ids=1-2&geometry=paths");
  });

  test("レスポンスにノードが無ければ null を返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ nodes: {} }))));
    const { fetchNodeDocument } = await import("./_lib.js");

    await expect(fetchNodeDocument("key", "1:2", "token")).resolves.toBeNull();
  });
});

describe("writeJsonOutput", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("出力先を指定したらファイルに書き、書いたパスを表示する", async () => {
    const write = vi.fn().mockResolvedValue(2);
    vi.stubGlobal("Bun", { write });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { writeJsonOutput } = await import("./_lib.js");

    await writeJsonOutput("/tmp/out.json", "{}");

    expect(write).toHaveBeenCalledWith("/tmp/out.json", "{}");
    expect(log).toHaveBeenCalledWith("output=/tmp/out.json");
    log.mockRestore();
  });

  test("出力先が無ければ標準出力に JSON を出す", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { writeJsonOutput } = await import("./_lib.js");

    await writeJsonOutput(undefined, '{"a":1}');

    expect(log).toHaveBeenCalledWith('{"a":1}');
    log.mockRestore();
  });
});

describe("downloadFile の URL 検査", () => {
  test("https 以外の URL からはダウンロードしない", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { downloadFile } = await import("./_lib.js");

    await expect(downloadFile("http://example.com/a.png", "/tmp/out/a.png")).rejects.toThrow(
      "Refusing to download from a non-https URL",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

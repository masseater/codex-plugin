import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectContext } from "../../core/types.ts";
import { meta, run } from "./index.ts";

function makeTempProject(): {
  dir: string;
  writeFile: (path: string, content: string) => void;
} {
  const dir = mkdtempSync(join(tmpdir(), "code-patterns-test-"));
  return {
    dir,
    writeFile: (path: string, content: string) => {
      const fullPath = join(dir, path);
      mkdirSync(fullPath.substring(0, fullPath.lastIndexOf("/")), {
        recursive: true,
      });
      writeFileSync(fullPath, content);
    },
  };
}

function makeCtx(rootDir: string): ProjectContext {
  return {
    rootDir,
    label: "apps/web",
    types: ["web"],
    packageJson: null,
  };
}

describe("code-patterns meta", () => {
  test("has correct name and scope", () => {
    expect(meta.name).toBe("code-patterns");
    expect(meta.scope).toBe("workspace");
  });

  test("has description and references", () => {
    expect(meta.description.length).toBeGreaterThan(0);
    expect(meta.references.length).toBeGreaterThan(0);
  });
});

describe("code/no-skip-env", () => {
  test("clean project returns no findings", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("src/app.ts", 'import { env } from "./env";\nconst x = 1;\n');

    const findings = await run(makeCtx(dir));
    const skipFindings = findings.filter((f) => f.rule === "code/no-skip-env");
    expect(skipFindings).toHaveLength(0);
  });

  test("file with skipEnvValidation produces a violation", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("src/server.ts", "// @ts-ignore\nconst config = { skipEnvValidation: true };\n");

    const findings = await run(makeCtx(dir));
    const skipFindings = findings.filter((f) => f.rule === "code/no-skip-env");
    expect(skipFindings.length).toBeGreaterThanOrEqual(1);
    const first = skipFindings[0];
    expect(first).toBeDefined();
    expect(first?.severity).toBe("violation");
    expect(first?.file).toContain("server.ts");
    expect(first?.line).toBe(2);
  });

  test("file with skipValidation produces a violation", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("src/config.ts", "export const skipValidation = process.env.CI;\n");

    const findings = await run(makeCtx(dir));
    const skipFindings = findings.filter((f) => f.rule === "code/no-skip-env");
    expect(skipFindings.length).toBeGreaterThanOrEqual(1);
    expect(skipFindings[0]?.severity).toBe("violation");
  });

  test("file with SKIP_ENV produces a violation", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("src/build.ts", "if (process.env.SKIP_ENV) {\n  console.log('skipping');\n}\n");

    const findings = await run(makeCtx(dir));
    const skipFindings = findings.filter((f) => f.rule === "code/no-skip-env");
    expect(skipFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("violation finding has correct rule field", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("src/main.ts", "const x = { skipEnvValidation: false };\n");

    const findings = await run(makeCtx(dir));
    const skipFindings = findings.filter((f) => f.rule === "code/no-skip-env");
    expect(skipFindings[0]?.rule).toBe("code/no-skip-env");
    expect(skipFindings[0]?.message.length).toBeGreaterThan(0);
  });
});

describe("code/no-direct-process-env", () => {
  test("clean project returns no findings", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("src/app.ts", 'import { env } from "./env";\nconst x = env.DATABASE_URL;\n');

    const findings = await run(makeCtx(dir));
    const envFindings = findings.filter((f) => f.rule === "code/no-direct-process-env");
    expect(envFindings).toHaveLength(0);
  });

  test("env.ts with process.env is excluded — no finding", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("src/env.ts", "export const env = { DB: process.env.DATABASE_URL };\n");

    const findings = await run(makeCtx(dir));
    const envFindings = findings.filter((f) => f.rule === "code/no-direct-process-env");
    expect(envFindings).toHaveLength(0);
  });

  test("regular file with process.env produces a warning", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("src/db.ts", "const url = process.env.DATABASE_URL;\n");

    const findings = await run(makeCtx(dir));
    const envFindings = findings.filter((f) => f.rule === "code/no-direct-process-env");
    expect(envFindings.length).toBeGreaterThanOrEqual(1);
    expect(envFindings[0]?.severity).toBe("warning");
    expect(envFindings[0]?.file).toContain("db.ts");
    expect(envFindings[0]?.line).toBe(1);
  });

  test("config file with process.env is excluded — no finding", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("next.config.ts", "module.exports = { env: { API: process.env.API_URL } };\n");

    const findings = await run(makeCtx(dir));
    const envFindings = findings.filter((f) => f.rule === "code/no-direct-process-env");
    expect(envFindings).toHaveLength(0);
  });

  test("test file with process.env is excluded — no finding", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("src/app.test.ts", "expect(process.env.NODE_ENV).toBe('test');\n");

    const findings = await run(makeCtx(dir));
    const envFindings = findings.filter((f) => f.rule === "code/no-direct-process-env");
    expect(envFindings).toHaveLength(0);
  });

  test("declaration file with process.env is excluded — no finding", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("src/global.d.ts", "declare const env: typeof process.env;\n");

    const findings = await run(makeCtx(dir));
    const envFindings = findings.filter((f) => f.rule === "code/no-direct-process-env");
    expect(envFindings).toHaveLength(0);
  });

  test("warning finding has correct rule field and message", async () => {
    const { dir, writeFile } = makeTempProject();
    writeFile("src/service.ts", "const secret = process.env.SECRET_KEY;\n");

    const findings = await run(makeCtx(dir));
    const envFindings = findings.filter((f) => f.rule === "code/no-direct-process-env");
    expect(envFindings[0]?.rule).toBe("code/no-direct-process-env");
    expect(envFindings[0]?.message.length).toBeGreaterThan(0);
  });
});

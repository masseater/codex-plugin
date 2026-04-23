import { describe, expect, it } from "bun:test";
import { search } from "./search.ts";
import { openDb } from "./db.ts";

describe("search (integration with FTS5 trigram)", () => {
  function setupDb() {
    const db = openDb(":memory:");
    db.run(
      `INSERT INTO issues (number, title, body, state, created_at, updated_at, url, labels_json, comments_json)
         VALUES (1, 'TypeScript compile error', 'cannot build', 'open', '2026-01-01T00:00:00Z', '2026-04-20T00:00:00Z', 'http://x/1', '["bug"]', '[]')`,
    );
    db.run(
      `INSERT INTO issues_fts (rowid, title, body, labels) VALUES (1, 'TypeScript compile error', 'cannot build', 'bug')`,
    );
    db.run(
      `INSERT INTO issues (number, title, body, state, created_at, updated_at, url, labels_json, comments_json)
         VALUES (2, '関係ない話題', 'unrelated', 'closed', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z', 'http://x/2', '[]', '[]')`,
    );
    db.run(
      `INSERT INTO issues_fts (rowid, title, body, labels) VALUES (2, '関係ない話題', 'unrelated', '')`,
    );
    return db;
  }

  it("returns matches sorted by score", () => {
    const db = setupDb();
    try {
      const out = search(db, "TypeScript compile");
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out[0]!.number).toBe(1);
      expect(out[0]!.state).toBe("open");
    } finally {
      db.close();
    }
  });

  it("filters closed issues when includeClosed=false", () => {
    const db = setupDb();
    try {
      const out = search(db, "関係ない", { includeClosed: false });
      expect(out.length).toBe(0);
    } finally {
      db.close();
    }
  });

  it("returns empty for unindexable queries", () => {
    const db = setupDb();
    try {
      expect(search(db, "ab")).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("boosts label-matching candidates when queryLabels provided", () => {
    const db = setupDb();
    try {
      const out = search(db, "TypeScript compile", { queryLabels: ["bug"] });
      expect(out[0]!.labelJaccard).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });
});

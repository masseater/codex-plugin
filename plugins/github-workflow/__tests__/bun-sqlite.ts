/**
 * Vitest（Node）には `bun:sqlite` が無いため、`node:sqlite` で同じ呼び出し口を満たす代替実装。
 * `vi.mock("bun:sqlite", () => import("<相対パス>/__tests__/bun-sqlite.ts"))` で差し替えて使う。
 */
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

type Params = SQLInputValue[];

export class Database {
  readonly #db: DatabaseSync;

  constructor(filename: string, _options?: { create?: boolean }) {
    this.#db = new DatabaseSync(filename);
  }

  run(sql: string, params: Params = []): void {
    this.#db.prepare(sql).run(...params);
  }

  query(sql: string) {
    const stmt = this.#db.prepare(sql);
    return {
      // bun:sqlite は行が無いとき undefined ではなく null を返す
      get: (...params: Params): unknown => stmt.get(...params) ?? null,
      all: (...params: Params): unknown[] => stmt.all(...params),
    };
  }

  prepare(sql: string) {
    const stmt = this.#db.prepare(sql);
    return { run: (...params: Params): void => void stmt.run(...params) };
  }

  transaction<Arg>(fn: (arg: Arg) => void): (arg: Arg) => void {
    return (arg) => {
      this.#db.exec("BEGIN");
      try {
        fn(arg);
        this.#db.exec("COMMIT");
      } catch (error) {
        this.#db.exec("ROLLBACK");
        throw error;
      }
    };
  }

  close(): void {
    this.#db.close();
  }
}

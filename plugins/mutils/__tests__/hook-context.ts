/**
 * cc-hooks-ts の hook context の代役。`success` / `json` が受け取った出力をそのまま返す。
 */

type FakeHookResult = { kind: "success" | "json"; output: unknown };

export function hookContext<Input>(input: Input) {
  return {
    input,
    success: (output: unknown): FakeHookResult => ({ kind: "success", output }),
    json: (output: unknown): FakeHookResult => ({ kind: "json", output }),
  };
}

export type CapturedHook = { run: (context: unknown) => unknown };

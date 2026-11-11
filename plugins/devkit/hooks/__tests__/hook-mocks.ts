import { vi } from "vite-plus/test";

// defineHook に渡された定義。テストが hook の run を直接呼ぶために保持する
const capturedHooks: { run: (context: unknown) => unknown }[] = [];

// cc-plugin-lib の差し替え（logger は何もしない）
function pluginLibMock() {
  return {
    HookLogger: {
      fromFile: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        [Symbol.dispose]: vi.fn(),
      }),
    },
    wrapRun: (_logger: unknown, fn: unknown) => fn,
  };
}

// cc-hooks-ts の差し替え。defineHook の引数を capturedHooks に積む
function hooksTsMock() {
  return {
    defineHook: (definition: { run: (context: unknown) => unknown }) => {
      capturedHooks.push(definition);
      return definition;
    },
    runHook: vi.fn(),
  };
}

// hook の run に渡す最小の context。success / json は渡された値をそのまま返す
function makeContext(input: object) {
  return {
    input,
    success: (value: unknown) => ({ kind: "success", value }),
    json: (value: unknown) => ({ kind: "json", value }),
  };
}

export { capturedHooks, hooksTsMock, makeContext, pluginLibMock };

import { describe, expect, test } from "vite-plus/test";
import { FAILURE_CONCLUSIONS, computeOverallStatus, isFailedCheck } from "./ci-status.ts";

const done = (conclusion: string | null) => ({ status: "completed", conclusion });
const running = { status: "in_progress", conclusion: null };

describe("isFailedCheck", () => {
  test.each([...FAILURE_CONCLUSIONS, "cancelled", "stale"])("%s は失敗", (conclusion) => {
    expect(isFailedCheck(done(conclusion))).toBe(true);
  });

  test.each(["success", "neutral", "skipped"])("%s は失敗ではない", (conclusion) => {
    expect(isFailedCheck(done(conclusion))).toBe(false);
  });

  test("未完了の check は失敗ではない", () => {
    expect(isFailedCheck(running)).toBe(false);
  });
});

describe("computeOverallStatus", () => {
  test("失敗が未完了の check より後ろにあっても failure", () => {
    expect(computeOverallStatus([running, done("failure")])).toBe("failure");
  });

  test.each(["cancelled", "action_required", "startup_failure"])(
    "%s は success ではなく failure",
    (conclusion) => {
      expect(computeOverallStatus([done("success"), done(conclusion)])).toBe("failure");
    },
  );

  test("失敗がなく未完了があれば pending", () => {
    expect(computeOverallStatus([done("success"), running])).toBe("pending");
  });

  test("skipped を含み他が成功なら neutral", () => {
    expect(computeOverallStatus([done("success"), done("skipped")])).toBe("neutral");
  });

  test("すべて成功なら success", () => {
    expect(computeOverallStatus([done("success"), done("success")])).toBe("success");
  });

  test("check が無ければ success", () => {
    expect(computeOverallStatus([])).toBe("success");
  });
});

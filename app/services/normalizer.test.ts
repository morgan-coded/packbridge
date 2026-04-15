import { describe, expect, it } from "vitest";
import { computeOverallStatus } from "./normalizer.server";

describe("computeOverallStatus", () => {
  it("returns 'held' when any event is a hold", () => {
    expect(
      computeOverallStatus([
        { resultStatus: "pass" },
        { resultStatus: "warn" },
        { resultStatus: "hold" },
      ]),
    ).toBe("held");
  });

  it("returns 'completed' when all events pass", () => {
    expect(
      computeOverallStatus([
        { resultStatus: "pass" },
        { resultStatus: "pass" },
      ]),
    ).toBe("completed");
  });

  it("returns 'completed' when events mix pass/warn/no_rule but no hold", () => {
    expect(
      computeOverallStatus([
        { resultStatus: "pass" },
        { resultStatus: "warn" },
        { resultStatus: "no_rule" },
      ]),
    ).toBe("completed");
  });

  it("returns 'completed' for an empty event list", () => {
    expect(computeOverallStatus([])).toBe("completed");
  });

  it("returns 'held' even if only one of many events holds", () => {
    expect(
      computeOverallStatus([
        { resultStatus: "pass" },
        { resultStatus: "pass" },
        { resultStatus: "pass" },
        { resultStatus: "hold" },
      ]),
    ).toBe("held");
  });
});

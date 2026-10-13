import { describe, expect, it } from "vitest";
import { mark, measure, startupPerfSnapshot } from "../../src/main/desktop/perfMarks";

describe("perf marks", () => {
  it("records mediax marks and measures a span", () => {
    mark("mediax/test-will");
    mark("mediax/test-did");
    const duration = measure("mediax/test-span", "mediax/test-will", "mediax/test-did");
    expect(duration).toBeTypeOf("number");
    expect(startupPerfSnapshot().some((entry) => entry.name === "mediax/test-will")).toBe(true);
  });
});

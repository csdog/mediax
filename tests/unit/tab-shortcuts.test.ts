import { describe, it, expect } from "vitest";
import { tabShortcut } from "../../src/main/desktop/tabShortcuts";
const input = (key: string, flags = {}) => ({
  type: "keyDown" as const,
  key,
  control: false,
  meta: false,
  shift: false,
  alt: false,
  ...flags,
});
describe("tab shortcuts", () => {
  it("handles both Control and Command without catching plain typing or key releases", () => {
    for (const flags of [{ control: true }, { meta: true }]) {
      expect(tabShortcut(input("w", flags))).toBe("close");
      expect(tabShortcut(input("t", flags))).toBe("new");
      expect(tabShortcut(input("T", { ...flags, shift: true }))).toBe("reopen");
      expect(tabShortcut(input(",", flags))).toBe("settings");
      expect(tabShortcut(input("w", { ...flags, shift: true }))).toBeUndefined();
    }
    expect(tabShortcut(input("w"))).toBeUndefined();
    expect(tabShortcut({ ...input("w", { control: true }), type: "keyUp" })).toBeUndefined();
    expect(tabShortcut(input("w", { control: true, alt: true }))).toBeUndefined();
  });
  it("cycles tabs forward and backward", () => {
    expect(tabShortcut(input("Tab", { control: true }))).toBe("next");
    expect(tabShortcut(input("Tab", { control: true, shift: true }))).toBe("previous");
    expect(tabShortcut(input("[", { meta: true, shift: true }))).toBe("previous");
    expect(tabShortcut(input("]", { meta: true, shift: true }))).toBe("next");
  });
});

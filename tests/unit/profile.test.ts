import { describe, expect, it } from "vitest";
import { parseProfile, profileInitials, readProfile } from "../../src/shared/profile";

const png = "data:image/png;base64,aaaa";

describe("profile", () => {
  it("builds initials from the display name", () => {
    expect(profileInitials("MediaX")).toBe("ME");
    expect(profileInitials("张三")).toBe("张三");
    expect(profileInitials("Ada Lovelace")).toBe("AL");
  });

  it("reads a saved profile and drops an invalid avatar", () => {
    expect(readProfile({ name: " 张三 ", avatar: png })).toEqual({ name: "张三", avatar: png });
    expect(readProfile({ name: "", avatar: "file:///tmp/a.png" })).toEqual({
      name: "MediaX",
      avatar: null,
    });
    expect(readProfile(null)).toEqual({ name: "MediaX", avatar: null });
  });

  it("rejects an empty name or an oversized avatar", () => {
    expect(() => parseProfile({ name: "  ", avatar: null })).toThrow("名称需要 1 到 40 个字");
    expect(() =>
      parseProfile({ name: "张三", avatar: `data:image/png;base64,${"a".repeat(400_000)}` }),
    ).toThrow("头像无效");
    expect(parseProfile({ name: " 张三 ", avatar: null })).toEqual({ name: "张三", avatar: null });
  });
});

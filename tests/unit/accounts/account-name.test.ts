import { describe, expect, it } from "vitest";
import {
  discoveredAccountName,
  isGeneratedAccountName,
  usableAccountName,
} from "../../../src/main/accounts/accountName";

describe("account display name", () => {
  it("preserves real nicknames containing the word account", () => {
    expect(usableAccountName("zhihu", "我的创作账号")).toBe("我的创作账号");
    expect(usableAccountName("weibo", "真实账号")).toBe("真实账号");
    expect(usableAccountName("weibo", "微博账号")).toBeNull();
  });
  it("uses the platform profile name instead of the generated label", () => {
    expect(isGeneratedAccountName("Facebook 账号 2")).toBe(true);
    expect(
      discoveredAccountName("facebook", [
        {
          accountId: "a",
          identityId: "1",
          name: "张三",
          kind: "profile",
        },
        {
          accountId: "a",
          identityId: "2",
          name: "观察世界",
          kind: "page",
        },
      ]),
    ).toBe("张三");
  });

  it("reads the Zhihu username out of the avatar label", () => {
    expect(usableAccountName("zhihu", "点击打开asir的主页")).toBe("asir");
    expect(usableAccountName("zhihu", "点击进入asir的个人主页")).toBe("asir");
    expect(
      discoveredAccountName("zhihu", [
        { accountId: "a", identityId: "1", name: "点击打开asir的主页", kind: "profile" },
      ]),
    ).toBe("asir");
  });

  it("keeps a generated name when discovery only has a platform label", () => {
    expect(
      discoveredAccountName("douyin", [
        { accountId: "a", identityId: "1", name: "抖音账号", kind: "profile" },
      ]),
    ).toBeNull();
    expect(
      discoveredAccountName("youtube", [
        { accountId: "a", identityId: "1", name: "YouTube 频道", kind: "profile" },
      ]),
    ).toBeNull();
  });
});

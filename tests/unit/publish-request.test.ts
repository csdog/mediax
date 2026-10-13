import { expect, it, vi } from "vitest";
import type { AccountService } from "../../src/main/accounts/AccountService";
import { PublishService } from "../../src/main/publish/PublishService";
import { Database } from "../../src/main/storage/Database";

it("rejects an unsupported content type before opening the account browser", async () => {
  const db = new Database(":memory:");
  const account = db.addAccount("虎扑", "hupu");
  const target = {
    accountId: account.id,
    identityId: "1",
    name: "虎扑主页",
    kind: "profile" as const,
  };
  const adapter = vi.fn();
  const accounts = {
    list: () => [
      {
        ...account,
        login: "logged_in" as const,
        targets: [target],
      },
    ],
    adapter,
    exclusive: (work: () => Promise<void>) => work(),
  } as unknown as AccountService;
  const publishing = new PublishService(db, accounts, "/tmp/mediax-assets");
  await expect(publishing.publish("article", "标题", "正文", [], [target])).rejects.toThrow(
    "虎扑不支持文章",
  );
  expect(adapter).not.toHaveBeenCalled();
  expect(db.tasks()).toEqual([]);
  db.close();
});

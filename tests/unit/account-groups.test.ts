import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "../../src/main/storage/Database";
import {
  createAccountGroup,
  readAccountGroups,
  setAccountGroups,
} from "../../src/main/accounts/groups";

it("persists groups across database reopen and drops deleted account memberships", () => {
  const directory = mkdtempSync(join(tmpdir(), "mediax-groups-"));
  const path = join(directory, "test.sqlite");
  let db = new Database(path);
  try {
    const a = db.addAccount("A", "zhihu");
    const group = createAccountGroup(db, { name: " 工作 ", accountIds: [a.id, a.id] });
    expect(group).toMatchObject({ name: "工作", accountIds: [a.id] });
    const second = createAccountGroup(db, { name: "第二组", accountIds: [] });
    setAccountGroups(db, a.id, [second.id]);
    db.close();
    db = new Database(path);
    expect(readAccountGroups(db)).toEqual([
      { ...group, accountIds: [] },
      { ...second, accountIds: [a.id] },
    ]);
    db.deleteAccount(a.id);
    expect(readAccountGroups(db)).toEqual([
      { ...group, accountIds: [] },
      { ...second, accountIds: [] },
    ]);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it("rejects invalid, duplicate names and nonexistent memberships without changing saved groups", () => {
  const db = new Database(":memory:");
  try {
    const group = createAccountGroup(db, { name: "Work", accountIds: [] });
    for (const input of [
      { name: " ", accountIds: [] },
      { name: "x".repeat(41), accountIds: [] },
      { name: " work ", accountIds: [] },
      { name: "测试", accountIds: ["missing"] },
    ]) {
      expect(() => createAccountGroup(db, input)).toThrow();
      expect(readAccountGroups(db)).toEqual([group]);
    }
  } finally {
    db.close();
  }
});

it("updates multiple memberships without changing other accounts and rejects stale groups atomically", () => {
  const db = new Database(":memory:");
  try {
    const first = db.addAccount("A", "zhihu"),
      second = db.addAccount("B", "toutiao");
    const work = createAccountGroup(db, { name: "工作", accountIds: [second.id] });
    const personal = createAccountGroup(db, { name: "个人", accountIds: [] });
    setAccountGroups(db, first.id, [work.id, personal.id, work.id]);
    expect(readAccountGroups(db).map((g) => g.accountIds)).toEqual([
      [second.id, first.id],
      [first.id],
    ]);
    const saved = readAccountGroups(db);
    expect(() => setAccountGroups(db, first.id, [work.id, "missing"])).toThrow("分组已不存在");
    expect(() => setAccountGroups(db, "missing", [work.id])).toThrow("账号不存在");
    expect(readAccountGroups(db)).toEqual(saved);
    setAccountGroups(db, first.id, []);
    expect(readAccountGroups(db).map((g) => g.accountIds)).toEqual([[second.id], []]);
  } finally {
    db.close();
  }
});

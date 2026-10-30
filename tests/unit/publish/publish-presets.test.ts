import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "../../../src/main/storage/Database";
import {
  createPublishPreset,
  deletePublishPreset,
  readPublishPresets,
} from "../../../src/main/publish/presets";
import { resolvePresetTargets, type PublishPresetInput } from "../../../src/shared/publishPresets";
import type { AccountInfo } from "../../../src/shared/models";

const target = { accountId: "a", identityId: "1", kind: "profile" as const, name: "当前名称" };
const accounts: AccountInfo[] = [
  { id: "a", platform: "zhihu", name: "账号", login: "logged_in", targets: [target] },
];
const input: PublishPresetInput = {
  name: " 工作 ",
  contentKind: "article",
  targets: [target],
  settings: { silent: true, concurrency: 2, bandwidthLimitKbps: 500 },
};

it("persists presets across database reopen, scopes names by content kind, and deletes only the requested preset", () => {
  const directory = mkdtempSync(join(tmpdir(), "mediax-presets-"));
  const path = join(directory, "test.sqlite");
  let db = new Database(path);
  try {
    const first = createPublishPreset(db, { ...input, targets: [target, target] }, accounts);
    const second = createPublishPreset(db, { ...input, contentKind: "moment" }, [
      { ...accounts[0]!, platform: "weibo" },
    ]);
    expect(first.name).toBe("工作");
    expect(first.targets).toEqual([{ accountId: "a", identityId: "1", kind: "profile" }]);
    db.close();
    db = new Database(path);
    expect(readPublishPresets(db)).toEqual([first, second]);
    expect(deletePublishPreset(db, first.id)).toEqual([second]);
    expect(deletePublishPreset(db, first.id)).toEqual([second]);
    expect(readPublishPresets(db)).toEqual([second]);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it("rejects invalid and duplicate input without altering existing presets", () => {
  const db = new Database(":memory:");
  try {
    const saved = createPublishPreset(db, input, accounts);
    for (const invalid of [
      input,
      { ...input, name: " " },
      { ...input, name: "x".repeat(41) },
      { ...input, name: "其他", targets: [] },
      { ...input, name: "其他", targets: [{ ...target, accountId: "missing" }] },
      { ...input, name: "其他", targets: [{ ...target, kind: "page" }] },
      { ...input, name: "其他", settings: { ...input.settings, concurrency: 0 } },
      { ...input, name: "其他", settings: { ...input.settings, bandwidthLimitKbps: -1 } },
    ]) {
      expect(() => createPublishPreset(db, invalid, accounts)).toThrow();
      expect(readPublishPresets(db)).toEqual([saved]);
    }
    expect(() =>
      createPublishPreset(db, { ...input, name: "其他" }, [
        { ...accounts[0]!, platform: "music163" },
      ]),
    ).toThrow("失效");
  } finally {
    db.close();
  }
});

it("resolves the latest identity name, excluding deleted, changed or unsupported identities", () => {
  expect(resolvePresetTargets(input, accounts)).toEqual([target]);
  expect(resolvePresetTargets(input, [])).toEqual([]);
  expect(
    resolvePresetTargets(input, [{ ...accounts[0]!, targets: [{ ...target, kind: "page" }] }]),
  ).toEqual([]);
  expect(resolvePresetTargets({ ...input, contentKind: "audio" }, accounts)).toEqual([]);
});

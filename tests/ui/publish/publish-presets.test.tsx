// @vitest-environment jsdom
import ".././setup";
import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { PublishPresetPicker } from "../../../src/renderer/components/PublishPresetPicker";
import type { AccountInfo } from "../../../src/shared/models";
import type { PublishPreset, PublishPresetInput } from "../../../src/shared/publishPresets";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const target = { accountId: "a", identityId: "1", kind: "profile" as const, name: "最新名称" };
const accounts: AccountInfo[] = [
  { id: "a", name: "账号", platform: "zhihu", login: "logged_in", targets: [target] },
];
const settings = { silent: true, concurrency: 2, bandwidthLimitKbps: 500 };
const preset: PublishPreset = {
  id: "p",
  name: "工作",
  contentKind: "article",
  targets: [{ accountId: "a", identityId: "1", kind: "profile" }],
  settings,
};

function setup(saved: PublishPreset[] = [], available = accounts) {
  let presets = saved;
  const create = vi.fn(async (input: PublishPresetInput) => {
    const next = { id: "new", ...input };
    presets = [...presets, next];
    return next;
  });
  const remove = vi.fn(async (id: string) => {
    presets = presets.filter((item) => item.id !== id);
    return presets;
  });
  const applySettings = vi.fn(async () => settings);
  const onApply = vi.fn();
  window.desktop = {
    publishPresets: vi.fn(async () => presets),
    createPublishPreset: create,
    deletePublishPreset: remove,
    publishSettings: vi.fn(async () => settings),
    setPublishSettings: applySettings,
  } as unknown as typeof window.desktop;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <PublishPresetPicker
        contentKind="article"
        accounts={available}
        targets={[target]}
        onApply={onApply}
        busy={false}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "发布方案" }));
  return { create, remove, applySettings, onApply, client };
}

it("saves the selected identities and execution settings, applies the preset and updates the shared settings cache", async () => {
  const { create, applySettings, onApply, client } = setup();
  await screen.findByText("当前内容类型还没有发布方案。");
  fireEvent.change(screen.getByLabelText("方案名称"), { target: { value: "工作" } });
  fireEvent.click(screen.getByRole("button", { name: "保存当前配置" }));
  const apply = await screen.findByRole("button", { name: "应用方案 工作" });
  expect(create).toHaveBeenCalledWith({
    name: "工作",
    contentKind: "article",
    targets: [target],
    settings,
  });
  fireEvent.click(apply);
  await waitFor(() => expect(onApply).toHaveBeenCalledWith([target]));
  expect(applySettings).toHaveBeenCalledWith(settings);
  expect(client.getQueryData(["desktop", "publish-settings"])).toEqual(settings);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("filters by content kind and deletes a saved preset", async () => {
  const { remove } = setup([
    preset,
    { ...preset, id: "video", name: "视频方案", contentKind: "video" },
  ]);
  fireEvent.click(await screen.findByRole("button", { name: "删除方案 工作" }));
  await screen.findByText("当前内容类型还没有发布方案。");
  expect(remove).toHaveBeenCalledWith("p");
  expect(screen.queryByText("视频方案")).toBeNull();
});

it("restores saved settings over different current settings and resolves the current identity name", async () => {
  const { applySettings, onApply, client } = setup([preset]);
  const apply = await screen.findByRole("button", { name: "应用方案 工作" });
  client.setQueryData(["desktop", "publish-settings"], {
    silent: false,
    concurrency: 5,
    bandwidthLimitKbps: 0,
  });
  fireEvent.click(apply);
  await waitFor(() => expect(onApply).toHaveBeenCalledWith([target]));
  expect(applySettings).toHaveBeenCalledWith(preset.settings);
  expect(client.getQueryData(["desktop", "publish-settings"])).toEqual(preset.settings);
});

it("leaves settings and selected targets untouched when identities are stale", async () => {
  const { applySettings, onApply } = setup([preset], []);
  fireEvent.click(await screen.findByRole("button", { name: "应用方案 工作" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("已失效")));
  expect(applySettings).not.toHaveBeenCalled();
  expect(onApply).not.toHaveBeenCalled();
});

it("keeps the picker open and preserves selected targets if applying settings fails", async () => {
  const { applySettings, onApply } = setup([preset]);
  applySettings.mockRejectedValueOnce(new Error("设置保存失败"));
  fireEvent.click(await screen.findByRole("button", { name: "应用方案 工作" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("设置保存失败"));
  expect(onApply).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
});

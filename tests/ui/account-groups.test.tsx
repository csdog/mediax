// @vitest-environment jsdom
import "./setup";
import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "../../src/renderer/components/ui/tooltip";
import { AccountManagement } from "../../src/renderer/components/AccountManagement";
import type { AccountGroup, AccountInfo } from "../../src/shared/models";

it("creates a group from the empty action, chooses members, and filters accounts", async () => {
  let groups: AccountGroup[] = [];
  const accounts: AccountInfo[] = [
    { id: "a", name: "工作账号", platform: "zhihu", login: "logged_in", targets: [] },
    { id: "b", name: "个人账号", platform: "toutiao", login: "logged_in", targets: [] },
  ];
  const create = vi.fn(async (input: { name: string; accountIds: string[] }) => {
    const group = { id: "group-1", ...input };
    groups = [group];
    return group;
  });
  window.desktop = {
    accountGroups: vi.fn(async () => groups),
    createAccountGroup: create,
  } as unknown as typeof window.desktop;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <AccountManagement
          accounts={accounts}
          busy={false}
          onAuthorize={vi.fn()}
          onOpen={vi.fn()}
          onRefresh={vi.fn(async () => {})}
          onDelete={vi.fn()}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "新建分组", exact: true }));
  const dialog = await screen.findByRole("dialog", { name: "新建分组" });
  expect(
    (within(dialog).getByRole("button", { name: "创建分组" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.change(within(dialog).getByLabelText("分组名称"), { target: { value: "工作" } });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "加入分组 工作账号" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "创建分组" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "新建分组" })).toBeNull());
  expect(create).toHaveBeenCalledWith({ name: "工作", accountIds: ["a"] });
  expect(screen.queryByText("暂无分组")).toBeNull();
  expect(
    screen.getByRole("button", { name: /^工作，1 个账号$/ }).getAttribute("aria-pressed"),
  ).toBe("true");
  const table = within(screen.getByRole("table"));
  expect(table.getByRole("heading", { name: "工作账号" })).toBeTruthy();
  expect(table.queryByRole("heading", { name: "个人账号" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^全部分组/ }));
  expect(table.getByRole("heading", { name: "个人账号" })).toBeTruthy();
});

it("opens row settings in a sheet, cancels edits, saves multiple groups and keeps action controls independent", async () => {
  const account: AccountInfo = {
    id: "a",
    name: "工作账号",
    platform: "zhihu",
    login: "logged_in",
    targets: [],
  };
  let groups: AccountGroup[] = [
    { id: "work", name: "工作", accountIds: ["a"] },
    { id: "personal", name: "个人", accountIds: [] },
  ];
  const save = vi.fn(async (id: string, selected: string[]) => {
    groups = groups.map((g) => ({ ...g, accountIds: selected.includes(g.id) ? [id] : [] }));
    return groups;
  });
  const openAccount = vi.fn();
  window.desktop = {
    accountGroups: vi.fn(async () => groups),
    setAccountGroups: save,
  } as unknown as typeof window.desktop;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <AccountManagement
          accounts={[account]}
          busy={false}
          onAuthorize={vi.fn()}
          onOpen={openAccount}
          onRefresh={vi.fn(async () => {})}
          onDelete={vi.fn()}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "工作，1 个账号" });
  const row = screen.getByRole("row", { name: "工作账号 账号信息" });
  fireEvent.click(within(row).getByRole("checkbox", { name: "选择账号 工作账号" }));
  expect(screen.queryByRole("dialog", { name: "账号设置" })).toBeNull();
  fireEvent.click(within(row).getByRole("button", { name: "打开账号" }));
  expect(openAccount).toHaveBeenCalledWith(account);
  expect(screen.queryByRole("dialog", { name: "账号设置" })).toBeNull();
  fireEvent.click(within(row).getByRole("heading", { name: "工作账号" }));
  let sheet = await screen.findByRole("dialog", { name: "账号设置" });
  expect(sheet.getAttribute("data-slot")).toBe("sheet-content");
  expect(
    within(sheet).getByRole("checkbox", { name: "所属分组 工作" }).getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(within(sheet).getByRole("checkbox", { name: "所属分组 个人" }));
  fireEvent.click(within(sheet).getByRole("button", { name: "取消" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "账号设置" })).toBeNull());
  expect(save).not.toHaveBeenCalled();
  fireEvent.keyDown(row, { key: "Enter" });
  sheet = await screen.findByRole("dialog", { name: "账号设置" });
  expect(
    within(sheet).getByRole("checkbox", { name: "所属分组 个人" }).getAttribute("aria-checked"),
  ).toBe("false");
  fireEvent.click(within(sheet).getByRole("checkbox", { name: "所属分组 个人" }));
  fireEvent.click(within(sheet).getByRole("button", { name: "保存配置" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "账号设置" })).toBeNull());
  expect(save).toHaveBeenCalledWith("a", ["work", "personal"]);
  expect(screen.getByRole("button", { name: "个人，1 个账号" })).toBeTruthy();
  fireEvent.click(row);
  sheet = await screen.findByRole("dialog", { name: "账号设置" });
  expect(
    within(sheet).getByRole("checkbox", { name: "所属分组 个人" }).getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(within(sheet).getByRole("checkbox", { name: "所属分组 工作" }));
  fireEvent.click(within(sheet).getByRole("checkbox", { name: "所属分组 个人" }));
  fireEvent.click(within(sheet).getByRole("button", { name: "保存配置" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "账号设置" })).toBeNull());
  expect(save).toHaveBeenLastCalledWith("a", []);
});

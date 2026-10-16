// @vitest-environment jsdom
import "./setup";
import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnalyticsPage } from "../../src/renderer/pages/AnalyticsPage";
import type { AnalyticsSummary } from "../../src/shared/models";

vi.mock("../../src/renderer/app/WorkspaceContext", () => ({
  useWorkspace: () => ({ page: "analytics", pageTitle: "数据分析" }),
}));

afterEach(() => vi.restoreAllMocks());

function mount(byAccount: AnalyticsSummary["byAccount"]) {
  window.desktop = {
    accounts: async () => [],
    analyticsSummary: async () => ({
      days: 30,
      since: "2026-09-17",
      until: "2026-10-16",
      totals: {
        tasks: 5,
        targets: 5,
        verified: 2,
        failed: 3,
        awaitingUser: 0,
        scheduled: 0,
        pendingOrRunning: 0,
      },
      successRate: 0.4,
      byAccount,
      byPlatform: [],
      daily: [],
    }),
  } as unknown as typeof window.desktop;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 600, 320),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AnalyticsPage />
    </QueryClientProvider>,
  );
}

it("shows real account rates beside the radial chart and allows legend selection", async () => {
  const user = userEvent.setup();
  mount([
    { accountId: "a", name: "同名账号", platform: "zhihu", targets: 4, verified: 1, failed: 3 },
    { accountId: "b", name: "同名账号", platform: "toutiao", targets: 1, verified: 1, failed: 0 },
    { accountId: "c", name: "无发布账号", platform: "weibo", targets: 0, verified: 0, failed: 0 },
  ]);
  const detail = (await screen.findByText("账号健康度明细")).closest('[data-slot="card"]')!;
  const table = within(detail as HTMLElement).getByRole("table");
  const rows = within(table).getAllByRole("row");
  expect(rows).toHaveLength(4);
  expect(within(rows[1]!).getByRole("heading", { name: "同名账号" })).toBeTruthy();
  expect(within(rows[1]!).getByText("知乎")).toBeTruthy();
  expect(rows[1]!.querySelector(".account-identity")).toBeTruthy();
  expect(rows[1]!.textContent).toContain("25%");
  expect(rows[2]!.textContent).toContain("100%");
  expect(rows[3]!.textContent).toContain("—");
  const chart = (await screen.findByText("账号健康度")).closest('[data-slot="card"]')!;
  const firstLegend = await within(chart as HTMLElement).findByText("同名账号 · 知乎");
  const secondLegend = within(chart as HTMLElement).getByText("同名账号 · 头条号");
  expect(within(chart as HTMLElement).queryByText("无发布账号 · 新浪微博")).toBeNull();
  await user.click(firstLegend);
  await waitFor(() => expect(secondLegend.classList.contains("opacity-30")).toBe(true));
  await user.click(firstLegend);
  await waitFor(() => expect(secondLegend.classList.contains("opacity-30")).toBe(false));
});

it("shows empty states when there are no account results", async () => {
  mount([]);
  const chart = (await screen.findByText("账号健康度")).closest('[data-slot="card"]')!;
  const detail = screen.getByText("账号健康度明细").closest('[data-slot="card"]')!;
  expect(within(chart as HTMLElement).getByText("暂无数据")).toBeTruthy();
  expect(within(detail as HTMLElement).getByText("暂无数据")).toBeTruthy();
});

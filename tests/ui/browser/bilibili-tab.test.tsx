// @vitest-environment jsdom
import ".././setup";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "../../../src/renderer/components/ui/tooltip";
import { WorkspaceToolbar } from "../../../src/renderer/components/workspace/WorkspaceToolbar";
import { platformSites } from "../../../src/shared/platformSites";

const state = vi.hoisted(() => ({
  browserTabs: [
    {
      id: "b",
      name: "创作中心",
      url: "https://member.bilibili.com/platform/home",
      icon: undefined as string | undefined,
    },
  ],
  accounts: [{ id: "b", name: "真实账号", platform: "bilibili", avatar: undefined }],
  body: "",
  workspacePage: "accounts",
  records: { tasks: [] },
  activeBrowser: "b",
  activeBrowserViewId: null,
}));
vi.mock("../../../src/renderer/app/WorkspaceContext", () => ({ useWorkspace: () => state }));
vi.mock("../../../src/renderer/components/ui/sidebar", () => ({
  useSidebar: () => ({ state: "expanded", toggleSidebar: vi.fn() }),
}));
vi.mock("../../../src/renderer/hooks/useNativeTabPreview", () => ({
  useNativeTabPreview: vi.fn(),
}));
afterEach(cleanup);

it("uses a Bilibili icon while the page favicon loads, then displays the page icon", () => {
  window.desktop = {
    onBrowserNavigationChanged: () => () => {},
  } as unknown as typeof window.desktop;
  const client = new QueryClient();
  const view = () => (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <WorkspaceToolbar />
      </TooltipProvider>
    </QueryClientProvider>
  );
  const rendered = render(view());
  expect(screen.getByAltText("网站图标").getAttribute("src")).toContain("bilibili.png");
  expect(screen.getByLabelText("账号：真实账号")).toBeTruthy();
  state.browserTabs[0].icon = "data:image/png;base64,cGFnZQ==";
  rendered.rerender(view());
  expect(screen.getByAltText("网站图标").getAttribute("src")).toBe(
    "data:image/png;base64,cGFnZQ==",
  );
});

it.each([
  "weibo",
  "zhihu",
  "xiaohongshu",
  "toutiao",
  "channels",
  "qqmusic",
  "tencentvideo",
  "xhsmerchant",
  "xhsdm",
] as const)(
  "uses the actual %s website icon even in another platform's account tab",
  (platform) => {
    state.browserTabs[0].url = platformSites[platform].home;
    state.browserTabs[0].icon = undefined;
    window.desktop = {
      onBrowserNavigationChanged: () => () => {},
    } as unknown as typeof window.desktop;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <WorkspaceToolbar />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByAltText("网站图标").getAttribute("src")).toContain(`${platform}.png`);
  },
);

it("keeps an unknown site's globe instead of incorrectly using the account platform icon", () => {
  state.browserTabs[0].url = "https://example.org/";
  state.browserTabs[0].icon = undefined;
  window.desktop = {
    onBrowserNavigationChanged: () => () => {},
  } as unknown as typeof window.desktop;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <WorkspaceToolbar />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  expect(screen.queryByAltText("网站图标")).toBeNull();
  expect(screen.getByLabelText("网站图标")).toBeTruthy();
});

// @vitest-environment jsdom
import "./setup";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "../../src/renderer/components/ui/tooltip";
import { BrowserChrome } from "../../src/renderer/components/workspace/BrowserChrome";
const openBrowser = vi.hoisted(() => vi.fn());
const submitOmnibox = vi.hoisted(() => vi.fn());
const workspace = vi.hoisted(() => ({
  activeBrowserViewId: null as string | null,
  browserNavAction: null as null | "back" | "forward" | "reload",
}));
const goBackBrowser = vi.hoisted(() => vi.fn(async () => {}));
const goForwardBrowser = vi.hoisted(() => vi.fn(async () => {}));
const reloadBrowser = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../../src/renderer/app/WorkspaceContext", () => ({
  useWorkspace: () => ({
    activeBrowserViewId: workspace.activeBrowserViewId,
    browserNavAction: workspace.browserNavAction,
    goBackBrowser,
    goForwardBrowser,
    reloadBrowser,
    openBrowser,
    submitOmnibox,
    run: (task: () => unknown) => task(),
  }),
}));

it("keeps history open when focus crosses into a native view, and closes for another DOM control", async () => {
  let hostEvent!: (event: import("../../src/shared/models").NativePopupHostEvent) => void;
  const hide = vi.fn(async () => {});
  const show = vi.fn(async () => {});
  window.desktop = {
    webSearchProvider: async () => ({ name: "Bing" }),
    accounts: async () => [{ id: "acct-1", name: "账号一" }],
    downloads: async () => [],
    browserHistory: async () => [
      { title: "历史条目", url: "https://example.com/", visitedAt: 1, accountId: "acct-1" },
    ],
    onBrowserNavigationChanged: () => () => {},
    onDownloadsChanged: () => () => {},
    onNativePopupHostEvent: (listener) => {
      hostEvent = listener;
      return () => {};
    },
    hideNativePopup: hide,
    showNativePopup: show,
  } as unknown as typeof window.desktop;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <BrowserChrome />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  await waitFor(() => expect(input.getAttribute("aria-expanded")).toBe("true"));
  hide.mockClear();
  fireEvent.blur(input, { relatedTarget: null });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 240));
  });
  expect(hide).not.toHaveBeenCalled();
  expect(input.getAttribute("aria-expanded")).toBe("true");
  fireEvent.blur(input, { relatedTarget: screen.getByRole("button", { name: "扩展" }) });
  await waitFor(() => expect(hide).toHaveBeenCalled());
  expect(input.getAttribute("aria-expanded")).toBe("false");
  fireEvent.focus(input);
  await waitFor(() => expect(input.getAttribute("aria-expanded")).toBe("true"));
  act(() =>
    hostEvent({ type: "action", action: { type: "open-history", url: "https://example.com/" } }),
  );
  expect(openBrowser).toHaveBeenCalledWith(
    { id: "acct-1", name: "账号一" },
    "https://example.com/",
  );
  hide.mockClear();
  unmount();
  expect(hide).toHaveBeenCalledOnce();
});

it("keeps the submitted address visible while a new page is loading", async () => {
  let navigationChanged!: Parameters<typeof window.desktop.onBrowserNavigationChanged>[0];
  const unsubscribe = vi.fn();
  let finishNavigation!: () => void;
  submitOmnibox.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishNavigation = resolve;
      }),
  );
  window.desktop = {
    webSearchProvider: async () => ({ name: "Bing" }),
    accounts: async () => [],
    downloads: async () => [],
    browserHistory: async () => [],
    browserNavigation: async () => ({ url: "https://example.com/final", title: "Example" }),
    browserZoom: async () => ({ factor: 1, percent: 100 }),
    onBrowserNavigationChanged: (listener) => {
      navigationChanged = listener;
      return unsubscribe;
    },
    onDownloadsChanged: () => () => {},
    onNativePopupHostEvent: () => () => {},
    hideNativePopup: async () => {},
    showNativePopup: async () => {},
  } as unknown as typeof window.desktop;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <BrowserChrome />
      </TooltipProvider>
    </QueryClientProvider>
  );
  const { unmount, rerender } = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <BrowserChrome />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "example.com" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(submitOmnibox).toHaveBeenCalledWith("example.com"));
  expect((input as HTMLInputElement).value).toBe("example.com");
  workspace.activeBrowserViewId = "web-new";
  rerender(tree);
  await waitFor(() =>
    expect(client.getQueryData(["desktop", "browser-navigation", "web-new"])).toBeDefined(),
  );
  expect((input as HTMLInputElement).value).toBe("example.com");
  const emit = (id: string, url: string) =>
    act(() =>
      navigationChanged(id, {
        url,
        title: "Example",
        canGoBack: false,
        canGoForward: false,
      }),
    );
  emit("other-tab", "https://other.example/");
  expect((input as HTMLInputElement).value).toBe("example.com");
  emit("web-new", "https://example.com/start");
  await waitFor(() => expect((input as HTMLInputElement).value).toBe("https://example.com/start"));
  emit("web-new", "https://example.com/final");
  await waitFor(() => expect((input as HTMLInputElement).value).toBe("https://example.com/final"));
  fireEvent.change(input, { target: { value: "still typing" } });
  emit("web-new", "https://example.com/another");
  expect((input as HTMLInputElement).value).toBe("still typing");
  fireEvent.blur(input, { relatedTarget: screen.getByRole("button", { name: "扩展" }) });
  await waitFor(() =>
    expect((input as HTMLInputElement).value).toBe("https://example.com/another"),
  );
  await act(async () => finishNavigation());
  workspace.activeBrowserViewId = null;
  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});

it("keeps omnibox editing and selection across native focus, with keyboard suggestions and dismissal", async () => {
  workspace.activeBrowserViewId = "web-edit";
  let hostEvent!: Parameters<typeof window.desktop.onNativePopupHostEvent>[0];
  const show = vi.fn(async () => {});
  window.desktop = {
    webSearchProvider: async () => ({ name: "Bing" }),
    accounts: async () => [],
    downloads: async () => [],
    browserNavigation: async () => ({
      url: "https://current.example/",
      title: "Current",
      canGoBack: false,
      canGoForward: false,
    }),
    browserZoom: async () => ({ factor: 1, percent: 100 }),
    browserHistory: async () => [
      { title: "Suggested", url: "https://suggested.example/", visitedAt: 1 },
    ],
    onBrowserNavigationChanged: () => () => {},
    onDownloadsChanged: () => () => {},
    onNativePopupHostEvent: (listener) => {
      hostEvent = listener;
      return () => {};
    },
    hideNativePopup: async () => {},
    showNativePopup: show,
  } as unknown as typeof window.desktop;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <BrowserChrome />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  const input = screen.getByRole("combobox") as HTMLInputElement;
  await waitFor(() => expect(input.value).toBe("https://current.example/"));
  await user.click(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  await user.keyboard("draft");
  await waitFor(() => expect(input.getAttribute("aria-expanded")).toBe("true"));
  input.setSelectionRange(1, 3);
  act(() => input.blur());
  act(() => hostEvent({ type: "focus-omnibox" }));
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("draft");
  expect(input.selectionStart).toBe(1);
  expect(input.selectionEnd).toBe(3);
  act(() => input.blur());
  act(() => input.focus());
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  // Resume typing after a real refocus, which resets the suggestion query.
  await user.keyboard("{Backspace}draft");
  await user.keyboard("{Control>}a{/Control}");
  expect(input.selectionEnd! - input.selectionStart!).toBe(5);
  await user.keyboard("{ArrowLeft}");
  expect(input.selectionStart).toBe(input.selectionEnd);
  await user.keyboard("{ArrowDown}");
  expect(input.value).toBe("https://suggested.example/");
  await user.keyboard("{ArrowDown}");
  expect(input.value).toBe("draft");
  await waitFor(() =>
    expect(show).toHaveBeenLastCalledWith(
      expect.objectContaining({ historyIndex: 1, historySearchQuery: "draft" }),
    ),
  );
  await user.keyboard("{ArrowUp}{ArrowUp}");
  expect(input.value).toBe("draft");
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(input.value).toBe("draft");
  await user.keyboard("{Escape}");
  expect(input.value).toBe("https://current.example/");
  expect(input.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(input);
  // A native page click can leave document.activeElement pointing at the omnibox.
  // Its host notification must clear DOM focus even with no open popup (after Escape).
  input.setSelectionRange(3, 3);
  expect(document.activeElement).toBe(input);
  act(() => hostEvent({ type: "closed" }));
  expect(document.activeElement).not.toBe(input);
  await user.click(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  // A second click while editing should place the caret, rather than select again.
  input.setSelectionRange(4, 4);
  fireEvent.mouseDown(input);
  fireEvent.mouseUp(input);
  expect(input.selectionStart).toBe(4);
  expect(input.selectionEnd).toBe(4);
  await user.keyboard("x");
  await waitFor(() => expect(input.getAttribute("aria-expanded")).toBe("true"));
  act(() => hostEvent({ type: "closed" }));
  expect(input.getAttribute("aria-expanded")).toBe("false");
  await user.click(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  await user.tab();
  expect(input.getAttribute("aria-expanded")).toBe("false");
  unmount();
  workspace.activeBrowserViewId = null;
});

it("shows a loading state for back, forward, and reload", async () => {
  workspace.activeBrowserViewId = "web-loading";
  let navigationChanged!: Parameters<typeof window.desktop.onBrowserNavigationChanged>[0];
  window.desktop = {
    webSearchProvider: async () => ({ name: "Bing" }),
    accounts: async () => [],
    downloads: async () => [],
    browserNavigation: async () => ({
      url: "https://example.com/",
      title: "Example",
      canGoBack: true,
      canGoForward: true,
      loading: false,
    }),
    browserZoom: async () => ({ factor: 1, percent: 100 }),
    onBrowserNavigationChanged: (listener) => {
      navigationChanged = listener;
      return () => {};
    },
    onDownloadsChanged: () => () => {},
    onNativePopupHostEvent: () => () => {},
    hideNativePopup: async () => {},
    showNativePopup: async () => {},
  } as unknown as typeof window.desktop;
  const busy = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-busy");
  const mount = (action: typeof workspace.browserNavAction) => {
    workspace.browserNavAction = action;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <BrowserChrome />
        </TooltipProvider>
      </QueryClientProvider>,
    );
  };
  const back = mount("back");
  await waitFor(() => expect(busy("后退")).toBe("true"));
  expect(busy("前进")).toBeNull();
  expect(busy("刷新")).toBe("true");
  back.unmount();
  const forward = mount("forward");
  await waitFor(() => expect(busy("前进")).toBe("true"));
  expect(busy("后退")).toBeNull();
  expect(busy("刷新")).toBe("true");
  forward.unmount();
  const reload = mount("reload");
  await waitFor(() => expect(busy("刷新")).toBe("true"));
  expect(busy("后退")).toBeNull();
  expect(busy("前进")).toBeNull();
  reload.unmount();
  const idle = mount(null);
  await waitFor(() => expect(busy("刷新")).toBeNull());
  act(() =>
    navigationChanged("web-loading", {
      url: "https://example.com/next",
      title: "Example",
      canGoBack: true,
      canGoForward: true,
      loading: true,
    }),
  );
  await waitFor(() => expect(busy("刷新")).toBe("true"));
  expect(busy("后退")).toBeNull();
  expect(busy("前进")).toBeNull();
  idle.unmount();
  workspace.activeBrowserViewId = null;
  workspace.browserNavAction = null;
});

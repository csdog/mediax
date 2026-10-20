import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { userErrorMessage } from "../../shared/userError";
import type {
  BrowserNavigation,
  AccountInfo,
  ContentKind,
  ImageAsset,
  Task,
  TaskTarget,
  DesktopPage,
  PlatformId,
  Target,
  TabAction,
} from "../../shared/models";
import { useTabPreview } from "./useTabPreview";
import { useBrowserNavigation } from "./useBrowserNavigation";
import { useAccountBrowserLayout } from "./useAccountBrowserLayout";
import { usePublishSettings } from "./usePublishSettings";
import { preferredPageForFiles, supportedKinds } from "../../shared/content";
import { applyLocalFiles } from "@/lib/importLocalFiles";
import { desktopPages } from "@/app/navigation";
import { accountsOptions, historyOptions } from "@/app/queries";
import { publishKindMeta } from "@/lib/publishKindMeta";

type BrowserTab = { icon?: string } & (
  | { id: string; name: string; kind?: undefined }
  | { id: string; name: string; kind: "new" }
  | { id: string; name: string; kind: "page"; page: DesktopPage }
  | { id: string; name: string; kind: "compose"; contentKind: ContentKind }
  | { id: string; name: string; kind: "web"; url: string }
);
type BrowserNavAction = "back" | "forward" | "reload";

const emptyAccounts: AccountInfo[] = [];
const emptyRecords: { tasks: Task[]; targets: TaskTarget[] } = { tasks: [], targets: [] };
export function useWorkspaceController() {
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [workspacePage, setWorkspacePage] = useState<DesktopPage>("accounts");
  const settingsOpen = pathname === "/settings";
  const routePage = desktopPages.find((item) => pathname === `/${item.id}`)?.id;
  const selectKindRef = useRef<(kind: ContentKind) => void>(() => {});
  const [initialized, setInitialized] = useState(false);
  const accountsQuery = useQuery({
    ...accountsOptions,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });
  const historyQuery = useQuery({
    ...historyOptions,
    enabled: initialized,
    refetchInterval: 1500,
    refetchIntervalInBackground: true,
  });
  const accounts = accountsQuery.data ?? emptyAccounts;
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const records = historyQuery.data ?? emptyRecords;
  const setAccounts = (next: React.SetStateAction<AccountInfo[]>) =>
    queryClient.setQueryData(accountsOptions.queryKey, (old: AccountInfo[] | undefined) =>
      typeof next === "function" ? next(old ?? []) : next,
    );
  const [name, setName] = useState("");
  const [contentKind, setContentKind] = useState<ContentKind>("moment");
  const contentKindRef = useRef(contentKind);
  contentKindRef.current = contentKind;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<ImageAsset[]>([]);
  const setNotice = useCallback((message: string) => {
    if (!message) return;
    toast(message);
  }, []);
  const operation = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), retry: false });
  const busy = operation.isPending;
  useEffect(() => {
    const error = accountsQuery.error ?? historyQuery.error;
    if (error) toast.error(userErrorMessage(error));
  }, [accountsQuery.error, historyQuery.error]);
  const [selectedTargets, setSelectedTargets] = useState<Target[]>([]);
  selectKindRef.current = (kind: ContentKind) => {
    if (contentKindRef.current === kind) return;
    contentKindRef.current = kind;
    setContentKind(kind);
    setImages([]);
    setSelectedTargets((targets) =>
      targets.filter((target) => {
        const account = accountsRef.current.find((item) => item.id === target.accountId);
        return account ? supportedKinds(account.platform).includes(kind) : false;
      }),
    );
  };
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([]);
  const closedTabs = useRef<BrowserTab[]>([]);
  const [activeBrowser, setActiveBrowser] = useState<string | null>(null);
  const activeTab = browserTabs.find((tab) => tab.id === activeBrowser);
  const isNewTab = activeTab?.kind === "new";
  const isPageTab = activeTab?.kind === "page";
  const isComposeTab = activeTab?.kind === "compose";
  const activeBrowserViewId =
    !activeBrowser || isNewTab || isPageTab || isComposeTab ? null : activeBrowser;
  const page =
    activeTab?.kind === "page"
      ? activeTab.page
      : activeBrowser
        ? workspacePage
        : (routePage ?? workspacePage);
  const setPage = (next: DesktopPage, opts?: { kind?: ContentKind }) => {
    setWorkspacePage(next);
    if (opts?.kind) selectKindRef.current(opts.kind);
    else if (next === "compose") selectKindRef.current("moment");
    else if (next === "video") selectKindRef.current("video");
    void navigate({ to: `/${next}` });
  };
  const setSettingsOpen = (open: boolean) => {
    if (open) void navigate({ to: "/settings" });
    else
      void navigate({
        to: `/${activeTab?.kind === "page" ? activeTab.page : workspacePage}`,
      });
  };
  const openAppPage = (next: DesktopPage) => {
    if (isNewTab && activeBrowser) {
      const id = activeBrowser;
      const title = desktopPages.find((item) => item.id === next)?.title ?? "页面";
      setBrowserTabs((tabs) =>
        tabs.map((tab) =>
          tab.id === id ? { id, name: title, kind: "page" as const, page: next } : tab,
        ),
      );
      void navigate({ to: `/${next}` });
      return;
    }
    setActiveBrowser(null);
    setPage(next);
  };
  const authorizingAccountId =
    activeBrowserViewId &&
    !activeBrowserViewId.startsWith("web-") &&
    accounts.find((account) => account.id === activeBrowserViewId)?.login !== "logged_in"
      ? activeBrowserViewId
      : null;
  useQuery({
    queryKey: ["desktop", "refresh-account", authorizingAccountId],
    enabled: Boolean(authorizingAccountId),
    queryFn: async () => {
      const updated = await window.desktop.refreshAccount(authorizingAccountId!);
      setAccounts((old) => old.map((account) => (account.id === updated.id ? updated : account)));
      if (updated.login === "logged_in") toast.success(`${updated.name} 已登录`);
      return updated;
    },
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    retry: false,
  });
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const tabPreview = useTabPreview({ hoveredTab, browserTabs });
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const openSettings = () => setSettingsOpen(true);
  const [focusedTask, setFocusedTask] = useState<string | undefined>();
  const [composeScheduleAt, setComposeScheduleAt] = useState<Date | null>(null);
  const openPublish = (kind: ContentKind) => {
    selectKindRef.current(kind);
    const tab: BrowserTab = {
      id: `compose-${crypto.randomUUID()}`,
      name: publishKindMeta[kind].title,
      kind: "compose",
      contentKind: kind,
    };
    setHoveredTab(null);
    setBrowserTabs((tabs) => [...tabs, tab]);
    setActiveBrowser(tab.id);
  };
  const openComposeSchedule = (at: Date) => {
    setComposeScheduleAt(at);
    openPublish("moment");
  };
  const clearComposeSchedule = () => setComposeScheduleAt(null);
  useEffect(() => {
    if (activeTab?.kind !== "compose") return;
    selectKindRef.current(activeTab.contentKind);
  }, [activeTab]);
  const removeAccount = async (id: string) => {
    setBrowserTabs((tabs) => tabs.filter((tab) => tab.id !== id));
    setActiveBrowser((current) => (current === id ? null : current));
    setSelectedTargets((targets) => targets.filter((target) => target.accountId !== id));
    await window.desktop.deleteAccount(id);
    setAccounts((old) => old.filter((account) => account.id !== id));
    await queryClient.fetchQuery(historyOptions);
  };
  const openBrowser = async (account: { id: string; name: string }, url?: string) => {
    setHoveredTab(null);
    setBrowserTabs((tabs) => {
      const remaining = isNewTab ? tabs.filter((tab) => tab.id !== activeBrowser) : tabs;
      return remaining.some((tab) => tab.id === account.id)
        ? remaining
        : [...remaining, { id: account.id, name: "正在加载…" }];
    });
    setActiveBrowser(account.id);
    await (url !== undefined
      ? window.desktop.openAccount(account.id, url)
      : window.desktop.openAccount(account.id));
    syncWebTab(account.id, await window.desktop.browserNavigation(account.id));
    await queryClient.fetchQuery({ ...accountsOptions, staleTime: 0 });
  };
  const openWebBrowser = async (
    url: string,
    existing?: { id: string; name: string; url: string },
  ) => {
    setHoveredTab(null);
    const id = existing?.id ?? `web-${crypto.randomUUID()}`;
    let name = existing?.name ?? url;
    try {
      name = existing?.name ?? new URL(url).hostname;
    } catch {
      name = existing?.name ?? url;
    }
    const tab: BrowserTab = { id, name, kind: "web", url };
    setBrowserTabs((tabs) => {
      const remaining = isNewTab ? tabs.filter((item) => item.id !== activeBrowser) : tabs;
      return remaining.some((item) => item.id === id)
        ? remaining.map((item) => (item.id === id ? tab : item))
        : [...remaining, tab];
    });
    setActiveBrowser(id);
    await window.desktop.openWebBrowser(id, url);
  };
  const syncWebTab = useCallback(
    (id: string, nav: Pick<BrowserNavigation, "url" | "title" | "icon">) => {
      setBrowserTabs((tabs) =>
        tabs.map((tab) => {
          if (tab.id !== id || tab.kind === "new" || tab.kind === "page" || tab.kind === "compose")
            return tab;
          let name = nav.title.trim() || tab.name;
          try {
            if (!nav.title.trim()) name = new URL(nav.url).hostname;
          } catch {
            /* keep */
          }
          return { ...tab, ...(tab.kind === "web" ? { url: nav.url } : {}), name, icon: nav.icon };
        }),
      );
    },
    [],
  );
  useEffect(() => window.desktop.onBrowserNavigationChanged(syncWebTab), [syncWebTab]);
  const submitOmnibox = async (input: string) => {
    const url = await window.desktop.resolveOmniboxUrl(input);
    if (!url) throw new Error("请输入搜索内容或网址");
    if (activeBrowserViewId) {
      const nav = await window.desktop.navigateBrowser(activeBrowserViewId, url);
      syncWebTab(activeBrowserViewId, nav);
      return;
    }
    await openWebBrowser(url);
  };
  const [browserNavAction, setBrowserNavAction] = useState<BrowserNavAction | null>(null);
  const sawBrowserLoading = useRef(false);
  const browserNavigationQuery = useBrowserNavigation(activeBrowserViewId);
  useEffect(() => {
    const loading = Boolean(browserNavigationQuery.data?.loading);
    if (loading) sawBrowserLoading.current = true;
    else if (sawBrowserLoading.current) {
      sawBrowserLoading.current = false;
      setBrowserNavAction(null);
    }
  }, [browserNavigationQuery.data?.loading]);
  const primeBrowserLoading = () => {
    if (!activeBrowserViewId) return;
    queryClient.setQueryData<BrowserNavigation>(
      ["desktop", "browser-navigation", activeBrowserViewId],
      (current) => (current ? { ...current, loading: true } : current),
    );
  };
  const finishBrowserNav = async (
    action: BrowserNavAction,
    runNav: () => Promise<BrowserNavigation>,
  ) => {
    if (!activeBrowserViewId) return;
    const id = activeBrowserViewId;
    setBrowserNavAction(action);
    primeBrowserLoading();
    try {
      const nav = await runNav();
      queryClient.setQueryData(["desktop", "browser-navigation", id], nav);
      syncWebTab(id, nav);
      if (!nav.loading) {
        sawBrowserLoading.current = false;
        setBrowserNavAction(null);
      }
    } catch (error) {
      sawBrowserLoading.current = false;
      setBrowserNavAction(null);
      throw error;
    }
  };
  const goBackBrowser = () =>
    finishBrowserNav("back", () => window.desktop.goBackBrowser(activeBrowserViewId!));
  const goForwardBrowser = () =>
    finishBrowserNav("forward", () => window.desktop.goForwardBrowser(activeBrowserViewId!));
  const reloadBrowser = () =>
    finishBrowserNav("reload", () => window.desktop.reloadBrowser(activeBrowserViewId!));
  const {
    publishSettings,
    silentPublish,
    setSilentPublish,
    setPublishConcurrency,
    setPublishBandwidthLimitKbps,
  } = usePublishSettings();
  const concealBrowser =
    silentPublish &&
    records.targets.some((target) => ["pending", "running", "submitted"].includes(target.status));
  const { browserPane } = useAccountBrowserLayout({
    activeBrowser: activeBrowserViewId,
    settingsOpen,
    concealBrowser,
    setNotice,
  });
  const reload = async () => {
    await Promise.all([
      queryClient.fetchQuery({ ...accountsOptions, staleTime: 0 }),
      queryClient.fetchQuery(historyOptions),
    ]);
  };
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await operation.mutateAsync(fn);
    } catch (error) {
      toast.error(userErrorMessage(error));
    }
  };
  useEffect(() => {
    void run(async () => {
      const loadedAccounts = await queryClient.fetchQuery(accountsOptions);
      setAccounts(loadedAccounts);
      await queryClient.fetchQuery(historyOptions);
      const saved = await window.desktop.workspaceSession?.();
      if (saved && Array.isArray(saved.tabs)) {
        const restored: BrowserTab[] = saved.tabs.flatMap((tab) => {
          if (tab.kind === "new") return [{ id: tab.id, name: "新标签页", kind: "new" as const }];
          if (
            tab.kind === "page" &&
            tab.page &&
            desktopPages.some((item) => item.id === tab.page)
          ) {
            const title = desktopPages.find((item) => item.id === tab.page)?.title ?? "发布记录";
            return [{ id: tab.id, name: title, kind: "page" as const, page: tab.page }];
          }
          if (tab.kind === "web" && typeof tab.url === "string") {
            let name = tab.url;
            try {
              name = new URL(tab.url).hostname;
            } catch {
              name = tab.url;
            }
            return [{ id: tab.id, name, kind: "web" as const, url: tab.url }];
          }
          if (
            tab.kind === "compose" &&
            (tab.contentKind === "article" ||
              tab.contentKind === "moment" ||
              tab.contentKind === "video" ||
              tab.contentKind === "audio")
          )
            return [
              {
                id: tab.id,
                name: publishKindMeta[tab.contentKind].title,
                kind: "compose" as const,
                contentKind: tab.contentKind,
              },
            ];
          const account = loadedAccounts.find((a) => a.id === tab.id);
          return account ? [{ id: account.id, name: "正在加载…" }] : [];
        });
        setBrowserTabs(restored);
        setPage(saved.page);
        for (const tab of restored) {
          if (tab.kind === "new" || tab.kind === "page" || tab.kind === "compose") continue;
          try {
            if (tab.kind === "web") await window.desktop.openWebBrowser(tab.id, tab.url);
            else await window.desktop.openAccount(tab.id);
            syncWebTab(tab.id, await window.desktop.browserNavigation(tab.id));
          } catch (error) {
            toast.error(`恢复 ${tab.name} 失败：${userErrorMessage(error)}`);
          }
        }
        setActiveBrowser(restored.some((tab) => tab.id === saved.activeId) ? saved.activeId : null);
      }
      const d = await window.desktop.loadDraft();
      const restoredPage = saved?.page;
      let kind: ContentKind = d.contentKind ?? "moment";
      let nextImages = d.images;
      if (restoredPage === "video") {
        if (kind !== "video") nextImages = [];
        kind = "video";
      } else if (restoredPage === "compose" && kind === "video") {
        kind = "moment";
        nextImages = [];
      }
      setContentKind(kind);
      setTitle(d.title ?? "");
      setBody(d.body);
      setImages(nextImages);
      setInitialized(true);
    });
  }, []);
  useEffect(() => {
    if (!initialized) return;
    void window.desktop
      .saveWorkspaceSession?.({
        tabs: browserTabs.map((tab) => {
          if (tab.kind === "new") return { id: tab.id, kind: "new" as const };
          if (tab.kind === "page") return { id: tab.id, kind: "page" as const, page: tab.page };
          if (tab.kind === "compose")
            return { id: tab.id, kind: "compose" as const, contentKind: tab.contentKind };
          if (tab.kind === "web") return { id: tab.id, kind: "web" as const, url: tab.url };
          return { id: tab.id };
        }),
        activeId: activeBrowser,
        page: workspacePage,
      })
      ?.catch((error) => toast.error(userErrorMessage(error, "标签页未能保存，请稍后重试。")));
  }, [initialized, browserTabs, activeBrowser, workspacePage]);
  useEffect(() => {
    if (!initialized || settingsOpen) return;
    if (activeTab?.kind === "page") {
      if (pathname !== `/${activeTab.page}`) void navigate({ to: `/${activeTab.page}` });
      return;
    }
    if (activeBrowser) return;
    if (pathname !== `/${workspacePage}`) void navigate({ to: `/${workspacePage}` });
  }, [initialized, settingsOpen, activeBrowser, activeTab, workspacePage, pathname, navigate]);
  useEffect(() => {
    if (!initialized) return;
    return window.desktop.onCommand?.((command) => {
      if (command.action === "toast") {
        toast([command.title, command.body].filter(Boolean).join("："), { duration: 7000 });
        return;
      }
      if (busy && command.action !== "navigate") return;
      if (command.action === "open-web") {
        void run(() => openWebBrowser(command.url));
      } else if (command.action === "tab") {
        if (!settingsOpen && !accountDialogOpen && !publishDialogOpen)
          handleTabCommand(command.operation);
      } else if (command.action === "settings") {
        void openSettings();
      } else if (command.action === "navigate") {
        if (command.page === "compose") openPublish("moment");
        else if (command.page === "video") openPublish("video");
        else {
          setActiveBrowser(null);
          setPage(command.page);
        }
        setFocusedTask(command.taskId);
        void run(reload);
        if (command.page === "compose" || command.page === "video")
          requestAnimationFrame(() => document.getElementById("post-body")?.focus());
      } else if (command.action === "save-draft") {
        void run(async () => {
          await window.desktop.saveDraft(body, images, contentKind, title);
          toast.success("草稿已保存到本机");
        });
      } else if (command.action === "import-markdown") {
        openPublish(contentKind === "video" || contentKind === "audio" ? "moment" : contentKind);
        void run(async () => {
          const text = await window.desktop.importMarkdown();
          if (text !== null) setBody(text);
        });
      } else if (command.action === "open-files") {
        setSettingsOpen(false);
        const nextKind =
          preferredPageForFiles(command.paths) === "video" && contentKind !== "audio"
            ? "video"
            : contentKind === "video" || contentKind === "audio"
              ? contentKind
              : "moment";
        openPublish(nextKind);
        void run(async () => {
          const result = await applyLocalFiles(command.paths, nextKind, images);
          if (result.markdown != null) setBody(result.markdown);
          setImages(result.images);
          setNotice(result.notice);
          requestAnimationFrame(() => document.getElementById("post-body")?.focus());
        });
      }
    });
  }, [
    body,
    images,
    contentKind,
    title,
    initialized,
    busy,
    browserTabs,
    activeBrowser,
    settingsOpen,
    accountDialogOpen,
    publishDialogOpen,
  ]);
  const closeBrowserTab = async (id: string) => {
    setHoveredTab(null);
    const tab = browserTabs.find((item) => item.id === id);
    if (tab && tab.kind !== "new" && tab.kind !== "page" && tab.kind !== "compose")
      await window.desktop.closeAccountBrowser(id);
    const index = browserTabs.findIndex((item) => item.id === id);
    const closed = browserTabs[index];
    if (closed) closedTabs.current = [...closedTabs.current.slice(-19), closed];
    setBrowserTabs((tabs) => tabs.filter((item) => item.id !== id));
    if (activeBrowser === id)
      setActiveBrowser(browserTabs[index + 1]?.id ?? browserTabs[index - 1]?.id ?? null);
  };
  const newBrowserTab = () => {
    const tab: BrowserTab = { id: `new-${crypto.randomUUID()}`, name: "新标签页", kind: "new" };
    setHoveredTab(null);
    setBrowserTabs((tabs) => [...tabs, tab]);
    setActiveBrowser(tab.id);
  };
  const handleTabCommand = (operation: TabAction) => {
    setHoveredTab(null);
    if (operation === "new") newBrowserTab();
    else if (operation === "close" && activeBrowser) void run(() => closeBrowserTab(activeBrowser));
    else if (operation === "next" || operation === "previous") {
      const ids = [null, ...browserTabs.map((tab) => tab.id)];
      const index = ids.indexOf(activeBrowser);
      setActiveBrowser(ids[(index + (operation === "next" ? 1 : ids.length - 1)) % ids.length]);
    } else if (operation === "reopen") {
      const tab = closedTabs.current.pop();
      if (!tab) return;
      if (tab.kind === "new" || tab.kind === "page" || tab.kind === "compose") {
        setBrowserTabs((tabs) => [...tabs, tab]);
        setActiveBrowser(tab.id);
      } else if (tab.kind === "web") void run(() => openWebBrowser(tab.url, tab));
      else if (accounts.some((a) => a.id === tab.id)) void run(() => openBrowser(tab));
    }
  };
  const pageTitle = desktopPages.find((item) => item.id === page)?.title ?? "MediaX";
  const workspaceTitle = desktopPages.find((item) => item.id === workspacePage)?.title ?? "MediaX";
  return {
    page,
    setPage,
    openAppPage,
    workspacePage,
    workspaceTitle,
    openPublish,
    accounts,
    setAccounts,
    name,
    setName,
    contentKind,
    setContentKind,
    title,
    setTitle,
    body,
    setBody,
    images,
    setImages,
    setNotice,
    busy,
    records,
    selectedTargets,
    setSelectedTargets,
    publishDialogOpen,
    setPublishDialogOpen,
    accountDialogOpen,
    setAccountDialogOpen,
    platform,
    setPlatform,
    browserTabs,
    activeBrowser,
    setActiveBrowser,
    publishSettings,
    silentPublish,
    setSilentPublish,
    setPublishConcurrency,
    setPublishBandwidthLimitKbps,
    concealBrowser,
    isNewTab,
    isPageTab,
    isComposeTab,
    activeBrowserViewId,
    hoveredTab,
    setHoveredTab,
    tabPreview,
    browserPane,
    avatarMenuOpen,
    setAvatarMenuOpen,
    sidebarOpen,
    setSidebarOpen,
    settingsOpen,
    setSettingsOpen,
    openSettings,
    focusedTask,
    setFocusedTask,
    composeScheduleAt,
    openComposeSchedule,
    clearComposeSchedule,
    openBrowser,
    openWebBrowser,
    submitOmnibox,
    goBackBrowser,
    goForwardBrowser,
    reloadBrowser,
    browserNavAction,
    removeAccount,
    reload,
    run,
    closeBrowserTab,
    newBrowserTab,
    pageTitle,
  };
}

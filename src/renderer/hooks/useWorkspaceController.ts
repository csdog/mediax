import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type {
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
import { useAccountBrowserLayout } from "./useAccountBrowserLayout";
import { usePublishSettings } from "./usePublishSettings";
import { supportedKinds } from "../../shared/content";
import { navigation } from "@/app/navigation";
import { accountsOptions, historyOptions } from "@/app/queries";
const emptyAccounts: AccountInfo[] = [];
const emptyRecords: { tasks: Task[]; targets: TaskTarget[] } = { tasks: [], targets: [] };
export function useWorkspaceController() {
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [lastPage, setLastPage] = useState<DesktopPage>("accounts");
  const settingsOpen = pathname === "/settings";
  const routePage = navigation.find((item) => pathname === `/${item.id}`)?.id;
  const page = routePage ?? lastPage;
  const selectKindRef = useRef<(kind: ContentKind) => void>(() => {});
  const setPage = (next: DesktopPage) => {
    setLastPage(next);
    if (next === "compose") selectKindRef.current("moment");
    if (next === "video") selectKindRef.current("video");
    void navigate({ to: `/${next}` });
  };
  const setSettingsOpen = (open: boolean) => {
    if (open) {
      setLastPage(page);
      void navigate({ to: "/settings" });
    } else void navigate({ to: `/${page}` });
  };
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
  const [notice, setNotice] = useState("");
  const operation = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), retry: false });
  const busy = operation.isPending;
  useEffect(() => {
    const error = accountsQuery.error ?? historyQuery.error;
    if (error) setNotice(error.message);
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
  const [browserTabs, setBrowserTabs] = useState<{ id: string; name: string; kind?: "new" }[]>([]);
  const closedTabs = useRef<{ id: string; name: string; kind?: "new" }[]>([]);
  const [activeBrowser, setActiveBrowser] = useState<string | null>(null);
  const isNewTab = browserTabs.some((tab) => tab.id === activeBrowser && tab.kind === "new");
  const activeAccountId = isNewTab ? null : activeBrowser;
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const tabPreview = useTabPreview({ hoveredTab, browserTabs });
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const openSettings = () => setSettingsOpen(true);
  const [focusedTask, setFocusedTask] = useState<string | undefined>();
  const removeAccount = async (id: string) => {
    setBrowserTabs((tabs) => tabs.filter((tab) => tab.id !== id));
    setActiveBrowser((current) => (current === id ? null : current));
    setSelectedTargets((targets) => targets.filter((target) => target.accountId !== id));
    await window.desktop.deleteAccount(id);
    setAccounts((old) => old.filter((account) => account.id !== id));
    await queryClient.fetchQuery(historyOptions);
  };
  const openBrowser = async (account: { id: string; name: string }) => {
    setHoveredTab(null);
    setBrowserTabs((tabs) => {
      const remaining = isNewTab ? tabs.filter((tab) => tab.id !== activeBrowser) : tabs;
      return remaining.some((tab) => tab.id === account.id) ? remaining : [...remaining, account];
    });
    setActiveBrowser(account.id);
    await window.desktop.openAccount(account.id);
    await queryClient.fetchQuery({ ...accountsOptions, staleTime: 0 });
  };
  const { silentPublish, setSilentPublish } = usePublishSettings();
  const concealBrowser =
    silentPublish &&
    records.targets.some((target) => ["pending", "running", "submitted"].includes(target.status));
  const { browserPane } = useAccountBrowserLayout({
    activeBrowser,
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
    setNotice("");
    try {
      await operation.mutateAsync(fn);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };
  useEffect(() => {
    setBrowserTabs((tabs) => {
      let changed = false;
      const next = tabs.map((tab) => {
        const account = accounts.find((item) => item.id === tab.id);
        if (!account || account.name === tab.name) return tab;
        changed = true;
        return { ...tab, name: account.name };
      });
      return changed ? next : tabs;
    });
  }, [accounts]);
  useEffect(() => {
    void run(async () => {
      const loadedAccounts = await queryClient.fetchQuery(accountsOptions);
      setAccounts(loadedAccounts);
      await queryClient.fetchQuery(historyOptions);
      const saved = await window.desktop.workspaceSession?.();
      if (saved && Array.isArray(saved.tabs)) {
        const restored = saved.tabs.flatMap((tab) => {
          if (tab.kind === "new") return [{ ...tab, name: "新标签页" }];
          const account = loadedAccounts.find((a) => a.id === tab.id);
          return account ? [{ id: account.id, name: account.name }] : [];
        });
        setBrowserTabs(restored);
        setPage(saved.page);
        for (const tab of restored) {
          if (tab.kind === "new") continue;
          try {
            await window.desktop.openAccount(tab.id);
          } catch (error) {
            setNotice(`恢复 ${tab.name} 失败：${String(error)}`);
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
        tabs: browserTabs.map(({ id, kind }) => (kind === "new" ? { id, kind } : { id })),
        activeId: activeBrowser,
        page,
      })
      ?.catch((error) => setNotice(`保存标签页失败：${String(error)}`));
  }, [initialized, browserTabs, activeBrowser, page]);
  useEffect(() => {
    if (!initialized) return;
    return window.desktop.onCommand?.((command) => {
      if (busy && command.action !== "navigate") return;
      if (command.action === "tab") {
        if (!settingsOpen && !accountDialogOpen && !publishDialogOpen)
          handleTabCommand(command.operation);
      } else if (command.action === "settings") {
        void openSettings();
      } else if (command.action === "navigate") {
        setActiveBrowser(null);
        setPage(command.page);
        setFocusedTask(command.taskId);
        void run(reload);
        if (command.page === "compose" || command.page === "video")
          requestAnimationFrame(() => document.getElementById("post-body")?.focus());
      } else if (command.action === "save-draft") {
        void run(async () => {
          await window.desktop.saveDraft(body, images, contentKind, title);
          setNotice("草稿已保存到本机");
        });
      } else if (command.action === "import-markdown") {
        setActiveBrowser(null);
        setPage("compose");
        void run(async () => {
          const text = await window.desktop.importMarkdown();
          if (text !== null) setBody(text);
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
    if (browserTabs.find((tab) => tab.id === id)?.kind !== "new")
      await window.desktop.closeAccountBrowser(id);
    const index = browserTabs.findIndex((tab) => tab.id === id);
    const closed = browserTabs[index];
    if (closed) closedTabs.current = [...closedTabs.current.slice(-19), closed];
    setBrowserTabs((tabs) => tabs.filter((tab) => tab.id !== id));
    if (activeBrowser === id)
      setActiveBrowser(browserTabs[index + 1]?.id ?? browserTabs[index - 1]?.id ?? null);
  };
  const newBrowserTab = () => {
    const tab = { id: `new-${crypto.randomUUID()}`, name: "新标签页", kind: "new" as const };
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
      if (tab.kind === "new") {
        setBrowserTabs((tabs) => [...tabs, tab]);
        setActiveBrowser(tab.id);
      } else if (accounts.some((a) => a.id === tab.id)) void run(() => openBrowser(tab));
    }
  };
  const pageTitle = navigation.find((item) => item.id === page)!.title;
  return {
    page,
    setPage,
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
    notice,
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
    silentPublish,
    setSilentPublish,
    concealBrowser,
    isNewTab,
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
    openBrowser,
    removeAccount,
    reload,
    run,
    closeBrowserTab,
    newBrowserTab,
    pageTitle,
  };
}

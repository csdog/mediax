import { useQuery } from "@tanstack/react-query";
import { Globe, Settings } from "lucide-react";
import { desktopPages } from "@/app/navigation";
import { useWorkspace } from "@/app/WorkspaceContext";
import { defaultShortcutMap, formatAccelerator } from "../../shared/shortcutCatalog";
import type { DesktopPage } from "../../shared/models";

const tools: { id: DesktopPage; shortcut?: string }[] = [
  { id: "accounts", shortcut: "accounts" },
  { id: "publish" },
  { id: "calendar" },
  { id: "analytics" },
  { id: "history", shortcut: "history" },
];

export function NewTabPage() {
  const { setPage, setActiveBrowser, openSettings } = useWorkspace();
  const shortcuts = useQuery({
    queryKey: ["desktop", "shortcut"],
    queryFn: () => window.desktop.shortcutSettings(),
    staleTime: 60_000,
  });
  const map = shortcuts.data?.shortcuts ?? defaultShortcutMap();
  const openPage = (id: DesktopPage) => {
    setActiveBrowser(null);
    setPage(id);
  };
  return (
    <main className="new-tab-page">
      <div className="new-tab-content">
        <div className="new-tab-hero">
          <Globe className="new-tab-hero-icon" aria-hidden />
          <h1 className="text-lg font-medium">新标签页</h1>
        </div>
        <section className="new-tab-tools" aria-label="工具">
          <h2>工具</h2>
          <div className="new-tab-tool-grid">
            {tools.map((tool) => {
              const item = desktopPages.find((page) => page.id === tool.id);
              if (!item) return null;
              const Icon = item.icon;
              const keys = tool.shortcut ? formatAccelerator(map[tool.shortcut] ?? "") : "";
              return (
                <button
                  key={tool.id}
                  type="button"
                  className="new-tab-tool"
                  onClick={() => openPage(tool.id)}
                >
                  <Icon aria-hidden />
                  <span>{item.title}</span>
                  {keys ? <kbd>{keys}</kbd> : null}
                </button>
              );
            })}
            <button
              type="button"
              className="new-tab-tool"
              onClick={() => {
                setActiveBrowser(null);
                openSettings();
              }}
            >
              <Settings aria-hidden />
              <span>设置</span>
              {formatAccelerator(map.settings ?? "") ? (
                <kbd>{formatAccelerator(map.settings ?? "")}</kbd>
              ) : null}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

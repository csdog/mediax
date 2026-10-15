import { useWorkspace } from "@/app/WorkspaceContext";

export function BrowserPage() {
  const { browserTabs, activeBrowser, browserPane, concealBrowser } = useWorkspace();
  const tab = browserTabs.find((item) => item.id === activeBrowser);
  const isWeb = tab?.kind === "web";
  return (
    <div className="browser-workspace">
      <h1 className="sr-only">{tab?.name ?? "浏览器"}</h1>
      <div
        ref={browserPane}
        className="account-browser-pane"
        aria-label={isWeb ? "网页" : "账号浏览器"}
      >
        {concealBrowser && !isWeb && (
          <p className="browser-silent-note">正在后台发布，账号页面会在完成后显示。</p>
        )}
      </div>
    </div>
  );
}

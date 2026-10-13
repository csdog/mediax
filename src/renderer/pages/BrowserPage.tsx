import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWorkspace } from "@/app/WorkspaceContext";

export function BrowserPage() {
  const { browserTabs, activeBrowser, notice, browserPane, concealBrowser } = useWorkspace();
  return (
    <div className="browser-workspace">
      <h1 className="sr-only">
        {browserTabs.find((tab) => tab.id === activeBrowser)?.name} · Facebook
      </h1>
      {notice && (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <div ref={browserPane} className="account-browser-pane" aria-label="账号浏览器">
        {concealBrowser && (
          <p className="browser-silent-note">正在后台发布，账号页面会在完成后显示。</p>
        )}
      </div>
    </div>
  );
}

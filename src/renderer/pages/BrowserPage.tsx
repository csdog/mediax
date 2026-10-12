import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWorkspace } from "@/app/WorkspaceContext";

export function BrowserPage() {
  const { browserTabs, activeBrowser, notice, browserPane, overlayCover } = useWorkspace();
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
        {overlayCover?.id === activeBrowser && (
          <img
            className="browser-preview-cover"
            src={overlayCover.image}
            alt=""
            aria-label="浏览器页面背景"
          />
        )}
      </div>
    </div>
  );
}

import { DocumentPage } from "@/components/workspace/DocumentPage";
import { PublishKindPicker } from "@/components/workspace/PublishKindDialog";
import { useWorkspace } from "@/app/WorkspaceContext";

export function PublishPage() {
  const { openPublish, run, reload } = useWorkspace();
  return (
    <DocumentPage>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-4 overflow-auto px-8 py-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">发布</h1>
          <p className="text-sm text-muted-foreground">选择视频、图文、文章或音频后进入编辑</p>
        </div>
        <PublishKindPicker
          onSelect={(kind) => {
            openPublish(kind);
            void run(reload);
          }}
        />
      </div>
    </DocumentPage>
  );
}

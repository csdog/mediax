import { CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { DocumentPage } from "@/components/workspace/DocumentPage";
import { useWorkspace } from "@/app/WorkspaceContext";

export function HistoryPage() {
  const {
    records,
    focusedTask,
    run,
    busy,
    openBrowser,
    accounts,
    setVerifyDialogTarget,
    setVerifyUrl,
    reload,
  } = useWorkspace();
  return (
    <DocumentPage>
      <Card>
        <CardHeader>
          <CardTitle>发布记录</CardTitle>
          <CardDescription>每个发布目标的状态分别记录。</CardDescription>
        </CardHeader>
        <CardContent>
          {records.tasks.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>内容</TableHead>
                  <TableHead>目标</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.tasks.flatMap((t) => {
                  const targets = records.targets.filter((x) => x.taskId === t.id);
                  return targets.map((x) => (
                    <TableRow key={x.id} className={focusedTask === t.id ? "bg-accent" : undefined}>
                      <TableCell className="max-w-sm whitespace-pre-wrap">{t.body}</TableCell>
                      <TableCell>{x.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {
                            {
                              pending: "排队中",
                              running: "发布中",
                              awaiting_user: "等待人工处理",
                              submitted: "已提交，待核验",
                              verified: "发布成功",
                              failed: "失败",
                              unknown: "结果未知",
                            }[x.status]
                          }
                        </Badge>
                        {x.url && (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => void run(() => window.desktop.openPost(x.url!))}
                          >
                            查看帖子
                          </Button>
                        )}
                        {["pending", "awaiting_user", "failed", "submitted", "unknown"].includes(
                          x.status,
                        ) && (
                          <div className="mt-2 flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void run(() =>
                                  openBrowser({
                                    id: x.accountId,
                                    name:
                                      accounts.find((a) => a.id === x.accountId)?.name ?? x.name,
                                  }),
                                )
                              }
                            >
                              打开账号
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  if (x.status === "failed") await window.desktop.retry(x.id);
                                  else if (["submitted", "unknown"].includes(x.status)) {
                                    setVerifyDialogTarget(x);
                                    setVerifyUrl(x.url ?? "");
                                  } else await window.desktop.resume(x.id);
                                  await reload();
                                })
                              }
                            >
                              {x.status === "failed"
                                ? "重试"
                                : ["submitted", "unknown"].includes(x.status)
                                  ? "核验结果"
                                  : "继续"}
                            </Button>
                          </div>
                        )}
                        {x.error && <p className="mt-1 text-xs text-muted-foreground">{x.error}</p>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(t.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ));
                })}
              </TableBody>
            </Table>
          ) : (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckCircle2 />
                </EmptyMedia>
                <EmptyTitle>暂无发布记录</EmptyTitle>
                <EmptyDescription>实际发布后，在这里查看各目标的状态和链接。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </DocumentPage>
  );
}

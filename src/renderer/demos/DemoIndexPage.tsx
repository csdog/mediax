import { ArrowLeft, ArrowUpRight, CircleCheck, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demos } from "./catalog";

export function DemoIndexPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="window-drag flex h-11 items-center justify-end border-b px-4 text-xs text-muted-foreground">
        MediaX · 本地演示
      </header>
      <main className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        <div className="space-y-5">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() =>
              window.location.assign(new URL("../index.html", window.location.href).href)
            }
          >
            <ArrowLeft className="size-4" />
            返回工作区
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <FlaskConical className="size-6" />
                <h1 className="text-2xl font-semibold">Demo 导航</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                集中查看组件与交互示例，选择一个演示开始体验。
              </p>
            </div>
            {window.desktop?.showToastOverlay && (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground">
                <CircleCheck className="size-3.5" />
                桌面演示已就绪
              </span>
            )}
          </div>
        </div>
        <section className="space-y-4" aria-label="所有 Demo">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-sm font-semibold">全部演示</h2>
            <span className="text-xs text-muted-foreground">{demos.length} 个 Demo</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {demos.map((demo) => (
              <a
                key={demo.id}
                href={demo.href}
                className="group space-y-5 rounded-2xl border p-6 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-muted">
                    <demo.icon className="size-5" />
                  </span>
                  <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">{demo.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{demo.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {demo.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </section>
        <p className="text-xs leading-6 text-muted-foreground">
          仅开发版可用，不包含在正式安装包中。
        </p>
      </main>
    </div>
  );
}

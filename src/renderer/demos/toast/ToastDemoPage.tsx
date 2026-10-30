import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CircleCheck,
  Info,
  Layers,
  LoaderCircle,
  Moon,
  Sun,
  TriangleAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast, useSonner } from "sonner";
import { Button } from "@/components/ui/button";

const DEMO_MARKER = "__MEDIAX_LOCAL_TOAST_DEMO__";
const variants = [
  {
    type: "success",
    label: "成功",
    title: "内容已保存",
    description: "你的改动已保存到本机。",
    icon: CircleCheck,
  },
  {
    type: "info",
    label: "信息",
    title: "任务已准备好",
    description: "可以继续编辑，或查看任务详情。",
    icon: Info,
  },
  {
    type: "warning",
    label: "警告",
    title: "请先完成登录",
    description: "在账号标签页中登录后，再继续操作。",
    icon: TriangleAlert,
  },
  {
    type: "error",
    label: "错误",
    title: "操作未完成",
    description: "请检查网络连接，然后重试。",
    icon: XCircle,
  },
] as const;

export function ToastDemoPage() {
  const [duration, setDuration] = useState(6000);
  const [updating, setUpdating] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { toasts } = useSonner();
  const nativeAvailable = Boolean(window.desktop?.showToastOverlay);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  const later = (callback: () => void, delay: number) => {
    timers.current.push(setTimeout(callback, delay));
  };
  const stack = (count: number) => {
    for (let index = 0; index < count; index++)
      later(() => {
        const variant = variants[index % variants.length];
        toast[variant.type](`第 ${index + 1} 条提示`, {
          description: variant.description,
          duration,
        });
      }, index * 240);
  };
  const update = () => {
    setUpdating(true);
    const id = toast.loading("正在保存演示内容…", {
      description: "同一条提示稍后会更新为成功状态。",
    });
    later(() => {
      toast.success("演示内容已保存", {
        id,
        description: "图标和文案已更新，仍然是同一条提示。",
        duration,
      });
      setUpdating(false);
    }, 1800);
  };
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setUpdating(false);
    toast.dismiss();
  };
  return (
    <div data-local-demo={DEMO_MARKER} className="min-h-svh bg-background text-foreground">
      <header className="window-drag flex h-11 items-center justify-end border-b px-4 text-xs text-muted-foreground">
        MediaX · 本地演示
      </header>
      <main className="mx-auto max-w-4xl space-y-7 px-6 py-8 pb-52">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={() =>
                window.location.assign(new URL("../index.html", window.location.href).href)
              }
            >
              <ArrowLeft className="size-4" />
              返回 Demo 导航
            </Button>
            <div className="flex items-center gap-3">
              <Bell className="size-6" />
              <h1 className="text-2xl font-semibold">Toast Demo</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              触发真实原生提示，观察动画、堆叠和悬停展开效果。
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="浅色模式"
              onClick={() => document.documentElement.classList.remove("dark")}
            >
              <Sun className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="深色模式"
              onClick={() => document.documentElement.classList.add("dark")}
            >
              <Moon className="size-4" />
            </Button>
          </div>
        </div>
        {!nativeAvailable && (
          <p
            role="alert"
            className="rounded-xl border border-amber-400/40 bg-amber-100/30 p-4 text-sm"
          >
            请在 MediaX 开发版中打开本页，浏览器预览无法显示原生浮层。
          </p>
        )}
        <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border p-5">
          <div className="space-y-2">
            <label htmlFor="toast-duration" className="text-sm font-medium">
              自动关闭时间 · {duration / 1000} 秒
            </label>
            <input
              id="toast-duration"
              aria-label="自动关闭时间"
              className="block w-64 accent-foreground"
              type="range"
              min={2000}
              max={12000}
              step={1000}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">当前 {toasts.length} 条</span>
            <Button variant="outline" onClick={clear}>
              <Trash2 className="size-4" />
              清空全部
            </Button>
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">单条提示</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Button
              disabled={!nativeAvailable}
              variant="outline"
              className="h-20 justify-start gap-3 rounded-xl px-5"
              onClick={() =>
                toast("这是一条默认提示", {
                  description: "黑色背景，保留图标与完整的堆叠交互。",
                  duration,
                })
              }
            >
              <Bell className="size-5" />
              <span>默认（黑色）</span>
            </Button>
            {variants.map((variant) => (
              <Button
                key={variant.type}
                disabled={!nativeAvailable}
                variant="outline"
                className="h-20 justify-start gap-3 rounded-xl px-5"
                onClick={() =>
                  toast[variant.type](variant.title, { description: variant.description, duration })
                }
              >
                <variant.icon className="size-5" />
                <span>{variant.label}</span>
              </Button>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">交互场景</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Scenario
              label="连续弹出 3 条"
              description="观察重叠卡片；移入鼠标展开，移出收起。"
              disabled={!nativeAvailable}
              onClick={() => stack(3)}
              icon={<Layers className="size-5" />}
            />
            <Scenario
              label="连续弹出 6 条"
              description="最多显示 3 条，剩余提示会依次补入。"
              disabled={!nativeAvailable}
              onClick={() => stack(6)}
              icon={<Layers className="size-5" />}
            />
            <Scenario
              label="长文案与换行"
              description="检查展开高度、换行以及滚动区域。"
              disabled={!nativeAvailable}
              onClick={() =>
                toast.info("这是一条包含较长说明的演示提示", {
                  description:
                    "原生浮层会根据内容计算高度。多条提示展开时，会先扩展窗口再播放动画，收起后缩小点击区域。你可以将鼠标停在提示上暂停计时，也可以使用关闭按钮或 Escape 关闭提示。",
                  duration,
                })
              }
              icon={<Info className="size-5" />}
            />
            <Scenario
              label={updating ? "保存中…" : "加载后更新同一条"}
              description="加载图标转为成功图标，不创建重复提示。"
              disabled={!nativeAvailable || updating}
              onClick={update}
              icon={<LoaderCircle className="size-5" />}
            />
            <Scenario
              label="显示常驻提示"
              description="不会自动关闭，适合慢慢检查展开与收起。"
              disabled={!nativeAvailable}
              onClick={() =>
                toast.info("这条提示会一直保留", {
                  description: "使用右侧关闭按钮、Escape 或清空全部来关闭。",
                  duration: Infinity,
                })
              }
              icon={<Bell className="size-5" />}
            />
          </div>
        </section>
        <p className="text-xs leading-6 text-muted-foreground">
          悬停或键盘聚焦提示时暂停计时，离开后继续。关闭按钮和 Escape
          可关闭提示。本页仅在本地开发时提供，所有文案均为演示内容。
        </p>
      </main>
    </div>
  );
}
function Scenario({
  label,
  description,
  icon,
  ...props
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex items-start gap-3 rounded-xl border p-5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="space-y-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

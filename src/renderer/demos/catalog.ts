import { Bell } from "lucide-react";

/** Register each local demo here so the navigation page lists it automatically. */
export const demos = [
  {
    id: "toast",
    title: "Toast 通知",
    description: "查看原生通知的状态、进出动画、堆叠展开、计时暂停与加载更新。",
    href: "./toast/index.html",
    tags: ["原生浮层", "动画", "交互"],
    icon: Bell,
  },
] as const;

import { Users, Send, Video, History } from "lucide-react";
import type { DesktopPage } from "../../shared/models";
export const navigation: { id: DesktopPage; title: string; icon: typeof Users }[] = [
  { id: "accounts", title: "账号管理", icon: Users },
  { id: "compose", title: "内容发布", icon: Send },
  { id: "video", title: "视频", icon: Video },
  { id: "history", title: "发布记录", icon: History },
];

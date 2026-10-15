import {
  CodexUsersIcon,
  CodexSendIcon,
  CodexVideoIcon,
  CodexVideoFilledIcon,
  CodexCalendarIcon,
  CodexChartIcon,
  CodexChartFilledIcon,
  CodexHistoryIcon,
} from "@/components/workspace/CodexNavigationIcons";
import { UsersIcon, createLucideIcon } from "lucide-react";
import type { DesktopPage } from "../../shared/models";

// Filled counterparts keep the same subject and silhouette as the outline icons.
const UsersFilledIcon = createLucideIcon("UsersFilled", [
  [
    "path",
    {
      d: "M16 21v-2a6 6 0 0 0-12 0v2h12Zm4 0v-2a8 8 0 0 0-2-5.3 5 5 0 0 1 6 5.3v2h-4ZM10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm7 0a4 4 0 0 1 0 8 6 6 0 0 0 0-8Z",
      fill: "currentColor",
      stroke: "none",
      key: "fill",
    },
  ],
]);
const SendFilledIcon = createLucideIcon("SendFilled", [
  [
    "path",
    {
      d: "m22 2-7 20-4-9-9-4 20-7Zm-4 4-8 5 3 3 5-8Z",
      fillRule: "evenodd",
      fill: "currentColor",
      stroke: "none",
      key: "fill",
    },
  ],
]);

const CalendarFilledIcon = createLucideIcon("CalendarFilled", [
  [
    "path",
    {
      d: "M6 2h2v3h8V2h2v3h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V2ZM4 9v2h16V9H4Zm2 5v2h2v-2H6Zm5 0v2h2v-2h-2Zm5 0v2h2v-2h-2ZM6 18v2h2v-2H6Zm5 0v2h2v-2h-2Z",
      fillRule: "evenodd",
      fill: "currentColor",
      stroke: "none",
      key: "fill",
    },
  ],
]);

const HistoryFilledIcon = createLucideIcon("HistoryFilled", [
  [
    "path",
    {
      d: "M12 3a9 9 0 1 1-8.5 12h2.2A7 7 0 1 0 6 8h3v2H2V3h2v3.3A9 9 0 0 1 12 3Zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm-1 2v6l4 2 1-2-3-1V7h-2Z",
      fillRule: "evenodd",
      fill: "currentColor",
      stroke: "none",
      key: "fill",
    },
  ],
]);

export type DesktopNavItem = {
  id: DesktopPage;
  title: string;
  icon: typeof UsersIcon;
  selectedIcon: typeof UsersIcon;
};

/** All desktop pages (routes + titles). In-app「发布」opens the dialog; /publish is for links. */
export const desktopPages: DesktopNavItem[] = [
  { id: "accounts", title: "账号管理", icon: CodexUsersIcon, selectedIcon: UsersFilledIcon },
  { id: "publish", title: "发布", icon: CodexSendIcon, selectedIcon: SendFilledIcon },
  { id: "compose", title: "内容发布", icon: CodexSendIcon, selectedIcon: SendFilledIcon },
  { id: "video", title: "视频", icon: CodexVideoIcon, selectedIcon: CodexVideoFilledIcon },
  { id: "calendar", title: "内容日历", icon: CodexCalendarIcon, selectedIcon: CalendarFilledIcon },
  {
    id: "analytics",
    title: "数据分析",
    icon: CodexChartIcon,
    selectedIcon: CodexChartFilledIcon,
  },
  { id: "history", title: "发布记录", icon: CodexHistoryIcon, selectedIcon: HistoryFilledIcon },
];

/** Sidebar / activity rail entries — 「发布」stays a dialog, not a rail item. */
export const navigation: DesktopNavItem[] = desktopPages.filter(
  (item) => item.id !== "publish" && item.id !== "compose" && item.id !== "video",
);

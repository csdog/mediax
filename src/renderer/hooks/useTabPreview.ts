import { useQuery } from "@tanstack/react-query";
import type { BrowserPreview } from "../../shared/models";
export type TabPreview = {
  id: string;
  data?: BrowserPreview;
  cover?: string | null;
  error?: string;
};
type Options = {
  hoveredTab: string | null;
  activeAccountId: string | null;
  browserTabs: { id: string; kind?: "new" }[];
};
export function useTabPreview({
  hoveredTab,
  activeAccountId,
  browserTabs,
}: Options): TabPreview | null {
  const isLocal =
    hoveredTab === "workspace" ||
    browserTabs.some((tab) => tab.id === hoveredTab && tab.kind === "new");
  const query = useQuery({
    queryKey: ["desktop", "tab-preview", hoveredTab, activeAccountId, isLocal],
    enabled: Boolean(hoveredTab),
    // Captured account pages stay in memory only and are discarded when the preview closes.
    gcTime: 0,
    staleTime: 0,
    retry: false,
    queryFn: async (): Promise<TabPreview> => {
      const id = hoveredTab!;
      if (isLocal) {
        const cover = activeAccountId
          ? (await window.desktop.previewAccountBrowser(activeAccountId)).image
          : null;
        return { id, cover };
      }
      const data = await window.desktop.previewAccountBrowser(id);
      const cover =
        activeAccountId && activeAccountId !== id
          ? (await window.desktop.previewAccountBrowser(activeAccountId)).image
          : data.image;
      return { id, data, cover };
    },
  });
  if (!hoveredTab) return null;
  if (query.isError) return { id: hoveredTab, error: "暂时无法预览页面" };
  return query.data ?? null;
}

import { useQuery } from "@tanstack/react-query";
import type { BrowserPreview } from "../../shared/models";

export type TabPreview = {
  id: string;
  data?: BrowserPreview;
  error?: string;
};
type Options = {
  hoveredTab: string | null;
  browserTabs: { id: string; kind?: "new" }[];
};
export function useTabPreview({ hoveredTab, browserTabs }: Options): TabPreview | null {
  const isLocal =
    hoveredTab === "workspace" ||
    browserTabs.some((tab) => tab.id === hoveredTab && tab.kind === "new");
  const query = useQuery({
    queryKey: ["desktop", "tab-preview", hoveredTab],
    enabled: Boolean(hoveredTab) && !isLocal,
    // Captured account pages stay in memory only and are discarded when the preview closes.
    gcTime: 0,
    staleTime: 0,
    retry: false,
    queryFn: async (): Promise<TabPreview> => {
      const id = hoveredTab!;
      return { id, data: await window.desktop.previewAccountBrowser(id) };
    },
  });
  if (!hoveredTab) return null;
  if (isLocal) return { id: hoveredTab };
  if (query.isError) return { id: hoveredTab, error: "暂时无法预览页面" };
  return query.data ?? null;
}

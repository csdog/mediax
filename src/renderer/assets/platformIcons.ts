import type { PlatformId } from "../../shared/models";

const modules = import.meta.glob("./platforms/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const platformIcons: Partial<Record<PlatformId, string>> = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => {
    const id = path
      .split("/")
      .pop()
      ?.replace(/\.png$/, "");
    return [id, url];
  }),
);

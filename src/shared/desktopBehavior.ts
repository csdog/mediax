export type DesktopBehavior = {
  /** Keep the machine awake while publish tasks are active. */
  keepAwakeWhilePublishing: boolean;
};

export const defaultDesktopBehavior: DesktopBehavior = {
  keepAwakeWhilePublishing: true,
};

export function readDesktopBehavior(get: (key: string) => unknown): DesktopBehavior {
  return {
    keepAwakeWhilePublishing: get("keepAwakeWhilePublishing") !== false,
  };
}

export function mergeDesktopBehavior(
  current: DesktopBehavior,
  patch: Partial<DesktopBehavior>,
): DesktopBehavior {
  return {
    keepAwakeWhilePublishing:
      typeof patch.keepAwakeWhilePublishing === "boolean"
        ? patch.keepAwakeWhilePublishing
        : current.keepAwakeWhilePublishing,
  };
}

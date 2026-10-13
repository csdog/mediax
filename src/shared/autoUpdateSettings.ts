/**
 * When true (default): packaged builds auto-check shortly after launch and
 * auto-download when a release is found. When false: neither happens in the
 * background; the Settings「检查更新」button remains available.
 */
export function readAutoUpdateEnabled(get: (key: string) => unknown) {
  return get("autoUpdateEnabled") !== false;
}

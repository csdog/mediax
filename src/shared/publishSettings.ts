export type PublishSettings = {
  silent: boolean;
  concurrency: number;
  bandwidthLimitKbps: number;
};

export const defaultPublishSettings: PublishSettings = {
  silent: false,
  concurrency: 3,
  bandwidthLimitKbps: 0,
};

export function clampConcurrency(value: number) {
  if (!Number.isFinite(value)) return defaultPublishSettings.concurrency;
  return Math.max(1, Math.floor(value));
}

export function clampBandwidthLimitKbps(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export function readPublishSettings(get: (key: string) => unknown): PublishSettings {
  return {
    silent: get("silentPublish") === true,
    concurrency: clampConcurrency(
      Number(get("publishConcurrency") ?? defaultPublishSettings.concurrency),
    ),
    bandwidthLimitKbps: clampBandwidthLimitKbps(
      Number(get("publishBandwidthLimitKbps") ?? defaultPublishSettings.bandwidthLimitKbps),
    ),
  };
}

export function mergePublishSettings(
  current: PublishSettings,
  patch: Partial<PublishSettings>,
): PublishSettings {
  return {
    silent: typeof patch.silent === "boolean" ? patch.silent : current.silent,
    concurrency:
      patch.concurrency === undefined ? current.concurrency : clampConcurrency(patch.concurrency),
    bandwidthLimitKbps:
      patch.bandwidthLimitKbps === undefined
        ? current.bandwidthLimitKbps
        : clampBandwidthLimitKbps(patch.bandwidthLimitKbps),
  };
}

/** Chromium network emulation expects bytes/second. */
export function bandwidthLimitBytesPerSecond(kbps: number) {
  const limited = clampBandwidthLimitKbps(kbps);
  return limited <= 0 ? 0 : Math.round((limited * 1000) / 8);
}

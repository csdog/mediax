/** Stable id: paths, protocol, IPC, package metadata. */
export const productId = "mediax";

/** User-facing brand in UI, Dock, menus, notifications. */
export const productName = "MediaX";

/** Bundled app id; keep in sync with electron-builder.yml `appId`. */
export const productAppId = `local.${productId}.desktop`;

export const productProtocol = productId;
export const productDbFile = `${productId}.sqlite`;
export const productDbFiles = [
  productDbFile,
  `${productDbFile}-shm`,
  `${productDbFile}-wal`,
] as const;

export function productIpcChannel(name: string) {
  return `${productId}:${name}`;
}

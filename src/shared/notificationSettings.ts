export type NotificationSettings = {
  enabled: boolean;
  publishResult: boolean;
  awaitingUser: boolean;
  /** When true, notification bodies omit account / target names. */
  privacy: boolean;
  /** Play system / notification sounds when notices are shown. */
  sound: boolean;
};

export const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  publishResult: true,
  awaitingUser: true,
  privacy: false,
  sound: true,
};

export function readNotificationSettings(get: (key: string) => unknown): NotificationSettings {
  return {
    enabled: get("notificationsEnabled") !== false,
    publishResult: get("notifyPublishResult") !== false,
    awaitingUser: get("notifyAwaitingUser") !== false,
    privacy: get("notificationPrivacy") === true,
    sound: get("notificationSound") !== false,
  };
}

export function mergeNotificationSettings(
  current: NotificationSettings,
  patch: Partial<NotificationSettings>,
): NotificationSettings {
  return {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    publishResult:
      typeof patch.publishResult === "boolean" ? patch.publishResult : current.publishResult,
    awaitingUser:
      typeof patch.awaitingUser === "boolean" ? patch.awaitingUser : current.awaitingUser,
    privacy: typeof patch.privacy === "boolean" ? patch.privacy : current.privacy,
    sound: typeof patch.sound === "boolean" ? patch.sound : current.sound,
  };
}

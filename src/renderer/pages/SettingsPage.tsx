import { useEffect } from "react";
import { SettingsLayout } from "@/components/SettingsLayout";
import { ShortcutSettingsPanel } from "@/components/ShortcutSettingsPanel";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { useWorkspace } from "@/app/WorkspaceContext";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { useDiagnostics } from "@/hooks/useDiagnostics";
import { useStorageUsage } from "@/hooks/useStorageUsage";
import { useOpenAtLogin } from "@/hooks/useOpenAtLogin";
import { useThemePreference } from "@/hooks/useThemePreference";
import { useDesktopBehavior } from "@/hooks/useDesktopBehavior";

export function SettingsPage() {
  const {
    setSettingsOpen,
    publishSettings,
    silentPublish,
    setSilentPublish,
    setPublishConcurrency,
    setPublishBandwidthLimitKbps,
  } = useWorkspace();
  const { profile, setProfileName, chooseAvatar, clearAvatar, profileError } = useProfileSettings();
  const {
    status: updateStatus,
    busy: updateBusy,
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    checkForUpdates,
    installUpdate,
  } = useAppUpdate();
  const { settings: desktopBehavior, setSettings: setDesktopBehavior } = useDesktopBehavior();
  const {
    settings: notificationSettings,
    permission: notificationPermission,
    setSettings: setNotificationSettings,
    openSystemSettings,
    testNotification,
    testBusy,
    testMessage,
  } = useNotificationSettings();
  const {
    report: diagnostics,
    loading: diagnosticsLoading,
    message: diagnosticsMessage,
    autoRefresh: diagnosticsAutoRefresh,
    setAutoRefresh: setDiagnosticsAutoRefresh,
    refresh: refreshDiagnostics,
    exportReport,
    exporting: diagnosticsExporting,
    revealLog,
  } = useDiagnostics();
  const {
    storage: storageUsage,
    loading: storageLoading,
    clearingId: storageClearingId,
    message: storageMessage,
    messageError: storageMessageError,
    refresh: refreshStorage,
    clearStorage,
  } = useStorageUsage();
  const { openAtLogin, detail: openAtLoginDetail, setOpenAtLogin } = useOpenAtLogin();
  const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();
  useEffect(() => {
    document.getElementById("settings-page-title")?.focus();
    const back = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", back);
    return () => window.removeEventListener("keydown", back);
  }, [setSettingsOpen]);
  return (
    <main className="settings-full-page" aria-label="设置页面">
      <SettingsLayout
        onBack={() => setSettingsOpen(false)}
        silentPublish={silentPublish}
        onSilentPublish={setSilentPublish}
        publishConcurrency={publishSettings.concurrency}
        onPublishConcurrency={setPublishConcurrency}
        publishBandwidthLimitKbps={publishSettings.bandwidthLimitKbps}
        onPublishBandwidthLimitKbps={setPublishBandwidthLimitKbps}
        profileName={profile.name}
        profileAvatar={profile.avatar}
        profileError={profileError}
        onProfileName={setProfileName}
        onChooseAvatar={() => void chooseAvatar()}
        onClearAvatar={clearAvatar}
        updateStatus={updateStatus}
        updateBusy={updateBusy}
        autoUpdateEnabled={autoUpdateEnabled}
        onAutoUpdateEnabled={setAutoUpdateEnabled}
        onCheckForUpdates={() => void checkForUpdates()}
        onInstallUpdate={() => void installUpdate()}
        keepAwakeWhilePublishing={desktopBehavior.keepAwakeWhilePublishing}
        onKeepAwakeWhilePublishing={(enabled) =>
          setDesktopBehavior({ keepAwakeWhilePublishing: enabled })
        }
        calendarTimezone={desktopBehavior.calendarTimezone}
        onCalendarTimezone={(timezone) => setDesktopBehavior({ calendarTimezone: timezone })}
        notificationSettings={notificationSettings}
        onNotificationSettings={setNotificationSettings}
        notificationPermission={notificationPermission}
        onOpenNotificationSettings={openSystemSettings}
        onTestNotification={() => void testNotification()}
        testNotificationBusy={testBusy}
        testNotificationMessage={testMessage}
        diagnostics={diagnostics}
        diagnosticsLoading={diagnosticsLoading}
        diagnosticsMessage={diagnosticsMessage}
        diagnosticsAutoRefresh={diagnosticsAutoRefresh}
        onDiagnosticsAutoRefresh={setDiagnosticsAutoRefresh}
        onRefreshDiagnostics={refreshDiagnostics}
        onExportDiagnostics={exportReport}
        diagnosticsExporting={diagnosticsExporting}
        onRevealLogFile={() => void revealLog()}
        storageUsage={storageUsage}
        storageLoading={storageLoading}
        storageClearingId={storageClearingId}
        storageMessage={storageMessage}
        storageMessageError={storageMessageError}
        onRefreshStorage={refreshStorage}
        onClearStorage={(id) => clearStorage(id)}
        openAtLogin={openAtLogin}
        openAtLoginDetail={openAtLoginDetail}
        onOpenAtLogin={setOpenAtLogin}
        themePreference={themePreference}
        onThemePreference={setThemePreference}
      >
        <PanelErrorBoundary title="快捷键设置暂时无法显示">
          <ShortcutSettingsPanel />
        </PanelErrorBoundary>
      </SettingsLayout>
    </main>
  );
}

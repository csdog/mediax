import { useEffect } from "react";
import { SettingsLayout } from "@/components/SettingsLayout";
import { ShortcutSettingsPanel } from "@/components/ShortcutSettingsPanel";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { useWorkspace } from "@/app/WorkspaceContext";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { useDiagnostics } from "@/hooks/useDiagnostics";
import { useOpenAtLogin } from "@/hooks/useOpenAtLogin";

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
  const { status: updateStatus, busy: updateBusy, checkForUpdates, installUpdate } = useAppUpdate();
  const {
    settings: notificationSettings,
    permission: notificationPermission,
    setSettings: setNotificationSettings,
    openSystemSettings,
  } = useNotificationSettings();
  const {
    report: diagnostics,
    loading: diagnosticsLoading,
    message: diagnosticsMessage,
    refresh: refreshDiagnostics,
    exportReport,
    exporting: diagnosticsExporting,
    revealLog,
  } = useDiagnostics();
  const { openAtLogin, detail: openAtLoginDetail, setOpenAtLogin } = useOpenAtLogin();
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
        onCheckForUpdates={() => void checkForUpdates()}
        onInstallUpdate={() => void installUpdate()}
        notificationSettings={notificationSettings}
        onNotificationSettings={setNotificationSettings}
        notificationPermission={notificationPermission}
        onOpenNotificationSettings={openSystemSettings}
        diagnostics={diagnostics}
        diagnosticsLoading={diagnosticsLoading}
        diagnosticsMessage={diagnosticsMessage}
        onRefreshDiagnostics={refreshDiagnostics}
        onExportDiagnostics={exportReport}
        diagnosticsExporting={diagnosticsExporting}
        onRevealLogFile={() => void revealLog()}
        openAtLogin={openAtLogin}
        openAtLoginDetail={openAtLoginDetail}
        onOpenAtLogin={setOpenAtLogin}
      >
        <PanelErrorBoundary title="快捷键设置暂时无法显示">
          <ShortcutSettingsPanel />
        </PanelErrorBoundary>
      </SettingsLayout>
    </main>
  );
}

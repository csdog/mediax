import { useEffect, useState, type ReactNode } from "react";
import {
  Search,
  Settings,
  Keyboard,
  Bell,
  Database,
  ArrowLeft,
  Palette,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProfileMark } from "@/components/ProfileMark";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import type { UpdateStatus } from "../../shared/models";
import type { NotificationSettings } from "../../shared/notificationSettings";
import type { ThemePreference } from "../../shared/themePreference";
import {
  formatBytes,
  storageCategoryMeta,
  storageCleanupActions,
  type StorageCleanupId,
} from "../../shared/storageUsage";
import { CALENDAR_TIMEZONES, SYSTEM_TIMEZONE, systemTimeZone } from "../../shared/timezones";

const categories = [
  {
    id: "general",
    title: "常规",
    icon: Settings,
    keywords:
      "菜单栏 窗口 深度链接 协议 Dock 角标 登录时启动 开机 快捷键 静默 发布 并行 网速 限速 名称 头像 个人资料 更新 版本 时区 日历",
  },
  {
    id: "appearance",
    title: "外观",
    icon: Palette,
    keywords: "主题 模式 浅色 深色 跟随系统 外观",
  },
  {
    id: "notifications",
    title: "通知",
    icon: Bell,
    keywords: "发布 任务 开关 隐私 权限 系统",
  },
  { id: "shortcuts", title: "键盘快捷键", icon: Keyboard, keywords: "全局 呼出 标签 编辑 重置" },
  {
    id: "storage",
    title: "存储",
    icon: Database,
    keywords: "本地 数据 会话 日志 诊断 导出 故障 占用 容量 缓存 素材",
  },
];

const themeModes: { id: ThemePreference; title: string; icon: typeof Sun }[] = [
  { id: "light", title: "浅色", icon: Sun },
  { id: "dark", title: "深色", icon: Moon },
  { id: "system", title: "系统", icon: Monitor },
];
function InfoRow({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: string;
}) {
  return (
    <div className="settings-row">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <span className="settings-row-value">{value}</span>
    </div>
  );
}
function ProfileSection({
  name,
  avatar,
  error,
  onName,
  onChooseAvatar,
  onClearAvatar,
}: {
  name: string;
  avatar: string | null;
  error: string;
  onName(name: string): void;
  onChooseAvatar(): void;
  onClearAvatar(): void;
}) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = () => {
    const next = draft.trim();
    if (!next) {
      setDraft(name);
      return;
    }
    if (next !== name) onName(next);
  };
  return (
    <section className="settings-section">
      <h3>个人资料</h3>
      <div className="settings-section-box">
        <div className="settings-row">
          <div>
            <h3>头像</h3>
            <p>显示在头像菜单和左下角。</p>
          </div>
          <div className="flex items-center gap-2">
            <ProfileMark name={name} avatar={avatar} />
            <Button type="button" variant="outline" onClick={onChooseAvatar}>
              更换头像
            </Button>
            {avatar ? (
              <Button type="button" variant="ghost" onClick={onClearAvatar}>
                移除头像
              </Button>
            ) : null}
          </div>
        </div>
        <div className="settings-row">
          <div>
            <h3>名称</h3>
            <p>显示在头像菜单顶部。</p>
          </div>
          <Input
            aria-label="个人名称"
            className="w-44"
            maxLength={40}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      </div>
      {error ? <p className="settings-section-note">{error}</p> : null}
    </section>
  );
}
export function SettingsLayout({
  children,
  onBack,
  silentPublish,
  onSilentPublish,
  publishConcurrency,
  onPublishConcurrency,
  publishBandwidthLimitKbps,
  onPublishBandwidthLimitKbps,
  profileName,
  profileAvatar,
  profileError,
  onProfileName,
  onChooseAvatar,
  onClearAvatar,
  updateStatus,
  updateBusy,
  autoUpdateEnabled,
  onAutoUpdateEnabled,
  onCheckForUpdates,
  onInstallUpdate,
  keepAwakeWhilePublishing,
  onKeepAwakeWhilePublishing,
  calendarTimezone,
  onCalendarTimezone,
  notificationSettings,
  onNotificationSettings,
  notificationPermission,
  onOpenNotificationSettings,
  onTestNotification,
  testNotificationBusy,
  testNotificationMessage,
  diagnostics,
  diagnosticsLoading,
  diagnosticsMessage,
  diagnosticsAutoRefresh,
  onDiagnosticsAutoRefresh,
  onRefreshDiagnostics,
  onExportDiagnostics,
  diagnosticsExporting,
  onRevealLogFile,
  storageUsage,
  storageLoading,
  storageClearingId,
  storageMessage,
  storageMessageError,
  onRefreshStorage,
  onClearStorage,
  openAtLogin,
  openAtLoginDetail,
  onOpenAtLogin,
  themePreference,
  onThemePreference,
}: {
  children: ReactNode;
  onBack(): void;
  silentPublish: boolean;
  onSilentPublish(silent: boolean): void;
  publishConcurrency: number;
  onPublishConcurrency(value: number): void;
  publishBandwidthLimitKbps: number;
  onPublishBandwidthLimitKbps(value: number): void;
  profileName: string;
  profileAvatar: string | null;
  profileError: string;
  onProfileName(name: string): void;
  onChooseAvatar(): void;
  onClearAvatar(): void;
  updateStatus: UpdateStatus;
  updateBusy: boolean;
  autoUpdateEnabled: boolean;
  onAutoUpdateEnabled(enabled: boolean): void;
  onCheckForUpdates(): void;
  onInstallUpdate(): void;
  keepAwakeWhilePublishing: boolean;
  onKeepAwakeWhilePublishing(enabled: boolean): void;
  calendarTimezone: string;
  onCalendarTimezone(timezone: string): void;
  notificationSettings: NotificationSettings;
  onNotificationSettings(patch: Partial<NotificationSettings>): void;
  notificationPermission: { supported: boolean; label: string; detail: string };
  onOpenNotificationSettings(): void;
  onTestNotification(): void;
  testNotificationBusy: boolean;
  testNotificationMessage: string;
  diagnostics: {
    generatedAt: string;
    app: { version: string; packaged: boolean };
    runtime: { electron: string; platform: string; arch: string };
    paths: { logFile: string; userData?: string };
    counts: { accounts: number; tasks: number };
    logTail: string;
  } | null;
  diagnosticsLoading: boolean;
  diagnosticsMessage: string;
  diagnosticsAutoRefresh: boolean;
  onDiagnosticsAutoRefresh(enabled: boolean): void;
  onRefreshDiagnostics(): void;
  onExportDiagnostics(): void;
  diagnosticsExporting: boolean;
  onRevealLogFile(): void;
  storageUsage: {
    totalBytes: number;
    categories: Array<{ id: string; label: string; bytes: number }>;
  } | null;
  storageLoading: boolean;
  storageClearingId: StorageCleanupId | null;
  storageMessage: string;
  storageMessageError: boolean;
  onRefreshStorage(): void;
  onClearStorage(id: StorageCleanupId): void;
  openAtLogin: boolean;
  openAtLoginDetail: string | null;
  onOpenAtLogin(openAtLogin: boolean): void;
  themePreference: ThemePreference;
  onThemePreference(preference: ThemePreference): void;
}) {
  const [category, setCategory] = useState("general");
  const [query, setQuery] = useState("");
  const items = categories.filter((item) =>
    `${item.title} ${item.keywords}`.includes(query.trim()),
  );
  const current = categories.find((item) => item.id === category)!;
  return (
    <div className="settings-layout">
      <aside className="settings-navigation">
        <div className="settings-navigation-header">
          <h1 id="settings-page-title" tabIndex={-1} className="settings-title">
            设置
          </h1>
          <Button variant="ghost" size="icon-sm" aria-label="返回工作区" onClick={onBack}>
            <ArrowLeft />
          </Button>
        </div>
        <div className="settings-search">
          <Search />
          <Input
            aria-label="搜索设置"
            placeholder="搜索"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              const match = categories.find((item) =>
                `${item.title} ${item.keywords}`.includes(value.trim()),
              );
              if (match) setCategory(match.id);
            }}
          />
        </div>
        <p className="settings-group-label">个人</p>
        <nav aria-label="设置分类">
          {items.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              aria-current={category === item.id ? "page" : undefined}
              onClick={() => setCategory(item.id)}
            >
              <item.icon />
              {item.title}
            </Button>
          ))}
        </nav>
        {!items.length && <p className="settings-no-results">没有匹配的设置</p>}
      </aside>
      <div className="settings-scroll-area" key={category}>
        <div className="settings-page">
          <PanelErrorBoundary title={`${current.title}暂时无法显示`}>
            <h2>{current.title}</h2>
            {category === "shortcuts" ? children : null}
            {category === "general" && (
              <ProfileSection
                name={profileName}
                avatar={profileAvatar}
                error={profileError}
                onName={onProfileName}
                onChooseAvatar={onChooseAvatar}
                onClearAvatar={onClearAvatar}
              />
            )}
            {category === "general" && (
              <section className="settings-section">
                <h3>桌面行为</h3>
                <div className="settings-section-box">
                  <InfoRow
                    title="在菜单栏中显示"
                    description="关闭主窗口后，仍在菜单栏保留图标；应用继续运行，发布任务不会中断。"
                    value="已启用"
                  />
                  <div className="settings-row">
                    <div>
                      <h3>发布 / 排期时保持唤醒</h3>
                      <p>
                        有进行中或等待排期的任务时，阻止系统因空闲进入睡眠；屏幕仍可按系统设置熄灭（需本机保持
                        MediaX 运行，到点才会发布）。
                      </p>
                    </div>
                    <Switch
                      checked={keepAwakeWhilePublishing}
                      onCheckedChange={(checked) => onKeepAwakeWhilePublishing(checked === true)}
                      aria-label="发布或排期时保持唤醒"
                    />
                  </div>
                  <div className="settings-row">
                    <div>
                      <h3>日历时区</h3>
                      <p>
                        内容日历网格与排期选时按此时区解释；任务仍以 UTC 存储，到点按绝对时间触发。
                      </p>
                    </div>
                    <Select
                      items={CALENDAR_TIMEZONES.map((item) => ({
                        value: item.value,
                        label:
                          item.value === SYSTEM_TIMEZONE
                            ? `${item.label} (${systemTimeZone()})`
                            : item.label,
                      }))}
                      value={calendarTimezone || SYSTEM_TIMEZONE}
                      onValueChange={(value) => {
                        if (value) onCalendarTimezone(value);
                      }}
                    >
                      <SelectTrigger aria-label="日历时区" className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALENDAR_TIMEZONES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.value === SYSTEM_TIMEZONE
                              ? `${item.label} (${systemTimeZone()})`
                              : item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="settings-row">
                    <div>
                      <h3>登录时启动</h3>
                      <p>
                        {openAtLoginDetail ??
                          "系统登录后自动启动 MediaX；从登录项启动时默认留在菜单栏。"}
                      </p>
                    </div>
                    <Switch
                      checked={openAtLogin}
                      onCheckedChange={(checked) => onOpenAtLogin(checked === true)}
                      aria-label="登录时启动"
                    />
                  </div>
                  <InfoRow
                    title="深度链接"
                    description="可用 mediax://publish、history、settings 等打开对应页面。"
                    value="mediax://"
                  />
                </div>
              </section>
            )}
            {category === "appearance" && (
              <section className="settings-section">
                <h3>视觉风格</h3>
                <div className="settings-section-box">
                  <div className="settings-row">
                    <div>
                      <h3>模式</h3>
                      <p>选择浅色、深色，或跟随系统外观自动切换。</p>
                    </div>
                    <div className="theme-mode-picker" role="radiogroup" aria-label="外观模式">
                      {themeModes.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          role="radio"
                          aria-checked={themePreference === mode.id}
                          aria-label={mode.title}
                          className="theme-mode-option"
                          data-active={themePreference === mode.id || undefined}
                          onClick={() => onThemePreference(mode.id)}
                        >
                          <mode.icon className="size-4" aria-hidden />
                          <span>{mode.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
            {category === "general" && (
              <section className="settings-section">
                <h3>更新</h3>
                <div className="settings-section-box">
                  <div className="settings-row">
                    <div>
                      <h3>当前版本</h3>
                      <p>{updateStatus.message ?? "打包版可从 GitHub Releases 检查更新。"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="settings-row-value">v{updateStatus.currentVersion}</span>
                      {updateStatus.canInstall ? (
                        <Button
                          type="button"
                          disabled={updateBusy}
                          onClick={onInstallUpdate}
                          aria-label="重启并安装更新"
                        >
                          重启安装
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updateBusy || !updateStatus.canCheck}
                        onClick={onCheckForUpdates}
                        aria-label="检查更新"
                      >
                        {updateBusy || updateStatus.state === "checking" ? "检查中…" : "检查更新"}
                      </Button>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div>
                      <h3>自动更新</h3>
                      <p>
                        {updateStatus.availableVersion
                          ? `可用版本 v${updateStatus.availableVersion}`
                          : autoUpdateEnabled
                            ? "启动后自动检查；发现新版本后自动下载。"
                            : "已关闭：不会在启动时检查或自动下载，仍可手动检查更新。"}
                        {updateStatus.progress != null ? ` · ${updateStatus.progress}%` : ""}
                      </p>
                    </div>
                    <Switch
                      checked={autoUpdateEnabled}
                      onCheckedChange={(checked) => onAutoUpdateEnabled(checked === true)}
                      aria-label="自动更新"
                    />
                  </div>
                </div>
              </section>
            )}
            {category === "general" && (
              <section className="settings-section">
                <h3>发布</h3>
                <div className="settings-section-box">
                  <div className="settings-row">
                    <div>
                      <h3>静默发布</h3>
                      <p>开启后，发布在后台进行，不把窗口和账号页面带到前台。</p>
                    </div>
                    <Switch
                      checked={silentPublish}
                      onCheckedChange={(checked) => onSilentPublish(checked === true)}
                      aria-label="静默发布"
                    />
                  </div>
                  <div className="settings-row">
                    <div>
                      <h3>并行数</h3>
                      <p>同时发布的账号数量，同一账号仍按顺序执行。最小为 1。</p>
                    </div>
                    <NumberField
                      min={1}
                      step={1}
                      value={publishConcurrency}
                      onValueChange={(value) => {
                        if (value == null || !Number.isFinite(value)) return;
                        onPublishConcurrency(value);
                      }}
                      className="w-28"
                    >
                      <NumberFieldGroup>
                        <NumberFieldDecrement />
                        <NumberFieldInput aria-label="发布并行数" />
                        <NumberFieldIncrement />
                      </NumberFieldGroup>
                    </NumberField>
                  </div>
                  <div className="settings-row">
                    <div>
                      <h3>网速限制</h3>
                      <p>限制账号浏览器的上下行速率（Kbps），可自定义输入。0 为不限制。</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <NumberField
                        min={0}
                        step={128}
                        value={publishBandwidthLimitKbps}
                        onValueChange={(value) => {
                          if (value == null || !Number.isFinite(value)) return;
                          onPublishBandwidthLimitKbps(value);
                        }}
                        className="w-36"
                      >
                        <NumberFieldGroup>
                          <NumberFieldDecrement />
                          <NumberFieldInput aria-label="发布网速限制" />
                          <NumberFieldIncrement />
                        </NumberFieldGroup>
                      </NumberField>
                      <span className="settings-row-value">Kbps</span>
                    </div>
                  </div>
                </div>
              </section>
            )}
            {category === "notifications" && (
              <>
                <section className="settings-section">
                  <h3>通知</h3>
                  <div className="settings-section-box">
                    <div className="settings-row">
                      <div>
                        <h3>启用通知</h3>
                        <p>
                          {notificationSettings.enabled
                            ? "关闭后不再发送发布相关通知。"
                            : "通知已关闭。开启后可使用下列选项；系统权限请在「系统设置」中确认。"}
                        </p>
                      </div>
                      <Switch
                        checked={notificationSettings.enabled}
                        onCheckedChange={(checked) =>
                          onNotificationSettings({ enabled: checked === true })
                        }
                        aria-label="启用通知"
                      />
                    </div>
                    <div className="settings-row">
                      <div>
                        <h3>发布完成通知</h3>
                        <p>任务完成、部分失败或无法确认结果时提醒你。</p>
                      </div>
                      <Switch
                        checked={notificationSettings.publishResult}
                        disabled={!notificationSettings.enabled}
                        onCheckedChange={(checked) =>
                          onNotificationSettings({ publishResult: checked === true })
                        }
                        aria-label="发布完成通知"
                      />
                    </div>
                    <div className="settings-row">
                      <div>
                        <h3>需要人工处理通知</h3>
                        <p>需要登录或验证才能继续时显示提醒；点击可打开发布记录。</p>
                      </div>
                      <Switch
                        checked={notificationSettings.awaitingUser}
                        disabled={!notificationSettings.enabled}
                        onCheckedChange={(checked) =>
                          onNotificationSettings({ awaitingUser: checked === true })
                        }
                        aria-label="需要人工处理通知"
                      />
                    </div>
                    <div className="settings-row">
                      <div>
                        <h3>通知提示音</h3>
                        <p>任务完成、需要人工处理时播放提示音。</p>
                      </div>
                      <Switch
                        checked={notificationSettings.sound}
                        disabled={!notificationSettings.enabled}
                        onCheckedChange={(checked) =>
                          onNotificationSettings({ sound: checked === true })
                        }
                        aria-label="通知提示音"
                      />
                    </div>
                    <div className="settings-row">
                      <div>
                        <h3>通知隐私</h3>
                        <p>开启后，通知正文不显示账号或目标名称。</p>
                      </div>
                      <Switch
                        checked={notificationSettings.privacy}
                        disabled={!notificationSettings.enabled}
                        onCheckedChange={(checked) =>
                          onNotificationSettings({ privacy: checked === true })
                        }
                        aria-label="通知隐私"
                      />
                    </div>
                  </div>
                </section>
                <section className="settings-section">
                  <h3>系统权限</h3>
                  <div className="settings-section-box">
                    <div className="settings-row">
                      <div>
                        <h3>通知权限</h3>
                        <p>{notificationPermission.detail}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="settings-row-value">{notificationPermission.label}</span>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!notificationSettings.enabled || testNotificationBusy}
                          onClick={onTestNotification}
                          aria-label="发送测试通知"
                        >
                          {testNotificationBusy ? "发送中…" : "发送测试通知"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onOpenNotificationSettings}
                          aria-label="打开系统通知设置"
                        >
                          系统设置
                        </Button>
                      </div>
                    </div>
                  </div>
                  {testNotificationMessage ? (
                    <p className="settings-section-note" role="status">
                      {testNotificationMessage}
                    </p>
                  ) : null}
                </section>
              </>
            )}
            {category === "storage" && (
              <>
                <section className="settings-section storage-panel">
                  <h3 className="storage-panel-title">本机设备</h3>
                  <p className="storage-panel-desc">
                    管理保存在这台电脑上的账号数据、浏览器会话、发布素材与日志
                  </p>
                  <div className="storage-usage">
                    <div className="storage-usage-summary">
                      <p className="storage-usage-total">
                        {storageUsage
                          ? `${formatBytes(storageUsage.totalBytes)} 已被 MediaX 使用`
                          : storageLoading
                            ? "正在统计占用…"
                            : "尚未统计占用"}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={storageLoading}
                        onClick={onRefreshStorage}
                        aria-label="刷新存储占用"
                      >
                        {storageLoading ? "统计中…" : "刷新"}
                      </Button>
                    </div>
                    {storageUsage ? (
                      <>
                        <div
                          className="storage-usage-bar"
                          role="img"
                          aria-label={`存储占用 ${formatBytes(storageUsage.totalBytes)}`}
                        >
                          {storageUsage.categories
                            .filter((item) => item.bytes > 0)
                            .map((item) => {
                              const meta =
                                storageCategoryMeta[item.id as keyof typeof storageCategoryMeta];
                              const widthPercent =
                                storageUsage.totalBytes > 0
                                  ? (item.bytes / storageUsage.totalBytes) * 100
                                  : 0;
                              return (
                                <span
                                  key={item.id}
                                  className="storage-usage-segment"
                                  style={{
                                    width: `${widthPercent}%`,
                                    background: meta?.color ?? "#9aa3af",
                                  }}
                                  title={`${item.label} ${formatBytes(item.bytes)}`}
                                />
                              );
                            })}
                        </div>
                        <ul className="storage-usage-legend">
                          {storageUsage.categories.map((item) => {
                            const meta =
                              storageCategoryMeta[item.id as keyof typeof storageCategoryMeta];
                            return (
                              <li key={item.id}>
                                <span className="storage-usage-legend-head">
                                  <span
                                    className="storage-usage-dot"
                                    style={{ background: meta?.color ?? "#9aa3af" }}
                                    aria-hidden
                                  />
                                  <span className="storage-usage-legend-label">{item.label}</span>
                                </span>
                                <span className="storage-usage-legend-size">
                                  {formatBytes(item.bytes)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : null}
                    {storageMessage ? (
                      <p
                        className={
                          storageMessageError
                            ? "settings-section-note text-destructive"
                            : "settings-section-note"
                        }
                        role={storageMessageError ? "alert" : "status"}
                      >
                        {storageMessage}
                      </p>
                    ) : null}
                  </div>
                  <div className="settings-section-box storage-actions">
                    {storageCleanupActions.map((action) => {
                      const busy = storageClearingId === action.id;
                      return (
                        <div key={action.id} className="settings-row">
                          <div>
                            <h3 className={action.dangerous ? "text-destructive" : undefined}>
                              {action.title}
                            </h3>
                            <p>{action.description}</p>
                          </div>
                          <Button
                            type="button"
                            variant={action.dangerous ? "destructive" : "secondary"}
                            size="sm"
                            disabled={storageClearingId !== null || storageLoading}
                            onClick={() => onClearStorage(action.id)}
                            aria-label={action.button}
                          >
                            {busy ? "清理中…" : action.button}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="settings-section">
                  <h3>故障日志与诊断</h3>
                  <div className="settings-section-box">
                    <div className="settings-row">
                      <div>
                        <h3>日志文件</h3>
                        <p>{diagnostics?.paths.logFile ?? "正在读取…"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="settings-row-value">
                          {diagnostics?.app.packaged ? "安装版" : "开发版"}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onRevealLogFile}
                          aria-label="显示日志文件"
                        >
                          打开日志
                        </Button>
                      </div>
                    </div>
                    <InfoRow
                      title="运行环境"
                      description={
                        diagnostics
                          ? `Electron ${diagnostics.runtime.electron} · ${diagnostics.runtime.platform}/${diagnostics.runtime.arch}`
                          : "正在读取…"
                      }
                      value={diagnostics ? `v${diagnostics.app.version}` : "—"}
                    />
                    <div className="settings-row">
                      <div>
                        <h3>诊断操作</h3>
                        <p>刷新诊断摘要，或导出不含正文与 Cookie 的诊断报告。</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={diagnosticsLoading}
                          onClick={onRefreshDiagnostics}
                          aria-label="刷新诊断信息"
                        >
                          刷新
                        </Button>
                        <Button
                          type="button"
                          disabled={diagnosticsExporting}
                          onClick={onExportDiagnostics}
                          aria-label="导出诊断信息"
                        >
                          {diagnosticsExporting ? "导出中…" : "导出诊断"}
                        </Button>
                      </div>
                    </div>
                    <div className="settings-row">
                      <div>
                        <h3>自动刷新</h3>
                        <p>开启后约每 3 秒刷新日志末尾与诊断摘要；离开本页或关闭开关即停止。</p>
                      </div>
                      <Switch
                        checked={diagnosticsAutoRefresh}
                        onCheckedChange={(checked) => onDiagnosticsAutoRefresh(checked === true)}
                        aria-label="自动刷新诊断信息"
                      />
                    </div>
                  </div>
                  {diagnosticsMessage ? (
                    <p className="settings-section-note" role="status">
                      {diagnosticsMessage}
                    </p>
                  ) : null}
                  <pre className="settings-log-tail" aria-label="日志末尾">
                    {diagnosticsLoading
                      ? "正在读取日志…"
                      : (diagnostics?.logTail ?? "暂无日志内容")}
                  </pre>
                </section>
              </>
            )}
          </PanelErrorBoundary>
        </div>
      </div>
    </div>
  );
}

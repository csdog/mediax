import { useEffect, useState, type ReactNode } from "react";
import { Search, Settings, Keyboard, Bell, Database, ArrowLeft } from "lucide-react";
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
import { ProfileMark } from "@/components/ProfileMark";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import type { UpdateStatus } from "../../shared/models";
import type { NotificationSettings } from "../../shared/notificationSettings";

const categories = [
  {
    id: "general",
    title: "常规",
    icon: Settings,
    keywords:
      "菜单栏 窗口 主题 浅色 深色 深度链接 协议 Dock 角标 登录时启动 开机 快捷键 静默 发布 并行 网速 限速 名称 头像 个人资料 更新 版本",
  },
  {
    id: "notifications",
    title: "通知",
    icon: Bell,
    keywords: "发布 任务 开关 隐私 权限 系统",
  },
  { id: "shortcuts", title: "键盘快捷键", icon: Keyboard, keywords: "全局 呼出 标签 编辑 重置" },
  { id: "storage", title: "存储", icon: Database, keywords: "本地 数据 会话 日志 诊断 导出 故障" },
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
  onCheckForUpdates,
  onInstallUpdate,
  notificationSettings,
  onNotificationSettings,
  notificationPermission,
  onOpenNotificationSettings,
  diagnostics,
  diagnosticsLoading,
  diagnosticsMessage,
  onRefreshDiagnostics,
  onExportDiagnostics,
  diagnosticsExporting,
  onRevealLogFile,
  openAtLogin,
  openAtLoginDetail,
  onOpenAtLogin,
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
  onCheckForUpdates(): void;
  onInstallUpdate(): void;
  notificationSettings: NotificationSettings;
  onNotificationSettings(patch: Partial<NotificationSettings>): void;
  notificationPermission: { supported: boolean; label: string; detail: string };
  onOpenNotificationSettings(): void;
  diagnostics: {
    generatedAt: string;
    app: { version: string; packaged: boolean };
    runtime: { electron: string; platform: string; arch: string };
    paths: { logFile: string };
    counts: { accounts: number; tasks: number };
    logTail: string;
  } | null;
  diagnosticsLoading: boolean;
  diagnosticsMessage: string;
  onRefreshDiagnostics(): void;
  onExportDiagnostics(): void;
  diagnosticsExporting: boolean;
  onRevealLogFile(): void;
  openAtLogin: boolean;
  openAtLoginDetail: string | null;
  onOpenAtLogin(openAtLogin: boolean): void;
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
            {category === "shortcuts" ? children : <h2>{current.title}</h2>}
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
                    description="关闭主窗口后，可通过菜单栏图标重新打开应用。"
                    value="已启用"
                  />
                  <InfoRow
                    title="关闭窗口后隐藏"
                    description="应用继续运行，正在执行的发布任务会继续处理。"
                    value="已启用"
                  />
                  <div className="settings-row">
                    <div>
                      <h3>登录时启动</h3>
                      <p>
                        {openAtLoginDetail ??
                          "系统登录后自动启动 media-post；从登录项启动时默认留在菜单栏。"}
                      </p>
                    </div>
                    <Switch
                      checked={openAtLogin}
                      onCheckedChange={(checked) => onOpenAtLogin(checked === true)}
                      aria-label="登录时启动"
                    />
                  </div>
                  <InfoRow
                    title="主题"
                    description="跟随系统外观自动切换浅色 / 深色。"
                    value="跟随系统"
                  />
                  <InfoRow
                    title="深度链接"
                    description="可用 media-post://compose、history、settings 等打开对应页面。"
                    value="media-post://"
                  />
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
                      <p>{updateStatus.message ?? "打包版会在启动后自动检查 GitHub Releases。"}</p>
                    </div>
                    <span className="settings-row-value">v{updateStatus.currentVersion}</span>
                  </div>
                  <div className="settings-row">
                    <div>
                      <h3>自动更新</h3>
                      <p>
                        {updateStatus.availableVersion
                          ? `可用版本 v${updateStatus.availableVersion}`
                          : "从 GitHub Releases 检查并下载更新。"}
                        {updateStatus.progress != null ? ` · ${updateStatus.progress}%` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
                  <h3>任务通知</h3>
                  <div className="settings-section-box">
                    <div className="settings-row">
                      <div>
                        <h3>启用通知</h3>
                        <p>关闭后不再发送发布相关系统通知。</p>
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
                        <h3>发布结果</h3>
                        <p>任务完成或存在失败项时显示系统通知。</p>
                      </div>
                      <Switch
                        checked={notificationSettings.publishResult}
                        disabled={!notificationSettings.enabled}
                        onCheckedChange={(checked) =>
                          onNotificationSettings({ publishResult: checked === true })
                        }
                        aria-label="发布结果通知"
                      />
                    </div>
                    <div className="settings-row">
                      <div>
                        <h3>需要人工处理</h3>
                        <p>需要登录或验证时通知你，点击通知可打开发布记录。</p>
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
                          onClick={onOpenNotificationSettings}
                          aria-label="打开系统通知设置"
                        >
                          系统设置
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
            {category === "storage" && (
              <>
                <section className="settings-section">
                  <h3>本地数据</h3>
                  <div className="settings-section-box">
                    <InfoRow
                      title="账号与发布记录"
                      description="账号信息、草稿、设置和任务记录保存在本机。"
                      value="SQLite"
                    />
                    <InfoRow
                      title="浏览器会话"
                      description="每个账号使用独立的持久化浏览器会话。"
                      value="本地存储"
                    />
                    <InfoRow
                      title="发布素材"
                      description="创建任务时保存图片副本，供任务继续执行与结果核验。"
                      value="本地存储"
                    />
                  </div>
                </section>
                <section className="settings-section">
                  <h3>故障日志与诊断</h3>
                  <div className="settings-section-box">
                    <InfoRow
                      title="日志文件"
                      description={diagnostics?.paths.logFile ?? "正在读取…"}
                      value={diagnostics?.app.packaged ? "安装版" : "开发版"}
                    />
                    <InfoRow
                      title="运行环境"
                      description={
                        diagnostics
                          ? `v${diagnostics.app.version} · Electron ${diagnostics.runtime.electron} · ${diagnostics.runtime.platform}/${diagnostics.runtime.arch}`
                          : "正在读取…"
                      }
                      value={
                        diagnostics
                          ? `${diagnostics.counts.accounts} 账号 / ${diagnostics.counts.tasks} 任务`
                          : "—"
                      }
                    />
                    <div className="settings-row">
                      <div>
                        <h3>诊断操作</h3>
                        <p>导出不含正文与 Cookie 的诊断报告，或在文件管理器中打开日志。</p>
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
                          variant="outline"
                          onClick={onRevealLogFile}
                          aria-label="显示日志文件"
                        >
                          打开日志
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

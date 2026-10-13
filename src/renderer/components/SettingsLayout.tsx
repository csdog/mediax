import { useEffect, useState, type ReactNode } from "react";
import { Search, Settings, Keyboard, Bell, Database, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ProfileMark } from "@/components/ProfileMark";

const categories = [
  {
    id: "general",
    title: "常规",
    icon: Settings,
    keywords: "菜单栏 窗口 快捷键 静默 发布 名称 头像 个人资料",
  },
  { id: "notifications", title: "通知", icon: Bell, keywords: "发布 任务" },
  { id: "shortcuts", title: "键盘快捷键", icon: Keyboard, keywords: "全局 呼出" },
  { id: "storage", title: "存储", icon: Database, keywords: "本地 数据 会话" },
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
  profileName,
  profileAvatar,
  profileError,
  onProfileName,
  onChooseAvatar,
  onClearAvatar,
}: {
  children: ReactNode;
  onBack(): void;
  silentPublish: boolean;
  onSilentPublish(silent: boolean): void;
  profileName: string;
  profileAvatar: string | null;
  profileError: string;
  onProfileName(name: string): void;
  onChooseAvatar(): void;
  onClearAvatar(): void;
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
          <h2>{current.title}</h2>
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
              </div>
            </section>
          )}
          {(category === "general" || category === "shortcuts") && (
            <section className="settings-section">
              <h3>快捷键</h3>
              <div className="settings-section-box settings-shortcut-box">{children}</div>
            </section>
          )}
          {category === "shortcuts" && (
            <section className="settings-section">
              <h3>常用快捷键</h3>
              <div className="settings-section-box">
                {[
                  ["新建标签页", "⌘ / Ctrl + T"],
                  ["关闭当前标签页", "⌘ / Ctrl + W"],
                  ["重新打开关闭的标签页", "⌘ / Ctrl + Shift + T"],
                  ["下一个标签页", "Ctrl + Tab"],
                  ["上一个标签页", "Ctrl + Shift + Tab"],
                  ["打开设置", "⌘ / Ctrl + ,"],
                  ["编辑内容", "⌘ + N"],
                  ["保存草稿", "⌘ + S"],
                  ["导入 Markdown", "⌘ + O"],
                  ["账号 / 编辑 / 记录", "⌘ + 1 / 2 / 3"],
                  ["隐藏窗口", "⌘ + Shift + W"],
                ].map(([title, value]) => (
                  <div className="settings-row" key={title}>
                    <h3>{title}</h3>
                    <kbd className="settings-row-value">{value}</kbd>
                  </div>
                ))}
              </div>
              <p className="settings-section-note">
                工作区标签页固定保留；关闭标签页不会退出应用。重新打开标签页将载入账号首页。
              </p>
            </section>
          )}
          {category === "notifications" && (
            <section className="settings-section">
              <h3>任务通知</h3>
              <div className="settings-section-box">
                <InfoRow
                  title="发布结果"
                  description="任务完成或存在失败项时显示系统通知。"
                  value="已启用"
                />
                <InfoRow
                  title="需要人工处理"
                  description="需要登录或验证时通知你，点击通知可打开发布记录。"
                  value="已启用"
                />
              </div>
              <p className="settings-section-note">通知是否展示由 macOS 系统通知权限控制。</p>
            </section>
          )}
          {category === "storage" && (
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
          )}
        </div>
      </div>
    </div>
  );
}

import {
  dialog,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type WebContents,
} from "electron";
import type { Options } from "electron-context-menu";
import { userErrorMessage } from "../../shared/userError";

type OpenUrl = (url: string) => void;
const webUrl = (url: string) => /^https?:\/\//i.test(url);

function mediaAction(contents: WebContents, params: ContextMenuParams, action: string) {
  // Coordinates come from Chromium, and the action is one of our fixed menu commands.
  const script = `(() => {
    const media = document.elementFromPoint(${params.x}, ${params.y})?.closest('video,audio');
    if (!media) return;
    ${action}
  })()`;
  const result = params.frame
    ? params.frame.executeJavaScript(script)
    : contents.executeJavaScript(script, true);
  return result.catch(() => {});
}

export function browserContextMenuOptions(contents: WebContents, openUrl: OpenUrl): Options {
  return {
    window: contents,
    showSelectAll: true,
    showPasteAndMatchStyle: true,
    showCopyImage: true,
    showCopyImageAddress: true,
    showSaveImage: true,
    showSaveImageAs: true,
    showCopyVideoAddress: true,
    showSaveVideo: true,
    showSaveVideoAs: true,
    showCopyVideoFrame: true,
    showSaveVideoFrameAs: true,
    showPictureInPicture: true,
    showCopyLink: true,
    showSaveLinkAs: true,
    showInspectElement: true,
    // Passing the clicked frame lets macOS add its contextual Services automatically.
    // The library's generic App Services submenu would duplicate it.
    showServices: false,
    showSearchWithGoogle: false,
    labels: {
      learnSpelling: "记住拼写",
      lookUpSelection: "查询“{selection}”",
      dictionarySuggestions: "没有拼写建议",
      cut: "剪切",
      copy: "复制",
      paste: "粘贴",
      pasteAndMatchStyle: "粘贴并匹配样式",
      selectAll: "全选",
      saveImage: "保存图片",
      saveImageAs: "图片另存为…",
      copyImage: "复制图片",
      copyImageAddress: "复制图片地址",
      saveVideo: "保存视频",
      saveVideoAs: "视频另存为…",
      copyVideoAddress: "复制视频地址",
      copyVideoFrame: "复制视频帧",
      saveVideoFrameAs: "视频帧另存为…",
      pictureInPicture: "画中画",
      copyLink: "复制链接地址",
      saveLinkAs: "链接另存为…",
      inspect: "检查元素",
      services: "服务",
    },
    prepend: (actions, params) => {
      const items: MenuItemConstructorOptions[] = [];
      if (params.isEditable) {
        items.push(
          { label: "撤销", enabled: params.editFlags.canUndo, click: () => contents.undo() },
          { label: "重做", enabled: params.editFlags.canRedo, click: () => contents.redo() },
          { type: "separator" },
        );
      }
      if (webUrl(params.linkURL)) {
        items.push(
          { label: "在新标签页中打开链接", click: () => openUrl(params.linkURL) },
          { type: "separator" },
        );
      }
      if (params.selectionText.trim()) {
        items.push(
          {
            id: "searchWithGoogle",
            label: "搜索“{selection}”",
            click: () =>
              openUrl(
                `https://www.google.com/search?q=${encodeURIComponent(params.selectionText)}`,
              ),
          },
          { type: "separator" },
        );
      }
      if (params.mediaType === "image" && webUrl(params.srcURL)) {
        items.push(
          { label: "在新标签页中打开图片", click: () => openUrl(params.srcURL) },
          { type: "separator" },
        );
      }
      if (params.mediaType === "audio" || params.mediaType === "video") {
        const flags = params.mediaFlags;
        items.push(
          {
            label: flags.isPaused ? "播放" : "暂停",
            enabled: !flags.inError,
            click: () =>
              mediaAction(
                contents,
                params,
                flags.isPaused ? "return media.play();" : "media.pause();",
              ),
          },
          {
            label: "静音",
            type: "checkbox",
            checked: flags.isMuted,
            enabled: flags.hasAudio,
            click: () => mediaAction(contents, params, "media.muted = !media.muted;"),
          },
          {
            label: "循环播放",
            type: "checkbox",
            checked: flags.isLooping,
            enabled: flags.canLoop,
            click: () => mediaAction(contents, params, "media.loop = !media.loop;"),
          },
          {
            label: "显示控件",
            type: "checkbox",
            checked: flags.isControlsVisible,
            enabled: flags.canToggleControls,
            click: () => mediaAction(contents, params, "media.controls = !media.controls;"),
          },
        );
        if (params.mediaType === "audio") {
          items.push(
            {
              ...actions.copyVideoAddress(),
              id: "copyAudioAddress",
              label: "复制音频地址",
              visible: true,
            },
            {
              ...actions.saveVideoAs(),
              id: "saveAudioAs",
              label: "音频另存为…",
              visible: true,
              enabled: flags.canSave,
            },
          );
        } else {
          items.push(
            { ...actions.saveVideo(), enabled: flags.canSave },
            { ...actions.saveVideoAs(), enabled: flags.canSave },
            {
              ...actions.pictureInPicture(),
              visible: Boolean(flags.canShowPictureInPicture || flags.isShowingPictureInPicture),
            },
            {
              label: "全屏",
              click: () => mediaAction(contents, params, "return media.requestFullscreen();"),
            },
          );
        }
        items.push({ type: "separator" });
      }
      if (
        !params.isEditable &&
        !params.selectionText &&
        !params.linkURL &&
        params.mediaType === "none"
      ) {
        const history = contents.navigationHistory;
        items.push(
          { label: "后退", enabled: history.canGoBack(), click: () => history.goBack() },
          { label: "前进", enabled: history.canGoForward(), click: () => history.goForward() },
          { label: "刷新", click: () => contents.reload() },
          { label: "打印…", click: () => contents.print() },
          {
            label: "网页另存为…",
            click: async () => {
              try {
                const result = await dialog.showSaveDialog({
                  defaultPath: "page.html",
                  filters: [{ name: "网页", extensions: ["html"] }],
                });
                if (!result.canceled && result.filePath && !contents.isDestroyed())
                  await contents.savePage(result.filePath, "HTMLComplete");
              } catch (error) {
                dialog.showErrorBox(
                  "网页保存失败",
                  userErrorMessage(error, "网页未能保存，请稍后重试。"),
                );
              }
            },
          },
          { type: "separator" },
        );
      }
      return items;
    },
  };
}

export async function installBrowserContextMenu(contents: WebContents, openUrl: OpenUrl) {
  const { default: contextMenu } = await import("electron-context-menu");
  if (!contents.isDestroyed()) contextMenu(browserContextMenuOptions(contents, openUrl));
}

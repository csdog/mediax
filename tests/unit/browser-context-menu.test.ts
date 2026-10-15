import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";
import type { ContextMenuParams, MenuItemConstructorOptions, WebContents } from "electron";
import { installBrowserContextMenu } from "../../src/main/browser/contextMenu";

const state = vi.hoisted(() => ({ items: [] as MenuItemConstructorOptions[], popup: vi.fn() }));
vi.mock("electron", () => {
  const electron = {
    app: { isPackaged: false },
    BrowserWindow: { fromWebContents: () => undefined },
    clipboard: { writeText: vi.fn(), write: vi.fn() },
    ClipboardItem: class {},
    dialog: { showErrorBox: vi.fn() },
    Menu: {
      buildFromTemplate: (items: MenuItemConstructorOptions[]) => {
        state.items = items;
        return { popup: state.popup };
      },
    },
  };
  return { default: electron, ...electron };
});

beforeEach(() => {
  vi.clearAllMocks();
  state.items = [];
});

async function setup(overrides: Partial<ContextMenuParams> = {}) {
  const contents = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    copy: vi.fn(),
    paste: vi.fn(),
    inspectElement: vi.fn(),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    navigationHistory: { canGoBack: () => false, canGoForward: () => true },
  });
  const openUrl = vi.fn();
  await installBrowserContextMenu(contents as unknown as WebContents, openUrl);
  const params = {
    x: 23,
    y: 45,
    isEditable: false,
    selectionText: "",
    linkURL: "",
    srcURL: "",
    mediaType: "none",
    dictionarySuggestions: [],
    misspelledWord: "",
    mediaFlags: {},
    editFlags: {
      canCopy: true,
      canCut: false,
      canPaste: true,
      canUndo: false,
      canRedo: false,
      canSelectAll: true,
    },
    ...overrides,
  } as ContextMenuParams;
  contents.emit("context-menu", {}, params);
  const item = (label: string) => state.items.find((i) => i.label === label);
  const click = async (label: string) =>
    item(label)?.click?.({} as Electron.MenuItem, undefined, {} as Electron.KeyboardEvent);
  return { contents, item, click, openUrl };
}

it("builds the real native editing menu using the clicked page's permissions", async () => {
  const { contents, item, click } = await setup({ isEditable: true, selectionText: "selected" });
  expect(item("剪切")?.enabled).toBe(false);
  expect(item("粘贴并匹配样式")?.enabled).toBe(true);
  await click("复制");
  await click("粘贴");
  expect(contents.copy).toHaveBeenCalledOnce();
  expect(contents.paste).toHaveBeenCalledOnce();
  expect(state.popup).toHaveBeenCalledOnce();
});

it("opens links in a workspace tab and inspects the original clicked coordinates", async () => {
  const { contents, click, openUrl, item } = await setup({ linkURL: "https://example.com/link" });
  expect(item("链接另存为…")).toBeDefined();
  await click("在新标签页中打开链接");
  await click("检查元素");
  expect(openUrl).toHaveBeenCalledWith("https://example.com/link");
  expect(contents.inspectElement).toHaveBeenCalledWith(23, 45);
});

it("offers image saving and copying instead of video actions on images", async () => {
  const { item, click, openUrl } = await setup({
    mediaType: "image",
    srcURL: "https://example.com/image.png",
  });
  expect(item("图片另存为…")).toBeDefined();
  expect(item("复制图片地址")).toBeDefined();
  expect(item("视频另存为…")).toBeUndefined();
  await click("在新标签页中打开图片");
  expect(openUrl).toHaveBeenCalledWith("https://example.com/image.png");
});

it("offers video frame and playback controls and cleans up when the page closes", async () => {
  const { contents, item, click } = await setup({
    mediaType: "video",
    srcURL: "https://example.com/video.mp4",
    mediaFlags: {
      isPaused: true,
      hasAudio: true,
      canLoop: true,
      canToggleControls: true,
      canSave: true,
      canShowPictureInPicture: true,
    } as ContextMenuParams["mediaFlags"],
  });
  expect(item("视频另存为…")).toBeDefined();
  expect(item("复制视频帧")).toBeDefined();
  expect(item("画中画")).toBeDefined();
  await click("播放");
  expect(contents.executeJavaScript).toHaveBeenCalledWith(
    expect.stringContaining("media.play()"),
    true,
  );
  contents.emit("destroyed");
  expect(contents.listenerCount("context-menu")).toBe(0);
});

it("does not open executable link schemes as workspace tabs", async () => {
  const { item } = await setup({ linkURL: "javascript:alert(1)" });
  expect(item("在新标签页中打开链接")).toBeUndefined();
});

it("keeps audio operations separate from video frames and respects unavailable PiP", async () => {
  const audio = await setup({
    mediaType: "audio",
    srcURL: "https://example.com/audio.mp3",
    mediaFlags: { isPaused: true, canSave: true } as ContextMenuParams["mediaFlags"],
  });
  expect(audio.item("音频另存为…")?.enabled).toBe(true);
  expect(audio.item("复制音频地址")).toBeDefined();
  expect(audio.item("复制视频帧")).toBeUndefined();
  const video = await setup({
    mediaType: "video",
    srcURL: "https://example.com/stream",
    mediaFlags: {
      canSave: false,
      canShowPictureInPicture: false,
    } as ContextMenuParams["mediaFlags"],
  });
  expect(video.item("视频另存为…")?.enabled).toBe(false);
  expect(video.item("画中画")).toBeUndefined();
});

import type { Locator, Page } from "playwright-core";
import type { Target, Task } from "../../shared/models";
import { NeedsUser, NotSubmitted } from "./Publisher";
import { isAudio, isVideo } from "../../shared/content";

export function selectAll() {
  return process.platform === "darwin" ? "Meta+A" : "Control+A";
}

export function photos(task: Task) {
  return task.images.filter((path) => !isVideo(path) && !isAudio(path));
}

export function coverImage(task: Task) {
  return task.cover || photos(task)[0] || null;
}

export async function discoverProfile(
  page: Page,
  accountId: string,
  name: string,
  loggedOut: (url: string) => boolean,
): Promise<Target[]> {
  if (loggedOut(page.url())) return [];
  return [{ accountId, identityId: "1", name, kind: "profile" }];
}

export async function replaceText(page: Page, box: Locator, text: string) {
  await box.waitFor({ state: "visible", timeout: 30000 });
  await box.click();
  await page.keyboard.press(selectAll());
  await page.keyboard.press("Delete");
  try {
    await box.fill(text);
  } catch {
    await page.keyboard.insertText(text);
  }
}

export async function waitUntil(
  page: Page,
  ready: () => Promise<boolean>,
  timeout: number,
  message: string,
) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await ready().catch(() => false)) return;
    await page.waitForTimeout(2000);
  }
  throw new NotSubmitted(message);
}

export async function requireFile(page: Page, selector: string) {
  const input = page.locator(selector).first();
  await input.waitFor({ state: "attached", timeout: 30000 });
  return input;
}

export function requireVideo(task: Task, label: string) {
  const video = task.images.find(isVideo);
  if (!video) throw new NeedsUser(`${label} 需要一段视频，请在正文中附上视频后再发布`);
  return video;
}

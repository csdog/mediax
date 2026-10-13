import { existsSync } from "node:fs";
import type { DesktopCommand } from "../../shared/models";
import { isMarkdownPath } from "../content/mediaAssets";
import { isAudio, isImage, isVideo } from "../../shared/content";

const openable = (path: string) =>
  isMarkdownPath(path) || isImage(path) || isVideo(path) || isAudio(path);

/** Paths passed on the command line when the OS opens files with this app. */
export function findOpenFileArgs(argv: readonly string[]) {
  return argv.filter((arg, index) => {
    if (index === 0) return false;
    if (!arg || arg.startsWith("-")) return false;
    if (/^mediax:/i.test(arg)) return false;
    if (!openable(arg)) return false;
    try {
      return existsSync(arg);
    } catch {
      return false;
    }
  });
}

export function openFilesCommand(paths: string[]): DesktopCommand | null {
  const unique = [...new Set(paths.filter((path) => openable(path) && existsSync(path)))];
  if (!unique.length) return null;
  return { action: "open-files", paths: unique };
}

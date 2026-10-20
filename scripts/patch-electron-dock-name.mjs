/**
 * Dev-only (macOS): Dock / ⌘-Tab / Activity Monitor use the .app bundle, not app.setName().
 * Rename Electron.app → MediaX.app, keep path.txt in sync, patch Info.plist,
 * install MediaX.icns, and refresh Launch Services. Packaged builds already use MediaX.app.
 *
 * app.dock.setIcon() only updates the Dock tile; system process lists need the
 * bundle icon. Activity Monitor can retain a previously loaded icon even after
 * the bundle is updated, so fully quit and reopen it when verifying changes.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";

if (process.platform !== "darwin") process.exit(0);

const productName = "MediaX";
const bundleId = "local.mediax.desktop";
const iconFile = "MediaX.icns";
const desiredApp = `${productName}.app`;
const require = createRequire(import.meta.url);

let pkgDir;
try {
  pkgDir = dirname(require.resolve("electron/package.json"));
} catch {
  process.exit(0);
}

const distDir = join(pkgDir, "dist");
const pathFile = join(pkgDir, "path.txt");
if (!existsSync(pathFile)) {
  console.warn("[patch:dock-name] no electron/path.txt — skip");
  process.exit(0);
}

const relative = readFileSync(pathFile, "utf8").trim();
const slash = relative.indexOf("/");
if (slash < 0) {
  console.warn(`[patch:dock-name] unexpected path.txt: ${relative}`);
  process.exit(0);
}
const execSuffix = relative.slice(slash); // /Contents/MacOS/Electron
const stockDir = join(distDir, "Electron.app");
const legacyDirs = ["media-post.app", "mediax.app"].map((name) => join(distDir, name));
const desiredDir = join(distDir, desiredApp);

// Fresh install / re-download drops Electron.app again — prefer branding that copy.
if (existsSync(stockDir)) {
  if (existsSync(desiredDir)) rmSync(desiredDir, { recursive: true, force: true });
  renameSync(stockDir, desiredDir);
} else if (!existsSync(desiredDir)) {
  const legacyDir = legacyDirs.find((dir) => existsSync(dir));
  if (legacyDir) renameSync(legacyDir, desiredDir);
  else {
    console.warn(`[patch:dock-name] missing Electron bundle under ${distDir}`);
    process.exit(0);
  }
}

// electron/index.js does NOT trim path.txt — a trailing newline makes existsSync fail
// and triggers a full Electron re-download that restores Electron.app.
writeFileSync(pathFile, `${desiredApp}${execSuffix}`);

const plistPath = join(desiredDir, "Contents", "Info.plist");
if (!existsSync(plistPath)) process.exit(0);

// Break pnpm store hardlinks before mutating the plist.
const original = readFileSync(plistPath);
unlinkSync(plistPath);
writeFileSync(plistPath, original);

const buddy = "/usr/libexec/PlistBuddy";
const setPlist = (plist, key, value) => {
  try {
    execFileSync(buddy, ["-c", `Set :${key} ${value}`, plist], { stdio: "pipe" });
  } catch {
    execFileSync(buddy, ["-c", `Add :${key} string ${value}`, plist], { stdio: "pipe" });
  }
};
for (const key of ["CFBundleName", "CFBundleDisplayName"]) setPlist(plistPath, key, productName);
setPlist(plistPath, "CFBundleIdentifier", bundleId);

const iconPng = join(dirname(fileURLToPath(import.meta.url)), "../build/icon.png");
const icns = buildIcns(iconPng);
if (icns) {
  installIcon(join(desiredDir, "Contents"), icns);
  const frameworks = join(desiredDir, "Contents", "Frameworks");
  for (const name of readdirSync(frameworks)) {
    if (!name.startsWith("Electron Helper") || !name.endsWith(".app")) continue;
    const contents = join(frameworks, name, "Contents");
    const helperPlist = join(contents, "Info.plist");
    if (existsSync(helperPlist)) {
      const helperOriginal = readFileSync(helperPlist);
      unlinkSync(helperPlist);
      writeFileSync(helperPlist, helperOriginal);
      // Electron looks helpers up by this stock id. Renaming it stops the renderer.
      setPlist(helperPlist, "CFBundleIdentifier", "com.github.Electron.helper");
    }
    installIcon(contents, icns);
  }
} else {
  console.warn("[patch:dock-name] skipped Activity Monitor icon");
}

const lsregister =
  "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
if (existsSync(lsregister)) {
  try {
    execFileSync(lsregister, ["-f", desiredDir], { stdio: "ignore" });
  } catch {
    // non-fatal
  }
}

console.log(`[patch:dock-name] dev bundle → ${desiredApp}`);

function installIcon(contents, icns) {
  const resources = join(contents, "Resources");
  mkdirSync(resources, { recursive: true });
  writeUnlinked(join(resources, iconFile), icns);
  const stale = join(resources, "electron.icns");
  if (existsSync(stale)) unlinkSync(stale);
  const plist = join(contents, "Info.plist");
  if (existsSync(plist)) setPlist(plist, "CFBundleIconFile", iconFile);
}

function writeUnlinked(dest, data) {
  if (existsSync(dest)) unlinkSync(dest);
  writeFileSync(dest, data);
}

function buildIcns(png) {
  if (!existsSync(png)) {
    console.warn(`[patch:dock-name] missing ${png}`);
    return null;
  }
  const dir = mkdtempSync(join(tmpdir(), "mediax-icon-"));
  try {
    const iconset = join(dir, "icon.iconset");
    mkdirSync(iconset);
    const entries = [
      [16, "icon_16x16.png"],
      [32, "icon_16x16@2x.png"],
      [32, "icon_32x32.png"],
      [64, "icon_32x32@2x.png"],
      [128, "icon_128x128.png"],
      [256, "icon_128x128@2x.png"],
      [256, "icon_256x256.png"],
      [512, "icon_256x256@2x.png"],
      [512, "icon_512x512.png"],
      [1024, "icon_512x512@2x.png"],
    ];
    for (const [size, name] of entries) {
      execFileSync("sips", ["-z", String(size), String(size), png, "--out", join(iconset, name)]);
    }
    const out = join(dir, "icon.icns");
    execFileSync("iconutil", ["-c", "icns", iconset, "-o", out]);
    return readFileSync(out);
  } catch (error) {
    console.warn(
      `[patch:dock-name] icon conversion failed: ${error instanceof Error ? error.message : error}`,
    );
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

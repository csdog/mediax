/**
 * Dev-only (macOS): Dock / ⌘-Tab show the .app *folder* name, not app.setName().
 * Rename Electron.app → MediaX.app, keep path.txt in sync, patch Info.plist,
 * and refresh Launch Services. Packaged builds already use MediaX.app.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { existsSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

if (process.platform !== "darwin") process.exit(0);

const productName = "MediaX";
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
for (const key of ["CFBundleName", "CFBundleDisplayName"]) {
  try {
    execFileSync(buddy, ["-c", `Set :${key} ${productName}`, plistPath]);
  } catch {
    execFileSync(buddy, ["-c", `Add :${key} string ${productName}`, plistPath]);
  }
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

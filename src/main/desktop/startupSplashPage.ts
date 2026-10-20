/** Minimal splash document: centered app icon on a transparent surface (native vibrancy shows through). */
export function startupSplashHtml(iconFileUrl: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="color-scheme" content="light dark" />
<style>
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    -webkit-user-select: none;
    user-select: none;
  }
  body {
    display: grid;
    place-items: center;
  }
  img {
    width: 96px;
    height: 96px;
    display: block;
  }
</style>
</head>
<body>
  <img src="${iconFileUrl}" width="96" height="96" alt="" draggable="false" />
</body>
</html>`;
}

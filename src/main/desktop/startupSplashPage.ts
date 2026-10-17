/** Minimal splash document: centered app icon on a theme-matched surface. */
export function startupSplashHtml(iconFileUrl: string, dark: boolean): string {
  const background = dark ? "#000000" : "#f9f9f9";
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="color-scheme" content="${dark ? "dark" : "light"}" />
<style>
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    background: ${background};
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

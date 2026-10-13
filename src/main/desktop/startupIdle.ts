/** Run work after the main window has painted, without blocking first paint. */
export function scheduleAfterFirstPaint(window: Electron.BrowserWindow, work: () => void) {
  const run = () => {
    setTimeout(work, 0);
  };
  if (window.webContents.isLoadingMainFrame()) {
    window.webContents.once("did-finish-load", run);
  } else {
    run();
  }
}

/** Keep implementation details in logs, while preserving actionable business messages. */
export function userErrorMessage(error: unknown, fallback = "操作未完成，请稍后重试。") {
  let message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  // Electron and callers can each wrap the same error, sometimes more than once.
  let previous: string;
  do {
    previous = message;
    message = message
      .replace(/^Error invoking remote method ['"][^'"]+['"]:\s*/i, "")
      .replace(/^(?:Error|TypeError|ReferenceError|SyntaxError|RangeError):\s*/i, "")
      .trim();
  } while (message !== previous);
  if (
    /ERR_(?:INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_REFUSED|CONNECTION_RESET|FAILED)|Failed to fetch|fetch failed/i.test(
      message,
    )
  )
    return "页面暂时无法连接，请检查网络后重试。";
  if (/ERR_CERT_|certificate/i.test(message)) return "网站的安全连接验证失败，请稍后重试。";
  if (/ERR_TIMED_OUT|TimeoutError|\btimeout\b|timed out/i.test(message))
    return "等待时间较长，请稍后重试。";
  if (/ERR_ABORTED/i.test(message)) return "页面加载已取消，可以重新打开后重试。";
  if (/\b(?:EACCES|EPERM)\b/i.test(message)) return "没有访问权限，请检查文件或文件夹权限。";
  if (/\bENOSPC\b/i.test(message)) return "磁盘空间不足，请清理后重试。";
  if (/\bENOENT\b/i.test(message)) return "文件已移动或删除，请重新选择。";
  const firstLine = message.split(/\r?\n/)[0].trim();
  if (
    !/[\u3400-\u9fff]/.test(firstLine) ||
    firstLine.length > 220 ||
    /(?:Cannot read|is not a function|is undefined|Unexpected token|SQLITE_|ERR_[A-Z_]+|\b(?:TypeError|ReferenceError|SyntaxError|ipcRenderer|webContents|locator|evaluate|waitForSelector)\b|https?:\/\/|file:\/\/|\/Users\/|node_modules|\.(?:tsx?|m?js):\d|[`{}])/i.test(
      firstLine,
    )
  )
    return fallback;
  return firstLine || fallback;
}

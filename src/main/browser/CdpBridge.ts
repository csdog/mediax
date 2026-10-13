import type { Browser, Page } from "playwright-core";

export class CdpBridge {
  private browser?: Browser;
  async connect(endpoint: string): Promise<void> {
    const u = new URL(endpoint);
    if (u.hostname !== "127.0.0.1") throw new Error("CDP must use loopback");
    // playwright-core is large; load only when an account page is actually needed.
    const { chromium } = await import("playwright-core");
    this.browser = await chromium.connectOverCDP(endpoint, { timeout: 15000 });
  }
  async findPage(bootstrapUrl: string): Promise<Page> {
    for (let i = 0; i < 100; i++) {
      const matches = this.browser!.contexts()
        .flatMap((c) => c.pages())
        .filter((p) => p.url() === bootstrapUrl);
      if (matches.length > 1) throw new Error("Ambiguous account target");
      if (matches.length === 1) return matches[0];
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("Electron account target not exposed through CDP");
  }
  async findTarget(targetId: string): Promise<Page> {
    if (!this.browser?.isConnected()) throw new Error("浏览器连接已断开，请重新打开账号标签页");
    for (const page of this.browser.contexts().flatMap((context) => context.pages())) {
      const session = await page.context().newCDPSession(page);
      try {
        const { targetInfo } = await session.send("Target.getTargetInfo");
        if (targetInfo.targetId === targetId) return page;
      } finally {
        await session.detach();
      }
    }
    throw new Error("未找到账号对应的浏览器 target");
  }
  async disconnect(): Promise<void> {
    await this.browser?.close();
    this.browser = undefined;
  }
}

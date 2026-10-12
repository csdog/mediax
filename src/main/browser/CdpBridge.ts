import { chromium, type Browser, type Page } from "playwright-core";
export class CdpBridge {
  private browser?: Browser;
  async connect(endpoint: string): Promise<void> {
    const u = new URL(endpoint);
    if (u.hostname !== "127.0.0.1") throw new Error("CDP must use loopback");
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
  async disconnect(): Promise<void> {
    await this.browser?.close();
    this.browser = undefined;
  }
}

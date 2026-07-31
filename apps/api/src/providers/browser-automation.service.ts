import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { chromium, type Browser, type Page } from 'playwright';
import { resolve } from 'node:path';
import { promises as fs } from 'node:fs';

@Injectable()
export class BrowserAutomationService implements OnModuleDestroy {
  private browser?: Browser;
  private page?: Page;
  private closeTimer?: NodeJS.Timeout;

  async open(url: string) {
    this.assertPublicUrl(url);
    const page = await this.ensurePage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    this.scheduleClose();
    return this.describe(page);
  }

  async click(selector: string) { const page = await this.requirePage(); await page.locator(selector).first().click({ timeout: 15_000 }); await page.waitForLoadState('domcontentloaded').catch(() => undefined); this.scheduleClose(); return this.describe(page); }
  async fill(selector: string, text: string) { const page = await this.requirePage(); await page.locator(selector).first().fill(text, { timeout: 15_000 }); this.scheduleClose(); return `已在 ${selector} 输入内容。`; }
  async scroll(amount: number) { const page = await this.requirePage(); await page.mouse.wheel(0, Math.max(-4000, Math.min(4000, amount))); this.scheduleClose(); return this.describe(page); }
  async read() { const page = await this.requirePage(); this.scheduleClose(); return this.describe(page); }
  async screenshot(name = 'browser-page') {
    const page = await this.requirePage();
    const dir = resolve(process.env.AGENT_WORKSPACE_ROOT ?? process.cwd(), 'browser-captures');
    await fs.mkdir(dir, { recursive: true });
    const file = resolve(dir, `${name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60)}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: true }); this.scheduleClose();
    return `已保存浏览器截图：${file}`;
  }
  async close() { await this.browser?.close(); this.browser = undefined; this.page = undefined; if (this.closeTimer) clearTimeout(this.closeTimer); return '浏览器会话已关闭。'; }
  async onModuleDestroy() { await this.close(); }

  private async ensurePage() { if (!this.browser) this.browser = await chromium.launch({ headless: true }); if (!this.page) this.page = await this.browser.newPage({ viewport: { width: 1440, height: 960 } }); return this.page; }
  private async requirePage() { if (!this.page) throw new BadRequestException('浏览器尚未打开页面，请先调用 browser_open'); return this.page; }
  private async describe(page: Page) { const title = await page.title(); const url = page.url(); const text = (await page.locator('body').innerText({ timeout: 8_000 }).catch(() => '')).replace(/\s+/g, ' ').slice(0, 8000); return `标题：${title}\n地址：${url}\n页面文本：${text}`; }
  private scheduleClose() { if (this.closeTimer) clearTimeout(this.closeTimer); this.closeTimer = setTimeout(() => void this.close(), 10 * 60_000); }
  private assertPublicUrl(value: string) { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || /(^localhost$|^127\.|^0\.|^10\.|^192\.168\.|^169\.254\.|\.local$)/i.test(url.hostname)) throw new BadRequestException('仅允许访问公开 HTTP/HTTPS 地址'); }
}

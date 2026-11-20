/**
 * 多版式验证：A4 / A3 两栏 / A3 三栏 / 8K 三栏 各截一张，并收集控制台错误。
 * 用法：node scripts/verify-layouts.mjs
 */
import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:5273/';
const outDir = path.resolve('.verify');

const browser = await chromium.launch({
  executablePath: CHROME_PATH
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().includes('favicon')) errors.push(`[console] ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

async function snapshot(tag) {
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => {
    const pages = document.querySelectorAll('.sheet-preview');
    const first = pages[0];
    const rect = first ? first.getBoundingClientRect() : null;
    return {
      pageCount: pages.length,
      size: rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : null,
      titles: Array.from(document.querySelectorAll('.section-title')).map((n) => n.textContent.trim().replace(/\s+/g, ' ')),
      optionDots: document.querySelectorAll('.option-item').length,
      panes: document.querySelectorAll('.sheet-a3-col-pane').length
    };
  });
  await page.screenshot({ path: path.join(outDir, `${tag}.png`) });
  console.log(tag, JSON.stringify(info));
}

// A4
await snapshot('layout-a4');

// A3 两栏
await page.click('.panel-content .el-radio:nth-of-type(2)');
await snapshot('layout-a3-2col');

// A3 三栏
await page.locator('.a3-column-group .el-radio').nth(1).click();
await snapshot('layout-a3-3col');

// 8K
await page.locator('.config-section .el-radio-group.layout-group').first().locator('.el-radio').nth(2).click();
await snapshot('layout-8k-3col');

console.log('errors:', JSON.stringify(errors, null, 2));
await browser.close();

/**
 * 控制台静默度检查（发布前质量门禁）。
 *
 * 组件默认不应向宿主控制台输出任何内容：
 * 分页调试日志、栏高账本、填涂顶区实测值都属于排查信息，
 * 只有显式 `<answer-sheet-designer debug />` 或
 * `localStorage.setItem('answer-sheet-designer:debug', '1')` 时才允许打印。
 *
 * 用法：
 *   npm run dev                      # 另开一个终端
 *   node scripts/verify-console.mjs [url]
 *
 * 退出码 0 = 干净；1 = 有 console.log 或 error。
 */
import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';

const url = process.argv[2] || process.env.BASE_URL || 'http://localhost:5273/';

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const page = await browser.newPage();

const logs = [];
page.on('console', (msg) => logs.push({ type: msg.type(), text: msg.text() }));
page.on('pageerror', (err) => logs.push({ type: 'pageerror', text: String(err) }));

await page.goto(url, { waitUntil: 'networkidle' });
// 等分页、二维码、顶区实测都跑完
await page.waitForTimeout(2500);

const noisy = logs.filter((item) => item.type === 'log');
const errors = logs.filter((item) => item.type === 'error' || item.type === 'pageerror');
const warns = logs.filter((item) => item.type === 'warning');

console.log(`console.log   : ${noisy.length}`);
noisy.slice(0, 8).forEach((item) => console.log('   · ' + item.text.slice(0, 160)));
console.log(`console.error : ${errors.length}`);
errors.slice(0, 5).forEach((item) => console.log('   ! ' + item.text.slice(0, 240)));
console.log(`console.warn  : ${warns.length}`);
warns.slice(0, 5).forEach((item) => console.log('   ~ ' + item.text.slice(0, 160)));

await browser.close();

if (errors.length || noisy.length) {
  console.error('❌ 控制台不干净：默认配置下不应有 log / error');
  process.exit(1);
}
console.log('✅ 控制台干净（无 log / error）');

/**
 * 窄屏回归：纸张不能被裁切，且能横向滚动。
 *
 * 背景：`.preview-content` 曾用 `align-items: center` 居中 + 子层 `max-width: 100%`，
 * 在 1024 宽的笔记本上 A4（794px）比预览区宽，纸张左右各被裁掉一截，
 * 也没有横向滚动条（居中溢出到滚动起点之外，滚不到）。
 *
 * 断言（每个宽度）：
 *   1. 纸张左边缘不越出可视区左边界（不裁左）
 *   2. 纸张宽于可视区时，滚动容器必须可横向滚动
 *   3. 纸张不宽于可视区时，应居中（左右留白差 < 4px）
 *
 * 用法：node scripts/verify-narrow.mjs [baseUrl]
 */
import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';

const base = (process.argv[2] || 'http://localhost:5273').replace(/\/$/, '');
const CASES = [
  { width: 1024, height: 768, label: '1024（窄屏笔记本）' },
  { width: 1280, height: 800, label: '1280' },
  { width: 1600, height: 1000, label: '1600' }
];

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const failures = [];
let checked = 0;

for (const item of CASES) {
  const page = await browser.newPage({ viewport: { width: item.width, height: item.height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const scroller = document.querySelector('.preview-content');
    const sheet = document.querySelector('.sheet-preview');
    if (!scroller || !sheet) return null;
    const s = sheet.getBoundingClientRect();
    const c = scroller.getBoundingClientRect();
    return {
      scrollW: scroller.scrollWidth,
      clientW: scroller.clientWidth,
      sheetLeft: Math.round(s.left),
      sheetRight: Math.round(s.right),
      viewLeft: Math.round(c.left),
      viewRight: Math.round(c.right),
      sheetW: Math.round(s.width)
    };
  });

  if (!info) {
    failures.push(`${item.label}：找不到 .preview-content / .sheet-preview`);
    await page.close();
    continue;
  }

  const widerThanView = info.sheetW > info.clientW;
  const clippedLeft = info.sheetLeft < info.viewLeft - 1;
  const canScrollX = info.scrollW > info.clientW + 1;
  const gapLeft = info.sheetLeft - info.viewLeft;
  const gapRight = info.viewRight - info.sheetRight;
  const centered = Math.abs(gapLeft - gapRight) < 4;

  console.log(
    `${item.label}: 纸张 ${info.sheetW}px / 可视 ${info.clientW}px · ` +
      `左距 ${gapLeft} 右距 ${gapRight} · 可横向滚动=${canScrollX}`
  );

  checked += 1;
  if (clippedLeft) failures.push(`${item.label}：纸张左边缘被裁切（左距 ${gapLeft}px）`);
  if (widerThanView && !canScrollX) failures.push(`${item.label}：纸张宽于可视区但无法横向滚动`);
  if (!widerThanView && !centered) {
    failures.push(`${item.label}：纸张未居中（左 ${gapLeft}px / 右 ${gapRight}px）`);
  }
  if (errors.length) failures.push(`${item.label}：页面错误 ${errors.join(' | ')}`);

  await page.screenshot({ path: `.verify/narrow-${item.width}.png` });
  await page.close();
}

await browser.close();

console.log('');
if (failures.length) {
  failures.forEach((line) => console.log(`❌ ${line}`));
  process.exitCode = 1;
} else {
  console.log(`✅ 窄屏布局通过（${checked} 个视口）`);
}

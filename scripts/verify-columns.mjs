/**
 * 分栏溢出回归：A3 两栏 / A3 三栏 / 8K 三栏下，任一栏的最后一个题块都不得越过栏内容区底边。
 *
 * 背景：语文作文按行分片，账本若把「大题标题栏」记在上一栏、行都落到下一栏，
 * 渲染层按整块摆放就会比账本多出一整块高度，最后一栏被塞爆（内容画到页脚之外）。
 * 本脚本用真实几何量校验，防止该类错位复发。
 *
 * 依赖 `npm run dev`（默认 http://localhost:5273）。
 */
import { chromium } from 'playwright-core';

import { CHROME_PATH } from './chrome-path.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:5273/';

const CASES = [
  { name: 'A3-1col', layout: 'A3', cols: null },
  { name: 'A3-2col', layout: 'A3', cols: 2 },
  { name: 'A3-3col', layout: 'A3', cols: 3 },
  { name: '8K-3col', layout: '8K', cols: 3 }
];

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1700, height: 1300 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('answer-sheet-designer-demo'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2600);

/** 读取当前版式下的栏几何与内容底边 */
async function measureColumns() {
  return page.evaluate(() => {
    const vm = document.querySelector('.answer-sheet-editor').__vue__;
    const pages = vm.getPreviewPages();
    const chineseRows = pages
      .flatMap((pg) => pg.sections)
      .filter((s) => s.type === 'chinese')
      .reduce((sum, s) => sum + (s.rows ? s.rows.length : 0), 0);

    const columns = [];
    document.querySelectorAll('.sheet-preview').forEach((pg, pi) => {
      pg.querySelectorAll('.sheet-a3-col-pane').forEach((pane, ci) => {
        const pr = pane.getBoundingClientRect();
        const body = pane.querySelector('.sheet-a3-col-pane-body');
        /* 栏内容区上下留白：从 pane 与 body 的差推导，避免写死 62 */
        const pad = body ? Math.round(body.getBoundingClientRect().top - pr.top) : 0;
        const items = Array.from(pane.querySelectorAll('.question-section-item'));
        const bottoms = items.map((el) => Math.round(el.getBoundingClientRect().bottom - pr.top));
        const contentBottom = bottoms.length ? Math.max(...bottoms) : 0;
        columns.push({
          page: pi + 1,
          ci,
          paneH: Math.round(pr.height),
          pad,
          contentBottom,
          limit: Math.round(pr.height) - pad,
          sectionCount: items.length,
          overflowPx: Math.max(0, contentBottom - (Math.round(pr.height) - pad))
        });
      });
    });

    return {
      pageCount: pages.length,
      chineseRows,
      columns,
      overflow: columns.filter((c) => c.overflowPx > 2)
    };
  });
}

const out = { cases: {}, errors };

for (const item of CASES) {
  await page.locator('.layout-group .el-radio', { hasText: new RegExp(`^${item.layout}$`) }).first().click();
  await page.waitForTimeout(1300);
  if (item.cols) {
    await page.locator('.a3-column-group .el-radio', { hasText: item.cols === 2 ? '两栏' : '三栏' }).first().click();
    await page.waitForTimeout(1600);
  }
  const m = await measureColumns();
  const busiest = m.columns.reduce((a, c) => (!a || c.contentBottom > a.contentBottom ? c : a), null);
  out.cases[item.name] = {
    pageCount: m.pageCount,
    chineseRows: m.chineseRows,
    overflowCount: m.overflow.length,
    overflow: m.overflow.map((c) => ({ page: c.page, ci: c.ci, bottom: c.contentBottom, limit: c.limit, over: c.overflowPx })),
    busiestColumn: busiest
      ? { page: busiest.page, ci: busiest.ci, bottom: busiest.contentBottom, limit: busiest.limit }
      : null
  };
}

console.log(JSON.stringify(out, null, 2));

const failed = Object.entries(out.cases).some(([, v]) => v.overflowCount > 0);
await browser.close();
if (failed) {
  console.error('FAIL: 存在栏内容越界');
  process.exit(1);
}
console.log('OK: 所有版式的栏内容均在栏内');

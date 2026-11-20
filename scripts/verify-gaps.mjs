import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';
import fs from 'fs';

const ids = (process.argv[2] || 'preset-math,preset-english,preset-physics,preset-chemistry,preset-biology,preset-politics,preset-history,preset-geography,preset-quiz,preset-chinese,preset-full-types').split(',');

const b = await chromium.launch({ executablePath: CHROME_PATH });
const p = await b.newPage({ viewport: { width: 1900, height: 1300 } });
await p.goto('http://localhost:5273/', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(2400);

const report = {};

for (const id of ids) {
  await p.evaluate((i) => { document.querySelector('.answer-sheet-editor').__vue__.persistence.applyPreset(i); }, id);
  await p.waitForTimeout(2600);

  const data = await p.evaluate(() => {
    const px2mm = 96 / 25.4;
    const layout = document.querySelector('.answer-sheet-editor').__vue__.model.form.layoutType;
    const pages = [];
    document.querySelectorAll('.sheet-preview').forEach((pg, pi) => {
      const panes = Array.from(pg.querySelectorAll('.sheet-a3-col-pane'));
      const conts = panes.length ? panes : [pg.querySelector('.sheet-safe-area') || pg];
      const cols = conts.map((c, ci) => {
        const cr = c.getBoundingClientRect();
        let bottom = 0;
        const items = [];
        c.querySelectorAll('.question-section-item').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.height <= 0) return;
          const relTop = Math.round(r.top - cr.top);
          const h = Math.round(r.height);
          bottom = Math.max(bottom, relTop + h);
          const t = el.querySelector('[class*="section-title"]');
          items.push({
            top: relTop,
            h,
            title: t ? String(t.textContent).replace(/\s+/g, ' ').trim().slice(0, 18) : '(续)'
          });
        });
        return {
          col: ci,
          h: Math.round(cr.height),
          contentBottom: bottom,
          gap: Math.max(0, Math.round(cr.height) - bottom),
          items
        };
      });
      pages.push({ page: pi + 1, cols });
    });
    return { layout, pages };
  });

  report[id] = data;
  const gaps = [];
  data.pages.forEach((pg) => pg.cols.forEach((c) => gaps.push({ page: pg.page, col: c.col, gap: c.gap, h: c.h })));
  const lastPageNo = data.pages.length;
  const mid = gaps.filter((g) => g.page < lastPageNo);
  const last = gaps.filter((g) => g.page === lastPageNo);
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, x) => s + x.gap, 0) / arr.length) : 0);
  console.log(
    `${id.replace('preset-', '').padEnd(12)} ${data.layout.padEnd(3)} ${String(lastPageNo).padStart(2)}页  ` +
    `中间页空隙 均${String(avg(mid)).padStart(4)}px 最大${String(Math.max(0, ...mid.map((g) => g.gap))).padStart(4)}px (${mid.length}栏)  ` +
    `末页空隙 ${last.map((g) => g.gap).join('/')}px`
  );
  gaps.forEach((g) => {
    if (g.gap > 120 && g.page < lastPageNo) {
      const col = data.pages[g.page - 1].cols[g.col];
      const tail = col.items.slice(-2).map((x) => `${x.title}(${x.h}px)`).join(' ← ');
      console.log(`     ⚠ p${g.page}c${g.col} 空 ${g.gap}px / 容量 ${g.h}px  末尾题块: ${tail}`);
    }
  });
}

fs.writeFileSync('.verify/gap-report.json', JSON.stringify(report, null, 1));
await b.close();

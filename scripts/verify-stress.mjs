import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';
import fs from 'fs';


/** 模拟真实大考：104 题，混合五类题型 */
function buildStressBlocks() {
  return [
    {
      id: 1, type: 'objective', sectionNo: 1, sectionTitle: '单项选择题',
      count: 40, optionCount: 4, scorePerQuestion: 2,
      segments: [{ objectiveType: 'single', startNum: 1, endNum: 40, scorePerQuestion: 2, optionCount: 4 }]
    },
    {
      id: 2, type: 'objective', sectionNo: 2, sectionTitle: '多项选择题',
      count: 20, optionCount: 4, scorePerQuestion: 4,
      segments: [{ objectiveType: 'multiple', startNum: 41, endNum: 60, scorePerQuestion: 4, optionCount: 4 }]
    },
    {
      id: 3, type: 'fillblank', sectionNo: 3, sectionTitle: '填空题',
      count: 30, optionCount: 0, scorePerQuestion: 0,
      segments: [{ fillBlankType: 'short', startNum: 61, endNum: 90, scorePerQuestion: 2, lineCount: 1 }]
    },
    {
      id: 4, type: 'answer', sectionNo: 4, sectionTitle: '解答题',
      count: 12, optionCount: 0, scorePerQuestion: 0,
      segments: [{ startNum: 91, endNum: 102, scorePerQuestion: 10, areaHeight: 200 }]
    },
    {
      id: 5, type: 'english', sectionNo: 5, sectionTitle: '英语作文',
      questionNo: 103, scorePerQuestion: 25, minWordCount: 100, maxWordCount: 120
    },
    {
      id: 6, type: 'chinese', sectionNo: 6, sectionTitle: '语文作文',
      questionNo: 104, scorePerQuestion: 60, minWordCount: 800, maxWordCount: 1000
    }
  ];
}

const LAYOUTS = [
  { name: 'A4', steps: [['layout-group', /^A4$/]] },
  { name: 'A3-2col', steps: [['layout-group', /^A3$/], ['a3-column-group', '两栏']] },
  { name: 'A3-3col', steps: [['layout-group', /^A3$/], ['a3-column-group', '三栏']] },
  { name: '8K-3col', steps: [['layout-group', /^8K$/], ['a3-column-group', '三栏']] }
];

function measure() {
  return new Function(`
    const pages = Array.from(document.querySelectorAll('.sheet-preview'));
    const out = [];
    pages.forEach((pg, pi) => {
      const panes = pg.querySelectorAll('.sheet-a3-col-pane');
      const containers = panes.length ? Array.from(panes) : [pg];
      containers.forEach((c, ci) => {
        const cr = c.getBoundingClientRect();
        // 用真实渲染块测量（.question-section-item 是每个题块的根），避免嵌套层级漏测
        const blocks = Array.from(c.querySelectorAll('.question-section-item'));
        let bottom = 0;
        blocks.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.height > 0) bottom = Math.max(bottom, Math.round(r.bottom - cr.top));
        });
        out.push({
          page: pi + 1,
          col: ci,
          containerH: Math.round(cr.height),
          contentBottom: bottom,
          overflowPx: Math.max(0, bottom - Math.round(cr.height)),
          blockCount: blocks.length
        });
      });
    });
    return out;
  `)();
}

function collectQuestions() {
  return new Function(`
    const nums = [];
    document.querySelectorAll('.question-num').forEach((n) => {
      const v = Number(String(n.textContent).trim());
      if (Number.isFinite(v)) nums.push(v);
    });
    const allNums = Array.from(new Set(nums)).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 0; i < allNums.length - 1; i += 1) {
      if (allNums[i + 1] - allNums[i] !== 1) gaps.push([allNums[i], allNums[i + 1]]);
    }
    return {
      first: allNums[0],
      last: allNums[allNums.length - 1],
      rendered: allNums.length,
      gaps: gaps.slice(0, 10),
      gapCount: gaps.length
    };
  `)();
}

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

await page.goto('http://localhost:5273/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// 注入压力数据
const injected = await page.evaluate((blocks) => {
  const vm = document.querySelector('.answer-sheet-editor').__vue__;
  if (!vm) return { error: 'no vm' };
  vm.model.form.sheetName = '2026 学年第一学期期末考试-答题卡';
  vm.model.replaceQuestionBlocks(blocks);
  vm.model.syncStats();
  return { count: vm.model.questionBlocks.value.length, stats: vm.model.stats ? vm.model.stats.value : null };
}, buildStressBlocks());
await page.waitForTimeout(2600);

const result = { injected, layouts: {} };

for (const layout of LAYOUTS) {
  for (const [group, text] of layout.steps) {
    await page.locator(`.${group} .el-radio`, { hasText: text }).first().click();
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(1200);
  const cols = await page.evaluate(measure);
  const q = await page.evaluate(collectQuestions);
  const pageCount = await page.locator('.sheet-preview').count();
  result.layouts[layout.name] = {
    pageCount,
    overflowCols: cols.filter((c) => c.overflowPx > 2).map((c) => ({ page: c.page, col: c.col, over: c.overflowPx })),
    busiest: cols.reduce((a, b) => (b.contentBottom > (a?.contentBottom ?? -1) ? b : a), null),
    cols,
    questions: q
  };
  for (let i = 0; i < Math.min(pageCount, 2); i += 1) {
    try {
      await page.locator('.sheet-preview').nth(i).screenshot({
        path: `.verify/stress-${layout.name}-p${i + 1}.png`, timeout: 8000
      });
    } catch (e) { /* 元素重排时跳过截图 */ }
  }
}

result.errors = errors.slice(0, 10);
console.log(JSON.stringify(result, null, 2));
fs.writeFileSync('.verify/stress-report.json', JSON.stringify(result, null, 2));
await browser.close();

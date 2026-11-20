/**
 * 内置科目模板验证：逐个载入，检查页数、逐栏溢出、题号完整性。
 * 运行：npm run verify:presets（需先 npm run dev）
 */
import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';
import fs from 'fs';

const BASE = 'http://localhost:5273/';
/** 除模板自带版式外，额外验证的通用版式（老师常改成 A4 打印） */
const EXTRA_LAYOUTS = [{ name: 'A4', steps: [['layout-group', /^A4$/]] }];

function measure() {
  return new Function(`
    const pages = Array.from(document.querySelectorAll('.sheet-preview'));
    const out = [];
    pages.forEach((pg, pi) => {
      const panes = pg.querySelectorAll('.sheet-a3-col-pane');
      const containers = panes.length ? Array.from(panes) : [pg];
      containers.forEach((c, ci) => {
        const cr = c.getBoundingClientRect();
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
    // 客观题 / 填空题用 .question-num，解答题用 .answer-render-num；作文题号不单独渲染节点
    document.querySelectorAll('.question-num, .answer-render-num').forEach((n) => {
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
      gapCount: gaps.length,
      gaps: gaps.slice(0, 6)
    };
  `)();
}

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2400);

const presets = await page.evaluate(() => {
  const vm = document.querySelector('.answer-sheet-editor').__vue__;
  return vm.persistence.presetList.value.map((p) => ({
    id: p.id,
    name: p.name,
    layoutType: p.layoutType,
    a3ColumnCount: p.a3ColumnCount,
    layoutLabel: p.layoutLabel,
    totalScore: p.totalScore,
    questionCount: p.questionCount,
    compositionCount: p.blocks.filter((b) => b.type === 'chinese' || b.type === 'english').length,
    maxQuestionNo: p.blocks.reduce((max, b) => {
      const nums = (b.segments || []).map((s) => s.endNum);
      if (b.type === 'chinese' || b.type === 'english') nums.push(b.questionNo);
      return Math.max(max, ...nums, 0);
    }, 0)
  }));
});
if (!presets.length) {
  console.log(JSON.stringify({ error: '未取到内置模板列表' }, null, 2));
  await browser.close();
  process.exit(1);
}

const report = { count: presets.length, presets: {}, failures: [] };

for (const preset of presets) {
  const applied = await page.evaluate((id) => {
    const vm = document.querySelector('.answer-sheet-editor').__vue__;
    const ok = vm.persistence.applyPreset(id);
    return {
      ok,
      layoutType: vm.model.form.layoutType,
      a3ColumnCount: vm.model.form.a3ColumnCount,
      blocks: vm.model.questionBlocks.value.length,
      sheetName: vm.model.form.sheetName
    };
  }, preset.id);
  await page.waitForTimeout(2400);

  const cols = await page.evaluate(measure);
  const questions = await page.evaluate(collectQuestions);
  const pageCount = await page.locator('.sheet-preview').count();
  const overflowCols = cols.filter((c) => c.overflowPx > 2)
    .map((c) => ({ page: c.page, col: c.col, over: c.overflowPx }));

  report.presets[preset.id] = {
    name: preset.name,
    layout: `${preset.layoutType}-${preset.a3ColumnCount}col`,
    applied,
    pageCount,
    overflowCols,
    questions
  };
  if (!applied.ok) report.failures.push(`${preset.name}: applyPreset 返回 false`);
  if (overflowCols.length) report.failures.push(`${preset.name}: ${overflowCols.length} 栏溢出`);
  if (questions.gapCount) report.failures.push(`${preset.name}: 题号断档 ${JSON.stringify(questions.gaps)}`);
  // 作文题号不渲染独立节点，期望的最大渲染题号需扣掉作文数
  const expectedLast = preset.maxQuestionNo - preset.compositionCount;
  if (questions.first !== 1 || questions.last !== expectedLast) {
    report.failures.push(`${preset.name}: 渲染题号 ${questions.first}-${questions.last} ≠ 1-${expectedLast}`);
  }

  try {
    await page.locator('.sheet-preview').nth(0).screenshot({
      path: `.verify/preset-${preset.id}-p1.png`, timeout: 8000
    });
  } catch (e) { /* 重排中跳过 */ }
}

// 额外版式：把最后一个模板切到 A4，验证跨版式切换安全
const extra = {};
for (const layout of EXTRA_LAYOUTS) {
  const target = presets.find((p) => p.layoutType !== 'A4') || presets[0];
  await page.evaluate((id) => {
    const vm = document.querySelector('.answer-sheet-editor').__vue__;
    vm.persistence.applyPreset(id);
  }, target.id);
  await page.waitForTimeout(1800);
  for (const [group, text] of layout.steps) {
    await page.locator(`.${group} .el-radio`, { hasText: text }).first().click();
    await page.waitForTimeout(1600);
  }
  await page.waitForTimeout(1200);
  const cols = await page.evaluate(measure);
  const overflowCols = cols.filter((c) => c.overflowPx > 2)
    .map((c) => ({ page: c.page, col: c.col, over: c.overflowPx }));
  extra[`${target.name}-${layout.name}`] = {
    pageCount: await page.locator('.sheet-preview').count(),
    overflowCols,
    questions: await page.evaluate(collectQuestions)
  };
  if (overflowCols.length) {
    report.failures.push(`${target.name} 切 ${layout.name}: ${overflowCols.length} 栏溢出`);
  }
}

report.extraLayouts = extra;
report.errors = errors.slice(0, 10);
console.log(JSON.stringify(report, null, 2));
fs.writeFileSync('.verify/presets-report.json', JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.failures.length ? 1 : 0);

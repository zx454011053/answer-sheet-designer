/**
 * 题目编辑弹窗自检：五种题型的「编辑」入口必须回填标题、分段/预览行，且保存是替换而非新增。
 * 依赖 `npm run dev`（默认 http://localhost:5273）。
 */
import { chromium } from 'playwright-core';

import { CHROME_PATH } from './chrome-path.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:5273/';

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const out = { steps: {}, errors };

const dialog = () => page.locator('.el-dialog:visible').first();
const dlgTitle = async () => (await dialog().locator('.el-dialog__title').innerText()).trim();
const dlgRows = async () => dialog().locator('.el-table__body tr').count();
const blocks = () => page.evaluate(() => {
  const vm = document.querySelector('.answer-sheet-editor').__vue__;
  return vm._setupState.model.questionBlocks.value.map((b) => ({
    id: b.id,
    type: b.type,
    sectionNo: b.sectionNo,
    sectionTitle: b.sectionTitle,
    count: b.count,
    segments: (b.segments || []).length
  }));
});
const closeDialog = async () => {
  const cancel = dialog().locator('.el-dialog__footer button', { hasText: '取消' }).first();
  if (await cancel.count()) await cancel.click();
  else await dialog().locator('.el-dialog__headerbtn').first().click();
  await page.waitForTimeout(500);
};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

const initial = await blocks();
out.steps.initialBlocks = initial.length;

/* ---------- 1. 客观题：预览区「编辑」 ---------- */
const previewEdit = page.locator('.sheet-preview .block-actions button', { hasText: '编辑' }).first();
await previewEdit.click({ force: true });
await page.waitForTimeout(800);
out.steps.objectiveEdit = {
  title: await dlgTitle(),
  rows: await dlgRows(),
  inputs: await dialog().locator('input').evaluateAll((els) => els.map((e) => e.value).slice(0, 8))
};
// 改一个分值后保存，验证是替换
const scoreInput = dialog().locator('input').nth(4);
if (await scoreInput.count()) {
  await scoreInput.fill('5');
  await scoreInput.blur();
  await page.waitForTimeout(300);
}
await dialog().locator('.el-dialog__footer button', { hasText: /保存|生成|确定/ }).last().click();
await page.waitForTimeout(900);
const afterObjectiveSave = await blocks();
out.steps.objectiveSaved = {
  blockCount: afterObjectiveSave.length,
  firstBlock: afterObjectiveSave[0],
  replacedNotAdded: afterObjectiveSave.length === initial.length
};

/* ---------- 2. 填空题：面板「编辑」、分段实时联动、取消后数据不变 ---------- */
const fbRow = page.locator('.generated-block-item', { hasText: '填空题' }).first();
await fbRow.locator('button', { hasText: '编辑' }).first().click();
await page.waitForTimeout(700);
out.steps.fillBlankEdit = { title: await dlgTitle(), rows: await dlgRows() };

// 改结束题号 20 → 18，预览行应随之从 5 减到 3
const endInput = dialog().locator('.fillblank-dialog-segment .seg-input-num').nth(1).locator('input');
await endInput.fill('18');
await endInput.press('Tab');
await page.waitForTimeout(600);
const rowsAfterShrink = await dlgRows();

// 追加长填空 → 多一段、多一行
await dialog().locator('.fillblank-add-buttons button', { hasText: '长填空' }).click();
await page.waitForTimeout(600);
const afterAppend = { rows: await dlgRows(), segs: await dialog().locator('.fillblank-dialog-segment').count() };

// 删掉第一段 → 只剩长填空一段
await dialog().locator('.fillblank-dialog-segment .seg-del').first().click();
await page.waitForTimeout(600);
const afterRemove = { rows: await dlgRows(), segs: await dialog().locator('.fillblank-dialog-segment').count() };

out.steps.fillBlankLiveEdit = {
  rowsAfterShrink,
  afterAppend,
  afterRemove,
  liveUpdateOk: rowsAfterShrink === 3 && afterAppend.segs === 2 && afterRemove.segs === 1
};

await closeDialog();
out.steps.fillBlankCancel = {
  blockCount: (await blocks()).length,
  unchanged: JSON.stringify((await blocks()).find((b) => b.type === 'fillblank'))
    === JSON.stringify(initial.find((b) => b.type === 'fillblank'))
};

/* ---------- 3. 解答题：改标题后保存 ---------- */
const ansRow = page.locator('.generated-block-item', { hasText: '解答题' }).first();
await ansRow.locator('button', { hasText: '编辑' }).first().click();
await page.waitForTimeout(700);
out.steps.answerEdit = { title: await dlgTitle(), rows: await dlgRows() };
const ansTitleInput = dialog().locator('input').nth(1);
await ansTitleInput.fill('解答题-已改');
await page.waitForTimeout(300);
await dialog().locator('.el-dialog__footer button', { hasText: '保存修改' }).click();
await page.waitForTimeout(900);
const afterAnswer = await blocks();
out.steps.answerSaved = {
  blockCount: afterAnswer.length,
  title: afterAnswer.find((b) => b.type === 'answer')?.sectionTitle
};

/* ---------- 4. 英语作文：新增后编辑 ---------- */
await page.locator('.question-type-buttons button', { hasText: '英语作文' }).first().click();
await page.waitForTimeout(700);
await dialog().locator('.el-dialog__footer button', { hasText: /生成|保存/ }).last().click();
await page.waitForTimeout(900);
const withEnglish = await blocks();
out.steps.englishCreated = {
  blockCount: withEnglish.length,
  hasEnglish: withEnglish.some((b) => b.type === 'english')
};
const enRow = page.locator('.generated-block-item', { hasText: '英语作文' }).first();
await enRow.locator('button', { hasText: '编辑' }).first().click();
await page.waitForTimeout(700);
out.steps.englishEdit = {
  title: await dlgTitle(),
  rows: await dlgRows(),
  inputs: await dialog().locator('input').evaluateAll((els) => els.map((e) => e.value).slice(0, 6))
};
await closeDialog();

/* ---------- 5. 语文作文：编辑回填 ---------- */
const zhRow = page.locator('.generated-block-item', { hasText: '语文作文' }).first();
await zhRow.locator('button', { hasText: '编辑' }).first().click();
await page.waitForTimeout(700);
out.steps.chineseEdit = { title: await dlgTitle(), rows: await dlgRows() };
await closeDialog();

out.steps.finalBlockCount = (await blocks()).length;
await page.screenshot({ path: '.verify/dialogs-final.png' });
console.log(JSON.stringify(out, null, 2));
await browser.close();

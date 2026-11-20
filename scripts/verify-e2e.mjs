/**
 * 端到端冒烟：加载 → 保存 → 存模板 → 载模板 → 五类题目弹窗 → 解答题拖拽调高 → 刷新后数据仍在。
 * 用法：node scripts/verify-e2e.mjs
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
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const results = {};
const sheetPages = () => page.locator('.sheet-preview').count();

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
results.initialPages = await sheetPages();
results.initialTitles = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.section-title')).map((n) => n.textContent.trim().replace(/\s+/g, ' ')));

// 1) 保存
await page.click('button:has-text("保存")');
await page.waitForTimeout(800);

// 2) 保存为模板（弹 prompt）
await page.click('button:has-text("保存模板")');
await page.waitForTimeout(500);
await page.fill('.el-message-box__input input', '期中联考模板');
await page.click('.el-message-box__btns button:has-text("确定")');
await page.waitForTimeout(800);

// 3) 载入模板弹窗
await page.click('button:has-text("载入模板")');
await page.waitForTimeout(700);
const templateRows = await page.locator('.el-dialog:visible .el-table__body tr').count();
await page.locator('.el-dialog:visible button:has-text("载入")').first().click();
await page.waitForTimeout(1000);
results.templateRows = templateRows;
results.pagesAfterTemplate = await sheetPages();

// 4) 五类题目弹窗依次打开/关闭
const dialogCases = [
  { open: '+ 客观题', close: '取消' },
  { open: '+ 填空题', close: '取消' },
  { open: '+ 解答题', close: '取消' },
  { open: '+ 英语作文', close: '取消' },
  { open: '+ 语文作文', close: '取消' }
];
results.dialogs = [];
for (const item of dialogCases) {
  await page.click(`button:has-text("${item.open}")`);
  await page.waitForTimeout(500);
  const visible = await page.locator('.el-dialog__wrapper:visible').count();
  const title = await page.locator('.el-dialog:visible .el-dialog__title').first().textContent().catch(() => '');
  await page.locator('.el-dialog:visible .el-dialog__footer button:has-text("取消")').first().click();
  await page.waitForTimeout(400);
  results.dialogs.push({ open: item.open, visible, title: (title || '').trim() });
}

// 5) 解答题拖拽调高：找到第一块 .answer-render-item 的下沿并拖动
const answerItem = page.locator('.answer-render-item').first();
if (await answerItem.count()) {
  await answerItem.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = await answerItem.boundingBox();
  const beforeHeight = await page.evaluate(() => {
    const el = document.querySelector('.answer-render-item');
    return el ? el.getBoundingClientRect().height : 0;
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const afterHeight = await page.evaluate(() => {
    const el = document.querySelector('.answer-render-item');
    return el ? el.getBoundingClientRect().height : 0;
  });
  results.resize = { beforeHeight: Math.round(beforeHeight), afterHeight: Math.round(afterHeight) };
}

// 6) 再次保存并校验 editorJson 里 areaHeight 变化
await page.click('button:has-text("保存")');
await page.waitForTimeout(800);
results.savedAreaHeights = await page.evaluate(() => {
  const raw = window.localStorage.getItem('answer-sheet-designer-demo');
  const sheet = raw ? JSON.parse(raw).sheets['8801'] : null;
  if (!sheet || !sheet.editorJson) return null;
  const doc = JSON.parse(sheet.editorJson);
  return doc.questionBlocks
    .filter((b) => b.type === 'answer')
    .map((b) => (b.segments || []).map((s) => `${s.startNum}-${s.endNum}:${s.areaHeight}`));
});

await page.screenshot({ path: path.join(outDir, 'e2e-after.png') });

// 7) 刷新后仍在
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
results.pagesAfterReload = await sheetPages();

console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();

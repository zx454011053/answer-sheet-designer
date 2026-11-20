/**
 * 答题卡身份信息自检：标题可编辑、考试号可编辑（二维码内容同步）、二维码显示/隐藏。
 *
 * 覆盖：三种版式下的二维码开关、长标题自适应、长考试号不溢出、保存后刷新持久化。
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

const out = { cases: {}, layouts: {}, persistence: {}, longText: {}, errors };

const infoSection = () => page.locator('.config-section', { hasText: '答题卡信息' }).first();
const fieldRow = (label) => infoSection().locator('.config-field-row', { hasText: label }).first();
const titleInput = () => fieldRow('标题').locator('input').first();
const examNoInput = () => fieldRow('考试号').locator('input').first();
/** 二维码开关已并入「答题卡信息」区块，与其标题/考试号同一组 */
const qrSwitch = () => infoSection().locator('.config-field-row--switch .el-switch').first();
const qrSwitchOn = () => qrSwitch().evaluate((el) => el.classList.contains('is-checked'));

const titleText = async () => (await page.locator('.sheet-main-title').first().innerText()).trim();
const examNoText = async () => (await page.locator('.meta-row').first().innerText()).trim();
const qrSrc = async () => {
  const img = page.locator('.qrcode-image').first();
  return (await img.count()) ? img.getAttribute('src') : '';
};

async function switchLayout(layout, cols) {
  await page.locator('.layout-group .el-radio', { hasText: new RegExp(`^${layout}$`) }).first().click();
  await page.waitForTimeout(1200);
  if (cols) {
    await page.locator('.a3-column-group .el-radio', { hasText: cols === 2 ? '两栏' : '三栏' }).first().click();
    await page.waitForTimeout(1400);
  }
}

const NORMAL_TITLE = '高二年级 期中联考-答题卡';
const LONG_TITLE = '2026—2027学年第一学期高二年级期末质量检测语文数学英语综合答题卡';
const LONG_EXAM_NO = 'ABCDEFGH12345678ABCDEFGH12345678';

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

/* ---------------- 1. 标题与考试号可编辑，二维码内容随之变化 ---------------- */

const srcBefore = await qrSrc();
await titleInput().fill('2026 秋季期末统考-答题卡');
await examNoInput().fill('S2026FINAL001');
await page.waitForTimeout(900);
out.cases.edit = {
  titleBefore: NORMAL_TITLE,
  titleAfter: await titleText(),
  examNoAfter: await examNoText(),
  qrSrcChanged: (await qrSrc()) !== srcBefore,
  qrSrcLength: (await qrSrc()).length
};

/* ---------------- 2. 各版式下的二维码显示 / 隐藏 ---------------- */

for (const [layout, cols] of [['A4', null], ['A3', 2], ['A3', 3], ['8K', 3]]) {
  await switchLayout(layout, cols);
  const key = cols ? `${layout}-${cols}col` : layout;
  const onCount = await page.locator('.qrcode-box').count();
  await qrSwitch().click();
  await page.waitForTimeout(900);
  const offCount = await page.locator('.qrcode-box').count();
  await qrSwitch().click();
  await page.waitForTimeout(900);
  out.layouts[key] = {
    onCount,
    offCount,
    backCount: await page.locator('.qrcode-box').count(),
    pages: await page.locator('.sheet-preview').count()
  };
}

/* ---------------- 3. 长标题自适应 / 长考试号不溢出 ---------------- */

await switchLayout('A4');
for (const [layout, cols] of [['A4', null], ['A3', 2], ['A3', 3]]) {
  await switchLayout(layout, cols);
  const key = cols ? `${layout}-${cols}col` : layout;

  await titleInput().fill(NORMAL_TITLE);
  await page.waitForTimeout(800);
  const normal = await page.evaluate(() => {
    const el = document.querySelector('.sheet-main-title');
    const cs = getComputedStyle(el);
    return { fontSize: cs.fontSize, truncated: el.scrollWidth - el.clientWidth > 1 };
  });

  await titleInput().fill(LONG_TITLE);
  await page.waitForTimeout(1000);
  const long = await page.evaluate(() => {
    const el = document.querySelector('.sheet-main-title');
    const cs = getComputedStyle(el);
    return {
      fontSize: cs.fontSize,
      truncated: el.scrollWidth - el.clientWidth > 1,
      singleLine: Math.round(el.offsetHeight / parseFloat(cs.lineHeight || cs.fontSize)) === 1
    };
  });
  out.cases[key] = { normal, long };
}

await switchLayout('A4');
await titleInput().fill(NORMAL_TITLE);
await examNoInput().fill(LONG_EXAM_NO);
await page.waitForTimeout(900);
out.longText.examNo = await page.evaluate(() => {
  const card = document.querySelector('.header-left-card');
  const row = document.querySelector('.meta-row');
  return {
    rowOverflow: row ? row.scrollWidth - row.clientWidth : null,
    overflowBeyondCard: Math.round(card.getBoundingClientRect().right
      - document.querySelector('.exam-meta').getBoundingClientRect().right)
  };
});

/* ---------------- 4. 保存后刷新仍保留 ---------------- */

await examNoInput().fill('S2026FINAL001');
await page.waitForTimeout(400);
if (await qrSwitchOn()) await qrSwitch().click();
await page.waitForTimeout(300);
await page.locator('.panel-footer .el-button--primary', { hasText: '保存' }).click();
await page.waitForTimeout(1200);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
out.persistence = {
  title: await titleText(),
  examNo: await examNoText(),
  qrCount: await page.locator('.qrcode-box').count(),
  switchOn: await qrSwitchOn(),
  stored: await page.evaluate(() => {
    const raw = localStorage.getItem('answer-sheet-designer-demo');
    if (!raw) return null;
    const sheet = JSON.parse(raw).sheets['8801'];
    const doc = JSON.parse(sheet.editorJson);
    return {
      examNoInEditorJson: doc.examNo,
      qrcodeEnabledInEditorJson: doc.qrcodeEnabled,
      examNoInTopLevel: 'examNo' in sheet,
      sheetName: sheet.sheetName
    };
  })
};

await page.screenshot({ path: '.verify/identity.png' });
console.log(JSON.stringify(out, null, 2));
await browser.close();

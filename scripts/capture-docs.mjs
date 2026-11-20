/**
 * 生成 README 用的产品截图，输出到 docs/images/。
 * 用法：先 `npm run dev`，再 `node scripts/capture-docs.mjs [baseUrl]`
 */
import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://localhost:5273').replace(/\/$/, '');
const outDir = path.resolve('docs/images');
const tmpDir = path.resolve('.verify');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1.5
});
const page = await ctx.newPage();

const log = (name, file) => {
  const size = fs.statSync(file).size;
  console.log(`${name}  ${(size / 1024).toFixed(0)}KB`);
};

const shot = async (name, options = {}) => {
  await page.mouse.move(2, 2);
  await page.waitForTimeout(600);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, ...options });
  log(name, file);
};

const openTemplates = async () => {
  await page.locator('.panel-header-secondary', { hasText: '载入模板' }).click();
  await page.waitForTimeout(900);
};

const loadPreset = async (name) => {
  await openTemplates();
  await page.locator('.preset-card', { hasText: name }).locator('.preset-card-load').click();
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2200);
};

// ---------------------------------------------------------------- 1) 总览
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
await shot('overview');

// ------------------------------------------------- 2) 保存模板 → 模板弹窗
await page.locator('.panel-footer-btn', { hasText: '保存模板' }).click();
await page.waitForTimeout(700);
await page.locator('.el-message-box__input input').fill('数学-期中联考');
await page.locator('.el-message-box__btns .el-button--primary').click();
await page.waitForTimeout(1200);
await openTemplates();
const dialog = page.locator('.el-dialog__wrapper:visible .el-dialog').first();
const dialogFile = path.join(outDir, 'template-dialog.png');
await dialog.screenshot({ path: dialogFile });
log('template-dialog', dialogFile);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// ------------------------------------------------------- 3) A3 三栏（放宽视口）
await page.setViewportSize({ width: 2160, height: 1240 });
await loadPreset('语文');
await shot('layout-a3-3col');
await page.setViewportSize({ width: 1600, height: 1000 });

// ------------------------------------------------------- 4) 客观题横带近景
await loadPreset('综合示例');
await page.locator('.sheet-preview').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
const paperBox = await page.locator('.sheet-preview').first().boundingBox();
const titleBox = await page
  .locator('.section-title', { hasText: '单项选择题' })
  .first()
  .boundingBox();
await page.mouse.move(2, 2);
await page.waitForTimeout(600);
await page.screenshot({
  path: path.join(outDir, 'detail-objective.png'),
  clip: {
    x: paperBox.x,
    y: titleBox.y - 8,
    width: paperBox.width,
    height: 196
  }
});
log('detail-objective', path.join(outDir, 'detail-objective.png'));

// --------------------------------------------------------------- 5) 只读
await page.setViewportSize({ width: 1600, height: 1000 });
await page.goto(`${base}/readonly-demo.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2800);
await shot('readonly');

// ------------------------------------------------------- 6) 传参出图 demo
await page.goto(`${base}/plugin-content-demo.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2800);
await shot('plugin-content');

await browser.close();
console.log('done →', outDir);

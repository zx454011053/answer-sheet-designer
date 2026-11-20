/**
 * 发布前能力回归（只读模式 / 总数统计 / PDF Blob / 首屏按需加载）。
 *
 * 依赖 `npm run dev`：
 *   npm run verify:release
 *
 * 检查点：
 *   1. 只读模式下配置面板、题块操作、须知修改按钮全部不可见；
 *   2. 面板统计（题量 / 总分 / 页数）与实际题块一致；
 *   3. getPdfBlob() 返回非空 Blob，且不触发下载；
 *   4. 首屏不加载 jspdf / html2canvas（只在导出时按需加载）。
 */
import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:5273';
const URL = `${BASE}/readonly-demo.html`;

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const page = await browser.newPage();

const requests = [];
page.on('request', (req) => {
  const url = req.url();
  if (/\.(js|mjs)(\?|$)/.test(url)) requests.push(url);
});

const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed += 1;
};

/* 1. 只读：面板与编辑入口不可见 */
const panelHidden = await page.evaluate(() => {
  const panel = document.querySelector('.answer-sheet-editor .config-panel');
  if (!panel) return 'missing';
  return getComputedStyle(panel).display;
});
check('配置面板被隐藏', panelHidden === 'none', `display=${panelHidden}`);

const blockActionsVisible = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('.block-actions'));
  return nodes.filter((el) => getComputedStyle(el).display !== 'none').length;
});
check('题块「编辑/删除」按钮不可见', blockActionsVisible === 0, `可见 ${blockActionsVisible} 个`);

const noticeTriggerVisible = await page.evaluate(() => {
  const el = document.querySelector('.notice-edit-trigger');
  return el ? getComputedStyle(el).display !== 'none' : false;
});
check('须知「修改」按钮不可见', noticeTriggerVisible === false);

const readonlyClass = await page.evaluate(() => (
  document.querySelector('.answer-sheet-editor').classList.contains('answer-sheet-editor--readonly')
));
check('根节点带只读标记类', readonlyClass === true);

/* 2. 统计数字 */
const stats = await page.evaluate(() => {
  const values = Array.from(document.querySelectorAll('.panel-stat-value')).map((el) => el.textContent.trim());
  return {
    values,
    questions: window.readonlyHandle.designer.getQuestionBlocks().reduce((sum, b) => {
      if (b.type === 'objective') return sum + (b.segments || []).reduce((s, seg) => s + (seg.endNum - seg.startNum + 1), 0);
      if (b.type === 'answer' || b.type === 'fillblank') {
        return sum + (b.segments || []).reduce((s, seg) => s + ((seg.endNum || seg.startNum) - seg.startNum + 1), 0);
      }
      return sum + 1;
    }, 0)
  };
});
check('面板显示三项统计', stats.values.length === 3, stats.values.join(' / '));
check(
  '题量数字与题块一致',
  Number(stats.values[0]) === stats.questions,
  `面板 ${stats.values[0]}，实际 ${stats.questions}`
);
// 10×5 + 3×5 + 5×4 + 4×12 = 50+15+20+48 = 133
check('总分数字正确', Number(stats.values[1]) === 133, `面板 ${stats.values[1]}`);

/* 3. PDF Blob */
const blobInfo = await page.evaluate(async () => {
  try {
    const blob = await window.readonlyHandle.designer.getPdfBlob();
    if (!blob) return { ok: false, reason: '返回 null' };
    return { ok: true, size: blob.size, type: blob.type };
  } catch (error) {
    return { ok: false, reason: String(error && error.message) };
  }
});
check(
  'getPdfBlob() 返回 PDF Blob',
  blobInfo.ok && blobInfo.size > 1000 && /pdf/.test(blobInfo.type || ''),
  blobInfo.ok ? `${Math.round(blobInfo.size / 1024)}KB ${blobInfo.type}` : blobInfo.reason
);

const downloadTriggered = await page.evaluate(() => window.__pdfDownloaded === true);
check('Blob 模式未触发浏览器下载', downloadTriggered === false);

/* 4. 首屏按需加载 */
const heavy = requests.filter((u) => /jspdf|html2canvas/i.test(u));
check('首屏未加载 jspdf / html2canvas', heavy.length === 0, heavy.slice(0, 2).join(', '));

/* 5. 无运行时错误 */
check('无页面错误', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
console.log(failed === 0 ? '✅ 发布能力回归通过' : `❌ ${failed} 项未通过`);
process.exit(failed === 0 ? 0 : 1);

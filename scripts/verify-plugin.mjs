/**
 * 插件化 + 传参设置内容 的浏览器验证。
 *
 * 覆盖：
 * 1. `Vue.use(AnswerSheetDesigner)` + `<answer-sheet-designer :content="...">` 能直接出图；
 * 2. 换一份 content（A3 三栏）能整卡切换，栏数 / 页数 / 题块随之变化；
 * 3. `setQuestionBlocks()` / `setForm()` 能局部改内容；
 * 4. `AnswerSheetDesigner.mount(el, { propsData: { content } })` 这条非工程化路径同样生效；
 * 5. 全程逐栏无溢出、无控制台报错。
 *
 * 运行：npm run verify:plugin（需先 npm run build 并启动 dev server）
 */
import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';
import fs from 'fs';

const URL = 'http://localhost:5273/plugin-content-demo.html';
const report = { failures: [], steps: [] };

const check = (name, condition, detail) => {
  report.steps.push({ name, ok: !!condition, detail });
  if (!condition) report.failures.push(`${name}${detail ? ` —— ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.sheet-preview', { timeout: 20000 });
await page.waitForTimeout(1800);

/** 读取当前设计器状态 + 逐栏几何 */
async function readState() {
  return page.evaluate(() => {
    const rootEl = document.getElementById('app');
    const rootVm = rootEl && rootEl.__vue__;
    const vm = rootVm && rootVm.$refs ? rootVm.$refs.designer : null;
    const pages = Array.from(document.querySelectorAll('.designer-wrap .sheet-preview'));
    const cols = [];
    pages.forEach((pg, pi) => {
      const panes = Array.from(pg.querySelectorAll('.sheet-a3-col-pane'));
      (panes.length ? panes : [pg]).forEach((c, ci) => {
        const cr = c.getBoundingClientRect();
        let bottom = 0;
        c.querySelectorAll('.question-section-item').forEach((item) => {
          const r = item.getBoundingClientRect();
          if (r.height > 0) bottom = Math.max(bottom, r.bottom - cr.top);
        });
        cols.push({ page: pi + 1, col: ci, h: Math.round(cr.height), contentBottom: Math.round(bottom) });
      });
    });
    return {
      title: document.querySelectorAll('.designer-wrap .sheet-preview')[0]
        ? (document.querySelectorAll('.designer-wrap .sheet-preview')[0].innerText.split('\n')[0] || '')
        : '',
      form: vm ? {
        sheetName: vm.getForm().sheetName,
        examNo: vm.getForm().examNo,
        layoutType: vm.getForm().layoutType,
        a3ColumnCount: vm.getForm().a3ColumnCount,
        qrcodeEnabled: vm.getForm().qrcodeEnabled
      } : null,
      blocks: vm ? vm.getQuestionBlocks().map((b) => ({
        type: b.type,
        title: b.sectionTitle,
        nums: (b.segments || []).map((s) => [s.startNum, s.endNum]),
        questionNo: b.questionNo || null
      })) : [],
      pageCount: pages.length,
      cols
    };
  });
}

/* ---------------- 1. content prop 直接出图 ---------------- */
const first = await readState();
check('content prop 渲染出答题卡', first.pageCount > 0, `页数 ${first.pageCount}`);
check('标题来自 content.title', first.form && first.form.sheetName === '考研政治 模拟一-答题卡', JSON.stringify(first.form));
check('考试号来自 content.examNo', first.form && first.form.examNo === 'K20261118');
check('默认 A4 单栏', first.form.layoutType === 'A4');
check('三个题块', first.blocks.length === 3, JSON.stringify(first.blocks.map((b) => b.title)));
check('客观题分段保留区间', JSON.stringify(first.blocks[1].nums) === '[[17,33]]', JSON.stringify(first.blocks[1].nums));

/* ---------------- 2. 换 content 到 A3 三栏 ---------------- */
await page.click('#btn-a3');
await page.waitForTimeout(2200);
const a3 = await readState();
check('切到 A3 生效', a3.form.layoutType === 'A3');
check('三栏生效', a3.form.a3ColumnCount === 3);
check('题块换成语文结构', a3.blocks.length === 4, JSON.stringify(a3.blocks.map((b) => b.title)));
check('语文含作文格', a3.blocks.some((b) => b.type === 'chinese'));
check('三栏每页 3 个分栏', a3.cols.filter((c) => c.page === 1).length === 3, JSON.stringify(a3.cols));
check('A3 三栏无溢出', a3.cols.every((c) => c.contentBottom <= c.h + 1),
  JSON.stringify(a3.cols.filter((c) => c.contentBottom > c.h + 1)));

/* ---------------- 3. setQuestionBlocks 追加题块 ---------------- */
await page.click('#btn-append');
await page.waitForTimeout(1800);
const appended = await readState();
check('setQuestionBlocks 追加成功', appended.blocks.length === 5, JSON.stringify(appended.blocks.map((b) => b.title)));
const last = appended.blocks[appended.blocks.length - 1];
check('附加题题号接在原最大题号之后', last.title === '附加题' && last.nums[0][0] === 9, JSON.stringify(last));
check('追加后仍无溢出', appended.cols.every((c) => c.contentBottom <= c.h + 1));

/* ---------------- 4. setForm 只改标题 ---------------- */
const beforeRetitle = (await readState()).blocks.length;
await page.click('#btn-retitle');
await page.waitForTimeout(1200);
const retitled = await readState();
check('setForm 改标题生效', retitled.form.sheetName === '标题已通过 setForm 修改', retitled.form.sheetName);
check('setForm 不影响题块', retitled.blocks.length === beforeRetitle);

/* ---------------- 5. UMD mount + content ---------------- */
const mountResult = await page.evaluate(async () => {
  const host = document.createElement('div');
  host.id = 'plugin-mount-host';
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:1600px;height:1200px;';
  document.body.appendChild(host);
  const handle = window.AnswerSheetDesigner.mount(host, {
    propsData: {
      showHeader: false,
      autoLoad: true,
      content: {
        title: 'UMD 传参-答题卡',
        examNo: 'U1234567',
        layout: '8K',
        columns: 2,
        blocks: [
          { type: 'single', from: 1, to: 10, score: 3 },
          { type: 'answer', from: 11, to: 12, score: 12, height: 260 }
        ]
      }
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 1800));
  const form = handle.designer.getForm();
  const root = handle.vm.$el;
  const result = {
    sheetName: form.sheetName,
    examNo: form.examNo,
    layoutType: form.layoutType,
    a3ColumnCount: form.a3ColumnCount,
    blocks: handle.designer.getQuestionBlocks().length,
    pages: handle.designer.getPreviewPages().length,
    panes: root.querySelectorAll('.sheet-a3-col-pane').length,
    // 容器本身应保留（mount 不再替换宿主节点）
    containerAlive: !!document.querySelector('#plugin-mount-host')
  };
  handle.destroy();
  return result;
});
check('mount() 路径可用', mountResult.sheetName === 'UMD 传参-答题卡', JSON.stringify(mountResult));
check('mount() 接受 8K 两栏', mountResult.layoutType === '8K' && mountResult.a3ColumnCount === 2);
check('mount() 题块生效', mountResult.blocks === 2);
check('mount() 分栏渲染出 pane', mountResult.panes > 0, `panes=${mountResult.panes}`);
check('mount() 保留宿主容器节点', mountResult.containerAlive === true);

check('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));

await page.screenshot({ path: '.verify/plugin-content.png', fullPage: false });
fs.mkdirSync('.verify', { recursive: true });
fs.writeFileSync('.verify/plugin-report.json', JSON.stringify(report, null, 2));

await browser.close();

const passed = report.steps.filter((s) => s.ok).length;
console.log(`插件传参验证：${passed}/${report.steps.length} 项通过`);
report.steps.forEach((s) => console.log(`  ${s.ok ? '✅' : '❌'} ${s.name}${s.ok ? '' : ` —— ${s.detail}`}`));
if (report.failures.length) {
  console.error(`\n失败 ${report.failures.length} 项`);
  process.exit(1);
}

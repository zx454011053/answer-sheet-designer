/**
 * 宿主切换考试（同一个组件实例只换 :exam-id）的行为回归。
 *
 * 守护的缺陷：examId 曾经是 setup 时闭包捕获的固定值，
 * 宿主在后台列表点另一场考试时，题块仍是上一场的、form.id 也是上一场的，
 * 用户一保存就把结果写进了上一场考试（改错数据）。
 *
 * 用法：先 `npm run dev`（端口 5273），再 `npm run verify:switch`
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const PAGE_REL = '.verify-switch.html';
const PAGE_ABS = resolve(rootDir, 'public', PAGE_REL);
const BASE = process.env.BASE_URL || 'http://localhost:5273';

const page = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="data:," />
    <script src="/node_modules/vue/dist/vue.js"></script>
    <link rel="stylesheet" href="/node_modules/element-ui/lib/theme-chalk/index.css" />
    <script src="/node_modules/element-ui/lib/index.js"></script>
    <link rel="stylesheet" href="/preview/answer-sheet-designer.css" />
    <script src="/preview/answer-sheet-designer.umd.js"></script>
    <style>html, body { margin: 0; height: 100%; } #host { height: 100%; }</style>
  </head>
  <body>
    <div id="host"></div>
    <script>
      const DS = AnswerSheetDesigner.createLocalDataSource({ storageKey: 'verify-switch-exam' });
      localStorage.removeItem('verify-switch-exam');
      const Designer = AnswerSheetDesigner.default;

      const sheetA = { sheetName: '第一场', layoutType: 'A4', editorJson: JSON.stringify({
        version: 1, nextQuestionBlockId: 2,
        questionBlocks: [{ id: 1, type: 'objective', sectionNo: 1, sectionTitle: '一.单选题（25分）',
          segments: [{ objectiveType: 'single', startNum: 1, endNum: 5, scorePerQuestion: 5, optionCount: 4 }] }]
      }) };
      const sheetB = { sheetName: '第二场', layoutType: 'A4', editorJson: JSON.stringify({
        version: 1, nextQuestionBlockId: 3,
        questionBlocks: [
          { id: 1, type: 'fillblank', sectionNo: 1, sectionTitle: '一.填空题（9分）', fillBlankType: 'short', lineCount: 1,
            segments: [{ startNum: 1, endNum: 3, scorePerQuestion: 3, fillBlankType: 'short' }] },
          { id: 2, type: 'answer', sectionNo: 2, sectionTitle: '二.解答题（20分）',
            segments: [{ startNum: 4, endNum: 5, scorePerQuestion: 10 }], areaHeight: 200 }
        ]
      }) };

      window.boot = async () => {
        await DS.saveSheet({ examId: 1, payload: sheetA });
        await DS.saveSheet({ examId: 2, payload: sheetB });
        window.root = new Vue({
          data: { examId: 1, session: { name: '第一场', examNo: 'A1' } },
          render(h) {
            return h(Designer, {
              props: { examId: this.examId, session: this.session, dataSource: DS, showHeader: false }
            });
          }
        }).$mount('#host');
      };

      window.snap = () => {
        const d = window.root.$children[0];
        return {
          blocks: d.getQuestionBlocks().length,
          title: d.getForm().sheetName,
          formId: d.getForm().id,
          examSessionId: d.getForm().examSessionId
        };
      };

      window.switchTo = async (id, name) => {
        window.root.session = { name, examNo: 'B2' };
        window.root.examId = id;
        await new Promise((r) => setTimeout(r, 600));
        return window.snap();
      };
    </script>
  </body>
</html>`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

writeFileSync(PAGE_ABS, page, 'utf8');
const browser = await chromium.launch({ executablePath: CHROME_PATH, args: ['--no-sandbox'] });
try {
  const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  tab.on('pageerror', (e) => errors.push(e.message));
  tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await tab.goto(`${BASE}/${PAGE_REL}`, { waitUntil: 'networkidle' });
  await tab.evaluate(() => window.boot());
  await tab.waitForTimeout(1500);

  const first = await tab.evaluate(() => window.snap());
  check('初始加载考试 1', first.blocks === 1 && first.title === '第一场', JSON.stringify(first));

  const second = await tab.evaluate(() => window.switchTo(2, '第二场'));
  check('切到考试 2：题块被替换', second.blocks === 2, `题块 ${second.blocks}`);
  check('切到考试 2：标题更新', second.title === '第二场', second.title);
  check('切到考试 2：examSessionId 跟随', Number(second.examSessionId) === 2, String(second.examSessionId));
  check('切到考试 2：form.id 不沿用上一场', String(second.formId) !== String(first.formId), `${first.formId} → ${second.formId}`);

  const back = await tab.evaluate(() => window.switchTo(1, '第一场'));
  check('切回考试 1：题块恢复', back.blocks === 1 && back.title === '第一场', JSON.stringify(back));

  check('无页面错误', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  try { unlinkSync(PAGE_ABS); } catch (e) { /* 忽略 */ }
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n❌ 切换考试回归未通过（${failed.length}/${results.length}）`);
  process.exit(1);
}
console.log(`\n✅ 切换考试回归通过（${results.length} 项）`);

/**
 * 全部内置模板的打印一致性验证：PDF 实际页数必须等于预览页数。
 * 打印是答题卡最终用途，任何一页被吞掉都会导致整场考试作废。
 * 运行：node scripts/verify-presets-print.mjs（需先 npm run dev）
 */
import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';
import fs from 'fs';

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
await page.goto('http://localhost:5273/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2800);

const list = await page.evaluate(() => {
  const vm = document.querySelector('.answer-sheet-editor').__vue__;
  return vm.persistence.presetList.value.map((p) => ({ id: p.id, name: p.name, layout: p.layoutType }));
});

const pdfPageCount = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const out = { results: {}, failures: [] };
for (const preset of list) {
  await page.evaluate((id) => {
    document.querySelector('.answer-sheet-editor').__vue__.persistence.applyPreset(id);
  }, preset.id);
  await page.waitForTimeout(2400);

  const sheets = await page.locator('.sheet-preview').count();
  const rule = await page.evaluate(() => {
    const el = document.getElementById('answer-sheet-print-page-size');
    return el ? el.textContent.trim() : null;
  });
  const pdf = await page.pdf({
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 }
  });
  const pdfPages = pdfPageCount(pdf);
  fs.writeFileSync(`.verify/print-${preset.id}.pdf`, pdf);

  out.results[preset.id] = { name: preset.name, layout: preset.layout, sheets, pdfPages, rule };
  if (sheets !== pdfPages) {
    out.failures.push(`${preset.name}：预览 ${sheets} 页，打印 ${pdfPages} 页`);
  }
  console.log(`${preset.name.padEnd(5, ' ')} ${preset.layout.padEnd(3)} 预览${sheets}页 打印${pdfPages}页 ${rule}`);
}

console.log('\n失败:', out.failures.length ? out.failures : '无');
fs.writeFileSync('.verify/presets-print.json', JSON.stringify(out, null, 2));
await browser.close();
process.exit(out.failures.length ? 1 : 0);

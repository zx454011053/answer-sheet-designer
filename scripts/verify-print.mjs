import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';
import fs from 'fs';

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
await page.goto('http://localhost:5273/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2800);

const readPageRule = () => page.evaluate(() => {
  const el = document.getElementById('answer-sheet-print-page-size');
  return el ? el.textContent : null;
});

const sheetCount = () => page.locator('.sheet-preview').count();

const out = {};
out.a4 = { rule: await readPageRule(), sheets: await sheetCount() };
const pdfA4 = await page.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
fs.writeFileSync('.verify/print-a4.pdf', pdfA4);
out.a4.pdfPages = (pdfA4.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
out.a4.pdfKb = Math.round(pdfA4.length / 1024);

await page.locator('.layout-group .el-radio', { hasText: /^A3$/ }).first().click();
await page.waitForTimeout(1800);
out.a3 = { rule: await readPageRule(), sheets: await sheetCount() };
const pdfA3 = await page.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
fs.writeFileSync('.verify/print-a3.pdf', pdfA3);
out.a3.pdfPages = (pdfA3.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
out.a3.pdfKb = Math.round(pdfA3.length / 1024);

console.log(JSON.stringify(out, null, 2));
await browser.close();

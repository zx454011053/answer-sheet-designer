/**
 * 内置模板深度审计：不只查「有没有溢出」，而是逐项体检答题卡的排版质量。
 *
 * 检查维度：
 *  1. 页数 / 逐栏溢出
 *  2. 纸张利用率（栏内内容底 / 栏高），过低说明分页保守、浪费纸
 *  3. 题号：重复、缺口、是否单调递增
 *  4. 题块：标题是否孤立落在页/栏底部（有标题无内容）
 *  5. 填涂框实际尺寸（mm，96dpi），对照印刷惯例 6.1 × 2.6mm
 *  6. 作答区：配置高度 vs 实际渲染高度，是否被压缩
 *  7. 页码、二维码是否存在
 *  8. 空白页
 *
 * 运行：node scripts/audit-presets.mjs（需先 npm run dev）
 */
import { chromium } from 'playwright-core';
import { CHROME_PATH } from './chrome-path.mjs';
import fs from 'fs';

const BASE = 'http://localhost:5273/';
const PX_PER_MM = 96 / 25.4;

const browser = await chromium.launch({ executablePath: CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1900, height: 1300 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 180)}`);
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2400);

const presetList = await page.evaluate(() => {
  const vm = document.querySelector('.answer-sheet-editor').__vue__;
  return vm.persistence.presetList.value.map((p) => ({
    id: p.id,
    name: p.name,
    layoutType: p.layoutType,
    a3ColumnCount: p.a3ColumnCount,
    totalScore: p.totalScore,
    questionCount: p.questionCount,
    blockCount: p.blockCount
  }));
});

const report = { generatedAt: new Date().toISOString(), presets: {}, issues: [] };

function auditDom() {
  const pages = Array.from(document.querySelectorAll('.sheet-preview'));
  const px2mm = 96 / 25.4;

  // ---- 题号序列 ----
  const numEls = Array.from(document.querySelectorAll('.question-num, .answer-render-num'));
  const seq = numEls
    .map((el) => Number(String(el.textContent).trim()))
    .filter((n) => Number.isFinite(n));
  const ordered = seq; // 保持 DOM 顺序（横带内是列优先，题号本就递增）
  const duplicates = [];
  const seen = new Set();
  ordered.forEach((n) => {
    if (seen.has(n)) duplicates.push(n);
    seen.add(n);
  });
  // 题号回退只在「同一个题块内」才算异常；跨题块跳跃是真实卷面结构（如语文选择题集中填涂）
  const descents = [];
  Array.from(document.querySelectorAll('.question-section-item')).forEach((el) => {
    const nums = Array.from(el.querySelectorAll('.question-num, .answer-render-num'))
      .map((n) => Number(String(n.textContent).trim()))
      .filter((n) => Number.isFinite(n));
    for (let i = 1; i < nums.length; i += 1) {
      if (nums[i] < nums[i - 1]) descents.push([nums[i - 1], nums[i]]);
    }
  });
  const uniq = Array.from(new Set(ordered)).sort((a, b) => a - b);
  const missing = [];
  for (let i = 0; i < uniq.length - 1; i += 1) {
    for (let n = uniq[i] + 1; n < uniq[i + 1]; n += 1) missing.push(n);
  }

  // ---- 页 / 栏 结构 ----
  const columns = [];
  const blankPages = [];
  const orphanTitles = [];
  pages.forEach((pg, pi) => {
    const panes = Array.from(pg.querySelectorAll('.sheet-a3-col-pane'));
    const containers = panes.length ? panes : [pg];
    let pageContentH = 0;
    containers.forEach((c, ci) => {
      const cr = c.getBoundingClientRect();
      const items = Array.from(c.querySelectorAll('.question-section-item'));
      let bottom = 0;
      items.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height > 0) bottom = Math.max(bottom, Math.round(r.bottom - cr.top));
      });
      pageContentH = Math.max(pageContentH, bottom);
      columns.push({
        page: pi + 1,
        col: ci,
        containerH: Math.round(cr.height),
        contentBottom: bottom,
        overflowPx: Math.max(0, bottom - Math.round(cr.height)),
        usedRatio: cr.height ? Math.round((bottom / cr.height) * 1000) / 10 : 0,
        blocks: items.length
      });

      // 孤立标题：栏内最后一个题块只有标题、无实质内容
      const last = items[items.length - 1];
      if (last) {
        const lr = last.getBoundingClientRect();
        const titleEl = last.querySelector('.answer-sheet-section-title, .section-title, [class*="section-title"]');
        const bodyEl = last.querySelector(
          '.question-block, .objective-bands, .answer-render, .chinese-render, .english-render, .fillblank-render'
        );
        const br = bodyEl && bodyEl.getBoundingClientRect();
        if (lr.height > 0 && titleEl && br && br.height < 8) {
          orphanTitles.push({
            page: pi + 1,
            col: ci,
            title: String(titleEl.textContent).trim().slice(0, 24),
            titleH: Math.round(lr.height),
            belowPx: Math.round(cr.height - (lr.top - cr.top) - lr.height)
          });
        }
      }
    });
    if (pageContentH < 60) blankPages.push(pi + 1);
  });

  // ---- 填涂框尺寸 ----
  const optEls = Array.from(document.querySelectorAll('.option-item')).slice(0, 40);
  const optSizes = optEls.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      w: Math.round((r.width / px2mm) * 10) / 10,
      h: Math.round((r.height / px2mm) * 10) / 10
    };
  });
  const uniqueOpt = Array.from(new Set(optSizes.map((s) => `${s.w}x${s.h}mm`)));

  // ---- 客观题横带布局 ----
  const bands = Array.from(document.querySelectorAll('.choice-band')).map((b) => {
    const cols = b.querySelectorAll('.choice-column').length;
    const rows = b.querySelectorAll('.question-row').length;
    const br = b.getBoundingClientRect();
    const opts = Array.from(b.querySelectorAll('.option-item'));
    let right = 0;
    opts.forEach((o) => {
      const r = o.getBoundingClientRect();
      right = Math.max(right, r.right);
    });
    const colSizes = Array.from(b.querySelectorAll('.choice-column')).map(
      (c) => c.querySelectorAll('.question-row').length
    );
    return {
      cols,
      rows,
      wMm: Math.round((br.width / px2mm) * 10) / 10,
      fillMm: Math.round((right - br.left) / px2mm),
      rightGapMm: Math.round((br.right - right) / px2mm),
      colSizes
    };
  });

  // ---- 作答区：配置 vs 实际 ----
  const answerItems = Array.from(document.querySelectorAll('.answer-render-item')).map((el) => ({
    num: String((el.querySelector('.answer-render-num') || {}).textContent || '').trim(),
    h: Math.round(el.getBoundingClientRect().height)
  }));

  // ---- 页码 / 二维码 ----
  const pageNumberEls = Array.from(document.querySelectorAll('.sheet-page-number')).map((el) =>
    String(el.textContent).trim()
  );
  const qrEls = Array.from(document.querySelectorAll('[class*="qr"]')).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 20 && r.height > 20;
  });
  const qrBox = qrEls[0] && qrEls[0].getBoundingClientRect();

  return {
    pageCount: pages.length,
    columns,
    blankPages,
    orphanTitles,
    questionNumbers: {
      rendered: ordered.length,
      unique: uniq.length,
      first: uniq[0],
      last: uniq[uniq.length - 1],
      duplicates: Array.from(new Set(duplicates)),
      missing: missing.slice(0, 20),
      missingCount: missing.length,
      descents
    },
    optionBox: { sizes: uniqueOpt, samples: optEls.length },
    bands,
    answerItems,
    pageNumbers: pageNumberEls,
    qr: { found: qrEls.length > 0, mm: qrBox ? [Math.round((qrBox.width / px2mm) * 10) / 10, Math.round((qrBox.height / px2mm) * 10) / 10] : null }
  };
}

for (const preset of presetList) {
  const meta = await page.evaluate((id) => {
    const vm = document.querySelector('.answer-sheet-editor').__vue__;
    const p = vm.persistence.presetList.value.find((x) => x.id === id);
    return p
      ? {
          configured: p.blocks.map((b) => ({
            title: b.sectionTitle,
            type: b.type,
            segments: (b.segments || []).map((s) => `${s.startNum}-${s.endNum}:${s.scorePerQuestion}分`),
            area: (b.segments || []).map((s) => s.areaHeight).filter(Boolean),
            lineCount: b.lineCount,
            words: b.maxWordCount
          }))
        }
      : null;
  }, preset.id);

  const applied = await page.evaluate((id) => {
    const vm = document.querySelector('.answer-sheet-editor').__vue__;
    const ok = vm.persistence.applyPreset(id);
    return { ok, layout: `${vm.model.form.layoutType}-${vm.model.form.a3ColumnCount}col`, name: vm.model.form.sheetName };
  }, preset.id);
  await page.waitForTimeout(2600);

  const dom = await page.evaluate(auditDom);
  report.presets[preset.id] = { ...preset, applied, configured: meta && meta.configured, ...dom };

  // ---- 归纳问题 ----
  const tag = preset.name;
  const over = dom.columns.filter((c) => c.overflowPx > 2);
  if (over.length) {
    report.issues.push(`${tag}：${over.length} 个分栏内容溢出纸张（最大 ${Math.max(...over.map((c) => c.overflowPx))}px）`);
  }
  if (dom.blankPages.length) report.issues.push(`${tag}：存在空白页 第 ${dom.blankPages.join(',')} 页`);
  if (dom.questionNumbers.duplicates.length) {
    report.issues.push(`${tag}：题号重复 ${dom.questionNumbers.duplicates.slice(0, 8).join(',')}`);
  }
  if (dom.questionNumbers.missingCount) {
    report.issues.push(`${tag}：题号缺失 ${dom.questionNumbers.missingCount} 个（${dom.questionNumbers.missing.slice(0, 8).join(',')}…）`);
  }
  if (dom.questionNumbers.descents.length) {
    report.issues.push(
      `${tag}：题号顺序回退 ${dom.questionNumbers.descents.length} 处（${dom.questionNumbers.descents
        .slice(0, 3)
        .map((d) => d.join('→'))
        .join('，')}）`
    );
  }
  if (dom.orphanTitles.length) {
    report.issues.push(
      `${tag}：${dom.orphanTitles.length} 处大题标题落在页底但正文另起（${dom.orphanTitles
        .map((o) => `${o.title}@p${o.page}c${o.col}`)
        .join('，')}）`
    );
  }
  const lowUsed = dom.columns.filter((c) => c.usedRatio < 70 && c.blocks > 0);
  if (lowUsed.length) {
    report.issues.push(
      `${tag}：${lowUsed.length} 栏利用率 <70%（${lowUsed
        .map((c) => `p${c.page}c${c.col}:${c.usedRatio}%`)
        .join('，')}）`
    );
  }
  // 客观题横带：列内题数极差 > 1 说明分配不均（如 5/5/5/1）
  dom.bands.forEach((b, bi) => {
    const sizes = b.colSizes.filter((s) => s > 0);
    if (sizes.length > 1 && Math.max(...sizes) - Math.min(...sizes) > 1) {
      report.issues.push(`${tag}：第 ${bi + 1} 条横带列内题数不均 (${b.colSizes.join('/')})`);
    }
    if (b.rightGapMm > 25) {
      report.issues.push(`${tag}：第 ${bi + 1} 条横带右侧留白 ${b.rightGapMm}mm`);
    }
  });
  const bigGap = dom.columns.filter((c) => c.usedRatio < 85 && c.overflowPx === 0 && c.blocks > 0);
  if (bigGap.length) {
    report.presets[preset.id].tailGapCols = bigGap.map((c) => ({
      page: c.page,
      col: c.col,
      gapPx: c.containerH - c.contentBottom,
      usedRatio: c.usedRatio
    }));
  }

  try {
    await page.locator('.sheet-preview').nth(0).screenshot({
      path: `.verify/audit-${preset.id}-p1.png`,
      timeout: 9000
    });
  } catch (e) {
    /* 重排瞬间可能失败，忽略 */
  }
}

report.errors = errors.slice(0, 12);
fs.writeFileSync('.verify/presets-audit.json', JSON.stringify(report, null, 2));

// ---- 控制台摘要 ----
console.log('模板数', presetList.length);
for (const p of presetList) {
  const r = report.presets[p.id];
  const q = r.questionNumbers;
  const maxOver = Math.max(0, ...r.columns.map((c) => c.overflowPx));
  const minUsed = Math.min(...r.columns.filter((c) => c.blocks > 0).map((c) => c.usedRatio), 100);
  console.log(
    [
      p.name.padEnd(5, ' '),
      (r.applied.layout || '').padEnd(9, ' '),
      `${r.pageCount}页`,
      `题号 ${q.first}-${q.last}`,
      `重复${q.duplicates.length}`,
      `缺${q.missingCount}`,
      `回退${q.descents.length}`,
      `溢出${maxOver}px`,
      `最低利用${minUsed}%`,
      `孤立标题${r.orphanTitles.length}`
    ].join('  ')
  );
}
console.log('\n=== 问题清单 ===');
report.issues.forEach((s, i) => console.log(`${i + 1}. ${s}`));
if (errors.length) {
  console.log('\n=== 控制台错误 ===');
  errors.slice(0, 5).forEach((e) => console.log(' ', e));
}
await browser.close();
process.exit(report.issues.length ? 1 : 0);

/**
 * core 纯逻辑自检（无浏览器、无 Vue）。
 * 运行：npm run test:core
 */
import assert from 'node:assert/strict';
import {
  computeSheetStats,
  countFillBlankQuestions,
  getGlobalMaxQuestionNum,
  normalizeObjectiveSegment
} from '../src/core/questionModel.js';
import { buildObjectiveBands, buildObjectiveQuestions, buildObjectiveRenderBlock } from '../src/core/objectiveLayout.js';
import { withAnswerAreaHeight } from '../src/core/answerArea.js';
import { applyEditorDocument, createEditorDocument, parseEditorDocument, buildSheetPayload } from '../src/core/document.js';
import { createDefaultSheetForm } from '../src/core/defaults.js';
import { getChineseA3ChunkRowLedgerDeltaPx } from '../src/core/pagination/chinesePagination.js';
import { CHINESE_COMPOSITION_ROW_HEIGHT_PX, SECTION_BLOCK_VERTICAL_GAP_PX } from '../src/core/constants.js';
import { createPresetSnapshot, getPresetTemplate, listPresetTemplates } from '../src/core/presetTemplates.js';
import {
  absorbContainerGap,
  computeContainerUsedPx,
  GAP_ABSORB_MAX_PX
} from '../src/core/absorbColumnGaps.js';
import {
  createSheetData,
  validateQuestionNumbering,
  withBlocks,
  normalizeBlockType
} from '../src/core/sheetBuilder.js';

const cases = [];
const test = (name, fn) => {
  fn();
  cases.push(name);
};

const objectiveBlock = (type, start, end, score, options) => ({
  id: 1,
  type: 'objective',
  sectionNo: 1,
  sectionTitle: '单选题',
  count: end - start + 1,
  optionCount: options,
  scorePerQuestion: score,
  segments: [{ objectiveType: type, startNum: start, endNum: end, scorePerQuestion: score, optionCount: options }]
});

test('填空小题数：短填按 小题×空数 计', () => {
  const block = {
    type: 'fillblank',
    segments: [{ fillBlankType: 'short', startNum: 16, endNum: 20, scorePerQuestion: 4, lineCount: 2 }]
  };
  assert.equal(countFillBlankQuestions(block), 10);
});

test('题量统计：删除题块后可回落', () => {
  const blocks = [
    objectiveBlock('single', 1, 10, 3, 4),
    { type: 'fillblank', segments: [{ fillBlankType: 'short', startNum: 11, endNum: 15, scorePerQuestion: 2, lineCount: 1 }] },
    { type: 'answer', segments: [{ startNum: 16, endNum: 18, scorePerQuestion: 10, areaHeight: 180 }] },
    { type: 'chinese', questionNo: 19, scorePerQuestion: 60, minWordCount: 800, maxWordCount: 1000 }
  ];
  const stats = computeSheetStats(blocks);
  assert.deepEqual(
    { c: stats.choiceCount, f: stats.fillBlankCount, a: stats.answerCount, ch: stats.chineseCount, sub: stats.subjectiveCount, q: stats.questionCount },
    { c: 10, f: 5, a: 3, ch: 1, sub: 4, q: 19 }
  );
  const afterRemove = computeSheetStats(blocks.slice(0, 1));
  assert.equal(afterRemove.questionCount, 10, '题量应随题块删除而减少');
});

test('全卷最大题号', () => {
  const blocks = [objectiveBlock('single', 1, 10, 3, 4), { type: 'chinese', questionNo: 24 }];
  assert.equal(getGlobalMaxQuestionNum(blocks), 24);
});

test('客观题展开：按分段生成题号与选项', () => {
  const segments = [
    normalizeObjectiveSegment({ objectiveType: 'single', startNum: 1, endNum: 2, scorePerQuestion: 3, optionCount: 4 }),
    normalizeObjectiveSegment({ objectiveType: 'judge', startNum: 3, endNum: 3, scorePerQuestion: 2 })
  ];
  const questions = buildObjectiveQuestions(segments, 'objective', 1, 3, 4, 1);
  assert.equal(questions.length, 3);
  assert.deepEqual(questions[0].optionLabels, ['A', 'B', 'C', 'D']);
  assert.deepEqual(questions[2].optionLabels, ['对', '错']);
});

test('A4 横带：窄题 4 列，题量不足整列时按列均分', () => {
  const questions = buildObjectiveQuestions([], 'single', 1, 10, 4, 3);
  const bands = buildObjectiveBands(questions, 'single', { layoutType: 'A4' });
  assert.equal(bands.length, 1);
  assert.equal(bands[0].colsPerBand, 4);
  // 10 题 4 列 -> 3/3/2/2（旧实现是 5/5/0/0，右侧两列全空）
  assert.deepEqual(bands[0].columns.map((c) => c.length), [3, 3, 2, 2]);
  const nums = bands[0].columns.flat().map((q) => q.num);
  assert.deepEqual(nums, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('A4 横带：16 题 4 列均分 4/4/4/4（旧实现 5/5/5/1）', () => {
  const questions = buildObjectiveQuestions([], 'single', 1, 16, 4, 3);
  const bands = buildObjectiveBands(questions, 'single', { layoutType: 'A4' });
  assert.equal(bands.length, 1);
  assert.deepEqual(bands[0].columns.map((c) => c.length), [4, 4, 4, 4]);
});

test('A4 横带：题量少于列数时收缩列数（一题一列）', () => {
  const four = buildObjectiveBands(buildObjectiveQuestions([], 'single', 1, 4, 4, 3), 'single', { layoutType: 'A4' });
  assert.equal(four[0].colsPerBand, 4);
  assert.deepEqual(four[0].columns.map((c) => c.length), [1, 1, 1, 1]);

  const five = buildObjectiveBands(buildObjectiveQuestions([], 'single', 1, 5, 4, 3), 'single', { layoutType: 'A4' });
  assert.deepEqual(five[0].columns.map((c) => c.length), [2, 1, 1, 1]);

  const three = buildObjectiveBands(buildObjectiveQuestions([], 'single', 1, 3, 4, 3), 'single', { layoutType: 'A4' });
  assert.equal(three[0].colsPerBand, 3);
});

test('A4 横带：选项 >4 的宽题降为 3 列', () => {
  const questions = buildObjectiveQuestions([], 'multiple', 1, 5, 5, 4);
  const bands = buildObjectiveBands(questions, 'multiple', { layoutType: 'A4' });
  assert.equal(bands[0].colsPerBand, 3);
});

test('A3 三栏：窄题 3 列', () => {
  const questions = buildObjectiveQuestions([], 'single', 1, 12, 4, 3);
  const bands = buildObjectiveBands(questions, 'single', { layoutType: 'A3', columnCount: 3 });
  assert.equal(bands[0].colsPerBand, 3);
});

test('客观题渲染块：题号连续累加', () => {
  const block = buildObjectiveRenderBlock(objectiveBlock('single', 1, 10, 3, 4), { startNum: 1, layoutType: 'A4', columnCount: 2 });
  assert.equal(block.__questionCount, 10);
  assert.equal(block.totalScore, 30);
  assert.equal(block.numbers[9], 10);
});

test('解答题调高：目标题号被拆成独立分段', () => {
  const block = { id: 9, type: 'answer', sectionNo: 1, segments: [{ startNum: 21, endNum: 23, scorePerQuestion: 12, areaHeight: 180 }] };
  const next = withAnswerAreaHeight(block, 21, 246, { min: 80, max: 2000 });
  assert.deepEqual(next.segments.map((s) => `${s.startNum}-${s.endNum}:${s.areaHeight}`), ['21-21:246', '22-23:180']);
  // 已是单题分段且高度相同 → 无变化
  const single = withAnswerAreaHeight(next, 21, 246, { min: 80, max: 2000 });
  assert.equal(single, null, '单题分段同高时应返回 null');
  // 超出上限时按上限截断
  const clamped = withAnswerAreaHeight(block, 22, 99999, { min: 80, max: 300 });
  assert.equal(clamped.segments.find((s) => s.startNum === 22).areaHeight, 300);
});

test('editorJson 序列化 / 反序列化', () => {
  const form = createDefaultSheetForm({ sheetName: '单元测试', layoutType: 'A3', a3ColumnCount: 3 });
  const json = createEditorDocument({
    questionBlocks: [objectiveBlock('single', 1, 5, 2, 4)],
    nextQuestionBlockId: 2,
    form
  });
  const doc = parseEditorDocument(json);
  assert.equal(doc.version, 1);
  assert.equal(doc.questionBlocks.length, 1);
  const applied = applyEditorDocument(doc, createDefaultSheetForm(), 1);
  assert.equal(applied.nextQuestionBlockId, 2);
  assert.equal(parseEditorDocument('{坏 JSON'), null);
});

test('保存报文：统计字段由题块汇总', () => {
  const form = createDefaultSheetForm({ sheetName: 'X' });
  const payload = buildSheetPayload(form, [objectiveBlock('single', 1, 10, 3, 4)], { nextQuestionBlockId: 2 });
  assert.equal(payload.questionCount, 10);
  assert.equal(payload.choiceCount, 10);
  assert.equal(payload.subjectiveCount, 0);
  assert.ok(payload.editorJson.includes('questionBlocks'));
});

test('语文三栏：fragment 行账本与整块公式逐像素一致', () => {
  const row = CHINESE_COMPOSITION_ROW_HEIGHT_PX;
  const gap = SECTION_BLOCK_VERTICAL_GAP_PX;
  /* 首块首行 = 行高 + 页末附加 8（fragment 整块高 = 标题栏 + 行数×行高 + 8） */
  assert.equal(getChineseA3ChunkRowLedgerDeltaPx({
    isChunkFirstRow: true, chunkIsContinuation: false, columnUsedPx: 0
  }), row + 8);
  /* 续接 fragment 落在已有内容的栏：再补一个题块间距 */
  assert.equal(getChineseA3ChunkRowLedgerDeltaPx({
    isChunkFirstRow: true, chunkIsContinuation: true, columnUsedPx: 120
  }), row + 8 + gap);
  /* 续接 fragment 落在空栏（换页首栏）：不加间距 */
  assert.equal(getChineseA3ChunkRowLedgerDeltaPx({
    isChunkFirstRow: true, chunkIsContinuation: true, columnUsedPx: 0
  }), row + 8);
  /* 同一 fragment 的后续行只记基础行高 */
  assert.equal(getChineseA3ChunkRowLedgerDeltaPx({
    isChunkFirstRow: false, chunkIsContinuation: true, columnUsedPx: 120
  }), row);
});

/* ---------------- 内置科目模板 ---------------- */

/** 展开模板覆盖的全部题号（作文按 questionNo 计） */
function collectPresetQuestionNums(blocks) {
  const nums = [];
  (blocks || []).forEach((block) => {
    if (block.type === 'objective' || block.type === 'fillblank' || block.type === 'answer') {
      (block.segments || []).forEach((seg) => {
        for (let n = seg.startNum; n <= seg.endNum; n += 1) nums.push(n);
      });
      return;
    }
    if (block.type === 'english' || block.type === 'chinese') nums.push(block.questionNo);
  });
  return nums.sort((a, b) => a - b);
}

test('内置模板：id 唯一且数量稳定', () => {
  const presets = listPresetTemplates();
  assert.ok(presets.length >= 10, `模板数量偏少：${presets.length}`);
  const ids = presets.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, '存在重复模板 id');
  presets.forEach((item) => {
    assert.ok(item.name && item.blocks.length > 0, `模板 ${item.id} 缺少名称或题块`);
    assert.ok(['A4', 'A3', '8K'].includes(item.layoutType), `模板 ${item.id} 版式非法`);
  });
});

test('内置模板：题号从 1 开始连续且不重复', () => {
  listPresetTemplates().forEach((preset) => {
    const nums = collectPresetQuestionNums(preset.blocks);
    assert.ok(nums.length > 0, `模板 ${preset.name} 没有题目`);
    const dup = nums.filter((n, i) => i > 0 && nums[i - 1] === n);
    assert.equal(dup.length, 0, `模板 ${preset.name} 题号重复：${dup.slice(0, 5).join(',')}`);
    assert.equal(nums[0], 1, `模板 ${preset.name} 题号未从 1 开始（实际 ${nums[0]}）`);
    nums.forEach((n, i) => {
      assert.equal(n, i + 1, `模板 ${preset.name} 题号不连续：第 ${i + 1} 个为 ${n}`);
    });
  });
});

test('内置模板：总分与题量为正，且统计口径可用', () => {
  listPresetTemplates().forEach((preset) => {
    assert.ok(preset.totalScore > 0, `模板 ${preset.name} 总分异常`);
    assert.ok(preset.questionCount > 0, `模板 ${preset.name} 题量异常`);
    assert.equal(preset.questionCount, collectPresetQuestionNums(preset.blocks).length,
      `模板 ${preset.name} 题量与题号覆盖数不一致`);
  });
});

test('内置模板：快照为深拷贝，可安全交给设计器', () => {
  const snapshot = createPresetSnapshot('preset-math');
  assert.ok(snapshot);
  const preset = getPresetTemplate('preset-math');
  snapshot.blocks[0].sectionTitle = '被修改';
  assert.notEqual(preset.blocks[0].sectionTitle, '被修改');
  assert.equal(snapshot.nextQuestionBlockId, snapshot.blocks.length + 1);
  assert.equal(getPresetTemplate('math').id, 'preset-math');
});

test('内置模板：语文默认 A3 三栏且含作文', () => {
  const chinese = getPresetTemplate('preset-chinese');
  assert.equal(chinese.layoutType, 'A3');
  assert.equal(chinese.a3ColumnCount, 3);
  const composition = chinese.blocks.find((block) => block.type === 'chinese');
  assert.ok(composition && composition.maxWordCount >= 800);
});

/** 构造一个只有解答题的题块，便于验证回填 */
function makeAnswerSection(items, opts = {}) {
  return {
    id: opts.id || 1,
    type: 'answer',
    isContinuation: opts.isContinuation === true,
    items: items.map((h, i) => ({ num: i + 1, areaHeight: h, scorePerQuestion: 10 }))
  };
}

test('回填：空隙足够时把最后一个作答区拉大，且只动这一处', () => {
  const section = makeAnswerSection([200]);
  const used = computeContainerUsedPx([section]);
  assert.equal(used, 40 + 200, '单块应为标题栏 + 作答区');
  const { sections, absorbedPx } = absorbContainerGap([section], used + 120, { safetyPx: 0 });
  assert.equal(sections.length, 1);
  assert.equal(sections[0].items[0].areaHeight, 320);
  assert.equal(absorbedPx, 120);
});

test('回填：默认保留安全余量，实际吸收量小于账面空隙', () => {
  const section = makeAnswerSection([200]);
  const used = computeContainerUsedPx([section]);
  const { sections, absorbedPx } = absorbContainerGap([section], used + 120);
  assert.ok(absorbedPx < 120, `应留有余量，实际吸收 ${absorbedPx}`);
  assert.equal(sections[0].items[0].areaHeight, used + 120 - 40 - (120 - absorbedPx));
});

test('回填：同题块多个作答区按均摊，不再让最后一个独大', () => {
  const section = makeAnswerSection([240, 240]);
  const used = computeContainerUsedPx([section]);
  const { sections } = absorbContainerGap([section], used + 180, { safetyPx: 0 });
  const [a, b] = sections[0].items.map((it) => it.areaHeight);
  assert.ok(Math.abs(a - b) <= 1, `两个作答区应接近，实际 ${a}/${b}`);
  assert.ok(a > 240 && b > 240, '两者都应被拉大');
});

test('回填：空隙小于阈值时原样返回（不改动即幂等）', () => {
  const section = makeAnswerSection([200]);
  const used = computeContainerUsedPx([section]);
  const first = absorbContainerGap([section], used + 10);
  assert.equal(first.absorbedPx, 0);
  // 已回填过的容器再次调用不应该继续膨胀（账本已接近容量）
  const done = absorbContainerGap([section], used + 300, { safetyPx: 0 });
  const again = absorbContainerGap(done.sections, used + 300, { safetyPx: 0 });
  assert.equal(again.absorbedPx, 0, '重复回填不得继续放大');
  assert.deepEqual(again.sections, done.sections);
});

test('回填：单次吸收量封顶，避免把作答框撑成畸形', () => {
  const section = makeAnswerSection([200]);
  const used = computeContainerUsedPx([section]);
  const { absorbedPx } = absorbContainerGap([section], used + 900, { safetyPx: 0 });
  assert.equal(absorbedPx, GAP_ABSORB_MAX_PX, `吸收量应被封顶在 ${GAP_ABSORB_MAX_PX}`);
});

test('回填：填空长题追加横线行，并同步 lineCount 让分值只出现在新末行', () => {
  const rows = [];
  for (let lineIdx = 1; lineIdx <= 4; lineIdx += 1) {
    rows.push({
      rowType: 'long-line',
      item: { num: 15, lineCount: 4, scorePerQuestion: 10 },
      lineIdx,
      lineCount: 4,
      paginationHeightPx: 35,
      measureKey: `1-long-15-l${lineIdx}`
    });
  }
  const section = { id: 1, type: 'fillblank', rows };
  const used = computeContainerUsedPx([section]);
  const { sections, absorbedPx } = absorbContainerGap([section], used + 140, { safetyPx: 0 });
  const nextRows = sections[0].rows;
  assert.equal(nextRows.length, 8, '4 行基础上应追加 4 行');
  assert.equal(absorbedPx, 140);
  const lineCounts = new Set(nextRows.map((r) => r.item.lineCount));
  assert.deepEqual([...lineCounts], [8], '所有行必须共享同一个 lineCount');
  assert.equal(nextRows[nextRows.length - 1].lineIdx, 8, '最后一行行号应与 lineCount 一致');
  const keys = nextRows.map((r) => r.measureKey);
  assert.equal(new Set(keys).size, keys.length, '追加行的 measureKey 不得重复');
});

test('回填：作文格不参与拉伸（加行会破坏格子矩阵）', () => {
  const section = { id: 1, type: 'chinese', rows: [], columns: [] };
  const { absorbedPx } = absorbContainerGap([section], 2000, { minAbsorbPx: 10 });
  assert.equal(absorbedPx, 0);
});

test('传参构造：简写题块展开为设计器题块', () => {
  const sheet = createSheetData({
    title: '测试卷-答题卡',
    examNo: 'T001',
    layout: 'A4',
    blocks: [
      { type: 'single', from: 1, to: 8, score: 5 },
      { type: 'multiple', from: 9, to: 12, score: 5 },
      { type: 'blank', from: 13, to: 16, score: 5, lines: 1 },
      { type: 'blank', title: '大题填空', from: 17, to: 18, score: 10, lines: 4, long: true },
      { type: 'answer', from: 19, to: 21, score: 12, height: 260 },
      { type: 'english', no: 22, score: 25, lines: 15 },
      { type: 'chinese', no: 23, score: 60, words: 800 }
    ]
  });
  const doc = parseEditorDocument(sheet.editorJson);
  assert.equal(doc.questionBlocks.length, 7);
  assert.deepEqual(
    doc.questionBlocks.map((b) => b.type),
    ['objective', 'objective', 'fillblank', 'fillblank', 'answer', 'english', 'chinese']
  );
  assert.equal(doc.questionBlocks[0].segments[0].objectiveType, 'single');
  assert.equal(doc.questionBlocks[1].segments[0].objectiveType, 'multiple');
  assert.equal(doc.questionBlocks[3].segments[0].fillBlankType, 'long');
  assert.equal(doc.questionBlocks[3].segments[0].lineCount, 4);
  assert.equal(doc.questionBlocks[4].segments[0].areaHeight, 260);
  assert.equal(doc.questionBlocks[5].questionNo, 22);
  assert.equal(doc.questionBlocks[6].minWordCount, 800);
  assert.equal(sheet.sheetName, '测试卷-答题卡');
  assert.equal(doc.examNo, 'T001', '考试号随 editorJson 存取，且作为二维码内容');
});

test('传参构造：题块直接喂给 applyEditorDocument 可完整还原', () => {
  const sheet = createSheetData({
    title: '往返测试',
    blocks: [
      { type: 'single', from: 1, to: 5, score: 4 },
      { type: 'answer', from: 6, to: 8, score: 10, height: 240 }
    ]
  });
  const doc = parseEditorDocument(sheet.editorJson);
  const applied = applyEditorDocument(doc, createDefaultSheetForm(), 1);
  assert.equal(applied.questionBlocks.length, 2);
  // 区间题号用「一个分段 + startNum/endNum」表达，不是拆成 3 个分段
  assert.equal(applied.questionBlocks[1].segments.length, 1);
  assert.equal(applied.questionBlocks[1].segments[0].startNum, 6);
  assert.equal(applied.questionBlocks[1].segments[0].endNum, 8);
  assert.equal(applied.questionBlocks[1].segments[0].areaHeight, 240);
  assert.equal(applied.nextQuestionBlockId, 3);
});

test('传参构造：版式 / 分栏 / 填涂 / 二维码归一', () => {
  const a3 = createSheetData({ layout: 'A3', columns: 3, fillType: 'barcode', qrcode: false, blocks: [] });
  assert.equal(a3.layoutType, 'A3');
  assert.equal(a3.a3ColumnCount, 3);
  assert.equal(a3.fillType, 'barcode');
  assert.equal(a3.qrcodeEnabled, 0);

  const fallback = createSheetData({ layout: 'B5', columns: 9, fillType: 'nope', blocks: [] });
  assert.equal(fallback.layoutType, 'A4', '未知版式回落到 A4');
  assert.equal(fallback.a3ColumnCount, 2, '非法分栏回落到 2');
  assert.equal(fallback.fillType, 'admission', '未知填涂方式回落到准考证号');
  assert.equal(fallback.qrcodeEnabled, 1, '默认显示二维码');
});

test('传参构造：题型别名归一', () => {
  assert.equal(normalizeBlockType('单选'), null, '未登记的中文别名不应命中');
  assert.equal(normalizeBlockType('single'), 'single');
  assert.equal(normalizeBlockType('multiple-choice'), 'multiple');
  assert.equal(normalizeBlockType('judge'), 'judge');
  assert.equal(normalizeBlockType('fillblank'), 'blank');
  assert.equal(normalizeBlockType('composition'), 'chinese');
});

test('题号校验：断档 / 重号 / 重叠都能被识别', () => {
  const ok = createSheetData({
    layout: 'A4',
    blocks: [
      { type: 'single', from: 1, to: 5, score: 2 },
      { type: 'answer', from: 6, to: 7, score: 10 }
    ]
  });
  assert.equal(validateQuestionNumbering(parseEditorDocument(ok.editorJson).questionBlocks).ok, true);

  const gap = validateQuestionNumbering([
    { type: 'objective', segments: [{ startNum: 1, endNum: 5 }] },
    { type: 'objective', segments: [{ startNum: 8, endNum: 10 }] }
  ]);
  assert.equal(gap.ok, false);
  assert.deepEqual(gap.gaps, [[5, 8]]);

  const dup = validateQuestionNumbering([
    { type: 'objective', segments: [{ startNum: 1, endNum: 5 }] },
    { type: 'objective', segments: [{ startNum: 3, endNum: 6 }] }
  ]);
  assert.equal(dup.ok, false);
  assert.ok(dup.duplicates.includes(3) && dup.duplicates.includes(5));
});

test('传参构造：strict 模式下题号不连续直接抛错', () => {
  assert.throws(() => createSheetData({
    strict: true,
    blocks: [{ type: 'single', from: 1, to: 3 }, { type: 'answer', from: 5, to: 6 }]
  }), /题号断档/);
});

test('传参构造：withBlocks 只换题块，标题与版式保留', () => {
  const base = createSheetData({
    title: '原卷',
    examNo: 'X1',
    layout: 'A3',
    columns: 3,
    blocks: [{ type: 'single', from: 1, to: 4 }]
  });
  const next = withBlocks(base, [{ type: 'single', from: 1, to: 6 }, { type: 'answer', from: 7, to: 8 }]);
  assert.equal(next.sheetName, '原卷');
  assert.equal(next.examNo, 'X1');
  assert.equal(next.layoutType, 'A3');
  assert.equal(next.a3ColumnCount, 3);
  assert.equal(parseEditorDocument(next.editorJson).questionBlocks.length, 2);
});

test('传参构造：题量口径与保存报文一致（含短填多行）', () => {
  const sheet = createSheetData({
    title: '口径',
    blocks: [
      { type: 'single', from: 1, to: 4 },
      { type: 'blank', from: 5, to: 6, score: 2, lines: 3 },
      { type: 'answer', from: 7, to: 8 }
    ]
  });
  const blocks = parseEditorDocument(sheet.editorJson).questionBlocks;
  const payload = buildSheetPayload(createDefaultSheetForm(sheet), blocks, { nextQuestionBlockId: 4 });
  assert.equal(sheet.questionCount, payload.questionCount);
  assert.equal(sheet.choiceCount, payload.choiceCount);
  assert.equal(sheet.subjectiveCount, payload.subjectiveCount);
});

test('传参构造：把保存报文原样喂回来也能还原（editorJson 直通）', () => {
  const saved = createSheetData({
    title: '原卷',
    examNo: 'E-1',
    layout: 'A3',
    columns: 3,
    qrcode: false,
    notice: ['一、保持卷面清洁', '二、考试结束交回'],
    blocks: [
      { type: 'single', from: 1, to: 3 },
      { type: 'answer', from: 4, to: 5, height: 220 }
    ]
  });
  const savedBlocks = parseEditorDocument(saved.editorJson).questionBlocks;
  const payload = buildSheetPayload(createDefaultSheetForm(saved), savedBlocks, { nextQuestionBlockId: 3 });

  // 模拟宿主把后端那一条记录直接当参数塞回来
  const restored = createSheetData(payload);
  assert.equal(restored.sheetName, '原卷');
  assert.equal(restored.examNo, 'E-1');
  assert.equal(restored.layoutType, 'A3');
  assert.equal(restored.a3ColumnCount, 3);
  assert.equal(restored.qrcodeEnabled, 0);
  assert.equal(restored.noticeText, '一、保持卷面清洁\n二、考试结束交回');
  assert.deepEqual(
    parseEditorDocument(restored.editorJson).questionBlocks.map((b) => b.type),
    ['objective', 'answer']
  );
  assert.equal(restored.questionCount, payload.questionCount);
});

test('传参构造：editorJson 传已解析对象（后端 jsonb）同样可用', () => {
  const doc = parseEditorDocument(createSheetData({
    blocks: [{ type: 'single', from: 1, to: 4 }]
  }).editorJson);
  const restored = createSheetData({ editorJson: doc, layoutType: '8K' });
  assert.equal(restored.layoutType, '8K');
  assert.equal(restored.questionCount, 4);
  assert.equal(parseEditorDocument(restored.editorJson).questionBlocks.length, 1);
});

test('统计：totalScore 按分段分值累加（含作文单题分）', () => {
  const stats = computeSheetStats([
    { type: 'objective', segments: [{ startNum: 1, endNum: 3, scorePerQuestion: 5 }] },
    { type: 'answer', segments: [{ startNum: 4, endNum: 5, scorePerQuestion: 12 }] },
    { type: 'english', scorePerQuestion: 25 }
  ]);
  // 3×5 + 2×12 + 25
  assert.equal(stats.totalScore, 64);
});

test('统计：createSheetData 返回的 totalScore 与 computeSheetStats 一致', () => {
  const sheet = createSheetData({
    blocks: [
      { type: 'single', from: 1, to: 4, score: 5 },
      { type: 'answer', from: 5, to: 6, score: 10 }
    ]
  });
  const blocks = parseEditorDocument(sheet.editorJson).questionBlocks;
  assert.equal(sheet.totalScore, computeSheetStats(blocks).totalScore);
  assert.equal(sheet.totalScore, 40);
});

console.log(`✅ core 自检通过：${cases.length} 项`);cases.forEach((name, idx) => console.log(`  ${idx + 1}. ${name}`));

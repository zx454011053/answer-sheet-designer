/**
 * 答题卡内容构造器：把「一份试卷的题号/题型/分值」写成一段普通对象，
 * 生成设计器可直接消费的 sheet 数据（含 editorJson）。
 *
 * 用途：宿主不接后端、不做可视化编辑时，用一行配置直接渲染答题卡。
 *
 *   const sheet = createSheetData({
 *     title: '高二数学 期中联考',
 *     examNo: 'S20261118',
 *     layout: 'A4',
 *     blocks: [
 *       { type: 'single',   from: 1,  to: 8,  score: 5 },
 *       { type: 'multiple', from: 9,  to: 12, score: 5 },
 *       { type: 'blank',    from: 13, to: 16, score: 5 },
 *       { type: 'answer',   from: 17, to: 22, score: 12, height: 260 }
 *     ]
 *   });
 *
 * 纯数据 + 纯函数：不依赖 Vue / DOM，可在 Node 脚本、单测、SSR 里直接跑。
 */
import { createEditorDocument, parseEditorDocument } from './document';
import { createDefaultSheetForm } from './defaults';
import {
  normalizeAnswerBlock,
  normalizeChineseBlock,
  normalizeEnglishBlock,
  normalizeFillBlankBlock,
  normalizeObjectiveSegment,
  computeSheetStats
} from './questionModel';

/** 设计器支持的纸张版式 */
export const SHEET_LAYOUTS = Object.freeze(['A4', 'A3', '8K']);

/** 支持的填涂方式（class-number / qrcode 已下线，传了会自动回落） */
export const SHEET_FILL_TYPES = Object.freeze(['admission', 'barcode', 'short-number']);

/**
 * 简写题型 → 设计器内部题块类型
 * 别名覆盖常见叫法，避免宿主去查内部枚举。
 */
const TYPE_ALIASES = Object.freeze({
  single: 'single',
  radio: 'single',
  singlechoice: 'single',
  'single-choice': 'single',
  multiple: 'multiple',
  multi: 'multiple',
  multiplechoice: 'multiple',
  'multiple-choice': 'multiple',
  judge: 'judge',
  truefalse: 'judge',
  'true-false': 'judge',
  objective: 'objective',
  choice: 'objective',
  blank: 'blank',
  fillblank: 'blank',
  fill: 'blank',
  answer: 'answer',
  subjective: 'answer',
  essay: 'answer',
  english: 'english',
  'english-writing': 'english',
  chinese: 'chinese',
  composition: 'chinese'
});

/** 简写题型默认大题标题 */
const DEFAULT_TITLES = Object.freeze({
  single: '单项选择题',
  multiple: '多项选择题',
  judge: '判断题',
  objective: '客观题',
  blank: '填空题',
  answer: '解答题',
  english: '英语作文',
  chinese: '语文作文'
});

const toInt = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
};

const toNum = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const pickFirst = (...values) => {
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== undefined && values[i] !== null && values[i] !== '') return values[i];
  }
  return undefined;
};

/** 题型别名归一 */
export function normalizeBlockType(type) {
  const key = String(type == null ? '' : type).trim().toLowerCase();
  return TYPE_ALIASES[key] || null;
}

/** 题号区间：支持 from/to、startNum/endNum、range:[1,10]、num 单题 */
function resolveRange(segment) {
  const range = Array.isArray(segment.range) ? segment.range : [];
  const start = toInt(
    pickFirst(segment.from, segment.startNum, segment.start, range[0], segment.num, segment.no),
    1
  );
  const end = toInt(
    pickFirst(segment.to, segment.endNum, segment.end, range[1], segment.num, segment.no, start),
    start
  );
  return {
    startNum: Math.max(1, Math.min(start, end)),
    endNum: Math.max(1, Math.max(start, end))
  };
}

/** 客观题分段 */
function buildObjectiveSegment(segment, fallbackType) {
  const objectiveType = normalizeBlockType(segment.type || segment.objectiveType) || fallbackType;
  const { startNum, endNum } = resolveRange(segment);
  const fallbackOptions = objectiveType === 'judge' ? 2 : (objectiveType === 'multiple' ? 5 : 4);
  return normalizeObjectiveSegment({
    objectiveType,
    startNum,
    endNum,
    scorePerQuestion: pickFirst(segment.score, segment.scorePerQuestion, 1),
    optionCount: pickFirst(segment.options, segment.optionCount, fallbackOptions)
  }, fallbackType);
}

/** 填空题分段 */
function buildBlankSegment(segment, blockDefaults = {}) {
  const { startNum, endNum } = resolveRange(segment);
  const isLong = segment.long === true
    || segment.fillBlankType === 'long'
    || blockDefaults.long === true
    || blockDefaults.fillBlankType === 'long';
  return {
    fillBlankType: isLong ? 'long' : 'short',
    startNum,
    endNum,
    scorePerQuestion: Math.max(0.5, toNum(pickFirst(segment.score, segment.scorePerQuestion, 1), 1)),
    lineCount: Math.max(1, toInt(pickFirst(segment.lines, segment.lineCount, 1), 1))
  };
}

/** 解答题分段 */
function buildAnswerSegment(segment) {
  const { startNum, endNum } = resolveRange(segment);
  return {
    startNum,
    endNum,
    scorePerQuestion: Math.max(0.5, toNum(pickFirst(segment.score, segment.scorePerQuestion, 5), 5)),
    areaHeight: Math.max(80, toInt(pickFirst(segment.height, segment.areaHeight, 180), 180))
  };
}

/** 题块已有 segments 字段时视为「原始题块」，只补 id / 大题号 */
function isRawBlock(block) {
  return Array.isArray(block.segments) && block.segments.length > 0;
}

/**
 * 单个题块 → 设计器题块
 * @param {Object} block 简写或原始题块
 * @param {number} index 序号（0 起）
 */
function buildBlock(block, index) {
  const sectionNo = Math.max(1, toInt(pickFirst(block.sectionNo, block.no2, index + 1), index + 1));
  const id = Math.max(1, toInt(block.id, index + 1));
  const type = normalizeBlockType(block.type) || 'blank';
  const sectionTitle = pickFirst(block.sectionTitle, block.title, DEFAULT_TITLES[type]);
  const base = { id, sectionNo, sectionTitle };

  /* ---------- 客观题 ---------- */
  if (type === 'single' || type === 'multiple' || type === 'judge' || type === 'objective') {
    const fallbackType = type === 'objective' ? 'single' : type;
    const sourceSegments = isRawBlock(block)
      ? block.segments
      : (Array.isArray(block.items) && block.items.length ? block.items : [block]);
    const segments = sourceSegments.map((seg) => buildObjectiveSegment(seg, fallbackType));
    const count = segments.reduce((sum, seg) => sum + (seg.endNum - seg.startNum + 1), 0);
    const firstSegment = segments[0];
    return {
      ...base,
      type: 'objective',
      count,
      optionCount: firstSegment.optionCount,
      scorePerQuestion: firstSegment.scorePerQuestion,
      segments
    };
  }

  /* ---------- 填空题 ---------- */
  if (type === 'blank') {
    const sourceSegments = isRawBlock(block)
      ? block.segments
      : (Array.isArray(block.items) && block.items.length ? block.items : [block]);
    return normalizeFillBlankBlock({
      ...base,
      type: 'fillblank',
      segments: sourceSegments.map((seg) => buildBlankSegment(seg, block))
    }, sectionNo);
  }

  /* ---------- 解答题 ---------- */
  if (type === 'answer') {
    const sourceSegments = isRawBlock(block)
      ? block.segments.map((seg) => ({
        startNum: seg.startNum,
        endNum: seg.endNum,
        scorePerQuestion: seg.scorePerQuestion,
        areaHeight: seg.areaHeight
      }))
      : (Array.isArray(block.items) && block.items.length ? block.items : [block]).map(buildAnswerSegment);
    return normalizeAnswerBlock({ ...base, type: 'answer', segments: sourceSegments }, sectionNo);
  }

  /* ---------- 英语作文 ---------- */
  if (type === 'english') {
    const { startNum } = resolveRange(block);
    return normalizeEnglishBlock({
      ...base,
      type: 'english',
      questionNo: startNum,
      scorePerQuestion: pickFirst(block.score, block.scorePerQuestion, 25),
      lineCount: pickFirst(block.lines, block.lineCount, 10),
      openingText: pickFirst(block.opening, block.openingText, ''),
      showSectionTitle: block.showSectionTitle !== false
    }, sectionNo);
  }

  /* ---------- 语文作文 ---------- */
  const { startNum: chineseNum } = resolveRange(block);
  const minWordCount = pickFirst(block.words, block.minWordCount, 800);
  return normalizeChineseBlock({
    ...base,
    type: 'chinese',
    questionNo: chineseNum,
    scorePerQuestion: pickFirst(block.score, block.scorePerQuestion, 60),
    minWordCount,
    maxWordCount: pickFirst(block.maxWords, block.maxWordCount, Math.max(Number(minWordCount) + 200, 1000))
  }, sectionNo);
}

/**
 * 校验题号区间：缺号 / 重号 / 乱序
 * 设计器本身不做这层校验（允许手工制造任意结构），构造器替宿主兜住。
 * @param {Array<Object>} blocks
 * @returns {{ ok: boolean, duplicates: number[], gaps: Array<[number, number]>, descents: Array<[number, number]> }}
 */
export function validateQuestionNumbering(blocks) {
  const ranges = [];
  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    if (Array.isArray(block.segments)) {
      block.segments.forEach((seg) => {
        const start = toInt(seg.startNum, 1);
        const end = toInt(seg.endNum, start);
        ranges.push([Math.min(start, end), Math.max(start, end)]);
      });
      return;
    }
    if (block.type === 'english' || block.type === 'chinese') {
      const num = toInt(block.questionNo, 1);
      ranges.push([num, num]);
    }
  });
  ranges.sort((a, b) => a[0] - b[0]);

  const duplicates = [];
  const gaps = [];
  const descents = [];
  const seen = new Map();
  ranges.forEach(([start, end]) => {
    for (let n = start; n <= end; n += 1) seen.set(n, (seen.get(n) || 0) + 1);
  });
  seen.forEach((times, num) => {
    if (times > 1) duplicates.push(num);
  });
  for (let i = 1; i < ranges.length; i += 1) {
    const prevEnd = ranges[i - 1][1];
    const start = ranges[i][0];
    if (start === prevEnd + 1) continue;
    if (start > prevEnd + 1) gaps.push([prevEnd, start]);
    else descents.push([prevEnd, start]);
  }
  duplicates.sort((a, b) => a - b);
  return {
    ok: !duplicates.length && !gaps.length && !descents.length,
    duplicates,
    gaps,
    descents
  };
}

/**
 * 生成答题卡数据（可直接作为 `<answer-sheet-designer :sheet="..." />` 或 `setSheet()` 的入参）
 *
 * 两种输入形状都吃：
 * 1) 简写：`{ title, layout, blocks: [简写题块…] }`
 * 2) 已保存的答题卡（后端 `loadSheet` 的返回、保存报文本身）：只认里面的 `editorJson`，
 *    题块原样取出，不再走简写展开 —— 这样「保存下来的数据」可以直接回传给 `:content`。
 *
 * @param {Object} config
 * @param {string} [config.title] 答题卡标题
 * @param {string} [config.examNo] 考试号（同时作为二维码内容）
 * @param {'A4'|'A3'|'8K'} [config.layout] 纸张版式，默认 A4
 * @param {2|3} [config.columns] A3 / 8K 的分栏数，默认 2
 * @param {'admission'|'barcode'|'short-number'} [config.fillType] 填涂方式
 * @param {boolean} [config.qrcode] 是否显示二维码，默认 true
 * @param {string|string[]} [config.notice] 考生须知（传数组按行拆分）
 * @param {Array<Object>} config.blocks 题块（见上方示例）
 * @param {string|Object} [config.editorJson] 已序列化的答题卡文档；有 `blocks` 时忽略
 * @param {Object} [config.form] 其余表单字段透传（verticalLayout / fillBlankMode 等）
 * @param {boolean} [config.strict] 题号不连续时抛错而不是警告
 * @returns {Object} sheet
 */
export function createSheetData(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  const rawBlocks = Array.isArray(source.blocks) ? source.blocks : [];

  // 已经序列化过的答题卡：题块按原样取用，不再按简写展开（简写展开会丢掉内部字段）。
  // editorJson 兼容字符串与已解析对象（后端 jsonb 列会把对象直接返回）。
  const rawDoc = rawBlocks.length ? null : source.editorJson;
  const serializedDoc = rawDoc && typeof rawDoc === 'object'
    ? rawDoc
    : parseEditorDocument(rawDoc);
  const blocks = serializedDoc && Array.isArray(serializedDoc.questionBlocks)
    ? serializedDoc.questionBlocks
    : rawBlocks.map((block, index) => buildBlock(block || {}, index));

  // 回灌已保存的数据时不再重复校验题号（界面允许手工造出跳号，回读不该报错）
  const numbering = serializedDoc ? { ok: true } : validateQuestionNumbering(blocks);
  if (!numbering.ok) {
    const message = [
      numbering.duplicates.length ? `题号重复：${numbering.duplicates.slice(0, 10).join(', ')}` : '',
      numbering.gaps.length
        ? `题号断档：${numbering.gaps.slice(0, 5).map((g) => `${g[0]}→${g[1]}`).join('，')}`
        : '',
      numbering.descents.length ? '题号区间存在重叠或乱序' : ''
    ].filter(Boolean).join('；');
    if (source.strict) throw new Error(`[answer-sheet-designer] ${message}`);
    console.warn(`[answer-sheet-designer] 题号校验未通过 —— ${message}`);
  }

  const layoutType = SHEET_LAYOUTS.includes(source.layoutType)
    ? source.layoutType
    : (SHEET_LAYOUTS.includes(source.layout) ? source.layout : 'A4');
  const a3ColumnCount = Number(pickFirst(source.a3ColumnCount, source.columns)) === 3 ? 3 : 2;
  const fillType = SHEET_FILL_TYPES.includes(source.fillType)
    ? source.fillType
    : (serializedDoc && SHEET_FILL_TYPES.includes(serializedDoc.fillType)
      ? serializedDoc.fillType
      : 'admission');
  const noticeSource = pickFirst(source.notice, source.noticeText);
  const noticeText = Array.isArray(noticeSource)
    ? noticeSource.filter(Boolean).join('\n')
    : (noticeSource == null ? '' : String(noticeSource));

  const stats = computeSheetStats(blocks);
  const examNoSource = pickFirst(source.examNo, serializedDoc && serializedDoc.examNo, '');
  const flat = {
    ...(source.form && typeof source.form === 'object' ? source.form : {}),
    ...(source.id != null ? { id: source.id } : {}),
    ...(source.examSessionId != null ? { examSessionId: source.examSessionId } : {}),
    ...(source.paperId != null ? { paperId: source.paperId } : {}),
    sheetName: pickFirst(source.title, source.sheetName, '答题卡'),
    examNo: examNoSource == null ? '' : String(examNoSource),
    layoutType,
    a3ColumnCount,
    fillType,
    noticeText,
    qrcodeEnabled: source.qrcode === false || source.qrcodeEnabled === 0
      ? 0
      : (serializedDoc && serializedDoc.qrcodeEnabled === 0 ? 0 : 1)
  };

  // 只有显式给了统计字段才覆盖，避免把「用户没传」写成 0
  if (source.questionCount != null) flat.questionCount = source.questionCount;
  if (source.pageCount != null) flat.pageCount = source.pageCount;

  const nextIdFromDoc = serializedDoc ? Number(serializedDoc.nextQuestionBlockId) : NaN;
  const form = createDefaultSheetForm(flat);
  return {
    ...flat,
    questionCount: flat.questionCount != null ? flat.questionCount : stats.questionCount,
    choiceCount: stats.choiceCount,
    subjectiveCount: stats.subjectiveCount,
    // 合计分：后端生成答题卡时可直接取用，不必自己再遍历题块
    totalScore: stats.totalScore,
    editorJson: createEditorDocument({
      questionBlocks: blocks,
      nextQuestionBlockId: Number.isFinite(nextIdFromDoc) && nextIdFromDoc > 0
        ? nextIdFromDoc
        : blocks.length + 1,
      form
    })
  };
}

/**
 * 在现有答题卡上追加 / 替换题块（保持其余表单字段不变）
 * @param {Object} sheet createSheetData 的产物或后端返回的答题卡
 * @param {Array<Object>} blocks 简写题块
 */
export function withBlocks(sheet, blocks) {
  const base = sheet && typeof sheet === 'object' ? sheet : {};
  return createSheetData({
    ...base,
    title: base.sheetName,
    blocks
  });
}

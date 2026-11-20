/**
 * 答题卡数据模型：题型定义、分段/题块规范化、题量分值统计。
 *
 * 全部为纯函数，不依赖 Vue，可单独测试与复用（题库导入、模板校验等场景）。
 */
import { formatAnswerSheetScore } from './sectionTitleFormat';

/** 客观题（答题卡上按横带排布的填涂题）类型 */
export const OBJECTIVE_TYPES = Object.freeze(['single', 'multiple', 'judge', 'objective']);

/** 题型默认大题标题 */
export const DEFAULT_SECTION_TITLES = Object.freeze({
  objective: '客观题',
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fillblank: '填空题',
  answer: '解答题',
  english: '作文',
  chinese: '作文'
});

/** 题型展示名（设置面板 / 列表用） */
export const QUESTION_TYPE_LABELS = Object.freeze({
  objective: '客观题',
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fillblank: '填空题',
  answer: '解答题',
  english: '英语作文',
  chinese: '语文作文'
});

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

let tempIdSeq = 0;

/** 生成前端临时 id（分段/分段行使用，不参与持久化） */
export function createTempId() {
  tempIdSeq += 1;
  return `${Date.now().toString(36)}-${tempIdSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @param {string} type */
export function isObjectiveType(type) {
  return OBJECTIVE_TYPES.includes(type);
}

/** @param {string} type */
export function getDefaultSectionTitle(type) {
  return DEFAULT_SECTION_TITLES[type] || '填空题';
}

/** @param {string} type */
export function getQuestionTypeLabel(type) {
  return QUESTION_TYPE_LABELS[type] || '填空题';
}

/** 分值展示（整数不带小数） */
export const formatScore = formatAnswerSheetScore;

/**
 * 选项标签：判断题固定「对/错」，其余按选项数取 A..Z（2~26）
 * @param {string} type
 * @param {number} count
 * @returns {string[]}
 */
export function buildOptionLabels(type, count) {
  if (type === 'judge') return ['对', '错'];
  const size = Math.min(LETTERS.length, Math.max(2, Number(count) || 4));
  return LETTERS.slice(0, size);
}

/* ------------------------------------------------------------------ *
 * 分段（segment）：一个大题块内的题号区间，可混合题型 / 分值 / 空数
 * ------------------------------------------------------------------ */

/**
 * @param {string} [type]
 * @param {number} [startNum]
 */
export function createObjectiveSegment(type = 'single', startNum = 1) {
  const start = Math.max(1, Number(startNum) || 1);
  return {
    tempId: createTempId(),
    objectiveType: type,
    startNum: start,
    endNum: start,
    scorePerQuestion: 1,
    optionCount: type === 'judge' ? 2 : (type === 'multiple' ? 5 : 4)
  };
}

/**
 * @param {Object} [segment]
 * @param {string} [fallbackType]
 */
export function normalizeObjectiveSegment(segment = {}, fallbackType = 'single') {
  const objectiveType = ['single', 'multiple', 'judge'].includes(segment.objectiveType)
    ? segment.objectiveType
    : fallbackType;
  const startNum = Math.max(1, Number(segment.startNum) || 1);
  const endNum = Math.max(1, Number(segment.endNum) || 1);
  return {
    tempId: segment.tempId || createTempId(),
    objectiveType,
    startNum: Math.min(startNum, endNum),
    endNum: Math.max(startNum, endNum),
    scorePerQuestion: Math.max(0.5, Number(segment.scorePerQuestion) || 1),
    optionCount: objectiveType === 'judge'
      ? 2
      : Math.max(2, Number(segment.optionCount) || (objectiveType === 'multiple' ? 5 : 4))
  };
}

/** @param {number} [startNum] */
export function createAnswerSegment(startNum = 1) {
  const start = Math.max(1, Number(startNum) || 1);
  return {
    tempId: createTempId(),
    startNum: start,
    endNum: start,
    scorePerQuestion: 5,
    areaHeight: 180
  };
}

/**
 * @param {Object} [segment]
 * @param {{ maxAreaHeight?: number }} [options]
 */
export function normalizeAnswerSegment(segment = {}, options = {}) {
  const startNum = Math.max(1, Number(segment.startNum) || 1);
  const endNum = Math.max(1, Number(segment.endNum) || 1);
  const limit = Number(options.maxAreaHeight);
  const upper = Number.isFinite(limit) && limit > 0 ? limit : Number.MAX_SAFE_INTEGER;
  return {
    tempId: segment.tempId || createTempId(),
    startNum: Math.min(startNum, endNum),
    endNum: Math.max(startNum, endNum),
    scorePerQuestion: Math.max(0.5, Number(segment.scorePerQuestion) || 5),
    areaHeight: Math.min(upper, Math.max(80, Number(segment.areaHeight) || 180))
  };
}

/**
 * @param {'short'|'long'} [fillBlankType]
 * @param {number} [startNum]
 */
export function createFillBlankSegment(fillBlankType = 'short', startNum = 1) {
  const start = Math.max(1, Number(startNum) || 1);
  return {
    tempId: createTempId(),
    fillBlankType: fillBlankType === 'long' ? 'long' : 'short',
    startNum: start,
    endNum: start,
    scorePerQuestion: 1,
    lineCount: 1
  };
}

/** @param {Object} [segment] */
export function normalizeFillBlankSegment(segment = {}) {
  const startNum = Math.max(1, Number(segment.startNum) || 1);
  const endNum = Math.max(1, Number(segment.endNum) || 1);
  return {
    tempId: segment.tempId || createTempId(),
    fillBlankType: segment.fillBlankType === 'long' ? 'long' : 'short',
    startNum: Math.min(startNum, endNum),
    endNum: Math.max(startNum, endNum),
    scorePerQuestion: Math.max(0.5, Number(segment.scorePerQuestion) || 1),
    lineCount: Math.max(1, Number(segment.lineCount) || 1)
  };
}

/** 分段是否合法（开始题号不得大于结束题号） */
export function isSegmentRangeValid(segment) {
  const start = Math.max(1, Number(segment && segment.startNum) || 1);
  const end = Math.max(1, Number(segment && segment.endNum) || 1);
  return start <= end;
}

/* ------------------------------------------------------------------ *
 * 题块（block）：一个大题 = 一个题块
 * ------------------------------------------------------------------ */

const clampSectionNo = (value, fallback) => Math.max(1, Number(value) || fallback);

/**
 * @param {Object} [block]
 * @param {number} [fallbackSectionNo]
 * @param {{ maxAreaHeight?: number }} [options]
 */
export function normalizeAnswerBlock(block = {}, fallbackSectionNo = 1, options = {}) {
  const segments = Array.isArray(block.segments) && block.segments.length
    ? block.segments.map((item) => normalizeAnswerSegment(item, options))
    : [createAnswerSegment(Number(block.startNum) || 1)];
  return {
    ...block,
    type: 'answer',
    sectionNo: clampSectionNo(block.sectionNo, fallbackSectionNo),
    sectionTitle: (block.sectionTitle || '解答题').trim() || '解答题',
    segments
  };
}

/**
 * @param {Object} [block]
 * @param {number} [fallbackSectionNo]
 */
export function normalizeFillBlankBlock(block = {}, fallbackSectionNo = 1) {
  const segments = Array.isArray(block.segments) && block.segments.length
    ? block.segments.map((item) => normalizeFillBlankSegment(item))
    : [createFillBlankSegment(block.fillBlankType === 'short' ? 'short' : 'long', Number(block.startNum) || 1)];
  return {
    ...block,
    type: 'fillblank',
    sectionNo: clampSectionNo(block.sectionNo, fallbackSectionNo),
    sectionTitle: (block.sectionTitle || '填空题').trim() || '填空题',
    segments
  };
}

/**
 * @param {Object} [block]
 * @param {number} [fallbackSectionNo]
 */
export function normalizeEnglishBlock(block = {}, fallbackSectionNo = 1) {
  return {
    ...block,
    type: 'english',
    sectionNo: clampSectionNo(block.sectionNo, fallbackSectionNo),
    sectionTitle: (block.sectionTitle || '作文').trim() || '作文',
    showSectionTitle: block.showSectionTitle !== false,
    questionNo: Math.max(1, Number(block.questionNo) || 1),
    scorePerQuestion: Math.max(0.5, Number(block.scorePerQuestion) || 1),
    lineCount: Math.max(3, Math.min(60, Number(block.lineCount) || 10)),
    openingText: (block.openingText || '').trim()
  };
}

/**
 * @param {Object} [block]
 * @param {number} [fallbackSectionNo]
 */
export function normalizeChineseBlock(block = {}, fallbackSectionNo = 1) {
  const minWordCount = Math.max(50, Number(block.minWordCount) || 800);
  const maxWordCount = Math.max(100, Number(block.maxWordCount) || 1000);
  return {
    ...block,
    type: 'chinese',
    sectionNo: clampSectionNo(block.sectionNo, fallbackSectionNo),
    sectionTitle: (block.sectionTitle || '作文').trim() || '作文',
    questionNo: Math.max(1, Number(block.questionNo) || 1),
    scorePerQuestion: Math.max(0.5, Number(block.scorePerQuestion) || 1),
    minWordCount: Math.min(minWordCount, maxWordCount),
    maxWordCount: Math.max(minWordCount, maxWordCount)
  };
}

/* ------------------------------------------------------------------ *
 * 统计
 * ------------------------------------------------------------------ */

/** 填空题小题数：短填按「小题 × 每题空数」计，长填按小题数计 */
export function countFillBlankQuestions(block) {
  const normalized = normalizeFillBlankBlock(block, 1);
  return normalized.segments.reduce((sum, segment) => {
    const span = segment.endNum - segment.startNum + 1;
    if (segment.fillBlankType === 'long') return sum + span;
    return sum + span * Math.max(1, Number(segment.lineCount) || 1);
  }, 0);
}

/** 填空题总分 */
export function getFillBlankTotalScore(block) {
  const normalized = normalizeFillBlankBlock(block, 1);
  return normalized.segments.reduce((sum, segment) => {
    const span = segment.endNum - segment.startNum + 1;
    return sum + span * segment.scorePerQuestion;
  }, 0);
}

/** 解答题小题数 */
export function countAnswerQuestions(block, options = {}) {
  const normalized = normalizeAnswerBlock(block, 1, options);
  return normalized.segments.reduce((sum, segment) => sum + (segment.endNum - segment.startNum + 1), 0);
}

/** 解答题总分 */
export function getAnswerTotalScore(block, options = {}) {
  const normalized = normalizeAnswerBlock(block, 1, options);
  return normalized.segments.reduce((sum, segment) => {
    const span = segment.endNum - segment.startNum + 1;
    return sum + span * segment.scorePerQuestion;
  }, 0);
}

/** 客观题小题数（优先按分段统计，其次 count） */
export function countObjectiveQuestions(block) {
  const segments = Array.isArray(block && block.segments) ? block.segments : [];
  if (segments.length) {
    return segments.reduce(
      (sum, seg) => sum + (Math.max(1, Number(seg.endNum) || 1) - Math.max(1, Number(seg.startNum) || 1) + 1),
      0
    );
  }
  return Math.max(1, Number(block && block.count) || 1);
}

/**
 * 全卷已用小题题号的最大值（客观/填空/解答分段、作文题号），用于新建大题的起始题号。
 * @param {Array<Object>} blocks
 * @param {string|number|null} [excludeBlockId]
 */
export function getGlobalMaxQuestionNum(blocks, excludeBlockId = null) {
  let max = 0;
  (blocks || []).forEach((block) => {
    if (!block || (excludeBlockId != null && block.id === excludeBlockId)) return;
    if (isObjectiveType(block.type) || block.type === 'fillblank' || block.type === 'answer') {
      const segments = Array.isArray(block.segments) ? block.segments : [];
      segments.forEach((seg) => {
        max = Math.max(max, Number(seg.endNum) || 0, Number(seg.startNum) || 0);
      });
      if (!segments.length && Array.isArray(block.numbers)) {
        block.numbers.forEach((n) => {
          max = Math.max(max, Number(n) || 0);
        });
      }
      return;
    }
    if (block.type === 'english' || block.type === 'chinese') {
      max = Math.max(max, Number(block.questionNo) || 0);
    }
  });
  return max;
}

/** 新建大题的起始题号 */
export function getNextGlobalQuestionNum(blocks, excludeBlockId = null) {
  return Math.max(1, getGlobalMaxQuestionNum(blocks, excludeBlockId) + 1);
}

/** 同一分组内下一个题号（分段末尾 +1） */
export function getNextNumFromSegments(segments = []) {
  const maxNum = segments.reduce((max, item) => Math.max(max, Number(item.endNum) || 0), 0);
  return Math.max(1, maxNum + 1);
}

/**
 * 统计题量（用于设置面板汇总与保存时回填 form 上的冗余字段）。
 * 与旧实现差异：题量改为按当前题块求和，删除题块后能够正确回落（旧实现在此处用 Math.max，只增不减）。
 * @param {Array<Object>} blocks
 * @returns {{choiceCount:number, fillBlankCount:number, answerCount:number, englishCount:number, chineseCount:number, subjectiveCount:number, questionCount:number}}
 */
export function computeSheetStats(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  let choiceCount = 0;
  let fillBlankCount = 0;
  let answerCount = 0;
  let englishCount = 0;
  let chineseCount = 0;
  let totalScore = 0;

  /** 按分段累加分值：题号区间长度 × 每题分值 */
  const sumSegmentScore = (segments) => {
    if (!Array.isArray(segments)) return 0;
    return segments.reduce((sum, seg) => {
      const start = Number(seg && seg.startNum) || 0;
      const end = seg && seg.endNum != null ? Number(seg.endNum) : start;
      const span = Math.max(1, end - start + 1);
      return sum + span * (Number(seg && seg.scorePerQuestion) || 0);
    }, 0);
  };

  list.forEach((block) => {
    if (isObjectiveType(block.type)) {
      choiceCount += countObjectiveQuestions(block);
      totalScore += sumSegmentScore(block.segments);
      return;
    }
    if (block.type === 'fillblank') {
      fillBlankCount += countFillBlankQuestions(block);
      totalScore += sumSegmentScore(block.segments);
      return;
    }
    if (block.type === 'answer') {
      answerCount += countAnswerQuestions(block);
      totalScore += sumSegmentScore(block.segments);
      return;
    }
    if (block.type === 'english') {
      englishCount += 1;
      totalScore += Number(block.scorePerQuestion) || 0;
    }
    if (block.type === 'chinese') {
      chineseCount += 1;
      totalScore += Number(block.scorePerQuestion) || 0;
    }
  });

  const subjectiveCount = answerCount + englishCount + chineseCount;
  return {
    choiceCount,
    fillBlankCount,
    answerCount,
    englishCount,
    chineseCount,
    subjectiveCount,
    // 与题目分值一致的合计分（保留 1 位小数，避免 0.1+0.2 这类浮点噪音）
    totalScore: Math.round(totalScore * 10) / 10,
    questionCount: choiceCount + fillBlankCount + subjectiveCount
  };
}

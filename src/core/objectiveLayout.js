/**
 * 客观题排版：题目展开 → 横带（band）拆分 → 列数决策。
 *
 * 原实现散落在 AnswerSheetEditor 的 5 个方法里并依赖 this.form，此处改为显式入参的纯函数，
 * 便于在设置面板预览、模板校验、单测中复用。
 */
import {
  OBJECTIVE_QUESTIONS_PER_COLUMN,
  OBJECTIVE_BAND_MAX_COLS_A4,
  OBJECTIVE_BAND_MAX_COLS_A3_TWO_COL,
  OBJECTIVE_BAND_MAX_COLS_A3_8K
} from './constants';
import { buildOptionLabels, isObjectiveType, normalizeObjectiveSegment } from './questionModel';

/**
 * 展开客观题小题列表
 * @param {Array<Object>} segments 已 normalize 的分段
 * @param {string} blockType
 * @param {number} startNum 无分段时的起始题号
 * @param {number} fallbackCount
 * @param {number} fallbackOptionCount
 * @param {number} fallbackScore
 * @returns {Array<{num:number, objectiveType:string, scorePerQuestion:number, optionLabels:string[]}>}
 */
export function buildObjectiveQuestions(
  segments,
  blockType,
  startNum,
  fallbackCount,
  fallbackOptionCount,
  fallbackScore
) {
  const list = [];
  if (Array.isArray(segments) && segments.length) {
    segments
      .slice()
      .sort((a, b) => a.startNum - b.startNum)
      .forEach((segment) => {
        const type = segment.objectiveType || blockType;
        const optionCount = type === 'judge' ? 2 : Math.max(2, Number(segment.optionCount) || 4);
        for (let num = segment.startNum; num <= segment.endNum; num += 1) {
          list.push({
            num,
            objectiveType: type,
            scorePerQuestion: segment.scorePerQuestion,
            optionLabels: buildOptionLabels(type, optionCount)
          });
        }
      });
    return list;
  }

  const count = Math.max(1, Number(fallbackCount) || 1);
  const optionCount = blockType === 'judge' ? 2 : Math.max(2, Number(fallbackOptionCount) || 4);
  for (let i = 0; i < count; i += 1) {
    list.push({
      num: startNum + i,
      objectiveType: blockType,
      scorePerQuestion: fallbackScore,
      optionLabels: buildOptionLabels(blockType, optionCount)
    });
  }
  return list;
}

/**
 * 每条横带的默认列数
 * @param {string} layoutType A4 | A3 | 8K
 * @param {number} columnCount A3/8K 答题区分栏数
 */
export function getObjectiveBandColumnCount(layoutType, columnCount) {
  if (layoutType === 'A3' || layoutType === '8K') {
    return Number(columnCount) === 2
      ? OBJECTIVE_BAND_MAX_COLS_A3_TWO_COL
      : OBJECTIVE_BAND_MAX_COLS_A3_8K;
  }
  return OBJECTIVE_BAND_MAX_COLS_A4;
}

/**
 * 三栏混排：单选/多选选项 > 4 为「宽题」，其余（含判断）为「窄题」
 * @param {Object} question
 * @param {string} blockType
 * @returns {'wide'|'narrow'}
 */
export function objectiveQuestionLayoutTier(question, blockType) {
  const type = (question && question.objectiveType) || blockType;
  if (type !== 'single' && type !== 'multiple') return 'narrow';
  const n = Array.isArray(question && question.optionLabels) ? question.optionLabels.length : 0;
  return n > 4 ? 'wide' : 'narrow';
}

/**
 * 固定列数下的横带拆分
 * @param {Array<Object>} questions
 * @param {number} maxCols
 * @returns {Array<{columns:Array<Array<Object>>, colsPerBand:number}>}
 */
export function buildObjectiveBandsUniform(questions, maxCols) {
  const list = Array.isArray(questions) ? questions : [];
  const qPerCol = OBJECTIVE_QUESTIONS_PER_COLUMN;
  const cols = Math.max(1, Number(maxCols) || 1);
  const perBand = qPerCol * cols;
  const bands = [];
  let offset = 0;
  while (offset < list.length) {
    const bandSlice = list.slice(offset, offset + perBand);
    offset += bandSlice.length;

    /*
     * 本片列数与列内题数（重要：不能沿用 `slice(c*qPerCol, ...)`）。
     *
     * 固定每列 5 题会让「题量不是列数整数倍」的横带严重失衡：16 题排 4 列会被
     * 切成 5/5/5/1（末列孤零零一题，其余列 5 行高、整条横带按 5 行占位）；
     * 而题量不足 5×列数时（如 10 题、5 题、4 题）后几列整列为空，选题框只占纸面
     * 左侧 1/4，右侧大段留白。
     *
     * 改为「题量不足则收缩列数（一题一列），否则固定列数后按 ceil 均分」，得到
     * 16→4/4/4/4、10→3/3/2/2、5→2/1/1/1、4→1/1/1/1，既铺满横带也压低行高。
     */
    const bandCols = Math.max(1, Math.min(cols, bandSlice.length));
    const base = Math.floor(bandSlice.length / bandCols);
    const extra = bandSlice.length % bandCols;
    const columns = [];
    let cursor = 0;
    for (let c = 0; c < bandCols; c += 1) {
      const take = base + (c < extra ? 1 : 0);
      columns.push(bandSlice.slice(cursor, cursor + take));
      cursor += take;
    }
    bands.push({ columns, colsPerBand: bandCols });
  }
  return bands.length
    ? bands
    : [{ columns: Array.from({ length: cols }, () => []), colsPerBand: cols }];
}

/**
 * 按版式把题目拆成横带：
 * - A3/8K 三栏：窄题 3 列、宽题 2 列
 * - A4 / A3 两栏 / 8K 两栏：窄题 4 列、宽题 3 列
 * @param {Array<Object>} questions
 * @param {string} blockType
 * @param {{ layoutType?: string, columnCount?: number }} options
 */
export function buildObjectiveBands(questions, blockType, options = {}) {
  const list = Array.isArray(questions) ? questions : [];
  const layoutType = options.layoutType || 'A4';
  const columnCount = Number(options.columnCount);
  const baseCols = Math.max(1, Number(getObjectiveBandColumnCount(layoutType, columnCount)) || 1);

  const isThreePane = (layoutType === 'A3' || layoutType === '8K') && columnCount === 3;
  const isTwoPaneOrA4 = layoutType === 'A4'
    || ((layoutType === 'A3' || layoutType === '8K') && columnCount === 2);

  if (!list.length || (!isThreePane && !isTwoPaneOrA4)) {
    return buildObjectiveBandsUniform(list, baseCols);
  }

  const wideCols = isThreePane ? 2 : 3;
  const out = [];
  let i = 0;
  while (i < list.length) {
    const tier = objectiveQuestionLayoutTier(list[i], blockType);
    const maxCols = tier === 'wide' ? wideCols : baseCols;
    let j = i + 1;
    while (j < list.length && objectiveQuestionLayoutTier(list[j], blockType) === tier) {
      j += 1;
    }
    buildObjectiveBandsUniform(list.slice(i, j), maxCols).forEach((band) => out.push(band));
    i = j;
  }
  return out.length
    ? out
    : [{ columns: Array.from({ length: baseCols }, () => []), colsPerBand: baseCols }];
}

/**
 * 把设置面板里的客观题题块规范化为「可直接渲染」的题块对象。
 * @param {Object} block 原始题块
 * @param {Object} context
 * @param {number} context.startNum 无分段时的起始题号
 * @param {string} [context.layoutType]
 * @param {number} [context.columnCount]
 */
export function buildObjectiveRenderBlock(block, context) {
  const blockType = isObjectiveType(block.type) ? block.type : 'objective';
  const segments = Array.isArray(block.segments) && block.segments.length
    ? block.segments.map((seg) => normalizeObjectiveSegment(seg, seg.objectiveType || blockType))
    : [];

  const count = segments.length
    ? segments.reduce((sum, seg) => sum + (seg.endNum - seg.startNum + 1), 0)
    : Math.max(1, Number(block.count) || 1);
  const optionCount = blockType === 'judge'
    ? 2
    : (segments.length
      ? Math.max(2, Number(segments[0].optionCount) || 4)
      : Math.max(2, Number(block.optionCount) || 4));
  const scorePerQuestion = segments.length
    ? Math.max(0.5, Number(segments[0].scorePerQuestion) || 1)
    : Math.max(0.5, Number(block.scorePerQuestion) || 1);

  const questions = buildObjectiveQuestions(
    segments,
    blockType,
    context.startNum,
    count,
    optionCount,
    scorePerQuestion
  );
  const objectiveBands = buildObjectiveBands(questions, blockType, {
    layoutType: context.layoutType,
    columnCount: context.columnCount
  });
  const colsPerBand = objectiveBands.reduce((max, band) => {
    const cols = Number(band.colsPerBand) || (Array.isArray(band.columns) ? band.columns.length : 0);
    return Math.max(max, Math.max(1, cols));
  }, 1);
  const columns = objectiveBands.flatMap((band) => band.columns);

  return {
    ...block,
    type: blockType === 'objective' || segments.length > 1 ? 'objective' : blockType,
    optionLabels: [],
    columnCount: colsPerBand,
    colsPerBand,
    objectiveBands,
    columns,
    scorePerQuestion,
    totalScore: count * scorePerQuestion,
    numbers: questions.map((q) => q.num),
    segments,
    __questionCount: count
  };
}

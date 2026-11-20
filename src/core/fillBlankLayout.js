import {
  CHINESE_COMPOSITION_ROW_HEIGHT_PX,
  CHINESE_PAGE_LAST_ROW_EXTRA_PX,
  FILLBLANK_PAGE_LAST_ROW_EXTRA_PX,
  FILLBLANK_ROW_HEIGHT_PX
} from './constants';

/**
 * 按题号顺序将填空分段展开为「预览行」。
 * 短填：题号范围内每小题再按「每题空数」lineCount 展开，每个空占一格短填（与同分段其它短填一并缓冲），
 * 每行最多 shortItemsPerRow 格（默认 3；如 A3 三栏可为 2）。
 * 长填：lineCount 为每小题行数，每行对应一行预览。
 * @param {string|number} blockId
 * @param {Array<object>} segments 已 normalizeFillBlankSegment 且按 startNum 排好序
 * @param {{ shortItemsPerRow?: number }} [options]
 * @returns {Array<object>} rows 与 FillBlankQuestionType / previewPages 约定一致
 */
export function buildFillBlankRowsFromNormalizedSegments(blockId, segments, options = {}) {
  const rawPerRow = Number(options.shortItemsPerRow);
  const shortItemsPerRow = Number.isFinite(rawPerRow) && rawPerRow >= 1
    ? Math.min(10, Math.floor(rawPerRow))
    : 3;

  const rows = [];
  const shortBuffer = [];

  const flushShortBuffer = () => {
    if (!shortBuffer.length) return;
    const items = shortBuffer.splice(0, shortBuffer.length);
    const nums = items
      .map((i) => (i.blankSlotIndex != null && Number(i.blankSlotsTotal) > 1
        ? `${i.num}-b${i.blankSlotIndex}`
        : String(i.num)))
      .join('-');
    rows.push({
      rowType: 'short',
      items,
      shortSegmented: false,
      paginationHeightPx: FILLBLANK_ROW_HEIGHT_PX,
      measureKey: `${blockId}-short-row-${nums}`
    });
  };

  segments.forEach((segment) => {
    if (segment.fillBlankType === 'short') {
      const blanksPerQuestion = Math.max(1, Number(segment.lineCount) || 1);
      for (let num = segment.startNum; num <= segment.endNum; num += 1) {
        const perBlankScore = blanksPerQuestion > 0
          ? segment.scorePerQuestion / blanksPerQuestion
          : segment.scorePerQuestion;
        for (let blankIdx = 1; blankIdx <= blanksPerQuestion; blankIdx += 1) {
          const item = {
            num,
            lineCount: 1,
            scorePerQuestion: perBlankScore,
            /** 整题分值；渲染时仅在多空末格展示分数 */
            questionScore: segment.scorePerQuestion,
            fillBlankType: segment.fillBlankType,
            blankSlotIndex: blankIdx,
            blankSlotsTotal: blanksPerQuestion
          };
          shortBuffer.push(item);
          if (shortBuffer.length === shortItemsPerRow) {
            flushShortBuffer();
          }
        }
      }
    } else {
      for (let num = segment.startNum; num <= segment.endNum; num += 1) {
        const item = {
          num,
          lineCount: segment.lineCount,
          scorePerQuestion: segment.scorePerQuestion,
          fillBlankType: segment.fillBlankType
        };
        flushShortBuffer();
        const lines = Math.max(1, Number(item.lineCount) || 1);
        for (let lineIdx = 1; lineIdx <= lines; lineIdx += 1) {
          rows.push({
            rowType: 'long-line',
            item,
            lineIdx,
            lineCount: lines,
            paginationHeightPx: FILLBLANK_ROW_HEIGHT_PX,
            measureKey: `${blockId}-long-${num}-l${lineIdx}`
          });
        }
      }
    }
  });
  flushShortBuffer();

  return rows;
}

/** 不含「页末行 +extra」的题干总高（仅行数×默认行高） */
export function sumFillBlankRowsBaseHeightPx(rows) {
  return Math.max(0, rows.length) * FILLBLANK_ROW_HEIGHT_PX;
}

/**
 * 当前行分页占位高度：默认一行 FILLBLANK_ROW_HEIGHT_PX；本页最后一行再 + FILLBLANK_PAGE_LAST_ROW_EXTRA_PX。
 * 放置本行前：若本节还有下一行，应用「仅扣本行基础高」后的剩余去判断能否容纳下一行；
 * 下一行所需最小高度由 nextRowMinNeedPx 给出（本节末行应为 base+extra，否则为 base）。
 *
 * @param {number} remainingPx 扣除本节标题与块间距后、放置本行前的剩余高度
 * @param {number} reservePx 底部预留（与其它题型填空分支一致）
 * @param {boolean} hasNextRow 本节是否还有下一预览行
 * @param {number} [nextRowMinNeedPx] 下一行至少要占的高度（px）；不传则按 base
 * @param {boolean} [isFirstRow] 是否为第一行；首行额外增加 10px 高度
 */
export function computeFillBlankRowNeedPx(remainingPx, reservePx, hasNextRow, nextRowMinNeedPx, isFirstRow = false) {
  const base = FILLBLANK_ROW_HEIGHT_PX;
  const extra = FILLBLANK_PAGE_LAST_ROW_EXTRA_PX;
  
  // 第一行额外增加 10px 高度
  const firstRowExtra = isFirstRow ? 10 : 0;
  
  if (!hasNextRow) {
    return base + extra + firstRowExtra;
  }
  const nextMin =
    nextRowMinNeedPx != null && Number.isFinite(Number(nextRowMinNeedPx))
      ? Math.max(base, Number(nextRowMinNeedPx))
      : base;
  const afterBase = remainingPx - base;
  if (afterBase >= reservePx + nextMin) {
    return base + firstRowExtra;
  }
  return base + extra + firstRowExtra;
}

/** 不含「页末行 +extra」的语文作文题干总行高（仅行数×单行分页基准） */
export function sumChineseCompositionRowsBaseHeightPx(rows) {
  return Math.max(0, rows.length) * CHINESE_COMPOSITION_ROW_HEIGHT_PX;
}

/**
 * 语文作文逐行分页占位：基准一行 CHINESE_COMPOSITION_ROW_HEIGHT_PX；本节末行或本页无法再放下下一行时再 + CHINESE_PAGE_LAST_ROW_EXTRA_PX。
 * 预判下一行最小占位规则见 {@link computeFillBlankRowNeedPx}。
 *
 * @param {number} [nextRowMinNeedPx] 下一行至少要占的高度（px）
 */
export function computeChineseCompositionRowNeedPx(remainingPx, reservePx, hasNextRow, nextRowMinNeedPx) {
  const base = CHINESE_COMPOSITION_ROW_HEIGHT_PX;
  const extra = CHINESE_PAGE_LAST_ROW_EXTRA_PX;
  if (!hasNextRow) {
    return base + extra;
  }
  const nextMin =
    nextRowMinNeedPx != null && Number.isFinite(Number(nextRowMinNeedPx))
      ? Math.max(base, Number(nextRowMinNeedPx))
      : base;
  const afterBase = remainingPx - base;
  if (afterBase >= reservePx + nextMin) {
    return base;
  }
  return base + extra;
}

export function logFillBlankLayoutBuild(blockId, segmentsLen, rows, consoleRef = console, layoutOpts = {}) {
  const baseTotal = sumFillBlankRowsBaseHeightPx(rows);
  const perShortRow = Number(layoutOpts.shortItemsPerRow) || 3;
  consoleRef.log('[填空题排版]', {
    题块id: blockId,
    分段数: segmentsLen,
    预览总行数: rows.length,
    短填每行小题数: perShortRow,
    默认行高_px: FILLBLANK_ROW_HEIGHT_PX,
    页末行附加_px: FILLBLANK_PAGE_LAST_ROW_EXTRA_PX,
    基准总高_px_行数乘默认行高: baseTotal,
    说明: `短填按小题×每题空数展开为格，每行最多${perShortRow}格；长填 lineCount 行；分页时再按页末行 +${FILLBLANK_PAGE_LAST_ROW_EXTRA_PX}px`
  });
}


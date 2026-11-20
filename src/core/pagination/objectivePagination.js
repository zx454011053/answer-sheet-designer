/** 由 ObjectiveQuestionType.vue 抽离的分页推演逻辑（纯函数，无 Vue 运行时依赖） */
import {
  OBJECTIVE_BAND_FIRST_SLICE_TITLE_PX,
  OBJECTIVE_QUESTIONS_PER_COLUMN,
  SECTION_BLOCK_VERTICAL_GAP_PX,
  getObjectiveBandBodyHeightPx
} from '../constants';
import {
  buildObjectiveFirstBandSectionTitleBarLogPayload,
  logSectionTitleBarPaginationConsole
} from '../sectionMetrics';

/**
 * 估算客观题横带单片题区主体高度（像素），不含首横带大题标题条
 * @param {Object} block - 题块数据
 * @param {number} bandIdx - 横带索引
 * @returns {number} 横带主体高度（像素）
 */
export function estimateObjectiveBandSliceBodyHeightPx(block, bandIdx) {
  // 获取横带列表，优先使用 objectiveBands，否则使用 columns
  const bands = Array.isArray(block.objectiveBands) && block.objectiveBands.length
    ? block.objectiveBands
    : [];
  const band =
    bands.length === 0
      ? null
      : bands[Math.min(Math.max(0, bandIdx), bands.length - 1)];

  // 计算每列的题数
  let qPerCol = OBJECTIVE_QUESTIONS_PER_COLUMN;
  if (band && Array.isArray(band.columns) && band.columns.length) {
    const lens = band.columns.map((col) => (Array.isArray(col) ? col.length : 0));
    const maxInBand = Math.max(1, ...lens);
    qPerCol = Math.min(OBJECTIVE_QUESTIONS_PER_COLUMN, maxInBand);
  }

  return getObjectiveBandBodyHeightPx(qPerCol);
}

/**
 * 估算客观题横带单片总高度 = 首片标题 + 主体映射高
 * @param {Object} block - 题块数据
 * @param {number} bandIdx - 横带索引
 * @returns {number} 横带单片总高度（像素）
 */
export function estimateObjectiveBandSliceHeightPx(block, bandIdx) {
  const titlePx = bandIdx === 0 ? OBJECTIVE_BAND_FIRST_SLICE_TITLE_PX : 0;
  return titlePx + estimateObjectiveBandSliceBodyHeightPx(block, bandIdx);
}

/**
 * previewPages：客观横带单片「高度拆分」日志对象
 * @param {Object} block - 题块数据
 * @param {number} bandIdx - 横带索引
 * @param {number} sliceHeightPx - 横带单片总高度
 * @returns {Object} 高度拆分日志对象
 */
export function buildObjectiveBandPaginationHeightSplit(block, bandIdx, sliceHeightPx) {
  const titlePx = bandIdx === 0 ? OBJECTIVE_BAND_FIRST_SLICE_TITLE_PX : 0;
  const bodyPx = estimateObjectiveBandSliceBodyHeightPx(block, bandIdx);
  return {
    大题标题_px: titlePx,
    横带题区主体_px: bodyPx,
    横带单片合计_px: sliceHeightPx,
    公式:
      '横带单片合计 = 大题标题(仅首横带) + getObjectiveBandBodyHeightPx 映射列高；分页不计 OBJECTIVE_BLOCK_CHROME_PX'
  };
}

/**
 * previewPages：客观横带单片放置日志 payload
 * @param {Object} params - 参数对象
 * @param {string} params.blockKey - 题块key
 * @param {string} params.chunkKey - 片段key
 * @param {number} params.pageOneBased - 页码（从1开始）
 * @param {number} params.totalCapPxRounded - 当前页总高度
 * @param {number} params.remAvailableRounded - 剩余可用高度
 * @param {number} params.bandOrdinal - 第几次绘制组件
 * @param {number} params.bandsTotal - 总共绘制组件数
 * @param {number} params.needPxRounded - 本次组件占用高度
 * @param {Object} params.heightSplit - 高度拆分对象
 * @param {number} params.blockNeedPx - 本题块总需求高度
 * @param {number} params.remainingAfterRounded - 放置后剩余高度
 * @returns {Object} 日志payload对象
 */
export function buildObjectivePaginationLogPayload({
  blockKey,
  chunkKey,
  pageOneBased,
  totalCapPxRounded,
  remAvailableRounded,
  bandOrdinal,
  bandsTotal,
  needPxRounded,
  heightSplit,
  blockNeedPx,
  remainingAfterRounded
}) {
  return {
    题块key: blockKey,
    chunkKey,
    页码: pageOneBased,
    当前页总高度_px: totalCapPxRounded,
    剩余可用高度_px: remAvailableRounded,
    第几次绘制组件: bandOrdinal,
    总共绘制组件数: bandsTotal,
    本次组件占用高度_px: needPxRounded,
    高度拆分: heightSplit,
    本题块总需求高度_px: blockNeedPx,
    放置后剩余高度_px: remainingAfterRounded
  };
}

/**
 * previewPages：客观横带单片放置调试日志
 * @param {boolean} enabled - 是否启用调试日志
 * @param {Object} payload - 日志payload对象
 */
export function logObjectivePaginationConsole(enabled, payload) {
  if (!enabled) return;
  console.log('[AnswerSheet A4 客观分页]', payload);
}

/**
 * previewPages：客观题块分页算法（横带切片、A4 剩余高度翻页 / A3 两栏 consume）
 * 将客观题块的横带分配到各个页面中
 * @param {PaginationContext} context - 分页上下文管理器
 * @param {number} sectionGapPx - 题块间距像素值
 * @param {Object} block - 题块数据
 */
export function appendObjectiveQuestionBlockPreviewPagination(context, sectionGapPx, block) {
  // 获取横带列表，优先使用 objectiveBands，否则使用 columns
  const bands = Array.isArray(block.objectiveBands) && block.objectiveBands.length
    ? block.objectiveBands
    : [{ columns: Array.isArray(block.columns) ? block.columns : [] }];

  // 预计算每个横带切片的高度
  const bandSliceHeightsPx = bands.map((_, bandIdx) => estimateObjectiveBandSliceHeightPx(block, bandIdx));

  // 计算整个题块所需总高度（包括间距和所有横带）
  let objectiveBlockNeedHeightPx = sectionGapPx;
  for (let i = 0; i < bands.length; i += 1) {
    objectiveBlockNeedHeightPx += bandSliceHeightsPx[i];
  }
  objectiveBlockNeedHeightPx = Math.round(objectiveBlockNeedHeightPx);

  // 遍历所有横带进行分页处理
  bands.forEach((band, bandIdx) => {
    const colsPerBand = Math.max(
      1,
      Number(band.colsPerBand)
        || Number(block.colsPerBand)
        || Number(block.columnCount)
        || (band.columns && band.columns.length)
        || 1
    );
    const chunkKey = `${block.key}-band-${bandIdx}`;
    const sliceHeightPx = bandSliceHeightsPx[bandIdx];

    // A3双栏模式下的处理逻辑
    if (context.isA3TwoCol) {
      // 计算前导间距（仅在非第一横带且当前栏已使用时需要）
      const leadingGapPx = bandIdx === 0 && context.a3Used[context.a3Ci] > 0
        ? SECTION_BLOCK_VERTICAL_GAP_PX
        : 0;

      // 记录放置前的剩余空间
      const remBefore = bandIdx === 0
        ? context.a3TwoColPeekRemainingBeforeSectionPx(sliceHeightPx)
        : context.a3TwoColPeekRemainingBeforeRawPx(sliceHeightPx);

      // 计算总需要空间
      const needTotalPx = leadingGapPx + sliceHeightPx;

      // 构建高度拆分日志对象
      const heightSplit = buildObjectiveBandPaginationHeightSplit(block, bandIdx, sliceHeightPx);

      // 如果是第一横带，记录标题栏日志
      if (bandIdx === 0) {
        logSectionTitleBarPaginationConsole(context.paginationDebugEnabled(), buildObjectiveFirstBandSectionTitleBarLogPayload({
          blockKey: block.key != null ? block.key : String(block.id),
          chunkKey,
          pageOneBased: context.pageIndex + 1,
          remBeforeRounded: Math.round(remBefore)
        }));
      }

      // 消耗相应空间（第一横带使用特殊方法，其他横带直接消耗）
      if (bandIdx === 0) {
        context.a3TwoColConsumeSectionHeightPx(sliceHeightPx);
      } else {
        context.a3TwoColConsumeRawPx(sliceHeightPx);
      }

      // 确保当前页存在并推送横带到分页系统
      context.addSection({
        ...block,
        objectiveBands: [band],
        colsPerBand,
        columnCount: colsPerBand,
        columns: band.columns.reduce((acc, col) => acc.concat(col), []),
        objectiveBandSliceIndex: bandIdx,
        objectiveBandSliceCount: bands.length,
        isContinuation: bandIdx > 0,
        chunkKey
      });

      // 记录横带分页日志
      const remainingAfter = context.remainingPx;
      logObjectivePaginationConsole(context.paginationDebugEnabled(), buildObjectivePaginationLogPayload({
        blockKey: block.key,
        chunkKey,
        pageOneBased: context.pageIndex + 1,
        totalCapPxRounded: Math.round(context.totalCapPxForLogs()),
        remAvailableRounded: Math.round(remBefore),
        bandOrdinal: bandIdx + 1,
        bandsTotal: bands.length,
        needPxRounded: Math.round(remBefore - remainingAfter),
        heightSplit,
        blockNeedPx: objectiveBlockNeedHeightPx,
        remainingAfterRounded: Math.round(remainingAfter)
      }));

      return;
    }

    // A4非分栏模式下的处理逻辑
    /**
     * 计算客观题横带的前导间距
     * @returns {Object} 包含间距像素值的对象
     */
    const computeObjectiveBandLeadingGaps = () => {
      const priorOnPage = context.hasSectionsOnCurrentPage();
      const afterPreviousBlockGapPx = bandIdx === 0 && priorOnPage
        ? SECTION_BLOCK_VERTICAL_GAP_PX
        : 0;
      return { gapPx: afterPreviousBlockGapPx };
    };

    let { gapPx } = computeObjectiveBandLeadingGaps();
    let needPx = gapPx + sliceHeightPx;

    // 如果所需空间大于剩余空间，则换页
    if (needPx > context.remainingPx) {
      context.pageIndex += 1;
      context.ensurePage();
      context.reloadRemainingForCurrentPage();
      ({ gapPx } = computeObjectiveBandLeadingGaps());
      needPx = gapPx + sliceHeightPx;
    }

    // 构建高度拆分日志对象
    const heightSplit = buildObjectiveBandPaginationHeightSplit(block, bandIdx, sliceHeightPx);

    // 如果是第一横带，记录标题栏日志
    if (bandIdx === 0) {
      logSectionTitleBarPaginationConsole(context.paginationDebugEnabled(), buildObjectiveFirstBandSectionTitleBarLogPayload({
        blockKey: block.key != null ? block.key : String(block.id),
        chunkKey,
        pageOneBased: context.pageIndex + 1,
        remBeforeRounded: Math.round(context.remainingPx)
      }));
    }

    // 记录横带分页日志
    const remainingBefore = context.remainingPx;
    logObjectivePaginationConsole(context.paginationDebugEnabled(), buildObjectivePaginationLogPayload({
      blockKey: block.key,
      chunkKey,
      pageOneBased: context.pageIndex + 1,
      totalCapPxRounded: Math.round(context.totalCapPxForLogs()),
      remAvailableRounded: Math.round(remainingBefore),
      bandOrdinal: bandIdx + 1,
      bandsTotal: bands.length,
      needPxRounded: Math.round(needPx),
      heightSplit,
      blockNeedPx: objectiveBlockNeedHeightPx,
      remainingAfterRounded: Math.round(Math.max(0, remainingBefore - needPx))
    }));

    // 推送横带到分页系统
    context.addSection({
      ...block,
      objectiveBands: [band],
      colsPerBand,
      columnCount: colsPerBand,
      columns: band.columns.reduce((acc, col) => acc.concat(col), []),
      objectiveBandSliceIndex: bandIdx,
      objectiveBandSliceCount: bands.length,
      isContinuation: bandIdx > 0,
      chunkKey
    });

    // 更新剩余空间
    context.remainingPx -= needPx;
  });
}


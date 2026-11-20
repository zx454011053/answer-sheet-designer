/** 由 FillBlankQuestionType.vue 抽离的分页推演逻辑（纯函数，无 Vue 运行时依赖） */
import {
  FILLBLANK_PAGE_LAST_ROW_EXTRA_PX,
  FILLBLANK_ROW_HEIGHT_PX,
  PAGINATION_WEIGHT_UNIT_PX,
  SUBJECTIVE_SECTION_HEADER_PX
} from '../constants';
import {
  buildSubjectiveSectionTitleBarLogPayload,
  getSectionTitleBarPaginationLogSplit,
  logSectionTitleBarPaginationConsole
} from '../sectionMetrics';
import { computeFillBlankRowNeedPx, sumFillBlankRowsBaseHeightPx } from '../fillBlankLayout';

/**
 * 计算填空题单行在分页时的占位高度（像素）
 * @param {Object} row - 行数据对象
 * @param {number} row.paginationHeightPx - 显式指定的分页高度
 * @param {number} row.weight - 行权重
 * @returns {number} 行占位高度（像素）
 */
export function getFillBlankRowPaginationHeightPx(row) {
  // 优先使用显式指定的分页高度
  const v = Number(row.paginationHeightPx);
  if (v > 0) return v;
  
  // 其次使用权重计算高度
  if (row.weight != null && Number(row.weight) > 0) {
    return Math.max(1, Number(row.weight)) * PAGINATION_WEIGHT_UNIT_PX;
  }
  
  // 默认使用标准行高
  return FILLBLANK_ROW_HEIGHT_PX;
}

/**
 * 计算填空大题块整段主体在分页时的占位高度（像素）
 * @param {Object} section - 题块对象
 * @param {Array} section.rows - 行列表
 * @returns {number} 总高度（像素），包括标题栏、所有行基础高度和页末附加
 */
export function getFillBlankSectionPaginationBodyHeightPx(section) {
  const rows = section.rows || [];
  const headerPx =
    section.isContinuation || section.a3SuppressSectionTitle
      ? 0
      : SUBJECTIVE_SECTION_HEADER_PX;
  const tailExtra = rows.length > 0 ? FILLBLANK_PAGE_LAST_ROW_EXTRA_PX : 0;
  return headerPx + sumFillBlankRowsBaseHeightPx(rows) + tailExtra;
}

/**
 * 判断填空题行是否需要附加高度的原因说明
 * @param {boolean} hasNextRow - 是否还有下一行
 * @param {number} extraPx - 附加像素值
 * @returns {string} 原因说明文本
 */
function fillBlankRowPaginationAttachReason(hasNextRow, extraPx) {
  if (!hasNextRow) return '本节最后一预览行：按基础行高+页末附加';
  if (extraPx === 0) {
    return '本节尚有下一预览行，且假定本行仅占基础高后剩余仍 ≥ 底部预留+下一行最小占位（末行含附加）';
  }
  return '本节尚有下一预览行：假定本行仅占基础高后剩余不足以容纳下一行最小占位，本行按本页末行计（基础+页末附加）';
}

/**
 * previewPages：填空逐行「高度拆分」日志对象
 * @param {Object} params - 参数对象
 * @param {Object} params.rowItem - 行数据项
 * @param {Object} params.row - 原始行数据
 * @param {number} params.remainingPx - 放置前剩余像素
 * @param {number} params.reservePx - 底部预留像素
 * @param {boolean} params.hasNextRow - 是否有下一行
 * @param {number|undefined} params.nextRowMinNeedPx - 下一行最小占位像素
 * @param {number} params.needPx - 当前行需要占用的像素
 * @param {boolean} params.isFirstRow - 是否为第一行
 * @returns {Object} 高度拆分日志对象
 */
export function buildFillBlankPaginationRowHeightSplit({
  rowItem,
  row,
  remainingPx,
  reservePx,
  hasNextRow,
  nextRowMinNeedPx,
  needPx,
  isFirstRow
}) {
  const extraPx = Math.max(0, needPx - FILLBLANK_ROW_HEIGHT_PX);
  const split = {
    预览行_measureKey: rowItem.measureKey,
    rowType: row.rowType,
    lineIdx: row.rowType === 'long-line' ? row.lineIdx : undefined,
    基础行高_px: FILLBLANK_ROW_HEIGHT_PX,
    附加占位_px: extraPx,
    附加原因: fillBlankRowPaginationAttachReason(hasNextRow, extraPx),
    是否有下一预览行: hasNextRow,
    预判下一行最小占位_px: hasNextRow ? Math.round(nextRowMinNeedPx) : undefined,
    computeFillBlankRowNeedPx_入参: {
      放置前剩余_px: Math.round(remainingPx),
      底部预留_px: Math.round(reservePx),
      是否有下一预览行: hasNextRow,
      预判下一行最小占位_px: hasNextRow ? Math.round(nextRowMinNeedPx) : undefined
    },
    公式:
      '先假定本行仅占基础高，若剩余 < 底部预留+下一行最小占位则本行按页末行（基础+附加）；下一行为本节末行时最小占位含附加'
  };
  if (isFirstRow) {
    split.本行循环前已扣 = {
      大题标题栏_px: SUBJECTIVE_SECTION_HEADER_PX,
      ...getSectionTitleBarPaginationLogSplit()
    };
  }
  return split;
}

/**
 * previewPages：填空逐行日志 payload
 * @param {Object} params - 参数对象
 * @param {string} params.blockKey - 题块key
 * @param {string} params.chunkKey - 片段key
 * @param {boolean} params.chunkContinuation - 是否为续接片段
 * @param {number} params.pageOneBased - 页码（从1开始）
 * @param {number} params.totalCapPxRounded - 当前页总高度
 * @param {number} params.remainingPxRounded - 剩余可用高度
 * @param {number} params.rowOrdinal - 第几次绘制组件
 * @param {number} params.rowsTotal - 总共绘制组件数
 * @param {number} params.needPxRounded - 本次组件占用高度
 * @param {Object} params.heightSplit - 高度拆分对象
 * @param {number} params.blockNeedPx - 本题块总需求高度
 * @param {number} params.remainingAfterRounded - 放置后剩余高度
 * @returns {Object} 日志payload对象
 */
export function buildFillBlankPaginationRowLogPayload({
  blockKey,
  chunkKey,
  chunkContinuation,
  pageOneBased,
  totalCapPxRounded,
  remainingPxRounded,
  rowOrdinal,
  rowsTotal,
  needPxRounded,
  heightSplit,
  blockNeedPx,
  remainingAfterRounded
}) {
  return {
    题型: '填空题',
    题块key: blockKey,
    chunkKey,
    chunk续页: chunkContinuation,
    页码: pageOneBased,
    当前页总高度_px: totalCapPxRounded,
    剩余可用高度_px: remainingPxRounded,
    第几次绘制组件: rowOrdinal,
    总共绘制组件数: rowsTotal,
    本次组件占用高度_px: needPxRounded,
    高度拆分: heightSplit,
    本题块总需求高度_px: blockNeedPx,
    放置后剩余高度_px: remainingAfterRounded
  };
}

/**
 * previewPages：填空逐行推演日志（payload.题型 为「填空题」）
 * @param {boolean} enabled - 是否启用调试日志
 * @param {Object} payload - 日志payload对象
 */
export function logFillBlankPaginationConsole(enabled, payload) {
  if (!enabled) return;
  console.log('[AnswerSheet A4 填空分页]', payload);
}

/**
 * previewPages：填空题块分页算法
 * 将填空题块的行分配到各个页面中，考虑页末附加高度和续页逻辑
 * @param {PaginationContext} context - 分页上下文管理器
 * @param {number} sectionGapPx - 题块间距像素值
 * @param {Object} block - 题块数据
 * @param {Object} viewer - 视图构建器对象
 */
export function appendFillBlankQuestionBlockPreviewPagination(context, sectionGapPx, block, viewer) {
  // 构建填空题块的渲染数据
  const section = viewer.buildFillBlankSectionRender(block);
  
  // 计算填空题块主体高度（不含间距）
  const fillBlankSectionBodyPx = getFillBlankSectionPaginationBodyHeightPx(section);
  
  // 计算整个题块所需总高度（包括间距）
  const fillBlankBlockNeedHeightPx = Math.round(sectionGapPx + fillBlankSectionBodyPx);
  
  // 填空题行预留空间函数（当前返回0，表示不预留）
  const fillBlankRowReservePx = () => 0;
  // 初始化当前页的题块片段（chunk）
  let chunk = {
    ...section,
    rows: [],           // 当前页包含的行列表
    isContinuation: false, // 是否为续接页
    chunkKey: `${section.id}-0` // 片段唯一标识
  };
  let chunkIndex = 0; // 片段索引计数器
  
  /**
   * 将当前片段推送到分页系统中
   * 如果当前片段没有行则不推送
   */
  const pushChunk = () => {
    if (!chunk.rows.length) return;
    context.addSection({
      ...chunk,
      chunkKey: `${section.id}-${chunkIndex}`
    });
    chunkIndex += 1;
  };

  // A3双栏模式下的初始检查：如果当前栏无法容纳标题栏和预留空间，则换页
  if (context.isA3TwoCol) {
    if (
      chunk.rows.length === 0
      && !context.a3TwoColCanFitSectionPx(SUBJECTIVE_SECTION_HEADER_PX + fillBlankRowReservePx())
    ) {
      context.pageIndex += 1;
      context.ensurePage();
      context.reloadRemainingForCurrentPage();
    }
  } else if (
    // 非A3模式下：如果剩余空间不足以容纳标题栏、间距和预留空间，且当前片段为空，则换页
    context.remainingPx < (SUBJECTIVE_SECTION_HEADER_PX + sectionGapPx + fillBlankRowReservePx())
    && chunk.rows.length === 0
  ) {
    context.pageIndex += 1;
    context.ensurePage();
    context.reloadRemainingForCurrentPage();
  }
  // 处理大题标题栏的空间占用
  {
    const beforeHdr = context.isA3TwoCol
      ? context.a3TwoColPeekRemainingBeforeSectionPx(SUBJECTIVE_SECTION_HEADER_PX)
      : context.remainingPx;
    
    // 注意：SUBJECTIVE_SECTION_HEADER_PX (45px) 已包含 padding-top，不额外扣除间距
    if (context.isA3TwoCol) {
      context.a3TwoColConsumeSectionHeightPx(SUBJECTIVE_SECTION_HEADER_PX, { skipLeadingBlockGap: false });
    } else {
      context.remainingPx -= SUBJECTIVE_SECTION_HEADER_PX;
    }
    logSectionTitleBarPaginationConsole(context.paginationDebugEnabled(), buildSubjectiveSectionTitleBarLogPayload({
      blockKey: block.key != null ? block.key : String(block.id),
      sectionType: 'fillblank',
      chunkContinuation: chunk.isContinuation,
      pageOneBased: context.pageIndex + 1,
      leadingBlockGapPx: sectionGapPx,
      beforeHdrRounded: Math.round(beforeHdr),
      afterHdrRounded: Math.round(context.remainingPx)
    }));
  }

  // 遍历所有行进行分页处理
  section.rows.forEach((row, rowIdx) => {
    // 创建行数据项，包含测量键用于追踪
    const rowItem = {
      ...row,
      measureKey: row.measureKey || `${section.id}-fillblank-row-${rowIdx}`
    };
    
    // 如果是续接页的第一行且是长线类型，标记为续接引导行
    if (row.rowType === 'long-line' && chunk.isContinuation && chunk.rows.length === 0 && row.lineIdx > 1) {
      rowItem.continuationLead = true;
    }
    
    // 获取预留空间（当前为0）
    const reservePx = fillBlankRowReservePx();
    
    // 判断是否还有下一行
    const hasNextRow = rowIdx < section.rows.length - 1;
    
    // 预判下一行的最小占位高度
    const nextRowMinNeedPx = hasNextRow
      ? (rowIdx === section.rows.length - 2
        ? FILLBLANK_ROW_HEIGHT_PX + FILLBLANK_PAGE_LAST_ROW_EXTRA_PX
        : FILLBLANK_ROW_HEIGHT_PX)
      : undefined;
      
    // 计算当前行需要占用的像素高度（考虑页末附加逻辑）
    const needPx = computeFillBlankRowNeedPx(context.remainingPx, reservePx, hasNextRow, nextRowMinNeedPx, rowIdx === 0);
    const chunkKey = `${section.id}-${chunkIndex}`;
    
    // 构建行高度拆分日志对象
    const rowHeightSplit = buildFillBlankPaginationRowHeightSplit({
      rowItem,
      row,
      remainingPx: context.remainingPx,
      reservePx,
      hasNextRow,
      nextRowMinNeedPx,
      needPx,
      isFirstRow: rowIdx === 0
    });
    
    // 记录行分页日志
    const remainingBefore = context.remainingPx;
    logFillBlankPaginationConsole(context.paginationDebugEnabled(), buildFillBlankPaginationRowLogPayload({
      blockKey: block.key != null ? block.key : String(block.id),
      chunkKey,
      chunkContinuation: chunk.isContinuation,
      pageOneBased: context.pageIndex + 1,
      totalCapPxRounded: Math.round(context.totalCapPxForLogs()),
      remainingPxRounded: Math.round(remainingBefore),
      rowOrdinal: rowIdx + 1,
      rowsTotal: section.rows.length,
      needPxRounded: Math.round(remainingBefore - Math.max(0, remainingBefore - needPx)),
      heightSplit: rowHeightSplit,
      blockNeedPx: fillBlankBlockNeedHeightPx,
      remainingAfterRounded: Math.round(Math.max(0, remainingBefore - needPx))
    }));
    
    // 计算可用剩余空间
    const usableRemainingPx = Math.max(0, context.remainingPx - reservePx);
    
    // 如果所需空间大于可用空间，则需要换页
    if (needPx > usableRemainingPx) {
      const continuingAfterSlice = chunk.rows.length > 0;
      
      // 如果当前片段已有行，先推送当前片段
      if (continuingAfterSlice) {
        pushChunk();
      }
      
      // 如果不是A3双栏模式，移动到下一页
      if (!context.isA3TwoCol) {
        context.pageIndex += 1;
        context.ensurePage();
        context.reloadRemainingForCurrentPage();
      }
      
      // 创建新的片段
      chunk = {
        ...section,
        rows: [],
        isContinuation: continuingAfterSlice
      };
    }
    
    // 将当前行添加到片段中
    chunk.rows.push(rowItem);
    
    // 消耗相应空间
    if (context.isA3TwoCol) {
      const pageBeforeRow = context.pageIndex;
      const colBeforeRow = context.a3Ci;
      context.a3TwoColConsumeRawPx(needPx);
      if (
        pageBeforeRow === context.pageIndex
        && colBeforeRow === 0
        && context.a3Ci === 1
        && chunk.rows.length > 1
      ) {
        const tailRow = chunk.rows.pop();
        pushChunk();
        chunk = {
          ...section,
          rows: [tailRow],
          isContinuation: true
        };
      }
    } else {
      context.remainingPx -= needPx;
    }
    
    // 如果不是A3双栏模式且剩余空间不足，强制换页
    if (!context.isA3TwoCol && context.remainingPx <= fillBlankRowReservePx()) {
      pushChunk();
      context.pageIndex += 1;
      context.ensurePage();
      context.reloadRemainingForCurrentPage();
      chunk = {
        ...section,
        rows: [],
        isContinuation: true
      };
    }
  });
  
  // 推送最后一个片段到分页系统
  pushChunk();
}


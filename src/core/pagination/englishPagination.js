/** 由 EnglishQuestionType.vue 抽离的分页推演逻辑（纯函数，无 Vue 运行时依赖） */
import {
  FILLBLANK_PAGE_LAST_ROW_EXTRA_PX,
  FILLBLANK_ROW_HEIGHT_PX,
  SUBJECTIVE_SECTION_HEADER_PX
} from '../constants';
import {
  buildSubjectiveSectionTitleBarLogPayload,
  getSectionTitleBarPaginationLogSplit,
  logSectionTitleBarPaginationConsole
} from '../sectionMetrics';
import { computeFillBlankRowNeedPx } from '../fillBlankLayout';

/**
 * 计算英语作文题块在分页时的主体占位高度（像素）
 * @param {Object} section - 题块对象
 * @param {Array} section.lines - 作文行列表
 * @returns {number} 总高度（像素），包括标题栏、所有行和页末附加高度
 */
export function getEnglishSectionPaginationBodyHeightPx(section) {
  const lines = section.lines || [];
  const headerPx =
    section.isContinuation || section.a3SuppressSectionTitle
      ? 0
      : SUBJECTIVE_SECTION_HEADER_PX;
  const linesPx = lines.length * FILLBLANK_ROW_HEIGHT_PX;
  const tailExtra = lines.length > 0 ? FILLBLANK_PAGE_LAST_ROW_EXTRA_PX : 0;
  return headerPx + linesPx + tailExtra;
}

/**
 * 判断英语作文行是否需要附加高度的原因说明
 * @param {boolean} hasNextRow - 是否还有下一行
 * @param {number} extraPx - 附加像素值
 * @returns {string} 原因说明文本
 */
function englishRowPaginationAttachReason(hasNextRow, extraPx) {
  if (!hasNextRow) return '本节最后一预览行：按基础行高+页末附加';
  if (extraPx === 0) {
    return '本节尚有下一预览行，且假定本行仅占基础高后剩余仍 ≥ 底部预留+下一行最小占位（末行含附加）';
  }
  return '本节尚有下一预览行：假定本行仅占基础高后剩余不足以容纳下一行最小占位，本行按本页末行计（基础+页末附加）';
}

/**
 * previewPages：英语作文逐行「高度拆分」日志对象
 * @param {Object} params - 参数对象
 * @param {Object} params.lineItem - 行数据项
 * @param {number} params.remainingPx - 放置前剩余像素
 * @param {number} params.reservePx - 底部预留像素
 * @param {boolean} params.hasNextRow - 是否有下一行
 * @param {number|undefined} params.nextRowMinNeedPx - 下一行最小占位像素
 * @param {number} params.needPx - 当前行需要占用的像素
 * @param {boolean} params.isFirstRow - 是否为第一行
 * @returns {Object} 高度拆分日志对象
 */
export function buildEnglishPaginationRowHeightSplit({
  lineItem,
  remainingPx,
  reservePx,
  hasNextRow,
  nextRowMinNeedPx,
  needPx,
  isFirstRow
}) {
  const extraPx = Math.max(0, needPx - FILLBLANK_ROW_HEIGHT_PX);
  const split = {
    预览行_measureKey: lineItem.measureKey,
    rowType: lineItem.rowType,
    基础行高_px: FILLBLANK_ROW_HEIGHT_PX,
    附加占位_px: extraPx,
    附加原因: englishRowPaginationAttachReason(hasNextRow, extraPx),
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
 * previewPages：英语作文逐行日志 payload
 * @param {Object} params - 参数对象
 * @param {string} params.blockKey - 题块key
 * @param {string} params.chunkKey - 片段key
 * @param {boolean} params.chunkContinuation - 是否为续接片段
 * @param {number} params.pageOneBased - 页码（从1开始）
 * @param {number} params.totalCapPxRounded - 当前页总高度
 * @param {number} params.remainingPxRounded - 剩余可用高度
 * @param {number} params.rowOrdinal - 第几次绘制组件
 * @param {number} params.linesTotal - 总共绘制组件数
 * @param {number} params.needPxRounded - 本次组件占用高度
 * @param {Object} params.heightSplit - 高度拆分对象
 * @param {number} params.blockNeedPx - 本题块总需求高度
 * @param {number} params.remainingAfterRounded - 放置后剩余高度
 * @returns {Object} 日志payload对象
 */
export function buildEnglishPaginationRowLogPayload({
  blockKey,
  chunkKey,
  chunkContinuation,
  pageOneBased,
  totalCapPxRounded,
  remainingPxRounded,
  rowOrdinal,
  linesTotal,
  needPxRounded,
  heightSplit,
  blockNeedPx,
  remainingAfterRounded
}) {
  return {
    题型: '英语作文',
    题块key: blockKey,
    chunkKey,
    chunk续页: chunkContinuation,
    页码: pageOneBased,
    当前页总高度_px: totalCapPxRounded,
    剩余可用高度_px: remainingPxRounded,
    第几次绘制组件: rowOrdinal,
    总共绘制组件数: linesTotal,
    本次组件占用高度_px: needPxRounded,
    高度拆分: heightSplit,
    本题块总需求高度_px: blockNeedPx,
    放置后剩余高度_px: remainingAfterRounded
  };
}

/**
 * previewPages：英语作文逐行推演日志（与填空逐行共用控制台前缀；payload.题型 为「英语作文」）
 * @param {boolean} enabled - 是否启用调试日志
 * @param {Object} payload - 日志payload对象
 */
export function logEnglishPaginationConsole(enabled, payload) {
  if (!enabled) return;
  console.log('[AnswerSheet A4 填空分页]', payload);
}

/**
 * previewPages：英语作文块分页算法
 * 将英语作文题块的行分配到各个页面中，考虑页末附加高度和续页逻辑
 * @param {PaginationContext} context - 分页上下文管理器
 * @param {number} sectionGapPx - 题块间距像素值
 * @param {Object} block - 题块数据
 * @param {Object} viewer - 视图构建器对象
 */
export function appendEnglishQuestionBlockPreviewPagination(context, sectionGapPx, block, viewer) {
  // 构建英语作文题块的渲染数据
  const section = viewer.buildEnglishSectionRender(block);
  
  // 计算英语作文题块主体高度（不含间距）
  const englishSectionBodyPx = getEnglishSectionPaginationBodyHeightPx(section);
  
  // 计算整个题块所需总高度（包括间距）
  const englishBlockNeedHeightPx = Math.round(sectionGapPx + englishSectionBodyPx);
  
  // 英语作文行预留空间函数（当前返回0，表示不预留）
  const englishRowReservePx = () => 0;
  // 初始化当前页的题块片段（chunk）
  let chunk = {
    ...section,
    lines: [],           // 当前页包含的行列表
    isContinuation: false, // 是否为续接页
    chunkKey: `${section.id}-0` // 片段唯一标识
  };
  let chunkIndex = 0; // 片段索引计数器
  
  /**
   * 将当前片段推送到分页系统中
   * 如果当前片段没有行则不推送
   */
  const pushChunk = () => {
    if (!chunk.lines.length) return;
    context.addSection({
      ...chunk,
      chunkKey: `${section.id}-${chunkIndex}`
    });
    chunkIndex += 1;
  };
  // A3双栏模式下的初始检查：如果当前栏无法容纳标题栏和预留空间，则换页
  if (context.isA3TwoCol) {
    if (
      chunk.lines.length === 0
      && !context.a3TwoColCanFitSectionPx(SUBJECTIVE_SECTION_HEADER_PX + englishRowReservePx())
    ) {
      context.pageIndex += 1;
      context.ensurePage();
      context.reloadRemainingForCurrentPage();
    }
  } else if (
    // 非A3模式下：如果剩余空间不足以容纳标题栏、间距和预留空间，且当前片段为空，则换页
    context.remainingPx < (SUBJECTIVE_SECTION_HEADER_PX + sectionGapPx + englishRowReservePx())
    && chunk.lines.length === 0
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
      sectionType: 'english',
      chunkContinuation: chunk.isContinuation,
      pageOneBased: context.pageIndex + 1,
      leadingBlockGapPx: sectionGapPx,
      beforeHdrRounded: Math.round(beforeHdr),
      afterHdrRounded: Math.round(context.remainingPx)
    }));
  }
  // 遍历所有行进行分页处理
  section.lines.forEach((line, rowIdx) => {
    // 创建行数据项，包含测量键用于追踪
    const lineItem = {
      ...line,
      measureKey: line.measureKey || `${section.id}-english-${rowIdx}`
    };
    
    // 获取预留空间（当前为0）
    const reservePx = englishRowReservePx();
    
    // 判断是否还有下一行
    const hasNextRow = rowIdx < section.lines.length - 1;
    
    // 预判下一行的最小占位高度
    const nextRowMinNeedPx = hasNextRow
      ? (rowIdx === section.lines.length - 2
        ? FILLBLANK_ROW_HEIGHT_PX + FILLBLANK_PAGE_LAST_ROW_EXTRA_PX
        : FILLBLANK_ROW_HEIGHT_PX)
      : undefined;
      
    // 计算当前行需要占用的像素高度（考虑页末附加逻辑）
    const needPx = computeFillBlankRowNeedPx(context.remainingPx, reservePx, hasNextRow, nextRowMinNeedPx, rowIdx === 0);
    const chunkKey = `${section.id}-${chunkIndex}`;
    
    // 构建行高度拆分日志对象
    const rowHeightSplit = buildEnglishPaginationRowHeightSplit({
      lineItem,
      remainingPx: context.remainingPx,
      reservePx,
      hasNextRow,
      nextRowMinNeedPx,
      needPx,
      isFirstRow: rowIdx === 0
    });
    
    // 记录行分页日志
    const remainingBefore = context.remainingPx;
    logEnglishPaginationConsole(context.paginationDebugEnabled(), buildEnglishPaginationRowLogPayload({
      blockKey: block.key != null ? block.key : String(block.id),
      chunkKey,
      chunkContinuation: chunk.isContinuation,
      pageOneBased: context.pageIndex + 1,
      totalCapPxRounded: Math.round(context.totalCapPxForLogs()),
      remainingPxRounded: Math.round(remainingBefore),
      rowOrdinal: rowIdx + 1,
      linesTotal: section.lines.length,
      needPxRounded: Math.round(remainingBefore - Math.max(0, remainingBefore - needPx)),
      heightSplit: rowHeightSplit,
      blockNeedPx: englishBlockNeedHeightPx,
      remainingAfterRounded: Math.round(Math.max(0, remainingBefore - needPx))
    }));
    
    // 计算可用剩余空间
    const usableRemainingPx = Math.max(0, context.remainingPx - reservePx);
    
    // 如果所需空间大于可用空间，则需要换页
    if (needPx > usableRemainingPx) {
      const continuingAfterSlice = chunk.lines.length > 0;
      
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
        lines: [],
        isContinuation: continuingAfterSlice
      };
    }
    
    // 将当前行添加到片段中
    chunk.lines.push(lineItem);
    
    // 消耗相应空间
    if (context.isA3TwoCol) {
      const pageBeforeRow = context.pageIndex;
      const colBeforeRow = context.a3Ci;
      context.a3TwoColConsumeRawPx(needPx);
      if (
        pageBeforeRow === context.pageIndex
        && colBeforeRow === 0
        && context.a3Ci === 1
        && chunk.lines.length > 1
      ) {
        const tailLine = chunk.lines.pop();
        pushChunk();
        chunk = {
          ...section,
          lines: [tailLine],
          isContinuation: true
        };
      }
    } else {
      context.remainingPx -= needPx;
    }
    
    // 如果不是A3双栏模式且剩余空间不足，强制换页
    if (!context.isA3TwoCol && context.remainingPx <= englishRowReservePx()) {
      pushChunk();
      context.pageIndex += 1;
      context.ensurePage();
      context.reloadRemainingForCurrentPage();
      chunk = {
        ...section,
        lines: [],
        isContinuation: true
      };
    }
  });
  
  // 推送最后一个片段到分页系统
  pushChunk();
}


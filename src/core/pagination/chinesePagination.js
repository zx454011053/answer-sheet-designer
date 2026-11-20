/** 由 ChineseQuestionType.vue 抽离的分页推演逻辑（纯函数，无 Vue 运行时依赖） */
import {
  CHINESE_COMPOSITION_ROW_HEIGHT_PX,
  CHINESE_PAGE_LAST_ROW_EXTRA_PX,
  SECTION_BLOCK_VERTICAL_GAP_PX,
  SUBJECTIVE_SECTION_HEADER_PX
} from '../constants';
import {
  buildSubjectiveSectionTitleBarLogPayload,
  getSectionTitleBarPaginationLogSplit,
  logSectionTitleBarPaginationConsole
} from '../sectionMetrics';
import { computeChineseCompositionRowNeedPx } from '../fillBlankLayout';

/**
 * 计算语文作文题块在分页时的主体占位高度（像素）
 * @param {Object} section - 题块对象
 * @param {Array} section.rows - 作文行数列表
 * @returns {number} 总高度（像素），包括标题栏、所有行和页末附加高度
 */
export function getChineseSectionPaginationBodyHeightPx(section) {
  const rows = section.rows || [];
  const headerPx =
    section.isContinuation || section.a3SuppressSectionTitle
      ? 0
      : SUBJECTIVE_SECTION_HEADER_PX;
  const rowsPx = rows.length * CHINESE_COMPOSITION_ROW_HEIGHT_PX;
  const tailExtra = rows.length > 0 ? CHINESE_PAGE_LAST_ROW_EXTRA_PX : 0;
  return headerPx + rowsPx + tailExtra;
}

/**
 * A3 多栏：语文 fragment 内单行的账本增量（px）
 *
 * 必须与 `getChineseSectionPaginationBodyHeightPx`（分栏器 splitA3Multicol 用的整块公式）逐像素对齐：
 * 整块高度 = 标题栏 + 行数 × 行高 + 页末附加 8。
 * 因此把「页末附加」记到 fragment 首行，fragment 内其余行只记基础行高；
 * 续接 fragment 若落在已有内容的栏，还要补一个题块间距（分栏器对 section 之间加 gap）。
 *
 * @param {Object} params
 * @param {boolean} params.isChunkFirstRow - 是否为本 fragment 的首行
 * @param {boolean} params.chunkIsContinuation - 本 fragment 是否为续接块（无标题栏）
 * @param {number} params.columnUsedPx - 目标栏已用高度
 * @returns {number} 账本增量（px）
 */
export function getChineseA3ChunkRowLedgerDeltaPx({ isChunkFirstRow, chunkIsContinuation, columnUsedPx }) {
  let px = CHINESE_COMPOSITION_ROW_HEIGHT_PX;
  if (!isChunkFirstRow) return px;
  px += CHINESE_PAGE_LAST_ROW_EXTRA_PX;
  if (chunkIsContinuation && columnUsedPx > 0) {
    px += SECTION_BLOCK_VERTICAL_GAP_PX;
  }
  return px;
}

/**
 * 判断语文作文行是否需要附加高度的原因说明
 * @param {boolean} hasNextRow - 是否还有下一行
 * @param {number} extraPx - 附加像素值
 * @returns {string} 原因说明文本
 */
function chineseRowPaginationAttachReason(hasNextRow, extraPx) {
  if (!hasNextRow) return '本节最后一预览行：按基础行高+页末附加';
  if (extraPx === 0) {
    return '本节尚有下一预览行，且假定本行仅占基础高后剩余仍 ≥ 底部预留+下一行最小占位（末行含附加）';
  }
  return '本节尚有下一预览行：假定本行仅占基础高后剩余不足以容纳下一行最小占位，本行按本页末行计（基础+页末附加）';
}

/**
 * previewPages：语文作文逐行「高度拆分」日志对象
 * @param {Object} params - 参数对象
 * @param {Object} params.rowItem - 行数据项
 * @param {number} params.remainingPx - 放置前剩余像素
 * @param {number} params.reservePx - 底部预留像素
 * @param {boolean} params.hasNextRow - 是否有下一行
 * @param {number|undefined} params.nextRowMinNeedPx - 下一行最小占位像素
 * @param {number} params.needPx - 当前行需要占用的像素
 * @param {boolean} params.isFirstRow - 是否为第一行
 * @returns {Object} 高度拆分日志对象
 */
export function buildChinesePaginationRowHeightSplit({
  rowItem,
  remainingPx,
  reservePx,
  hasNextRow,
  nextRowMinNeedPx,
  needPx,
  isFirstRow
}) {
  const extraPx = Math.max(0, needPx - CHINESE_COMPOSITION_ROW_HEIGHT_PX);
  const split = {
    预览行_measureKey: rowItem.measureKey,
    rowIndex: rowItem.index,
    基础行高_px: CHINESE_COMPOSITION_ROW_HEIGHT_PX,
    附加占位_px: extraPx,
    附加原因: chineseRowPaginationAttachReason(hasNextRow, extraPx),
    是否有下一预览行: hasNextRow,
    预判下一行最小占位_px: hasNextRow ? Math.round(nextRowMinNeedPx) : undefined,
    computeChineseCompositionRowNeedPx_入参: {
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
 * previewPages：语文作文逐行日志 payload
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
export function buildChinesePaginationRowLogPayload({
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
    题型: '语文作文',
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
 * previewPages：语文作文逐行推演日志（与填空逐行共用控制台前缀；payload.题型 为「语文作文」）
 * @param {boolean} enabled - 是否启用调试日志
 * @param {Object} payload - 日志payload对象
 */
export function logChinesePaginationConsole(enabled, payload) {
  if (!enabled) return;
  console.log('[AnswerSheet A4 填空分页]', payload);
}

/**
 * previewPages：语文作文块分页算法
 * 将语文作文题块的行分配到各个页面中，考虑页末附加高度和续页逻辑
 * @param {PaginationContext} context - 分页上下文管理器
 * @param {number} sectionGapPx - 题块间距像素值
 * @param {Object} block - 题块数据
 * @param {Object} viewer - 视图构建器对象
 */
export function appendChineseQuestionBlockPreviewPagination(context, sectionGapPx, block, viewer) {
  // 构建语文作文题块的渲染数据
  const section = viewer.buildChineseSectionRender(block);

  // 计算语文作文题块主体高度（不含间距）
  const chineseSectionBodyPx = getChineseSectionPaginationBodyHeightPx(section);

  // 计算整个题块所需总高度（包括间距）
  const chineseBlockNeedHeightPx = Math.round(sectionGapPx + chineseSectionBodyPx);

  // 语文作文行预留空间函数（当前返回0，表示不预留）
  const chineseRowReservePx = () => 0;
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
      && !context.a3TwoColCanFitSectionPx(SUBJECTIVE_SECTION_HEADER_PX + chineseRowReservePx())
    ) {
      context.pageIndex += 1;
      context.ensurePage();
      context.reloadRemainingForCurrentPage();
    }
  } else if (
    // 非A3模式下：如果剩余空间不足以容纳标题栏、间距和预留空间，且当前片段为空，则换页
    context.remainingPx < (SUBJECTIVE_SECTION_HEADER_PX + sectionGapPx + chineseRowReservePx())
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
      /*
       * 标题栏必须与首行同栏：否则标题栏记在上一栏、行全落在下一栏，
       * 渲染层（fix 后）按整块摆放，账本与分栏结果会差出整块高度，末栏被塞爆。
       */
      context.a3TwoColEnsureColumnRoomForPx(
        SUBJECTIVE_SECTION_HEADER_PX + CHINESE_COMPOSITION_ROW_HEIGHT_PX + CHINESE_PAGE_LAST_ROW_EXTRA_PX
      );
      context.a3TwoColConsumeSectionHeightPx(SUBJECTIVE_SECTION_HEADER_PX, { skipLeadingBlockGap: false });
    } else {
      context.remainingPx -= SUBJECTIVE_SECTION_HEADER_PX;
    }
    logSectionTitleBarPaginationConsole(context.paginationDebugEnabled(), buildSubjectiveSectionTitleBarLogPayload({
      blockKey: block.key != null ? block.key : String(block.id),
      sectionType: 'chinese',
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
      measureKey: row.measureKey || `${section.id}-chinese-row-${row.index}`
    };

    // 获取预留空间（当前为0）
    const reservePx = chineseRowReservePx();

    // 判断是否还有下一行
    const hasNextRow = rowIdx < section.rows.length - 1;

    // 预判下一行的最小占位高度
    const nextRowMinNeedPx = hasNextRow
      ? (rowIdx === section.rows.length - 2
        ? CHINESE_COMPOSITION_ROW_HEIGHT_PX + CHINESE_PAGE_LAST_ROW_EXTRA_PX
        : CHINESE_COMPOSITION_ROW_HEIGHT_PX)
      : undefined;

    // 计算当前行需要占用的像素高度
    // A3 多栏：按 fragment 整块公式记账（含页末附加与题块间距），与分栏器逐像素一致
    const needPx = context.isA3TwoCol
      ? getChineseA3ChunkRowLedgerDeltaPx({
        isChunkFirstRow: chunk.rows.length === 0,
        chunkIsContinuation: chunk.isContinuation,
        columnUsedPx: context.a3Used[context.a3Ci]
      })
      : computeChineseCompositionRowNeedPx(
        context.remainingPx,
        reservePx,
        hasNextRow,
        nextRowMinNeedPx
      );
    const chunkKey = `${section.id}-${chunkIndex}`;

    // 构建行高度拆分日志对象
    const rowHeightSplit = buildChinesePaginationRowHeightSplit({
      rowItem,
      remainingPx: context.remainingPx,
      reservePx,
      hasNextRow,
      nextRowMinNeedPx,
      needPx,
      isFirstRow: rowIdx === 0
    });

    // 记录行分页日志
    const remainingBefore = context.remainingPx;
    logChinesePaginationConsole(context.paginationDebugEnabled(), buildChinesePaginationRowLogPayload({
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
      blockNeedPx: chineseBlockNeedHeightPx,
      remainingAfterRounded: Math.round(Math.max(0, remainingBefore - needPx))
    }));

    // 计算可用剩余空间
    const usableRemainingPx = Math.max(0, context.remainingPx - reservePx);

    // 如果所需空间大于可用空间，则需要换页
    if (needPx > usableRemainingPx) {
      const continuingAfterSlice = chunk.rows.length > 0;

      if (continuingAfterSlice) {
        // 当前片段已有行，先 push 落库，再开续接片段
        pushChunk();

        if (!context.isA3TwoCol) {
          context.pageIndex += 1;
          context.ensurePage();
          context.reloadRemainingForCurrentPage();
        }

        chunk = {
          ...section,
          rows: [],
          isContinuation: true
        };
      } else if (!context.isA3TwoCol) {
        // 空片段且本页放不下：换页后仍作为本题的首片段（保留标题栏）
        context.pageIndex += 1;
        context.ensurePage();
        context.reloadRemainingForCurrentPage();
        chunk = {
          ...section,
          rows: [],
          isContinuation: false
        };
      }
      /*
       * A3 多栏 + 空片段：不在这里动页码/栏游标。
       * 该行的 a3TwoColConsumeRawPx 会自行跨栏（栏满则换页），
       * 若在此重置片段会把 isContinuation 清成 false，导致续页重复渲染大题标题。
       */
    }

    // 将当前行添加到片段中
    chunk.rows.push(rowItem);

    // 消耗相应空间
    if (context.isA3TwoCol) {
      const pageBeforeRow = context.pageIndex;
      const colBeforeRow = context.a3Ci;
      context.a3TwoColConsumeRawPx(needPx);
      /*
       * A3 两栏：从左栏刚换到右栏时 remainingPx 会变大，不会触发 needPx > usableRemainingPx，
       * 若不拆 chunk，split 会用「整块」高度判断，整题被塞进右栏导致左栏空白（含续页首栏）。
       */
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
    if (!context.isA3TwoCol && context.remainingPx <= chineseRowReservePx()) {
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


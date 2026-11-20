/** 由 AnswerQuestionType.vue 抽离的分页推演逻辑（纯函数，无 Vue 运行时依赖） */
import {
  ANSWER_MIN_ITEM_BODY_PX,
  ANSWER_PAGINATION_EXTRA_PX,
  ANSWER_CONTINUATION_EXTRA_PX,
  SUBJECTIVE_SECTION_HEADER_PX,
  PAGINATION_WEIGHT_UNIT_PX
} from '../constants';
import {
  buildSubjectiveSectionTitleBarLogPayload,
  logSectionTitleBarPaginationConsole
} from '../sectionMetrics';

/** 分页：单小题占用高度（px），与预览 areaHeight 一致 */
export function getAnswerItemPaginationHeightPx(item) {
  const height = Math.max(80, Number(item.areaHeight) || 180);
  return Math.max(ANSWER_MIN_ITEM_BODY_PX, height);
}

/**
 * 计算解答题块在分页或A3拆栏时的竖向占位高度（像素）
 * @param {Object} section - 题块对象
 * @param {boolean} section.isContinuation - 是否为续接题块
 * @param {boolean} section.a3SuppressSectionTitle - A3模式下是否抑制大题标题显示
 * @param {Array} section.items - 题块中的小题列表
 * @returns {number} 总高度（像素）
 */
export function getAnswerSectionPaginationBodyHeightPx(section) {
  // 如果是续接题块或A3模式抑制大题标题，则不计算大题标题栏高度，否则加上大题标题栏高度
  let px = (section.isContinuation || section.a3SuppressSectionTitle) ? 0 : SUBJECTIVE_SECTION_HEADER_PX;
  
  // 遍历所有小题，累加每个小题的高度
  (section.items || []).forEach((it) => {
    px += getAnswerItemPaginationHeightPx(it);
  });
  
  return px;
}

/** previewPages：解答题小题「高度拆分」 */
export function buildAnswerPaginationHeightSplit({
  needPxRounded,
  pageMaxHeightPxRounded,
  answerSlackPxRounded,
  answerReservePxRounded,
  tightPlacementNote
}) {
  const split = {
    getAnswerItemPaginationHeightPx: needPxRounded,
    页内答题区上限_px: pageMaxHeightPxRounded,
    放宽像素_answerSlackPx: answerSlackPxRounded,
    底部预留参与折算_px: answerReservePxRounded
  };
  if (tightPlacementNote) {
    split.说明 = tightPlacementNote;
  }
  return split;
}

/** previewPages：解答题小题放置日志 payload */
export function buildAnswerPaginationLogPayload({
  blockKey,
  chunkKey,
  chunkContinuation,
  pageOneBased,
  totalCapPxRounded,
  questionNum,
  measureKey,
  areaHeightPxRounded,
  itemOrdinal,
  itemsTotal,
  needPxRounded,
  remBeforeRounded,
  remAfterRounded,
  blockNeedPx,
  heightSplit
}) {
  return {
    题块key: blockKey,
    chunkKey,
    chunk续页: chunkContinuation,
    页码: pageOneBased,
    当前页总高度_px: totalCapPxRounded,
    小题号: questionNum,
    measureKey,
    答题区高度_px: areaHeightPxRounded,
    第几次绘制小题: itemOrdinal,
    本块小题总数: itemsTotal,
    本次分页占用高度_px: needPxRounded,
    放置前剩余_px: remBeforeRounded,
    放置后剩余_px: remAfterRounded,
    本题块估算总需求高度_px: blockNeedPx,
    高度拆分: heightSplit
  };
}

/** previewPages：解答题小题放置调试日志 */
export function logAnswerPaginationConsole(enabled, payload) {
  if (!enabled) return;
  console.log('[AnswerSheet A4 解答分页]', payload);
}

/**
 * previewPages：解答题块分页算法。
 * viewer：buildAnswerSectionRender / getMinAnswerAreaHeight / getMaxAnswerAreaHeight（来自编辑器实例）。
 * @param {PaginationContext} context - 分页上下文管理器
 * @param {number} sectionGapPx - 题块间距像素值
 * @param {Object} block - 题块数据
 * @param {Object} viewer - 视图构建器对象
 */
export function appendAnswerQuestionBlockPreviewPagination(context, sectionGapPx, block, viewer) {
  // 构建解答题块的渲染数据
  const section = viewer.buildAnswerSectionRender(block);
  
  // 计算底部预留空间（用于台账等），减去分页权重单位
  const answerReservePx = Math.max(0, context.bottomReservePxForLedger() - PAGINATION_WEIGHT_UNIT_PX);
  
  // 计算整个题块所需的总高度（包括间距、标题栏和所有小题）
  const answerBlockNeedHeightPx = Math.round(
    sectionGapPx
      + SUBJECTIVE_SECTION_HEADER_PX
      + section.items.reduce((sum, it) => {
        // 计算每个小题的高度，取最小值和默认值的最大值
        const h = Math.max(
          viewer.getMinAnswerAreaHeight(),
          Number(it.areaHeight) || 180
        );
        // 创建临时对象用于计算分页高度
        const stub = { ...it, areaHeight: h, measureKey: `${section.id}-${it.num}-${h}` };
        const px = getAnswerItemPaginationHeightPx(stub);
        return sum + px;
      }, 0)
  );
  
  // 初始化当前页的题块片段（chunk）
  let chunk = {
    ...section,
    items: [],           // 当前页包含的小题列表
    isContinuation: false, // 是否为续接页
    chunkKey: `${section.id}-0` // 片段唯一标识
  };
  let chunkIndex = 0; // 片段索引计数器
  
  /**
   * 将当前片段推送到分页系统中
   * 如果当前片段没有小题则不推送
   */
  const pushChunk = () => {
    if (!chunk.items.length) return;
    context.addSection({
      ...chunk,
      chunkKey: `${section.id}-${chunkIndex}`
    });
    chunkIndex += 1;
  };
  
  /**
   * 创建续接页
   * 当当前页无法容纳下一个小题时调用
   * @param {boolean} continuingAfterSlice - 是否在切片后继续
   */
  const createContinuationPage = () => {
    const continuingAfterSlice = chunk.items.length > 0;
    pushChunk(); // 先推送当前片段
    context.pageIndex += 1; // 移动到下一页
    context.ensurePage(); // 确保新页面存在
    context.reloadRemainingForCurrentPage(); // 重新加载当前页剩余空间
    chunk = {
      ...section,
      items: [],
      isContinuation: continuingAfterSlice // 标记为续接页
    };
  };

  /**
   * A3 多栏：本页所有栏都放不下时换页。
   *
   * `a3TwoColConsumeRawPx` 内部自带「放不下就 pageIndex+1」的兜底，但它只会移动栏账本，
   * 不会把当前 chunk 推给旧页、也不会重置栏游标。直接依赖它会出现「小题记在旧页 chunk、
   * 高度账本算到新页」的错位，渲染时旧页末栏被塞爆并裁切。
   * 因此这里显式完成三件事：推送旧 chunk、翻页、重置栏账本。
   */
  const createA3ColumnPageBreak = () => {
    const continuingAfterSlice = chunk.items.length > 0;
    pushChunk();
    context.pageIndex += 1;
    context.ensurePage();
    context.reloadRemainingForCurrentPage();
    if (typeof context.resetA3TwoColColumnLedger === 'function') {
      context.resetA3TwoColColumnLedger();
    }
    chunk = {
      ...section,
      items: [],
      isContinuation: continuingAfterSlice
    };
  };
  
  // A3双栏模式下的初始检查：如果当前栏无法容纳标题栏和预留空间，则换页
  if (context.isA3TwoCol) {
    if (
      chunk.items.length === 0
      && !context.a3TwoColCanFitSectionPx(SUBJECTIVE_SECTION_HEADER_PX + answerReservePx)
    ) {
      context.pageIndex += 1;
      context.ensurePage();
      context.reloadRemainingForCurrentPage();
    }
  } else if (
    // 非A3模式下：如果剩余空间不足以容纳标题栏、间距和预留空间，且当前片段为空，则换页
    context.remainingPx < (SUBJECTIVE_SECTION_HEADER_PX + sectionGapPx + answerReservePx)
    && chunk.items.length === 0
  ) {
    context.pageIndex += 1;
    context.ensurePage();
    context.reloadRemainingForCurrentPage();
  }
  
  // 处理大题标题栏的空间占用
  {
    /*
     * 标题栏必须与首个小图同栏：否则账本把标题栏记在上一栏、小题全落在下一栏，
     * 渲染层按整块搬到下一栏时会比账本多出一整块高度，逐栏累积后末栏溢出。
     */
    if (context.isA3TwoCol && section.items.length > 0) {
      const firstOriginal = section.items[0];
      const firstItemHeight = Math.min(
        viewer.getMaxAnswerAreaHeight(context.pageIndex),
        Math.max(viewer.getMinAnswerAreaHeight(), Number(firstOriginal.areaHeight) || 180)
      );
      context.a3TwoColEnsureColumnRoomForPx(
        SUBJECTIVE_SECTION_HEADER_PX
          + getAnswerItemPaginationHeightPx({ ...firstOriginal, areaHeight: firstItemHeight })
      );
    }

    const beforeHdr = context.isA3TwoCol
      ? context.a3TwoColPeekRemainingBeforeSectionPx(SUBJECTIVE_SECTION_HEADER_PX)
      : context.remainingPx;
    
    // 注意：SUBJECTIVE_SECTION_HEADER_PX (40px) 已包含 padding-top，不额外扣除间距
    if (context.isA3TwoCol) {
      context.a3TwoColConsumeSectionHeightPx(SUBJECTIVE_SECTION_HEADER_PX, { skipLeadingBlockGap: false });
    } else {
      context.remainingPx -= SUBJECTIVE_SECTION_HEADER_PX;
    }
    logSectionTitleBarPaginationConsole(context.paginationDebugEnabled(), buildSubjectiveSectionTitleBarLogPayload({
      blockKey: block.key != null ? block.key : String(block.id),
      sectionType: 'answer',
      chunkContinuation: chunk.isContinuation,
      pageOneBased: context.pageIndex + 1,
      leadingBlockGapPx: sectionGapPx,
      beforeHdrRounded: Math.round(beforeHdr),
      afterHdrRounded: Math.round(context.remainingPx)
    }));
  }
  
  // 遍历所有小题进行分页处理
  for (let idx = 0; idx < section.items.length; idx += 1) {
    const original = section.items[idx];
    
    // 计算放宽像素（额外空间），首页和续页有不同的放宽值
    const answerSlackPx = ANSWER_PAGINATION_EXTRA_PX
      + (context.pageIndex > 0 ? ANSWER_CONTINUATION_EXTRA_PX : 0);
      
    // 获取当前页允许的最大答题区高度
    const pageMaxHeight = viewer.getMaxAnswerAreaHeight(context.pageIndex);
    
    // 计算小题的实际高度，限制在最小值和最大值之间
    let itemHeight = Math.min(pageMaxHeight, Math.max(viewer.getMinAnswerAreaHeight(), Number(original.areaHeight) || 180));
    
    // 创建小题对象，包含测量键用于追踪
    let item = {
      ...original,
      areaHeight: itemHeight,
      measureKey: `${section.id}-${original.num}-${itemHeight}`
    };
    
    // 计算该小题在分页中需要占用的像素高度
    let needPx = getAnswerItemPaginationHeightPx(item);
    
    // 计算可用剩余空间（考虑预留空间和放宽像素）
    let usableRemainingPx = Math.max(0, context.remainingPx - answerReservePx + answerSlackPx);
    
    // 保存用于日志记录的变量
    let answerSlackForLog = answerSlackPx;
    let pageMaxHeightForLog = pageMaxHeight;
    
    // 如果所需空间大于可用空间且不是A3双栏模式，则创建续接页
    if (needPx > usableRemainingPx && !context.isA3TwoCol) {
      createContinuationPage();
      
      // 重新计算续接页的相关参数
      const continuationSlackPx = ANSWER_PAGINATION_EXTRA_PX
        + (context.pageIndex > 0 ? ANSWER_CONTINUATION_EXTRA_PX : 0);
      const continuationMaxHeight = viewer.getMaxAnswerAreaHeight(context.pageIndex);
      
      answerSlackForLog = continuationSlackPx;
      pageMaxHeightForLog = continuationMaxHeight;
      
      // 重新计算小题高度
      itemHeight = Math.min(continuationMaxHeight, Math.max(viewer.getMinAnswerAreaHeight(), Number(original.areaHeight) || 180));
      item = {
        ...original,
        areaHeight: itemHeight,
        measureKey: `${section.id}-${original.num}-${itemHeight}`
      };
      
      // 重新计算所需空间和可用空间
      needPx = getAnswerItemPaginationHeightPx(item);
      usableRemainingPx = Math.max(0, context.remainingPx - answerReservePx + continuationSlackPx);
    }
    
    // A3 多栏：先确认本页还有栏能容下该小题；整页都放不下则显式换页（含重置栏账本）
    if (context.isA3TwoCol) {
      const pageRemainPx = context.a3TwoColPeekRemainingBeforeRawPx(needPx);
      if (pageRemainPx < needPx) {
        createA3ColumnPageBreak();
        usableRemainingPx = Math.max(0, context.remainingPx - answerReservePx + answerSlackPx);
      }
    }

    // 如果仍然超出可用空间（可能是A3模式或其他特殊情况）
    if (needPx > usableRemainingPx) {
      // 记录放置前的剩余空间
      const remBeforeItem = context.isA3TwoCol
        ? context.a3TwoColPeekRemainingBeforeRawPx(needPx)
        : context.remainingPx;
        
      // 强制将小题添加到当前片段（即使空间不足）
      chunk.items.push(item);
      
      // 根据模式消耗相应空间
      if (context.isA3TwoCol) {
        context.a3TwoColConsumeRawPx(needPx);
      } else {
        context.remainingPx = Math.max(0, context.remainingPx - needPx);
      }
      
      // 记录分页日志（包含紧张放置的说明）
      logAnswerPaginationConsole(context.paginationDebugEnabled(), buildAnswerPaginationLogPayload({
        blockKey: block.key != null ? block.key : String(block.id),
        chunkKey: `${section.id}-${chunkIndex}`,
        chunkContinuation: chunk.isContinuation,
        pageOneBased: context.pageIndex + 1,
        totalCapPxRounded: Math.round(context.totalCapPxForLogs()),
        questionNum: original.num,
        measureKey: item.measureKey,
        areaHeightPxRounded: Math.round(itemHeight),
        itemOrdinal: idx + 1,
        itemsTotal: section.items.length,
        needPxRounded: Math.round(needPx),
        remBeforeRounded: Math.round(remBeforeItem),
        remAfterRounded: Math.round(context.remainingPx),
        blockNeedPx: answerBlockNeedHeightPx,
        heightSplit: buildAnswerPaginationHeightSplit({
          needPxRounded: Math.round(needPx),
          pageMaxHeightPxRounded: Math.round(pageMaxHeightForLog),
          answerSlackPxRounded: Math.round(answerSlackForLog),
          answerReservePxRounded: Math.round(answerReservePx),
          tightPlacementNote: '当前页剩余不足仍放置（与既有逻辑一致），详见 usableRemainingPx'
        })
      }));
      continue; // 继续处理下一个小题
    }
    
    // 正常情况：空间足够，直接放置小题
    const remBeforeItem = context.isA3TwoCol
      ? context.a3TwoColPeekRemainingBeforeRawPx(needPx)
      : context.remainingPx;
      
    chunk.items.push(item);
    
    // 消耗相应空间
    if (context.isA3TwoCol) {
      context.a3TwoColConsumeRawPx(needPx);
    } else {
      context.remainingPx -= needPx;
    }
    
    // 记录分页日志
    logAnswerPaginationConsole(context.paginationDebugEnabled(), buildAnswerPaginationLogPayload({
      blockKey: block.key != null ? block.key : String(block.id),
      chunkKey: `${section.id}-${chunkIndex}`,
      chunkContinuation: chunk.isContinuation,
      pageOneBased: context.pageIndex + 1,
      totalCapPxRounded: Math.round(context.totalCapPxForLogs()),
      questionNum: original.num,
      measureKey: item.measureKey,
      areaHeightPxRounded: Math.round(itemHeight),
      itemOrdinal: idx + 1,
      itemsTotal: section.items.length,
      needPxRounded: Math.round(needPx),
      remBeforeRounded: Math.round(remBeforeItem),
      remAfterRounded: Math.round(context.remainingPx),
      blockNeedPx: answerBlockNeedHeightPx,
      heightSplit: buildAnswerPaginationHeightSplit({
        needPxRounded: Math.round(needPx),
        pageMaxHeightPxRounded: Math.round(pageMaxHeightForLog),
        answerSlackPxRounded: Math.round(answerSlackForLog),
        answerReservePxRounded: Math.round(answerReservePx),
        tightPlacementNote: undefined
      })
    }));
  }
  
  // 推送最后一个片段到分页系统
  pushChunk();
}


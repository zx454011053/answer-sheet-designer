import { PaginationContext } from './PaginationContext';
import {
  ANSWER_SHEET_A3_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX,
  ANSWER_SHEET_8K_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX,
  PAGINATION_WEIGHT_UNIT_PX
} from './constants';
import { appendObjectiveQuestionBlockPreviewPagination } from './pagination/objectivePagination';
import { appendAnswerQuestionBlockPreviewPagination } from './pagination/answerPagination';
import { appendEnglishQuestionBlockPreviewPagination } from './pagination/englishPagination';
import { appendChineseQuestionBlockPreviewPagination } from './pagination/chinesePagination';
import { appendFillBlankQuestionBlockPreviewPagination } from './pagination/fillBlankPagination';

/**
 * 答题卡预览分页：按组件公式高度（px）将 generatedQuestionBlocks 拆到多页 sections
 * @param {import('vue').ComponentPublicInstance} vm AnswerSheetEditor 实例（含 measure / 题型 build 方法）
 */
export function computePreviewPages(vm) {
  const rebuildVersion = vm.previewRenderVersion;
  void rebuildVersion;

  const isA3TwoCol = typeof vm.isA3TwoColPxSheetLayout === 'function'
    && vm.isA3TwoColPxSheetLayout();

  const isA3ThreeColPx = typeof vm.isA3ThreeColPxSheetLayout === 'function'
    && vm.isA3ThreeColPxSheetLayout();

  const a3PxLedgerColCount = isA3TwoCol ? 2 : (isA3ThreeColPx ? 3 : 0);

  const sheetLayoutTypeEarly = (vm.form && vm.form.layoutType) || 'A4';
  const multicolInnerFallback =
    sheetLayoutTypeEarly === '8K'
      ? ANSWER_SHEET_8K_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX
      : ANSWER_SHEET_A3_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX;

  const totalHeightForPage = (i) => {
    if (typeof vm.getSheetPageContentHeightPx === 'function') {
      return vm.getSheetPageContentHeightPx(i);
    }
    const w = typeof vm.getSheetPageCapacityWeight === 'function'
      ? vm.getSheetPageCapacityWeight(i)
      : 12;
    return Math.max(8 * PAGINATION_WEIGHT_UNIT_PX, Number(w) * PAGINATION_WEIGHT_UNIT_PX);
  };

  const pageBottomReservePx = typeof vm.getPageBottomReservePx === 'function'
    ? vm.getPageBottomReservePx()
    : PAGINATION_WEIGHT_UNIT_PX;

  const a3Caps =
    a3PxLedgerColCount === 2 && typeof vm.getA3TwoColColumnCapsPx === 'function'
      ? vm.getA3TwoColColumnCapsPx(0)
      : (a3PxLedgerColCount === 3 && typeof vm.getA3ThreeColColumnCapsPx === 'function'
        ? vm.getA3ThreeColColumnCapsPx(0)
        : (
          a3PxLedgerColCount >= 3
            ? [
              multicolInnerFallback,
              multicolInnerFallback,
              multicolInnerFallback
            ]
            : [
              multicolInnerFallback,
              multicolInnerFallback
            ]
          ));

  const getA3MultiColCapsForPage =
    a3PxLedgerColCount === 2 && typeof vm.getA3TwoColColumnCapsPx === 'function'
      ? (pageIdx) => vm.getA3TwoColColumnCapsPx(pageIdx)
      : (a3PxLedgerColCount === 3 && typeof vm.getA3ThreeColColumnCapsPx === 'function'
        ? (pageIdx) => vm.getA3ThreeColColumnCapsPx(pageIdx)
        : null);

  const getA3TwoColCapsForPage = getA3MultiColCapsForPage;

  /**
   * 分页调试日志开关。
   *
   * 默认关闭：<answer-sheet-designer debug /> 或
   * localStorage.setItem('answer-sheet-designer:debug', '1') 才输出。
   * 早期版本在 A4 / A3 多栏下无条件打印，接入方控制台会被刷屏。
   */
  const paginationDebugEnabled = () => {
    if (vm.debug === true) return true;
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      return window.localStorage.getItem('answer-sheet-designer:debug') === '1';
    } catch (error) {
      // 隐私模式下 localStorage 可能抛错，按关闭处理
      return false;
    }
  };

  const logA3ThreeColPageColumnHeights = (pageIdx) => {
    if (!paginationDebugEnabled()) return;
    if (!isA3ThreeColPx || typeof vm.getA3ThreeColColumnCapsPx !== 'function') return;
    const columnHeightsPx = [...vm.getA3ThreeColColumnCapsPx(pageIdx)];
    const sumColsPx = columnHeightsPx.reduce((s, h) => s + h, 0);
    const totalPagePx =
      typeof vm.getSheetPageContentHeightPx === 'function'
        ? vm.getSheetPageContentHeightPx(pageIdx)
        : sumColsPx;
    console.log(
      `[A3三栏] 第 ${pageIdx + 1} 页开始 — 各栏高度(px):`,
      columnHeightsPx,
      '总高度(各栏之和)(px):',
      sumColsPx,
      '整页换算容量(px):',
      totalPagePx
    );
  };

  const logA3TwoColPageColumnHeights = (pageIdx) => {
    if (!paginationDebugEnabled()) return;
    if (!isA3TwoCol || typeof vm.getA3TwoColColumnCapsPx !== 'function') return;
    const caps = vm.getA3TwoColColumnCapsPx(pageIdx);
    const sumColsPx = caps.reduce((s, h) => s + h, 0);
    const totalPagePx =
      typeof vm.getSheetPageContentHeightPx === 'function'
        ? vm.getSheetPageContentHeightPx(pageIdx)
        : sumColsPx;
    console.log(
      `[A3两栏] 第 ${pageIdx + 1} 页开始 — 各栏高度(px):`,
      [...caps],
      '总高度(各栏之和)(px):',
      sumColsPx,
      '整页换算容量(px):',
      totalPagePx
    );
  };

  const context = new PaginationContext({
    a3ColCount: a3PxLedgerColCount,
    layoutType: sheetLayoutTypeEarly,
    totalHeightForPage,
    pageBottomReservePx,
    a3Caps,
    getA3MultiColCapsForPage,
    getA3TwoColCapsForPage,
    paginationDebugEnabled,
    onPageAdded: (pageIdx) => {
      logA3ThreeColPageColumnHeights(pageIdx);
      logA3TwoColPageColumnHeights(pageIdx);
    }
  });

  if (a3PxLedgerColCount >= 2) {
    context.resetA3TwoColColumnLedger();
  }

  logA3ThreeColPageColumnHeights(0);
  logA3TwoColPageColumnHeights(0);

  vm.generatedQuestionBlocks.forEach((block) => {
    const sectionGapPx = context.calculateSectionGapPx();

    if (['single', 'multiple', 'judge', 'objective'].includes(block.type)) {
      appendObjectiveQuestionBlockPreviewPagination(context, sectionGapPx, block);
    } else if (block.type === 'answer') {
      appendAnswerQuestionBlockPreviewPagination(context, sectionGapPx, block, {
        buildAnswerSectionRender: (b) => vm.buildAnswerSectionRender(b),
        getMinAnswerAreaHeight: () => vm.getMinAnswerAreaHeight(),
        getMaxAnswerAreaHeight: (i) => vm.getMaxAnswerAreaHeight(i)
      });
    } else if (block.type === 'english') {
      appendEnglishQuestionBlockPreviewPagination(context, sectionGapPx, block, {
        buildEnglishSectionRender: (b) => vm.buildEnglishSectionRender(b)
      });
    } else if (block.type === 'chinese') {
      appendChineseQuestionBlockPreviewPagination(context, sectionGapPx, block, {
        buildChineseSectionRender: (b) => vm.buildChineseSectionRender(b)
      });
    } else if (block.type === 'fillblank') {
      appendFillBlankQuestionBlockPreviewPagination(context, sectionGapPx, block, {
        buildFillBlankSectionRender: (b) => vm.buildFillBlankSectionRender(b)
      });
    }
  });

  return context.getPages();
}

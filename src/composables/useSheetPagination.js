/**
 * 分页编排：把题块按当前版式的像素账本切分成多页，并处理 A3/8K 分栏切片。
 */
import { computed, watch } from 'vue';
import { computePreviewPages } from '@/core/computePreviewPages';
import { splitA3MulticolSectionsIntoColumns } from '@/core/a3MulticolSplit';
import { resolveSectionPaginationBodyHeightPx } from '@/core/sectionPaginationHeight';
import { absorbContainerGap } from '@/core/absorbColumnGaps';
import { SECTION_BLOCK_VERTICAL_GAP_PX } from '@/core/constants';

/**
 * @param {Object} params
 * @param {Object} params.model useSheetModel
 * @param {Object} params.metrics useSheetMetrics
 * @param {Object} params.render useSectionRender
 */
export function useSheetPagination({ model, metrics, render }) {
  const isObjectiveBandMerged = render.isObjectiveBandMergedWithPrevious;

  const buildA3MulticolSplitContext = () => ({
    effectiveA3ColumnCount: model.effectiveA3ColumnCount.value,
    isA3TwoColPxSheetLayout: () => metrics.isA3TwoColPxSheetLayout(),
    isA3ThreeColPxSheetLayout: () => metrics.isA3ThreeColPxSheetLayout(),
    getA3TwoColColumnCapsPx: (pageIdx) => metrics.getA3TwoColColumnCapsPx(pageIdx),
    getA3ThreeColColumnCapsPx: (pageIdx) => metrics.getA3ThreeColColumnCapsPx(pageIdx),
    getA3MulticolSheetCapacities: () => metrics.getA3MulticolSheetCapacities(),
    isObjectiveBandMergedWithPrevious: isObjectiveBandMerged,
    is8KLayout: model.is8KLayout.value
  });

  /**
   * 分页器需要读取的「宿主」形状，保持与 core/computePreviewPages 的既有约定一致；
   * 用 getter 暴露响应式数据，保证 computed 能正确收集依赖。
   */
  const paginationHost = {
    get form() { return model.form; },
    get previewRenderVersion() { return model.previewRenderVersion.value; },
    get generatedQuestionBlocks() { return model.generatedQuestionBlocks.value; },
    isA3TwoColPxSheetLayout: () => metrics.isA3TwoColPxSheetLayout(),
    isA3ThreeColPxSheetLayout: () => metrics.isA3ThreeColPxSheetLayout(),
    getSheetPageContentHeightPx: (i) => metrics.getSheetPageContentHeightPx(i),
    getSheetPageCapacityWeight: (i) => metrics.getSheetPageCapacityWeight(i),
    getPageBottomReservePx: () => metrics.getPageBottomReservePx(),
    getA3TwoColColumnCapsPx: (i) => metrics.getA3TwoColColumnCapsPx(i),
    getA3ThreeColColumnCapsPx: (i) => metrics.getA3ThreeColColumnCapsPx(i),
    buildAnswerSectionRender: render.buildAnswerSectionRender,
    buildEnglishSectionRender: render.buildEnglishSectionRender,
    buildChineseSectionRender: render.buildChineseSectionRender,
    buildFillBlankSectionRender: render.buildFillBlankSectionRender,
    getMinAnswerAreaHeight: render.minAnswerAreaHeight,
    getMaxAnswerAreaHeight: render.getMaxAnswerAreaHeight
  };

  const previewPages = computed(() => computePreviewPages(paginationHost));

  /**
   * 页尾空隙回收：把每页/每栏的剩余高度补给最后一个解答题的作答区。
   *
   * 只作用在「分页与分栏都已定稿」之后，不参与分页决策，因此不会改变页数，
   * 也不会把内容推出纸面 —— 它把原本空着的区域变成可书写区域。
   * 回填结果只存在于 sheetPreviewPages，不回流到 previewPages，
   * 避免「回填后的高度又参与分页」造成收敛问题。
   */
  function absorbPageSections(sections, capacityPx, pageIdx, gapBetween) {
    const { sections: absorbed } = absorbContainerGap(sections, capacityPx, {
      gapBetween,
      maxLastItemPx: render.getMaxAnswerAreaHeight(pageIdx)
    });
    return absorbed;
  }

  /** 横带与上一块合并显示时不额外计间距，与分栏器的判定保持一致 */
  const a3GapBetween = (prev, cur) => (
    isObjectiveBandMerged(cur, [prev, cur], 1) ? 0 : SECTION_BLOCK_VERTICAL_GAP_PX
  );

  /** 分栏版式：为每个物理栏切片 sections，供页面组件独立渲染 */
  const sheetPreviewPages = computed(() => {
    const pages = previewPages.value;
    if (!model.isA3MultiColumnLayout.value) {
      return pages.map((page, pageIdx) => ({
        ...page,
        sections: absorbPageSections(
          page.sections,
          metrics.getSheetPageContentHeightPx(pageIdx),
          pageIdx
        ),
        a3ColumnSections: null
      }));
    }
    const threeCol = metrics.isA3ThreeColPxSheetLayout();
    return pages.map((page, pageIdx) => {
      const columns = splitA3MulticolSectionsIntoColumns(
        buildA3MulticolSplitContext(),
        page.sections,
        pageIdx
      );
      const caps = threeCol
        ? metrics.getA3ThreeColColumnCapsPx(pageIdx)
        : metrics.getA3TwoColColumnCapsPx(pageIdx);
      return {
        ...page,
        a3ColumnSections: columns.map((columnSections, ci) => absorbPageSections(
          columnSections,
          caps[ci],
          pageIdx,
          a3GapBetween
        ))
      };
    });
  });

  /** 页数回填到 form（保存时使用） */
  watch(
    previewPages,
    (list) => {
      model.form.pageCount = Array.isArray(list) && list.length ? list.length : 1;
    },
    { immediate: true }
  );

  /** 单页 .sheet-preview 外壳 class */
  function getSheetPreviewShellClass(pageIdx) {
    const cols = model.effectiveA3ColumnCount.value;
    const multiCol = (model.isA3Layout.value || model.is8KLayout.value) && (cols === 2 || cols === 3);
    return {
      'sheet-preview-class-number': model.isClassNumberMode.value && pageIdx === 0,
      'sheet-preview-continuation': pageIdx > 0,
      'sheet-preview-a3': model.isA3Layout.value,
      'sheet-preview-8k': model.is8KLayout.value,
      'sheet-preview-a3-cols-2': (model.isA3Layout.value || model.is8KLayout.value) && cols === 2,
      'sheet-preview-a3-cols-3': (model.isA3Layout.value || model.is8KLayout.value) && cols === 3,
      'sheet-preview-a3-multicol': multiCol,
      'sheet-preview-a4-draw': model.isA4Layout.value
    };
  }

  /**
   * A3 / 8K 三栏：纸张左右各 20px 非绘制区由样式 padding 预留，本 grid 仅在剩余宽度内分配；
   * 奇数页 4:3:3，偶数页 3:3:4；栏间距 10px。
   */
  function a3ThreeColSheetPreviewGridStyle(pageIdx) {
    const layout = model.layoutType.value;
    if ((layout !== 'A3' && layout !== '8K') || model.effectiveA3ColumnCount.value !== 3) return {};
    const firstPattern = pageIdx % 2 === 0;
    return {
      display: 'grid',
      gridTemplateColumns: firstPattern
        ? 'minmax(0, 4fr) minmax(0, 3fr) minmax(0, 3fr)'
        : 'minmax(0, 3fr) minmax(0, 3fr) minmax(0, 4fr)',
      gridTemplateRows: 'minmax(0, 1fr)',
      columnGap: '10px',
      alignItems: 'stretch',
      alignContent: 'stretch',
      minHeight: 0
    };
  }

  /** 单个大题块的竖向占位（px），与分页账本一致 */
  function getSectionPaginationBodyHeightPx(section) {
    return resolveSectionPaginationBodyHeightPx(section);
  }

  return {
    previewPages,
    sheetPreviewPages,
    getSheetPreviewShellClass,
    a3ThreeColSheetPreviewGridStyle,
    getSectionPaginationBodyHeightPx
  };
}

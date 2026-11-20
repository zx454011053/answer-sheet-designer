/**
 * section 渲染数据构造：把题块展开成「一页一段」的可渲染结构，并给出分页所需的高度。
 * 分页推演（core/computePreviewPages）与预览渲染共用这里的构造结果，保证账本一致。
 */
import {
  ANSWER_CONTINUATION_EXTRA_PX,
  ANSWER_MIN_ITEM_BODY_PX,
  ANSWER_PAGINATION_EXTRA_PX,
  FILLBLANK_ROW_HEIGHT_PX,
  SUBJECTIVE_SECTION_HEADER_PX
} from '@/core/constants';
import { buildFillBlankRowsFromNormalizedSegments, logFillBlankLayoutBuild } from '@/core/fillBlankLayout';
import { getAnswerTotalScore, isObjectiveType, normalizeAnswerSegment, normalizeChineseBlock, normalizeEnglishBlock } from '@/core/questionModel';
import {
  CHINESE_GRID_COLS_8K_THREE_COL_PAGINATION_BASE,
  CHINESE_GRID_COLS_8K_TWO_COL,
  CHINESE_GRID_COLS_A3_PAGINATION_BASE
} from '@/core/a3ThreeColChineseGrid';

const DEFAULT_CHINESE_GRID_COLS = 22;
const MIN_ANSWER_AREA_HEIGHT_PX = 80;

/**
 * @param {Object} params
 * @param {Object} params.metrics useSheetMetrics 的返回值
 * @param {Object} params.model useSheetModel 的返回值
 * @param {boolean} [params.debugLog] 是否输出填空排版日志
 */
export function useSectionRender({ metrics, model, debugLog = false }) {
  const minAnswerAreaHeight = () => MIN_ANSWER_AREA_HEIGHT_PX;

  /** 单页最大解答题作答区高度（受页面可绘制高度约束） */
  function getMaxAnswerAreaHeight(pageIndex = 0) {
    const pageHeightPx = typeof metrics.getAnswerSheetColumnContentHeightPx === 'function'
      ? metrics.getAnswerSheetColumnContentHeightPx(pageIndex)
      : metrics.getSheetPageContentHeightPx(pageIndex);
    const slackPx = ANSWER_PAGINATION_EXTRA_PX + (pageIndex > 0 ? ANSWER_CONTINUATION_EXTRA_PX : 0);
    const maxBody = Math.max(
      ANSWER_MIN_ITEM_BODY_PX,
      pageHeightPx - SUBJECTIVE_SECTION_HEADER_PX + slackPx
    );
    return Math.max(minAnswerAreaHeight(), maxBody);
  }

  function buildAnswerSectionRender(block) {
    const items = [];
    const segments = block.segments
      .map((item) => normalizeAnswerSegment(item, { maxAreaHeight: getMaxAnswerAreaHeight() }))
      .sort((a, b) => a.startNum - b.startNum);
    segments.forEach((segment) => {
      for (let num = segment.startNum; num <= segment.endNum; num += 1) {
        items.push({
          num,
          scorePerQuestion: segment.scorePerQuestion,
          areaHeight: segment.areaHeight
        });
      }
    });
    return {
      id: block.id,
      type: 'answer',
      sectionNo: block.sectionNo,
      sectionTitle: block.sectionTitle,
      totalScore: getAnswerTotalScore(block),
      items,
      isContinuation: false,
      chunkKey: String(block.id || Date.now())
    };
  }

  function buildEnglishSectionRender(block) {
    const normalized = normalizeEnglishBlock(block, 1);
    const lines = [];
    if (normalized.openingText) {
      lines.push({
        rowType: 'english-lead',
        leadText: `${normalized.questionNo} ${normalized.openingText}`.trim(),
        paginationHeightPx: FILLBLANK_ROW_HEIGHT_PX,
        measureKey: `${normalized.id}-english-lead`
      });
    }
    for (let idx = 1; idx <= normalized.lineCount; idx += 1) {
      const row = {
        rowType: 'english-rule',
        index: idx,
        paginationHeightPx: FILLBLANK_ROW_HEIGHT_PX,
        measureKey: `${normalized.id}-english-rule-${idx}`
      };
      if (!normalized.openingText && idx === 1) {
        row.prefixText = String(normalized.questionNo);
      }
      lines.push(row);
    }
    return {
      id: normalized.id,
      type: 'english',
      sectionNo: normalized.sectionNo,
      sectionTitle: normalized.sectionTitle,
      sectionVisible: normalized.showSectionTitle !== false,
      totalScore: normalized.scorePerQuestion,
      lines,
      isContinuation: false,
      chunkKey: String(normalized.id || Date.now())
    };
  }

  function buildChineseSectionRender(block) {
    const normalized = normalizeChineseBlock(block, 1);
    const a3ThreeCol = metrics.isA3ThreeColPxSheetLayout();
    const eightKTwoCol = model.is8KLayout.value && model.effectiveA3ColumnCount.value === 2;
    let columns = DEFAULT_CHINESE_GRID_COLS;
    if (a3ThreeCol) {
      columns = model.is8KLayout.value
        ? CHINESE_GRID_COLS_8K_THREE_COL_PAGINATION_BASE
        : CHINESE_GRID_COLS_A3_PAGINATION_BASE;
    } else if (eightKTwoCol) {
      columns = CHINESE_GRID_COLS_8K_TWO_COL;
    }
    const rowCount = Math.max(4, Math.ceil(normalized.maxWordCount / columns));
    const rows = Array.from({ length: rowCount }, (_, idx) => ({
      index: idx + 1,
      measureKey: `${normalized.id}-chinese-row-${idx + 1}`
    }));
    return {
      id: normalized.id,
      type: 'chinese',
      sectionNo: normalized.sectionNo,
      sectionTitle: normalized.sectionTitle,
      sectionVisible: true,
      totalScore: normalized.scorePerQuestion,
      columns,
      minWordCount: normalized.minWordCount,
      maxWordCount: normalized.maxWordCount,
      rows,
      isContinuation: false,
      chunkKey: String(normalized.id || Date.now())
    };
  }

  function buildFillBlankSectionRender(block) {
    const segments = block.segments
      .map((item) => ({ ...item }))
      .sort((a, b) => a.startNum - b.startNum);
    const shortItemsPerRow = metrics.isA3ThreeColPxSheetLayout() ? 2 : 3;
    const rows = buildFillBlankRowsFromNormalizedSegments(block.id, segments, { shortItemsPerRow });
    if (debugLog) {
      logFillBlankLayoutBuild(block.id, segments.length, rows, console, { shortItemsPerRow });
    }
    return {
      id: block.id,
      type: 'fillblank',
      sectionNo: block.sectionNo,
      sectionTitle: block.sectionTitle,
      totalScore: block.totalScore,
      shortItemsPerRow,
      rows,
      isContinuation: false,
      chunkKey: String(block.id || Date.now())
    };
  }

  /** 预览列表项稳定 key（A3 两栏解答题拆栏时 a3AnswerSliceKey 唯一） */
  function previewSectionStableKey(section) {
    if (!section) return '';
    return String(section.a3AnswerSliceKey || section.chunkKey || section.key || section.id || '');
  }

  /** 客观题首横带：大题标题仅在标题块内绘制 */
  function isObjectiveFirstDrawSplitLayout(section) {
    if (!section || !isObjectiveType(section.type)) return false;
    if (section.objectiveBandSliceIndex != null) {
      return Number(section.objectiveBandSliceIndex) === 0;
    }
    return !section.isContinuation;
  }

  /** 同一预览页内，与前一条为同一客观题框的相邻横带（用于合并外框） */
  function isObjectiveBandMergedWithPrevious(section, pageSections, secIdx) {
    if (!pageSections || secIdx <= 0) return false;
    const prev = pageSections[secIdx - 1];
    if (!prev || section.id == null || prev.id !== section.id) return false;
    if (!isObjectiveType(section.type) || !isObjectiveType(prev.type)) return false;
    const cur = section.objectiveBandSliceIndex;
    const p = prev.objectiveBandSliceIndex;
    if (cur == null || p == null) return false;
    return cur === p + 1;
  }

  /** 语文作文方格字数标记（第 minWordCount 格显示「N字」） */
  function getChineseCellMarker(section, row, cellIdx) {
    if (!section || !row) return '';
    const columns = Math.max(1, Number(section.columns) || 20);
    const minWordCount = Math.max(1, Number(section.minWordCount) || 0);
    const rowIndex = Math.max(1, Number(row.index) || 1);
    if (rowIndex < 2) return '';
    const serial = (rowIndex - 2) * columns + Number(cellIdx);
    return serial === minWordCount ? `${minWordCount}字` : '';
  }

  return {
    minAnswerAreaHeight,
    getMaxAnswerAreaHeight,
    buildAnswerSectionRender,
    buildEnglishSectionRender,
    buildChineseSectionRender,
    buildFillBlankSectionRender,
    previewSectionStableKey,
    isObjectiveFirstDrawSplitLayout,
    isObjectiveBandMergedWithPrevious,
    getChineseCellMarker
  };
}

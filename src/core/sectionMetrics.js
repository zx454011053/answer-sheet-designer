/**
 * 大题标题栏度量与分页日志工具（纯常量 + 纯函数）。
 *
 * 这些数值同时被「渲染组件 AnswerSheetSectionTitle.vue」与「分页推演 core/pagination」使用。
 * 单独抽成 core 模块可避免 constants.js → .vue 的反向依赖（原实现存在 .vue 与 utils 互相 import）。
 */

/** `.question-section-item` 上沿内边距（px） */
export const SECTION_TITLE_BAR_PADDING_TOP_PX = 10;

/** `.section-title` 固定行高（px） */
export const SECTION_TITLE_BAR_LINE_HEIGHT_PX = 30;

/**
 * 分页用大题标题栏总占位（px）：padding-top + 标题行高，不含相邻大题块间距
 * @returns {number}
 */
export function getSectionTitleBarTotalPx() {
  return SECTION_TITLE_BAR_PADDING_TOP_PX + SECTION_TITLE_BAR_LINE_HEIGHT_PX;
}

/**
 * 控制台「大题标题栏」日志用的拆分字段
 * @returns {Object}
 */
export function getSectionTitleBarPaginationLogSplit() {
  return {
    question_section_item_padding_top_px: SECTION_TITLE_BAR_PADDING_TOP_PX,
    section_title_line_px: SECTION_TITLE_BAR_LINE_HEIGHT_PX,
    标题栏合计_px: getSectionTitleBarTotalPx(),
    公式:
      'SUBJECTIVE_SECTION_HEADER_PX = padding-top + .section-title 行高；不含相邻大题块间距 SECTION_BLOCK_VERTICAL_GAP_PX'
  };
}

/**
 * 客观首横带大题标题栏日志 payload
 * @param {Object} params
 * @param {string} params.blockKey
 * @param {string} params.chunkKey
 * @param {number} params.pageOneBased
 * @param {number} params.remBeforeRounded
 * @returns {Object}
 */
export function buildObjectiveFirstBandSectionTitleBarLogPayload({
  blockKey,
  chunkKey,
  pageOneBased,
  remBeforeRounded
}) {
  return {
    题块key: blockKey,
    题型: 'objective',
    chunkKey,
    chunk续页: false,
    页码: pageOneBased,
    放置前剩余_px: remBeforeRounded,
    标题栏占位_px: getSectionTitleBarTotalPx(),
    高度拆分: getSectionTitleBarPaginationLogSplit(),
    说明: '首横带 slice = 标题栏 + 题区主体，占用见本条后续「客观分页」日志'
  };
}

/**
 * 解答 / 英语 / 语文 / 填空大题标题栏日志 payload
 * @param {Object} params
 * @param {string} params.blockKey
 * @param {string} params.sectionType
 * @param {boolean} params.chunkContinuation
 * @param {number} params.pageOneBased
 * @param {number} params.beforeHdrRounded
 * @param {number} params.afterHdrRounded
 * @param {number} [params.leadingBlockGapPx]
 * @returns {Object}
 */
export function buildSubjectiveSectionTitleBarLogPayload({
  blockKey,
  sectionType,
  chunkContinuation,
  pageOneBased,
  beforeHdrRounded,
  afterHdrRounded,
  leadingBlockGapPx = 0
}) {
  const gap = Math.max(0, Math.round(Number(leadingBlockGapPx) || 0));
  const titleSplit = getSectionTitleBarPaginationLogSplit();
  const payload = {
    题块key: blockKey,
    题型: sectionType,
    chunk续页: chunkContinuation,
    页码: pageOneBased,
    放置前剩余_px: beforeHdrRounded,
    高度拆分: titleSplit,
    放置后剩余_px: afterHdrRounded
  };
  if (gap > 0) {
    payload.题块前导间距_px = gap;
    payload.标题栏与间距合计_px = gap + titleSplit.标题栏合计_px;
  }
  return payload;
}

/**
 * 大题标题栏调试日志
 * @param {boolean} enabled
 * @param {Object} payload
 */
export function logSectionTitleBarPaginationConsole(enabled, payload) {
  if (!enabled) return;
  console.log('[AnswerSheet A4 大题标题栏]', payload);
}

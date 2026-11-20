/** 答题卡分页与测量相关常量（供 AnswerSheetEditor 与 mixin 共用） */

import {
  SECTION_TITLE_BAR_PADDING_TOP_PX,
  SECTION_TITLE_BAR_LINE_HEIGHT_PX,
  getSectionTitleBarTotalPx
} from './sectionMetrics';

/**
 * 首页 vs 续页「试题区容量权重」可调入口
 *
 * 1) 容量基数（按版式 A4 / A3 / 8K）
 *    → AnswerSheetEditor `getCapacityBaseByLayout()`：`firstPage` / `continuationPage`；
 *    首页可用行数还经 `getFirstPageContentCapacity()` 扣 `getFirstPageFillTypePenalty()` 等。
 *
 * 2) 推演按页取容量
 *    → 像素：`getSheetPageContentHeightPx(pageIndex)`：A4 非分栏时续页用内侧高度 `ANSWER_SHEET_A4_DRAWABLE_INNER_HEIGHT_PX`（见四边收缩）；
 *       首页为总高度减去填涂顶区占位（`getAnswerSheetA4FillTypeLeaderHeightPx`，与 `.sheet-drawable-leader` 实测高度对齐，不含已移除的 margin-top）；
 *       A3 两栏为左栏+右栏账本：`ANSWER_SHEET_A3_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX` ×2（首页左栏再减顶区）；
 *       其余版式仍为容量位数 × `PAGINATION_WEIGHT_UNIT_PX`；
 *    预览分页 `previewPages` 全程用 px（组件公式高度 + `SECTION_BLOCK_VERTICAL_GAP_PX` 等）。
 *
 * 3) A3 答题区分栏（整张纸容量，非单列）
 *    → 本文件 `A3_MULTICOL_*_FIRST_PAGE_BASE` / `*_CONTINUATION_BASE`，
 *    再经 `getA3MulticolSheetCapacities()` 里栏数等惩罚。
 *
 * 4) 部分题型分支仍区分首页 / 续页
 *    → `OBJECTIVE_A4_*_PACKING_*` 等；`ANSWER_CONTINUATION_EXTRA_WEIGHT`、`FILLBLANK_*` 等。
 *
 * 5) `PAGINATION_WEIGHT_UNIT_PX`
 *    → 页容量位数与像素换算；`toPageWeight`/`toPageCapacity` 仍用于底部预留等少量场景。
 */

export const DEFAULT_NOTICE = [
  '答题前，考生先将自己的姓名、原班级等信息填写清楚。',
  '客观题必须使用2B铅笔将对应答案涂黑涂满，主观题必须使用0.5毫米黑色签字笔，不得使用铅笔、红笔或圆珠笔答题，不能用涂改液、修正带，字迹工整，笔迹清楚。',
  '请按照题号顺序在各题目的答题区域内作答，超出答题区域书写的答案无效，在草稿纸、试题卷上答题无效。',
  '保持卡面清洁，不要折叠，不要弄破，严禁在答题卡上作任何标记。',
  '考试结束后，请将答题卡交回。'
];
//权重与像素的换算灵敏度：0 表示不换算，1 表示 1px = 1权重
export const PAGINATION_WEIGHT_UNIT_PX = 35;

/**
 * A4 试题区竖向基准高度（px）：与预览 `.sheet-safe-area` 定位框一致，
 * 内侧再按 top/left/right/bottom inset 收缩后才是内容与分页所用高度。
 */
export const ANSWER_SHEET_A4_DRAWABLE_CONTENT_HEIGHT_PX = 1006;
/** A4 可绘制区内侧：顶、左、右收缩（px），与 `.sheet-safe-area` padding 一致 */
export const ANSWER_SHEET_A4_DRAWABLE_CONTENT_INSET_X_PX = 10;
export const ANSWER_SHEET_A4_DRAWABLE_CONTENT_INSET_TOP_PX = 10;
/** 底边收缩略小，与样式 padding-bottom 一致 */
export const ANSWER_SHEET_A4_DRAWABLE_CONTENT_INSET_BOTTOM_PX = 5;
/** @deprecated 同 INSET_X_PX，仅顶/左/右 */
export const ANSWER_SHEET_A4_DRAWABLE_CONTENT_INSET_PX = ANSWER_SHEET_A4_DRAWABLE_CONTENT_INSET_X_PX;
/** 分页与调试用的竖向可绘制高度 */
export const ANSWER_SHEET_A4_DRAWABLE_INNER_HEIGHT_PX =
  ANSWER_SHEET_A4_DRAWABLE_CONTENT_HEIGHT_PX
  - ANSWER_SHEET_A4_DRAWABLE_CONTENT_INSET_TOP_PX
  - ANSWER_SHEET_A4_DRAWABLE_CONTENT_INSET_BOTTOM_PX;

/**
 * A3 两栏：单栏竖向内容区基准高度（px），与预览 `.sheet-safe-area` 定位框一致。
 * 内侧再按 top/bottom inset 收缩后才是内容与分页所用高度（复用 A4 的 INSET_TOP / INSET_BOTTOM）。
 */
export const ANSWER_SHEET_A3_TWO_COL_PANE_DRAWABLE_CONTENT_HEIGHT_PX = 1019;
/** A3 单栏内侧可绘制高度（px）= 内容区基准 − 顶/底 inset */
export const ANSWER_SHEET_A3_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX =
  ANSWER_SHEET_A3_TWO_COL_PANE_DRAWABLE_CONTENT_HEIGHT_PX
  - ANSWER_SHEET_A4_DRAWABLE_CONTENT_INSET_TOP_PX
  - ANSWER_SHEET_A4_DRAWABLE_CONTENT_INSET_BOTTOM_PX;
// 计算结果: 1019 - 10 - 5 = 1004px

/**
 * 8K 横向 390×270mm：单栏竖向内容区基准高度（px）。
 * 内侧再按 top/bottom inset 收缩后才是内容与分页所用高度（复用 A4 的 INSET_TOP / INSET_BOTTOM）。
 */
export const ANSWER_SHEET_8K_TWO_COL_PANE_DRAWABLE_CONTENT_HEIGHT_PX = 917;
/** 8K 单栏内侧可绘制高度（px）= 内容区基准 − 顶/底 inset */
export const ANSWER_SHEET_8K_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX =
  ANSWER_SHEET_8K_TWO_COL_PANE_DRAWABLE_CONTENT_HEIGHT_PX
  - ANSWER_SHEET_A4_DRAWABLE_CONTENT_INSET_TOP_PX
  - ANSWER_SHEET_A4_DRAWABLE_CONTENT_INSET_BOTTOM_PX;
// 计算结果: 917 - 10 - 5 = 902px

/**
 * A4 首页填涂顶区估算高度（px）：与 `.sheet-drawable-leader` 块高度一致（offsetHeight），
 * 不含 `.sheet-preview .sheet-drawable-leader` 已删除的 margin-top:20px。
 */
export const ANSWER_SHEET_A4_FILLTYPE_ADMISSION_HEIGHT_PX = 370;
export const ANSWER_SHEET_A4_FILLTYPE_BARCODE_HEIGHT_PX = 310;
export const ANSWER_SHEET_A4_FILLTYPE_SHORT_NUMBER_HEIGHT_PX = 250;

/**
 * @param {string} [fillType] form.fillType：admission | barcode | short-number | class-number 等
 */
export function getAnswerSheetA4FillTypeLeaderHeightPx(fillType) {
  const t = fillType || 'admission';
  if (t === 'barcode') return ANSWER_SHEET_A4_FILLTYPE_BARCODE_HEIGHT_PX;
  if (t === 'short-number') return ANSWER_SHEET_A4_FILLTYPE_SHORT_NUMBER_HEIGHT_PX;
  /* 班级填涂等未单独标高：与准考证同档占位 */
  return ANSWER_SHEET_A4_FILLTYPE_ADMISSION_HEIGHT_PX;
}
/** 分页底部安全距离（权重单位）；首页与续页统一为 0 */
export const PAGINATION_BOTTOM_RESERVE_PX = 0;
/** @deprecated 曾为续页测量预留；分页现已不用 DOM，常量保留以免外部引用报错 */
export const PAGINATION_CONTINUATION_DOM_BOTTOM_PX = 6;
export const PAGINATION_MAX_REFLOW_ROUNDS = 3;
/** @deprecated 曾用于推导 ANSWER_PAGINATION_EXTRA_PX；放宽已改为固定 5px */
export const ANSWER_PAGINATION_EXTRA_ROWS = 1;
/** 第二页及后续页解答题额外放宽权重；0 表示续页与首页同为 {@link ANSWER_PAGINATION_EXTRA_PX}（总放宽 5px） */
export const ANSWER_CONTINUATION_EXTRA_WEIGHT = 0;
/** 语文作文续页在通用底部预留上额外多留的权重 */
export const CHINESE_CONTINUATION_EXTRA_BOTTOM_WEIGHT = 0;
/** 填空续页底部预留权重：0 表示预览分页不在行间扣除底部留白（旧默认约 70px 已关闭） */
export const FILLBLANK_CONTINUATION_EXTRA_BOTTOM_WEIGHT = 0;
/** A4 填空续页追加预留权重（与上行叠加）；当前为 0 */
export const FILLBLANK_A4_CONTINUATION_EXTRA_RESERVE_WEIGHT = 0;

/** 填空预览行默认高度（px），与 FillBlankQuestionType 单行对齐 */
export const FILLBLANK_ROW_HEIGHT_PX = 35;
/** 填空：分页时落在页内的最后一行额外加高（px），默认行高 + 本项 */
export const FILLBLANK_PAGE_LAST_ROW_EXTRA_PX = 10;

/** 预览分页：相邻大题块竖向间距（px），与原「权重 1 格」一致 */
export const SECTION_BLOCK_VERTICAL_GAP_PX = 10;

/** `.question-section-item` 上沿内边距（px）：与 {@link AnswerSheetSectionTitle} 同源 */
export const SUBJECTIVE_SECTION_ITEM_PADDING_TOP_PX = SECTION_TITLE_BAR_PADDING_TOP_PX;
/** `.section-title` 固定行高（px）：与 {@link AnswerSheetSectionTitle} 同源 */
export const SUBJECTIVE_SECTION_TITLE_LINE_HEIGHT_PX = SECTION_TITLE_BAR_LINE_HEIGHT_PX;
/**
 * 分页中大题标题栏总占位（px）；数值来自 {@link getSectionTitleBarTotalPx}，
 * 不含相邻大题块竖向间距 {@link SECTION_BLOCK_VERTICAL_GAP_PX}。
 */
export const SUBJECTIVE_SECTION_HEADER_PX = getSectionTitleBarTotalPx();
/** 英语作文行行高（px），与填空预览行一致 */
export const ENGLISH_LINE_ROW_HEIGHT_PX = FILLBLANK_ROW_HEIGHT_PX;
/** 语文作文：方格行内容高度（px） */
export const CHINESE_COMPOSITION_CELL_HEIGHT_PX = 30;
/** 语文作文：相邻两行网格之间的间距（px），与 ChineseQuestionType `gap` 一致 */
export const CHINESE_COMPOSITION_ROW_GAP_PX = 8;
/** 语文作文：分页基准「一行」高度（px）= 行高 + 行间距，与填空逐行推演一致 */
export const CHINESE_COMPOSITION_ROW_HEIGHT_PX =
  CHINESE_COMPOSITION_CELL_HEIGHT_PX + CHINESE_COMPOSITION_ROW_GAP_PX;
/** 与 ROW_HEIGHT 一致（旧名） */
export const CHINESE_COMPOSITION_ROW_STEP_PX = CHINESE_COMPOSITION_ROW_HEIGHT_PX;
/** 语文作文：页内最后一预览行额外加高（px），推演方式同 FILLBLANK_PAGE_LAST_ROW_EXTRA_PX */
export const CHINESE_PAGE_LAST_ROW_EXTRA_PX = 8;
/**
 * @deprecated 解答题分页按整框 `.answer-render-item` 高度（areaHeight）记账，不再叠加 chrome。
 * 保留导出以免旧代码引用报错。
 */
export const ANSWER_ITEM_PAGINATION_CHROME_PX = 28;
/** 解答题分页：最小 body+chrome 占位（px），对齐原最少 3 格 */
export const ANSWER_MIN_ITEM_BODY_PX = 3 * PAGINATION_WEIGHT_UNIT_PX;

/** 解答题分页 usableRemaining / 最大题区高度折算放宽（px），控制台「放宽像素_answerSlackPx」基础项 */
export const ANSWER_PAGINATION_EXTRA_PX = 0;
export const ANSWER_CONTINUATION_EXTRA_PX = ANSWER_CONTINUATION_EXTRA_WEIGHT * PAGINATION_WEIGHT_UNIT_PX;
export const CHINESE_CONTINUATION_EXTRA_BOTTOM_PX = CHINESE_CONTINUATION_EXTRA_BOTTOM_WEIGHT * PAGINATION_WEIGHT_UNIT_PX;
export const FILLBLANK_CONTINUATION_EXTRA_BOTTOM_PX = FILLBLANK_CONTINUATION_EXTRA_BOTTOM_WEIGHT * PAGINATION_WEIGHT_UNIT_PX;
export const FILLBLANK_A4_CONTINUATION_EXTRA_RESERVE_PX = FILLBLANK_A4_CONTINUATION_EXTRA_RESERVE_WEIGHT * PAGINATION_WEIGHT_UNIT_PX;

/** 客观题排版：每竖列题数 */
export const OBJECTIVE_QUESTIONS_PER_COLUMN = 5;

/**
 * 实测单列题型区高度（px）：n 道题目占用的竖向高度（含 .question-row 间距；末行无 margin-bottom）。
 * 分页：整卷按 px 推演（previewPages），高度见 Editor estimateObjectiveBandSliceHeightPx / getSectionPaginationBodyHeightPx。
 */
export const OBJECTIVE_COLUMN_BODY_HEIGHT_PX_BY_ROW_COUNT = Object.freeze({
  1: 29,
  2: 49,
  3: 69,
  4: 89,
  5: 95
});

/** @deprecated 已由 OBJECTIVE_COLUMN_BODY_HEIGHT_PX_BY_ROW_COUNT 取代，仅作文档与旧注释参照 */
export const OBJECTIVE_QUESTION_ROW_HEIGHT_PX = 18;
/** @deprecated 同上 */
export const OBJECTIVE_QUESTION_ROW_GAP_PX = 5;
/**
 * 横带内列网格外的附加高度（px）。实测列高已含行间留白，此处默认不再叠加。
 */
export const OBJECTIVE_BAND_BODY_EXTRA_PX = 0;
/** 横带首片上方大题标题占位（px），与主观大题标题栏合计一致（不含块间距） */
export const OBJECTIVE_BAND_FIRST_SLICE_TITLE_PX = SUBJECTIVE_SECTION_HEADER_PX;
/** 客观题块边框、内边距等 chrome（px）；预览分页已不计入，列高以 OBJECTIVE_COLUMN_BODY_HEIGHT_PX_BY_ROW_COUNT 为准 */
export const OBJECTIVE_BLOCK_CHROME_PX = 22;
/**
 * 仅 A4：首页客观横带分页不再叠加通用 bottomReserve（权重单位）。
 * 首页公式容量已隐含底部留白策略；与其它题型共用 remaining 时仍只作用于客观分支判定。
 * A3/8K 首页客观仍扣 bottomReserve，避免影响其它版式。
 */
export const OBJECTIVE_A4_FIRST_PAGE_PACKING_BOTTOM_RESERVE_WEIGHT = 0;
/**
 * 仅 A4 续页：客观横带判定不再扣 bottomReserve（权重单位），避免与公式容量叠加后过早拆到下一页。
 */
export const OBJECTIVE_A4_CONTINUATION_PACKING_BOTTOM_RESERVE_WEIGHT = 0;
/**
 * 仅 A4 首页：放宽「能否放下一条横带」的等价剩余容量（权重单位），略压低首屏客观区底部留白。
 */
export const OBJECTIVE_A4_FIRST_PAGE_PACKING_SLACK_WEIGHT = 9;
/**
 * 仅 A4 第二页及以后：同上，缓解续页客观区过早分页、底部留白过大。
 */
export const OBJECTIVE_A4_CONTINUATION_PAGE_PACKING_SLACK_WEIGHT = 8;

/**
 * 历史：客观题块结束后补给后续题型的权重，曾与 previewPages 共用 remaining。
 * 分页已改为题块边界按页账本同步（整页容量 − 已放置 sections），不再使用该补齐。
 */
export const OBJECTIVE_TO_OTHER_HANDOFF_PAD_WEIGHT = 8;

/**
 * 客观题单列内容高度（px）：按实测档 1～5 行分别计算；超过 5 行按第 5 档后再按 +20px/行估算。
 * @param {number} [questionCount] 该列题数，默认 OBJECTIVE_QUESTIONS_PER_COLUMN
 */
export function getObjectiveColumnBodyHeightPx(questionCount = OBJECTIVE_QUESTIONS_PER_COLUMN) {
  const n = Math.max(1, Math.floor(Number(questionCount) || OBJECTIVE_QUESTIONS_PER_COLUMN));
  const map = OBJECTIVE_COLUMN_BODY_HEIGHT_PX_BY_ROW_COUNT;
  if (n <= 5) return map[n];
  return map[5] + (n - 5) * 20;
}

/**
 * 一条客观横带主体高度（px）：多列并排时栏高取列内最大题数对应高度，再加 OBJECTIVE_BAND_BODY_EXTRA_PX。
 */
export function getObjectiveBandBodyHeightPx(questionCount = OBJECTIVE_QUESTIONS_PER_COLUMN) {
  return getObjectiveColumnBodyHeightPx(questionCount) + OBJECTIVE_BAND_BODY_EXTRA_PX;
}

/** A4：每条横带默认最多列数（单选/多选选项 >4 时由 AnswerSheetEditor.buildObjectiveBands 降为 3 列） */
export const OBJECTIVE_BAND_MAX_COLS_A4 = 4;
/** A3 两栏：每条横带默认最多列数（同上，宽题 3 列） */
export const OBJECTIVE_BAND_MAX_COLS_A3_TWO_COL = 4;
/** A3 三栏 / 8K：每条横带最多列数 */
export const OBJECTIVE_BAND_MAX_COLS_A3_8K = 3;

/**
 * A3 答题区分栏分页：与「A4 容量 × 栏数」脱钩的独立权重（与 mixin 中 remaining 单位一致）。
 * 首项仍扣 getFirstPageFillTypePenalty()；续页不扣。
 */
export const A3_MULTICOL_2COL_FIRST_PAGE_BASE = 30;
export const A3_MULTICOL_2COL_CONTINUATION_BASE = 56;
export const A3_MULTICOL_3COL_FIRST_PAGE_BASE = 42;
export const A3_MULTICOL_3COL_CONTINUATION_BASE = 74;

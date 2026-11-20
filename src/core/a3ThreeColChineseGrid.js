/** A3 三栏宽栏（grid 比例 4fr）：语文作文单行方格数 */
export const CHINESE_GRID_COLS_A3_FR4 = 19;

/** A3 三栏窄栏（grid 比例 3fr）：语文作文单行方格数 */
export const CHINESE_GRID_COLS_A3_FR3 = 14;

/** 8K 三栏宽栏（grid 比例 4fr）：语文作文单行方格数 */
export const CHINESE_GRID_COLS_8K_THREE_COL_FR4 = 18;

/** 8K 三栏窄栏（grid 比例 3fr）：语文作文单行方格数 */
export const CHINESE_GRID_COLS_8K_THREE_COL_FR3 = 13;

/**
 * 与答题卡预览三栏 grid 一致：奇数页 4:3:3，偶数页 3:3:4。
 * @param {number} pageIdx0 物理页下标（从 0 起）
 * @param {number} paneIdx1Based 栏序号 1～3（左→右）
 */
export function threeColPaneIsFrWide(pageIdx0, paneIdx1Based) {
  const firstPattern = pageIdx0 % 2 === 0;
  const i = Math.max(0, Math.min(2, Number(paneIdx1Based) - 1));
  return firstPattern ? i === 0 : i === 2;
}

/**
 * @param {number} pageIdx0
 * @param {number} paneIdx1Based
 * @returns {19|14}
 */
export function getA3ThreeColChineseGridColumns(pageIdx0, paneIdx1Based) {
  return threeColPaneIsFrWide(pageIdx0, paneIdx1Based)
    ? CHINESE_GRID_COLS_A3_FR4
    : CHINESE_GRID_COLS_A3_FR3;
}

/**
 * @param {number} pageIdx0
 * @param {number} paneIdx1Based
 * @returns {18|13}
 */
export function get8KThreeColChineseGridColumns(pageIdx0, paneIdx1Based) {
  return threeColPaneIsFrWide(pageIdx0, paneIdx1Based)
    ? CHINESE_GRID_COLS_8K_THREE_COL_FR4
    : CHINESE_GRID_COLS_8K_THREE_COL_FR3;
}

/** A3 三栏下语文作文「分页行数」按每行最少格数计（与最窄栏一致），避免竖向容量不足 */
export const CHINESE_GRID_COLS_A3_PAGINATION_BASE = CHINESE_GRID_COLS_A3_FR3;

/** 8K 三栏：分页行数按最窄栏格数计 */
export const CHINESE_GRID_COLS_8K_THREE_COL_PAGINATION_BASE = CHINESE_GRID_COLS_8K_THREE_COL_FR3;

/** 8K 双栏：语文作文单行方格数（两栏等宽） */
export const CHINESE_GRID_COLS_8K_TWO_COL = 20;

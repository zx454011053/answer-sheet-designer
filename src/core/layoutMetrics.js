/**
 * 版面度量：页容量、栏容量、可绘制高度换算。
 *
 * 原实现由 useAnswerSheetMeasure(vm) 以「读 vm.form」的方式散装返回方法，隐式依赖组件实例；
 * 这里改为工厂函数 + 读取器（readers），调用方传入取值函数，天然适配 Vue 的响应式依赖收集，
 * 也使同一套账本可以在无组件环境（如单测、导出服务）中跑。
 */
import {
  A3_MULTICOL_2COL_CONTINUATION_BASE,
  A3_MULTICOL_2COL_FIRST_PAGE_BASE,
  A3_MULTICOL_3COL_CONTINUATION_BASE,
  A3_MULTICOL_3COL_FIRST_PAGE_BASE,
  ANSWER_SHEET_A3_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX,
  ANSWER_SHEET_A4_DRAWABLE_INNER_HEIGHT_PX,
  ANSWER_SHEET_8K_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX,
  PAGINATION_BOTTOM_RESERVE_PX,
  PAGINATION_WEIGHT_UNIT_PX,
  getAnswerSheetA4FillTypeLeaderHeightPx
} from './constants';
import { toPageWeight } from './pageLayout';

/** 页容量下限（权重单位 × 单位像素） */
const MIN_PAGE_PX = 8 * PAGINATION_WEIGHT_UNIT_PX;
/** 栏容量下限 */
const MIN_COLUMN_PX = 4 * PAGINATION_WEIGHT_UNIT_PX;

/**
 * 首页 / 续页容量基数（权重位），按版式区分
 * @param {string} layoutType
 */
export function getCapacityBaseByLayout(layoutType) {
  if (layoutType === 'A3') return { firstPage: 24, continuationPage: 32 };
  if (layoutType === '8K') return { firstPage: 19, continuationPage: 25 };
  return { firstPage: 22, continuationPage: 28 };
}

/**
 * 首页填涂顶区对容量的惩罚：准考证位数越多，需为定位区留出更多空白
 * @param {string} fillType
 * @param {number} admissionColumns
 */
export function getFirstPageFillTypePenalty(fillType, admissionColumns) {
  const type = fillType || 'admission';
  if (type === 'admission') {
    const columns = Number(admissionColumns) || 9;
    return 6 + Math.max(0, Math.ceil((columns - 9) / 3));
  }
  if (type === 'barcode') return 5;
  if (type === 'short-number') return 4;
  if (type === 'class-number') return 3;
  return 3;
}

/**
 * A3 / 8K 分栏的整页容量（与「A4 容量 × 栏数」脱钩）
 * @param {{ layoutType?: string, columnCount?: number, fillType?: string, admissionColumns?: number }} params
 * @returns {{first:number, continuation:number}|null}
 */
export function getA3MulticolSheetCapacities(params = {}) {
  const layoutType = params.layoutType || 'A4';
  const columnCount = Number(params.columnCount);
  const isMulticol = (layoutType === 'A3' || layoutType === '8K')
    && (columnCount === 2 || columnCount === 3);
  if (!isMulticol) return null;
  const penalty = getFirstPageFillTypePenalty(params.fillType, params.admissionColumns);
  if (columnCount === 2) {
    return {
      first: Math.max(8, A3_MULTICOL_2COL_FIRST_PAGE_BASE - penalty),
      continuation: Math.max(8, A3_MULTICOL_2COL_CONTINUATION_BASE)
    };
  }
  return {
    first: Math.max(8, A3_MULTICOL_3COL_FIRST_PAGE_BASE - penalty),
    continuation: Math.max(8, A3_MULTICOL_3COL_CONTINUATION_BASE)
  };
}

/** 单栏可绘制内侧高度（A3 / 8K 两栏、三栏共用） */
export function getMulticolPaneDrawableInnerHeightPx(layoutType) {
  return layoutType === '8K'
    ? ANSWER_SHEET_8K_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX
    : ANSWER_SHEET_A3_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX;
}

/** 首页顶区（填涂/须知）实际高度：有 DOM 实测优先，否则用常量估算 */
export function resolveFirstPageLeaderHeightPx(fillType, measuredHeightPx) {
  const measured = Number(measuredHeightPx);
  if (Number.isFinite(measured) && measured > 0) return measured;
  return getAnswerSheetA4FillTypeLeaderHeightPx(fillType);
}

/** 底部安全距离（px）；沿用原有换算（最小 1 个权重位） */
export function getPageBottomReservePx() {
  return toPageWeight(PAGINATION_BOTTOM_RESERVE_PX) * PAGINATION_WEIGHT_UNIT_PX;
}

/**
 * 创建一套页面度量方法。读取器在调用时求值，保证 Vue 能收集依赖。
 *
 * @param {Object} readers
 * @param {() => (string|undefined)} readers.layoutType
 * @param {() => (number|undefined)} readers.columnCount A3/8K 答题区分栏数
 * @param {() => (string|undefined)} readers.fillType
 * @param {() => (number|undefined)} readers.admissionColumns
 * @param {() => (number|null|undefined)} [readers.measuredLeaderHeightPx]
 */
export function createSheetMetrics(readers) {
  const layoutType = () => readers.layoutType() || 'A4';
  const columnCount = () => Number(readers.columnCount()) || 2;
  const fillType = () => readers.fillType() || 'admission';
  const admissionColumns = () => Number(readers.admissionColumns()) || 9;
  const measuredLeader = () =>
    (typeof readers.measuredLeaderHeightPx === 'function' ? readers.measuredLeaderHeightPx() : null);

  const isMulticol = () => {
    const l = layoutType();
    return (l === 'A3' || l === '8K') && (columnCount() === 2 || columnCount() === 3);
  };

  const metrics = {
    isA3MultiColumnLayout: () => isMulticol(),
    isA3TwoColPxSheetLayout: () => (layoutType() === 'A3' || layoutType() === '8K') && columnCount() === 2,
    isA3ThreeColPxSheetLayout: () => (layoutType() === 'A3' || layoutType() === '8K') && columnCount() === 3,
    getMulticolPaneDrawableInnerHeightPx: () => getMulticolPaneDrawableInnerHeightPx(layoutType()),
    getA3MulticolSheetCapacities: () => getA3MulticolSheetCapacities({
      layoutType: layoutType(),
      columnCount: columnCount(),
      fillType: fillType(),
      admissionColumns: admissionColumns()
    }),
    getFirstPageFillTypePenalty: () => getFirstPageFillTypePenalty(fillType(), admissionColumns()),
    getFirstPageContentCapacity: () => {
      const layout = getCapacityBaseByLayout(layoutType());
      return Math.max(12, layout.firstPage - getFirstPageFillTypePenalty(fillType(), admissionColumns()));
    },
    getContinuationPageContentCapacity: () =>
      Math.max(18, getCapacityBaseByLayout(layoutType()).continuationPage),
    getPageColumnMultiplier: () =>
      (layoutType() === 'A3' || layoutType() === '8K') ? columnCount() : 1,
    getPageBottomReservePx,

    getA3TwoColColumnCapsPx(pageIndex = 0) {
      const inner = getMulticolPaneDrawableInnerHeightPx(layoutType());
      if (pageIndex > 0) {
        const h = Math.max(MIN_PAGE_PX, inner);
        return [h, h];
      }
      const leaderPx = resolveFirstPageLeaderHeightPx(fillType(), measuredLeader());
      return [Math.max(MIN_PAGE_PX, inner - leaderPx), Math.max(MIN_PAGE_PX, inner)];
    },

    getA3ThreeColColumnCapsPx(pageIndex = 0) {
      const inner = getMulticolPaneDrawableInnerHeightPx(layoutType());
      if (pageIndex > 0) {
        const h = Math.max(MIN_PAGE_PX, inner);
        return [h, h, h];
      }
      const leaderPx = resolveFirstPageLeaderHeightPx(fillType(), measuredLeader());
      return [
        Math.max(MIN_PAGE_PX, inner - leaderPx),
        Math.max(MIN_PAGE_PX, inner),
        Math.max(MIN_PAGE_PX, inner)
      ];
    },

    measureA3ThreeColSheetPageContentHeightPx(pageIndex = 0) {
      const caps = metrics.getA3ThreeColColumnCapsPx(pageIndex);
      const sum = caps.reduce((s, h) => s + h, 0);
      return Math.max(MIN_PAGE_PX, sum);
    },

    measureA3TwoColSheetPageContentHeightPx(pageIndex = 0) {
      const inner = getMulticolPaneDrawableInnerHeightPx(layoutType());
      if (pageIndex > 0) return Math.max(MIN_PAGE_PX, inner * 2);
      const leaderPx = resolveFirstPageLeaderHeightPx(fillType(), measuredLeader());
      return Math.max(MIN_PAGE_PX, inner - leaderPx) + Math.max(MIN_PAGE_PX, inner);
    },

    /** A4 非分栏：固定内侧高度减去首页顶区；非 A4 或分栏版式返回 null（走权重账本） */
    measureA4NonMulticolDrawableContentHeightPx(pageIndex = 0) {
      if (metrics.getA3MulticolSheetCapacities()) return null;
      if (layoutType() !== 'A4') return null;
      const target = ANSWER_SHEET_A4_DRAWABLE_INNER_HEIGHT_PX;
      const leaderPx = pageIndex === 0
        ? resolveFirstPageLeaderHeightPx(fillType(), measuredLeader())
        : 0;
      return Math.max(MIN_PAGE_PX, pageIndex === 0 ? target - leaderPx : target);
    },

    getSheetPageCapacityWeight(pageIndex = 0) {
      if (metrics.isA3TwoColPxSheetLayout() || metrics.isA3ThreeColPxSheetLayout()) {
        return Math.max(8, Math.floor(metrics.getSheetPageContentHeightPx(pageIndex) / PAGINATION_WEIGHT_UNIT_PX));
      }
      const mc = metrics.getA3MulticolSheetCapacities();
      if (mc) {
        const base = pageIndex === 0 ? mc.first : mc.continuation;
        return Math.max(8, Math.floor(Number(base) || 0));
      }
      const colMult = Math.max(1, Number(metrics.getPageColumnMultiplier()) || 1);
      const capacity = pageIndex === 0
        ? metrics.getFirstPageContentCapacity()
        : metrics.getContinuationPageContentCapacity();
      return Math.max(8, Math.floor(Number(capacity) * colMult));
    },

    getSheetPageContentHeightPx(pageIndex = 0) {
      if (metrics.isA3TwoColPxSheetLayout()) {
        return metrics.measureA3TwoColSheetPageContentHeightPx(pageIndex);
      }
      if (metrics.isA3ThreeColPxSheetLayout()) {
        return metrics.measureA3ThreeColSheetPageContentHeightPx(pageIndex);
      }
      const fixed = metrics.measureA4NonMulticolDrawableContentHeightPx(pageIndex);
      if (fixed != null) return fixed;
      const weight = metrics.getSheetPageCapacityWeight(pageIndex);
      return Math.max(MIN_PAGE_PX, Number(weight) * PAGINATION_WEIGHT_UNIT_PX);
    },

    getAnswerSheetColumnContentHeightPx(pageIndex = 0) {
      if (metrics.isA3TwoColPxSheetLayout() || metrics.isA3ThreeColPxSheetLayout()) {
        return Math.max(MIN_COLUMN_PX, getMulticolPaneDrawableInnerHeightPx(layoutType()));
      }
      const fixed = metrics.measureA4NonMulticolDrawableContentHeightPx(pageIndex);
      if (fixed != null) return Math.max(MIN_COLUMN_PX, fixed);
      const weight = metrics.getAnswerSheetColumnCapacityWeight(pageIndex);
      return Math.max(MIN_COLUMN_PX, Number(weight) * PAGINATION_WEIGHT_UNIT_PX);
    },

    getAnswerSheetColumnCapacityWeight(pageIndex = 0) {
      if (metrics.isA3TwoColPxSheetLayout()) {
        const px = metrics.getAnswerSheetColumnContentHeightPx(pageIndex);
        return Math.max(4, Math.floor(px / PAGINATION_WEIGHT_UNIT_PX));
      }
      if (metrics.isA3ThreeColPxSheetLayout()) {
        const caps = metrics.getA3ThreeColColumnCapsPx(pageIndex);
        const maxPx = caps.length ? Math.max(...caps) : getMulticolPaneDrawableInnerHeightPx(layoutType());
        return Math.max(4, Math.floor(maxPx / PAGINATION_WEIGHT_UNIT_PX));
      }
      const mc = metrics.getA3MulticolSheetCapacities();
      if (mc) {
        const base = pageIndex === 0 ? mc.first : mc.continuation;
        const n = Math.max(1, Number(columnCount()) || 1);
        return Math.max(4, Math.floor(base / n));
      }
      return metrics.getSheetPageCapacityWeight(pageIndex);
    },

    toPageWeight
  };

  return metrics;
}

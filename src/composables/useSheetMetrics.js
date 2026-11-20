/**
 * 页面度量组合式封装：把 model 的响应式状态接到 core/layoutMetrics 的账本函数上。
 */
import { createSheetMetrics } from '@/core/layoutMetrics';

/**
 * @param {Object} model useSheetModel 的返回值
 */
export function useSheetMetrics(model) {
  const metrics = createSheetMetrics({
    layoutType: () => model.layoutType.value,
    columnCount: () => model.effectiveA3ColumnCount.value,
    fillType: () => model.form.fillType,
    admissionColumns: () => model.form.admissionColumns,
    measuredLeaderHeightPx: () => model.firstPageLeaderMeasuredHeightPx.value
  });
  return metrics;
}

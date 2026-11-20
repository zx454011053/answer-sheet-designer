import { resolveSectionPaginationBodyHeightPx } from './sectionPaginationHeight';
import {
  SECTION_BLOCK_VERTICAL_GAP_PX,
  PAGINATION_WEIGHT_UNIT_PX
} from './constants';
import {
  get8KThreeColChineseGridColumns,
  getA3ThreeColChineseGridColumns
} from './a3ThreeColChineseGrid';

/**
 * @typedef {object} A3MulticolSplitContext
 * @property {number} effectiveA3ColumnCount
 * @property {() => boolean} isA3TwoColPxSheetLayout
 * @property {() => boolean} isA3ThreeColPxSheetLayout
 * @property {(pageIdx: number) => number[]} getA3TwoColColumnCapsPx
 * @property {(pageIdx: number) => number[]} getA3ThreeColColumnCapsPx
 * @property {() => { first: number, continuation: number } | null} getA3MulticolSheetCapacities
 * @property {(section: object, pageSections: object[], secIdx: number) => boolean} isObjectiveBandMergedWithPrevious
 * @property {boolean} is8KLayout
 */

function objectiveBandMergeFollowPair(prevSection, section, isObjectiveBandMergedWithPrevious) {
  if (!prevSection || !section) return false;
  return isObjectiveBandMergedWithPrevious(section, [prevSection, section], 1);
}

function patchChineseSectionA3ThreeColGrid(section, pageIdx, pane1Based, is8KLayout) {
  if (!section || section.type !== 'chinese') return section;
  const columns = is8KLayout
    ? get8KThreeColChineseGridColumns(pageIdx, pane1Based)
    : getA3ThreeColChineseGridColumns(pageIdx, pane1Based);
  return {
    ...section,
    columns
  };
}

/**
 * @param {A3MulticolSplitContext} ctx
 */
export function placeAnswerSectionAcrossA3MulticolColumns(ctx, section, cols, used, columnCaps, ciStart) {
  const { isObjectiveBandMergedWithPrevious } = ctx;
  const n = Math.max(1, Array.isArray(columnCaps) ? columnCaps.length : 1);
  const items = Array.isArray(section.items) ? section.items.slice() : [];
  let ci = Math.min(Math.max(0, ciStart), n - 1);
  let sliceCounter = 0;
  let itemIdx = 0;
  const baseKey = section.chunkKey != null ? String(section.chunkKey) : String(section.key != null ? section.key : section.id);
  const buildSlice = (sliceItems) => {
    const suppressTitle = Boolean(section.isContinuation || sliceCounter > 0);
    return {
      ...section,
      items: sliceItems,
      a3SuppressSectionTitle: suppressTitle,
      a3AnswerSliceKey: `${baseKey}__a3s${sliceCounter}`
    };
  };
  const sliceBodyHeightPx = (sl) => resolveSectionPaginationBodyHeightPx(sl);
  const capAt = (idx) => Math.max(0, Number(columnCaps[idx]) || 0);
  while (itemIdx < items.length) {
    const sliceItems = [];
    let probeSlice = buildSlice([items[itemIdx]]);
    let hProbe = sliceBodyHeightPx(probeSlice);
    let lastInCol = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
    let gapPx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(lastInCol, probeSlice, isObjectiveBandMergedWithPrevious)
      ? SECTION_BLOCK_VERTICAL_GAP_PX
      : 0;
    while (ci < n - 1 && used[ci] + gapPx + hProbe > capAt(ci)) {
      ci += 1;
      lastInCol = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
      gapPx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(lastInCol, probeSlice, isObjectiveBandMergedWithPrevious)
        ? SECTION_BLOCK_VERTICAL_GAP_PX
        : 0;
    }
    while (itemIdx < items.length) {
      const candItems = [...sliceItems, items[itemIdx]];
      const candSlice = buildSlice(candItems);
      const candH = sliceBodyHeightPx(candSlice);
      lastInCol = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
      gapPx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(lastInCol, candSlice, isObjectiveBandMergedWithPrevious)
        ? SECTION_BLOCK_VERTICAL_GAP_PX
        : 0;
      if (used[ci] + gapPx + candH <= capAt(ci)) {
        sliceItems.push(items[itemIdx]);
        itemIdx += 1;
      } else {
        break;
      }
    }
    if (sliceItems.length === 0) {
      sliceItems.push(items[itemIdx]);
      itemIdx += 1;
    }
    const finalSlice = buildSlice(sliceItems);
    const hFinal = sliceBodyHeightPx(finalSlice);
    const lastPlaced = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
    const gapPlacePx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(lastPlaced, finalSlice, isObjectiveBandMergedWithPrevious)
      ? SECTION_BLOCK_VERTICAL_GAP_PX
      : 0;
    cols[ci].push(finalSlice);
    used[ci] += gapPlacePx + hFinal;
    sliceCounter += 1;
  }
  return ci;
}

function getSectionHeightPxForA3ColumnSplit(section) {
  return resolveSectionPaginationBodyHeightPx(section);
}

/**
 * A3 物理分栏：按与 previewPages 一致的像素高度把本页 sections 分到各栏
 * @param {A3MulticolSplitContext} ctx
 * @param {object[]} sections
 * @param {number} pageIdx
 * @returns {object[][]}
 */
export function splitA3MulticolSectionsIntoColumns(ctx, sections, pageIdx) {
  const {
    effectiveA3ColumnCount,
    isA3TwoColPxSheetLayout,
    isA3ThreeColPxSheetLayout,
    getA3TwoColColumnCapsPx,
    getA3ThreeColColumnCapsPx,
    getA3MulticolSheetCapacities,
    isObjectiveBandMergedWithPrevious,
    is8KLayout
  } = ctx;

  const n = Math.max(1, Number(effectiveA3ColumnCount) || 1);
  const list = Array.isArray(sections) ? sections : [];

  if (isA3TwoColPxSheetLayout()) {
    const caps = getA3TwoColColumnCapsPx(pageIdx);
    const cols = Array.from({ length: n }, () => []);
    const used = Array.from({ length: n }, () => 0);
    let ci = 0;
    list.forEach((section) => {
      if (section.type === 'answer') {
        ci = placeAnswerSectionAcrossA3MulticolColumns(ctx, section, cols, used, caps, ci);
        return;
      }
      const lastInCol = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
      let gapPx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(lastInCol, section, isObjectiveBandMergedWithPrevious)
        ? SECTION_BLOCK_VERTICAL_GAP_PX
        : 0;
      const h = getSectionHeightPxForA3ColumnSplit(section);
      while (ci < n - 1 && used[ci] + gapPx + h > caps[ci]) {
        ci += 1;
        const last2 = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
        gapPx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(last2, section, isObjectiveBandMergedWithPrevious)
          ? SECTION_BLOCK_VERTICAL_GAP_PX
          : 0;
      }
      const lastPlaced = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
      const gapPlacePx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(lastPlaced, section, isObjectiveBandMergedWithPrevious)
        ? SECTION_BLOCK_VERTICAL_GAP_PX
        : 0;
      cols[ci].push(section);
      used[ci] += gapPlacePx + h;
    });
    return cols;
  }

  if (isA3ThreeColPxSheetLayout()) {
    const caps = getA3ThreeColColumnCapsPx(pageIdx);
    const cols = Array.from({ length: n }, () => []);
    const used = Array.from({ length: n }, () => 0);
    let ci = 0;
    list.forEach((section) => {
      if (section.type === 'answer') {
        ci = placeAnswerSectionAcrossA3MulticolColumns(ctx, section, cols, used, caps, ci);
        return;
      }
      const lastInCol = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
      let gapPx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(lastInCol, section, isObjectiveBandMergedWithPrevious)
        ? SECTION_BLOCK_VERTICAL_GAP_PX
        : 0;
      const h = getSectionHeightPxForA3ColumnSplit(section);
      while (ci < n - 1 && used[ci] + gapPx + h > caps[ci]) {
        ci += 1;
        const last2 = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
        gapPx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(last2, section, isObjectiveBandMergedWithPrevious)
          ? SECTION_BLOCK_VERTICAL_GAP_PX
          : 0;
      }
      const lastPlaced = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
      const gapPlacePx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(lastPlaced, section, isObjectiveBandMergedWithPrevious)
        ? SECTION_BLOCK_VERTICAL_GAP_PX
        : 0;
      cols[ci].push(
        section.type === 'chinese'
          ? patchChineseSectionA3ThreeColGrid(section, pageIdx, ci + 1, is8KLayout)
          : section
      );
      used[ci] += gapPlacePx + h;
    });
    return cols;
  }

  const mc = getA3MulticolSheetCapacities();
  if (!mc) {
    return Array.from({ length: n }, (_, i) => (i === 0 ? list.slice() : []));
  }
  const totalCapPx = Math.max(
    8 * PAGINATION_WEIGHT_UNIT_PX,
    Math.floor(Number(pageIdx === 0 ? mc.first : mc.continuation) || 0) * PAGINATION_WEIGHT_UNIT_PX
  );
  const perColPx = Math.max(8 * PAGINATION_WEIGHT_UNIT_PX, Math.ceil(totalCapPx / n));
  const columnCaps = Array.from({ length: n }, () => perColPx);
  const cols = Array.from({ length: n }, () => []);
  const used = Array.from({ length: n }, () => 0);
  let ci = 0;
  list.forEach((section) => {
    if (section.type === 'answer') {
      ci = placeAnswerSectionAcrossA3MulticolColumns(ctx, section, cols, used, columnCaps, ci);
      return;
    }
    const lastInCol = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
    let gapPx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(lastInCol, section, isObjectiveBandMergedWithPrevious)
      ? SECTION_BLOCK_VERTICAL_GAP_PX
      : 0;
    const h = getSectionHeightPxForA3ColumnSplit(section);
    while (ci < n - 1 && used[ci] + gapPx + h > perColPx) {
      ci += 1;
      const last2 = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
      gapPx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(last2, section, isObjectiveBandMergedWithPrevious)
        ? SECTION_BLOCK_VERTICAL_GAP_PX
        : 0;
    }
    const lastPlaced = cols[ci].length ? cols[ci][cols[ci].length - 1] : null;
    const gapPlacePx = cols[ci].length > 0 && !objectiveBandMergeFollowPair(lastPlaced, section, isObjectiveBandMergedWithPrevious)
      ? SECTION_BLOCK_VERTICAL_GAP_PX
      : 0;
    cols[ci].push(section);
    used[ci] += gapPlacePx + h;
  });
  return cols;
}

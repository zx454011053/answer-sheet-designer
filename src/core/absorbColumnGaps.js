/**
 * 页尾空隙回收（弹性作答区）
 *
 * 分页是单遍 Next-Fit 贪心：一个题块放不下就整块推到下一页/下一栏，
 * 本页剩余的几十到几百像素就此空着。这些空隙不是「内容不够」，
 * 而是「切分粒度不够细」——下一块的第一个可切单位就比剩余空间大。
 *
 * 本模块在分页与分栏全部完成之后，对每个「终极容器」（A4 的一页、
 * A3/8K 的一栏）做一次后处理：把剩余高度补给该容器最末尾那个可拉伸的题块。
 *
 * 三条硬约束：
 * 1. 不改页数、不改栏数、不改题块顺序、不做任何切分决策；
 * 2. 只往「已经空着」的地方加内容，永远不把内容挤出纸面；
 * 3. 必须幂等：同一份输入反复调用结果一致，避免 computed 抖动。
 *
 * 可拉伸的题型（都是「多给一点书写空间」这种改动，不改变题目语义）：
 * - answer：加大最后一个作答区的 areaHeight；
 * - fillblank(long-line)：给最后一个长填空追加横线行。
 * 作文格（chinese / english）按行列矩阵排布，加行会破坏格子矩阵，不在此处动。
 */
import { SECTION_BLOCK_VERTICAL_GAP_PX, FILLBLANK_ROW_HEIGHT_PX } from './constants';
import { resolveSectionPaginationBodyHeightPx } from './sectionPaginationHeight';

/** 小于该值的空隙不值得回填（只差几个像素，改了反而增加抖动） */
export const GAP_ABSORB_MIN_PX = 24;

/**
 * 回填安全余量：账本高度与 DOM 实际高度之间允许的误差。
 * 回填会吃满「账本剩余」，一旦实际渲染比账本高就会溢出，
 * 因此宁可少填几个像素。
 */
export const GAP_ABSORB_SAFETY_PX = 6;

/**
 * 单个容器最多回填的高度（px）。
 *
 * 为什么必须封顶：一页只剩一道 10 分题时，剩余两百多像素全灌进去，
 * 会让这道题的作答框比下一页 16 分的题还大，「分值 ↔ 书写空间」的
 * 对应关系被打破，老师一眼就看得出不对。宁可留一段底部留白
 * （答题卡上本来就有），也不要造出畸形的作答框。
 */
export const GAP_ABSORB_MAX_PX = 180;

/** 作答区高度的下限，与 answerPagination 保持一致 */
const ANSWER_AREA_FLOOR_PX = 80;

function sectionGapPx(prev, cur, gapBetween) {
  if (typeof gapBetween === 'function') {
    const v = Number(gapBetween(prev, cur));
    if (Number.isFinite(v)) return Math.max(0, v);
  }
  return SECTION_BLOCK_VERTICAL_GAP_PX;
}

/**
 * 计算一个容器内已占用的竖向高度（px），口径与分页/分栏完全一致：
 * 第一个题块不计间距，其后每块计一次 SECTION_BLOCK_VERTICAL_GAP_PX，
 * 横带与上一块合并时不计间距（由 gapBetween 回调决定）。
 *
 * @param {object[]} sections
 * @param {(prev: object, cur: object) => number} [gapBetween]
 * @returns {number}
 */
export function computeContainerUsedPx(sections, gapBetween) {
  const list = Array.isArray(sections) ? sections : [];
  let used = 0;
  list.forEach((sec, idx) => {
    if (idx > 0) {
      const gap = sectionGapPx(list[idx - 1], sec, gapBetween);
      if (gap > 0) used += gap;
    }
    used += resolveSectionPaginationBodyHeightPx(sec);
  });
  return used;
}

/**
 * 解答题：把回填预算均摊给本题块末尾这一组作答框。
 *
 * 为什么均摊而不是只给最后一个：同一页里两道 12 分题，一道 245px、一道 420px，
 * 学生会以为后者更重要。均摊之后两个框差不多大，页面整体下移，看不出拼接痕迹。
 * 余数补给最后一个（一页里的压轴题多占几像素是合理的）。
 */
function stretchAnswerSection(section, gapPx, options) {
  const items = Array.isArray(section.items) ? section.items : [];
  if (!items.length) return null;
  const maxLastItemPx = Number.isFinite(Number(options.maxLastItemPx))
    ? Number(options.maxLastItemPx)
    : Infinity;
  const minAbsorbPx = options.minAbsorbPx;
  const n = items.length;

  const nextItems = items.slice();
  let absorbedPx = 0;

  if (n === 1) {
    const last = items[0];
    const currentPx = Math.max(ANSWER_AREA_FLOOR_PX, Number(last.areaHeight) || 180);
    const nextPx = Math.min(maxLastItemPx, currentPx + gapPx);
    absorbedPx = Math.floor(nextPx - currentPx);
    if (absorbedPx < minAbsorbPx) return null;
    nextItems[0] = {
      ...last,
      areaHeight: currentPx + absorbedPx,
      measureKey: `${section.id}-${last.num}-${currentPx + absorbedPx}`
    };
    return { section: { ...section, items: nextItems }, absorbedPx };
  }

  const perItem = Math.floor(gapPx / n);
  if (perItem <= 0) return null;

  items.forEach((item, idx) => {
    const currentPx = Math.max(ANSWER_AREA_FLOOR_PX, Number(item.areaHeight) || 180);
    // 余数补给最后一个
    const budgetPx = idx === n - 1 ? gapPx - perItem * (n - 1) : perItem;
    const nextPx = Math.min(maxLastItemPx, currentPx + budgetPx);
    const deltaPx = Math.floor(nextPx - currentPx);
    if (deltaPx <= 0) return;
    absorbedPx += deltaPx;
    nextItems[idx] = {
      ...item,
      areaHeight: currentPx + deltaPx,
      measureKey: `${section.id}-${item.num}-${currentPx + deltaPx}`
    };
  });

  if (absorbedPx < minAbsorbPx) return null;
  return { section: { ...section, items: nextItems }, absorbedPx };
}

/**
 * 填空题：给最后一个长填空追加横线行。
 *
 * 追加行必须同步把该题的 item.lineCount 一起改大 —— 渲染层用
 * `lineIdx === item.lineCount` 判断「这一行才显示分值」，只加行不改 lineCount
 * 会让分值标注留在旧的末行上，出现两个分。
 */
function stretchFillBlankSection(section, gapPx, options) {
  const rows = Array.isArray(section.rows) ? section.rows : [];
  if (!rows.length) return null;

  let lastLongIdx = -1;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i] && rows[i].rowType === 'long-line') {
      lastLongIdx = i;
      break;
    }
  }
  if (lastLongIdx < 0) return null;

  const lastRow = rows[lastLongIdx];
  const item = lastRow.item;
  if (!item || item.num == null) return null;

  const addCount = Math.floor(gapPx / FILLBLANK_ROW_HEIGHT_PX);
  if (addCount < 1) return null;

  const baseLineCount = Math.max(1, Number(lastRow.lineCount) || Number(item.lineCount) || 1);
  const nextLineCount = baseLineCount + addCount;
  const nextItem = { ...item, lineCount: nextLineCount };

  // 同一小题的所有行共享新的 item 引用，保证分值只出现在新的末行
  const nextRows = rows.map((row) => (
    row && row.rowType === 'long-line' && row.item && row.item.num === item.num
      ? { ...row, item: nextItem, lineCount: nextLineCount }
      : row
  ));

  const keyBase = String(lastRow.measureKey || '').replace(/-l\d+$/, '');
  for (let i = 1; i <= addCount; i += 1) {
    const lineIdx = baseLineCount + i;
    nextRows.push({
      ...lastRow,
      item: nextItem,
      lineIdx,
      lineCount: nextLineCount,
      measureKey: `${keyBase}-l${lineIdx}`
    });
  }

  return {
    section: { ...section, rows: nextRows },
    absorbedPx: addCount * FILLBLANK_ROW_HEIGHT_PX
  };
}

function stretchSectionAt(section, gapPx, options) {
  if (!section) return null;
  if (section.type === 'answer') return stretchAnswerSection(section, gapPx, options);
  if (section.type === 'fillblank') return stretchFillBlankSection(section, gapPx, options);
  return null;
}

/**
 * 把一个容器的剩余高度回填给最末尾的可拉伸题块。
 *
 * @param {object[]} sections - 容器内的题块片段（已按页/按栏分好）
 * @param {number} capacityPx - 该容器的可用高度（px）
 * @param {object} [options]
 * @param {(prev: object, cur: object) => number} [options.gapBetween] - 相邻题块间距规则
 * @param {number} [options.maxLastItemPx] - 拉伸作答区的上限（通常传 maxAnswerAreaHeight）
 * @param {number} [options.minAbsorbPx] - 触发回填的最小空隙
 * @param {number} [options.safetyPx] - 安全余量
 * @returns {{ sections: object[], absorbedPx: number }}
 */
export function absorbContainerGap(sections, capacityPx, options = {}) {
  const list = Array.isArray(sections) ? sections : [];
  const cap = Number(capacityPx);
  const unchanged = { sections: list, absorbedPx: 0 };
  if (!list.length || !Number.isFinite(cap) || cap <= 0) return unchanged;

  // 防御性幂等：本容器已经回填过就不再动。
  // 当前调用链每次都是从分页原始结果重新回填，理论上不会重复进入；
  // 但宿主若把已回填的页面再喂进来一次，没有这道闸门就会越填越高。
  if (list.some((sec) => sec && sec.gapAbsorbedPx > 0)) return unchanged;

  const minAbsorbPx = Number.isFinite(Number(options.minAbsorbPx))
    ? Math.max(0, Number(options.minAbsorbPx))
    : GAP_ABSORB_MIN_PX;
  const safetyPx = Number.isFinite(Number(options.safetyPx))
    ? Math.max(0, Number(options.safetyPx))
    : GAP_ABSORB_SAFETY_PX;
  const maxAbsorbPx = Number.isFinite(Number(options.maxAbsorbPx))
    ? Math.max(0, Number(options.maxAbsorbPx))
    : GAP_ABSORB_MAX_PX;

  const used = computeContainerUsedPx(list, options.gapBetween);
  const rawGapPx = Math.floor(cap - used - safetyPx);
  if (rawGapPx < minAbsorbPx) return unchanged;

  // 只吃预算内的那部分，剩下的留给版面呼吸，避免把单个作答框撑到畸形
  const gapPx = Math.min(rawGapPx, maxAbsorbPx);

  const opts = {
    ...options,
    minAbsorbPx,
    safetyPx
  };

  // 从容器最末尾往前找第一个拉伸得动的题块：越靠下拉伸越自然
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const res = stretchSectionAt(list[i], gapPx, opts);
    if (!res) continue;
    const next = list.slice();
    next[i] = { ...res.section, gapAbsorbedPx: res.absorbedPx };
    return { sections: next, absorbedPx: res.absorbedPx };
  }
  return unchanged;
}

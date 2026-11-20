/**
 * 分页上下文管理器
 * 封装所有分页状态和API，替代 mixin 中的分散状态
 *
 * 职责：
 * 1. 管理分页状态（页码、剩余空间、A3 多栏账本）
 * 2. 提供分页操作API（确保页面、消耗空间、添加section等）
 * 3. 处理 A3 两栏/三栏的复杂逻辑（栏切换、间距计算等）
 */
import {
  ANSWER_SHEET_A3_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX,
  ANSWER_SHEET_8K_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX,
  SECTION_BLOCK_VERTICAL_GAP_PX,
  PAGINATION_WEIGHT_UNIT_PX
} from './constants';

export class PaginationContext {
  /**
   * @param {Object} options - 配置选项
   * @param {string} [options.layoutType] - A4 | A3 | 8K；8K 时默认栏容量用 {@link ANSWER_SHEET_8K_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX}
   * @param {number} [options.a3ColCount] - A3 物理栏数：0 关闭账本，2 双栏，3 三栏（优先于 isA3TwoCol）
   * @param {boolean} [options.isA3TwoCol] - 兼容：视为 a3ColCount=2
   * @param {Function} options.totalHeightForPage - 获取指定页总高度的函数 (pageIndex) => height
   * @param {number} options.pageBottomReservePx - 页面底部预留空间（像素）
   * @param {Array<number>} options.a3Caps - A3 各栏容量（px）
   * @param {Function} [options.getA3MultiColCapsForPage] - (pageIndex) => number[]
   * @param {Function} [options.getA3TwoColCapsForPage] - 同 getA3MultiColCapsForPage（兼容）
   * @param {Function} options.paginationDebugEnabled - 是否启用调试日志 () => boolean
   * @param {Function} options.onPageAdded - 页面添加时的回调 (pageIndex) => void
   */
  constructor(options) {
    // 分页结果
    this.pages = [{ sections: [] }];

    // 当前状态
    this.pageIndex = 0;
    this.remainingPx = options.totalHeightForPage(0);

    let a3ColCount = Number(options.a3ColCount);
    if (!Number.isFinite(a3ColCount) || a3ColCount <= 0) {
      a3ColCount = options.isA3TwoCol ? 2 : 0;
    }
    this.a3ColCount = Math.min(3, Math.max(0, Math.floor(a3ColCount)));

    /** @deprecated 语义为「启用 A3 多栏 px 账本」，含双栏与三栏 */
    this.isA3TwoCol = this.a3ColCount >= 2;

    this.a3Ci = 0;
    const inner =
      options.layoutType === '8K'
        ? ANSWER_SHEET_8K_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX
        : ANSWER_SHEET_A3_TWO_COL_PANE_DRAWABLE_INNER_HEIGHT_PX;
    const defaultCaps =
      this.a3ColCount >= 2
        ? Array.from({ length: this.a3ColCount }, () => inner)
        : [];
    const capsOpt = Array.isArray(options.a3Caps) ? options.a3Caps : null;
    this.a3Caps =
      capsOpt && capsOpt.length >= this.a3ColCount && this.a3ColCount >= 2
        ? capsOpt.slice(0, this.a3ColCount)
        : defaultCaps;

    this.getA3MultiColCapsForPage =
      typeof options.getA3MultiColCapsForPage === 'function'
        ? options.getA3MultiColCapsForPage
        : typeof options.getA3TwoColCapsForPage === 'function'
          ? options.getA3TwoColCapsForPage
          : null;
    /** @deprecated 请使用 getA3MultiColCapsForPage */
    this.getA3TwoColCapsForPage = this.getA3MultiColCapsForPage;

    this.a3Used =
      this.a3ColCount >= 2
        ? Array.from({ length: this.a3ColCount }, () => 0)
        : [0, 0];

    // 配置
    this.totalHeightForPage = options.totalHeightForPage;
    this.pageBottomReservePx = options.pageBottomReservePx;
    this.paginationDebugEnabled = options.paginationDebugEnabled || (() => false);

    // 回调
    this.onPageAdded = options.onPageAdded || (() => {});
  }

  /** @returns {number} */
  _a3LastColIdx() {
    return Math.max(0, this.a3ColCount - 1);
  }

  /**
   * 确保当前页存在
   * 如果当前页索引超出范围，则创建新页
   */
  ensurePage() {
    if (!this.pages[this.pageIndex]) {
      this.pages.push({ sections: [] });
      this.onPageAdded(this.pageIndex);
    }
  }

  /**
   * 重新加载当前页的剩余空间
   * A3 多栏：重置栏账本
   * A4单栏：直接使用页面总高度
   */
  reloadRemainingForCurrentPage() {
    if (this.isA3TwoCol) {
      this.resetA3TwoColColumnLedger();
    } else {
      this.remainingPx = this.totalHeightForPage(this.pageIndex);
    }
  }

  /**
   * 获取当前页总容量（用于日志）
   * A3 多栏：各栏容量之和
   * A4单栏：返回页面总高度
   * @param {number} pageIndex - 页码（可选，默认当前页）
   * @returns {number} 总容量（像素）
   */
  totalCapPxForLogs(pageIndex = this.pageIndex) {
    if (this.isA3TwoCol) {
      return this.a3Caps.reduce((s, h) => s + h, 0);
    }
    return this.totalHeightForPage(pageIndex);
  }

  /**
   * 底部预留空间（用于台账）
   * 首页与续页统一返回相同值（当前为 0）
   * @returns {number} 底部预留空间（像素）
   */
  bottomReservePxForLedger() {
    return this.pageBottomReservePx;
  }

  // ==================== A3 多栏专用方法 ====================

  /**
   * 按当前页索引刷新 A3 各栏容量（px）
   */
  syncA3TwoColCapsFromPageIndex() {
    if (!this.isA3TwoCol || typeof this.getA3MultiColCapsForPage !== 'function') {
      return;
    }
    const caps = this.getA3MultiColCapsForPage(this.pageIndex);
    if (!Array.isArray(caps) || caps.length < this.a3ColCount) return;
    const minPx = 8 * PAGINATION_WEIGHT_UNIT_PX;
    this.a3Caps = caps.slice(0, this.a3ColCount).map((v) => {
      const n = Number(v);
      return Math.max(minPx, Number.isFinite(n) ? n : minPx);
    });
  }

  /**
   * 重置 A3 多栏账本
   */
  resetA3TwoColColumnLedger() {
    if (!this.isA3TwoCol) return;
    this.syncA3TwoColCapsFromPageIndex();
    this.a3Used = Array.from({ length: this.a3ColCount }, () => 0);
    this.a3Ci = 0;
    this.syncRemainingPxFromA3TwoColLedger();
  }

  /**
   * 从A3账本同步剩余空间到 remainingPx
   */
  syncRemainingPxFromA3TwoColLedger() {
    if (!this.isA3TwoCol) return;
    this.remainingPx = Math.max(0, this.a3Caps[this.a3Ci] - this.a3Used[this.a3Ci]);
  }

  /**
   * 检查A3多栏是否能容纳某个section
   * @param {number} bodyPx - section主体高度（像素）
   * @returns {boolean} 是否能容纳
   */
  a3TwoColCanFitSectionPx(bodyPx) {
    let ci = this.a3Ci;
    const used = [...this.a3Used];
    let gapPx = used[ci] > 0 ? SECTION_BLOCK_VERTICAL_GAP_PX : 0;
    const last = this._a3LastColIdx();

    while (ci < last && used[ci] + gapPx + bodyPx > this.a3Caps[ci]) {
      ci += 1;
      gapPx = used[ci] > 0 ? SECTION_BLOCK_VERTICAL_GAP_PX : 0;
    }

    return used[ci] + gapPx + bodyPx <= this.a3Caps[ci];
  }

  /**
   * 预览消耗前的剩余空间（原始像素，不含间距）
   * @param {number} deltaPx - 要消耗的像素
   * @returns {number} 放置前的剩余空间（像素）
   */
  a3TwoColPeekRemainingBeforeRawPx(deltaPx) {
    let ci = this.a3Ci;
    const used = [...this.a3Used];
    const last = this._a3LastColIdx();

    while (ci < last && used[ci] + deltaPx > this.a3Caps[ci]) {
      ci += 1;
    }

    return Math.max(0, this.a3Caps[ci] - used[ci]);
  }

  /**
   * 预览消耗前的剩余空间（section级别，含间距）
   * @param {number} bodyHeightPx - section主体高度（像素）
   * @returns {number} 放置前的剩余空间（像素）
   */
  a3TwoColPeekRemainingBeforeSectionPx(bodyHeightPx) {
    let ci = this.a3Ci;
    const used = [...this.a3Used];
    let gapPx = used[ci] > 0 ? SECTION_BLOCK_VERTICAL_GAP_PX : 0;
    const last = this._a3LastColIdx();

    while (ci < last && used[ci] + gapPx + bodyHeightPx > this.a3Caps[ci]) {
      ci += 1;
      gapPx = used[ci] > 0 ? SECTION_BLOCK_VERTICAL_GAP_PX : 0;
    }

    return Math.max(0, this.a3Caps[ci] - used[ci]);
  }

  /**
   * 消耗原始像素（同一题型chunk内小块，不加大题块间距）
   * @param {number} deltaPx - 要消耗的像素
   */
  a3TwoColConsumeRawPx(deltaPx) {
    const last = this._a3LastColIdx();
    const place = () => {
      while (this.a3Ci < last && this.a3Used[this.a3Ci] + deltaPx > this.a3Caps[this.a3Ci]) {
        this.a3Ci += 1;
      }

      if (this.a3Used[this.a3Ci] + deltaPx <= this.a3Caps[this.a3Ci]) {
        this.a3Used[this.a3Ci] += deltaPx;
        this.syncRemainingPxFromA3TwoColLedger();
        return true;
      }
      return false;
    };

    if (place()) return;

    this.pageIndex += 1;
    this.ensurePage();
    this.resetA3TwoColColumnLedger();

    if (!place()) {
      this.a3Used[this.a3Ci] += deltaPx;
      this.syncRemainingPxFromA3TwoColLedger();
    }
  }

  /**
   * 消耗section高度（大题块，可能需要加大题块间距）
   * @param {number} bodyHeightPx - section主体高度（像素）
   * @param {Object} options - 选项
   * @param {boolean} options.skipLeadingBlockGap - 是否跳过前导间距（默认false）
   */
  a3TwoColConsumeSectionHeightPx(bodyHeightPx, options = {}) {
    const skipLeadingBlockGap = options.skipLeadingBlockGap === true;
    const last = this._a3LastColIdx();

    const place = () => {
      let gapPx = !skipLeadingBlockGap && this.a3Used[this.a3Ci] > 0
        ? SECTION_BLOCK_VERTICAL_GAP_PX
        : 0;

      while (this.a3Ci < last && this.a3Used[this.a3Ci] + gapPx + bodyHeightPx > this.a3Caps[this.a3Ci]) {
        this.a3Ci += 1;
        gapPx = !skipLeadingBlockGap && this.a3Used[this.a3Ci] > 0
          ? SECTION_BLOCK_VERTICAL_GAP_PX
          : 0;
      }

      if (this.a3Used[this.a3Ci] + gapPx + bodyHeightPx <= this.a3Caps[this.a3Ci]) {
        this.a3Used[this.a3Ci] += gapPx + bodyHeightPx;
        this.syncRemainingPxFromA3TwoColLedger();
        return true;
      }
      return false;
    };

    if (place()) return;

    this.pageIndex += 1;
    this.ensurePage();
    this.resetA3TwoColColumnLedger();

    if (!place()) {
      const gapPx = !skipLeadingBlockGap && this.a3Used[this.a3Ci] > 0
        ? SECTION_BLOCK_VERTICAL_GAP_PX
        : 0;
      this.a3Used[this.a3Ci] += gapPx + bodyHeightPx;
      this.syncRemainingPxFromA3TwoColLedger();
    }
  }

  /**
   * 确保当前栏能容纳「大题标题栏 + 首块内容」这一整体
   *
   * A3 多栏下标题栏与首个小题/首行/首个横带必须落在同一栏：
   * 若标题栏能放入当前栏但首块内容放不下，渲染层会把整块搬到下一栏，
   * 而账本已把标题栏记在上一条栏，造成两边差出一整块高度，后续题块逐栏累积错位（最后一栏塞爆）。
   *
   * 本方法只做「栏游标前移」，不消耗高度；最后一栏不满足时保持原状，交由 consume 走换页逻辑。
   *
   * @param {number} px - 需要同栏容纳的总高度（标题栏 + 首块内容）
   * @returns {boolean} 当前页内是否找到可容纳的栏
   */
  a3TwoColEnsureColumnRoomForPx(px) {
    if (!this.isA3TwoCol) return true;
    const last = this._a3LastColIdx();
    const gapAt = (idx) => (this.a3Used[idx] > 0 ? SECTION_BLOCK_VERTICAL_GAP_PX : 0);
    while (this.a3Ci < last) {
      if (this.a3Used[this.a3Ci] + gapAt(this.a3Ci) + px <= this.a3Caps[this.a3Ci]) {
        this.syncRemainingPxFromA3TwoColLedger();
        return true;
      }
      this.a3Ci += 1;
    }
    this.syncRemainingPxFromA3TwoColLedger();
    return this.a3Used[this.a3Ci] + gapAt(this.a3Ci) + px <= this.a3Caps[this.a3Ci];
  }

  // ==================== 通用方法 ====================

  /**
   * 添加section到当前页
   * @param {Object} section - section对象
   */
  addSection(section) {
    this.ensurePage();
    this.pages[this.pageIndex].sections.push(section);
  }

  /**
   * 获取最终的分页结果
   * @returns {Array<Object>} 分页数组，每个元素包含 sections 数组
   */
  getPages() {
    return this.pages;
  }

  /**
   * 获取当前页的sections数组
   * @returns {Array<Object>} 当前页的sections
   */
  getCurrentPageSections() {
    this.ensurePage();
    return this.pages[this.pageIndex].sections;
  }

  /**
   * 判断当前页是否有sections
   * @returns {boolean}
   */
  hasSectionsOnCurrentPage() {
    return this.getCurrentPageSections().length > 0;
  }

  /**
   * 计算题块间距
   * A3多栏：根据当前栏是否已有内容决定
   * A4单栏：根据当前页是否已有sections决定
   * @returns {number} 间距（像素）
   */
  calculateSectionGapPx() {
    if (this.isA3TwoCol) {
      return this.a3Used[this.a3Ci] > 0 ? SECTION_BLOCK_VERTICAL_GAP_PX : 0;
    }
    return this.hasSectionsOnCurrentPage() ? SECTION_BLOCK_VERTICAL_GAP_PX : 0;
  }
}

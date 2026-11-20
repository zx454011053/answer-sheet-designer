<template>
  <div class="sheet-drawable-leader" data-sheet-drawable-leader>
    <div class="sheet-main-title" :style="titleStyle">{{ previewTitle }}</div>

    <div class="sheet-header" :class="{ 'sheet-header-short': isShortNumberLayout }">
      <div class="header-left-card">
        <div v-if="showQrCode" class="qrcode-box">
          <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="考试编号二维码" class="qrcode-image" />
          <div v-else class="qrcode-pattern"></div>
        </div>
        <div class="exam-meta">
          <div class="meta-row">考试号：{{ examNo }}</div>
          <div class="meta-row">缺考标记：<span class="absent-box"></span></div>
        </div>
      </div>
      <div v-if="showHeaderRightCard" class="header-right-card">
        <div class="line-row">
          <span>学校：</span>
          <span class="line-fill long"></span>
        </div>
        <div class="line-row">
          <span>姓名：</span>
          <span class="line-fill middle"></span>
          <span class="inline-key">班级：</span>
          <span class="line-fill short"></span>
        </div>
      </div>

      <short-number-card v-if="isShortNumberLayout" :short-number-row-labels="shortNumberRowLabels" />
    </div>

    <div class="identity-section">
      <div
        class="notice-box-wrap"
        @mouseenter="noticeWrapHover = true"
        @mouseleave="noticeWrapHover = false"
      >
        <div class="notice-box">
          <div v-for="(item, idx) in noticeList" :key="idx" class="notice-item">
            {{ idx + 1 }}、{{ item }}
          </div>
        </div>
        <el-button
          v-if="noticeWrapHover"
          type="primary"
          plain
          size="mini"
          class="notice-edit-trigger"
          @click.stop="$emit('edit-notice')"
        >修改</el-button>
      </div>

      <admission-card
        v-if="showAdmissionCard"
        :admission-card-style="admissionCardStyle"
        :admission-grid-style="admissionGridStyle"
        :effective-admission-columns="effectiveAdmissionColumns"
        @edit="$emit('edit-admission')"
      />

      <barcode-paste-card v-else-if="showBarcodeCard" />
    </div>
  </div>
</template>

<script>
import AdmissionCard from '@/components/fill-types/AdmissionCard.vue';
import BarcodePasteCard from '@/components/fill-types/BarcodePasteCard.vue';
import ShortNumberCard from '@/components/fill-types/ShortNumberCard.vue';
import { ANSWER_SHEET_A4_DRAWABLE_INNER_HEIGHT_PX } from '@/core/constants';

/**
 * 首页可绘制区顶部：主标题 + 头部信息区 + 须知与填涂方式（准考证 / 条码 / 短学号等）。
 * 顶区版式见本组件 style；A3 分栏下窄栏等覆写仍由 AnswerSheetEditor.styles.css 按父级选择器控制。
 */
export default {
  name: 'SheetDrawableLeader',
  components: {
    AdmissionCard,
    BarcodePasteCard,
    ShortNumberCard
  },
  data() {
    return {
      noticeWrapHover: false,
      /** 顶区实测宽度，供标题字号自适应；0 表示尚未测量，先用默认字号 */
      titleAvailableWidth: 0
    };
  },
  props: {
    previewTitle: {
      type: String,
      default: ''
    },
    examNo: {
      type: String,
      default: ''
    },
    qrCodeDataUrl: {
      type: String,
      default: ''
    },
    /** 是否渲染考试号二维码（默认渲染） */
    showQrCode: {
      type: Boolean,
      default: true
    },
    noticeList: {
      type: Array,
      default: () => []
    },
    shortNumberRowLabels: {
      type: Array,
      default: () => []
    },
    admissionCardStyle: {
      type: Object,
      default: () => ({})
    },
    admissionGridStyle: {
      type: Object,
      default: () => ({})
    },
    effectiveAdmissionColumns: {
      type: Number,
      default: 9
    },
    /** 当前表单填涂方式；与 forcedFillType 二选一生效 */
    fillType: {
      type: String,
      default: 'admission'
    },
    /** 离屏测量用：强制模拟某一种填涂方式的版面 */
    forcedFillType: {
      type: String,
      default: null
    },
    /** 为 true 时在绘制后打印调试信息（由父组件按版式开启） */
    logDrawPlacementDebug: {
      type: Boolean,
      default: false
    },
    /**
     * 内侧可绘制总高度（px），用于「剩余高度」日志与对齐分页常量；
     * 不传则使用 A4 默认 ANSWER_SHEET_A4_DRAWABLE_INNER_HEIGHT_PX。
     */
    drawableInnerHeightPx: {
      type: Number,
      default: null
    }
  },
  computed: {
    effectiveFillType() {
      return this.forcedFillType || this.fillType || 'admission';
    },
    isClassNumberLayout() {
      return this.effectiveFillType === 'class-number';
    },
    isShortNumberLayout() {
      return this.effectiveFillType === 'short-number';
    },
    showHeaderRightCard() {
      return !this.isClassNumberLayout;
    },
    showAdmissionCard() {
      return this.effectiveFillType === 'admission';
    },
    showBarcodeCard() {
      return this.effectiveFillType === 'barcode';
    },
    /** 标题按容器实测宽度自适应字号，保证单行显示、不额外占高（否则会挤掉首屏题位） */
    titleStyle() {
      const text = String(this.previewTitle || '');
      const chars = Array.from(text);
      /** 中文字按 1 个字宽、西文按 0.55 估算，避免英文标题被过度缩小 */
      const emWidth = chars.reduce(
        (sum, ch) => sum + (ch.charCodeAt(0) > 255 ? 1 : 0.55),
        0
      ) || 1;
      const available = this.titleAvailableWidth;
      const base = 34;
      /** 样式里 letter-spacing 为 1px，需按字符数预留 */
      const size = available > 0
        ? Math.max(16, Math.min(base, Math.floor((available - 8 - chars.length) / emWidth)))
        : base;
      return { fontSize: `${size}px` };
    },
    effectiveDrawableInnerHeightPx() {
      const v = this.drawableInnerHeightPx;
      if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) {
        return Math.round(Number(v));
      }
      return ANSWER_SHEET_A4_DRAWABLE_INNER_HEIGHT_PX;
    }
  },
  watch: {
    logDrawPlacementDebug() {
      this.scheduleMeasureAndNotify();
    },
    effectiveFillType() {
      this.scheduleMeasureAndNotify();
    },
    effectiveAdmissionColumns() {
      this.scheduleMeasureAndNotify();
    },
    drawableInnerHeightPx() {
      this.scheduleMeasureAndNotify();
    },
    noticeList: {
      deep: true,
      handler() {
        this.scheduleMeasureAndNotify();
      }
    },
    qrCodeDataUrl() {
      this.scheduleMeasureAndNotify();
    },
    showQrCode() {
      this.scheduleMeasureAndNotify();
    },
    /** 标题/考试号文字变化可能引起换行，需要重测顶区高度 */
    previewTitle() {
      this.scheduleMeasureAndNotify();
    },
    examNo() {
      this.scheduleMeasureAndNotify();
    }
  },
  mounted() {
    this.scheduleMeasureAndNotify();
    this.$nextTick(() => {
      this.bindLeaderResizeObserver();
    });
  },
  beforeDestroy() {
    this.unbindLeaderResizeObserver();
  },
  methods: {
    scheduleMeasureAndNotify() {
      this.$nextTick(() => this.measureAndNotifyParent());
    },
    measureAndNotifyParent() {
      const root = this.$el;
      if (!root || root.nodeType !== 1) return;
      const available = Math.round(root.clientWidth || root.offsetWidth || 0);
      if (available > 0 && available !== this.titleAvailableWidth) {
        this.titleAvailableWidth = available;
      }
      const occupiedPx = Math.round(root.offsetHeight);
      this.$emit('layout-height', occupiedPx);
      if (!this.logDrawPlacementDebug) return;
      const totalPx = this.effectiveDrawableInnerHeightPx;
      const remainingPx = Math.max(0, Math.round(totalPx - occupiedPx));
      console.log('[AnswerSheet A4 填涂顶区]', {
        填涂方式: this.effectiveFillType,
        总高度_px: totalPx,
        占用高度_px: occupiedPx,
        剩余高度_px: remainingPx,
        准考证列数: this.showAdmissionCard ? this.effectiveAdmissionColumns : undefined,
        须知条数: Array.isArray(this.noticeList) ? this.noticeList.length : 0
      });
    },
    bindLeaderResizeObserver() {
      this.unbindLeaderResizeObserver();
      const root = this.$el;
      if (!root || typeof ResizeObserver === 'undefined') return;
      /** 推迟到下一帧再测高，避免 RO 回调同步改布局触发「ResizeObserver loop」告警 */
      this._leaderResizeObserver = new ResizeObserver(() => {
        if (this._leaderResizeRafId != null) return;
        this._leaderResizeRafId = window.requestAnimationFrame(() => {
          this._leaderResizeRafId = null;
          this.measureAndNotifyParent();
        });
      });
      this._leaderResizeObserver.observe(root);
    },
    unbindLeaderResizeObserver() {
      if (this._leaderResizeRafId != null) {
        window.cancelAnimationFrame(this._leaderResizeRafId);
        this._leaderResizeRafId = null;
      }
      if (this._leaderResizeObserver) {
        this._leaderResizeObserver.disconnect();
        this._leaderResizeObserver = null;
      }
    }
  }
};
</script>

<style scoped>
.sheet-drawable-leader {
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}

.sheet-main-title {
  text-align: center;
  font-size: 34px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 1px;
  color: #000;
  margin-bottom: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sheet-header {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  column-gap: 18px;
  align-items: center;
  margin-bottom: 16px;
}

.sheet-header.sheet-header-short {
  grid-template-columns: auto auto auto;
  column-gap: 8px;
}

.header-left-card {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 68px;
}

.qrcode-box {
  width: 68px;
  height: 68px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.qrcode-pattern {
  width: 48px;
  height: 48px;
  background:
    linear-gradient(90deg, #000 50%, transparent 50%) 0 0 / 8px 8px,
    linear-gradient(#000 50%, transparent 50%) 0 0 / 8px 8px;
}

.qrcode-image {
  width: 64px;
  height: 64px;
  display: block;
}

.exam-meta {
  border: 2px solid #000;
  height: 68px;
  box-sizing: border-box;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  font-size: 13px;
  color: #000;
}

.meta-row {
  display: flex;
  align-items: center;
  line-height: 1.2;
  white-space: nowrap;
}

.absent-box {
  width: 26px;
  height: 12px;
  border: 1px solid #000;
  margin-left: 3px;
}

.header-right-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 68px;
  width: 224px;
  font-size: 13px;
  color: #000;
}

.sheet-header:not(.sheet-header-short) .header-right-card {
  justify-self: end;
}

.line-row {
  display: grid;
  align-items: end;
  height: 30px;
  line-height: 1.2;
  width: 100%;
  white-space: nowrap;
}

.header-right-card .line-row:first-child {
  grid-template-columns: 34px 186px;
  column-gap: 4px;
}

.header-right-card .line-row:last-child {
  grid-template-columns: 34px 74px 34px 74px;
  column-gap: 4px;
}

.line-fill {
  display: inline-block;
  border-bottom: 1px solid #000;
  height: 16px;
  width: 100%;
}

.line-fill.long,
.line-fill.middle,
.line-fill.short {
  width: 100%;
}

.inline-key {
  margin-left: 0;
}

.identity-section {
  display: flex;
  align-items: stretch;
  gap: 14px;
}

.notice-box-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  align-self: stretch;
  position: relative;
  display: flex;
  flex-direction: column;
}

.notice-edit-trigger {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 3;
}

.notice-box {
  flex: 1;
  min-width: 0;
  min-height: 0;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  border: 1px solid #000;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.35;
  color: #000;
}

.notice-item + .notice-item {
  margin-top: 1px;
}
</style>

<style>
/* 祖先 .sheet-preview.sheet-preview-class-number：收紧头部栅格（依赖父级类名） */
.sheet-preview.sheet-preview-class-number .sheet-drawable-leader .sheet-header {
  grid-template-columns: auto;
}
</style>

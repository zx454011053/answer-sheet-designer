<template>
  <div
    class="choice-frame fillblank-render"
    :class="{ 'fillblank-render--a3-three-col-short': fillBlankShortGridColumns === 2 }"
  >
    <div
      v-for="(row, rowIdx) in section.rows"
      :key="`fillblank-row-${section.id}-${row.measureKey || rowIdx}`"
      class="fillblank-render-row"
      :data-fillblank-row-key="row.measureKey || ''"
      :class="{
        'fillblank-render-row-short': row.rowType === 'short',
        'fillblank-render-row-long': row.rowType === 'long',
        'fillblank-render-row-long-line': row.rowType === 'long-line',
        'fillblank-render-row-short-segment': row.rowType === 'short' && row.shortSegmented,
        'fillblank-render-row-short--cols-2':
          row.rowType === 'short' && !row.shortSegmented && fillBlankShortGridColumns === 2
      }"
    >
      <template v-if="row.rowType === 'short'">
        <div
          v-for="item in row.items"
          :key="`fillblank-short-${section.id}-${item.num}-${item.blankSlotIndex || 0}`"
          class="fillblank-render-short-item"
        >
          <span v-if="fillBlankShortShowQuestionNum(item)" class="question-num">{{ item.num }}</span>
          <span
            v-for="blankIdx in getShortBlankCount(item, row)"
            :key="`short-blank-${item.num}-${item.blankSlotIndex || 0}-${blankIdx}`"
            class="fillblank-inline-blank"
          ></span>
          <span
            v-if="showFillBlankScore && fillBlankShortShowQuestionScore(item)"
            class="fillblank-score"
          >({{ formatScore(fillBlankShortItemDisplayScore(item)) }}分)</span>
        </div>
      </template>
      <template v-else-if="row.rowType === 'long-line'">
        <div class="fillblank-render-long-item">
          <div
            class="fillblank-long-line-row"
            :class="{ 'fillblank-long-line-row-first': row.lineIdx === 1 && !row.continuationLead }"
          >
            <span v-if="row.lineIdx === 1 || row.continuationLead" class="question-num">{{ row.item.num }}</span>
            <span class="fillblank-line"></span>
            <span v-if="showFillBlankScore && row.lineIdx === row.item.lineCount" class="fillblank-score">
              ({{ formatScore(row.item.scorePerQuestion) }}分)
            </span>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="fillblank-render-long-item">
          <div class="fillblank-render-long-lines">
            <div
              v-for="lineIdx in row.item.lineCount"
              :key="`long-line-${row.item.num}-${lineIdx}`"
              class="fillblank-long-line-row"
              :class="{ 'fillblank-long-line-row-first': lineIdx === 1 }"
            >
              <span v-if="lineIdx === 1" class="question-num">{{ row.item.num }}</span>
              <span class="fillblank-line"></span>
              <span v-if="showFillBlankScore && lineIdx === row.item.lineCount" class="fillblank-score">
                ({{ formatScore(row.item.scorePerQuestion) }}分)
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FillBlankQuestionType',
  props: {
    section: { type: Object, required: true },
    showFillBlankScore: { type: Boolean, default: true },
    formatScore: { type: Function, required: true },
    getShortBlankCount: { type: Function, required: true }
  },
  computed: {
    /** 短填同行小题数：由 buildFillBlankSectionRender 写入（A3 三栏为 2，其余默认 3） */
    fillBlankShortGridColumns() {
      const v = Number(this.section && this.section.shortItemsPerRow);
      if (v === 2) return 2;
      return 3;
    }
  },
  methods: {
    /** 多空时仅第一格显示题号；单空照常显示 */
    fillBlankShortShowQuestionNum(item) {
      const slots = Math.max(1, Number(item && item.blankSlotsTotal) || 1);
      const idx = Math.max(1, Number(item && item.blankSlotIndex) || 1);
      if (slots <= 1) return true;
      return idx === 1;
    },
    /** 多空时仅最后一格显示分数；单空照常显示 */
    fillBlankShortShowQuestionScore(item) {
      const slots = Math.max(1, Number(item && item.blankSlotsTotal) || 1);
      const idx = Math.max(1, Number(item && item.blankSlotIndex) || 1);
      if (slots <= 1) return true;
      return idx === slots;
    },
    fillBlankShortItemDisplayScore(item) {
      const q = Number(item && item.questionScore);
      if (Number.isFinite(q)) return q;
      return Number(item && item.scorePerQuestion) || 0;
    }
  }
};
</script>

<style scoped>
.choice-frame + .choice-frame {
  margin-top: 10px;
  border-top: 1px dashed #d4daef;
  padding-top: 10px;
}

.fillblank-line {
  display: block;
  width: 100%;
  border-bottom: 1px solid #000;
  height: 12px;
}

.fillblank-score {
  margin-left: 6px;
  font-size: 10px;
  color: #606266;
  white-space: nowrap;
}

/* 行间：固定竖向间距 + 行高下限（不用 gap）；同行内线之间仍用 gap（见 short-item / long-line-row） */
.fillblank-render {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.fillblank-render > .fillblank-render-row:not(:last-child) {
  margin-bottom: 0;
}

.fillblank-render-row {
  box-sizing: border-box;
  min-height: 35px;
  align-content: center;
}

.fillblank-render-row-short {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 12px;
}

.fillblank-render-row-short.fillblank-render-row-short--cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.fillblank-render-row-short-segment {
  grid-template-columns: minmax(0, 1fr);
}

.fillblank-render-row-short:not(.fillblank-render-row-short-segment) .fillblank-inline-blank {
  min-width: 44px;
}

/**
 * A3 三栏短填：栏宽较窄，段内多空格按 flex 平分题号与分值之间的剩余宽度（避免 min-width 抢空间导致挤版）
 */
.fillblank-render--a3-three-col-short .fillblank-render-short-item {
  min-width: 0;
}

.fillblank-render--a3-three-col-short .fillblank-render-row-short .fillblank-inline-blank {
  flex: 1 1 0;
  min-width: 0;
}

.fillblank-render-short-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  margin: 0;
  min-height: 35px;
}

.fillblank-inline-blank {
  display: inline-block;
  min-width: 64px;
  margin-left: 0;
  border-bottom: 1px solid #000;
  height: 12px;
  flex: 1;
}

.fillblank-render-long-item {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.fillblank-render-long-item > * + * {
  margin-top: 0;
}

.fillblank-long-line-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 35px;
}

.fillblank-long-line-row .fillblank-line {
  flex: 1;
}

.fillblank-long-line-row + .fillblank-long-line-row {
  margin-top: 0;
}

.fillblank-render-long-lines {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* 与 ObjectiveQuestionType 小题题号一致 */
.question-num {
  flex-shrink: 0;
  padding-right: 1px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: #000;
  white-space: nowrap;
  text-align: right;
  line-height: 1.2;
  width: 18px;
}
</style>

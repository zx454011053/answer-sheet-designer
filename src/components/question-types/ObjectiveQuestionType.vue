<template>
  <div class="objective-bands">
    <div
      v-for="(band, bandIdx) in layout.bands"
      :key="`${section.key}-band-${bandIdx}`"
      class="choice-band"
    >
      <div
        class="choice-columns"
        :class="choiceColumnsModifierClass(band)"
        :style="{ gridTemplateColumns: choiceGridTemplateColumnsForBand(band) }"
      >
        <div
          v-for="(column, columnIdx) in band.columns"
          :key="`${section.key}-b${bandIdx}-col-${columnIdx}`"
          class="choice-column"
        >
          <div
            v-for="question in column"
            :key="`${section.key}-${question.num}`"
            class="question-row"
          >
            <span class="question-num">{{ question.num }}</span>
            <div class="options">
              <span
                v-for="opt in question.optionLabels"
                :key="`${section.key}-${question.num}-${opt}`"
                class="option-item"
              >
                <span class="option-item__glyph">{{ opt }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ObjectiveQuestionType',
  props: {
    section: {
      type: Object,
      required: true
    }
  },
  computed: {
    layout() {
      const s = this.section;
      const bands = Array.isArray(s.objectiveBands) && s.objectiveBands.length
        ? s.objectiveBands
        : null;
      if (bands) {
        const fallback = Math.max(
          1,
          Number(s.colsPerBand) || Number(s.columnCount) || bands[0].columns.length || 1
        );
        return { bands, colsPerBand: fallback };
      }
      const cols = Array.isArray(s.columns) ? s.columns : [];
      return {
        bands: [{ columns: cols }],
        colsPerBand: Math.max(1, Number(s.columnCount) || cols.length || 1)
      };
    }
  },
  methods: {
    colsPerBandForBand(band) {
      const n = Number(band && band.colsPerBand);
      if (Number.isFinite(n) && n >= 1) return n;
      const fromCols = band && Array.isArray(band.columns) ? band.columns.length : 0;
      if (fromCols >= 1) return fromCols;
      return Math.max(1, Number(this.layout.colsPerBand) || 1);
    },
    choiceColumnsModifierClass(band) {
      const n = this.colsPerBandForBand(band);
      return { 'choice-columns--three': n === 3 };
    },
    choiceGridTemplateColumnsForBand(band) {
      const n = this.colsPerBandForBand(band);
      return `repeat(${Math.max(1, n)}, minmax(0, 1fr))`;
    }
  }
};
</script>

<style scoped>
/* 约束在试题框 / multicol 列宽内：禁止 visible 外溢；子项 min-width 与 border-box 避免撑破列 */
.objective-bands {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow-x: clip;
}

.choice-band {
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow-x: clip;
}

.choice-columns {
  display: grid;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  column-gap: 8px;
  align-items: start;
}

/* 三列：列宽均分，列间略收紧 */
.choice-columns.choice-columns--three {
  column-gap: 4px;
}

.choice-column {
  min-width: 0;
}

.question-row {
  /* flex 行替代 grid：减轻 html2canvas 下题号与选项行垂直对齐错位 */
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  column-gap: 6px;
  margin-bottom: 5px;
  min-width: 0;
}

.question-row:last-child {
  margin-bottom: 0;
}

.question-num {
  flex: 0 0 auto;
  width: 18px;
  padding-right: 1px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: #000;
  white-space: nowrap;
  text-align: right;
  line-height: 1.2;
}

.options {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  align-content: flex-start;
  gap: 4px;
}

.option-item {
  box-sizing: border-box;
  flex: 0 1 23px;
  min-width: 14px;
  width: 23px;
  max-width: 100%;
  height: 10px;
  border: 1px solid #000;
  overflow: hidden;
  /* flex 居中：html2canvas 对 transform 居中易偏差，导出 PDF 时更明显 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.option-item__glyph {
  font-size: 8px;
  line-height: 1;
  color: #000;
}
</style>

<template>
  <div class="chinese-render">
    <div class="chinese-render-item">
      <div
        v-for="(row, rowIdx) in section.rows"
        :key="`chinese-${section.id}-${rowIdx}`"
        class="chinese-grid-row"
        :style="chineseGridRowStyle"
        :data-chinese-row-key="row.measureKey || ''"
      >
        <span
          v-for="cellIdx in section.columns"
          :key="`chinese-cell-${section.id}-${rowIdx}-${cellIdx}`"
          class="chinese-grid-cell"
        >
          <span v-if="getChineseCellMarker(section, row, cellIdx)" class="chinese-grid-marker">
            {{ getChineseCellMarker(section, row, cellIdx) }}
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChineseQuestionType',
  props: {
    section: { type: Object, required: true },
    getChineseCellMarker: { type: Function, required: true }
  },
  computed: {
    chineseGridRowStyle() {
      const n = Math.max(1, Number(this.section.columns) || 22);
      return {
        gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`
      };
    }
  }
};
</script>

<style scoped>
.chinese-render {
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.chinese-render-item {
  border: 1px solid #000;
  padding: 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-x: auto;
}

.chinese-grid-row {
  display: grid;
  width: 100%;
  position: relative;
}

.chinese-grid-cell {
  border-top: 1px solid #000;
  border-bottom: 1px solid #000;
  border-right: 1px solid #000;
  height: 30px;
  box-sizing: border-box;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chinese-grid-cell:first-child {
  border-left: 1px solid #000;
}

.chinese-grid-marker {
  position: absolute;
  top: calc(100% + 1px);
  left: 50%;
  transform: translateX(-50%) scale(.6);
  -webkit-transform: translateX(-50%) scale(.6);
  font-size: 12px;
  transform-origin: center top;
  color: #606266;
  line-height: 1;
  white-space: nowrap;
  background: #fff;
  padding: 0 2px;
  z-index: 2;
}
</style>

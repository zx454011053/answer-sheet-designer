<template>
  <div class="answer-render">
    <div
      v-for="(item, idx) in section.items"
      :key="`answer-item-${section.id}-${item.num}-${idx}`"
      class="answer-render-item"
      :data-answer-item-key="item.measureKey || ''"
      :style="{ height: `${item.areaHeight}px` }"
      @mousedown="$emit('resize-start', $event, section.id, item.num)"
    >
      <div class="answer-render-header">
        <span class="answer-render-num">{{ item.num }}</span>
        <span class="answer-render-score">({{ formatScore(item.scorePerQuestion) }}分)</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AnswerQuestionType',
  props: {
    section: { type: Object, required: true },
    formatScore: { type: Function, required: true }
  }
};
</script>

<style scoped>
.answer-render {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.answer-render-item {
  position: relative;
  box-sizing: border-box;
  max-width: 100%;
  border: 1px solid #000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/** 下沿命中条：便于拖动调整高度（与编辑器 bottomResizeStripPx 对齐） */
.answer-render-item::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 18px;
  cursor: ns-resize;
  z-index: 1;
}

.answer-render-item + .answer-render-item {
  margin-top: -1px;
}

.answer-render-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 8px 2px;
  font-size: 12px;
  font-weight: 600;
  color: #000;
}

.answer-render-num {
  line-height: 1.2;
}

.answer-render-score {
  font-size: 12px;
  line-height: 1.2;
  color: #000;
}
</style>

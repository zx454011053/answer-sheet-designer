<template>
  <div class="english-render">
    <div class="english-render-item">
      <div
        v-for="(line, lineIdx) in section.lines"
        :key="line.measureKey || `english-${section.id}-${lineIdx}`"
        class="english-line-row"
        :class="{ 'english-line-row--lead': line.rowType === 'english-lead' }"
        :data-english-line-key="line.measureKey || ''"
      >
        <template v-if="line.rowType === 'english-lead'">
          <span class="english-line-prefix">{{ line.leadText }}</span>
        </template>
        <template v-else>
          <span v-if="line.prefixText" class="english-line-num">{{ line.prefixText }}</span>
          <span class="english-line-rule"></span>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EnglishQuestionType',
  props: {
    section: { type: Object, required: true }
  }
};
</script>

<style scoped>
.english-render {
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.english-render-item {
  border: none;
  padding: 0;
}

.english-line-row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 35px;
}

.english-line-row:not(.english-line-row--lead) {
  gap: 8px;
}

.english-line-row--lead {
  align-items: center;
}

.english-line-num {
  flex-shrink: 0;
  min-width: 18px;
  font-size: 12px;
  color: #000;
  white-space: nowrap;
}

.english-line-prefix {
  font-size: 12px;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.english-line-rule {
  flex: 1;
  border-bottom: 1px solid #000;
  min-height: 14px;
}
</style>

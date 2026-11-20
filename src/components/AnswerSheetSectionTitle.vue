<template>
  <div v-if="visible" class="section-title" :style="sectionTitleInlineStyle">
    {{ cnSectionNo }}.{{ sectionTitleText }}
    <template v-if="showScorePart">（{{ scoreText }}分）</template>
  </div>
</template>

<script>
import {
  formatAnswerSheetScore,
  formatChineseSectionNo
} from '@/core/sectionTitleFormat';
import { SECTION_TITLE_BAR_LINE_HEIGHT_PX } from '@/core/sectionMetrics';

export default {
  name: 'AnswerSheetSectionTitle',
  props: {
    section: {
      type: Object,
      required: true
    },
  },
  computed: {
    visible() {
      const s = this.section;
      return s && !s.isContinuation && s.sectionVisible !== false && !s.a3SuppressSectionTitle;
    },
    /** 大题标题后总分：填空题也始终显示；「是否显示分数」仅控制题内小题分（见 FillBlankQuestionType） */
    showScorePart() {
      return true;
    },
    cnSectionNo() {
      return formatChineseSectionNo(this.section.sectionNo);
    },
    sectionTitleText() {
      return this.section.sectionTitle || '';
    },
    scoreText() {
      return formatAnswerSheetScore(this.section.totalScore);
    },
    sectionTitleInlineStyle() {
      const h = SECTION_TITLE_BAR_LINE_HEIGHT_PX;
      return {
        height: `${h}px`,
        minHeight: `${h}px`
      };
    }
  }
};
</script>

<style scoped>
.section-title {
  box-sizing: border-box;
  margin-top: 10px;
  margin-bottom: 0;
  display: flex;
  align-items: center;
  font-size: 15px;
  line-height: 1.2;
  color: #000;
  white-space: nowrap;
}
</style>

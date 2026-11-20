<template>
  <div class="answer-sheet-question-section-host" style="display: contents">
    <template v-if="isObjectiveFirstDrawSplit">
      <div
        :key="`${keyPrefix}-section-${sectionKey}-title`"
        class="question-section-item sheet-objective-title-only"
        :class="{ 'question-section-objective-merge-follow': objectiveMergedWithPrevious }"
        :data-section-key="sectionKey"
      >
        <answer-sheet-section-title
          :section="section"
          :show-fill-blank-score="showFillBlankScore"
        />
      </div>
      <div
        :key="`${keyPrefix}-section-${sectionKey}-obj`"
        class="question-section-item question-section-objective-merge-follow"
        :data-section-key="sectionKey"
      >
        <div class="question-block question-block-item question-block-objective-merged-top">
          <div v-if="showBlockActions" class="block-actions">
            <el-button type="text" size="mini" @click="$emit('edit', section)">编辑</el-button>
            <el-button type="text" size="mini" class="danger-text-btn" @click="$emit('delete', section.id)">删除</el-button>
          </div>
          <objective-question-type :section="section" />
        </div>
      </div>
    </template>
    <div
      v-else
      :key="`${keyPrefix}-section-${sectionKey}`"
      class="question-section-item"
      :class="{ 'question-section-objective-merge-follow': objectiveMergedWithPrevious }"
      :data-section-key="sectionKey"
    >
      <answer-sheet-section-title
        :section="section"
        :show-fill-blank-score="showFillBlankScore"
      />
      <div
        class="question-block question-block-item"
        :class="{
          'question-block-fillblank': section.type === 'fillblank',
          'question-block-answer': section.type === 'answer',
          'question-block-chinese': section.type === 'chinese',
          'question-block-objective-merged-top': objectiveMergedWithPrevious
        }"
      >
        <div v-if="showBlockActions" class="block-actions">
          <el-button type="text" size="mini" @click="$emit('edit', section)">编辑</el-button>
          <el-button type="text" size="mini" class="danger-text-btn" @click="$emit('delete', section.id)">删除</el-button>
        </div>
        <objective-question-type
          v-if="section.type === 'single' || section.type === 'multiple' || section.type === 'judge' || section.type === 'objective'"
          :section="section"
        />
        <answer-question-type
          v-else-if="section.type === 'answer'"
          :section="section"
          :format-score="formatScore"
          @resize-start="forwardResizeStart"
        />
        <english-question-type
          v-else-if="section.type === 'english'"
          :section="section"
        />
        <chinese-question-type
          v-else-if="section.type === 'chinese'"
          :section="section"
          :get-chinese-cell-marker="getChineseCellMarker"
        />
        <fill-blank-question-type
          v-else
          :section="section"
          :show-fill-blank-score="showFillBlankScore"
          :format-score="formatScore"
          :get-short-blank-count="getShortBlankCount"
        />
      </div>
    </div>
  </div>
</template>

<script>
import ObjectiveQuestionType from '@/components/question-types/ObjectiveQuestionType.vue';
import FillBlankQuestionType from '@/components/question-types/FillBlankQuestionType.vue';
import AnswerQuestionType from '@/components/question-types/AnswerQuestionType.vue';
import EnglishQuestionType from '@/components/question-types/EnglishQuestionType.vue';
import ChineseQuestionType from '@/components/question-types/ChineseQuestionType.vue';
import AnswerSheetSectionTitle from '@/components/AnswerSheetSectionTitle.vue';

export default {
  name: 'AnswerSheetQuestionSection',
  components: {
    ObjectiveQuestionType,
    FillBlankQuestionType,
    AnswerQuestionType,
    EnglishQuestionType,
    ChineseQuestionType,
    AnswerSheetSectionTitle
  },
  props: {
    section: {
      type: Object,
      required: true
    },
    sectionKey: {
      type: String,
      required: true
    },
    keyPrefix: {
      type: String,
      required: true
    },
    isObjectiveFirstDrawSplit: {
      type: Boolean,
      default: false
    },
    objectiveMergedWithPrevious: {
      type: Boolean,
      default: false
    },
    showFillBlankScore: {
      type: Boolean,
      default: true
    },
    formatScore: {
      type: Function,
      required: true
    },
    getChineseCellMarker: {
      type: Function,
      required: true
    },
    getShortBlankCount: {
      type: Function,
      required: true
    }
  },
  computed: {
    showBlockActions() {
      const s = this.section;
      if (!s) return false;
      return s.objectiveBandSliceIndex != null
        ? s.objectiveBandSliceIndex === 0
        : (!s.isContinuation && !s.a3SuppressSectionTitle);
    }
  },
  methods: {
    forwardResizeStart(event, blockId, questionNum) {
      this.$emit('resize-start', event, blockId, questionNum);
    }
  }
};
</script>

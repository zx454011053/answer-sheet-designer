<template>
  <div class="sheet-preview" :class="previewShellClass" :style="previewShellStyle">
    <template v-if="!isA3MultiColumnLayout">
      <div class="position-marker top-left"></div>
      <div class="position-marker top-right"></div>
      <div class="position-marker bottom-left"></div>
      <div class="position-marker bottom-right"></div>
    </template>

    <class-number-side-seal
      v-if="pageIdx === 0 && isClassNumberMode"
      :side-seal-class-row-labels="sideSealClassRowLabels"
      :side-seal-student-row-labels="sideSealStudentRowLabels"
      :side-seal-digits-top-down="sideSealDigitsTopDown"
    />

    <template v-if="isA3MultiColumnLayout && effectiveA3ColumnCount === 2">
      <div
        v-for="paneIdx in 2"
        :key="`a3-pane-${pageIdx}-${paneIdx}`"
        class="sheet-a3-col-pane"
        :class="[`sheet-a3-col-pane--${paneIdx}`]"
      >
        <div class="sheet-a3-col-pane-frame" aria-hidden="true">
          <div class="sheet-a3-col-pane-markers">
            <div class="position-marker top-left"></div>
            <div class="position-marker top-right"></div>
            <div class="position-marker bottom-left"></div>
            <div class="position-marker bottom-right"></div>
            <div class="sheet-a3-pane-marker-guides">
              <div class="sheet-a3-pane-marker-guide sheet-a3-pane-marker-guide--outer"></div>
              <div class="sheet-a3-pane-marker-guide sheet-a3-pane-marker-guide--inner"></div>
            </div>
          </div>
        </div>
        <div
          class="sheet-a3-draw-fill sheet-a3-draw-fill--two-col-pane"
          aria-hidden="true"
        ></div>
        <div
          class="sheet-a3-col-pane-body sheet-a3-two-col-pane-shell"
          :class="{
            'sheet-a3-two-col-pane-shell--first-page': pageIdx === 0 && paneIdx === 1,
            'sheet-a3-two-col-pane-shell--continuation': pageIdx > 0 || paneIdx === 2
          }"
        >
          <sheet-drawable-leader
            v-if="paneIdx === 1 && pageIdx === 0"
            class="sheet-a3-two-col-drawable-leader sheet-a4-drawable-leader"
            :preview-title="previewTitle"
            :exam-no="examNo"
            :qr-code-data-url="qrCodeDataUrl"
            :show-qr-code="showQrCode"
            :notice-list="noticeList"
            :short-number-row-labels="shortNumberRowLabels"
            :admission-card-style="admissionCardStyle"
            :admission-grid-style="admissionGridStyle"
            :effective-admission-columns="effectiveAdmissionColumns"
            :fill-type="fillType"
            :drawable-inner-height-px="answerSheetDrawableLeaderInnerHeightPx"
            :log-draw-placement-debug="isAnswerSheetDrawableLeaderDebug"
            @layout-height="$emit('layout-height', $event)"
            @edit-admission="$emit('edit-admission')"
            @edit-notice="$emit('edit-notice')"
          />
          <answer-sheet-question-section
            v-for="(section, secIdx) in (page.a3ColumnSections[paneIdx - 1] || [])"
            :key="`page-${pageIdx}-col-${paneIdx}-section-${previewSectionStableKey(section)}`"
            :section="section"
            :section-key="previewSectionStableKey(section)"
            :key-prefix="`page-${pageIdx}-col-${paneIdx}`"
            :is-objective-first-draw-split="isObjectiveFirstDrawSplitLayout(section)"
            :objective-merged-with-previous="isObjectiveBandMergedWithPrevious(section, page.a3ColumnSections[paneIdx - 1], secIdx)"
            :show-fill-blank-score="showFillBlankScore"
            :format-score="formatScore"
            :get-chinese-cell-marker="getChineseCellMarker"
            :get-short-blank-count="getShortBlankCount"
            @edit="$emit('edit', $event)"
            @delete="$emit('delete', $event)"
            @resize-start="forwardResizeStart"
          />
        </div>
      </div>
    </template>

    <template v-else-if="isA3MultiColumnLayout && effectiveA3ColumnCount === 3">
      <div
        v-for="paneIdx in 3"
        :key="`a3-pane-${pageIdx}-${paneIdx}`"
        class="sheet-a3-col-pane"
        :class="[`sheet-a3-col-pane--${paneIdx}`]"
      >
        <div class="sheet-a3-col-pane-frame" aria-hidden="true">
          <div class="sheet-a3-col-pane-markers">
            <div class="position-marker top-left"></div>
            <div class="position-marker top-right"></div>
            <div class="position-marker bottom-left"></div>
            <div class="position-marker bottom-right"></div>
            <div class="sheet-a3-pane-marker-guides">
              <div class="sheet-a3-pane-marker-guide sheet-a3-pane-marker-guide--outer"></div>
              <div class="sheet-a3-pane-marker-guide sheet-a3-pane-marker-guide--inner"></div>
            </div>
          </div>
        </div>
        <div
          class="sheet-a3-draw-fill sheet-a3-draw-fill--three-col-pane"
          aria-hidden="true"
        ></div>
        <div
          class="sheet-a3-col-pane-body sheet-a3-two-col-pane-shell"
          :class="{
            'sheet-a3-two-col-pane-shell--first-page': pageIdx === 0 && paneIdx === 1,
            'sheet-a3-two-col-pane-shell--continuation': pageIdx > 0 || paneIdx > 1
          }"
        >
          <sheet-drawable-leader
            v-if="paneIdx === 1 && pageIdx === 0"
            class="sheet-a3-two-col-drawable-leader sheet-a4-drawable-leader"
            :preview-title="previewTitle"
            :exam-no="examNo"
            :qr-code-data-url="qrCodeDataUrl"
            :show-qr-code="showQrCode"
            :notice-list="noticeList"
            :short-number-row-labels="shortNumberRowLabels"
            :admission-card-style="admissionCardStyle"
            :admission-grid-style="admissionGridStyle"
            :effective-admission-columns="effectiveAdmissionColumns"
            :fill-type="fillType"
            :drawable-inner-height-px="answerSheetDrawableLeaderInnerHeightPx"
            :log-draw-placement-debug="isAnswerSheetDrawableLeaderDebug"
            @layout-height="$emit('layout-height', $event)"
            @edit-admission="$emit('edit-admission')"
            @edit-notice="$emit('edit-notice')"
          />
          <answer-sheet-question-section
            v-for="(section, secIdx) in (page.a3ColumnSections[paneIdx - 1] || [])"
            :key="`page-${pageIdx}-col-${paneIdx}-section-${previewSectionStableKey(section)}`"
            :section="section"
            :section-key="previewSectionStableKey(section)"
            :key-prefix="`page-${pageIdx}-col-${paneIdx}`"
            :is-objective-first-draw-split="isObjectiveFirstDrawSplitLayout(section)"
            :objective-merged-with-previous="isObjectiveBandMergedWithPrevious(section, page.a3ColumnSections[paneIdx - 1], secIdx)"
            :show-fill-blank-score="showFillBlankScore"
            :format-score="formatScore"
            :get-chinese-cell-marker="getChineseCellMarker"
            :get-short-blank-count="getShortBlankCount"
            @edit="$emit('edit', $event)"
            @delete="$emit('delete', $event)"
            @resize-start="forwardResizeStart"
          />
        </div>
      </div>
    </template>

    <div v-else class="sheet-safe-area">
      <template v-if="pageIdx === 0 && !isA4Layout">
        <sheet-drawable-leader
          :preview-title="previewTitle"
          :exam-no="examNo"
          :qr-code-data-url="qrCodeDataUrl"
          :notice-list="noticeList"
          :short-number-row-labels="shortNumberRowLabels"
          :admission-card-style="admissionCardStyle"
          :admission-grid-style="admissionGridStyle"
          :effective-admission-columns="effectiveAdmissionColumns"
          :fill-type="fillType"
          @edit-admission="$emit('edit-admission')"
          @edit-notice="$emit('edit-notice')"
        />
      </template>

      <div class="questions-section-host questions-section-host--pass-through">
        <div
          v-if="isA4Layout"
          class="sheet-a4-questions-shell"
          :class="{
            'sheet-a4-questions-shell--continuation': pageIdx > 0,
            'sheet-a4-questions-shell--first-page-plain': pageIdx === 0
          }"
        >
          <sheet-drawable-leader
            v-if="pageIdx === 0"
            class="sheet-a4-drawable-leader"
            :preview-title="previewTitle"
            :exam-no="examNo"
            :qr-code-data-url="qrCodeDataUrl"
            :show-qr-code="showQrCode"
            :notice-list="noticeList"
            :short-number-row-labels="shortNumberRowLabels"
            :admission-card-style="admissionCardStyle"
            :admission-grid-style="admissionGridStyle"
            :effective-admission-columns="effectiveAdmissionColumns"
            :fill-type="fillType"
            :drawable-inner-height-px="answerSheetDrawableLeaderInnerHeightPx"
            :log-draw-placement-debug="isAnswerSheetDrawableLeaderDebug"
            @layout-height="$emit('layout-height', $event)"
            @edit-admission="$emit('edit-admission')"
            @edit-notice="$emit('edit-notice')"
          />
          <div
            v-if="pageIdx > 0"
            class="questions-section sheet-a4-questions-section questions-section-continuation"
          >
            <answer-sheet-question-section
              v-for="(section, secIdx) in page.sections"
              :key="`page-${pageIdx}-section-${section.chunkKey || section.key}`"
              :section="section"
              :section-key="section.chunkKey || section.key"
              :key-prefix="`page-${pageIdx}`"
              :is-objective-first-draw-split="isObjectiveFirstDrawSplitLayout(section)"
              :objective-merged-with-previous="isObjectiveBandMergedWithPrevious(section, page.sections, secIdx)"
              :show-fill-blank-score="showFillBlankScore"
              :format-score="formatScore"
              :get-chinese-cell-marker="getChineseCellMarker"
              :get-short-blank-count="getShortBlankCount"
              @edit="$emit('edit', $event)"
              @delete="$emit('delete', $event)"
              @resize-start="forwardResizeStart"
            />
          </div>
          <template v-else>
            <answer-sheet-question-section
              v-for="(section, secIdx) in page.sections"
              :key="`page-${pageIdx}-section-${section.chunkKey || section.key}`"
              :section="section"
              :section-key="section.chunkKey || section.key"
              :key-prefix="`page-${pageIdx}`"
              :is-objective-first-draw-split="isObjectiveFirstDrawSplitLayout(section)"
              :objective-merged-with-previous="isObjectiveBandMergedWithPrevious(section, page.sections, secIdx)"
              :show-fill-blank-score="showFillBlankScore"
              :format-score="formatScore"
              :get-chinese-cell-marker="getChineseCellMarker"
              :get-short-blank-count="getShortBlankCount"
              @edit="$emit('edit', $event)"
              @delete="$emit('delete', $event)"
              @resize-start="forwardResizeStart"
            />
          </template>
        </div>
        <div
          v-else
          class="questions-section"
          :class="{ 'questions-section-continuation': pageIdx > 0 }"
        >
          <answer-sheet-question-section
            v-for="(section, secIdx) in page.sections"
            :key="`page-${pageIdx}-section-${section.chunkKey || section.key}`"
            :section="section"
            :section-key="section.chunkKey || section.key"
            :key-prefix="`page-${pageIdx}`"
            :is-objective-first-draw-split="isObjectiveFirstDrawSplitLayout(section)"
            :objective-merged-with-previous="isObjectiveBandMergedWithPrevious(section, page.sections, secIdx)"
            :show-fill-blank-score="showFillBlankScore"
            :format-score="formatScore"
            :get-chinese-cell-marker="getChineseCellMarker"
            :get-short-blank-count="getShortBlankCount"
            @edit="$emit('edit', $event)"
            @delete="$emit('delete', $event)"
            @resize-start="forwardResizeStart"
          />
        </div>
      </div>
    </div>
    <div
      v-if="isA4Layout"
      class="sheet-a4-page-draw-overlay"
      aria-hidden="true"
    >
      <div class="sheet-a4-marker-guides">
        <div class="sheet-a4-marker-guide sheet-a4-marker-guide--outer"></div>
        <div class="sheet-a4-marker-guide sheet-a4-marker-guide--inner"></div>
      </div>
      <div class="sheet-a4-questions-draw-fill"></div>
    </div>

    <!-- 页码：多页时居中贴纸底，绝对定位不参与分页计算 -->
    <div v-if="pageTotal > 1" class="sheet-page-number">
      第 {{ pageIdx + 1 }} 页 共 {{ pageTotal }} 页
    </div>
  </div>
</template>

<script>
import SheetDrawableLeader from '@/components/SheetDrawableLeader.vue';
import ClassNumberSideSeal from '@/components/fill-types/ClassNumberSideSeal.vue';
import AnswerSheetQuestionSection from '@/components/AnswerSheetQuestionSection.vue';

export default {
  name: 'AnswerSheetSheetPage',
  components: {
    SheetDrawableLeader,
    ClassNumberSideSeal,
    AnswerSheetQuestionSection
  },
  props: {
    page: {
      type: Object,
      required: true
    },
    pageIdx: {
      type: Number,
      required: true
    },
    /** 总页数：大于 1 时在纸底居中显示「第 X 页 共 Y 页」 */
    pageTotal: {
      type: Number,
      default: 1
    },
    previewShellClass: {
      type: Object,
      required: true
    },
    previewShellStyle: {
      type: Object,
      default: () => ({})
    },
    isA3MultiColumnLayout: {
      type: Boolean,
      default: false
    },
    effectiveA3ColumnCount: {
      type: Number,
      default: 2
    },
    isA4Layout: {
      type: Boolean,
      default: true
    },
    isClassNumberMode: {
      type: Boolean,
      default: false
    },
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
    fillType: {
      type: String,
      default: 'admission'
    },
    answerSheetDrawableLeaderInnerHeightPx: {
      type: Number,
      default: 0
    },
    isAnswerSheetDrawableLeaderDebug: {
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
    },
    isObjectiveFirstDrawSplitLayout: {
      type: Function,
      required: true
    },
    isObjectiveBandMergedWithPrevious: {
      type: Function,
      required: true
    },
    previewSectionStableKey: {
      type: Function,
      required: true
    },
    sideSealClassRowLabels: {
      type: Array,
      default: () => []
    },
    sideSealStudentRowLabels: {
      type: Array,
      default: () => []
    },
    sideSealDigitsTopDown: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    forwardResizeStart(event, blockId, questionNum) {
      this.$emit('resize-start', event, blockId, questionNum);
    }
  }
};
</script>

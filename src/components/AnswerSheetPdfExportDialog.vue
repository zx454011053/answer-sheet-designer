<template>
  <el-dialog
    :visible="visible"
    title="正在导出 PDF"
    width="420px"
    :z-index="5000"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    append-to-body
    custom-class="answer-sheet-pdf-export-dialog"
    center
    @closed="$emit('closed')"
  >
    <div class="pdf-export-dialog-body">
      <p class="pdf-export-dialog-tip">正在生成答题卡 PDF，请稍候…</p>
      <el-progress
        :percentage="percentage"
        :stroke-width="14"
        :status="percentage >= 100 ? 'success' : null"
      />
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'AnswerSheetPdfExportDialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    percentage: {
      type: Number,
      default: 0
    }
  }
};
</script>

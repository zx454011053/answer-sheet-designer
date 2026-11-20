<template>
  <div class="preview-section">
    <div v-if="showHeader" class="preview-header">
      <el-button size="small" icon="el-icon-back" @click="$emit('go-back')">返回</el-button>
      <span class="preview-title">{{ previewTitle }}</span>
    </div>
    <div
      ref="sheetPreviewScrollEl"
      class="preview-content"
      :class="previewContentClass"
      @mousedown="$emit('pan-mousedown', $event)"
    >
      <div ref="pdfExportRoot" class="preview-content-sheets">
        <slot />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AnswerSheetPreviewHost',
  props: {
    previewTitle: {
      type: String,
      default: ''
    },
    previewContentClass: {
      type: Object,
      default: () => ({})
    },
    /** 是否显示顶部标题栏（嵌入宿主页面时可关闭，避免重复的返回按钮） */
    showHeader: {
      type: Boolean,
      default: true
    }
  }
};
</script>

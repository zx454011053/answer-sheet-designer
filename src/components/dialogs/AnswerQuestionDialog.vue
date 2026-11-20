<template>
  <el-dialog
    :title="title"
    :visible="visible"
    width="1020px"
    append-to-body
    destroy-on-close
    custom-class="answer-question-dialog"
    @close="$emit('close')"
  >
    <el-form size="small" label-width="72px" class="answer-config-form">
      <div class="answer-form-row-inline">
        <el-form-item label="大题题号" class="answer-form-item--tight">
          <el-input-number
            v-model="form.sectionNo"
            :min="1"
            :max="99"
            controls-position="right"
            class="answer-input-section-no"
          />
        </el-form-item>
        <el-form-item label="题目名称" class="answer-form-item--title">
          <el-input
            v-model="form.sectionTitle"
            :placeholder="getDefaultSectionTitle()"
            class="answer-input-title"
          />
        </el-form-item>
        <el-form-item label="分段" class="answer-form-item--actions">
          <div class="answer-add-buttons">
            <el-button size="small" type="primary" plain @click="appendSegment">+分段</el-button>
          </div>
        </el-form-item>
      </div>
    </el-form>

    <div class="answer-dialog-segments">
      <template v-if="!form.segments || !form.segments.length">
        <p class="answer-dialog-segments-empty">
          请用上方按钮添加分段（生成前至少保留一段）
        </p>
      </template>
      <template v-else>
        <div
          v-for="(segment, segIdx) in form.segments"
          :key="segment.tempId || segIdx"
          class="answer-dialog-segment"
        >
          <span class="seg-muted">题号</span>
          <el-input-number
            v-model="segment.startNum"
            :min="1"
            :max="999"
            controls-position="right"
            size="mini"
            class="seg-input-num"
          />
          <span class="seg-sep">~</span>
          <el-input-number
            v-model="segment.endNum"
            :min="1"
            :max="999"
            controls-position="right"
            size="mini"
            class="seg-input-num"
          />
          <span class="seg-divider" aria-hidden="true" />
          <span class="seg-muted">分值</span>
          <el-input-number
            v-model="segment.scorePerQuestion"
            :min="0.5"
            :max="100"
            :step="0.5"
            controls-position="right"
            size="mini"
            class="seg-input-score"
          />
          <span class="seg-unit">分</span>
          <span class="seg-divider" aria-hidden="true" />
          <span class="seg-muted">高度</span>
          <el-input-number
            v-model="segment.areaHeight"
            :min="80"
            :max="520"
            :step="10"
            controls-position="right"
            size="mini"
            class="seg-input-height"
          />
          <span class="seg-unit">px</span>
          <el-button
            type="text"
            size="mini"
            class="danger-text-btn seg-del"
            @click="removeSegment(segIdx)"
          >删除</el-button>
        </div>
      </template>
    </div>

    <div class="answer-dialog-table">
      <el-table :data="previewRows" border size="mini" height="200">
        <el-table-column prop="num" label="题号" width="72" />
        <el-table-column prop="scorePerQuestion" label="分值" width="88" />
        <el-table-column prop="areaHeight" label="答题区高度(px)" min-width="120" />
      </el-table>
    </div>
    <span slot="footer">
      <el-button size="small" @click="$emit('close')">取消</el-button>
      <el-button size="small" type="primary" @click="$emit('confirm')">
        {{ isEditing ? '保存修改' : '生成' }}
      </el-button>
    </span>
  </el-dialog>
</template>

<script>
export default {
  name: 'AnswerQuestionDialog',
  props: {
    visible: Boolean,
    title: String,
    form: { type: Object, required: true },
    previewRows: { type: Array, default: () => [] },
    isEditing: Boolean,
    getDefaultSectionTitle: { type: Function, required: true },
    appendSegment: { type: Function, required: true },
    removeSegment: { type: Function, required: true }
  }
};
</script>

<style scoped>
.answer-config-form {
  margin-bottom: 8px;
}

.answer-form-row-inline {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.answer-form-row-inline ::v-deep .el-form-item {
  margin-bottom: 0;
  flex-shrink: 0;
}

.answer-form-item--tight {
  flex: 0 0 auto;
}

.answer-form-item--title {
  flex: 1 1 220px;
  min-width: 160px;
}

.answer-form-item--actions {
  flex: 0 0 auto;
}

.answer-input-section-no {
  width: 110px;
}

.answer-input-title {
  width: 100%;
  min-width: 140px;
}

.answer-add-buttons {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  white-space: nowrap;
}

.answer-dialog-segments {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 6px 8px;
  margin-bottom: 10px;
  max-height: 200px;
  overflow-x: hidden;
  overflow-y: auto;
}

.answer-dialog-segments-empty {
  margin: 0;
  padding: 10px 6px;
  font-size: 13px;
  color: #909399;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.answer-dialog-segment {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 0;
  margin-bottom: 4px;
  font-size: 13px;
}

.answer-dialog-segment:last-child {
  margin-bottom: 0;
}

.answer-dialog-segment ::v-deep .seg-input-num.el-input-number--mini,
.answer-dialog-segment ::v-deep .seg-input-num.el-input-number {
  width: 86px;
}

.answer-dialog-segment ::v-deep .seg-input-score.el-input-number--mini,
.answer-dialog-segment ::v-deep .seg-input-score.el-input-number {
  width: 92px;
}

.answer-dialog-segment ::v-deep .seg-input-height.el-input-number--mini,
.answer-dialog-segment ::v-deep .seg-input-height.el-input-number {
  width: 100px;
}

.seg-muted {
  color: #909399;
  flex-shrink: 0;
}

.seg-sep {
  color: #606266;
  flex-shrink: 0;
  padding: 0 1px;
}

.seg-unit {
  color: #606266;
  flex-shrink: 0;
  margin-right: 2px;
}

.seg-divider {
  width: 1px;
  height: 18px;
  background: #e4e7ed;
  margin: 0 4px;
  flex-shrink: 0;
}

.seg-del {
  flex-shrink: 0;
  margin-left: auto;
  padding-left: 8px;
}

.answer-dialog-table {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 6px;
}

.danger-text-btn {
  color: #f56c6c;
}
</style>

<style>
.answer-question-dialog .el-dialog__body {
  padding-top: 12px;
  padding-bottom: 8px;
}
</style>

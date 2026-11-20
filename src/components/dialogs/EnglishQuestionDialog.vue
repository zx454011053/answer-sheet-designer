<template>
  <el-dialog
    :title="title"
    :visible="visible"
    width="1020px"
    append-to-body
    destroy-on-close
    custom-class="english-question-dialog"
    @close="$emit('close')"
  >
    <el-form size="small" label-width="90px" class="english-config-form">
      <div class="english-form-row-inline">
        <el-form-item label="大题题号" class="english-form-item--tight">
          <el-input-number
            v-model="form.sectionNo"
            :min="1"
            :max="99"
            controls-position="right"
            class="english-input-section-no"
          />
        </el-form-item>
        <el-form-item label="题目名称" class="english-form-item--title">
          <el-input
            v-model="form.sectionTitle"
            :placeholder="getDefaultSectionTitle()"
            class="english-input-title"
          />
        </el-form-item>
      </div>
      <div class="english-form-row-inline">
        <el-form-item label="分值" class="english-form-item--score">
          <el-input-number
            v-model="form.scorePerQuestion"
            :min="0.5"
            :max="100"
            :step="0.5"
            controls-position="right"
            class="english-input-score"
          />
          <span class="english-unit">分</span>
        </el-form-item>
        <el-form-item label="行数" class="english-form-item--lines">
          <el-input-number
            v-model="form.lineCount"
            :min="3"
            :max="60"
            controls-position="right"
            class="english-input-lines"
          />
          <span class="english-unit">行</span>
        </el-form-item>
      </div>
      <div class="english-dialog-block">
        <div class="english-dialog-block-title">作文开头内容</div>
        <el-input
          v-model="form.openingText"
          type="textarea"
          :rows="3"
          placeholder="请输入作文开头内容（可留空）"
        />
      </div>
    </el-form>

    <div class="english-dialog-table">
      <el-table :data="previewRows" border size="mini" height="160">
        <el-table-column prop="scorePerQuestion" label="分值" width="88" />
        <el-table-column prop="lineCount" label="行数" width="72" />
        <el-table-column prop="openingPreview" label="开头预览" min-width="200" show-overflow-tooltip />
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
  name: 'EnglishQuestionDialog',
  props: {
    visible: Boolean,
    title: String,
    form: { type: Object, required: true },
    previewRows: { type: Array, default: () => [] },
    isEditing: Boolean,
    getDefaultSectionTitle: { type: Function, required: true }
  }
};
</script>

<style scoped>
.english-config-form {
  margin-bottom: 8px;
}

.english-form-row-inline {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.english-form-row-inline ::v-deep .el-form-item {
  margin-bottom: 0;
  flex-shrink: 0;
}

.english-form-item--tight {
  flex: 0 0 auto;
}

.english-form-item--title {
  flex: 1 1 200px;
  min-width: 140px;
}

.english-form-item--score {
  flex: 0 0 auto;
}

.english-form-item--lines {
  flex: 0 0 auto;
}

.english-input-section-no {
  width: 110px;
}

.english-input-title {
  width: 100%;
  min-width: 140px;
}

.english-input-score {
  width: 110px;
}

.english-input-lines {
  width: 100px;
}

.english-unit {
  margin-left: 6px;
  color: #606266;
  font-size: 13px;
}

.english-dialog-block {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 10px;
}

.english-dialog-block-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.english-dialog-table {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 6px;
}
</style>

<style>
.english-question-dialog .el-dialog__body {
  padding-top: 12px;
  padding-bottom: 8px;
}
</style>

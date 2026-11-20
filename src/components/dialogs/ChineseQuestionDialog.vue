<template>
  <el-dialog
    :title="title"
    :visible="visible"
    width="1020px"
    append-to-body
    destroy-on-close
    custom-class="chinese-question-dialog"
    @close="$emit('close')"
  >
    <el-form size="small" label-width="72px" class="chinese-config-form">
      <div class="chinese-form-row-inline">
        <el-form-item label="大题题号" class="chinese-form-item--tight">
          <el-input-number
            v-model="form.sectionNo"
            :min="1"
            :max="99"
            controls-position="right"
            class="chinese-input-section-no"
          />
        </el-form-item>
        <el-form-item label="题目名称" class="chinese-form-item--title">
          <el-input
            v-model="form.sectionTitle"
            :placeholder="getDefaultSectionTitle()"
            class="chinese-input-title"
          />
        </el-form-item>
      </div>
      <div class="chinese-form-row-inline">
        <el-form-item label="分值" class="chinese-form-item--score">
          <el-input-number
            v-model="form.scorePerQuestion"
            :min="0.5"
            :max="100"
            :step="0.5"
            controls-position="right"
            class="chinese-input-score"
          />
          <span class="chinese-unit">分</span>
        </el-form-item>
        <el-form-item label="最少字数" class="chinese-form-item--words">
          <el-input-number
            v-model="form.minWordCount"
            :min="50"
            :max="5000"
            :step="50"
            controls-position="right"
            class="chinese-input-word"
          />
          <span class="chinese-unit">字</span>
        </el-form-item>
        <el-form-item label="总字数" class="chinese-form-item--words">
          <el-input-number
            v-model="form.maxWordCount"
            :min="100"
            :max="5000"
            :step="50"
            controls-position="right"
            class="chinese-input-word"
          />
          <span class="chinese-unit">字</span>
        </el-form-item>
      </div>
      <div class="chinese-form-row-insert">
        <el-checkbox v-model="form.insertEnabled">插入添加题目</el-checkbox>
        <template v-if="form.insertEnabled">
          <span class="chinese-insert-label">插入到第</span>
          <el-select
            v-model="form.insertAfterSectionNo"
            placeholder="请选择"
            size="small"
            class="chinese-insert-select"
          >
            <el-option
              v-for="no in insertAfterSectionOptions"
              :key="`chinese-after-${no}`"
              :label="formatChineseSectionNo(no)"
              :value="no"
            />
          </el-select>
          <span class="chinese-insert-label">大题后</span>
        </template>
      </div>
    </el-form>

    <div class="chinese-dialog-table">
      <el-table :data="previewRows" border size="mini" height="160">
        <el-table-column prop="order" label="序号" width="56" />
        <el-table-column prop="scorePerQuestion" label="分值" width="88" />
        <el-table-column prop="wordCountRange" label="字数要求" min-width="160" />
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
  name: 'ChineseQuestionDialog',
  props: {
    visible: Boolean,
    title: String,
    form: { type: Object, required: true },
    previewRows: { type: Array, default: () => [] },
    isEditing: Boolean,
    getDefaultSectionTitle: { type: Function, required: true },
    insertAfterSectionOptions: { type: Array, default: () => [] },
    formatChineseSectionNo: { type: Function, required: true }
  }
};
</script>

<style scoped>
.chinese-config-form {
  margin-bottom: 8px;
}

.chinese-form-row-inline {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.chinese-form-row-inline ::v-deep .el-form-item {
  margin-bottom: 0;
  flex-shrink: 0;
}

.chinese-form-item--tight {
  flex: 0 0 auto;
}

.chinese-form-item--title {
  flex: 1 1 220px;
  min-width: 160px;
}

.chinese-form-item--score {
  flex: 0 0 auto;
}

.chinese-form-item--words {
  flex: 0 0 auto;
}

.chinese-input-section-no {
  width: 110px;
}

.chinese-input-title {
  width: 100%;
  min-width: 140px;
}

.chinese-input-score {
  width: 110px;
}

.chinese-input-word {
  width: 118px;
}

.chinese-unit {
  margin-left: 6px;
  color: #606266;
  font-size: 13px;
}

.chinese-form-row-insert {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.chinese-insert-label {
  color: #606266;
  font-size: 13px;
}

.chinese-insert-select {
  width: 110px;
}

.chinese-dialog-table {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 6px;
}
</style>

<style>
.chinese-question-dialog .el-dialog__body {
  padding-top: 12px;
  padding-bottom: 8px;
}
</style>

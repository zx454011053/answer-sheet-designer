<template>
  <!-- eslint-disable vue/no-mutating-props -- form 引用与父级共享，等同原 AnswerSheetEditor 内联面板 -->
  <div class="config-panel">
      <div class="panel-header">
        <div class="panel-header-text">
          <span class="panel-header-title">答题卡设置</span>
          <span class="panel-header-sub">版式、填涂与试题结构</span>
        </div>
        <div class="panel-header-actions">
          <el-button size="small" plain round class="panel-header-secondary" @click="$emit('load-template')">载入模板</el-button>
        </div>
      </div>

    <div class="panel-stats">
      <div class="panel-stat">
        <span class="panel-stat-value">{{ form.questionCount || 0 }}</span>
        <span class="panel-stat-label">题</span>
      </div>
      <div class="panel-stat">
        <span class="panel-stat-value">{{ formattedTotalScore }}</span>
        <span class="panel-stat-label">总分</span>
      </div>
      <div class="panel-stat">
        <span class="panel-stat-value">{{ form.pageCount || 1 }}</span>
        <span class="panel-stat-label">页</span>
      </div>
    </div>

    <div class="panel-content">
      <div class="config-section">
        <div class="section-label">答题卡信息</div>
        <div class="config-field-row">
          <span class="config-field-label">标题</span>
          <el-input
            v-model="form.sheetName"
            size="small"
            maxlength="40"
            clearable
            placeholder="留空则显示考试名称"
          />
        </div>
        <div class="config-field-row">
          <span class="config-field-label">考试号</span>
          <el-input
            v-model="form.examNo"
            size="small"
            maxlength="32"
            clearable
            placeholder="同时作为二维码内容"
          />
        </div>
        <div class="config-field-row config-field-row--switch">
          <span class="config-field-label">二维码</span>
          <el-switch
            v-model="form.qrcodeEnabled"
            :active-value="1"
            :inactive-value="0"
          />
          <span class="config-field-hint">内容为考试号</span>
        </div>
      </div>

      <div class="config-section">
        <div class="section-label">页面布局</div>
        <el-radio-group v-model="form.layoutType" class="layout-group">
          <el-radio label="A4" border size="small">A4</el-radio>
          <el-radio label="A3" border size="small">A3</el-radio>
          <el-radio label="8K" border size="small">8K</el-radio>
        </el-radio-group>
      </div>

      <div v-if="showMulticolColumnOptions" class="config-section">
        <div class="section-label">{{ is8KSheet ? '8K' : 'A3' }} 答题区分栏</div>
        <el-radio-group v-model="form.a3ColumnCount" class="layout-group a3-column-group">
          <el-radio :label="2" border size="small">两栏</el-radio>
          <el-radio :label="3" border size="small">三栏</el-radio>
        </el-radio-group>
      </div>

      <div class="config-section">
        <div class="section-label">学生填涂方式</div>
        <el-radio-group v-model="form.fillType" class="fill-type-group">
          <el-radio label="admission" border size="small">准考证号</el-radio>
          <el-radio label="barcode" border size="small">条码识别</el-radio>
          <el-radio label="short-number" border size="small" :disabled="shortNumberFillDisabled">短学号</el-radio>
        </el-radio-group>
      </div>

      <div v-if="isAdmissionMode" class="config-section">
        <div class="section-label">准考证号位数</div>
        <div class="admission-config-row">
          <el-input-number
            v-model="form.admissionColumns"
            :min="4"
            :max="20"
            size="small"
            controls-position="right"
            @change="(v) => $emit('admission-columns-change', v)"
          />
        </div>
      </div>

      <div class="config-section config-switch">
        <div class="section-label">填空题显示分数</div>
        <el-switch v-model="form.fillBlankShowScore" />
      </div>

      <el-divider class="config-panel-divider" />

      <div class="config-section config-section--questions">
        <div class="section-label">添加试题</div>
        <div class="question-type-buttons">
          <el-button size="small" plain @click="$emit('open-objective-config')">+ 客观题</el-button>
          <el-button size="small" plain @click="$emit('open-fill-blank-create')">+ 填空题</el-button>
          <el-button size="small" plain @click="$emit('open-answer-create')">+ 解答题</el-button>
          <el-button size="small" plain @click="$emit('open-english-create')">+ 英语作文</el-button>
          <el-button size="small" plain @click="$emit('open-chinese-create')">+ 语文作文</el-button>
        </div>
        <div v-if="questionBlocks.length" class="generated-block-list">
          <div
            v-for="item in questionBlocks"
            :key="item.id"
            class="generated-block-item"
            draggable="true"
            @dragstart="$emit('block-drag-start', $event, item.id)"
            @dragover="$emit('block-drag-over', $event)"
            @drop="$emit('block-drop', $event, item.id)"
            @dragend="$emit('block-drag-end')"
          >
            <span>
              {{ formatChineseSectionNo(item.sectionNo || 1) }}.{{ item.sectionTitle || getDefaultSectionTitle(item.type) }}
              （{{ getQuestionTypeLabel(item.type) }}）
              <template v-if="item.type === 'fillblank'"> / {{ getFillBlankBlockQuestionCount(item) }}题</template>
              <template v-else-if="item.type === 'answer'"> / {{ getAnswerBlockQuestionCount(item) }}题</template>
              <template v-else-if="item.type === 'english'"> / 1题</template>
              <template v-else-if="item.type === 'chinese'"> / 1题</template>
              <template v-else> / {{ item.count }}题</template>
              <template v-if="item.type !== 'fillblank' && item.type !== 'answer' && item.type !== 'english' && item.type !== 'chinese'">
                / {{ item.type === 'objective' ? '混合题型' : `${item.optionCount}选项` }}
              </template>
              <template v-else-if="item.type === 'english'"> / {{ item.lineCount || 10 }}行</template>
              <template v-else-if="item.type === 'chinese'"> / {{ Math.ceil((item.maxWordCount || 1000) / 20) }}行方格</template>
              <template v-else> / 分段{{ (item.segments || []).length }}组</template>
              <template v-if="item.type !== 'fillblank' && item.type !== 'answer' && item.type !== 'english' && item.type !== 'chinese'">
                / 每题{{ item.scorePerQuestion || 0 }}分 / 总分{{ (Number(item.count || 0) * Number(item.scorePerQuestion || 0)).toFixed(Number(item.scorePerQuestion || 0) % 1 === 0 ? 0 : 1) }}
              </template>
              <template v-else-if="item.type === 'answer'">
                / 总分{{ formatScore(getAnswerBlockTotalScore(item)) }}
              </template>
              <template v-else-if="item.type === 'english'">
                / 总分{{ formatScore(item.scorePerQuestion || 0) }}
              </template>
              <template v-else-if="item.type === 'chinese'">
                / 总分{{ formatScore(item.scorePerQuestion || 0) }}
              </template>
              <template v-else>
                / 总分{{ formatScore(getFillBlankBlockTotalScore(item)) }}
              </template>
            </span>
            <el-button v-if="item.type === 'fillblank'" type="text" size="mini" @click="$emit('edit-fill-blank', item.id)">编辑</el-button>
            <el-button v-if="item.type === 'answer'" type="text" size="mini" @click="$emit('edit-answer', item.id)">编辑</el-button>
            <el-button v-if="item.type === 'english'" type="text" size="mini" @click="$emit('edit-english', item.id)">编辑</el-button>
            <el-button v-if="item.type === 'chinese'" type="text" size="mini" @click="$emit('edit-chinese', item.id)">编辑</el-button>
            <el-button type="text" size="mini" @click="$emit('remove-block', item.id)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-footer">
      <div class="panel-footer-row panel-footer-row--secondary">
        <el-button
          size="small"
          plain
          class="panel-footer-btn"
          :loading="pdfDownloading"
          @click="$emit('download-pdf')"
        >下载 PDF</el-button>
      </div>
      <div class="panel-footer-row panel-footer-row--primary">
        <el-button size="small" type="primary" class="panel-footer-btn panel-footer-btn--grow" @click="$emit('save')">保存</el-button>
        <el-button size="small" plain class="panel-footer-btn" @click="$emit('save-template')">保存模板</el-button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AnswerSheetConfigPanel',
  props: {
    form: {
      type: Object,
      required: true
    },
    questionBlocks: {
      type: Array,
      default: () => []
    },
    isAdmissionMode: {
      type: Boolean,
      default: true
    },
    shortNumberFillDisabled: {
      type: Boolean,
      default: false
    },
    pdfDownloading: {
      type: Boolean,
      default: false
    },
    /** 全卷合计分（由父级 computeSheetStats 算出，仅展示不落库） */
    totalScore: {
      type: Number,
      default: 0
    },
    formatChineseSectionNo: {
      type: Function,
      required: true
    },
    getDefaultSectionTitle: {
      type: Function,
      required: true
    },
    getQuestionTypeLabel: {
      type: Function,
      required: true
    },
    getFillBlankBlockQuestionCount: {
      type: Function,
      required: true
    },
    getAnswerBlockQuestionCount: {
      type: Function,
      required: true
    },
    formatScore: {
      type: Function,
      required: true
    },
    getAnswerBlockTotalScore: {
      type: Function,
      required: true
    },
    getFillBlankBlockTotalScore: {
      type: Function,
      required: true
    }
  },
  computed: {
    /** 总分展示：整数不带小数点，0.5 分保留一位 */
    formattedTotalScore() {
      const value = Number(this.totalScore) || 0;
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
    },
    /** 由 form.layoutType 推导，避免父级 :is-8k-layout 等含数字的 attr 在 Vue2 中与 is8KLayout 映射失败 */
    editorLayoutType() {
      return (this.form && this.form.layoutType) || 'A4';
    },
    isA3Sheet() {
      return this.editorLayoutType === 'A3';
    },
    is8KSheet() {
      return this.editorLayoutType === '8K';
    },
    showMulticolColumnOptions() {
      return this.isA3Sheet || this.is8KSheet;
    }
  }
};
</script>

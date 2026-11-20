<template>
  <div
    ref="editorRoot"
    class="answer-sheet-editor"
    :class="{
      'answer-sheet-editor--panning': panDragging,
      'answer-sheet-editor--readonly': readonly
    }"
    @mousedown.capture="handleActivatePrintPage"
  >
    <answer-sheet-preview-host
      ref="previewHost"
      :preview-title="previewTitle"
      :preview-content-class="sheetPreviewContentClass"
      :show-header="showHeader"
      @go-back="handleBack"
      @pan-mousedown="onPanMouseDown"
    >
      <answer-sheet-sheet-page
        v-for="(page, pageIdx) in sheetPreviewPages"
        :key="`sheet-page-${model.previewRenderVersion.value}-${pageIdx}`"
        :page="page"
        :page-idx="pageIdx"
        :page-total="sheetPreviewPages.length"
        :preview-shell-class="pagination.getSheetPreviewShellClass(pageIdx)"
        :preview-shell-style="pagination.a3ThreeColSheetPreviewGridStyle(pageIdx)"
        :is-a3-multi-column-layout="model.isA3MultiColumnLayout.value"
        :effective-a3-column-count="model.effectiveA3ColumnCount.value"
        :is-a4-layout="model.isA4Layout.value"
        :is-class-number-mode="model.isClassNumberMode.value"
        :preview-title="previewTitle"
        :exam-no="examNo"
        :qr-code-data-url="qrCodeDataUrl"
        :show-qr-code="showQrCode"
        :notice-list="model.noticeList.value"
        :short-number-row-labels="model.shortNumberRowLabels"
        :admission-card-style="model.admissionCardStyle.value"
        :admission-grid-style="model.admissionGridStyle.value"
        :effective-admission-columns="model.effectiveAdmissionColumns.value"
        :fill-type="model.form.fillType"
        :answer-sheet-drawable-leader-inner-height-px="drawableLeaderInnerHeightPx"
        :is-answer-sheet-drawable-leader-debug="debug"
        :show-fill-blank-score="model.showFillBlankScore.value"
        :format-score="model.formatScore"
        :get-chinese-cell-marker="render.getChineseCellMarker"
        :get-short-blank-count="getShortBlankCount"
        :is-objective-first-draw-split-layout="render.isObjectiveFirstDrawSplitLayout"
        :is-objective-band-merged-with-previous="render.isObjectiveBandMergedWithPrevious"
        :preview-section-stable-key="render.previewSectionStableKey"
        :side-seal-class-row-labels="model.sideSealClassRowLabels"
        :side-seal-student-row-labels="model.sideSealStudentRowLabels"
        :side-seal-digits-top-down="model.sideSealDigitsTopDown"
        @layout-height="handleFirstPageLeaderLayoutHeight"
        @edit-admission="handleEditAdmission"
        @edit-notice="handleEditNotice"
        @edit="handleEditBlock"
        @delete="handleDeleteBlock"
        @resize-start="startAnswerAreaResize"
      />
    </answer-sheet-preview-host>

    <answer-sheet-config-panel
      :form="model.form"
      :question-blocks="model.questionBlocks.value"
      :total-score="model.sheetStats.value.totalScore"
      :is-admission-mode="model.isAdmissionMode.value"
      :short-number-fill-disabled="model.shortNumberFillDisabled.value"
      :pdf-downloading="pdfDownloading"
      :format-chinese-section-no="formatChineseSectionNo"
      :get-default-section-title="model.getDefaultSectionTitle"
      :get-question-type-label="model.getQuestionTypeLabel"
      :get-fill-blank-block-question-count="model.getFillBlankBlockQuestionCount"
      :get-answer-block-question-count="model.getAnswerBlockQuestionCount"
      :format-score="model.formatScore"
      :get-answer-block-total-score="model.getAnswerBlockTotalScore"
      :get-fill-blank-block-total-score="model.getFillBlankBlockTotalScore"
      @download-pdf="handleDownloadPdf"
      @save="handleSave"
      @save-template="handleSaveTemplate"
      @load-template="persistence.openTemplateDialog"
      @open-objective-config="dialogs.openQuestionConfigDialog"
      @open-fill-blank-create="dialogs.openFillBlankDialogForCreate"
      @open-answer-create="dialogs.openAnswerDialogForCreate"
      @open-english-create="dialogs.openEnglishDialogForCreate"
      @open-chinese-create="dialogs.openChineseDialogForCreate"
      @edit-fill-blank="dialogs.openFillBlankDialogForEditById"
      @edit-answer="dialogs.openAnswerDialogForEditById"
      @edit-english="dialogs.openEnglishDialogForEditById"
      @edit-chinese="dialogs.openChineseDialogForEditById"
      @remove-block="model.removeQuestionBlock"
      @block-drag-start="handleBlockDragStart"
      @block-drag-over="handleBlockDragOver"
      @block-drop="handleBlockDrop"
      @block-drag-end="handleBlockDragEnd"
      @admission-columns-change="dialogs.handleAdmissionColumnsChange"
    />

    <el-dialog
      title="设置准考证号位数"
      :visible.sync="dialogs.admissionEditorVisible.value"
      width="360px"
      append-to-body
      destroy-on-close
    >
      <div class="admission-editor-body">
        <span>位数：</span>
        <el-input-number
          v-model="dialogs.admissionColumnsDraft.value"
          :min="4"
          :max="20"
          controls-position="right"
          size="small"
        />
      </div>
      <span slot="footer">
        <el-button size="small" @click="dialogs.admissionEditorVisible.value = false">取消</el-button>
        <el-button size="small" type="primary" @click="dialogs.applyAdmissionColumns">确定</el-button>
      </span>
    </el-dialog>

    <el-dialog
      title="修改考生须知"
      :visible.sync="dialogs.noticeEditorVisible.value"
      width="520px"
      append-to-body
      destroy-on-close
    >
      <div class="notice-editor-hint">每行一条须知，预览区将按「序号、」自动编号；留空则恢复默认须知。</div>
      <el-input
        v-model="dialogs.noticeEditorDraft.value"
        type="textarea"
        :rows="10"
        maxlength="4000"
        show-word-limit
        placeholder="请输入考生须知，每行一条"
      />
      <span slot="footer">
        <el-button size="small" @click="dialogs.noticeEditorVisible.value = false">取消</el-button>
        <el-button size="small" type="primary" @click="dialogs.applyNoticeEditor">确定</el-button>
      </span>
    </el-dialog>

    <objective-question-dialog
      :visible="dialogs.questionConfigDialogVisible.value"
      :title="dialogs.questionConfigDialogTitle.value"
      :form="dialogs.questionConfigForm"
      :preview-rows="dialogs.objectiveDialogPreviewRows.value"
      :is-editing="dialogs.isEditingQuestionBlock.value"
      :get-default-section-title="model.getDefaultSectionTitle"
      :get-question-type-label="model.getQuestionTypeLabel"
      :append-segment="dialogs.appendObjectiveSegment"
      :remove-segment="dialogs.removeObjectiveSegment"
      @close="dialogs.questionConfigDialogVisible.value = false"
      @confirm="dialogs.confirmQuestionConfig"
    />

    <fill-blank-question-dialog
      :visible="dialogs.fillBlankDialogVisible.value"
      :title="dialogs.fillBlankDialogTitle.value"
      :form="dialogs.fillBlankDialogForm"
      :preview-rows="dialogs.fillBlankDialogPreviewRows.value"
      :preview-line-label="dialogs.fillBlankDialogPreviewLineLabel.value"
      :is-editing="dialogs.isEditingFillBlankQuestion.value"
      :get-default-section-title="() => model.getDefaultSectionTitle('fillblank')"
      :append-segment="dialogs.appendFillBlankSegment"
      :remove-segment="dialogs.removeFillBlankSegment"
      @close="dialogs.fillBlankDialogVisible.value = false"
      @confirm="dialogs.confirmFillBlankDialog"
    />

    <answer-question-dialog
      :visible="dialogs.answerDialogVisible.value"
      :title="dialogs.answerDialogTitle.value"
      :form="dialogs.answerDialogForm"
      :preview-rows="dialogs.answerDialogPreviewRows.value"
      :is-editing="dialogs.isEditingAnswerQuestion.value"
      :get-default-section-title="() => model.getDefaultSectionTitle('answer')"
      :append-segment="dialogs.appendAnswerSegment"
      :remove-segment="dialogs.removeAnswerSegment"
      @close="dialogs.answerDialogVisible.value = false"
      @confirm="dialogs.confirmAnswerDialog"
    />

    <english-question-dialog
      :visible="dialogs.englishDialogVisible.value"
      :title="dialogs.englishDialogTitle.value"
      :form="dialogs.englishDialogForm"
      :preview-rows="dialogs.englishDialogPreviewRows.value"
      :is-editing="dialogs.isEditingEnglishQuestion.value"
      :get-default-section-title="() => model.getDefaultSectionTitle('english')"
      @close="dialogs.englishDialogVisible.value = false"
      @confirm="dialogs.confirmEnglishDialog"
    />

    <chinese-question-dialog
      :visible="dialogs.chineseDialogVisible.value"
      :title="dialogs.chineseDialogTitle.value"
      :form="dialogs.chineseDialogForm"
      :preview-rows="dialogs.chineseDialogPreviewRows.value"
      :is-editing="dialogs.isEditingChineseQuestion.value"
      :get-default-section-title="() => model.getDefaultSectionTitle('chinese')"
      :insert-after-section-options="dialogs.chineseInsertAfterSectionOptions.value"
      :format-chinese-section-no="formatChineseSectionNo"
      @close="dialogs.chineseDialogVisible.value = false"
      @confirm="dialogs.confirmChineseDialog"
    />

    <answer-sheet-pdf-export-dialog
      :visible="pdfExportDialogVisible"
      :percentage="pdfExportProgress"
      @closed="onPdfExportDialogClosed"
    />

    <el-dialog
      title="载入答题卡模板"
      :visible.sync="persistence.templateDialogVisible.value"
      width="760px"
      append-to-body
      destroy-on-close
      custom-class="answer-sheet-template-dialog"
      @open="persistence.fetchTemplateList"
    >
      <div class="preset-block">
        <div class="preset-block-head">
          <span class="preset-block-title">常用科目模板</span>
          <span class="preset-block-sub">按常见试卷结构预置，载入后仍可增删题块、改分值；标题与考试号保持当前设置</span>
        </div>
        <div class="preset-grid">
          <div
            v-for="preset in persistence.presetList.value"
            :key="preset.id"
            class="preset-card"
          >
            <div class="preset-card-top">
              <span class="preset-card-name">{{ preset.name }}</span>
              <span class="preset-card-layout">{{ preset.layoutLabel }}</span>
            </div>
            <div class="preset-card-score">{{ preset.questionCount }} 题 · {{ preset.blockCount }} 个大题</div>
            <div class="preset-card-summary" :title="preset.summary">{{ preset.summary }}</div>
            <div class="preset-card-foot">
              <span class="preset-card-tag">{{ preset.tag }}</span>
              <el-button
                type="primary"
                size="mini"
                plain
                class="preset-card-load"
                @click="persistence.applyPreset(preset.id)"
              >载入</el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="preset-block preset-block--mine">
        <div class="preset-block-head">
          <span class="preset-block-title">我的模板</span>
          <span class="preset-block-sub">通过底部「保存模板」收藏的答题卡结构</span>
        </div>
        <el-table
          v-loading="persistence.templateListLoading.value"
          :data="persistence.templateList.value"
          size="small"
          max-height="240"
          stripe
          empty-text="还没有保存过模板"
        >
          <el-table-column prop="templateName" label="模板名称" min-width="180" show-overflow-tooltip />
          <el-table-column prop="layoutType" label="版式" width="72" align="center" />
          <el-table-column label="操作" width="152" align="center">
            <template slot-scope="scope">
              <el-button type="text" size="small" @click="persistence.applyTemplate(scope.row.id)">载入</el-button>
              <el-button type="text" size="small" @click="handleRenameTemplate(scope.row)">重命名</el-button>
              <el-button
                type="text"
                size="small"
                class="danger-text-btn"
                @click="persistence.deleteTemplate(scope.row.id)"
              >删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <span slot="footer">
        <el-button size="small" @click="persistence.templateDialogVisible.value = false">关闭</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref, set, watch } from 'vue';
import { Message, MessageBox } from 'element-ui';

import AnswerSheetPreviewHost from '@/components/AnswerSheetPreviewHost.vue';
import AnswerSheetSheetPage from '@/components/AnswerSheetSheetPage.vue';
import AnswerSheetConfigPanel from '@/components/AnswerSheetConfigPanel.vue';
import AnswerSheetPdfExportDialog from '@/components/AnswerSheetPdfExportDialog.vue';
import ObjectiveQuestionDialog from '@/components/dialogs/ObjectiveQuestionDialog.vue';
import FillBlankQuestionDialog from '@/components/dialogs/FillBlankQuestionDialog.vue';
import AnswerQuestionDialog from '@/components/dialogs/AnswerQuestionDialog.vue';
import EnglishQuestionDialog from '@/components/dialogs/EnglishQuestionDialog.vue';
import ChineseQuestionDialog from '@/components/dialogs/ChineseQuestionDialog.vue';

import { ANSWER_SHEET_A4_DRAWABLE_INNER_HEIGHT_PX } from '@/core/constants';
import { formatChineseSectionNo } from '@/core/sectionTitleFormat';
import { createEditorDocument, isQrcodeEnabled } from '@/core/document';
import { createSheetData } from '@/core/sheetBuilder';
import {
  activatePrintPage,
  registerPrintPage,
  unregisterPrintPage,
  updatePrintPage
} from '@/core/printPageStyle';
import { useSheetModel } from '@/composables/useSheetModel';
import { useSheetMetrics } from '@/composables/useSheetMetrics';
import { useSectionRender } from '@/composables/useSectionRender';
import { useSheetPagination } from '@/composables/useSheetPagination';
import { usePreviewInteraction } from '@/composables/usePreviewInteraction';
import { usePdfExport } from '@/composables/usePdfExport';
import { useQuestionDialogs } from '@/composables/useQuestionDialogs';
import { useSheetPersistence } from '@/composables/useSheetPersistence';
import { useQrCode } from '@/composables/useQrCode';

export default {
  name: 'AnswerSheetDesigner',
  components: {
    AnswerSheetPreviewHost,
    AnswerSheetSheetPage,
    AnswerSheetConfigPanel,
    AnswerSheetPdfExportDialog,
    ObjectiveQuestionDialog,
    FillBlankQuestionDialog,
    AnswerQuestionDialog,
    EnglishQuestionDialog,
    ChineseQuestionDialog
  },
  props: {
    /** 考试 id，用于加载/保存答题卡 */
    examId: {
      type: [String, Number],
      default: null
    },
    /** 考试信息 { name, examNo, paperId }；传入后不再走 dataSource.loadSession */
    session: {
      type: Object,
      default: null
    },
    /** 直接传入答题卡数据（含 editorJson），优先级高于 dataSource.loadSheet */
    sheet: {
      type: Object,
      default: null
    },
    /**
     * 简写内容配置：{ title, examNo, layout, columns, fillType, notice, blocks: [...] }
     * 由 createSheetData 展开成 sheet；与 sheet 同时传时以 sheet 为准。
     * 适合「整卷结构已知、不需要持久化」的宿主。
     */
    content: {
      type: Object,
      default: null
    },
    /** 数据源，见 src/datasource；不传则为空实现（纯前端试排） */
    dataSource: {
      type: Object,
      default: null
    },
    /** 是否显示预览区顶部返回按钮 */
    showHeader: {
      type: Boolean,
      default: true
    },
    /** 挂载后是否自动加载数据 */
    autoLoad: {
      type: Boolean,
      default: true
    },
    /** 导出 PDF 的栅格化精度（DPI），默认 200；数值越大文件越大 */
    pdfDpi: {
      type: Number,
      default: 200
    },
    /** 导出 PDF 的图片格式：JPEG（默认，体积小）或 PNG（线稿更锐利但文件大） */
    pdfImageFormat: {
      type: String,
      default: 'JPEG'
    },
    /** JPEG 质量，0.7 ~ 1 */
    pdfImageQuality: {
      type: Number,
      default: 0.92
    },
    /**
     * 输出分页/度量调试日志到控制台。
     * 默认关闭；需要在接入方环境临时排查时也可以
     * `localStorage.setItem('answer-sheet-designer:debug', '1')` 打开。
     */
    debug: {
      type: Boolean,
      default: false
    },
    /**
     * 只读模式：隐藏配置面板与题块操作按钮，禁用拖拽排序、作答区拖高与各类编辑弹窗；
     * 保留打印与「导出 PDF」。适合把已定稿的答题卡展示给学生/家长。
     */
    readonly: {
      type: Boolean,
      default: false
    }
  },
  setup(props, { emit }) {
    const editorRoot = ref(null);
    const previewHost = ref(null);

    const message = {
      success: (text) => Message.success(text),
      error: (text) => Message.error(text),
      warning: (text) => Message.warning(text)
    };

    const model = useSheetModel({
      notifyWarning: (text) => message.warning(text)
    });
    const metrics = useSheetMetrics(model);
    const render = useSectionRender({ metrics, model, debugLog: props.debug === true });

    const pagination = useSheetPagination({ model, metrics, render });

    const dialogs = useQuestionDialogs({
      model,
      warn: (text) => message.warning(text)
    });

    /**
     * 传入数据的内容指纹。
     *
     * 宿主在模板里写 `:sheet="{ ... }"` 时，每次父组件重渲染都会产生新对象；
     * 若只看引用变化就重置，用户刚改的内容会被父组件的无关重渲染冲掉。
     * 因此按内容比对：指纹一致就跳过。
     */
    function fingerprint(value) {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return '';
      }
    }

    /** content 简写 → sheet；与 sheet 同时存在时以 sheet 为准 */
    function resolveInitialSheet() {
      if (props.sheet) return props.sheet;
      if (!props.content) return null;
      try {
        return createSheetData(props.content);
      } catch (error) {
        console.error('[AnswerSheetDesigner] content 解析失败', error);
        emit('error', error);
        return null;
      }
    }

    const initialSheet = resolveInitialSheet();
    let appliedSheetFingerprint = initialSheet ? fingerprint(initialSheet) : '';

    const persistence = useSheetPersistence({
      model,
      dataSource: props.dataSource,
      examId: props.examId,
      initialSheet: resolveInitialSheet(),
      initialSession: props.session,
      message,
      onSaved: (payload) => emit('saved', payload),
      onTemplateSaved: (payload) => emit('template-saved', payload),
      onError: (error) => emit('error', error)
    });

    const { qrCodeDataUrl } = useQrCode(() => persistence.examNo.value);

    const getScrollEl = () => {
      const host = previewHost.value;
      return (host && host.$refs && host.$refs.sheetPreviewScrollEl) || null;
    };
    const getExportRoot = () => {
      const host = previewHost.value;
      return (host && host.$refs && host.$refs.pdfExportRoot) || null;
    };

    const interaction = usePreviewInteraction({
      getScrollEl,
      getRootEl: () => editorRoot.value,
      getMaxAnswerAreaHeight: render.getMaxAnswerAreaHeight,
      getMinAnswerAreaHeight: render.minAnswerAreaHeight,
      onResizeCommit: (blockId, questionNum, height, limits) => {
        model.updateAnswerAreaHeight(blockId, questionNum, height, limits);
      }
    });
    const { panDragging, onPanMouseDown, startAnswerAreaResize: startAnswerAreaResizeRaw } = interaction;

    /** 只读模式下不允许拖拽调整作答区高度 */
    function startAnswerAreaResize(event, blockId, questionNum) {
      if (props.readonly) return;
      startAnswerAreaResizeRaw(event, blockId, questionNum);
    }

    /* 只读模式下预览区的编辑入口统一收口，避免漏掉某个按钮 */
    function handleEditAdmission() {
      if (props.readonly) return;
      dialogs.openAdmissionEditor();
    }

    function handleEditNotice() {
      if (props.readonly) return;
      dialogs.openNoticeEditor();
    }

    function handleEditBlock(block) {
      if (props.readonly) return;
      dialogs.openQuestionBlockEditor(block);
    }

    function handleDeleteBlock(id) {
      if (props.readonly) return;
      model.removeQuestionBlock(id);
    }

    /** 重命名已保存模板（模板弹窗里的行内操作） */
    async function handleRenameTemplate(row) {
      if (!row || row.id == null) return;
      let nextName = '';
      try {
        const ret = await MessageBox.prompt('输入新的模板名称', '重命名模板', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          inputValue: row.templateName || '',
          inputPattern: /\S+/,
          inputErrorMessage: '名称不能为空'
        });
        nextName = ((ret && ret.value) || '').trim();
      } catch (error) {
        return;
      }
      if (!nextName) return;
      await persistence.renameTemplate(row.id, nextName);
    }

    const pdf = usePdfExport({
      getRootEl: () => editorRoot.value,
      getExportRoot,
      getLayoutType: () => model.layoutType.value,
      getFileName: () => model.form.sheetName || persistence.previewTitle.value,
      getOptions: () => ({
        dpi: props.pdfDpi,
        imageFormat: props.pdfImageFormat,
        imageQuality: props.pdfImageQuality
      }),
      message
    });

    /* ---------------- 派生展示数据 ---------------- */

    const sheetPreviewContentClass = computed(() => ({
      'preview-content--landscape-sheets': model.isLandscapeSheetLayout.value,
      'preview-content--sheet-pan-grab': model.isA4Layout.value,
      'preview-content--sheet-pan-dragging': panDragging.value
    }));

    /** 二维码开关：兼容历史数据里的 0/1、字符串与布尔值 */
    const showQrCode = computed(() => isQrcodeEnabled(model.form.qrcodeEnabled));

    /** 填涂顶区内侧总高（px）：分栏版式用单栏内侧高，其余用 A4 内侧高 */
    const drawableLeaderInnerHeightPx = computed(() => (
      model.isA3MultiColumnLayout.value
        ? metrics.getMulticolPaneDrawableInnerHeightPx()
        : ANSWER_SHEET_A4_DRAWABLE_INNER_HEIGHT_PX
    ));

    const isDrawableLeaderDebug = computed(() => {
      const layout = model.layoutType.value;
      if (layout === 'A4') return !metrics.getA3MulticolSheetCapacities();
      return (layout === 'A3' || layout === '8K')
        && (model.effectiveA3ColumnCount.value === 2 || model.effectiveA3ColumnCount.value === 3);
    });

    const getShortBlankCount = (item) => Math.max(1, Number(item && item.lineCount) || 1);

    /* ---------------- 顶区高度实测 ---------------- */

    function handleFirstPageLeaderLayoutHeight(px) {
      if (!isDrawableLeaderDebug.value) return;
      const value = Math.max(0, Math.round(Number(px) || 0));
      if (value <= 0) return;
      if (model.firstPageLeaderMeasuredHeightPx.value === value) return;
      model.firstPageLeaderMeasuredHeightPx.value = value;
      model.previewRenderVersion.value += 1;
    }

    watch(isDrawableLeaderDebug, (enabled) => {
      if (!enabled) model.firstPageLeaderMeasuredHeightPx.value = null;
    });

    /* ---------------- 版式变化触发重排 ---------------- */

    /**
     * 同步 `@page` 打印纸张尺寸。
     *
     * 不声明 `@page` 时，浏览器打印对话框会用默认页边距（约 10mm），
     * 把 210×297mm 的整页内容压进约 190×277mm 的可打印区，整卷被等比缩小约 7%；
     * 填涂框位置、作答区高度随之漂移，与屏幕上校对的结果不一致。
     * 这里按当前版式写入精确纸张尺寸 + 零页边距，让打印输出与预览 1:1 对应。
     */
    const PRINT_PAGE_SIZE_MM = {
      A4: '210mm 297mm',
      A3: '420mm 297mm',
      '8K': '390mm 270mm'
    };

    /** 本实例在 printPageStyle 注册表中的 id（仅挂载后有效） */
    let printPageUid = null;

    const currentPrintPageSize = () => (
      PRINT_PAGE_SIZE_MM[model.form.layoutType] || PRINT_PAGE_SIZE_MM.A4
    );

    function handleActivatePrintPage() {
      activatePrintPage(printPageUid);
    }

    // 版式切换后，只有当前 active 的实例需要改写全局 @page 规则
    watch(() => model.form.layoutType, () => {
      updatePrintPage(printPageUid);
    });

    watch(() => model.form.fillType, () => { model.previewRenderVersion.value += 1; });
    watch(() => model.form.admissionColumns, () => { model.previewRenderVersion.value += 1; });
    watch(() => model.form.layoutType, () => {
      model.ensureFillTypeCompatibleWithA3Columns();
      model.previewRenderVersion.value += 1;
    });
    watch(() => model.form.a3ColumnCount, (value) => {
      model.form.a3ColumnCount = model.normalizeA3ColumnCount(value);
      model.ensureFillTypeCompatibleWithA3Columns();
      model.previewRenderVersion.value += 1;
    });

    /* ---------------- 拖拽排序 ---------------- */

    function handleBlockDragStart(event, id) {
      if (props.readonly) return;
      model.dragBlockId.value = id;
      if (event && event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    }

    function handleBlockDragOver(event) {
      if (props.readonly || !event) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }

    function handleBlockDrop(event, targetId) {
      if (props.readonly) return;
      if (event) event.preventDefault();
      const fromId = model.dragBlockId.value;
      if (fromId == null || fromId === targetId) return;
      model.reorderBlocks(fromId, targetId);
    }

    function handleBlockDragEnd() {
      model.dragBlockId.value = null;
    }

    /* ---------------- 对外行为 ---------------- */

    function handleBack() {
      emit('back');
    }

    const handleSave = () => {
      if (props.readonly) return;
      persistence.save();
    };
    const handleSaveTemplate = (name) => {
      if (props.readonly) return;
      persistence.saveAsTemplate(name);
    };
    const handleDownloadPdf = () => pdf.handleDownloadPdf();

    /* ---------------- 通过参数 / ref 设置内容 ---------------- */

    /** 应用一份 sheet 数据：覆盖表单与题块，不写 dataSource、不落库 */
    function setSheet(sheet) {
      if (!sheet || typeof sheet !== 'object') return false;
      const ok = persistence.applySheetData(sheet);
      if (ok) {
        persistence.syncExamNoIfEmpty();
        appliedSheetFingerprint = fingerprint(sheet);
      }
      return ok;
    }

    /** 应用简写内容配置（与 content prop 同构） */
    function setContent(config) {
      if (!config || typeof config !== 'object') return false;
      try {
        return setSheet(createSheetData(config));
      } catch (error) {
        console.error('[AnswerSheetDesigner] setContent 失败', error);
        emit('error', error);
        return false;
      }
    }

    /** 只替换题块，保留标题 / 考试号 / 版式 / 填涂方式 */
    function setQuestionBlocks(blocks) {
      model.replaceQuestionBlocks(blocks || []);
      model.previewRenderVersion.value += 1;
      return model.questionBlocks.value;
    }

    /** 局部更新表单字段（标题、考试号、版式、分栏、须知等） */
    function setForm(patch) {
      if (!patch || typeof patch !== 'object') return model.form;
      Object.keys(patch).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(model.form, key)) model.form[key] = patch[key];
        else set(model.form, key, patch[key]);
      });
      model.ensureFillTypeCompatibleWithA3Columns();
      model.syncStats();
      model.previewRenderVersion.value += 1;
      return model.form;
    }

    // 宿主复用同一个实例、只换 :exam-id（后台列表点不同考试）：需要重新加载，
    // 否则题目还是上一场的，保存却指向新考试。
    watch(
      () => props.examId,
      (next, prev) => {
        if (String(next) === String(prev)) return;
        if (props.sheet || props.content) {
          persistence.setExamId(next); // 内容由宿主提供，只换保存目标
          return;
        }
        if (!props.autoLoad) {
          persistence.setExamId(next);
          return;
        }
        persistence.switchExam(next);
      }
    );

    watch(
      () => props.session,
      (next) => persistence.updateSession(next),
      { deep: true }
    );

    watch(
      () => props.sheet,
      (value) => {
        if (!value) return;
        if (fingerprint(value) === appliedSheetFingerprint) return;
        setSheet(value);
      },
      { deep: true }
    );

    watch(
      () => props.content,
      (value) => {
        if (!value || props.sheet) return;
        let next;
        try {
          next = createSheetData(value);
        } catch (error) {
          console.error('[AnswerSheetDesigner] content 解析失败', error);
          emit('error', error);
          return;
        }
        if (fingerprint(next) === appliedSheetFingerprint) return;
        setSheet(next);
      },
      { deep: true }
    );

    onMounted(() => {
      // 注册 @page 规则：多实例时由最近操作的实例决定纸张尺寸
      printPageUid = registerPrintPage(currentPrintPageSize);
      if (props.autoLoad) persistence.load();
    });

    // 卸载只注销本实例；仍有其它实例存活时，规则交给它们，不影响宿主页面
    onBeforeUnmount(() => {
      unregisterPrintPage(printPageUid);
      printPageUid = null;
    });

    // 提供给宿主通过 ref 调用的公开 API
    const getDocument = () => createEditorDocument({
      questionBlocks: model.questionBlocks.value,
      nextQuestionBlockId: model.nextQuestionBlockId.value,
      form: model.form
    });

    return {
      // 内部编排对象（模板中按需取用）
      model,
      render,
      pagination,
      dialogs,
      persistence,
      // 顶层绑定
      editorRoot,
      previewHost,
      panDragging,
      onPanMouseDown,
      startAnswerAreaResize,
      sheetPreviewContentClass,
      sheetPreviewPages: pagination.sheetPreviewPages,
      previewTitle: persistence.previewTitle,
      examNo: persistence.examNo,
      qrCodeDataUrl,
      showQrCode,
      drawableLeaderInnerHeightPx,
      isDrawableLeaderDebug,
      debug: props.debug,
      getShortBlankCount,
      handleFirstPageLeaderLayoutHeight,
      formatChineseSectionNo,
      handleBlockDragStart,
      handleBlockDragOver,
      handleBlockDrop,
      handleBlockDragEnd,
      handleEditAdmission,
      handleEditNotice,
      handleEditBlock,
      handleDeleteBlock,
      handleRenameTemplate,
      handleActivatePrintPage,
      handleBack,
      handleSave,
      handleSaveTemplate,
      handleDownloadPdf,
      // PDF
      pdfDownloading: pdf.pdfDownloading,
      pdfExportDialogVisible: pdf.pdfExportDialogVisible,
      pdfExportProgress: pdf.pdfExportProgress,
      onPdfExportDialogClosed: pdf.onPdfExportDialogClosed,
      // 公开 API
      save: handleSave,
      saveAsTemplate: handleSaveTemplate,
      /** 导出 PDF：无参 = 走浏览器下载，返回 Promise<boolean>；传 { download: false } 返回 Promise<Blob> */
      exportPdf: (options) => pdf.handleDownloadPdf(
        options && typeof options === 'object' ? options : {}
      ),
      /** 只取 PDF 的 Blob，不下载（批量生成 / 上传后端） */
      getPdfBlob: pdf.buildPdfBlob,
      load: () => persistence.load(),
      reload: () => persistence.load(),
      /** 用参数替换内容 */
      setSheet,
      setContent,
      setQuestionBlocks,
      setForm,
      getDocument,
      getQuestionBlocks: () => model.questionBlocks.value,
      getForm: () => model.form,
      getPreviewPages: () => pagination.sheetPreviewPages.value,
      getStats: () => model.sheetStats.value
    };
  }
};
</script>

<style src="../styles/answer-sheet.css"></style>

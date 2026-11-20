/**
 * 题目编辑弹窗：客观题 / 填空题 / 解答题 / 英语作文 / 语文作文，以及准考证位数与考生须知编辑。
 *
 * 原实现是 AnswerSheetEditor 里 30+ 个方法 + 10 个 data 字段，抽离后组件只做 v-model 绑定。
 */
import { computed, reactive, ref, set } from 'vue';
import {
  createAnswerDialogForm,
  createChineseDialogForm,
  createEnglishDialogForm,
  createFillBlankDialogForm,
  createObjectiveDialogForm
} from '@/core/defaults';
import {
  buildOptionLabels,
  createAnswerSegment,
  createFillBlankSegment,
  createObjectiveSegment,
  formatScore,
  getDefaultSectionTitle,
  getNextNumFromSegments,
  getQuestionTypeLabel,
  isSegmentRangeValid,
  normalizeAnswerSegment,
  normalizeChineseBlock,
  normalizeEnglishBlock,
  normalizeFillBlankBlock,
  normalizeFillBlankSegment,
  normalizeObjectiveSegment
} from '@/core/questionModel';
import { DEFAULT_NOTICE } from '@/core/constants';

/**
 * @param {Object} params
 * @param {Object} params.model useSheetModel
 * @param {(msg: string) => void} params.warn
 */
export function useQuestionDialogs({ model, warn }) {
  const questionConfigDialogVisible = ref(false);
  const fillBlankDialogVisible = ref(false);
  const answerDialogVisible = ref(false);
  const englishDialogVisible = ref(false);
  const chineseDialogVisible = ref(false);

  const questionConfigForm = reactive(createObjectiveDialogForm());
  const fillBlankDialogForm = reactive(createFillBlankDialogForm());
  const answerDialogForm = reactive(createAnswerDialogForm());
  const englishDialogForm = reactive(createEnglishDialogForm());
  const chineseDialogForm = reactive(createChineseDialogForm());

  const admissionEditorVisible = ref(false);
  const admissionColumnsDraft = ref(9);
  const noticeEditorVisible = ref(false);
  const noticeEditorDraft = ref('');

  /**
   * 重置弹窗表单。
   *
   * 不能先 `delete` 再 `Object.assign`：Vue 2.7 的响应式靠 defineProperty 的 getter/setter，
   * 删除后重新添加的属性是裸属性，依赖它的 computed（弹窗标题、预览行）不会重新求值，
   * 表现为「点编辑却显示新增、分段表格空白」。这里改为原地赋值，保留既有 setter。
   */
  const resetForm = (target, source) => {
    Object.keys(source).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        target[key] = source[key];
      } else {
        set(target, key, source[key]);
      }
    });
    Object.keys(target).forEach((key) => {
      if (!(key in source)) delete target[key];
    });
  };

  /* ---------------- 客观题 ---------------- */

  const isEditingQuestionBlock = computed(() => questionConfigForm.editingBlockId != null);
  const questionConfigDialogTitle = computed(() =>
    `${isEditingQuestionBlock.value ? '修改' : '新增'}客观题试题框`);

  const objectiveDialogPreviewRows = computed(() => {
    const rows = [];
    (questionConfigForm.segments || [])
      .map((item) => normalizeObjectiveSegment(item, questionConfigForm.type))
      .sort((a, b) => a.startNum - b.startNum)
      .forEach((segment) => {
        for (let num = segment.startNum; num <= segment.endNum; num += 1) {
          const type = segment.objectiveType || questionConfigForm.type;
          rows.push({
            num,
            typeLabel: getQuestionTypeLabel(type),
            score: formatScore(segment.scorePerQuestion),
            optionCount: segment.optionCount,
            answerPreview: type === 'judge' ? '对 / 错' : buildOptionLabels(type, segment.optionCount).join(' ')
          });
        }
      });
    return rows;
  });

  function openQuestionConfigDialog() {
    const type = 'single';
    resetForm(questionConfigForm, createObjectiveDialogForm({
      type,
      sectionNo: model.getNextSectionNo(),
      sectionTitle: getDefaultSectionTitle(type)
    }));
    questionConfigDialogVisible.value = true;
  }

  function openEditQuestionBlock(block) {
    if (!block) return;
    const fallbackTitle = getDefaultSectionTitle(block.type);
    const sectionTitle = (block.sectionTitle || fallbackTitle).trim() || fallbackTitle;
    const numbers = Array.isArray(block.numbers) ? block.numbers : [];
    const segments = Array.isArray(block.segments) && block.segments.length
      ? block.segments.map((item) => normalizeObjectiveSegment(item, block.type))
      : [{
        ...createObjectiveSegment(block.type, 1),
        endNum: Math.max(1, numbers.length || Number(block.count) || 1),
        scorePerQuestion: Number(block.scorePerQuestion) || 1,
        optionCount: block.type === 'judge' ? 2 : (Number(block.optionCount) || 4)
      }];
    resetForm(questionConfigForm, createObjectiveDialogForm({
      type: block.type,
      sectionNo: Math.max(1, Number(block.sectionNo) || 1),
      sectionTitle,
      count: numbers.length || Number(block.count) || 1,
      optionCount: (block.optionLabels && block.optionLabels.length) || Number(block.optionCount) || 4,
      scorePerQuestion: Number(block.scorePerQuestion) || 1,
      segments,
      editingBlockId: block.id || null
    }));
    questionConfigDialogVisible.value = true;
  }

  function appendObjectiveSegment(type = questionConfigForm.type) {
    if (!['single', 'multiple', 'judge'].includes(type)) return;
    const segments = questionConfigForm.segments;
    const nextNum = segments.length
      ? getNextNumFromSegments(segments)
      : model.nextQuestionNum(questionConfigForm.editingBlockId || null);
    segments.push(createObjectiveSegment(type, nextNum));
  }

  function removeObjectiveSegment(idx) {
    if (!Array.isArray(questionConfigForm.segments)) return;
    if (idx < 0 || idx >= questionConfigForm.segments.length) return;
    questionConfigForm.segments.splice(idx, 1);
  }

  function confirmQuestionConfig() {
    const rawSegments = Array.isArray(questionConfigForm.segments) ? questionConfigForm.segments : [];
    if (!rawSegments.length) {
      warn('请至少添加一个分段');
      return;
    }
    const normalizedSegments = [];
    for (let i = 0; i < rawSegments.length; i += 1) {
      if (!isSegmentRangeValid(rawSegments[i])) {
        warn(`第${i + 1}段开始题号不能大于结束题号`);
        return;
      }
      normalizedSegments.push(normalizeObjectiveSegment(rawSegments[i], questionConfigForm.type));
    }

    const sectionNo = Math.max(1, Number(questionConfigForm.sectionNo) || 1);
    const fallbackTitle = getDefaultSectionTitle(questionConfigForm.type);
    const sectionTitle = (questionConfigForm.sectionTitle || fallbackTitle).trim() || fallbackTitle;
    const count = normalizedSegments.reduce((sum, seg) => sum + (seg.endNum - seg.startNum + 1), 0);
    const scorePerQuestion = Math.max(0.5, Number(normalizedSegments[0].scorePerQuestion) || 1);
    const maxOptionCount = normalizedSegments.reduce((max, seg) => {
      const type = seg.objectiveType || questionConfigForm.type;
      const current = type === 'judge' ? 2 : Math.max(2, Number(seg.optionCount) || 4);
      return Math.max(max, current);
    }, 2);

    model.upsertBlock({
      type: 'objective',
      sectionNo,
      sectionTitle,
      count,
      optionCount: maxOptionCount,
      scorePerQuestion,
      segments: normalizedSegments,
      fillBlankType: null
    }, {
      replaceId: questionConfigForm.editingBlockId,
      insertAt: questionConfigForm.editingBlockId != null ? null : sectionNo
    });

    questionConfigDialogVisible.value = false;
    questionConfigForm.editingBlockId = null;
  }

  /* ---------------- 填空题 ---------------- */

  const isEditingFillBlankQuestion = computed(() => fillBlankDialogForm.editingBlockId != null);
  const fillBlankDialogTitle = computed(() => (isEditingFillBlankQuestion.value
    ? `编辑填空题框（${fillBlankDialogForm.sectionNo}.${fillBlankDialogForm.sectionTitle}）`
    : '新增填空题试题框'));

  const fillBlankDialogPreviewRows = computed(() => {
    const rows = [];
    (fillBlankDialogForm.segments || [])
      .map((item) => normalizeFillBlankSegment(item))
      .sort((a, b) => a.startNum - b.startNum)
      .forEach((segment) => {
        if (segment.fillBlankType === 'long') {
          for (let num = segment.startNum; num <= segment.endNum; num += 1) {
            rows.push({
              num,
              lineCount: segment.lineCount,
              scorePerQuestion: formatScore(segment.scorePerQuestion),
              fillBlankTypeLabel: '长填空',
              previewText: buildFillBlankPreviewText('long', segment.lineCount)
            });
          }
          return;
        }
        const blanks = Math.max(1, Number(segment.lineCount) || 1);
        for (let num = segment.startNum; num <= segment.endNum; num += 1) {
          for (let b = 1; b <= blanks; b += 1) {
            rows.push({
              num: blanks > 1 && b > 1 ? '' : num,
              lineCount: 1,
              scorePerQuestion: blanks > 1 && b < blanks ? '—' : formatScore(segment.scorePerQuestion),
              fillBlankTypeLabel: '短填空',
              previewText: buildFillBlankPreviewText('short', 1)
            });
          }
        }
      });
    return rows;
  });

  const fillBlankDialogPreviewLineLabel = computed(() => {
    const segments = fillBlankDialogForm.segments || [];
    const hasLong = segments.some((item) => item.fillBlankType === 'long');
    const hasShort = segments.some((item) => item.fillBlankType !== 'long');
    if (hasLong && hasShort) return '行/空数';
    return hasLong ? '行数' : '空格数';
  });

  function buildFillBlankPreviewText(type, lineCount) {
    const count = Math.max(1, Number(lineCount) || 1);
    if (type === 'long') {
      return Array.from({ length: count }, () => '____________').join(' / ');
    }
    return Array.from({ length: count }, () => '____').join(' ');
  }

  function openFillBlankDialogForCreate() {
    resetForm(fillBlankDialogForm, createFillBlankDialogForm({
      sectionNo: model.getNextSectionNo(),
      sectionTitle: getDefaultSectionTitle('fillblank')
    }));
    fillBlankDialogVisible.value = true;
  }

  function openFillBlankDialogForEditById(id) {
    const block = model.questionBlocks.value.find((item) => item.id === id && item.type === 'fillblank');
    if (!block) return;
    const normalized = normalizeFillBlankBlock(block, model.getNextSectionNo());
    resetForm(fillBlankDialogForm, createFillBlankDialogForm({
      sectionNo: normalized.sectionNo,
      sectionTitle: normalized.sectionTitle,
      segments: normalized.segments.map((item) => ({ ...item })),
      editingBlockId: normalized.id || null
    }));
    fillBlankDialogVisible.value = true;
  }

  function appendFillBlankSegment(fillBlankType) {
    const segments = fillBlankDialogForm.segments;
    const nextNum = segments.length === 0
      ? model.nextQuestionNum()
      : getNextNumFromSegments(segments);
    segments.push(createFillBlankSegment(fillBlankType, nextNum));
  }

  function removeFillBlankSegment(idx) {
    if (!Array.isArray(fillBlankDialogForm.segments)) return;
    if (idx < 0 || idx >= fillBlankDialogForm.segments.length) return;
    fillBlankDialogForm.segments.splice(idx, 1);
  }

  function confirmFillBlankDialog() {
    const rawSegments = Array.isArray(fillBlankDialogForm.segments) ? fillBlankDialogForm.segments : [];
    if (!rawSegments.length) {
      warn('请至少添加一个填空分段');
      return;
    }
    const normalizedSegments = [];
    for (let i = 0; i < rawSegments.length; i += 1) {
      if (!isSegmentRangeValid(rawSegments[i])) {
        warn(`第${i + 1}段开始题号不能大于结束题号`);
        return;
      }
      normalizedSegments.push(normalizeFillBlankSegment(rawSegments[i]));
    }
    const sectionNo = Math.max(1, Number(fillBlankDialogForm.sectionNo) || 1);
    const sectionTitle = (fillBlankDialogForm.sectionTitle || '').trim() || '填空题';
    const count = normalizedSegments.reduce((sum, item) => sum + (item.endNum - item.startNum + 1), 0);

    const block = model.upsertBlock({
      type: 'fillblank',
      sectionNo,
      sectionTitle,
      segments: normalizedSegments,
      count,
      optionCount: 0,
      scorePerQuestion: 0
    }, { replaceId: fillBlankDialogForm.editingBlockId });
    model.moveBlockBySectionNo(block.id, sectionNo);

    fillBlankDialogVisible.value = false;
    fillBlankDialogForm.editingBlockId = null;
  }

  /* ---------------- 解答题 ---------------- */

  const isEditingAnswerQuestion = computed(() => answerDialogForm.editingBlockId != null);
  const answerDialogTitle = computed(() => (isEditingAnswerQuestion.value
    ? `编辑解答题框（${answerDialogForm.sectionNo}.${answerDialogForm.sectionTitle}）`
    : '新增解答题试题框'));

  const answerDialogPreviewRows = computed(() => {
    const rows = [];
    (answerDialogForm.segments || [])
      .map((item) => normalizeAnswerSegment(item))
      .sort((a, b) => a.startNum - b.startNum)
      .forEach((segment) => {
        for (let num = segment.startNum; num <= segment.endNum; num += 1) {
          rows.push({
            num,
            scorePerQuestion: formatScore(segment.scorePerQuestion),
            areaHeight: segment.areaHeight
          });
        }
      });
    return rows;
  });

  function openAnswerDialogForCreate() {
    resetForm(answerDialogForm, createAnswerDialogForm({
      sectionNo: model.getNextSectionNo(),
      sectionTitle: getDefaultSectionTitle('answer')
    }));
    answerDialogVisible.value = true;
  }

  function openAnswerDialogForEditById(id) {
    const block = model.questionBlocks.value.find((item) => item.id === id && item.type === 'answer');
    if (!block) return;
    const segments = Array.isArray(block.segments) && block.segments.length
      ? block.segments.map((item) => normalizeAnswerSegment(item))
      : [createAnswerSegment(Number(block.startNum) || 1)];
    resetForm(answerDialogForm, createAnswerDialogForm({
      sectionNo: Math.max(1, Number(block.sectionNo) || model.getNextSectionNo()),
      sectionTitle: (block.sectionTitle || '解答题').trim() || '解答题',
      segments: segments.map((item) => ({ ...item })),
      editingBlockId: block.id || null
    }));
    answerDialogVisible.value = true;
  }

  function appendAnswerSegment() {
    const segments = answerDialogForm.segments;
    const nextNum = segments.length === 0
      ? model.nextQuestionNum()
      : getNextNumFromSegments(segments);
    segments.push(createAnswerSegment(nextNum));
  }

  function removeAnswerSegment(idx) {
    if (!Array.isArray(answerDialogForm.segments)) return;
    if (idx < 0 || idx >= answerDialogForm.segments.length) return;
    answerDialogForm.segments.splice(idx, 1);
  }

  function confirmAnswerDialog() {
    const rawSegments = Array.isArray(answerDialogForm.segments) ? answerDialogForm.segments : [];
    if (!rawSegments.length) {
      warn('请至少添加一个解答题分段');
      return;
    }
    const normalizedSegments = [];
    for (let i = 0; i < rawSegments.length; i += 1) {
      if (!isSegmentRangeValid(rawSegments[i])) {
        warn(`第${i + 1}段开始题号不能大于结束题号`);
        return;
      }
      normalizedSegments.push(normalizeAnswerSegment(rawSegments[i]));
    }
    const sectionNo = Math.max(1, Number(answerDialogForm.sectionNo) || 1);
    const sectionTitle = (answerDialogForm.sectionTitle || '').trim() || '解答题';
    const count = normalizedSegments.reduce((sum, item) => sum + (item.endNum - item.startNum + 1), 0);

    const block = model.upsertBlock({
      type: 'answer',
      sectionNo,
      sectionTitle,
      segments: normalizedSegments,
      count,
      optionCount: 0,
      scorePerQuestion: 0
    }, { replaceId: answerDialogForm.editingBlockId });
    model.moveBlockBySectionNo(block.id, sectionNo);

    answerDialogVisible.value = false;
    answerDialogForm.editingBlockId = null;
  }

  /* ---------------- 英语作文 ---------------- */

  const isEditingEnglishQuestion = computed(() => englishDialogForm.editingBlockId != null);
  const englishDialogTitle = computed(() => (isEditingEnglishQuestion.value
    ? `编辑英语作文框（${englishDialogForm.sectionNo}.${englishDialogForm.sectionTitle}）`
    : '新增英语作文试题框'));

  const englishDialogPreviewRows = computed(() => {
    const f = englishDialogForm;
    let opening = (f.openingText || '').replace(/\s+/g, ' ').trim();
    if (opening.length > 120) opening = `${opening.slice(0, 120)}…`;
    return [{
      scorePerQuestion: formatScore(f.scorePerQuestion),
      lineCount: Math.max(3, Math.min(60, Number(f.lineCount) || 10)),
      openingPreview: opening || '—'
    }];
  });

  function openEnglishDialogForCreate() {
    resetForm(englishDialogForm, createEnglishDialogForm({
      sectionNo: model.getNextSectionNo(),
      sectionTitle: getDefaultSectionTitle('english'),
      questionNo: model.nextQuestionNum()
    }));
    englishDialogVisible.value = true;
  }

  function openEnglishDialogForEditById(id) {
    const block = model.questionBlocks.value.find((item) => item.id === id && item.type === 'english');
    if (!block) return;
    const normalized = normalizeEnglishBlock(block, model.getNextSectionNo());
    resetForm(englishDialogForm, createEnglishDialogForm({
      sectionNo: normalized.sectionNo,
      sectionTitle: normalized.sectionTitle,
      showSectionTitle: normalized.showSectionTitle,
      questionNo: normalized.questionNo,
      scorePerQuestion: normalized.scorePerQuestion,
      lineCount: normalized.lineCount,
      openingText: normalized.openingText,
      editingBlockId: normalized.id || null
    }));
    englishDialogVisible.value = true;
  }

  function confirmEnglishDialog() {
    const sectionNo = Math.max(1, Number(englishDialogForm.sectionNo) || 1);
    const normalized = normalizeEnglishBlock({ ...englishDialogForm, sectionNo, showSectionTitle: true }, sectionNo);
    const block = model.upsertBlock({
      ...normalized,
      count: 1,
      optionCount: 0,
      editingBlockId: null
    }, { replaceId: englishDialogForm.editingBlockId });
    model.moveBlockBySectionNo(block.id, sectionNo);

    englishDialogVisible.value = false;
    englishDialogForm.editingBlockId = null;
  }

  /* ---------------- 语文作文 ---------------- */

  const isEditingChineseQuestion = computed(() => chineseDialogForm.editingBlockId != null);
  const chineseDialogTitle = computed(() => (isEditingChineseQuestion.value
    ? `编辑语文作文框（${chineseDialogForm.sectionNo}.${chineseDialogForm.sectionTitle}）`
    : '新增语文作文试题框'));

  const chineseDialogPreviewRows = computed(() => {
    const f = chineseDialogForm;
    const min = Math.max(50, Number(f.minWordCount) || 800);
    const max = Math.max(100, Number(f.maxWordCount) || 1000);
    return [{
      order: 1,
      scorePerQuestion: formatScore(f.scorePerQuestion),
      wordCountRange: `${min}～${max}字`
    }];
  });

  const chineseInsertAfterSectionOptions = computed(() => {
    const selfId = chineseDialogForm.editingBlockId;
    return model.questionBlocks.value
      .filter((item) => item.id !== selfId)
      .map((item) => Number(item.sectionNo) || 0)
      .filter((num) => num > 0)
      .sort((a, b) => a - b);
  });

  function openChineseDialogForCreate() {
    resetForm(chineseDialogForm, createChineseDialogForm({
      sectionNo: model.getNextSectionNo(),
      sectionTitle: getDefaultSectionTitle('chinese'),
      questionNo: model.nextQuestionNum(),
      insertAfterSectionNo: model.questionBlocks.value.length || null
    }));
    chineseDialogVisible.value = true;
  }

  function openChineseDialogForEditById(id) {
    const block = model.questionBlocks.value.find((item) => item.id === id && item.type === 'chinese');
    if (!block) return;
    const normalized = normalizeChineseBlock(block, model.getNextSectionNo());
    resetForm(chineseDialogForm, createChineseDialogForm({
      sectionNo: normalized.sectionNo,
      sectionTitle: normalized.sectionTitle,
      questionNo: normalized.questionNo,
      scorePerQuestion: normalized.scorePerQuestion,
      minWordCount: normalized.minWordCount,
      maxWordCount: normalized.maxWordCount,
      insertAfterSectionNo: normalized.sectionNo - 1,
      editingBlockId: normalized.id || null
    }));
    chineseDialogVisible.value = true;
  }

  function confirmChineseDialog() {
    const sectionNo = Math.max(1, Number(chineseDialogForm.sectionNo) || 1);
    const normalized = normalizeChineseBlock({ ...chineseDialogForm, sectionNo }, sectionNo);
    const block = model.upsertBlock({
      ...normalized,
      count: 1,
      optionCount: 0,
      editingBlockId: null
    }, { replaceId: chineseDialogForm.editingBlockId });

    if (chineseDialogForm.insertEnabled && chineseDialogForm.insertAfterSectionNo != null) {
      model.moveBlockBySectionNo(block.id, Number(chineseDialogForm.insertAfterSectionNo) + 1);
    } else {
      model.moveBlockBySectionNo(block.id, sectionNo);
    }

    chineseDialogVisible.value = false;
    chineseDialogForm.editingBlockId = null;
  }

  /* ---------------- 准考证位数 / 考生须知 ---------------- */

  function openAdmissionEditor() {
    admissionColumnsDraft.value = model.effectiveAdmissionColumns.value;
    admissionEditorVisible.value = true;
  }

  function applyAdmissionColumns() {
    model.form.admissionColumns = model.normalizeAdmissionColumns(admissionColumnsDraft.value);
    admissionEditorVisible.value = false;
  }

  function handleAdmissionColumnsChange(value) {
    model.form.admissionColumns = model.normalizeAdmissionColumns(value);
  }

  function openNoticeEditor() {
    const raw = (model.form.noticeText || '').trim();
    noticeEditorDraft.value = raw ? String(model.form.noticeText) : DEFAULT_NOTICE.join('\n');
    noticeEditorVisible.value = true;
  }

  function applyNoticeEditor() {
    model.form.noticeText = (noticeEditorDraft.value || '').trim();
    noticeEditorVisible.value = false;
    model.previewRenderVersion.value += 1;
  }

  /** 预览区「编辑」入口：按题型分发到对应弹窗 */
  function openQuestionBlockEditor(block) {
    if (!block) return;
    if (block.type === 'fillblank') return openFillBlankDialogForEditById(block.id);
    if (block.type === 'answer') return openAnswerDialogForEditById(block.id);
    if (block.type === 'english') return openEnglishDialogForEditById(block.id);
    if (block.type === 'chinese') return openChineseDialogForEditById(block.id);
    return openEditQuestionBlock(block);
  }

  return {
    // objective
    questionConfigDialogVisible,
    questionConfigForm,
    isEditingQuestionBlock,
    questionConfigDialogTitle,
    objectiveDialogPreviewRows,
    openQuestionConfigDialog,
    openEditQuestionBlock,
    appendObjectiveSegment,
    removeObjectiveSegment,
    confirmQuestionConfig,
    // fillblank
    fillBlankDialogVisible,
    fillBlankDialogForm,
    isEditingFillBlankQuestion,
    fillBlankDialogTitle,
    fillBlankDialogPreviewRows,
    fillBlankDialogPreviewLineLabel,
    openFillBlankDialogForCreate,
    openFillBlankDialogForEditById,
    appendFillBlankSegment,
    removeFillBlankSegment,
    confirmFillBlankDialog,
    // answer
    answerDialogVisible,
    answerDialogForm,
    isEditingAnswerQuestion,
    answerDialogTitle,
    answerDialogPreviewRows,
    openAnswerDialogForCreate,
    openAnswerDialogForEditById,
    appendAnswerSegment,
    removeAnswerSegment,
    confirmAnswerDialog,
    // english
    englishDialogVisible,
    englishDialogForm,
    isEditingEnglishQuestion,
    englishDialogTitle,
    englishDialogPreviewRows,
    openEnglishDialogForCreate,
    openEnglishDialogForEditById,
    confirmEnglishDialog,
    // chinese
    chineseDialogVisible,
    chineseDialogForm,
    isEditingChineseQuestion,
    chineseDialogTitle,
    chineseDialogPreviewRows,
    chineseInsertAfterSectionOptions,
    openChineseDialogForCreate,
    openChineseDialogForEditById,
    confirmChineseDialog,
    // misc editors
    admissionEditorVisible,
    admissionColumnsDraft,
    openAdmissionEditor,
    applyAdmissionColumns,
    handleAdmissionColumnsChange,
    noticeEditorVisible,
    noticeEditorDraft,
    openNoticeEditor,
    applyNoticeEditor,
    // dispatch
    openQuestionBlockEditor
  };
}

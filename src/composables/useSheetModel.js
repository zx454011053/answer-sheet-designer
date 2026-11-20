/**
 * 答题卡模型状态：表单 + 题块集合 + 由二者派生的排版数据。
 *
 * 对应原 AnswerSheetEditor 中 data() / computed / 一部分 methods，抽离后组件只负责模板编排。
 */
import { computed, reactive, ref } from 'vue';
import { DEFAULT_NOTICE } from '@/core/constants';
import { createDefaultSheetForm } from '@/core/defaults';
import {
  computeSheetStats,
  countAnswerQuestions,
  countFillBlankQuestions,
  formatScore,
  getAnswerTotalScore,
  getDefaultSectionTitle,
  getFillBlankTotalScore,
  getNextGlobalQuestionNum,
  getNextNumFromSegments,
  getQuestionTypeLabel,
  isObjectiveType,
  normalizeAnswerBlock,
  normalizeChineseBlock,
  normalizeEnglishBlock,
  normalizeFillBlankBlock
} from '@/core/questionModel';
import { buildObjectiveRenderBlock } from '@/core/objectiveLayout';
import { withAnswerAreaHeight } from '@/core/answerArea';

/**
 * @param {Object} [options]
 * @param {Object} [options.initialForm]
 * @param {(msg: string) => void} [options.notifyWarning]
 */
export function useSheetModel(options = {}) {
  const notifyWarning = typeof options.notifyWarning === 'function'
    ? options.notifyWarning
    : (msg) => console.warn(msg);

  const form = reactive(createDefaultSheetForm(options.initialForm));
  const questionBlocks = ref([]);
  const nextQuestionBlockId = ref(1);
  const previewRenderVersion = ref(0);
  const firstPageLeaderMeasuredHeightPx = ref(null);
  const dragBlockId = ref(null);

  /* ---------------- 版式派生 ---------------- */

  const layoutType = computed(() => form.layoutType || 'A4');
  const isA3Layout = computed(() => layoutType.value === 'A3');
  const is8KLayout = computed(() => layoutType.value === '8K');
  const isA4Layout = computed(() => layoutType.value === 'A4');

  const normalizeA3ColumnCount = (value) => (Number(value) === 3 ? 3 : 2);
  const effectiveA3ColumnCount = computed(() => normalizeA3ColumnCount(form.a3ColumnCount));

  const isA3MultiColumnLayout = computed(() =>
    (isA3Layout.value || is8KLayout.value)
    && (effectiveA3ColumnCount.value === 2 || effectiveA3ColumnCount.value === 3));

  const isLandscapeSheetLayout = computed(() => isA3Layout.value || is8KLayout.value);

  const normalizeAdmissionColumns = (value) => {
    const num = Number(value);
    if (Number.isNaN(num)) return 9;
    return Math.min(20, Math.max(4, Math.floor(num)));
  };
  const effectiveAdmissionColumns = computed(() => {
    const value = Number(form.admissionColumns) || 9;
    return Math.min(20, Math.max(4, value));
  });

  const admissionGridStyle = computed(() => ({
    gridTemplateColumns: `repeat(${effectiveAdmissionColumns.value}, 23px)`,
    justifyContent: 'flex-start'
  }));

  const admissionCardStyle = computed(() => {
    const cols = effectiveAdmissionColumns.value;
    return { width: `${cols * 23 + (cols - 1) * 5 + 14}px` };
  });

  const showFillBlankScore = computed(() =>
    form.fillBlankShowScore !== false && form.fillBlankShowScore !== 0);

  const isAdmissionMode = computed(() => form.fillType === 'admission');
  const isBarcodeMode = computed(() => form.fillType === 'barcode');
  const isClassNumberMode = computed(() => form.fillType === 'class-number');
  const isShortNumberMode = computed(() => form.fillType === 'short-number');

  /** A3 / 8K 三栏首栏过窄，短学号区无法可靠排版 */
  const shortNumberFillDisabled = computed(() =>
    (isA3Layout.value || is8KLayout.value) && effectiveA3ColumnCount.value === 3);

  const sideSealDigitsTopDown = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  const sideSealClassRowLabels = ['班', '级'];
  const sideSealStudentRowLabels = ['学', '号'];
  const shortNumberRowLabels = ['班', '级', '学', '号'];

  const noticeList = computed(() => {
    if (!form.noticeText) return DEFAULT_NOTICE;
    const list = form.noticeText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    return list.length ? list : DEFAULT_NOTICE;
  });

  /** 侧封等已下线填涂方式：历史数据回落为准考证号 */
  function ensureFillTypeCompatibleWithA3Columns() {
    if (shortNumberFillDisabled.value && form.fillType === 'short-number') {
      form.fillType = 'admission';
    }
    if (form.fillType === 'class-number' || form.fillType === 'qrcode') {
      form.fillType = 'admission';
    }
  }

  /* ---------------- 题块派生 ---------------- */

  /** 题块 → 可直接渲染/分页的 section 数据（按当前版式决定客观题横带列数） */
  const generatedQuestionBlocks = computed(() => {
    const ordered = questionBlocks.value.slice();
    let start = 1;
    return ordered.map((item, idx) => {
      const sectionNo = Math.max(1, Number(item.sectionNo) || (idx + 1));
      const fallbackTitle = getDefaultSectionTitle(item.type);
      const sectionTitle = (item.sectionTitle || fallbackTitle).trim() || fallbackTitle;
      const key = `${item.id || idx}-${item.type}`;

      if (item.type === 'fillblank') {
        const normalized = normalizeFillBlankBlock({ ...item, sectionNo, sectionTitle }, idx + 1);
        return {
          ...normalized,
          key,
          totalScore: getFillBlankTotalScore(normalized)
        };
      }
      if (item.type === 'answer') {
        const normalized = normalizeAnswerBlock({ ...item, sectionNo, sectionTitle }, idx + 1);
        return {
          ...normalized,
          key,
          totalScore: getAnswerTotalScore(normalized)
        };
      }
      if (item.type === 'english') {
        const normalized = normalizeEnglishBlock({ ...item, sectionNo, sectionTitle }, idx + 1);
        return {
          ...normalized,
          key,
          totalScore: Math.max(0.5, Number(normalized.scorePerQuestion) || 1),
          sectionVisible: normalized.showSectionTitle !== false
        };
      }
      if (item.type === 'chinese') {
        const normalized = normalizeChineseBlock({ ...item, sectionNo, sectionTitle }, idx + 1);
        return {
          ...normalized,
          key,
          totalScore: Math.max(0.5, Number(normalized.scorePerQuestion) || 1),
          sectionVisible: true
        };
      }

      const block = buildObjectiveRenderBlock(
        { ...item, sectionNo, sectionTitle },
        { startNum: start, layoutType: layoutType.value, columnCount: effectiveA3ColumnCount.value }
      );
      start += block.__questionCount;
      const { __questionCount, ...rest } = block;
      return { ...rest, key };
    });
  });

  const fillBlankBlocks = computed(() =>
    generatedQuestionBlocks.value.filter((item) => item.type === 'fillblank'));
  const choiceBlocks = computed(() =>
    generatedQuestionBlocks.value.filter((item) => isObjectiveType(item.type)));
  const fillBlankTotalScore = computed(() =>
    fillBlankBlocks.value.reduce((sum, item) => sum + getFillBlankTotalScore(item), 0));

  /* ---------------- 题块维护 ---------------- */

  function syncSectionNoWithOrder() {
    questionBlocks.value = questionBlocks.value.map((item, idx) => ({ ...item, sectionNo: idx + 1 }));
  }

  function getNextSectionNo() {
    return questionBlocks.value.length + 1;
  }

  /** 全卷题量统计回填 form（保存时后端也需要这些字段） */
  function syncStats() {
    const stats = computeSheetStats(questionBlocks.value);
    form.choiceCount = stats.choiceCount;
    form.subjectiveCount = stats.subjectiveCount;
    form.questionCount = stats.questionCount;
    return stats;
  }

  /** 实时统计（题量 / 选择题数 / 主观题数 / 总分），供面板展示与宿主读取 */
  const sheetStats = computed(() => computeSheetStats(questionBlocks.value));

  /**
   * 新增/更新题块。sectionNo 决定插入位置，写入后统一重排。
   * @param {Object} payload
   * @param {{ replaceId?: string|number|null, insertAt?: number|null }} [opts]
   */
  function upsertBlock(payload, opts = {}) {
    const list = questionBlocks.value.slice();
    const replaceId = opts.replaceId;
    const existedIndex = replaceId != null
      ? list.findIndex((item) => item.id === replaceId)
      : -1;

    const id = existedIndex >= 0 ? list[existedIndex].id : nextQuestionBlockId.value++;
    const block = { ...payload, id };

    if (existedIndex >= 0) {
      list.splice(existedIndex, 1, block);
    } else if (opts.insertAt != null) {
      const index = Math.max(0, Math.min(list.length, Number(opts.insertAt) - 1 || 0));
      list.splice(index, 0, block);
    } else {
      list.push(block);
    }
    questionBlocks.value = list;
    syncSectionNoWithOrder();
    syncStats();
    return block;
  }

  /** 把题块移动到指定大题序号 */
  function moveBlockBySectionNo(blockId, sectionNo) {
    const list = questionBlocks.value.slice();
    const currentIndex = list.findIndex((item) => item.id === blockId);
    if (currentIndex < 0) return;
    const targetIndex = Math.max(0, Math.min(list.length - 1, Number(sectionNo) - 1 || 0));
    if (currentIndex !== targetIndex) {
      const [moved] = list.splice(currentIndex, 1);
      list.splice(targetIndex, 0, moved);
    }
    questionBlocks.value = list;
    syncSectionNoWithOrder();
  }

  /** 拖拽排序 */
  function reorderBlocks(fromId, toId) {
    if (fromId == null || fromId === toId) return;
    const list = questionBlocks.value.slice();
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    questionBlocks.value = list;
    syncSectionNoWithOrder();
  }

  function removeQuestionBlock(id) {
    questionBlocks.value = questionBlocks.value.filter((item) => item.id !== id);
    syncSectionNoWithOrder();
    syncStats();
  }

  /**
   * 调整某道解答题的作答区高度（拖动下沿触发）
   * @param {string|number} blockId
   * @param {number} questionNum
   * @param {number} height
   * @param {{ min?: number, max?: number }} [limits]
   */
  function updateAnswerAreaHeight(blockId, questionNum, height, limits = {}) {
    const index = questionBlocks.value.findIndex((item) => item.id === blockId && item.type === 'answer');
    if (index < 0) return;
    const next = withAnswerAreaHeight(questionBlocks.value[index], questionNum, height, {
      ...limits,
      fallbackSectionNo: index + 1
    });
    if (!next) return;
    const list = questionBlocks.value.slice();
    list.splice(index, 1, next);
    questionBlocks.value = list;
  }

  /** 新建大题时的起始题号 */
  function nextQuestionNum(excludeBlockId = null) {
    return getNextGlobalQuestionNum(questionBlocks.value, excludeBlockId);
  }

  function nextNumInSegments(segments = []) {
    return getNextNumFromSegments(segments);
  }

  /** 载入新题块集合（模板/存档），顺带补齐 sectionNo、题块 id 自增位 */
  function replaceQuestionBlocks(blocks = []) {
    const normalized = (Array.isArray(blocks) ? blocks : [])
      .map((item, idx) => {
        const sectionNo = Math.max(1, Number(item.sectionNo) || (idx + 1));
        const fallbackTitle = getDefaultSectionTitle(item.type);
        const sectionTitle = (item.sectionTitle || fallbackTitle).trim() || fallbackTitle;
        const base = { ...item, sectionNo, sectionTitle };
        if (item.type === 'answer') return normalizeAnswerBlock(base, idx + 1);
        if (item.type === 'english') return normalizeEnglishBlock(base, idx + 1);
        if (item.type === 'chinese') return normalizeChineseBlock(base, idx + 1);
        if (item.type === 'fillblank') return normalizeFillBlankBlock(base, idx + 1);
        return base;
      })
      .sort((a, b) => (Number(a.sectionNo) || 0) - (Number(b.sectionNo) || 0));

    questionBlocks.value = normalized;
    syncSectionNoWithOrder();
    const maxId = questionBlocks.value.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
    nextQuestionBlockId.value = Math.max(1, nextQuestionBlockId.value, maxId + 1);
    syncStats();
  }

  /* ---------------- 计数 / 文案辅助 ---------------- */

  const getFillBlankBlockQuestionCount = (block) => countFillBlankQuestions(block);
  const getFillBlankBlockTotalScore = (block) => getFillBlankTotalScore(block);
  const getAnswerBlockQuestionCount = (block) => countAnswerQuestions(block);
  const getAnswerBlockTotalScore = (block) => getAnswerTotalScore(block);

  const normalizeFillType = (fillType) => (fillType === 'short-number' || fillType === 'barcode'
    ? fillType
    : 'admission');

  return {
    // state
    form,
    questionBlocks,
    nextQuestionBlockId,
    previewRenderVersion,
    firstPageLeaderMeasuredHeightPx,
    dragBlockId,
    // layout
    layoutType,
    isA3Layout,
    is8KLayout,
    isA4Layout,
    isA3MultiColumnLayout,
    isLandscapeSheetLayout,
    effectiveA3ColumnCount,
    effectiveAdmissionColumns,
    admissionGridStyle,
    admissionCardStyle,
    normalizeA3ColumnCount,
    normalizeAdmissionColumns,
    normalizeFillType,
    // fill type
    isAdmissionMode,
    isBarcodeMode,
    isClassNumberMode,
    isShortNumberMode,
    shortNumberFillDisabled,
    sideSealDigitsTopDown,
    sideSealClassRowLabels,
    sideSealStudentRowLabels,
    shortNumberRowLabels,
    // derived
    showFillBlankScore,
    noticeList,
    generatedQuestionBlocks,
    fillBlankBlocks,
    choiceBlocks,
    fillBlankTotalScore,
    sheetStats,
    // mutations
    ensureFillTypeCompatibleWithA3Columns,
    syncSectionNoWithOrder,
    getNextSectionNo,
    syncStats,
    upsertBlock,
    moveBlockBySectionNo,
    reorderBlocks,
    removeQuestionBlock,
    updateAnswerAreaHeight,
    replaceQuestionBlocks,
    nextQuestionNum,
    nextNumInSegments,
    // helpers
    getFillBlankBlockQuestionCount,
    getFillBlankBlockTotalScore,
    getAnswerBlockQuestionCount,
    getAnswerBlockTotalScore,
    formatScore,
    getDefaultSectionTitle,
    getQuestionTypeLabel,
    notifyWarning
  };
}

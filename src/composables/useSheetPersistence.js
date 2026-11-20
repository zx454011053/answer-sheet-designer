/**
 * 读写编排：初始化加载、保存、模板存取。
 *
 * 后端访问全部经 dataSource（见 src/datasource），组件不再感知 HTTP / 路由。
 */
import { computed, ref, set } from 'vue';
import { MessageBox } from 'element-ui';
import { buildSheetPayload, parseEditorDocument, applyEditorDocument } from '@/core/document';
import { createPresetSnapshot, getPresetTemplate, listPresetTemplates } from '@/core/presetTemplates';
import { validateQuestionNumbering } from '@/core/sheetBuilder';
import { normalizeDataSource } from '@/datasource';

/**
 * @param {Object} params
 * @param {Object} params.model useSheetModel
 * @param {Object} params.dataSource 数据源（可为部分实现）
 * @param {string|number|null} params.examId
 * @param {Object} params.initialSheet 外部直接传入的答题卡数据（优先级高于 dataSource.loadSheet）
 * @param {Object} params.initialSession 外部直接传入的考试信息
 * @param {{ success: Function, error: Function, warning: Function }} params.message
 * @param {(payload: Object) => void} [params.onSaved]
 * @param {(payload: Object) => void} [params.onTemplateSaved]
 * @param {(error: Error) => void} [params.onError]
 */
export function useSheetPersistence({
  model,
  dataSource,
  examId,
  initialSheet,
  initialSession,
  message,
  onSaved,
  onTemplateSaved,
  onError
}) {
  const ds = computed(() => normalizeDataSource(dataSource));
  const examInfo = ref({ ...(initialSession || {}) });
  const saving = ref(false);

  const templateDialogVisible = ref(false);
  const templateListLoading = ref(false);
  const templateList = ref([]);

  /** 内置科目模板：纯前端常量，不依赖数据源，离线 / 首次使用时也能载入 */
  const presetList = ref(listPresetTemplates());

  // examId 放在 ref 里而不是直接闭包捕获：宿主复用同一个组件、只换 :exam-id 时也要能热切换
  const currentExamId = ref(examId);
  const normalizedExamId = computed(() => {
    const value = Number(currentExamId.value);
    return Number.isFinite(value) && value > 0 ? value : null;
  });

  const previewTitle = computed(() =>
    model.form.sheetName || examInfo.value.name || '答题卡');

  /** 未手工编辑时的兜底考试号：优先取考试信息，其次按 examId 生成 */
  const defaultExamNo = computed(() => {
    if (examInfo.value.examNo) return String(examInfo.value.examNo);
    const fallback = 10000000 + (normalizedExamId.value || 0);
    return `S${String(fallback).padStart(8, '0')}`;
  });

  /** 生效的考试号：表单里可编辑，留空才回落 */
  const examNo = computed(() => {
    const edited = String(model.form.examNo == null ? '' : model.form.examNo).trim();
    return edited || defaultExamNo.value;
  });

  /** 载入后把兜底值落到表单，保证右侧输入框能显示当前考试号 */
  function syncExamNoIfEmpty() {
    const current = String(model.form.examNo == null ? '' : model.form.examNo).trim();
    if (!current) model.form.examNo = defaultExamNo.value;
  }

  /**
   * 安全写入表单：已存在字段走既有 setter，新增字段用 Vue.set。
   * Vue 2 的响应式由 defineProperty 实现，`Object.assign` 新增的属性没有 setter，
   * 依赖它的 computed 不会更新（后端将来多返回字段时会踩到）。
   */
  function writeForm(target, ...sources) {
    sources.forEach((source) => {
      if (!source || typeof source !== 'object') return;
      Object.keys(source).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(target, key)) target[key] = source[key];
        else set(target, key, source[key]);
      });
    });
  }

  /** 把外部传入 / 远程拉取的答题卡数据合并进表单与题块 */
  function applySheetData(sheet) {
    if (!sheet || typeof sheet !== 'object') return false;
    const { editorJson, ...rest } = sheet;
    writeForm(model.form, rest, {
      examSessionId: normalizedExamId.value,
      admissionColumns: model.normalizeAdmissionColumns(rest.admissionColumns),
      a3ColumnCount: model.normalizeA3ColumnCount(rest.a3ColumnCount)
    });

    const doc = parseEditorDocument(editorJson);
    if (doc) {
      const applied = applyEditorDocument(doc, model.form, model.nextQuestionBlockId.value);
      Object.assign(model.form, applied.form);
      model.nextQuestionBlockId.value = applied.nextQuestionBlockId;
      if (applied.questionBlocks) {
        model.replaceQuestionBlocks(applied.questionBlocks);
      }
      // 旧版 editorJson 没有该字段：视为未配置过，默认展示二维码，
      // 避免升级后被历史 meta 里的 qrcodeEnabled=0 静默隐藏
      if (doc.qrcodeEnabled == null) model.form.qrcodeEnabled = 1;
    }

    model.ensureFillTypeCompatibleWithA3Columns();
    model.syncStats();
    model.previewRenderVersion.value += 1;
    return true;
  }

  /** 只更新目标考试 id（内容由 props.sheet / content 提供时用，不去拉远端旧卷） */
  function setExamId(nextExamId) {
    currentExamId.value = nextExamId;
  }

  /**
   * 宿主切换考试（同一个组件实例换 :exam-id）。
   *
   * 必须先把 id / 题块清掉：否则上一场的 form.id 会被写进新考试，
   * 保存时直接覆盖掉别的记录；题块不清则新旧卷混在一起。
   */
  async function switchExam(nextExamId) {
    if (String(nextExamId) === String(currentExamId.value)) return null;
    currentExamId.value = nextExamId;
    if (initialSheet) return null; // 内容由宿主传入，不按 examId 拉取
    if (normalizedExamId.value == null) return null;

    model.replaceQuestionBlocks([]);
    model.nextQuestionBlockId.value = 1;
    model.form.id = null;
    model.form.examSessionId = normalizedExamId.value;
    model.form.sheetName = '';
    model.form.examNo = '';
    model.form.pageCount = 1;
    model.form.questionCount = 0;
    model.form.choiceCount = 0;
    model.form.subjectiveCount = 0;
    // 宿主自己传了 session 就保留（切换考试时宿主通常一起换），否则让 load 重新取
    if (!initialSession) examInfo.value = {};
    return load();
  }

  /** 宿主的 session prop 变化：只同步展示用的考试信息 */
  function updateSession(nextSession) {
    if (nextSession && typeof nextSession === 'object') examInfo.value = { ...nextSession };
  }

  async function load() {
    try {
      if (initialSession) {
        examInfo.value = { ...initialSession };
      } else if (normalizedExamId.value != null) {
        const session = await ds.value.loadSession({ examId: normalizedExamId.value });
        if (session) examInfo.value = { ...session };
      }

      let sheet = initialSheet || null;
      if (!sheet && normalizedExamId.value != null) {
        sheet = await ds.value.loadSheet({ examId: normalizedExamId.value });
      }

      if (applySheetData(sheet)) {
        syncExamNoIfEmpty();
        return;
      }

      // 新建答题卡：按考试信息预填
      model.form.examSessionId = normalizedExamId.value;
      model.form.paperId = examInfo.value.paperId != null ? examInfo.value.paperId : model.form.paperId;
      model.form.sheetName = model.form.sheetName
        && model.form.sheetName !== '答题卡'
        ? model.form.sheetName
        : `${examInfo.value.name || '考试'}-答题卡`;
      syncExamNoIfEmpty();
      model.ensureFillTypeCompatibleWithA3Columns();
      model.syncStats();
    } catch (error) {
      message.error('答题卡数据加载失败');
      reportError(error);
    }
  }

  function reportError(error) {
    console.error('[AnswerSheetDesigner]', error);
    if (typeof onError === 'function') onError(error);
  }

  /** 保存前统一收敛表单状态 */
  function preparePayload() {
    model.ensureFillTypeCompatibleWithA3Columns();
    model.syncStats();
    model.form.admissionColumns = model.normalizeAdmissionColumns(model.form.admissionColumns);
    model.form.a3ColumnCount = model.normalizeA3ColumnCount(model.form.a3ColumnCount);
    model.form.examSessionId = normalizedExamId.value;
    return buildSheetPayload(model.form, model.questionBlocks.value, {
      nextQuestionBlockId: model.nextQuestionBlockId.value
    });
  }

  /**
   * 保存前检查题号连续性。
   *
   * 界面上允许手工改分段起始号，能造出跳号/重号；这类卡面印出去就是错的，
   * 所以保存时提示一次，由用户决定「仍然保存」还是「返回修改」（不硬拦，AB 卷可能真的跳号）。
   *
   * @returns {Promise<boolean>} false 表示用户选择返回修改
   */
  async function confirmQuestionNumbering() {
    const result = validateQuestionNumbering(model.questionBlocks.value);
    if (result.ok) return true;

    const parts = [];
    if (result.duplicates.length) {
      parts.push(`重复题号 ${result.duplicates.slice(0, 8).join('、')}`);
    }
    if (result.gaps.length) {
      parts.push(
        `断档 ${result.gaps.slice(0, 5).map(([from, to]) => `${from}→${to}`).join('、')}`
      );
    }
    if (result.descents.length) {
      parts.push('存在倒序或区间重叠');
    }

    try {
      await MessageBox.confirm(
        `检测到${parts.join('；')}。题目顺序可能打印错位，仍要保存吗？`,
        '题号不连续',
        { confirmButtonText: '仍然保存', cancelButtonText: '返回修改', type: 'warning' }
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async function save() {
    // 锁要在确认框之前上：否则连点两下「保存」会同时弹出两个题号确认框，
    // 用户确认其中一个后另一个仍挂着，再点会重复提交。
    if (saving.value) return null;
    saving.value = true;
    try {
      const confirmed = await confirmQuestionNumbering();
      if (!confirmed) return null;
      const payload = preparePayload();
      const result = await ds.value.saveSheet({ examId: normalizedExamId.value, payload });
      const id = result && result.id != null ? result.id : null;
      if (id != null && !model.form.id) model.form.id = id;
      message.success('保存成功');
      if (typeof onSaved === 'function') onSaved({ ...payload, id: id != null ? id : model.form.id });
      return id;
    } catch (error) {
      message.error('保存失败，请稍后重试');
      console.error('[AnswerSheetDesigner]', error);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function saveAsTemplate(name) {
    let templateName = (name || '').trim();
    if (!templateName) {
      try {
        const ret = await MessageBox.prompt('请输入模板名称', '保存为模板', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          inputPattern: /\S+/,
          inputErrorMessage: '名称不能为空',
          inputPlaceholder: '例如：期末统考-语文'
        });
        templateName = ((ret && ret.value) || '').trim();
      } catch (error) {
        return null;
      }
    }
    if (!templateName) return null;

    try {
      const payload = preparePayload();
      const body = {
        templateName,
        layoutType: payload.layoutType,
        a3ColumnCount: payload.a3ColumnCount,
        pageCount: payload.pageCount,
        questionCount: payload.questionCount,
        choiceCount: payload.choiceCount,
        subjectiveCount: payload.subjectiveCount,
        absentMarkEnabled: payload.absentMarkEnabled,
        barcodeEnabled: payload.barcodeEnabled,
        qrcodeEnabled: payload.qrcodeEnabled,
        admissionCardEnabled: payload.admissionCardEnabled,
        studentInfoEnabled: payload.studentInfoEnabled,
        admissionColumns: payload.admissionColumns,
        noticeText: payload.noticeText || '',
        editorJson: payload.editorJson
      };
      const result = await ds.value.saveTemplate({ payload: body });
      message.success('模板已保存');
      if (typeof onTemplateSaved === 'function') onTemplateSaved({ ...body, id: result && result.id });
      return result;
    } catch (error) {
      message.error('模板保存失败');
      console.error('[AnswerSheetDesigner]', error);
      return null;
    }
  }

  async function fetchTemplateList() {
    templateListLoading.value = true;
    try {
      const list = await ds.value.listTemplates();
      templateList.value = Array.isArray(list) ? list : [];
    } catch (error) {
      templateList.value = [];
      message.error('模板列表加载失败');
    } finally {
      templateListLoading.value = false;
    }
  }

  function openTemplateDialog() {
    templateDialogVisible.value = true;
  }

  /** 重命名已保存的模板 */
  async function renameTemplate(id, nextName) {
    const templateName = String(nextName == null ? '' : nextName).trim();
    if (id == null || !templateName) return null;
    try {
      const result = await ds.value.renameTemplate({ id, templateName });
      if (!result) {
        message.error('重命名失败');
        return null;
      }
      message.success('模板已重命名');
      await fetchTemplateList();
      return result;
    } catch (error) {
      message.error('重命名失败');
      return null;
    }
  }

  /** 删除已保存的模板（二次确认） */
  async function deleteTemplate(id) {
    if (id == null) return null;
    try {
      await MessageBox.confirm('删除后不可恢复，确定删除这个模板？', '删除模板', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      });
    } catch (error) {
      // 用户取消
      return null;
    }
    try {
      const result = await ds.value.deleteTemplate({ id });
      if (!result) {
        message.error('删除失败');
        return null;
      }
      message.success('模板已删除');
      await fetchTemplateList();
      return result;
    } catch (error) {
      message.error('删除失败');
      return null;
    }
  }

  async function applyTemplate(templateId) {
    if (templateId == null) return;
    try {
      const data = await ds.value.getTemplate({ id: templateId });
      if (!data) return;
      const keep = {
        id: model.form.id,
        examSessionId: normalizedExamId.value,
        paperId: model.form.paperId != null ? model.form.paperId : examInfo.value.paperId,
        sheetName: model.form.sheetName || `${examInfo.value.name || '考试'}-答题卡`,
        examNo: model.form.examNo
      };
      Object.assign(model.form, {
        layoutType: data.layoutType || 'A4',
        a3ColumnCount: model.normalizeA3ColumnCount(data.a3ColumnCount),
        pageCount: data.pageCount != null ? data.pageCount : 1,
        questionCount: data.questionCount != null ? data.questionCount : 0,
        choiceCount: data.choiceCount != null ? data.choiceCount : 0,
        subjectiveCount: data.subjectiveCount != null ? data.subjectiveCount : 0,
        absentMarkEnabled: data.absentMarkEnabled != null ? data.absentMarkEnabled : 1,
        barcodeEnabled: data.barcodeEnabled != null ? data.barcodeEnabled : 0,
        qrcodeEnabled: data.qrcodeEnabled != null ? data.qrcodeEnabled : 1,
        admissionCardEnabled: data.admissionCardEnabled != null ? data.admissionCardEnabled : 1,
        studentInfoEnabled: data.studentInfoEnabled != null ? data.studentInfoEnabled : 1,
        admissionColumns: model.normalizeAdmissionColumns(data.admissionColumns),
        noticeText: data.noticeText != null ? data.noticeText : '',
        ...keep
      });

      const doc = parseEditorDocument(data.editorJson);
      if (doc) {
        const applied = applyEditorDocument(doc, model.form, model.nextQuestionBlockId.value);
        Object.assign(model.form, applied.form);
        model.nextQuestionBlockId.value = applied.nextQuestionBlockId;
        if (applied.questionBlocks) model.replaceQuestionBlocks(applied.questionBlocks);
      }

      // 模板可携带自己的标题与考试号，但当前答题卡的考试号必须保留
      if (keep.examNo != null) model.form.examNo = keep.examNo;
      model.ensureFillTypeCompatibleWithA3Columns();
      model.syncStats();
      model.previewRenderVersion.value += 1;
      templateDialogVisible.value = false;
      message.success('已载入模板');
    } catch (error) {
      message.error('模板载入失败');
      console.error('[AnswerSheetDesigner]', error);
    }
  }

  /**
   * 载入内置科目模板。
   *
   * 只替换「版式 + 大题结构」：标题、考试号、填涂方式、学生信息区保持当前设置，
   * 避免老师只是想换个科目结构，却把已填好的卡面信息一起冲掉。
   *
   * @param {string} presetId 形如 `preset-math`
   * @returns {boolean} 是否载入成功
   */
  function applyPreset(presetId) {
    const preset = getPresetTemplate(presetId);
    const snapshot = createPresetSnapshot(presetId);
    if (!preset || !snapshot) return false;

    const currentName = String(model.form.sheetName == null ? '' : model.form.sheetName).trim();
    const keepExamNo = model.form.examNo;

    model.form.layoutType = snapshot.layoutType;
    model.form.a3ColumnCount = model.normalizeA3ColumnCount(snapshot.a3ColumnCount);
    // 只有当标题还是占位值时才跟随科目命名，用户改过的标题一律保留
    if (!currentName || currentName === '答题卡') {
      model.form.sheetName = `${preset.name}-答题卡`;
    }
    if (keepExamNo != null) model.form.examNo = keepExamNo;

    model.replaceQuestionBlocks(snapshot.blocks);
    model.nextQuestionBlockId.value = Math.max(
      model.nextQuestionBlockId.value,
      snapshot.nextQuestionBlockId
    );
    model.ensureFillTypeCompatibleWithA3Columns();
    model.syncStats();
    model.previewRenderVersion.value += 1;
    templateDialogVisible.value = false;
    message.success(`已载入「${preset.name}」模板`);
    return true;
  }

  // 外部通过 sheet / content 直接给了数据：装配阶段就应用。
  // 不能只依赖 load()——宿主常把 autoLoad 设为 false（不想走后端加载），
  // 那样传进来的答题卡会静默变成空白卷。
  if (initialSheet) {
    if (initialSession) examInfo.value = { ...initialSession };
    applySheetData(initialSheet);
    syncExamNoIfEmpty();
  }

  return {
    examInfo,
    examNo,
    previewTitle,
    saving,
    load,
    /** 宿主切换考试：清空后按新 examId 重新加载 */
    switchExam,
    /** 只改目标 examId（内容由宿主提供时用） */
    setExamId,
    /** 同步 session prop */
    updateSession,
    save,
    saveAsTemplate,
    templateDialogVisible,
    templateList,
    templateListLoading,
    presetList,
    openTemplateDialog,
    fetchTemplateList,
    applyTemplate,
    renameTemplate,
    deleteTemplate,
    applyPreset,
    /** 外部直接替换答题卡内容（不落库、不改 dataSource） */
    applySheetData,
    syncExamNoIfEmpty
  };
}

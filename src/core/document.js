/**
 * 答题卡文档序列化：页面字段（form）+ 结构化题块（editorJson）之间的转换。
 *
 * 后端只存 form 的扁平字段 + 一个 editorJson 字符串，这里集中处理兼容性与容错，
 * 避免读档时把非法 JSON 抛到渲染层。
 */
import { computeSheetStats } from './questionModel';

/** editorJson 结构版本，便于后续平滑升级 */
export const EDITOR_DOC_VERSION = 1;

/**
 * 生成待保存的 editorJson 字符串
 * @param {Object} params
 * @param {Array<Object>} params.questionBlocks
 * @param {number} params.nextQuestionBlockId
 * @param {Object} params.form
 * @returns {string}
 */
export function createEditorDocument({ questionBlocks, nextQuestionBlockId, form }) {
  const doc = {
    version: EDITOR_DOC_VERSION,
    questionBlocks: JSON.parse(JSON.stringify(questionBlocks || [])),
    nextQuestionBlockId,
    fillType: form.fillType || 'admission',
    verticalLayout: !!form.verticalLayout,
    fillBlankMode: form.fillBlankMode || 'box',
    fillBlankShowScore: form.fillBlankShowScore !== false && form.fillBlankShowScore !== 0,
    questionCardMerge: !!form.questionCardMerge,
    /** 以下两项不落在后端答题卡主表，随 editorJson 一起存取，避免宿主改表结构 */
    examNo: form.examNo == null ? '' : String(form.examNo),
    qrcodeEnabled: isQrcodeEnabled(form.qrcodeEnabled) ? 1 : 0
  };
  return JSON.stringify(doc);
}

/** 二维码开关兼容 0/1、'0'/'1'、true/false，缺省视为开启 */
export function isQrcodeEnabled(value) {
  return !(value === 0 || value === false || value === '0' || value === 'false');
}

/**
 * 解析 editorJson，非法输入返回 null（调用方保持当前状态）
 * @param {string} jsonStr
 * @returns {Object|null}
 */
export function parseEditorDocument(jsonStr) {
  if (!jsonStr || typeof jsonStr !== 'string') return null;
  try {
    const doc = JSON.parse(jsonStr);
    return doc && typeof doc === 'object' ? doc : null;
  } catch (error) {
    return null;
  }
}

/**
 * 把 editorJson 文档合并进表单与题块（返回新对象，不直接改入参）
 * @param {Object} doc parseEditorDocument 的结果
 * @param {Object} form 当前表单
 * @param {number} nextQuestionBlockId 当前自增 id
 * @returns {{form:Object, questionBlocks:Array|null, nextQuestionBlockId:number}}
 */
export function applyEditorDocument(doc, form, nextQuestionBlockId) {
  const result = {
    form: { ...form },
    questionBlocks: null,
    nextQuestionBlockId: Math.max(1, Number(nextQuestionBlockId) || 1)
  };
  if (!doc || typeof doc !== 'object') return result;

  if (Array.isArray(doc.questionBlocks)) {
    result.questionBlocks = doc.questionBlocks;
  }
  const nextId = Number(doc.nextQuestionBlockId);
  if (Number.isFinite(nextId)) {
    result.nextQuestionBlockId = Math.max(result.nextQuestionBlockId, nextId);
  }
  if (doc.fillType) result.form.fillType = doc.fillType;
  if (typeof doc.verticalLayout === 'boolean') result.form.verticalLayout = doc.verticalLayout;
  if (doc.fillBlankMode) result.form.fillBlankMode = doc.fillBlankMode;
  if (typeof doc.fillBlankShowScore === 'boolean'
    || doc.fillBlankShowScore === 0
    || doc.fillBlankShowScore === 1) {
    result.form.fillBlankShowScore = doc.fillBlankShowScore !== false && doc.fillBlankShowScore !== 0;
  }
  if (typeof doc.questionCardMerge === 'boolean') {
    result.form.questionCardMerge = doc.questionCardMerge;
  }
  if (typeof doc.examNo === 'string') {
    result.form.examNo = doc.examNo;
  }
  if (doc.qrcodeEnabled != null) {
    result.form.qrcodeEnabled = isQrcodeEnabled(doc.qrcodeEnabled) ? 1 : 0;
  }
  return result;
}

/**
 * 组装保存请求体：表单扁平字段 + 由题块汇总的统计字段 + editorJson
 * @param {Object} form
 * @param {Array<Object>} blocks
 * @param {{ examId?: string|number, sheetName?: string }} [extra]
 */
export function buildSheetPayload(form, blocks, extra = {}) {
  const stats = computeSheetStats(blocks);
  // examNo 只随 editorJson 存取，不进后端答题卡主表的扁平字段
  const flatForm = { ...form };
  delete flatForm.examNo;
  return {
    ...flatForm,
    ...(extra.examId != null ? { examSessionId: extra.examId } : {}),
    ...(extra.sheetName ? { sheetName: extra.sheetName } : {}),
    choiceCount: stats.choiceCount,
    subjectiveCount: stats.subjectiveCount,
    questionCount: stats.questionCount,
    editorJson: createEditorDocument({
      questionBlocks: blocks,
      nextQuestionBlockId: extra.nextQuestionBlockId,
      form
    })
  };
}

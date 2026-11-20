/**
 * 纯逻辑入口（Node / SSR / 单元测试可用）。
 *
 * 主入口 `answer-sheet-designer` 会加载 Vue 组件与 element-ui，
 * 而 element-ui 2.x 在模块顶层就访问 `document`，因此在 Node 里 require 主入口会抛
 * `ReferenceError: document is not defined`。
 *
 * 这个入口只导出不依赖任何 DOM 的纯函数与常量，适合：
 *   - 后端 / BFF 生成答题卡数据（createSheetData → 落库）
 *   - 单元测试里校验题号、题量口径
 *   - SSR 环境预生成 editorJson
 *
 * ```js
 * import { createSheetData, validateQuestionNumbering } from 'answer-sheet-designer/core';
 * ```
 */

export { createEditorDocument, parseEditorDocument, buildSheetPayload } from './core/document.js';
export { createDefaultSheetForm } from './core/defaults.js';
export { DEFAULT_NOTICE } from './core/constants.js';
export {
  listPresetTemplates,
  getPresetTemplate,
  createPresetSnapshot
} from './core/presetTemplates.js';
export {
  createSheetData,
  withBlocks,
  validateQuestionNumbering,
  normalizeBlockType,
  SHEET_LAYOUTS,
  SHEET_FILL_TYPES
} from './core/sheetBuilder.js';
export {
  computeSheetStats,
  getDefaultSectionTitle,
  getQuestionTypeLabel
} from './core/questionModel.js';

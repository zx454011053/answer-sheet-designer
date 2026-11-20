/**
 * 数据源适配层。
 *
 * 答题卡设计器本身不关心后端形态，只依赖下面 8 个可选方法：
 *   loadSession({ examId })      → { name, examNo, paperId } | null
 *   loadSheet({ examId })        → 答题卡数据（含 layout 字段与 editorJson）| null
 *   saveSheet({ examId, payload }) → { id } | null
 *   listTemplates()              → [{ id, templateName, layoutType }]
 *   getTemplate({ id })          → 模板数据 | null
 *   saveTemplate({ payload })    → { id } | null
 *   renameTemplate({ id, templateName }) → { id } | null
 *   deleteTemplate({ id })       → { ok: true } | null
 *
 * 未实现的方法会被填充为「返回空」的安全实现，因此可以只传其中几个。
 */

/**
 * localStorage 数据源：开箱即用，适合独立运行 / demo / 离线试排
 * @param {{ storageKey?: string, storage?: Storage }} [options]
 */
export function createLocalDataSource(options = {}) {
  const storageKey = options.storageKey || 'answer-sheet-designer';
  const storage = options.storage || (typeof window !== 'undefined' ? window.localStorage : null);

  const emptyState = () => ({ sheets: {}, templates: [] });

  function readState() {
    if (!storage) return emptyState();
    try {
      const raw = storage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return emptyState();
      return {
        sheets: parsed.sheets && typeof parsed.sheets === 'object' ? parsed.sheets : {},
        templates: Array.isArray(parsed.templates) ? parsed.templates : []
      };
    } catch (error) {
      return emptyState();
    }
  }

  function writeState(state) {
    if (!storage) return;
    try {
      storage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      /* 超出配额时静默降级为内存态 */
    }
  }

  let seq = Date.now() % 100000;

  return {
    async loadSession({ examId } = {}) {
      if (!examId) return { name: '答题卡设计', examNo: 'S00000001', paperId: null };
      return {
        name: `考试 ${examId}`,
        examNo: `S${String(10000000 + Number(examId || 0)).padStart(8, '0')}`,
        paperId: null
      };
    },
    async loadSheet({ examId } = {}) {
      const state = readState();
      return state.sheets[String(examId)] || null;
    },
    async saveSheet({ examId, payload } = {}) {
      const state = readState();
      const id = payload && payload.id ? payload.id : (seq += 1);
      const saved = { ...(payload || {}), id, updatedAt: new Date().toISOString() };
      state.sheets[String(examId)] = saved;
      writeState(state);
      return { id };
    },
    async listTemplates() {
      const state = readState();
      return state.templates.map(({ id, templateName, layoutType }) => ({ id, templateName, layoutType }));
    },
    async getTemplate({ id } = {}) {
      const state = readState();
      return state.templates.find((item) => String(item.id) === String(id)) || null;
    },
    async saveTemplate({ payload } = {}) {
      const state = readState();
      const id = (seq += 1);
      state.templates.push({ ...(payload || {}), id, createdAt: new Date().toISOString() });
      writeState(state);
      return { id };
    },
    async renameTemplate({ id, templateName } = {}) {
      const state = readState();
      const target = state.templates.find((item) => String(item.id) === String(id));
      if (!target) return null;
      target.templateName = String(templateName == null ? '' : templateName);
      target.updatedAt = new Date().toISOString();
      writeState(state);
      return { id: target.id };
    },
    async deleteTemplate({ id } = {}) {
      const state = readState();
      const next = state.templates.filter((item) => String(item.id) !== String(id));
      if (next.length === state.templates.length) return null;
      state.templates = next;
      writeState(state);
      return { ok: true };
    }
  };
}

/**
 * HTTP 数据源：提供默认接口路径，可用 paths 整体覆盖。
 *
 * @param {Object} options
 * @param {(config: { url: string, method: string, data?: any, params?: any }) => Promise<any>} options.request
 *        宿主项目的请求函数（axios 实例等）。必须返回「已解包」的业务数据。
 * @param {{ session?: string, sheet?: string, saveSheet?: string, templates?: string, saveTemplate?: string }} [options.paths]
 *        路径模板，支持 :id 占位
 */
export function createHttpDataSource(options = {}) {
  const request = options.request;
  if (typeof request !== 'function') {
    throw new Error('[AnswerSheetDesigner] createHttpDataSource 需要传入 request 函数');
  }
  const paths = {
    session: '/exam/sessions/:id',
    sheet: '/exam/answer-sheets/session/:id',
    saveSheet: '/exam/answer-sheets',
    templates: '/exam/answer-sheet-templates',
    saveTemplate: '/exam/answer-sheet-templates',
    ...(options.paths || {})
  };
  const withId = (template, id) => template.replace(':id', String(id == null ? '' : id));

  return {
    async loadSession({ examId } = {}) {
      if (examId == null || examId === '') return null;
      return request({ url: withId(paths.session, examId), method: 'get' });
    },
    async loadSheet({ examId } = {}) {
      if (examId == null || examId === '') return null;
      return request({ url: withId(paths.sheet, examId), method: 'get' });
    },
    async saveSheet({ payload } = {}) {
      return request({ url: paths.saveSheet, method: 'post', data: payload });
    },
    async listTemplates() {
      const data = await request({
        url: paths.templates,
        method: 'get',
        params: { page: 1, size: 200 }
      });
      if (Array.isArray(data)) return data;
      return (data && data.list) || [];
    },
    async getTemplate({ id } = {}) {
      if (id == null || id === '') return null;
      return request({ url: withId(paths.templates, id), method: 'get' });
    },
    async saveTemplate({ payload } = {}) {
      return request({ url: paths.saveTemplate, method: 'post', data: payload });
    },
    async renameTemplate({ id, templateName } = {}) {
      if (id == null || id === '') return null;
      return request({
        url: withId(paths.templates, id),
        method: 'put',
        data: { templateName }
      });
    },
    async deleteTemplate({ id } = {}) {
      if (id == null || id === '') return null;
      return request({ url: withId(paths.templates, id), method: 'delete' });
    }
  };
}

const EMPTY = {};

/**
 * 补全数据源：缺失方法降级为安全空实现，避免设计器内部到处判空
 * @param {Object} [dataSource]
 */
export function normalizeDataSource(dataSource) {
  const ds = dataSource && typeof dataSource === 'object' ? dataSource : EMPTY;
  const pick = (name, fallback) => (typeof ds[name] === 'function' ? ds[name] : fallback);
  return {
    loadSession: pick('loadSession', async () => null),
    loadSheet: pick('loadSheet', async () => null),
    saveSheet: pick('saveSheet', async () => null),
    listTemplates: pick('listTemplates', async () => []),
    getTemplate: pick('getTemplate', async () => null),
    saveTemplate: pick('saveTemplate', async () => null),
    renameTemplate: pick('renameTemplate', async () => null),
    deleteTemplate: pick('deleteTemplate', async () => null)
  };
}

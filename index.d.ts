/**
 * answer-sheet-designer 类型声明。
 *
 * 主入口（组件 + 插件）只支持浏览器；纯数据场景用 `answer-sheet-designer/core`，
 * 两边共享同一套数据结构。
 */
import Vue from 'vue';

/* ---------------- 数据结构 ---------------- */

export type SheetLayout = 'A4' | 'A3' | '8K';

export type FillType = 'admission' | 'barcode' | 'short-number';

export type QuestionBlockType =
  | 'single'
  | 'multiple'
  | 'judge'
  | 'objective'
  | 'blank'
  | 'fillblank'
  | 'answer'
  | 'subjective'
  | 'english'
  | 'chinese'
  | 'composition';

/**
 * 简写题块（`content.blocks` 里写的形态）。
 * 客观题用 `from/to/score/options`，填空用 `lines/long`，解答用 `height`，
 * 英语/语文作文用 `no/lines/opening/words`。也接受内部题块（带 `segments`）。
 */
export interface QuestionBlockBrief {
  type: QuestionBlockType;
  /** 起始题号 */
  from?: number;
  /** 结束题号（含） */
  to?: number;
  /** 每题分值 */
  score?: number;
  /** 客观题选项数，默认 4 */
  options?: number;
  /** 客观题分几小题展示（横带分组） */
  items?: number;
  /** 填空/作文行数 */
  lines?: number;
  /** 填空是否长横线 */
  long?: boolean;
  /** 解答题作答区高度（px） */
  height?: number;
  /** 作文题号（仅用于题号统计） */
  no?: number;
  /** 英语作文开头语 */
  opening?: string;
  /** 语文作文字数要求 */
  words?: number;
  [key: string]: any;
}

/** 传入组件的简写内容配置 */
export interface ContentConfig {
  title?: string;
  examNo?: string;
  layout?: SheetLayout;
  layoutType?: SheetLayout;
  columns?: 2 | 3;
  a3ColumnCount?: 2 | 3;
  fillType?: FillType;
  qrcode?: boolean;
  qrcodeEnabled?: 0 | 1;
  notice?: string | string[];
  noticeText?: string;
  blocks?: QuestionBlockBrief[];
  /** 已序列化的文档；不传 blocks 时按原样还原（用于把保存报文直接回传） */
  editorJson?: string | Record<string, any>;
  /** 其余表单字段透传 */
  form?: Record<string, any>;
  /** 题号不连续时抛错而非警告 */
  strict?: boolean;
  id?: string | number;
  examSessionId?: string | number;
  paperId?: string | number;
  pageCount?: number;
  questionCount?: number;
  [key: string]: any;
}

/** 题量与分值统计 */
export interface SheetStats {
  choiceCount: number;
  fillBlankCount: number;
  answerCount: number;
  englishCount: number;
  chineseCount: number;
  subjectiveCount: number;
  /** 全卷合计分 */
  totalScore: number;
  questionCount: number;
}

/** 题号校验结果 */
export interface QuestionNumberingResult {
  ok: boolean;
  /** 重复出现的题号 */
  duplicates: number[];
  /** 断档区间 [上一题号, 下一题号] */
  gaps: Array<[number, number]>;
  /** 倒序或区间重叠的题块下标 */
  descents: number[];
}

/** 保存到后端的报文（主表扁平字段 + editorJson） */
export interface SheetPayload {
  id?: string | number;
  examSessionId?: string | number;
  paperId?: string | number;
  sheetName: string;
  layoutType: SheetLayout;
  a3ColumnCount: 2 | 3;
  fillType: FillType;
  pageCount: number;
  questionCount: number;
  choiceCount: number;
  subjectiveCount: number;
  noticeText: string;
  editorJson: string;
  [key: string]: any;
}

/** `createSheetData()` 的返回：保存报文的形状，可直接作为 `sheet` / `content` 入参 */
export interface SheetData extends SheetPayload {
  examNo: string;
  qrcodeEnabled: 0 | 1;
  /** 全卷合计分（createSheetData 计算并返回） */
  totalScore: number;
}

/* ---------------- 数据源 ---------------- */

export interface DataSource {
  loadSession?(params: { examId?: string | number | null }): Promise<any>;
  loadSheet?(params: { examId?: string | number | null }): Promise<any>;
  saveSheet?(params: { examId?: string | number | null; payload: SheetPayload }): Promise<any>;
  listTemplates?(): Promise<Array<{ id: string | number; templateName: string; layoutType?: SheetLayout }>>;
  getTemplate?(params: { id: string | number }): Promise<any>;
  saveTemplate?(params: { payload: Record<string, any> }): Promise<any>;
  renameTemplate?(params: { id: string | number; templateName: string }): Promise<any>;
  deleteTemplate?(params: { id: string | number }): Promise<any>;
}

export interface HttpDataSourceOptions {
  request(config: {
    url: string;
    method: string;
    data?: any;
    params?: any;
  }): Promise<any>;
  paths?: {
    session?: string;
    sheet?: string;
    saveSheet?: string;
    templates?: string;
    saveTemplate?: string;
  };
}

export function createLocalDataSource(options?: {
  storageKey?: string;
  storage?: Storage;
}): Required<DataSource>;

export function createHttpDataSource(options: HttpDataSourceOptions): Required<DataSource>;

export function normalizeDataSource(dataSource?: DataSource): Required<DataSource>;

/* ---------------- 纯函数 ---------------- */

export function createSheetData(config?: ContentConfig): SheetData;

export function withBlocks(sheet: SheetData | Record<string, any>, blocks: QuestionBlockBrief[]): Record<string, any>;

export function validateQuestionNumbering(
  blocks: Array<Record<string, any>>
): QuestionNumberingResult;

export function normalizeBlockType(type: string): string;

export const SHEET_LAYOUTS: SheetLayout[];
export const SHEET_FILL_TYPES: FillType[];

export function createEditorDocument(params: {
  questionBlocks: Array<Record<string, any>>;
  nextQuestionBlockId: number;
  form: Record<string, any>;
}): string;

export function parseEditorDocument(json: string | Record<string, any>): Record<string, any> | null;

export function buildSheetPayload(
  form: Record<string, any>,
  blocks: Array<Record<string, any>>,
  extra?: { nextQuestionBlockId?: number }
): SheetPayload;

export function createDefaultSheetForm(overrides?: Record<string, any>): Record<string, any>;

export const DEFAULT_NOTICE: string[];

export function computeSheetStats(blocks: Array<Record<string, any>>): SheetStats;

export function getDefaultSectionTitle(type: string): string;

export function getQuestionTypeLabel(type: string): string;

export interface PresetTemplate {
  id: string;
  name: string;
  summary?: string;
  layout?: SheetLayout;
  columns?: 2 | 3;
  blocks: Array<Record<string, any>>;
}

export function listPresetTemplates(): PresetTemplate[];

export function getPresetTemplate(id: string): PresetTemplate | null;

export function createPresetSnapshot(id: string): Record<string, any> | null;

/* ---------------- 组件 ---------------- */

export interface AnswerSheetDesignerProps {
  examId?: string | number | null;
  session?: { name?: string; examNo?: string; paperId?: string | number | null } | null;
  sheet?: Record<string, any> | null;
  content?: ContentConfig | null;
  dataSource?: DataSource | null;
  showHeader?: boolean;
  autoLoad?: boolean;
  pdfDpi?: number;
  pdfImageFormat?: 'JPEG' | 'PNG';
  pdfImageQuality?: number;
  /** 输出分页/度量调试日志，默认关闭 */
  debug?: boolean;
  /** 只读：隐藏配置面板与编辑入口，保留打印与导出 */
  readonly?: boolean;
}

/** 组件实例（通过 ref 或 mount() 拿到的 designer） */
export interface AnswerSheetDesignerInstance extends Vue {
  save(): Promise<string | number | null>;
  saveAsTemplate(name?: string): Promise<{ id: string | number } | null>;

  /** 无参 = 走浏览器下载；传 download:false 返回 Blob */
  exportPdf(): Promise<boolean>;
  exportPdf(options: { download: false; silent?: boolean }): Promise<Blob | null>;
  exportPdf(options?: { download?: boolean; silent?: boolean }): Promise<boolean | Blob | null>;

  /** 只取 Blob，不下载、不弹窗 */
  getPdfBlob(): Promise<Blob | null>;

  load(): Promise<void>;
  reload(): Promise<void>;

  getDocument(): string;
  getQuestionBlocks(): Array<Record<string, any>>;
  getForm(): Record<string, any>;
  getPreviewPages(): Array<Record<string, any>>;
  /** 实时题量与分值统计 */
  getStats(): SheetStats;

  setSheet(sheet: Record<string, any>): void;
  setContent(config: ContentConfig): void;
  /** 只接受内部题块（带 segments）；简写请用 withBlocks() */
  setQuestionBlocks(blocks: Array<Record<string, any>>): void;
  setForm(patch: Record<string, any>): void;
}

export const AnswerSheetDesigner: Vue.VueConstructor<AnswerSheetDesignerInstance> & {
  install(VueCtor: typeof Vue, options?: { componentName?: string }): void;
  mount(
    el: string | HTMLElement,
    options?: {
      propsData?: AnswerSheetDesignerProps;
      on?: Record<string, (...args: any[]) => void>;
    }
  ): {
    vm: Vue;
    designer: AnswerSheetDesignerInstance;
    destroy(): void;
  };
  registerElementComponents(VueCtor?: typeof Vue): void;
};

export function install(VueCtor: typeof Vue, options?: { componentName?: string }): void;

export function registerElementComponents(VueCtor?: typeof Vue): void;

export function mount(
  el: string | HTMLElement,
  options?: {
    propsData?: AnswerSheetDesignerProps;
    on?: Record<string, (...args: any[]) => void>;
  }
): {
  vm: Vue;
  designer: AnswerSheetDesignerInstance;
  destroy(): void;
};

export { Message, MessageBox } from 'element-ui';

export default AnswerSheetDesigner;

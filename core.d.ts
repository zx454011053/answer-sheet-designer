/**
 * `answer-sheet-designer/core` 类型声明。
 *
 * 与主入口的区别：不依赖 Vue / element-ui，可在 Node、SSR、单元测试里使用。
 */

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

/** 简写题块；也接受内部题块（带 segments 等字段） */
export interface QuestionBlockBrief {
  type: QuestionBlockType;
  from?: number;
  to?: number;
  score?: number;
  options?: number;
  items?: number;
  lines?: number;
  long?: boolean;
  height?: number;
  no?: number;
  opening?: string;
  words?: number;
  [key: string]: any;
}

/** `content` 的简写配置；也可以把保存报文原样传进来（带 editorJson） */
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
  editorJson?: string | Record<string, any>;
  form?: Record<string, any>;
  strict?: boolean;
  id?: string | number;
  examSessionId?: string | number;
  paperId?: string | number;
  pageCount?: number;
  questionCount?: number;
  [key: string]: any;
}

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

export interface QuestionNumberingResult {
  ok: boolean;
  duplicates: number[];
  gaps: Array<[number, number]>;
  descents: number[];
}

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

export interface SheetData extends SheetPayload {
  examNo: string;
  qrcodeEnabled: 0 | 1;
  /** 全卷合计分（createSheetData 计算并返回） */
  totalScore: number;
}

export interface PresetTemplate {
  id: string;
  name: string;
  summary?: string;
  layout?: SheetLayout;
  columns?: 2 | 3;
  blocks: Array<Record<string, any>>;
}

export function createSheetData(config?: ContentConfig): SheetData;

export function withBlocks(
  sheet: SheetData | Record<string, any>,
  blocks: QuestionBlockBrief[]
): Record<string, any>;

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

export function listPresetTemplates(): PresetTemplate[];

export function getPresetTemplate(id: string): PresetTemplate | null;

export function createPresetSnapshot(id: string): Record<string, any> | null;

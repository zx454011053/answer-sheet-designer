/** 答题卡编辑器默认值（表单、各类弹窗表单） */

/** 默认答题卡页面表单 */
export function createDefaultSheetForm(overrides = {}) {
  return {
    id: null,
    examSessionId: null,
    paperId: null,
    sheetName: '答题卡',
    /** 考试号：显示在答题卡顶部，同时作为二维码内容；留空则回落到考试信息 */
    examNo: '',
    layoutType: 'A4',
    /** A3 / 8K 答题区分栏（2/3），写入后端 meta */
    a3ColumnCount: 2,
    fillType: 'admission',
    pageCount: 1,
    questionCount: 0,
    choiceCount: 0,
    subjectiveCount: 0,
    verticalLayout: false,
    fillBlankMode: 'box',
    fillBlankShowScore: true,
    questionCardMerge: false,
    absentMarkEnabled: 1,
    barcodeEnabled: 0,
    qrcodeEnabled: 1,
    admissionCardEnabled: 1,
    studentInfoEnabled: 1,
    admissionColumns: 9,
    noticeText: '',
    ...overrides
  };
}

export function createObjectiveDialogForm(overrides = {}) {
  return {
    type: 'single',
    sectionNo: 1,
    sectionTitle: '单选题',
    count: 2,
    optionCount: 4,
    scorePerQuestion: 1,
    segments: [],
    editingBlockId: null,
    ...overrides
  };
}

export function createFillBlankDialogForm(overrides = {}) {
  return {
    sectionNo: 1,
    sectionTitle: '填空题',
    segments: [],
    editingBlockId: null,
    ...overrides
  };
}

export function createAnswerDialogForm(overrides = {}) {
  return {
    sectionNo: 1,
    sectionTitle: '解答题',
    segments: [],
    editingBlockId: null,
    ...overrides
  };
}

export function createEnglishDialogForm(overrides = {}) {
  return {
    sectionNo: 1,
    sectionTitle: '作文',
    showSectionTitle: true,
    questionNo: 1,
    scorePerQuestion: 25,
    lineCount: 10,
    openingText: '',
    insertEnabled: false,
    insertAfterSectionNo: null,
    editingBlockId: null,
    ...overrides
  };
}

export function createChineseDialogForm(overrides = {}) {
  return {
    sectionNo: 1,
    sectionTitle: '作文',
    questionNo: 1,
    scorePerQuestion: 60,
    minWordCount: 800,
    maxWordCount: 1000,
    insertEnabled: false,
    insertAfterSectionNo: null,
    editingBlockId: null,
    ...overrides
  };
}

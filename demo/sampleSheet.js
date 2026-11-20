/** demo 用示例答题卡：一份理综式结构（单选/多选/填空/解答/作文） */
export function createSampleSheet() {
  const blocks = [
    {
      id: 1,
      type: 'objective',
      sectionNo: 1,
      sectionTitle: '单选题',
      count: 10,
      optionCount: 4,
      scorePerQuestion: 3,
      segments: [{ objectiveType: 'single', startNum: 1, endNum: 10, scorePerQuestion: 3, optionCount: 4 }]
    },
    {
      id: 2,
      type: 'objective',
      sectionNo: 2,
      sectionTitle: '多选题',
      count: 5,
      optionCount: 5,
      scorePerQuestion: 4,
      segments: [{ objectiveType: 'multiple', startNum: 11, endNum: 15, scorePerQuestion: 4, optionCount: 5 }]
    },
    {
      id: 3,
      type: 'fillblank',
      sectionNo: 3,
      sectionTitle: '填空题',
      count: 5,
      optionCount: 0,
      scorePerQuestion: 0,
      segments: [{ fillBlankType: 'short', startNum: 16, endNum: 20, scorePerQuestion: 4, lineCount: 1 }]
    },
    {
      id: 4,
      type: 'answer',
      sectionNo: 4,
      sectionTitle: '解答题',
      count: 3,
      optionCount: 0,
      scorePerQuestion: 0,
      segments: [{ startNum: 21, endNum: 23, scorePerQuestion: 12, areaHeight: 180 }]
    },
    {
      id: 5,
      type: 'chinese',
      sectionNo: 5,
      sectionTitle: '作文',
      questionNo: 24,
      scorePerQuestion: 60,
      minWordCount: 800,
      maxWordCount: 1000
    }
  ];

  return {
    id: null,
    examSessionId: null,
    sheetName: '高二年级 期中联考-答题卡',
    layoutType: 'A4',
    a3ColumnCount: 2,
    fillType: 'admission',
    admissionColumns: 9,
    absentMarkEnabled: 1,
    barcodeEnabled: 0,
    qrcodeEnabled: 1,
    admissionCardEnabled: 1,
    studentInfoEnabled: 1,
    noticeText: '',
    editorJson: JSON.stringify({
      version: 1,
      questionBlocks: blocks,
      nextQuestionBlockId: 6,
      fillType: 'admission',
      verticalLayout: false,
      fillBlankMode: 'box',
      fillBlankShowScore: true,
      questionCardMerge: false
    })
  };
}

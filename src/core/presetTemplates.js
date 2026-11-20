/**
 * 内置科目答题卡模板。
 *
 * 只描述「结构」：版式 + 大题（题块）与题号区间 / 分值 / 作答区高度。
 * 不包含标题、考试号、学生信息填涂方式之外的表单状态，载入时由调用方决定保留哪些字段。
 *
 * 设计原则：
 * 1. 题号必须连续且不重叠（`verify:presets` 会逐模板校验）；
 * 2. 分值按常见试卷结构给出，同一科目内合计为该科常规总分；
 * 3. 作答区高度取「一栏内可容纳」的保守值，避免载入后立刻跨栏。
 *
 * 纯数据 + 纯函数，不依赖 Vue，也不依赖 DOM，可在脚本 / 单测中直接使用。
 */
import {
  getAnswerTotalScore,
  getFillBlankTotalScore
} from './questionModel';

const LAYOUT_LABELS = Object.freeze({
  A4: 'A4',
  A3: 'A3',
  '8K': '8K'
});

/* ------------------------------------------------------------------ *
 * 分段构造器：把模板定义写得尽量短，运行时再展开成完整题块
 * ------------------------------------------------------------------ */

/** 客观题分段 */
function obj(startNum, endNum, scorePerQuestion, objectiveType = 'single', optionCount = 4) {
  return { objectiveType, startNum, endNum, scorePerQuestion, optionCount };
}

/** 解答题分段 */
function ans(startNum, endNum, scorePerQuestion, areaHeight = 180) {
  return { startNum, endNum, scorePerQuestion, areaHeight };
}

/** 填空题分段（lineCount 为每题横线数；long 表示整段长横线作答） */
function blank(startNum, endNum, scorePerQuestion, lineCount = 1, fillBlankType = 'short') {
  return { fillBlankType, startNum, endNum, scorePerQuestion, lineCount };
}

/**
 * 内置模板定义
 *
 * blocks 中每项为「大题」，`segments` 描述其内部题号区间；
 * `type` 取值与设计器内部题块保持一致：objective / fillblank / answer / english / chinese。
 */
const PRESET_DEFINITIONS = [
  {
    id: 'chinese',
    name: '语文',
    tag: '高中 · 150 分',
    layoutType: 'A3',
    a3ColumnCount: 3,
    summary: '选择题 + 现代文/文言文/诗歌简答 + 默写 + 作文',
    blocks: [
      {
        type: 'objective',
        sectionTitle: '选择题',
        optionCount: 4,
        scorePerQuestion: 3,
        segments: [
          obj(1, 2, 3),
          obj(6, 7, 3),
          obj(10, 12, 3),
          obj(15, 15, 3),
          obj(18, 19, 3),
          obj(21, 21, 3)
        ]
      },
      {
        type: 'answer',
        sectionTitle: '现代文阅读',
        segments: [ans(3, 5, 4, 150), ans(8, 9, 6, 130)]
      },
      {
        type: 'answer',
        sectionTitle: '文言文阅读',
        segments: [ans(13, 14, 5, 120)]
      },
      {
        type: 'answer',
        sectionTitle: '古代诗歌阅读',
        segments: [ans(16, 16, 6, 110)]
      },
      {
        type: 'fillblank',
        sectionTitle: '名篇名句默写',
        segments: [blank(17, 17, 6, 3)]
      },
      {
        type: 'answer',
        sectionTitle: '语言文字运用',
        segments: [ans(20, 20, 5, 110), ans(22, 22, 6, 120)]
      },
      {
        type: 'chinese',
        sectionTitle: '写作',
        questionNo: 23,
        scorePerQuestion: 60,
        minWordCount: 800,
        maxWordCount: 1000
      }
    ]
  },
  {
    id: 'math',
    name: '数学',
    tag: '高中 · 150 分',
    layoutType: 'A4',
    a3ColumnCount: 2,
    summary: '单选 8 + 多选 4 + 填空 4 + 解答 6',
    blocks: [
      {
        type: 'objective',
        sectionTitle: '单项选择题',
        optionCount: 4,
        scorePerQuestion: 5,
        segments: [obj(1, 8, 5, 'single', 4)]
      },
      {
        type: 'objective',
        sectionTitle: '多项选择题',
        optionCount: 4,
        scorePerQuestion: 5,
        segments: [obj(9, 12, 5, 'multiple', 4)]
      },
      {
        type: 'fillblank',
        sectionTitle: '填空题',
        segments: [blank(13, 16, 5, 1)]
      },
      {
        type: 'answer',
        sectionTitle: '解答题',
        segments: [ans(17, 17, 10, 240), ans(18, 22, 12, 260)]
      }
    ]
  },
  {
    id: 'english',
    name: '英语',
    tag: '高中 · 150 分',
    layoutType: 'A4',
    a3ColumnCount: 2,
    summary: '听力 + 阅读 + 七选五 + 完形 + 语法填空 + 双作文',
    blocks: [
      {
        type: 'objective',
        sectionTitle: '听力理解',
        optionCount: 3,
        scorePerQuestion: 1.5,
        segments: [obj(1, 20, 1.5, 'single', 3)]
      },
      {
        type: 'objective',
        sectionTitle: '阅读理解',
        optionCount: 4,
        scorePerQuestion: 2.5,
        segments: [obj(21, 35, 2.5, 'single', 4)]
      },
      {
        type: 'objective',
        sectionTitle: '七选五',
        optionCount: 7,
        scorePerQuestion: 2.5,
        segments: [obj(36, 40, 2.5, 'single', 7)]
      },
      {
        type: 'objective',
        sectionTitle: '完形填空',
        optionCount: 4,
        scorePerQuestion: 1,
        segments: [obj(41, 55, 1, 'single', 4)]
      },
      {
        type: 'fillblank',
        sectionTitle: '语法填空',
        segments: [blank(56, 65, 1.5, 1)]
      },
      {
        type: 'english',
        sectionTitle: '应用文写作',
        questionNo: 66,
        scorePerQuestion: 15,
        lineCount: 8
      },
      {
        type: 'english',
        sectionTitle: '读后续写',
        questionNo: 67,
        scorePerQuestion: 25,
        lineCount: 15
      }
    ]
  },
  {
    id: 'physics',
    name: '物理',
    tag: '高中 · 100 分',
    layoutType: 'A4',
    a3ColumnCount: 2,
    summary: '单选 7 + 多选 3 + 实验 2 + 计算 3',
    blocks: [
      {
        type: 'objective',
        sectionTitle: '单项选择题',
        optionCount: 4,
        scorePerQuestion: 4,
        segments: [obj(1, 7, 4, 'single', 4)]
      },
      {
        type: 'objective',
        sectionTitle: '多项选择题',
        optionCount: 4,
        scorePerQuestion: 6,
        segments: [obj(8, 10, 6, 'multiple', 4)]
      },
      {
        type: 'answer',
        sectionTitle: '实验题',
        segments: [ans(11, 12, 9, 200)]
      },
      {
        type: 'answer',
        sectionTitle: '计算题',
        // 三道计算题合计必须落在「续页可用高度」内（约 991px − 标题 40px），
        // 否则第 3 题会被推到第 3 页、单独占一页。300×3 = 900，留 51px 余量。
        segments: [ans(13, 13, 10, 300), ans(14, 14, 12, 300), ans(15, 15, 14, 300)]
      }
    ]
  },
  {
    id: 'chemistry',
    name: '化学',
    tag: '高中 · 100 分',
    layoutType: 'A4',
    a3ColumnCount: 2,
    summary: '单选 14 + 填空 2 + 综合 3',
    blocks: [
      {
        type: 'objective',
        sectionTitle: '单项选择题',
        optionCount: 4,
        scorePerQuestion: 3,
        segments: [obj(1, 14, 3, 'single', 4)]
      },
      {
        type: 'fillblank',
        sectionTitle: '非选择题',
        segments: [blank(15, 15, 8, 4, 'long'), blank(16, 16, 10, 4, 'long')]
      },
      {
        type: 'answer',
        sectionTitle: '综合题',
        segments: [ans(17, 17, 12, 240), ans(18, 18, 14, 280), ans(19, 19, 14, 320)]
      }
    ]
  },
  {
    id: 'biology',
    name: '生物',
    tag: '高中 · 100 分',
    layoutType: 'A4',
    a3ColumnCount: 2,
    summary: '单选 15 + 填空 3 + 综合 2',
    blocks: [
      {
        type: 'objective',
        sectionTitle: '单项选择题',
        optionCount: 4,
        scorePerQuestion: 2,
        segments: [obj(1, 15, 2, 'single', 4)]
      },
      {
        type: 'fillblank',
        sectionTitle: '非选择题',
        segments: [blank(16, 16, 10, 4, 'long'), blank(17, 17, 12, 4, 'long'), blank(18, 18, 12, 4, 'long')]
      },
      {
        type: 'answer',
        sectionTitle: '综合题',
        segments: [ans(19, 19, 16, 300), ans(20, 20, 20, 340)]
      }
    ]
  },
  {
    id: 'politics',
    name: '政治',
    tag: '高中 · 100 分',
    layoutType: 'A4',
    a3ColumnCount: 2,
    summary: '单选 12 + 材料分析 4',
    blocks: [
      {
        type: 'objective',
        sectionTitle: '单项选择题',
        optionCount: 4,
        scorePerQuestion: 4,
        segments: [obj(1, 12, 4, 'single', 4)]
      },
      {
        type: 'answer',
        sectionTitle: '非选择题',
        segments: [ans(13, 13, 10, 220), ans(14, 14, 12, 260), ans(15, 15, 14, 300), ans(16, 16, 16, 320)]
      }
    ]
  },
  {
    id: 'history',
    name: '历史',
    tag: '高中 · 100 分',
    layoutType: 'A4',
    a3ColumnCount: 2,
    summary: '单选 16 + 材料题 3',
    blocks: [
      {
        type: 'objective',
        sectionTitle: '单项选择题',
        optionCount: 4,
        scorePerQuestion: 3,
        segments: [obj(1, 16, 3, 'single', 4)]
      },
      {
        type: 'answer',
        sectionTitle: '非选择题',
        segments: [ans(17, 17, 25, 420), ans(18, 18, 12, 240), ans(19, 19, 15, 300)]
      }
    ]
  },
  {
    id: 'geography',
    name: '地理',
    tag: '高中 · 100 分',
    layoutType: 'A4',
    a3ColumnCount: 2,
    summary: '单选 16 + 填空 2 + 综合 2',
    blocks: [
      {
        type: 'objective',
        sectionTitle: '单项选择题',
        optionCount: 4,
        scorePerQuestion: 3,
        segments: [obj(1, 16, 3, 'single', 4)]
      },
      {
        type: 'fillblank',
        sectionTitle: '非选择题',
        segments: [blank(17, 17, 10, 4, 'long'), blank(18, 18, 12, 4, 'long')]
      },
      {
        type: 'answer',
        sectionTitle: '综合题',
        segments: [ans(19, 19, 18, 320), ans(20, 20, 12, 260)]
      }
    ]
  },
  {
    id: 'quiz',
    name: '随堂小测',
    tag: '通用 · 50 分',
    layoutType: 'A4',
    a3ColumnCount: 2,
    summary: '单选 10 + 填空 5 + 解答 1，单页 A4',
    blocks: [
      {
        type: 'objective',
        sectionTitle: '单项选择题',
        optionCount: 4,
        scorePerQuestion: 2,
        segments: [obj(1, 10, 2, 'single', 4)]
      },
      {
        type: 'fillblank',
        sectionTitle: '填空题',
        segments: [blank(11, 15, 2, 1)]
      },
      {
        type: 'answer',
        sectionTitle: '解答题',
        segments: [ans(16, 16, 20, 240)]
      }
    ]
  },
  {
    id: 'full-types',
    name: '综合示例',
    tag: '通用 · 全题型',
    layoutType: 'A4',
    a3ColumnCount: 2,
    summary: '五类题型齐全，用于快速了解各题型排布',
    blocks: [
      {
        type: 'objective',
        sectionTitle: '单项选择题',
        optionCount: 4,
        scorePerQuestion: 2,
        segments: [obj(1, 10, 2, 'single', 4)]
      },
      {
        type: 'objective',
        sectionTitle: '多项选择题',
        optionCount: 4,
        scorePerQuestion: 4,
        segments: [obj(11, 15, 4, 'multiple', 4)]
      },
      {
        type: 'objective',
        sectionTitle: '判断题',
        optionCount: 2,
        scorePerQuestion: 2,
        segments: [obj(16, 20, 2, 'judge', 2)]
      },
      {
        type: 'fillblank',
        sectionTitle: '填空题',
        segments: [blank(21, 25, 2, 1)]
      },
      {
        type: 'answer',
        sectionTitle: '解答题',
        segments: [ans(26, 28, 10, 220)]
      },
      {
        type: 'english',
        sectionTitle: '英语作文',
        questionNo: 29,
        scorePerQuestion: 25,
        lineCount: 10
      },
      {
        type: 'chinese',
        sectionTitle: '语文作文',
        questionNo: 30,
        scorePerQuestion: 35,
        minWordCount: 600,
        maxWordCount: 800
      }
    ]
  }
];

/* ------------------------------------------------------------------ *
 * 展开与派生
 * ------------------------------------------------------------------ */

/** 客观题题量：按分段区间求和 */
function countObjectiveSegments(segments) {
  return (segments || []).reduce((sum, seg) => {
    const start = Math.max(1, Number(seg.startNum) || 1);
    const end = Math.max(start, Number(seg.endNum) || start);
    return sum + (end - start + 1);
  }, 0);
}

/** 题块总分 */
function getBlockTotalScore(block) {
  if (block.type === 'fillblank') return getFillBlankTotalScore(block);
  if (block.type === 'answer') return getAnswerTotalScore(block);
  if (block.type === 'english' || block.type === 'chinese') {
    return Math.max(0.5, Number(block.scorePerQuestion) || 1);
  }
  return (block.segments || []).reduce((sum, seg) => {
    const start = Math.max(1, Number(seg.startNum) || 1);
    const end = Math.max(start, Number(seg.endNum) || start);
    return sum + (end - start + 1) * (Number(seg.scorePerQuestion) || 0);
  }, 0);
}

/** 题块小题数（按题号区间计，与卡片上「N 题」的直觉一致；不按填空题空数放大） */
function getBlockQuestionCount(block) {
  if (block.type === 'english' || block.type === 'chinese') return 1;
  if (block.type === 'fillblank') {
    return (block.segments || []).reduce((sum, seg) => {
      const start = Math.max(1, Number(seg.startNum) || 1);
      const end = Math.max(start, Number(seg.endNum) || start);
      return sum + (end - start + 1);
    }, 0);
  }
  if (block.type === 'answer') {
    return (block.segments || []).reduce((sum, seg) => {
      const start = Math.max(1, Number(seg.startNum) || 1);
      const end = Math.max(start, Number(seg.endNum) || start);
      return sum + (end - start + 1);
    }, 0);
  }
  return countObjectiveSegments(block.segments);
}

/** 版式标签：A3 / 8K 补充分栏数 */
function buildLayoutLabel(layoutType, columnCount) {
  const base = LAYOUT_LABELS[layoutType] || 'A4';
  if (base === 'A4') return 'A4 单栏';
  return `${base} ${Number(columnCount) === 3 ? '三栏' : '两栏'}`;
}

/** 把定义展开成可渲染的题块（补 id / sectionNo / 顶层冗余字段） */
function buildBlocks(definitions) {
  return definitions.map((block, index) => {
    const base = {
      id: index + 1,
      type: block.type,
      sectionNo: index + 1,
      sectionTitle: block.sectionTitle
    };
    if (block.type === 'objective') {
      const segments = (block.segments || []).map((seg) => ({ ...seg }));
      return {
        ...base,
        count: countObjectiveSegments(segments),
        optionCount: Math.max(2, Number(block.optionCount) || 4),
        scorePerQuestion: Number(block.scorePerQuestion) || 0,
        segments
      };
    }
    if (block.type === 'fillblank') {
      return {
        ...base,
        count: 0,
        optionCount: 0,
        scorePerQuestion: 0,
        segments: (block.segments || []).map((seg) => ({ ...seg }))
      };
    }
    if (block.type === 'answer') {
      return {
        ...base,
        count: 0,
        optionCount: 0,
        scorePerQuestion: 0,
        segments: (block.segments || []).map((seg) => ({ ...seg }))
      };
    }
    if (block.type === 'english') {
      return {
        ...base,
        showSectionTitle: true,
        questionNo: Math.max(1, Number(block.questionNo) || 1),
        scorePerQuestion: Number(block.scorePerQuestion) || 5,
        lineCount: Math.max(3, Number(block.lineCount) || 10),
        openingText: block.openingText || ''
      };
    }
    return {
      ...base,
      questionNo: Math.max(1, Number(block.questionNo) || 1),
      scorePerQuestion: Number(block.scorePerQuestion) || 60,
      minWordCount: Math.max(50, Number(block.minWordCount) || 800),
      maxWordCount: Math.max(100, Number(block.maxWordCount) || 1000)
    };
  });
}

/** 模板缩略指标 */
function buildMetrics(blocks) {
  const totalScore = blocks.reduce((sum, block) => sum + getBlockTotalScore(block), 0);
  const questionCount = blocks.reduce((sum, block) => sum + getBlockQuestionCount(block), 0);
  return {
    totalScore: Math.round(totalScore * 10) / 10,
    questionCount,
    blockCount: blocks.length
  };
}

/** 对外的模板列表（预计算，避免每次渲染重复展开） */
const PRESETS = PRESET_DEFINITIONS.map((definition) => {
  const blocks = buildBlocks(definition.blocks);
  const metrics = buildMetrics(blocks);
  return {
    id: `preset-${definition.id}`,
    name: definition.name,
    tag: definition.tag,
    summary: definition.summary,
    layoutType: definition.layoutType || 'A4',
    a3ColumnCount: Number(definition.a3ColumnCount) === 3 ? 3 : 2,
    fillType: definition.fillType || 'admission',
    admissionColumns: Number(definition.admissionColumns) || 9,
    layoutLabel: buildLayoutLabel(definition.layoutType || 'A4', definition.a3ColumnCount),
    totalScore: metrics.totalScore,
    questionCount: metrics.questionCount,
    blockCount: metrics.blockCount,
    blocks
  };
});

/** 全部内置模板（只读，调用方请勿原地修改 blocks） */
export function listPresetTemplates() {
  return PRESETS;
}

/**
 * 按 id 取内置模板
 * @param {string} id 形如 `preset-math`
 */
export function getPresetTemplate(id) {
  if (!id) return null;
  return PRESETS.find((item) => item.id === id || item.id === `preset-${id}`) || null;
}

/**
 * 生成可直接落库 / 应用的模板快照（题块为深拷贝，可安全交给设计器）
 * @param {string} id
 * @returns {{ layoutType:string, a3ColumnCount:number, fillType:string, admissionColumns:number, blocks:Array<Object>, nextQuestionBlockId:number }|null}
 */
export function createPresetSnapshot(id) {
  const preset = getPresetTemplate(id);
  if (!preset) return null;
  const blocks = JSON.parse(JSON.stringify(preset.blocks));
  return {
    layoutType: preset.layoutType,
    a3ColumnCount: preset.a3ColumnCount,
    fillType: preset.fillType,
    admissionColumns: preset.admissionColumns,
    blocks,
    nextQuestionBlockId: blocks.length + 1
  };
}

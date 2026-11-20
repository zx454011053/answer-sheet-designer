/** 答题卡预览：总分展示（整数无小数，否则一位小数） */
export function formatAnswerSheetScore(value) {
  const num = Number(value) || 0;
  return num % 1 === 0 ? String(num) : num.toFixed(1);
}

/** 大题序号中文（一、二、…；两位数组合规则与编辑器一致） */
export function formatChineseSectionNo(value) {
  const num = Math.max(1, Number(value) || 1);
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (num < 10) return digits[num];
  if (num < 20) return `十${num % 10 === 0 ? '' : digits[num % 10]}`;
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return `${digits[tens]}十${ones === 0 ? '' : digits[ones]}`;
  }
  return String(num);
}

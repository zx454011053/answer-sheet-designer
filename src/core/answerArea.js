/**
 * 解答题作答区高度调整：把某道题的 areaHeight 拆分成独立分段，保持相邻题号的分段结构。
 */
import { createTempId, normalizeAnswerBlock } from './questionModel';

/**
 * 仅修改指定题号的作答区高度，其余题号的分段结构保持不变。
 *
 * @param {Object} block 解答题题块
 * @param {number} questionNum 目标题号
 * @param {number} height 目标高度（px）
 * @param {{ min?: number, max?: number, fallbackSectionNo?: number }} [options]
 * @returns {Object|null} 新的题块（无变化时返回 null）
 */
export function withAnswerAreaHeight(block, questionNum, height, options = {}) {
  const min = Number(options.min) || 80;
  const max = Number(options.max) || Number.MAX_SAFE_INTEGER;
  const normalizedHeight = Math.min(max, Math.max(min, Math.round(Number(height) || min)));
  const normalized = normalizeAnswerBlock(block, options.fallbackSectionNo || 1, { maxAreaHeight: max });

  const segments = [];
  let changed = false;

  normalized.segments.forEach((segment) => {
    if (questionNum < segment.startNum || questionNum > segment.endNum) {
      segments.push({ ...segment });
      return;
    }
    const isSingleTarget = segment.startNum === questionNum
      && segment.endNum === questionNum
      && Number(segment.areaHeight) === normalizedHeight;
    if (isSingleTarget) {
      segments.push({ ...segment });
      return;
    }
    changed = true;
    if (segment.startNum < questionNum) {
      segments.push({ ...segment, tempId: createTempId(), endNum: questionNum - 1 });
    }
    segments.push({
      ...segment,
      tempId: createTempId(),
      startNum: questionNum,
      endNum: questionNum,
      areaHeight: normalizedHeight
    });
    if (segment.endNum > questionNum) {
      segments.push({ ...segment, tempId: createTempId(), startNum: questionNum + 1 });
    }
  });

  return changed ? { ...normalized, segments } : null;
}

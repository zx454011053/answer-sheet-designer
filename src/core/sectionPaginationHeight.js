import {
  estimateObjectiveBandSliceHeightPx
} from './pagination/objectivePagination';
import { getAnswerSectionPaginationBodyHeightPx } from './pagination/answerPagination';
import { getEnglishSectionPaginationBodyHeightPx } from './pagination/englishPagination';
import { getChineseSectionPaginationBodyHeightPx } from './pagination/chinesePagination';
import { getFillBlankSectionPaginationBodyHeightPx } from './pagination/fillBlankPagination';
import { SUBJECTIVE_SECTION_HEADER_PX } from './constants';

/** 单页 section 竖向占位（px）：按题型委托各题型组件内公式，与 splitA3Multicol / previewPages 一致 */
export function resolveSectionPaginationBodyHeightPx(section) {
  const sec = section;
  const t = sec.type;
  if (t === 'single' || t === 'multiple' || t === 'judge' || t === 'objective') {
    const rawIdx = Number(sec.objectiveBandSliceIndex);
    const bandIdx = Number.isFinite(rawIdx)
      ? rawIdx
      : (sec.isContinuation ? 1 : 0);
    return estimateObjectiveBandSliceHeightPx(sec, bandIdx);
  }
  if (t === 'answer') {
    return getAnswerSectionPaginationBodyHeightPx(sec);
  }
  if (t === 'english') {
    return getEnglishSectionPaginationBodyHeightPx(sec);
  }
  if (t === 'chinese') {
    return getChineseSectionPaginationBodyHeightPx(sec);
  }
  if (t === 'fillblank') {
    return getFillBlankSectionPaginationBodyHeightPx(sec);
  }
  return SUBJECTIVE_SECTION_HEADER_PX * 4;
}

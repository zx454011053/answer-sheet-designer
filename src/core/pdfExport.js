/**
 * 与预览 .sheet-preview 物理尺寸一致（mm），用于 jsPDF 页面与整页贴图。
 * A4：210×297；A3 横：420×297；8K 横：390×270。
 * @param {string} [layout]
 * @returns {{ formatMm: number[], orientation: string }}
 */
export function getAnswerSheetPdfPageSpec(layout) {
  const l = layout || 'A4';
  if (l === 'A3') {
    return { formatMm: [420, 297], orientation: 'landscape' };
  }
  if (l === '8K') {
    return { formatMm: [390, 270], orientation: 'landscape' };
  }
  return { formatMm: [210, 297], orientation: 'portrait' };
}

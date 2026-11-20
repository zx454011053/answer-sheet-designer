/**
 * 答题卡 PDF 导出：逐页 html2canvas 截图 → jsPDF 贴图。
 *
 * 两个能力：
 * - `exportPdf()`：走浏览器下载，返回 `Promise<boolean>`；
 * - `exportPdf({ download: false })`：返回 `Promise<Blob | null>`，不触发下载，供宿主上传后端或批量合并。
 *
 * html2canvas / jsPDF 改为按需动态 import：
 * 这两个库约占产物 1MB（gzip 266KB），只有点「导出 PDF」时才需要，
 * 放在首屏会拖慢只是来查看/排版的使用者。
 */
import { ref } from 'vue';
import { getAnswerSheetPdfPageSpec } from '@/core/pdfExport';

/**
 * 模块级缓存的依赖 Promise：多个设计器实例共享一次加载。
 * 失败时清空缓存，允许用户重试（例如网络断开）。
 */
let pdfDepsPromise = null;

function loadPdfDeps() {
  if (!pdfDepsPromise) {
    pdfDepsPromise = Promise.all([
      import('html2canvas'),
      import('jspdf')
    ])
      .then(([html2canvasModule, jspdfModule]) => ({
        // html2canvas 是 default export，jspdf 是 named export
        html2canvas: html2canvasModule.default || html2canvasModule,
        jsPDF: jspdfModule.jsPDF || jspdfModule.default
      }))
      .catch((error) => {
        pdfDepsPromise = null;
        throw error;
      });
  }
  return pdfDepsPromise;
}

/**
 * @param {Object} params
 * @param {() => (HTMLElement|null)} params.getRootEl 组件根节点（加 is-exporting-pdf 类）
 * @param {() => (HTMLElement|null)} params.getExportRoot 待导出的容器（内含 .sheet-preview）
 * @param {() => string} params.getLayoutType
 * @param {() => string} params.getFileName
 * @param {{ success: Function, error: Function }} params.message
 * @param {() => ({ dpi?: number, imageFormat?: 'JPEG'|'PNG', imageQuality?: number })} [params.getOptions]
 *        导出参数：dpi 决定栅格化分辨率（默认 200，约等于印刷可用精度），imageFormat 默认 JPEG 以控制体积
 */
export function usePdfExport({
  getRootEl,
  getExportRoot,
  getLayoutType,
  getFileName,
  message,
  getOptions = () => ({})
}) {
  const downloading = ref(false);
  const dialogVisible = ref(false);
  const progress = ref(0);

  function onDialogClosed() {
    progress.value = 0;
  }

  const nextFrame = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  /**
   * 依据目标 DPI 与页面 CSS 宽度换算栅格倍率。
   * 旧实现固定 scale 3~4，A4 单页截图可达 3000+ px、PNG 单页 20MB+；
   * 这里按 200DPI 反推（A4 约 1654px 宽），并限制在 [1.5, 4] 之间。
   */
  function resolveScale(pageWidthMm, cssWidthPx, options) {
    const dpi = Math.min(400, Math.max(96, Number(options.dpi) || 200));
    const targetPx = (Number(pageWidthMm) / 25.4) * dpi;
    const cssWidth = Number(cssWidthPx) || 0;
    if (!cssWidth) return 2;
    return Math.min(4, Math.max(1.5, targetPx / cssWidth));
  }

  /**
   * 生成 PDF。
   *
   * @param {{ download?: boolean, silent?: boolean }} [options]
   *        download=false 时返回 Blob（不触发下载）；silent=true 时不弹进度框、不提示结果
   * @returns {Promise<boolean | Blob | null>} 下载模式返回是否成功；Blob 模式返回 PDF 或 null
   */
  async function exportPdf(options = {}) {
    const download = options.download !== false;
    const silent = options.silent === true;

    if (downloading.value) return download ? false : null;

    const target = getExportRoot();
    if (!target || !target.querySelector('.sheet-preview')) {
      if (!silent) message.error('暂无可导出的答题卡内容');
      return download ? false : null;
    }

    const rootEl = getRootEl();
    downloading.value = true;
    progress.value = 0;
    if (!silent) dialogVisible.value = true;
    await nextFrame();

    if (rootEl) rootEl.classList.add('is-exporting-pdf');
    await nextFrame();

    const sheets = Array.from(target.querySelectorAll('.sheet-preview'));
    const pageSpec = getAnswerSheetPdfPageSpec(getLayoutType());
    const [pageWmm, pageHmm] = pageSpec.formatMm;
    const exportOptions = getOptions() || {};
    const imageFormat = exportOptions.imageFormat === 'PNG' ? 'PNG' : 'JPEG';
    const imageQuality = imageFormat === 'JPEG'
      ? Math.min(1, Math.max(0.7, Number(exportOptions.imageQuality) || 0.92))
      : 1;
    const firstWidth = sheets.length ? sheets[0].getBoundingClientRect().width : 0;
    const exportScale = resolveScale(pageWmm, firstWidth, exportOptions);
    const rawName = String(getFileName() || '答题卡').replace(/[\\/:*?"<>|]/g, '-');
    const filename = `${rawName || '答题卡'}.pdf`;

    const h2cOptions = {
      scale: exportScale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      letterRendering: true,
      allowTaint: false,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 15000
    };

    const total = sheets.length;
    try {
      const { html2canvas, jsPDF } = await loadPdfDeps();

      const pdf = new jsPDF({
        unit: 'mm',
        format: pageSpec.formatMm,
        orientation: pageSpec.orientation
      });

      for (let i = 0; i < sheets.length; i += 1) {
        if (i > 0) pdf.addPage(pageSpec.formatMm, pageSpec.orientation);
        progress.value = Math.round((i / Math.max(1, total)) * 99);
        const canvas = await html2canvas(sheets[i], h2cOptions);
        pdf.addImage(
          canvas.toDataURL(imageFormat === 'PNG' ? 'image/png' : 'image/jpeg', imageQuality),
          imageFormat,
          0,
          0,
          pageWmm,
          pageHmm
        );
        progress.value = Math.round(((i + 1) / total) * 100);
      }

      if (!download) {
        return pdf.output('blob');
      }

      pdf.save(filename);
      if (!silent) {
        message.success('PDF 已下载');
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      return true;
    } catch (error) {
      if (!silent) message.error('PDF 生成失败，请稍后重试');
      return download ? false : null;
    } finally {
      if (rootEl) rootEl.classList.remove('is-exporting-pdf');
      downloading.value = false;
      dialogVisible.value = false;
    }
  }

  /** 只要 Blob，不下载、不弹窗；批量生成用 */
  const buildPdfBlob = () => exportPdf({ download: false, silent: true });

  return {
    pdfDownloading: downloading,
    pdfExportDialogVisible: dialogVisible,
    pdfExportProgress: progress,
    onPdfExportDialogClosed: onDialogClosed,
    handleDownloadPdf: exportPdf,
    buildPdfBlob
  };
}

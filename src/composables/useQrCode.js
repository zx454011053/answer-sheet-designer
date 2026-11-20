/** 考试编号二维码：内容变化时重算 dataURL */
import { ref, watch } from 'vue';
import QRCode from 'qrcode';

/**
 * @param {() => string} getContent
 */
export function useQrCode(getContent) {
  const qrCodeDataUrl = ref('');

  async function render() {
    const content = getContent() || '';
    if (!content) {
      qrCodeDataUrl.value = '';
      return;
    }
    try {
      qrCodeDataUrl.value = await QRCode.toDataURL(content, {
        width: 64,
        margin: 0,
        errorCorrectionLevel: 'M'
      });
    } catch (error) {
      qrCodeDataUrl.value = '';
    }
  }

  watch(getContent, render, { immediate: true });

  return { qrCodeDataUrl, render };
}

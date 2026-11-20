/**
 * 预览区交互：按住拖拽平移（A3/8K 横向纸张 / A4 内容超出时）、解答题作答区下沿拖拽调高。
 *
 * 原实现直接写在 AnswerSheetEditor 组件里并监听 window，被抽成组合式函数后
 * 统一在 onBeforeUnmount 中回收监听与 rAF，避免组件销毁后残留。
 */
import { onBeforeUnmount, ref } from 'vue';

/** 命中判定：这些元素上的按下不触发平移 */
const PAN_EXCLUDED_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  'label',
  '[contenteditable="true"]',
  '.block-actions',
  '.admission-edit-trigger',
  '.notice-edit-trigger',
  '.el-slider',
  '.el-switch',
  '.el-radio',
  '.el-checkbox'
].join(',');

/** 解答题框底部用于拖拽调高的命中带（px） */
const RESIZE_HIT_STRIP_PX = 18;

/**
 * @param {Object} params
 * @param {() => (HTMLElement|null)} params.getScrollEl 预览滚动容器
 * @param {() => (HTMLElement|null)} params.getRootEl 组件根节点（用于定位页序号）
 * @param {(blockId:any, questionNum:number, height:number, limits:{min:number,max:number}) => void} params.onResizeCommit
 * @param {(pageIndex:number) => number} params.getMaxAnswerAreaHeight
 * @param {() => number} [params.getMinAnswerAreaHeight]
 */
export function usePreviewInteraction({
  getScrollEl,
  getRootEl,
  onResizeCommit,
  getMaxAnswerAreaHeight,
  getMinAnswerAreaHeight = () => 80
}) {
  const panDragging = ref(false);
  const answerResizing = ref(null);

  let pan = null;
  let resizeRafId = null;
  let resizePendingEvent = null;

  /* ---------------- 平移 ---------------- */

  function isPanExcludedTarget(target, clientY) {
    if (!(target instanceof Element)) return true;
    if (target.closest(PAN_EXCLUDED_SELECTOR)) return true;
    const answerItem = target.closest('.answer-render-item');
    if (answerItem && typeof clientY === 'number') {
      const rect = answerItem.getBoundingClientRect();
      if (clientY >= rect.bottom - RESIZE_HIT_STRIP_PX) return true;
    }
    return false;
  }

  function onPanMouseDown(event) {
    if (!event || event.button !== 0) return;
    if (answerResizing.value) return;
    if (isPanExcludedTarget(event.target, event.clientY)) return;
    const el = getScrollEl();
    if (!el) return;
    pan = {
      el,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      startClientX: event.clientX,
      startClientY: event.clientY,
      dragging: false
    };
    window.addEventListener('mousemove', onPanMouseMove);
    window.addEventListener('mouseup', onPanMouseEnd);
  }

  function onPanMouseMove(event) {
    if (!pan || !event) return;
    const totalDx = event.clientX - pan.startClientX;
    const totalDy = event.clientY - pan.startClientY;
    if (!pan.dragging) {
      if (Math.abs(totalDx) < 4 && Math.abs(totalDy) < 4) return;
      pan.dragging = true;
      panDragging.value = true;
      document.body.style.userSelect = 'none';
    }
    pan.el.scrollLeft -= event.clientX - pan.lastClientX;
    pan.el.scrollTop -= event.clientY - pan.lastClientY;
    pan.lastClientX = event.clientX;
    pan.lastClientY = event.clientY;
    event.preventDefault();
  }

  function onPanMouseEnd() {
    panDragging.value = false;
    document.body.style.userSelect = '';
    pan = null;
    window.removeEventListener('mousemove', onPanMouseMove);
    window.removeEventListener('mouseup', onPanMouseEnd);
  }

  function teardownPan() {
    window.removeEventListener('mousemove', onPanMouseMove);
    window.removeEventListener('mouseup', onPanMouseEnd);
    panDragging.value = false;
    pan = null;
    document.body.style.userSelect = '';
  }

  /* ---------------- 作答区调高 ---------------- */

  function startAnswerAreaResize(event, blockId, questionNum) {
    if (!event || event.button !== 0) return;
    event.preventDefault();
    // 子组件 $emit 时 currentTarget 往往已为 null，用 target + closest 定位整框
    const container = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('.answer-render-item')
      : null;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (event.clientY < rect.bottom - RESIZE_HIT_STRIP_PX) return;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    const pageEl = container.closest('.sheet-preview');
    const root = getRootEl();
    const pageNodes = root ? Array.from(root.querySelectorAll('.sheet-preview')) : [];
    const pageIndex = pageEl ? Math.max(0, pageNodes.indexOf(pageEl)) : 0;
    const maxHeight = getMaxAnswerAreaHeight(pageIndex);

    answerResizing.value = {
      blockId,
      questionNum,
      startY: event.clientY,
      startHeight: container.offsetHeight,
      lastAppliedHeight: container.offsetHeight,
      containerEl: container,
      pageIndex,
      maxHeight
    };
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(event) {
    if (!answerResizing.value || !event) return;
    event.preventDefault();
    resizePendingEvent = event;
    if (resizeRafId) return;
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null;
      const state = answerResizing.value;
      if (!state || !resizePendingEvent) return;
      const latest = resizePendingEvent;
      resizePendingEvent = null;
      const delta = latest.clientY - state.startY;
      const max = state.maxHeight || getMaxAnswerAreaHeight(state.pageIndex);
      const nextHeight = Math.min(max, Math.max(getMinAnswerAreaHeight(), state.startHeight + delta));
      const rounded = Math.round(nextHeight);
      if (Math.abs(rounded - state.lastAppliedHeight) < 2) return;
      state.lastAppliedHeight = rounded;
      if (state.containerEl) state.containerEl.style.height = `${rounded}px`;
    });
  }

  function onResizeEnd() {
    const state = answerResizing.value;
    if (!state) return;
    const max = state.maxHeight || getMaxAnswerAreaHeight(state.pageIndex);
    const finalHeight = Math.min(
      max,
      Math.max(getMinAnswerAreaHeight(), Math.round(state.lastAppliedHeight || state.startHeight || 180))
    );
    if (state.containerEl) state.containerEl.style.height = '';
    answerResizing.value = null;
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
    if (resizeRafId) {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = null;
    }
    resizePendingEvent = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    onResizeCommit(state.blockId, state.questionNum, finalHeight, {
      min: getMinAnswerAreaHeight(),
      max
    });
  }

  onBeforeUnmount(() => {
    teardownPan();
    onResizeEnd();
  });

  return {
    panDragging,
    answerResizing,
    onPanMouseDown,
    startAnswerAreaResize,
    teardownPan
  };
}

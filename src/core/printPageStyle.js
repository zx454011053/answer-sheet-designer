/**
 * 打印纸张尺寸（`@page`）的多实例管理。
 *
 * 背景：`@page { size: A4; margin: 0 }` 是**全局规则**，浏览器里同时只允许一条生效。
 * 早期实现把规则写在固定的 `<style id="answer-sheet-print-page-size">` 里：
 * 同页挂两个不同版式的设计器时互相覆盖，且其中一个卸载会把另一个需要的样式一起删掉。
 *
 * 这里改成「实例注册表」：
 * - 每个实例注册时拿到一个 uid，规则内容由该实例提供；
 * - 谁最近被操作（鼠标按下 / 版式变化）谁成为 active，规则写成 active 的尺寸；
 * - 实例卸载只移除自己的登记，若自己是 active 则回落到最后一个仍存活的实例；
 * - 打印前（beforeprint）把 active 的尺寸再写一次，避免浏览器缓存的旧规则。
 *
 * 局限：同时打印两个不同版式的设计器在物理上不可能（一次打印只有一个纸张尺寸），
 * 这里保证的是「以最后操作的那个为准」，而不是两个都正确。
 */

const STYLE_ID = 'answer-sheet-print-page-size';
const FALLBACK_SIZE = '210mm 297mm';

let seq = 0;
let activeId = null;
let printListenerBound = false;

/** @type {Map<number, { getSize: () => string }>} */
const registry = new Map();

function getStyleEl() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  return el;
}

function writeRule(uid) {
  const entry = registry.get(uid);
  if (!entry) return;
  const el = getStyleEl();
  if (!el) return;
  const size = entry.getSize() || FALLBACK_SIZE;
  el.textContent = `@page { size: ${size}; margin: 0; }`;
  activeId = uid;
}

function bindPrintListener() {
  if (printListenerBound || typeof window === 'undefined') return;
  printListenerBound = true;
  // 打印对话框打开前重写一次：保证用的是当前 active 实例的最新版式
  window.addEventListener('beforeprint', () => {
    if (activeId != null && registry.has(activeId)) writeRule(activeId);
  });
}

/**
 * 注册一个设计器实例
 * @param {() => string} getSize 返回 `@page size` 的值，如 `'210mm 297mm'`
 * @returns {number} uid
 */
export function registerPrintPage(getSize) {
  const uid = (seq += 1);
  registry.set(uid, { getSize });
  bindPrintListener();
  writeRule(uid);
  return uid;
}

/** 版式变化时调用：只有 active 实例才需要真正改写规则 */
export function updatePrintPage(uid) {
  if (uid == null || uid !== activeId) return;
  writeRule(uid);
}

/** 用户与本实例交互时调用，抢占 active 身份 */
export function activatePrintPage(uid) {
  if (uid == null || !registry.has(uid) || uid === activeId) return;
  writeRule(uid);
}

/**
 * 卸载实例：只清理自己的登记。
 * 若自己是 active，交给最后一个仍存活的实例；都不在了就移除 style 节点，
 * 避免影响宿主页面自己的打印设置。
 */
export function unregisterPrintPage(uid) {
  if (uid == null) return;
  registry.delete(uid);
  if (activeId !== uid) return;

  const remaining = Array.from(registry.keys());
  const next = remaining[remaining.length - 1];
  if (next != null) {
    writeRule(next);
    return;
  }

  activeId = null;
  if (typeof document === 'undefined') return;
  const el = document.getElementById(STYLE_ID);
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

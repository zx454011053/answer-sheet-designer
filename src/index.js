/**
 * 答题卡设计器 —— 库入口。
 *
 * 三种接入方式：
 * 1) 宿主是 Vue 2 + 工程化构建：`Vue.use(AnswerSheetDesignerPlugin)` 后直接用 <answer-sheet-designer />
 * 2) 只想要组件：`import AnswerSheetDesigner from 'answer-sheet-designer'`
 * 3) 非工程化页面（CDN / 遗留后台）：`AnswerSheetDesigner.mount(el, { propsData, on })`
 */
import Vue from 'vue';
import {
  Button,
  Checkbox,
  Dialog,
  Divider,
  Form,
  FormItem,
  Input,
  InputNumber,
  Loading,
  Message,
  Option,
  Progress,
  Radio,
  RadioGroup,
  Select,
  Switch,
  Table,
  TableColumn,
  Tag
} from 'element-ui';

import AnswerSheetDesigner from './components/AnswerSheetDesigner.vue';
import './styles/answer-sheet.css';

export {
  createLocalDataSource,
  createHttpDataSource,
  normalizeDataSource
} from './datasource/index.js';
export { createEditorDocument, parseEditorDocument } from './core/document.js';
export { createDefaultSheetForm } from './core/defaults.js';
export {
  listPresetTemplates,
  getPresetTemplate,
  createPresetSnapshot
} from './core/presetTemplates.js';
export {
  createSheetData,
  withBlocks,
  validateQuestionNumbering,
  normalizeBlockType,
  SHEET_LAYOUTS,
  SHEET_FILL_TYPES
} from './core/sheetBuilder.js';
export { computeSheetStats, getDefaultSectionTitle, getQuestionTypeLabel } from './core/questionModel.js';

/** 设计器渲染所需的 Element UI 组件（宿主已全量注册时不会重复注册） */
const ELEMENT_COMPONENTS = [
  Button,
  Checkbox,
  Dialog,
  Divider,
  Form,
  FormItem,
  Input,
  InputNumber,
  Option,
  Progress,
  Radio,
  RadioGroup,
  Select,
  Switch,
  Table,
  TableColumn,
  Tag
];

/**
 * 注册依赖的 Element UI 组件与指令（幂等）
 * @param {import('vue').VueConstructor} VueCtor
 */
export function registerElementComponents(VueCtor = Vue) {
  ELEMENT_COMPONENTS.forEach((component) => {
    const name = component && component.name;
    if (!name) return;
    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    if (!VueCtor.options.components[kebab]) {
      VueCtor.component(kebab, component);
    }
  });
  if (Loading && Loading.directive && !VueCtor.options.directives.loading) {
    VueCtor.directive('loading', Loading.directive);
  }
}

/**
 * Vue 插件安装
 * @param {import('vue').VueConstructor} VueCtor
 * @param {{ componentName?: string }} [options]
 */
export function install(VueCtor, options = {}) {
  registerElementComponents(VueCtor);
  const name = options.componentName || 'answer-sheet-designer';
  VueCtor.component(name, AnswerSheetDesigner);
}

/**
 * 非工程化环境挂载
 * @param {string|HTMLElement} el 容器选择器或节点
 * @param {{ propsData?: Object, on?: Object }} [options]
 * @returns {{ vm: import('vue').ComponentPublicInstance, designer: any, destroy: () => void }}
 */
export function mount(el, options = {}) {
  registerElementComponents(Vue);
  const { propsData = {}, on = {} } = options;
  const container = typeof el === 'string' ? document.querySelector(el) : el;
  if (!container) throw new Error('[answer-sheet-designer] mount 目标容器不存在');

  // 挂到容器内部的一个占位节点，保留宿主容器本身（其 id / class / 高度样式仍然生效）。
  // 直接 $mount(container) 会让 Vue 用组件根节点替换掉容器，宿主的 CSS 随之失效。
  const mountPoint = document.createElement('div');
  mountPoint.style.height = '100%';
  container.appendChild(mountPoint);

  const vm = new Vue({
    render: (h) => h(AnswerSheetDesigner, { props: propsData, on })
  }).$mount(mountPoint);
  return {
    vm,
    designer: vm.$children[0],
    destroy: () => {
      vm.$destroy();
      if (vm.$el && vm.$el.parentNode) vm.$el.parentNode.removeChild(vm.$el);
      if (mountPoint.parentNode) mountPoint.parentNode.removeChild(mountPoint);
    }
  };
}

AnswerSheetDesigner.install = install;
AnswerSheetDesigner.mount = mount;
AnswerSheetDesigner.registerElementComponents = registerElementComponents;

export { Message, MessageBox } from 'element-ui';
export { AnswerSheetDesigner };
export default AnswerSheetDesigner;

import Vue from 'vue';
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';

import AnswerSheetDesigner from '@/index';
import DemoApp from './DemoApp.vue';

Vue.use(ElementUI);
Vue.use(AnswerSheetDesigner);

new Vue({
  render: (h) => h(DemoApp)
}).$mount('#app');

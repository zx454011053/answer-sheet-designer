<template>
  <div class="demo-shell">
    <main class="demo-body">
      <answer-sheet-designer
        v-if="ready"
        :exam-id="examId"
        :session="session"
        :data-source="dataSource"
        :show-header="false"
        @back="onBack"
        @saved="onSaved"
        @template-saved="onTemplateSaved"
        @error="onError"
      />
    </main>
  </div>
</template>

<script>
import { createLocalDataSource } from '@/index';
import { createSampleSheet } from './sampleSheet';

const STORAGE_KEY = 'answer-sheet-designer-demo';
const EXAM_ID = 8801;

export default {
  name: 'DemoApp',
  data() {
    return {
      ready: false,
      examId: EXAM_ID,
      session: { name: '高二年级 期中联考', examNo: 'S20261118', paperId: 301 },
      dataSource: createLocalDataSource({ storageKey: STORAGE_KEY })
    };
  },
  async created() {
    // 首次进入：把示例答题卡写入本地数据源，随后由设计器走正常的「加载」链路
    const existing = await this.dataSource.loadSheet({ examId: EXAM_ID });
    if (!existing) {
      await this.dataSource.saveSheet({ examId: EXAM_ID, payload: createSampleSheet() });
    }
    this.ready = true;
  },
  methods: {
    onBack() {
      this.$message.info('已触发 back 事件（宿主可在此关闭抽屉或返回列表页）');
    },
    onSaved(payload) {
      console.log('[demo] saved', payload);
      this.$message.success('已保存到本地数据源');
    },
    onTemplateSaved(payload) {
      console.log('[demo] template-saved', payload);
    },
    onError(error) {
      console.error('[demo] error', error);
    }
  }
};
</script>
<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f5f7fa;
}
.demo-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.demo-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
/* 组件根节点默认 calc(100vh - 60px)，demo 无顶栏，这里铺满 */
.demo-body .answer-sheet-editor {
  height: 100%;
}

/*
 * 打印：必须解除 html/body/#app 的 100% 高度与 .demo-body 的 overflow:hidden，
 * 否则浏览器只输出视口内的第 1 页（实测 4 页答题卡仅打印 1 页）。
 */
@media print {
  html,
  body,
  #app,
  .demo-shell,
  .demo-body {
    height: auto !important;
    overflow: visible !important;
  }
  .demo-shell,
  .demo-body {
    display: block !important;
  }
}
</style>

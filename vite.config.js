import { defineConfig } from 'vite';
import vue2 from '@vitejs/plugin-vue2';
import { fileURLToPath, URL } from 'node:url';

const resolvePath = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [vue2()],
  resolve: {
    alias: {
      '@': resolvePath('./src')
    }
  },
  server: {
    port: 5273,
    open: '/index.html'
  },
  build: {
    // public/ 里是 demo 页与构建产物副本（public/preview），只在 dev server 下服务。
    // 关闭复制，否则 vite build 会把 demo html 和一份 1MB 的 UMD 副本一起塞进 dist，
    // 发布 npm 包时体积翻倍。
    copyPublicDir: false,
    lib: {
      entry: resolvePath('./src/index.js'),
      name: 'AnswerSheetDesigner',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'answer-sheet-designer.es.js' : 'answer-sheet-designer.umd.js')
    },
    cssCodeSplit: false,
    rollupOptions: {
      // vue / element-ui 由宿主提供，避免同一页面重复打包两份 Vue
      external: ['vue', 'element-ui'],
      output: {
        globals: {
          vue: 'Vue',
          'element-ui': 'ELEMENT'
        },
        exports: 'named',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'answer-sheet-designer.css';
          return 'assets/[name][extname]';
        }
      }
    }
  }
});

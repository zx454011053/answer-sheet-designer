/**
 * 纯逻辑子入口构建配置（`answer-sheet-designer/core`）。
 *
 * 与主构建分开跑：Vite 的 lib 模式不支持「多入口 + UMD」，
 * 而 core 只需要一份 ES 产物给 Node / SSR / 测试用。
 *
 * 关键点：emptyOutDir 必须为 false，否则会把主构建刚写好的 dist 清掉。
 */
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const resolvePath = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolvePath('./src')
    }
  },
  build: {
    emptyOutDir: false,
    copyPublicDir: false,
    // 纯逻辑不产物 CSS / 静态资源
    cssCodeSplit: false,
    lib: {
      entry: resolvePath('./src/core-only.js'),
      // 同时出 ESM 与 CJS：Node 侧 `import` / `require` 都能用。
      // 扩展名不能是 .js —— 主包没有 "type": "module"，
      // .js 会被当成 CJS 解析后再 reparse，Node 会告警且多一次解析开销。
      formats: ['es', 'cjs'],
      fileName: (format) => (
        format === 'es' ? 'answer-sheet-designer.core.mjs' : 'answer-sheet-designer.core.cjs'
      )
    },
    rollupOptions: {
      output: {
        // core 是独立小包，不希望拆 chunk
        inlineDynamicImports: true
      }
    }
  }
});

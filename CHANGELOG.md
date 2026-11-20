# 变更日志

本项目遵循语义化版本（SemVer）。

## 1.0.0 — 2026-11-19

首个可分发版本。

### 能力

- **三种接入形态**：`Vue.use()` 全局插件、单组件注册、UMD `mount()` 无构建页面。
- **版式**：A4 纵向、A3 横向（两栏 / 三栏）、8K 横向（两栏 / 三栏）。
- **题型**：单选 / 多选 / 判断（客观题横带混排）、填空、解答、英语作文、语文作文。
- **卷头信息**：标题、考试号、二维码、准考证号 / 条码 / 短学号填涂、考生须知。
- **出图**：预览所见即所得、浏览器打印（自动注入 `@page`）、PDF 导出（默认 200DPI）。
- **传参**：`content` 简写整卷，`setSheet` / `setContent` / `setQuestionBlocks` / `setForm` 局部更新。
- **模板**：11 个内置科目模板；已存模板支持载入、重命名、删除。
- **数据源**：localStorage / HTTP / 自定义，缺失方法自动降级为空实现。

### 本版新增

- **只读模式** `readonly`：隐藏配置面板与全部编辑入口，保留打印与导出，适合学生/家长查看。
- **PDF 返回 Blob**：`getPdfBlob()` 与 `exportPdf({ download: false })`，供批量生成或上传后端。
- **纯逻辑入口** `answer-sheet-designer/core`：零 DOM 依赖（29KB / gzip 7.8KB），Node / SSR / 测试可复用；主入口因 element-ui 顶层访问 `document` 无法在 Node 加载。
- **整卷统计**：面板显示题量 / 总分 / 页数，`getStats()` 返回 `{ totalScore, questionCount, ... }`。
- **保存前题号校验**：断档 / 重号 / 区间重叠会提示确认，不硬拦（AB 卷可能真的跳号）。
- **多实例打印**：`@page` 改为实例注册表，以最近操作的实例为准，卸载不再误删他人规则。
- **按需加载 PDF 依赖**：html2canvas / jsPDF 改为动态 import，首屏 gzip 从约 338KB 降到约 140KB。
- **运行中切换考试**：`:exam-id` 变化会清空当前卷并按新 id 重新加载（题块、标题、考试号、`form.id` 一并换掉）；传了 `sheet` / `content` 时只切换保存目标。
- **类型声明**：`index.d.ts` / `core.d.ts`。
- **质量门禁**：`verify:console`（默认零日志）、`verify:release`（只读/统计/Blob/按需加载）、`verify:switch`（切换考试）、`verify:narrow`（1024/1280/1600 视口不裁切纸张）。

### 文档

- README 重整为「产品介绍 + 接入方法 + 使用方法 + 参数说明」四段；新增 6 张产品截图（`docs/images/`，由 `npm run capture:docs` 生成）。

### 修复

- `createSheetData()` 在 `autoLoad: false` 时不会应用传入的 `content`，导致空白答题卡。
- 生产环境默认向控制台输出分页与度量调试日志。
- `vite build` 把 `public/` 复制进 `dist`，npm 包内多出约 1MB 冗余文件。
- 验证脚本写死本机 Chromium 路径，换环境后全部失效（改为自动探测，支持 `CHROME_PATH`）。
- `computeSheetStats()` 缺少 `totalScore`，与文档描述不一致。
- 连点「保存」会同时弹出两个题号确认框，确认后重复提交（保存锁提前到确认框之前）。
- 宿主切换 `:exam-id` 时仍显示上一场的题目、`form.id` 也沿用上一场，保存会写进错误的考试记录。
- 视口窄于约 1100px 时预览区把固定的 A4 纸张居中溢出，左右各被裁掉一截且没有横向滚动条（`.preview-content` 的居中改为子层 `margin: 0 auto`，纸张不再被裁、可横向滚动）。

### 已知限制

见 README「注意事项」。

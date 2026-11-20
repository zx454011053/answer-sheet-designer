/**
 * 构建后把 UMD / CSS 同步到 public/preview。
 *
 * 背景：Vite dev server 会把根目录下的 .js 当成模块做转换并缓存，
 * demo 页直接引 /dist/xxx.umd.js 时会拿到转换过的旧内容。
 * 放到 publicDir 下则由静态文件服务直接返回，构建一次即可生效。
 *
 * 运行：node scripts/sync-preview.mjs（npm run build 已串联）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'dist');
const to = path.join(root, 'public', 'preview');

// UMD 已把依赖内联，demo 不需要 chunks；只同步这两个文件即可
const FILES = ['answer-sheet-designer.umd.js', 'answer-sheet-designer.css'];

let copied = 0;
for (const name of FILES) {
  const src = path.join(from, name);
  if (!fs.existsSync(src)) {
    console.warn(`[sync-preview] 跳过缺失文件 ${name}（先执行 vite build）`);
    continue;
  }
  fs.mkdirSync(to, { recursive: true });
  fs.writeFileSync(path.join(to, name), fs.readFileSync(src));
  copied += 1;
}

console.log(`[sync-preview] 已同步 ${copied}/${FILES.length} 个文件到 public/preview`);

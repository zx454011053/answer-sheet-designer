/**
 * 统一的 Chromium 可执行文件解析。
 *
 * 目的：验证脚本原先直接写死某台机器上的 ms-playwright 路径，
 * 换环境（同事、CI、macOS/Linux）后所有 verify:* 都跑不起来。
 *
 * 解析顺序：
 *   1. 环境变量 CHROME_PATH
 *   2. PLAYWRIGHT_BROWSERS_PATH 下的 chromium-[版本] 目录（含系统缓存目录）
 *   3. 系统安装的 Chrome / Chromium
 *
 * 都没有时抛错，提示执行 `npx playwright install chromium`。
 *
 * 用法：
 *   import { CHROME_PATH } from './chrome-path.mjs';
 *   chromium.launch({ executablePath: CHROME_PATH })
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

/** 某个 playwright 根目录下所有可用的 chromium 主程序，按版本号倒序 */
function chromiumBinariesIn(root) {
  if (!root || !fs.existsSync(root)) return [];

  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    return [];
  }

  const candidates = [];
  entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('chromium-'))
    .forEach((entry) => {
      const version = Number((entry.name.split('-')[1] || '0').replace(/\D/g, '')) || 0;
      const dir = path.join(root, entry.name);
      const binaries = isWin
        ? [
            path.join(dir, 'chrome-win64', 'chrome.exe'),
            path.join(dir, 'chrome-win', 'chrome.exe')
          ]
        : isMac
          ? [path.join(dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')]
          : [
              path.join(dir, 'chrome-linux', 'chrome'),
              path.join(dir, 'chrome-linux64', 'chrome')
            ];
      binaries.forEach((bin) => {
        if (fs.existsSync(bin)) candidates.push({ bin, version });
      });
    });

  return candidates.sort((a, b) => b.version - a.version).map((item) => item.bin);
}

function resolveChromePath() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const playwrightRoots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    isWin ? path.join(HOME, 'AppData', 'Local', 'ms-playwright') : '',
    isMac ? path.join(HOME, 'Library', 'Caches', 'ms-playwright') : '',
    path.join(HOME, '.cache', 'ms-playwright')
  ].filter(Boolean);

  for (const root of playwrightRoots) {
    const [bin] = chromiumBinariesIn(root);
    if (bin) return bin;
  }

  const systemChrome = isWin
    ? [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        path.join(HOME, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
      ]
    : isMac
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium'
        ]
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

  for (const bin of systemChrome) {
    if (fs.existsSync(bin)) return bin;
  }

  throw new Error(
    '[chrome-path] 未找到 Chromium。请执行 `npx playwright install chromium`，' +
      '或用环境变量 CHROME_PATH 指定可执行文件路径。'
  );
}

export const CHROME_PATH = resolveChromePath();
export default CHROME_PATH;

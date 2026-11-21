#!/usr/bin/env node
// 装好以后做的事：install.sh 最后运行它。图标坏了、程序挪了地方，也可以单独运行：node setup.mjs
//   1. 确认 Codex 命令行在、登录了
//   2. 在「应用程序」里做「Vibe Learning」图标（mac/make-app.mjs）
//   3. 桌面上放一个指向它的快捷方式
//   4. 打开它：服务在后台开起来，浏览器打开首页
//   5. 打印几句用法
// 测试用的环境变量：VIBE_LEARNING_APP_DIR（图标放哪）、VIBE_LEARNING_DESKTOP（快捷方式放哪）、VIBE_LEARNING_NO_OPEN（不打开）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NAME = 'Vibe Learning';
const DATA = process.env.VIBE_LEARNING_HOME || process.env.VISUAL_LEARNING_HOME || path.join(os.homedir(), '.vibe-learning');
const PORT = Number(process.env.VIBE_LEARNING_PORT || process.env.VISUAL_LEARNING_PORT) || 4178;
const APP_DIR = process.env.VIBE_LEARNING_APP_DIR || (writable('/Applications') ? '/Applications' : path.join(os.homedir(), 'Applications'));
const DESKTOP = process.env.VIBE_LEARNING_DESKTOP || path.join(os.homedir(), 'Desktop');
const APP = path.join(APP_DIR, NAME + '.app');
const notes = [];

if (process.platform !== 'darwin') {
  console.error('Vibe Learning 目前只支持 Mac。');
  process.exit(1);
}

// 1. Codex
let codex = '';
try { codex = execFileSync('/bin/sh', ['-c', 'command -v codex'], { encoding: 'utf8' }).trim(); } catch { /* 没有 */ }
if (!codex) {
  console.error('找不到 Codex 命令行（codex 命令）。先装好它并登录（npm install -g @openai/codex，然后 codex login），再运行一次。');
  process.exit(1);
}
try {
  // 没登录时它打印 Not logged in、退出码不是 0。用自己配的模型服务（API key 写在环境变量里）的也会这样，所以只提醒，不拦
  execFileSync(codex, ['login', 'status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
} catch (e) {
  if (/not logged in/i.test(String(e.stdout ?? '') + String(e.stderr ?? ''))) notes.push('Codex 好像还没登录：在终端运行 codex login，照提示登录一次，再回来用。（你用的是自己配的模型服务、不用登录的话，不用管这条。）');
}

// 2. 图标
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(APP_DIR, { recursive: true });
execFileSync(process.execPath, [path.join(HERE, 'mac', 'make-app.mjs'), APP_DIR], { stdio: 'inherit' });

// 3. 桌面快捷方式：一个指向图标的链接；那里已经有别的同名东西就不动
const link = path.join(DESKTOP, NAME);
try {
  let st = null;
  try { st = fs.lstatSync(link); } catch { /* 没有 */ }
  if (st && st.isSymbolicLink()) fs.unlinkSync(link);
  if (!st || st.isSymbolicLink()) {
    fs.symlinkSync(APP, link);
    console.log(`桌面上放了快捷方式：${link}`);
  } else console.log(`桌面上已经有一个「${NAME}」，没有动它。`);
} catch {
  notes.push(`桌面上的快捷方式没放上（没有权限）。可以在「应用程序」里找到 ${NAME}，把它拖到桌面或程序坞。`);
}

// 4. 打开：图标会把服务开起来（代码更新过就重启），再打开浏览器
let up = false;
if (!process.env.VIBE_LEARNING_NO_OPEN) {
  try {
    execFileSync('/usr/bin/open', [APP]);
    for (let i = 0; i < 60 && !up; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try { up = (await (await fetch(`http://127.0.0.1:${PORT}/__vl`, { signal: AbortSignal.timeout(500) })).json()).app === 'vibe-learning'; } catch { /* 还没起来 */ }
    }
  } catch { /* 下面说 */ }
  if (!up) notes.push(`首页没能自动打开。点一下「${NAME}」图标试试；还不行，看日志 ${path.join(DATA, 'server.log')}。`);
}

// 5. 用法
console.log(`
✓ Vibe Learning 装好了。${up ? '浏览器里已经打开了首页。' : ''}

以后怎么打开
  · 点桌面上的「${NAME}」（「应用程序」里也有，可以拖到程序坞）
  · 或者在 Codex 里输入 $vibe-learning，或者说「打开 Vibe Learning」

怎么用
  1. 在首页写一句想学的东西，按回车。AI 一边讲一边画图；有先后的事，图会分几页，点「下一步」往下翻。
  2. 哪一段没看懂，用鼠标选中它，点「问 Codex」，问答会挂在旁边。
  3. 想看看自己懂没懂：鼠标移到回答上，点右上角的复述图标，用自己的话讲一遍，AI 会把你讲的画出来，帮你改对。

要知道的
  · 用的是你自己 Codex 的额度和默认模型。每个回答都用高思考力度认真想，比平时聊天花得多。
  · 学习记录只存在这台电脑上（${DATA.replace(os.homedir(), '~')}）。
  · 默认提示词要求 AI 只读当前项目和材料里列出的路径。回答时可写入项目的 files/ 和系统临时目录。想调整读取范围，在 Codex 里说「让 Vibe Learning 能读我电脑上的文件」。
  · 更新：拿到新版的文件夹后，在 Codex 里说「更新 Vibe Learning」。
${notes.length ? '\n还要注意\n' + notes.map((n) => '  · ' + n).join('\n') + '\n' : ''}`);

function writable(dir) {
  try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch { return false; }
}

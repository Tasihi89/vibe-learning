// 端到端走一遍：用 Chrome 调试协议按真实时间驱动页面。打开首页，写一句话开新项目，等回答写完，截几张图。
// 用法：node e2e.mjs <服务地址> <一句话> <截图目录> [最多等几秒]
// 会真的问一次、开一次题，花学习者的额度。用临时数据目录另起一个服务来测，见 AGENTS.md。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [base, q, outDir, waitSec = '150'] = process.argv.slice(2);
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const prof = fs.mkdtempSync(outDir + '/prof-');
const p = spawn(chrome, ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + prof, '--window-size=1500,950', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch('http://127.0.0.1:9333/json')).json(); if (tabs.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', (m) => { const o = JSON.parse(m.data); if (o.id && pend.has(o.id)) { pend.get(o.id)(o.result); pend.delete(o.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.value;
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(outDir + '/' + name + '.png', Buffer.from(r.data, 'base64')); };
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: base + '/' });
await sleep(1500);
await shot('e2e-1-home');
await ev(`(()=>{const t=document.getElementById('q');t.value=${JSON.stringify(q)};t.dispatchEvent(new Event('input'));document.getElementById('go').click();return 1})()`);
await sleep(6000);
console.log('url after start:', await ev('location.href'));
await shot('e2e-2-answering');
const t0 = Date.now();
for (;;) {
  await sleep(3000);
  const st = await ev(`JSON.stringify({pending:!!document.getElementById('pending'),qa:document.querySelectorAll('#main .qa').length,status:document.getElementById('ask-status').textContent,title:document.title})`);
  const o = JSON.parse(st || '{}');
  if (!o.pending && o.qa > 0) { console.log('answered in', Math.round((Date.now() - t0) / 1000), 's', st); break; }
  if (Date.now() - t0 > Number(waitSec) * 1000) { console.log('timeout', st); break; }
}
await sleep(4000);
await shot('e2e-3-done');
console.log('final:', await ev(`JSON.stringify({title:document.title,crumb:document.getElementById('crumbs').textContent,figs:document.querySelectorAll('#main .view-fig').length,starters:document.querySelectorAll('.fq').length})`));
ws.close(); p.kill(); fs.rmSync(prof, { recursive: true, force: true });

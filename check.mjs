#!/usr/bin/env node
// 检查一个学习项目：先查 topic.json 和问答的格式，再用无头 Chrome 打开学习页，宽屏、中等窗口、大屏、手机各一次。
// 用法：node check.mjs <项目目录>      比如 node check.mjs ~/.vibe-learning/<项目>
// 页面里放进现有的问答，再加一条把 11 种图都用上的样例问答（回答和问题里各带一处标记、两条备注），再试一遍：点备注、选中后标记和加备注、
// 展开成整页、左边的目录、打开地图跳回来；点标记再取消、在问题里标记、从地图里的标记节点跳到那处标记；
// 复述：白框右上角的图标、复述页（看不到原回答、图能收进思维模型、能回到原回答）、复述合集、新开一页复述再返回。
// 删除备注：卡片上和备注页顶上的「删除」，点两下才删，连同下面挂着的备注一起删。
// 跟着窗口大小变：没有备注的页问答在窗口正中，大窗口里问答区等比放大，目录不超出窗口。
// 整页会不会被滚动、文字有没有撑出框、图有没有比回答区还宽、每种图有没有画出来、脚本有没有报错。有问题时退出码是 1。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { renderTopic, checkTopic, HERE } from './render.mjs';

const dir = path.resolve(process.argv[2] ?? '.');
const lint = checkTopic(dir);
for (const w of lint.warnings) console.warn('提醒：' + w);
if (lint.errors.length) {
  console.error('格式有问题：\n' + lint.errors.map((e) => '- ' + e).join('\n'));
  process.exit(1);
}
// 页面从本机服务的 /_vendor/ 取开源库；这里用 file:// 打开，换成 vendor/ 的文件地址
const pageHtml = renderTopic(dir).replaceAll('"/_vendor/', '"' + pathToFileURL(path.join(HERE, 'vendor')).href + '/');
const chrome = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('找不到 Chrome。装好 Chrome，或者用环境变量 CHROME 指定路径。');
  process.exit(1);
}

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const col = (name) => { try { return fs.readdirSync(path.join(dir, 'data', name)).filter((n) => n.endsWith('.json')).map((n) => readJson(path.join(dir, 'data', name, n))).filter(Boolean); } catch { return []; } };
const fixture = {
  id: 'zz-check', at: '9999-01-01T00:00:00Z', q: '（排版检查用的样例：11 种图）',
  marks: [{ start: 0, end: 5, text: '一句话回答' }],
  qmarks: [{ start: 1, end: 5, text: '排版检查' }],
  blocks: [
    { t: 'text', md: '一句话回答，带 **加粗** 和 `代码`。' },
    // 自己画的图：带箭头 marker（id 会被改名）、一段混进来的脚本和外部图片（要被去掉）
    { t: 'view', kind: 'draw', title: '自己画的图', alt: '两个框，一个箭头', svg: '<svg viewBox="0 0 720 200" width="720" height="200"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--accent)"/></marker></defs><rect x="20" y="60" width="200" height="80" rx="10" style="fill:var(--accent-soft);stroke:var(--accent)"/><text x="120" y="106" text-anchor="middle" font-size="16">你的电脑</text><line x1="220" y1="100" x2="480" y2="100" style="stroke:var(--accent);stroke-width:2" marker-end="url(#arrow)"/><rect x="480" y="60" width="220" height="80" rx="10" style="fill:var(--sheet);stroke:var(--ink-3)"/><text x="590" y="106" text-anchor="middle" font-size="16">claude.ai</text><script>window.__BAD = 1</script><image href="http://example.com/x.png" x="0" y="0" width="10" height="10"/><rect onclick="window.__BAD = 2" x="0" y="0" width="5" height="5"/></svg>' },
    { t: 'view', kind: 'tree', title: '组成', root: { name: '一个很长很长的根节点名字用来测试换行', note: '一句很长的说明文字，看看会不会把框撑破，再长一点再长一点', children: [{ name: '子一', note: '说明', mark: true }, { name: '子二', children: [{ name: '孙一' }, { name: '孙二' }] }] } },
    { t: 'view', kind: 'web', center: { name: '中心概念', note: '说明' }, links: ['contains', 'partOf', 'isa', 'needs', 'causes', 'contrast', 'extends', 'example'].map((rel, i) => ({ name: '相关概念 ' + (i + 1), rel, note: '一句说明' })) },
    { t: 'view', kind: 'flow', title: '时序图', actors: [{ id: 'a', name: '浏览器' }, { id: 'b', name: '家里的路由器' }, { id: 'c', name: '网站的服务器' }, { id: 'd', name: 'claude.ai' }], steps: [{ title: '交给路由器', body: '目的地不在家里的网络里，浏览器把请求交给路由器', from: 'a', to: 'b' }, { title: '查路由表', body: '按路由表决定下一站交给谁', at: 'b' }, { title: '加密发出', body: '一句比较长的说明文字，用来测试换行会不会把格子撑破，再长一点', from: 'b', to: 'c' }, { title: '再转一站', from: 'c', to: 'd' }, { title: '原路送回', body: '说明', from: 'd', to: 'a' }] },
    { t: 'view', kind: 'flow', steps: [{ title: '没有角色的第一步', body: '说明' }, { title: '第二步', body: '说明' }] },
    { t: 'view', kind: 'compare', items: [{ name: '方案一' }, { name: '方案二' }, { name: '方案三' }], rows: [{ aspect: '改了什么', values: ['一个网址', '两个端口', '路由表和一块虚拟网卡，很长的一句'] }, { aspect: '谁会听', values: ['浏览器', '大部分 App', '几乎所有程序'] }], bottom: '一句话结论' },
    { t: 'view', kind: 'cause', chain: [{ text: '原因' }, { text: '中间' }, { text: '结果' }], flip: '反过来想：如果没有……' },
    { t: 'view', kind: 'analogy', source: '寄国际件', pairs: [{ real: '路由表', like: '桌上的便签' }, { real: '默认网关', like: '楼下快递窗口' }], breaks: '哪里不像' },
    { t: 'view', kind: 'layers', label: '从外到内', layers: [{ name: '外层', note: '说明' }, { name: '中层' }, { name: '内层' }, { name: '最里层' }] },
    { t: 'view', kind: 'instance', title: '一段代码', lang: 'js', code: 'function price(total, member) {\n  if (member && total > 100) return Math.round(total * 0.9 * 100) / 100; // 这一行比较长，用来测试横向滚动是不是在代码框里面\n  return total;\n}', marks: [{ line: 2, note: '打折' }] },
    { t: 'view', kind: 'instance', title: '设置', rows: [{ label: '端口', value: '8080' }, { label: '一个很长的值', value: 'http://127.0.0.1:8080/index.html?some=very-long-query-string-to-test-wrapping' }] },
    { t: 'view', kind: 'timeline', events: [{ when: '2016-02', what: '事件', note: '说明' }, { when: '2020-11', what: '事件二' }] },
    { t: 'view', kind: 'scale', unit: '毫秒', log: true, items: [{ name: '本机', value: 0.1 }, { name: '同城', value: 5 }, { name: '另一个大洲的服务器', value: 180 }] },
    { t: 'view', kind: 'formula', tex: 'E = mc^2', parts: [{ sym: 'E', means: '能量' }, { sym: 'c', means: '光速' }], read: '能量等于质量乘以光速的平方。' },
    { t: 'saved', path: 'files/样例.md', note: '说明' },
    // 一步步的图、截图、折叠块（课程里用的）
    { t: 'view', kind: 'steps', title: '一步步', alt: '两步', steps: [{ svg: '<svg viewBox="0 0 720 120"><rect x="20" y="20" width="200" height="80" rx="10" style="fill:var(--accent-soft)"/><text x="120" y="66" text-anchor="middle">第一步</text></svg>', md: '第一步的说明' }, { svg: '<svg viewBox="0 0 720 120"><rect x="260" y="20" width="200" height="80" rx="10" style="fill:var(--marker)"/><text x="360" y="66" text-anchor="middle">第二步</text></svg>', md: '第二步的说明，长一点，看看会不会撑出框。' }] },
    // 一张图分几页亮出来（页面上 AI 的回答用的）：底子一直在，data-step="2" 第 2 页起出来，"2-2" 只在第 2 页，"3" 第 3 页起
    { t: 'view', kind: 'steps', title: '一张图分几页亮', alt: '三页', steps: [{ md: '第一页只有底子' }, { md: '第二页多出一个框，外面亮一圈' }, { md: '第三页再多一个框，亮的那圈没了' }], svg: '<svg viewBox="0 0 720 120"><rect x="20" y="20" width="200" height="80" rx="10" style="fill:var(--accent-soft)"/><g data-step="2"><rect x="260" y="20" width="200" height="80" rx="10" style="fill:var(--sheet);stroke:var(--ink-3)"/></g><rect data-step="2-2" x="255" y="15" width="210" height="90" rx="12" style="fill:none;stroke:var(--marker);stroke-width:4"/><g data-step="3"><rect x="500" y="20" width="200" height="80" rx="10" style="fill:var(--marker)"/></g></svg>' },
    // 边讲边画：每页的话画在图里（data-say），上面不放说明；翻过去以后变淡
    { t: 'view', kind: 'steps', title: '边讲边画', alt: '三页，话在图里', steps: [{ say: '第一页的话' }, { say: '第二页的话' }, { say: '第三页的话' }], svg: '<svg viewBox="0 0 600 120"><g data-say="1"><text x="20" y="30">第一页的话</text></g><g data-step="2"><rect x="300" y="40" width="120" height="30" rx="6" style="fill:var(--accent-soft)"/></g><g data-say="2"><text x="20" y="60">第二页的话</text></g><g data-say="3"><text x="20" y="90">第三页的话</text></g></svg>' },
    { t: 'img', items: [{ src: 'media/样例.jpg', caption: '一张截图的说明，长一点看看换行' }, { src: 'media/样例二.jpg', caption: '第二张' }] },
    { t: 'fold', kind: 'quiz', title: 'Q1　一道自测题，题目比较长，看看折起来的时候怎么换行', md: '答案。' },
  ],
};
// 两条备注：一条从样例回答的开头长出来、里面追问过一次；另一条是备注的备注
const notes = [
  { id: 'zz-n1', at: '9999-01-02T00:00:00Z', q: '备注里的第一个问题，问得比较长一点看看卡片里怎么换行', thread: 'zz-t1', anchor: { qa: 'zz-check', start: 0, end: 5, text: '一句话回答' },
    blocks: [{ t: 'text', md: '备注卡片里的回答，一两句。' }, { t: 'view', kind: 'compare', items: [{ name: '方案一' }, { name: '方案二' }], rows: [{ aspect: '改了什么', values: ['一个网址', '两个端口'] }] }] },
  { id: 'zz-n2', at: '9999-01-03T00:00:00Z', q: '在备注里追问', thread: 'zz-t1', blocks: [{ t: 'text', md: '追问的回答。' }, { t: 'view', kind: 'flow', actors: [{ id: 'a', name: '浏览器' }, { id: 'b', name: '家里的路由器' }], steps: [{ title: '交给路由器', from: 'a', to: 'b' }, { title: '查路由表', at: 'b' }] },
    { t: 'view', kind: 'steps', title: '卡片里边讲边画', alt: '两页，话在图里', steps: [{ say: '卡片第一页' }, { say: '卡片第二页' }], svg: '<svg viewBox="0 0 300 80"><g data-say="1"><text x="10" y="30">卡片第一页</text></g><g data-say="2"><text x="10" y="60">卡片第二页</text></g></svg>' }] },
  { id: 'zz-n3', at: '9999-01-04T00:00:00Z', q: '备注的备注', thread: 'zz-t2', anchor: { qa: 'zz-n1', start: 0, end: 4, text: '备注卡片' }, blocks: [{ t: 'text', md: '更深一层。' }] },
];
// 一页复述：复述的是样例回答，第一个回答画了两张图（第二张收进了思维模型），后面追问过一次
const tinySvg = (label) => '<svg viewBox="0 0 720 160"><rect x="20" y="40" width="300" height="80" rx="10" style="fill:var(--accent-soft);stroke:var(--accent)"/><text x="170" y="86" text-anchor="middle" font-size="16">' + label + '</text></svg>';
const retells = [
  { id: 'zz-r1', at: '9999-01-05T00:00:00Z', q: '我来讲讲：一句话回答就是先说结论，再配一张图。', thread: 'zz-rt', retell: { qa: 'zz-check' },
    blocks: [{ t: 'text', md: '讲对了一半。' }, { t: 'view', kind: 'draw', title: '你讲的模型', alt: '一个框', svg: tinySvg('你讲的') }, { t: 'view', kind: 'draw', title: '改过来的模型', alt: '一个框', svg: tinySvg('改过来的'), kept: '9999-01-05T00:00:01Z' }] },
  { id: 'zz-r2', at: '9999-01-06T00:00:00Z', q: '为什么要先说结论？', thread: 'zz-rt', blocks: [{ t: 'text', md: '复述页里的追问。' }] },
];
const qas = col('qa').concat([fixture], notes, retells);
const DATA = { qa: qas };
const KINDS = ['draw', 'steps', 'tree', 'web', 'flow', 'compare', 'cause', 'analogy', 'layers', 'instance', 'timeline', 'scale', 'formula'];

const probe = `<script>
window.__VL_DATA = ${JSON.stringify(DATA).replace(/</g, '\\u003c')};
window.__VL_ERRORS = [];
window.__VL_COURSE = ${JSON.stringify(!!readJson(path.join(dir, 'topic.json'))?.course)};
window.__VL_PARTS = ${JSON.stringify([...new Set(qas.filter((q) => q.lesson && typeof q.lesson === 'object').sort((x, y) => String(x.at).localeCompare(String(y.at))).map((q) => q.lesson.part))])};
window.addEventListener('error', (e) => window.__VL_ERRORS.push(String(e.message || e)));
</script>`;
const runner = `<script>
(() => {
  const out = [];
  const name = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
  const text = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
  const pageScroll = (where) => {
    document.querySelectorAll('.scroll').forEach((s) => { s.scrollTop = 1e7; });
    window.scrollTo(0, 1e7);
    const se = document.scrollingElement;
    if (se.scrollHeight > innerHeight + 1 || window.scrollY > 0) out.push({ where, kind: '整页会滚动', detail: 'scrollHeight ' + se.scrollHeight + ' > 视口 ' + innerHeight });
    window.scrollTo(0, 0);
  };
  // 跟着窗口大小变：没有备注的页，问答在窗口正中；窗口比 1440 宽，问答区等比放大（最多 1.3 倍）；左边的目录放大后不超出窗口
  const layout = (where) => {
    const main = document.getElementById('main');
    if (!main || innerWidth < 900) return;
    const r = main.getBoundingClientRect();
    const box = document.getElementById('stream-scroll');
    const right = box.getBoundingClientRect().left + box.clientWidth - r.right;
    if (!document.querySelector('#rail .card') && Math.abs(r.left - right) > 12) out.push({ where, kind: '这一页没有备注，问答却没在窗口正中', detail: '左边空 ' + Math.round(r.left) + '，右边空 ' + Math.round(right) });
    const z = Math.min(1.3, Math.max(1, innerWidth / 1440));
    if (z > 1.05 && r.width < 780 * z - 20) out.push({ where, kind: '大窗口里问答区没跟着放大', detail: '问答区宽 ' + Math.round(r.width) + '，应该有 ' + Math.round(780 * z) });
    const toc = document.querySelector('#stream > .toc');
    if (toc && getComputedStyle(toc).display !== 'none' && parseFloat(getComputedStyle(toc).maxHeight) * (toc.currentCSSZoom || 1) > innerHeight - 150) out.push({ where, kind: '左边的目录放大后会超出窗口', detail: '' });
  };
  function checkStream(where) {
    where = where || '学习流';
    layout(where);
    const box = document.getElementById('stream-scroll');
    if (box.scrollWidth > box.clientWidth + 2) out.push({ where: '学习流', kind: '横向溢出', detail: '内容宽 ' + box.scrollWidth + '，可见宽 ' + box.clientWidth });
    if (where === '学习流') for (const k of ${JSON.stringify(KINDS)}) if (!document.querySelector('#stream .v-' + k)) out.push({ where, kind: '图没画出来', detail: k });
    for (const fig of document.querySelectorAll('#stream .view-fig')) {
      if (fig.scrollWidth > fig.clientWidth + 2) out.push({ where: '学习流', kind: '图比回答区宽', detail: name(fig) + '「' + text(fig) + '」' });
      for (const el of fig.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        // SVG 里的文字没有 CSS 的框，浏览器报的 scrollWidth 不可靠（同样的图，页面别处一改它就变）；这里只查 HTML 的字
        if (el instanceof SVGElement || cs.display === 'none' || cs.overflowX !== 'visible' || el.closest('pre') || el.closest('.katex')) continue;
        if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && /\\S/.test(el.textContent || '')) out.push({ where: '学习流', kind: '文字撑出了框', detail: name(el) + '「' + text(el) + '」' });
      }
    }
    const graph = document.querySelector('#stream .wv-graph');
    if (graph && getComputedStyle(graph).display !== 'none') {
      const r = graph.getBoundingClientRect();
      for (const n of graph.querySelectorAll('.wn')) {
        const b = n.getBoundingClientRect();
        if (b.left < r.left - 2 || b.right > r.right + 2) out.push({ where: '学习流', kind: '关系图的节点出了边界', detail: text(n) });
      }
    }
    for (const sq of document.querySelectorAll('#stream .sq')) {
      const r = sq.getBoundingClientRect();
      for (const el of sq.querySelectorAll('.sq-arr, .sq-num')) {
        const b = el.getBoundingClientRect();
        if (b.left < r.left - 12 || b.right > r.right + 12) out.push({ where: '学习流', kind: '时序图的箭头出了边界', detail: text(el) });
      }
      if (!sq.querySelector('.sq-arr')) out.push({ where: '学习流', kind: '时序图没画出箭头', detail: '' });
    }
    for (const svg of document.querySelectorAll('#stream .dw svg')) {
      if (svg.querySelector('script, image, foreignObject, [onclick]')) out.push({ where, kind: '画的图里脚本或外部资源没去掉', detail: '' });
      for (const m of svg.querySelectorAll('[marker-end]')) { const id = (m.getAttribute('marker-end').match(/#([^)]+)/) || [])[1]; if (!id || !svg.querySelector('[id="' + id + '"]')) out.push({ where, kind: '画的图里箭头找不到', detail: id || '' }); }
      if (svg.getBoundingClientRect().width > svg.closest('.view-fig').getBoundingClientRect().width + 2) out.push({ where, kind: '画的图比回答区宽', detail: '' });
    }
    if (window.__BAD) out.push({ where, kind: '画的图里的脚本跑起来了', detail: '' });
    pageScroll(where);
  }
  const sample = () => document.querySelector('#main .qa[data-qa="zz-check"] .a');
  const wide = () => getComputedStyle(document.querySelector('#rail .card') || document.body).position === 'absolute';
  const select = (from, fromOff, to, toOff) => {
    const r = document.createRange();
    r.setStart(from, fromOff);
    r.setEnd(to, toOff);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  };
  // 按文字里的位置选中 root 里的一段
  const selectText = (root, a, b) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let pos = 0, s = null, e = null;
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const len = n.data.length;
      if (!s && a < pos + len) s = [n, a - pos];
      if (!e && b <= pos + len) { e = [n, b - pos]; break; }
      pos += len;
    }
    if (s && e) select(s[0], s[1], e[0], e[1]);
  };
  const question = () => document.querySelector('#main .qa[data-qa="zz-check"] .q');
  const cardsOverlap = () => {
    const cs = [...document.querySelectorAll('#rail .card')].map((c) => c.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    return cs.some((c, i) => i && c.top < cs[i - 1].bottom - 1);
  };
  // 课程项目：开头那一页是这一集的笔记。三段、时间能点开视频、一步步的图能翻、折叠块和翻到的那一步重画后还在
  const course = () => document.querySelector('#main .lesson-head');
  const lessonStep = () => document.querySelector('#main .qa.lesson .st[data-key]');
  // 一张图分几页亮出来：标着 2、2-2、3 的三样东西各亮没亮
  const layer = () => sample().querySelector('.st.layer');
  const layerShown = (st) => ['2', '2-2', '3'].map((v) => { const el = st.querySelector('.st-pic [data-step="' + v + '"]'); return el && getComputedStyle(el).visibility !== 'hidden' ? '亮' : '暗'; }).join('');
  // 边讲边画的图（正文里的、侧栏卡片里的）翻到第几页
  const cardSays = () => document.querySelector('#rail .card[data-t="zz-t1"] .st.says');
  const pageOf = (st) => (st ? [...st.querySelectorAll('.st-frame')].findIndex((f) => f.classList.contains('on')) : -1);
  const saysKept = (when) => {
    const a = sample().querySelector('.st.says');
    if (pageOf(a) !== 1) out.push({ where: '边讲边画', kind: when + '，正文里话在图里的一步步的图跳回了第 ' + (pageOf(a) + 1) + ' 页', detail: '' });
    if (pageOf(cardSays()) !== 1) out.push({ where: '边讲边画', kind: when + '，侧栏卡片里的一步步的图跳回了第 ' + (pageOf(cardSays()) + 1) + ' 页', detail: '' });
  };
  const steps = [
    () => checkStream(),
    () => {
      // 一张图分几页亮出来：只有一张图；第一页只有底子，翻一页多一样，只在第 2 页的那圈到第 3 页藏起来；最后停在第 2 页，看重画后还在不在
      const st = layer();
      if (!st) { out.push({ where: '一张图分几页亮', kind: '没画出来', detail: '' }); return; }
      if (st.querySelectorAll('svg').length !== 1) out.push({ where: '一张图分几页亮', kind: '应该只有一张图', detail: String(st.querySelectorAll('svg').length) });
      const want = ['暗暗暗', '亮亮暗', '亮暗亮'];
      for (let k = 0; k < 3; k++) {
        if (k) st.querySelector('[data-stmove="1"]').click();
        const got = layerShown(st);
        if (got !== want[k]) out.push({ where: '一张图分几页亮', kind: '第 ' + (k + 1) + ' 页亮出来的东西不对', detail: '应该' + want[k] + '，实际' + got });
        const cap = [...st.querySelectorAll('.st-frame')].findIndex((f) => f.classList.contains('on'));
        if (cap !== k) out.push({ where: '一张图分几页亮', kind: '第 ' + (k + 1) + ' 页的说明没换', detail: String(cap) });
      }
      st.querySelector('[data-stgo="1"]').click();
    },
    () => {
      // 边讲边画：图上面没有说明；这一页的话亮着，前面几页的变淡，后面的还没出来
      const st = sample().querySelector('.st.says');
      if (!st) { out.push({ where: '边讲边画', kind: '没画出来（或图上面还放着说明）', detail: '' }); return; }
      if ([...st.querySelectorAll('.st-cap')].some((el) => el.offsetParent)) out.push({ where: '边讲边画', kind: '图上面不该再有说明', detail: '' });
      const said = () => ['1', '2', '3'].map((n) => { const el = st.querySelector('.st-pic [data-say="' + n + '"]'); return !el || getComputedStyle(el).visibility === 'hidden' ? '无' : el.classList.contains('st-said') ? '淡' : '新'; }).join('');
      const want = ['新无无', '淡新无', '淡淡新'];
      for (let k = 0; k < 3; k++) {
        if (k) st.querySelector('[data-stmove="1"]').click();
        if (said() !== want[k]) out.push({ where: '边讲边画', kind: '第 ' + (k + 1) + ' 页的话不对', detail: '应该' + want[k] + '，实际' + said() });
      }
      // 停在第 2 页，侧栏卡片里的那张也翻到第 2 页：看重画（标记、点「问 Claude」）后还在不在
      st.querySelector('[data-stgo="1"]').click();
      const cst = cardSays();
      if (!cst) out.push({ where: '边讲边画', kind: '侧栏卡片里的一步步的图没画出来', detail: '' });
      else cst.querySelector('[data-stgo="1"]').click();
    },
    () => {
      // 一步步的图：「下一步」翻到第二张，「上一步」在第一张时藏着
      const st = sample().querySelector('.st');
      if (!st) { out.push({ where: '一步步的图', kind: '没画出来', detail: '' }); return; }
      if (!st.querySelector('[data-stmove="-1"]').disabled) out.push({ where: '一步步的图', kind: '在第一步时「上一步」还能点', detail: '' });
      st.querySelector('[data-stmove="1"]').click();
      const on = [...st.querySelectorAll('.st-frame')].findIndex((f) => f.classList.contains('on'));
      if (on !== 1) out.push({ where: '一步步的图', kind: '点「下一步」没翻到第二张', detail: String(on) });
      if (!course()) { if (window.__VL_COURSE) out.push({ where: '课程', kind: '这是课程项目，开头那一页却没画成这一集的笔记', detail: '' }); return; }
      // 笔记里有几段（预习、复习，以前做的还有学），页面上就分几段；顶栏只列这几段
      const want = [...new Set((window.__VL_PARTS || []))];
      const got = [...document.querySelectorAll('#main .part')].map((h) => h.id.slice(5));
      if (got.join() !== want.join()) out.push({ where: '课程', kind: '分段和笔记对不上', detail: '笔记里 ' + want.join('、') + '，页面上 ' + got.join('、') });
      if (document.getElementById('parts-nav').hidden) out.push({ where: '课程', kind: '顶栏没有分段', detail: '' });
      const shown = [...document.querySelectorAll('#parts-nav [data-part]')].filter((x) => !x.hidden).map((x) => x.dataset.part);
      if (shown.join() !== want.join()) out.push({ where: '课程', kind: '顶栏的分段和笔记对不上', detail: '笔记里 ' + want.join('、') + '，顶栏 ' + shown.join('、') });
      if (document.querySelector('#main .lesson-head .ts')) out.push({ where: '课程', kind: '标题里的视频长度也变成了链接', detail: '' });
      const ts = document.querySelector('#main .qa.lesson .a .ts');
      if (!ts) { out.push({ where: '课程', kind: '笔记里的时间没变成链接', detail: '' }); return; }
      ts.click();
      const vid = document.getElementById('vid');
      if (vid.hidden) out.push({ where: '课程', kind: '点时间没打开视频', detail: '' });
      else if (vid.dataset.at !== ts.dataset.ts) out.push({ where: '课程', kind: '点时间，视频没跳到那里', detail: vid.dataset.at + ' ≠ ' + ts.dataset.ts });
      document.getElementById('vid-close').click();
      if (!vid.hidden) out.push({ where: '课程', kind: '视频关不掉', detail: '' });
      // 笔记里的一步步的图翻到第二张，折叠块打开，再标记一处（页面会整个重画）
      const lst = lessonStep();
      if (lst) lst.querySelector('[data-stmove="1"]').click();
      const fold = document.querySelector('#main .qa.lesson details.fold');
      if (fold) fold.open = true;
    },
    () => {
      if (!course()) return;
      const t = document.querySelector('#main .qa.lesson .a-text');
      if (t) selectText(t, 0, 4);
    },
    () => {
      if (!course()) return;
      const b = !document.getElementById('selbar').hidden && document.querySelector('#selbar [data-sb="mark"]');
      if (b) b.click(); else { out.push({ where: '课程', kind: '笔记里选中文字没出工具条', detail: '' }); getSelection().removeAllRanges(); }
    },
    () => {
      if (!course()) return;
      if (!document.querySelector('#main .qa.lesson mark.hl')) out.push({ where: '课程', kind: '笔记里标记不上', detail: '' });
      const lst = lessonStep();
      if (lst && !lst.querySelectorAll('.st-frame')[1].classList.contains('on')) out.push({ where: '课程', kind: '页面重画后，一步步的图回到了第一步', detail: '' });
      const fold = document.querySelector('#main .qa.lesson details.fold');
      if (fold && !fold.open) out.push({ where: '课程', kind: '页面重画后，打开的折叠块又合上了', detail: '' });
      checkStream('课程');
    },
    () => {
      if (!sample().querySelector('mark.hl')) out.push({ where: '开头那页', kind: '存下的标记没显示', detail: '' });
      const cm = sample().querySelector('.cm[data-t="zz-t1"]');
      const card = document.querySelector('#rail .card[data-t="zz-t1"]');
      if (!cm || !card) { out.push({ where: '开头那页', kind: '备注没显示', detail: (cm ? '' : '原文没划线 ') + (card ? '' : '侧栏没卡片') }); return; }
      if (wide() && Math.abs(card.getBoundingClientRect().top - cm.getBoundingClientRect().top) > 60) out.push({ where: '开头那页', kind: '备注卡片没对齐引用的那段', detail: '' });
      if (cardsOverlap()) out.push({ where: '开头那页', kind: '备注卡片叠在一起', detail: '' });
      cm.click();
    },
    () => {
      const card = document.querySelector('#rail .card[data-t="zz-t1"]');
      if (!card.classList.contains('on')) out.push({ where: '开头那页', kind: '点划线的文字，卡片没点开', detail: '' });
      if (getComputedStyle(card.querySelector('.card-input')).display === 'none') out.push({ where: '开头那页', kind: '点开的卡片没有追问框', detail: '' });
      // 选中样例回答里一段跨了粗体的文字，标记
      const t = sample().querySelector('.a-text');
      select(t.querySelector('strong').firstChild, 0, t.querySelector('code').firstChild, 2);
    },
    () => {
      const bar = document.getElementById('selbar');
      if (bar.hidden) { out.push({ where: '选中', kind: '选中文字后没出工具条', detail: '' }); return; }
      const n = sample().querySelectorAll('mark.hl').length;
      bar.querySelector('[data-sb="mark"]').click();
      if (sample().querySelectorAll('mark.hl').length <= n) out.push({ where: '选中', kind: '点「标记」没标上', detail: '' });
      // 在图里选中一段，问 Claude：侧栏出一张新卡片，带输入框
      const el = sample().querySelector('.v-cause .ca-n');
      select(el.firstChild, 0, el.firstChild, el.firstChild.data.length);
    },
    () => {
      // 标记过一次，页面整个重画了：一张图分几页亮的那块还停在第 2 页
      const st = layer();
      if (st && layerShown(st) !== '亮亮暗') out.push({ where: '一张图分几页亮', kind: '页面重画后没停在翻到的那一页', detail: layerShown(st) });
      saysKept('标记以后');
      const bar = document.getElementById('selbar');
      if (bar.hidden) { out.push({ where: '选中', kind: '在图里选中文字后没出工具条', detail: '' }); return; }
      bar.querySelector('[data-sb="note"]').click();
      saysKept('点「问 Claude」以后');
      const card = document.querySelector('#rail .card.on');
      if (!card || !card.querySelector('.card-input') || document.activeElement !== card.querySelector('.card-input')) out.push({ where: '选中', kind: '点「问 Claude」后侧栏没出新备注、或输入框没聚焦', detail: '' });
      if (cardsOverlap()) out.push({ where: '选中', kind: '新备注和别的卡片叠在一起', detail: '' });
      // 单击侧栏的卡片：展开成整页
      const c1 = document.querySelector('#rail .card[data-t="zz-t1"]');
      if (!c1.querySelector('[data-cpick]')) out.push({ where: '备注', kind: '卡片上没有标颜色的小圆圈', detail: '' });
      c1.querySelector('.card-quote').click();
    },
    () => {
      // 备注展开成整页
      if (!document.querySelector('#main .thread-head')) out.push({ where: '备注页', kind: '单击卡片没展开成整页（没显示引用的那段）', detail: '' });
      if (!document.querySelector('#main .qa[data-qa="zz-n1"]') || !document.querySelector('#main .qa[data-qa="zz-n2"]')) out.push({ where: '备注页', kind: '备注里的问答没显示', detail: '' });
      // 左边够宽时放全部的目录；不够宽时问答最上面放「这一页是怎么来的」。只显示其中一个
      const vis = (el) => !!el && el.offsetParent !== null;
      const toc = document.querySelector('#stream .toc'), inl = document.querySelector('#stream .trail.inline');
      if (vis(toc) === vis(inl)) out.push({ where: '备注页', kind: '左边的目录和问答上面的路径应该正好显示一个', detail: (vis(toc) ? '目录 ' : '') + (vis(inl) ? '路径' : '') });
      if (vis(toc)) {
        // 只列页：同一页里的追问不列；全部的页都在，这一页标出来
        if (toc.querySelector('[data-qa]')) out.push({ where: '目录', kind: '同一页里的追问也列进了目录', detail: '' });
        if (!toc.querySelector('.toc-i.now[data-go="zz-t1"]')) out.push({ where: '目录', kind: '没标出这一页', detail: '' });
        const i1 = toc.querySelector('.toc-i[data-go="zz-t1"]'), i2 = toc.querySelector('.toc-i[data-go="zz-t2"]');
        if (!i2 || !toc.querySelector('.toc-i[data-go=""]')) out.push({ where: '目录', kind: '没列出全部的页', detail: '' });
        // 从 zz-t1 里另开的 zz-t2 挂在它下面、往右缩一格；一页一行
        else {
          if (!i1.closest('li').contains(i2) || i2.getBoundingClientRect().left < i1.getBoundingClientRect().left + 8) out.push({ where: '目录', kind: '备注页没挂在它出自的那一页下面、往右缩进', detail: '' });
          // 大窗口里目录跟着放大了，按没放大的高度量
          if (i1.offsetHeight > 34) out.push({ where: '目录', kind: '一页占了不止一行', detail: '' });
        }
        // 贴着左边，离正文有空隙；不出滚动条
        if (toc.getBoundingClientRect().right > document.getElementById('main').getBoundingClientRect().left - 16) out.push({ where: '目录', kind: '目录贴着正文，太挤', detail: '' });
        if (toc.offsetWidth - toc.clientWidth > 0) out.push({ where: '目录', kind: '目录出了滚动条', detail: '' });
      }
      if (vis(inl)) {
        const li = inl.querySelectorAll('li');
        if (li.length !== 2 || !li[1].classList.contains('now') || !li[0].querySelector('button[data-go=""]')) out.push({ where: '备注页', kind: '「这一页是怎么来的」不对', detail: inl.textContent });
      }
      if (document.querySelectorAll('#crumbs .crumb').length !== 1) out.push({ where: '备注页', kind: '顶栏里还挤着整条路径', detail: document.getElementById('crumbs').textContent });
      // 在页顶给这一页标红：页顶、路径里这一页都变红
      const hp = document.querySelector('#main .thread-head [data-cpick]');
      if (!hp) out.push({ where: '颜色', kind: '备注页顶上没有标颜色的小圆圈', detail: '' });
      else {
        hp.click();
        const red = document.querySelector('#cpop:not([hidden]) [data-color="red"]');
        const n = document.querySelectorAll('#cpop .sw').length;
        if (n < 16) out.push({ where: '颜色', kind: '颜色太少，至少要 16 种', detail: '现在 ' + n + ' 种' });
        if (!red) out.push({ where: '颜色', kind: '点小圆圈没出色块', detail: '' });
        else {
          red.click();
          if (!document.getElementById('cpop').hidden) out.push({ where: '颜色', kind: '选了颜色，色块没收起', detail: '' });
          if (!document.querySelector('#main .thread-head[data-tag="red"]')) out.push({ where: '颜色', kind: '标了红，页顶没变红', detail: '' });
          if (!document.querySelector('#stream .trail li.now[data-tag="red"]') || !document.querySelector('#stream .toc-i[data-go="zz-t1"][data-tag="red"]')) out.push({ where: '颜色', kind: '标了红，路径或目录里这一页没变红', detail: '' });
          // 页顶引用那段放进一个淡红色块；页面背景不动，也不用渐变
          const RED = 'rgb(254, 235, 236)';
          const hd = getComputedStyle(document.querySelector('#main .thread-head'));
          if (hd.backgroundColor !== RED) out.push({ where: '颜色', kind: '标了红，页顶引用那段没放进淡红色块', detail: hd.backgroundColor });
          const sc = getComputedStyle(document.getElementById('stream-scroll'));
          if (sc.backgroundColor !== 'rgba(0, 0, 0, 0)' || sc.backgroundImage !== 'none') out.push({ where: '颜色', kind: '标了色的页，整个页面背景也变了色', detail: sc.backgroundColor + ' ' + sc.backgroundImage.slice(0, 40) });
        }
      }
      if (!document.querySelector('#rail .card[data-t="zz-t2"]')) out.push({ where: '备注页', kind: '备注的备注没显示在侧栏', detail: '' });
      if (document.querySelector('#rail .card.on')) out.push({ where: '备注页', kind: '换页后上一页的新备注还在', detail: '' });
      checkStream('备注页');
      document.getElementById('btn-map').click();
    },
    () => {
      const mv = document.getElementById('mapview');
      if (mv.hidden) { out.push({ where: '地图', kind: '没打开', detail: '' }); return; }
      // 一页一块：zz-t1 这一页只有一块，块里按先后是 zz-n1、zz-n2；跳到这一页的东西都在这块里，不会有第二个节点
      const blk = mv.querySelectorAll('.mblock[data-t="zz-t1"]');
      if (blk.length !== 1 || !mv.querySelector('.mblock[data-t="zz-t2"]')) out.push({ where: '地图', kind: '一页应该正好一块', detail: 'zz-t1 有 ' + blk.length + ' 块' });
      else {
        const rows = [...blk[0].querySelectorAll('.mb-q')].map((r) => r.dataset.qa);
        if (rows.join() !== 'zz-n1,zz-n2') out.push({ where: '地图', kind: '块里的问题不对或不是按先后排', detail: rows.join() });
        if ([...mv.querySelectorAll('[data-go="zz-t1"]')].some((el) => !blk[0].contains(el))) out.push({ where: '地图', kind: '块外面还有跳到同一页的节点', detail: '' });
        if (!blk[0].classList.contains('cur')) out.push({ where: '地图', kind: '没标出现在在哪一页', detail: '' });
      }
      if (!mv.querySelector('.mblock[data-t="zz-t2"] .mb-q[data-qa="zz-n3"]')) out.push({ where: '地图', kind: '备注的备注不在地图里', detail: '' });
      // 从 zz-n1 那一行往右分出 zz-t2 这一块
      if (!mv.querySelector('path[data-from="zz-n1"][data-to="t:zz-t2"]')) out.push({ where: '地图', kind: '备注不是从它出自的那一行分出去的', detail: '' });
      const box = (el) => ({ l: parseFloat(el.style.left), t: parseFloat(el.style.top), w: el.offsetWidth, h: el.offsetHeight });
      const all = [...mv.querySelectorAll('.mblock, .mn')].map(box);
      const hit = all.some((p, i) => all.some((q, j) => j > i && p.l < q.l + q.w && q.l < p.l + p.w && p.t < q.t + q.h && q.t < p.t + p.h));
      if (hit) out.push({ where: '地图', kind: '地图里有块叠在一起', detail: '' });
      // 颜色：页顶标的红，地图里那一页整块是淡红；在地图里给另一页标绿，地图不关、就地变绿
      const rb = mv.querySelector('.mblock[data-t="zz-t1"][data-tag="red"]');
      if (!rb) out.push({ where: '颜色', kind: '页顶标的红，地图里没显示', detail: '' });
      else if (getComputedStyle(rb).backgroundColor !== 'rgb(254, 235, 236)') out.push({ where: '颜色', kind: '地图里标了红的那一页，没有整块上色', detail: '' });
      const mp = mv.querySelector('.mcpick[data-cpick="zz-t2"]');
      if (!mp) out.push({ where: '颜色', kind: '地图里的块没有标颜色的小圆圈', detail: '' });
      else {
        mp.click();
        const g = document.querySelector('#cpop:not([hidden]) [data-color="green"]');
        if (!g) out.push({ where: '颜色', kind: '地图里点小圆圈没出色块', detail: '' });
        else {
          g.click();
          if (mv.hidden) out.push({ where: '颜色', kind: '在地图里标颜色，地图关掉了', detail: '' });
          if (!mv.querySelector('.mblock[data-t="zz-t2"][data-tag="green"]')) out.push({ where: '颜色', kind: '在地图里标了绿，那一块没变绿', detail: '' });
        }
      }
      mv.querySelector('.mb-q[data-qa="zz-check"]').click();
    },
    () => {
      if (!document.getElementById('mapview').hidden) out.push({ where: '地图', kind: '点了一行没关', detail: '' });
      if (document.querySelector('#main .thread-head') || !document.querySelector('#main .qa[data-qa="zz-check"]')) out.push({ where: '地图', kind: '点问题没跳回它那一页', detail: '' });
      if (!document.querySelector('#rail .card[data-t="zz-t1"][data-tag="red"]') || !document.querySelector('#main .cm[data-t="zz-t1"][data-tag="red"]')) out.push({ where: '颜色', kind: '标了红的备注，卡片或原文里划线的那段没变红', detail: '' });
      else if (getComputedStyle(document.querySelector('#rail .card[data-t="zz-t1"]')).backgroundColor !== 'rgb(254, 235, 236)') out.push({ where: '颜色', kind: '标了红的卡片，没有整块上色', detail: '' });
      if (document.getElementById('stream-scroll').dataset.tag) out.push({ where: '颜色', kind: '回到没标色的开头那一页，背景还带着颜色', detail: '' });
      pageScroll('来回跳之后');
      // 点一处已有的标记：要出「取消标记」，松开鼠标后的那次检查不能把工具条收回去
      if (!question().querySelector('mark.hl')) out.push({ where: '标记', kind: '存下的问题标记没显示', detail: '' });
      const mk = sample().querySelector('mark.hl');
      if (!mk) { out.push({ where: '标记', kind: '找不到回答里已有的标记', detail: '' }); return; }
      getSelection().removeAllRanges();
      mk.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      mk.click();
      // 工具条出来后页面滚了一下（比如刚跳过来、回答正在往下写）：工具条要还在
      document.getElementById('stream-scroll').dispatchEvent(new Event('scroll'));
    },
    () => {
      const bar = document.getElementById('selbar');
      const un = !bar.hidden && bar.querySelector('[data-sb="unmark"]');
      if (!un) { out.push({ where: '标记', kind: '点标记后没出「取消标记」（或一出来就被收回去了）', detail: '' }); return; }
      const n = sample().querySelectorAll('mark.hl').length;
      un.click();
      if (sample().querySelectorAll('mark.hl').length >= n) out.push({ where: '标记', kind: '点「取消标记」没取消', detail: '' });
      selectText(question(), 6, 9);
    },
    () => {
      const bar = document.getElementById('selbar');
      if (bar.hidden) { out.push({ where: '标记', kind: '在问题里选中文字后没出工具条', detail: '' }); return; }
      if (bar.querySelector('[data-sb="note"]')) out.push({ where: '标记', kind: '问题里的工具条不该有「问 Claude」', detail: '' });
      const n = question().querySelectorAll('mark.hl').length;
      bar.querySelector('[data-sb="mark"]').click();
      if (question().querySelectorAll('mark.hl').length <= n) out.push({ where: '标记', kind: '在问题里点「标记」没标上', detail: '' });
      document.getElementById('btn-map').click();
    },
    () => {
      const mv = document.getElementById('mapview');
      if (!mv.querySelector('.mn.mmark[data-qa="zz-check"][data-in="q"]')) out.push({ where: '地图', kind: '问题里的标记不在地图里', detail: '' });
      // 按住右键拖动：导图跟着鼠标挪，不出右键菜单。先把可见区域缩小，保证图比它大、挪得动
      const sc = document.getElementById('map-scroll');
      sc.style.cssText = 'flex:none;width:240px;height:160px';
      sc.scrollLeft = 100; sc.scrollTop = 20;
      const l0 = sc.scrollLeft, t0 = sc.scrollTop;
      const pe = (type, x, y, buttons) => sc.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: type === 'pointermove' ? -1 : 2, buttons, clientX: x, clientY: y }));
      pe('pointerdown', 200, 200, 2);
      pe('pointermove', 150, 170, 2);
      pe('pointerup', 150, 170, 0);
      if (sc.scrollLeft !== l0 + 50 || sc.scrollTop !== t0 + 30) out.push({ where: '地图', kind: '按住右键拖动，地图没跟着挪', detail: '横 ' + l0 + '→' + sc.scrollLeft + '，竖 ' + t0 + '→' + sc.scrollTop });
      if (sc.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))) out.push({ where: '地图', kind: '在地图里点右键还会出右键菜单', detail: '' });
      sc.style.cssText = '';
      const a = mv.querySelector('.mn.mmark[data-qa="zz-check"][data-in="a"]');
      if (!a) { out.push({ where: '地图', kind: '回答里的标记不在地图里', detail: '' }); return; }
      a.click();
    },
    () => {
      if (!document.getElementById('mapview').hidden) out.push({ where: '地图', kind: '点了标记节点没关', detail: '' });
      const f = document.querySelector('#main .flash');
      if (!f || !(f.matches('.hl') || f.querySelector('.hl'))) out.push({ where: '地图', kind: '点了标记节点，没跳到那处标记', detail: '' });
      // 返回：一步步退回去。这一步是在同一页里跳到标记，退一步还在开头那一页
      const b = document.getElementById('btn-back');
      if (!b || b.disabled) { out.push({ where: '返回', kind: '跳过几次了，「返回」还是灰的', detail: '' }); return; }
      b.click();
    },
    () => {
      if (document.querySelector('#main .thread-head')) out.push({ where: '返回', kind: '在同一页里跳过去，退一步却换了页', detail: '' });
      document.getElementById('btn-back').click();
    },
    () => {
      if (!document.querySelector('#main .thread-head') || !document.querySelector('#stream .trail li.now')) out.push({ where: '返回', kind: '没退回之前看的备注页', detail: '' });
      document.getElementById('btn-map').click();
    },
    () => {
      const b = document.getElementById('btn-back');
      if (b.disabled) { out.push({ where: '返回', kind: '开着地图时「返回」是灰的', detail: '' }); return; }
      b.click();
      if (!document.getElementById('mapview').hidden) out.push({ where: '返回', kind: '开着地图时点「返回」没关上地图', detail: '' });
      if (!document.querySelector('#main .thread-head')) out.push({ where: '返回', kind: '关地图时换了页', detail: '' });
      b.click();
    },
    () => {
      if (document.querySelector('#main .thread-head')) out.push({ where: '返回', kind: '没退回开头那一页', detail: '' });
      // 退到进项目的第一步：「返回」还能点，带人出项目（回首页或这门课的页），不是灰的
      const bb = document.getElementById('btn-back');
      if (bb.disabled || !/^回到(首页|这门课的每一集)$/.test(bb.title)) out.push({ where: '返回', kind: '退到最开始了，「返回」是灰的或不带人出项目', detail: bb.title });
      // 左边的目录：回到开头那页，下面几级还在；点更深一层的页，跳过去
      const toc = document.querySelector('#stream .toc');
      if (!toc || !toc.querySelector('.toc-i[data-go="zz-t2"]')) { out.push({ where: '目录', kind: '回到开头那页后，下面几级不见了', detail: '' }); return; }
      if (!toc.querySelector('.toc-i.now[data-go=""]')) out.push({ where: '目录', kind: '在开头那页，没标出这一页', detail: '' });
      toc.querySelector('.toc-i[data-go="zz-t2"]').click();
    },
    () => {
      if (!document.querySelector('#main .thread-head') || !document.querySelector('#main .qa[data-qa="zz-n3"]')) out.push({ where: '目录', kind: '点目录里的一页，没跳过去', detail: '' });
      if (!document.querySelector('#stream .toc .toc-i.now[data-go="zz-t2"]') || !document.querySelector('#stream .toc .toc-i[data-go="zz-t1"]')) out.push({ where: '目录', kind: '跳过去以后目录不全，或没标出这一页', detail: '' });
      document.querySelector('#crumbs .crumb').click();
    },
    () => {
      // 往上走（点标题回开头那一页）不记新的一步，退回之前在开头那一页的那一步；不然「返回」会把人带回刚离开的备注页
      if (document.querySelector('#main .thread-head')) out.push({ where: '返回', kind: '点标题没回到开头那一页', detail: '' });
      if (!history.state || history.state.i !== 0) out.push({ where: '返回', kind: '点标题回开头那一页，多记了一步，「返回」会绕回刚离开的备注页', detail: 'i=' + (history.state && history.state.i) });
      // 新标签页直接打开一页备注的备注（没有上一步可退）：「返回」一层层往上走
      history.replaceState({ i: 0, t: 'zz-t2', pages: [] }, '', '#t=zz-t2');
      dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    },
    () => {
      const b = document.getElementById('btn-back');
      if (!document.querySelector('#main .qa[data-qa="zz-n3"]')) { out.push({ where: '返回', kind: '没打开备注的备注那一页', detail: '' }); return; }
      if (b.disabled) out.push({ where: '返回', kind: '直接打开的备注页，「返回」是灰的', detail: '' });
      b.click();
    },
    () => {
      if (!document.querySelector('#main .thread-head') || !document.querySelector('#main .qa[data-qa="zz-n1"]')) out.push({ where: '返回', kind: '直接打开的备注页点「返回」，没回到它出自的那一页', detail: '' });
      document.getElementById('btn-back').click();
    },
    () => {
      if (document.querySelector('#main .thread-head') || !document.querySelector('#main .qa[data-qa="zz-check"]')) out.push({ where: '返回', kind: '再点「返回」，没回到开头那一页', detail: '' });
      if (!history.state || history.state.i !== 0) out.push({ where: '返回', kind: '一层层往上走时多记了步', detail: 'i=' + (history.state && history.state.i) });
    },
    () => {
      // 复述：复述过的白框，右上角的图标一直显示；没复述过的，鼠标不在上面时不显示。图标里没有字，提示是「复述」
      const ic = sample().querySelector('.rt[data-retell="zz-check"]');
      if (!ic) { out.push({ where: '复述', kind: '白框右上角没有复述图标', detail: '' }); return; }
      if (/\S/.test(ic.textContent)) out.push({ where: '复述', kind: '复述图标里有字，会混进回答的文字', detail: ic.textContent });
      if (ic.dataset.tip !== '复述') out.push({ where: '复述', kind: '复述图标的提示不是「复述」', detail: ic.dataset.tip || '' });
      if (!ic.classList.contains('on') || getComputedStyle(ic).opacity !== '1') out.push({ where: '复述', kind: '复述过的白框，图标没有一直显示', detail: '' });
      const other = document.querySelector('#main .rt:not(.on)');
      if (other && matchMedia('(hover: hover)').matches && getComputedStyle(other).opacity !== '0') out.push({ where: '复述', kind: '没复述过的白框，鼠标不在上面时图标也显示着', detail: '' });
      const a = sample().getBoundingClientRect(), b = ic.getBoundingClientRect();
      if (Math.abs(b.right - a.right) > 20 || Math.abs(b.top - a.top) > 20) out.push({ where: '复述', kind: '复述图标不在白框右上角', detail: '' });
      if (document.getElementById('btn-retells').hidden) out.push({ where: '复述', kind: '有过复述，顶栏没有「复述」', detail: '' });
      ic.click();
    },
    () => {
      // 复述页：看不到原来的回答；里面的问答都在；每张自己画的图都能收进思维模型，收过的标出来
      if (!document.querySelector('#main .rt-head')) { out.push({ where: '复述页', kind: '点复述图标，没打开那页复述', detail: '' }); return; }
      if (!document.querySelector('#main .qa[data-qa="zz-r1"]') || !document.querySelector('#main .qa[data-qa="zz-r2"]')) out.push({ where: '复述页', kind: '复述页里的问答没显示', detail: '' });
      if (document.querySelector('#main .qa[data-qa="zz-check"]')) out.push({ where: '复述页', kind: '复述页里还看得到原来的回答', detail: '' });
      if (document.querySelector('#main .rt')) out.push({ where: '复述页', kind: '复述页里的回答也有复述图标', detail: '' });
      const keeps = document.querySelectorAll('#main .qa[data-qa="zz-r1"] .keep');
      if (keeps.length !== 2) out.push({ where: '复述页', kind: '复述页里每张自己画的图都要能收进思维模型', detail: '有 ' + keeps.length + ' 个' });
      if (!document.querySelector('#main .keep.on[data-i="2"]') || document.querySelector('#main .keep.on[data-i="1"]')) out.push({ where: '复述页', kind: '收进思维模型的图没标对', detail: '' });
      if ([...keeps].some((k) => /\S/.test(k.textContent))) out.push({ where: '复述页', kind: '收进思维模型的按钮里有字，会混进回答的文字', detail: '' });
      const vis = (el) => !!el && el.offsetParent !== null;
      const toc = document.querySelector('#stream .toc'), inl = document.querySelector('#stream .trail.inline');
      if (vis(toc)) {
        const gos = [...toc.querySelectorAll('.toc-i')].map((x) => x.dataset.go);
        if (!toc.querySelector('.toc-i.now[data-go="zz-rt"]') || gos.indexOf('~r') < 0 || gos.indexOf('~r') > gos.indexOf('zz-rt')) out.push({ where: '目录', kind: '复述页没挂在「复述」下面，或没标出这一页', detail: gos.join() });
      }
      if (vis(inl)) {
        const li = inl.querySelectorAll('li');
        if (li.length !== 3 || !li[2].classList.contains('now') || !li[1].querySelector('[data-go="~r"]')) out.push({ where: '复述页', kind: '「这一页是怎么来的」不是 开头 → 复述 → 这一页', detail: inl.textContent });
      }
      checkStream('复述页');
      document.querySelector('#main .keep[data-i="1"]').click();
    },
    () => {
      const k = document.querySelector('#main .keep[data-i="1"]');
      if (!k || !k.classList.contains('on')) { out.push({ where: '复述页', kind: '点「收进思维模型」没收进', detail: '' }); return; }
      if (k.dataset.tip !== '已收进思维模型') out.push({ where: '复述页', kind: '收进以后提示没变', detail: k.dataset.tip || '' });
      k.click();
      if (document.querySelector('#main .keep.on[data-i="1"]')) out.push({ where: '复述页', kind: '再点一下没取消', detail: '' });
      document.querySelector('#main [data-goqa="zz-check"]').click();
    },
    () => {
      if (document.querySelector('#main .rt-head') || !document.querySelector('#main .qa[data-qa="zz-check"]')) { out.push({ where: '复述页', kind: '点「看原回答」没回到原来的白框', detail: '' }); return; }
      const f = document.querySelector('#main .flash');
      if (!f || !f.closest('.qa[data-qa="zz-check"]')) out.push({ where: '复述页', kind: '回到原来的白框，没闪一下', detail: '' });
      document.getElementById('btn-retells').click();
    },
    () => {
      // 复述合集：这个项目所有的复述，一次一张卡片；这一页上没有输入框
      if (!document.querySelector('#main .rt-list .rt-card[data-go="zz-rt"]')) out.push({ where: '复述合集', kind: '合集里没有这次复述', detail: '' });
      if (!document.getElementById('ask-form').hidden) out.push({ where: '复述合集', kind: '合集页上还有输入框', detail: '' });
      if (!document.getElementById('btn-retells').classList.contains('on')) out.push({ where: '复述合集', kind: '在合集页上，顶栏的「复述」没标出来', detail: '' });
      checkStream('复述合集');
      const c = document.querySelector('.rt-card[data-go="zz-rt"]');
      if (c) c.click();
    },
    () => {
      if (!document.querySelector('#main .rt-head')) out.push({ where: '复述合集', kind: '点一张卡片没打开那页复述', detail: '' });
      if (document.getElementById('ask-form').hidden) out.push({ where: '复述页', kind: '复述页没有输入框', detail: '' });
      document.querySelector('#stream .toc .toc-i[data-go="zz-t1"]').click();
    },
    () => {
      // 没复述过的回答：点图标，开一页新的复述，还没有问答，输入框请他用自己的话讲
      const ic = document.querySelector('#main .qa[data-qa="zz-n1"] .rt');
      if (!ic) { out.push({ where: '复述', kind: '备注页里的回答没有复述图标', detail: '' }); return; }
      if (ic.classList.contains('on')) out.push({ where: '复述', kind: '没复述过的回答，图标显示成复述过了', detail: '' });
      ic.click();
    },
    () => {
      const head = document.querySelector('#main .rt-head');
      if (!head) { out.push({ where: '新复述', kind: '点没复述过的回答上的图标，没开一页新的复述', detail: '' }); return; }
      if (document.querySelector('#main .qa')) out.push({ where: '新复述', kind: '新开的复述页里不该有问答', detail: '' });
      if (!head.querySelector('[data-goqa="zz-n1"]')) out.push({ where: '新复述', kind: '新开的复述页没连回原来的回答', detail: '' });
      if (document.getElementById('ask-form').hidden || document.getElementById('ask-input').placeholder !== '用自己的话讲讲') out.push({ where: '新复述', kind: '新开的复述页，输入框不对', detail: document.getElementById('ask-input').placeholder });
      document.getElementById('main').click();
    },
    () => {
      if (!document.querySelector('#main .rt-head')) { out.push({ where: '新复述', kind: '在新开的复述页里点一下空白，这一页就没了', detail: '' }); return; }
      document.getElementById('btn-back').click();
    },
    () => {
      if (document.querySelector('#main .rt-head') || !document.querySelector('#main .qa[data-qa="zz-n1"]')) out.push({ where: '新复述', kind: '从新开的复述页「返回」，没回到原来那页', detail: '' });
      const ic = document.querySelector('#main .qa[data-qa="zz-n1"] .rt');
      if (ic && ic.classList.contains('on')) out.push({ where: '新复述', kind: '一句没说就走了，图标却显示成复述过了', detail: '' });
      history.forward();
    },
    () => {
      if (!document.querySelector('#main .rt-head [data-goqa="zz-n1"]')) out.push({ where: '新复述', kind: '「返回」后再前进，那页新开的复述没回来', detail: '' });
      document.querySelector('#crumbs .crumb').click();
    },
    () => {
      // 删除备注：侧栏卡片上平时不露「删除」；点一下只变成「确定删除」，下面还挂着备注就说一共几条；点别处恢复
      const card = document.querySelector('#rail .card[data-t="zz-t1"]');
      const d = card && card.querySelector('[data-del="zz-t1"]');
      if (!d) { out.push({ where: '删除备注', kind: '侧栏卡片上没有「删除」', detail: '' }); return; }
      if (!card.classList.contains('on') && getComputedStyle(d).visibility !== 'hidden') out.push({ where: '删除备注', kind: '没点开的卡片上「删除」一直露着', detail: '' });
      d.click();
      const a = document.querySelector('#rail [data-del="zz-t1"]');
      if (!document.querySelector('#rail .card[data-t="zz-t1"]')) out.push({ where: '删除备注', kind: '点一下「删除」就删了，没让确定', detail: '' });
      if (!a || !a.classList.contains('arm') || a.textContent !== '连下面 1 条备注一起删' || getComputedStyle(a).visibility === 'hidden') out.push({ where: '删除备注', kind: '点一下「删除」，没变成「确定删除」，或没说下面还挂着几条备注', detail: a ? a.textContent : '' });
      document.getElementById('main').click();
      const b = document.querySelector('#rail [data-del="zz-t1"]');
      if (!b || b.classList.contains('arm') || b.textContent !== '删除') out.push({ where: '删除备注', kind: '点到别处，「确定删除」没恢复', detail: b ? b.textContent : '' });
      document.querySelector('#stream .toc .toc-i[data-go="zz-t2"]').click();
    },
    () => {
      // 备注页顶上也能删：点两下，删完回到它出自的那一页
      const d = document.querySelector('#main .thread-head [data-del="zz-t2"]');
      if (!d) { out.push({ where: '删除备注', kind: '备注页顶上没有「删除」', detail: '' }); return; }
      d.click();
      const a = document.querySelector('#main .thread-head [data-del="zz-t2"]');
      if (!a || a.textContent !== '确定删除') out.push({ where: '删除备注', kind: '备注页顶上点一下「删除」，没变成「确定删除」', detail: a ? a.textContent : '' });
      if (a) a.click();
    },
    () => {
      if (document.querySelector('#main .qa[data-qa="zz-n3"]') || !document.querySelector('#main .qa[data-qa="zz-n1"]')) out.push({ where: '删除备注', kind: '在备注页上删掉它，没回到它出自的那一页', detail: '' });
      if (document.querySelector('#rail .card[data-t="zz-t2"], #stream .toc .toc-i[data-go="zz-t2"], #main .cm[data-t="zz-t2"]')) out.push({ where: '删除备注', kind: '删掉的备注还在侧栏、目录或原文的划线里', detail: '' });
      document.querySelector('#crumbs .crumb').click();
    },
    () => {
      const d = document.querySelector('#rail [data-del="zz-t1"]');
      if (!d) { out.push({ where: '删除备注', kind: '开头那一页的卡片上没有「删除」', detail: '' }); return; }
      d.click();
      document.querySelector('#rail [data-del="zz-t1"]').click();
      if (document.querySelector('#rail .card[data-t="zz-t1"], #stream .toc .toc-i[data-go="zz-t1"], #main .cm[data-t="zz-t1"]')) out.push({ where: '删除备注', kind: '点两下「删除」，卡片、目录里的那一页或原文的划线还在', detail: '' });
      if (!document.querySelector('#main .qa[data-qa="zz-check"]')) out.push({ where: '删除备注', kind: '删了备注，原来的回答也不见了', detail: '' });
      checkStream('删除备注以后');
    },
  ];
  let i = 0;
  function next() {
    if (i === steps.length) {
      for (const e of window.__VL_ERRORS) out.push({ where: '-', kind: '脚本报错', detail: e });
      const pre = document.createElement('pre');
      pre.id = 'vl-check';
      pre.textContent = JSON.stringify(out);
      document.body.appendChild(pre);
      return;
    }
    try { steps[i++](); } catch (e) { out.push({ where: '-', kind: '检查脚本出错', detail: String(e) }); }
    setTimeout(next, 400);
  }
  setTimeout(next, 2500);
})();
</script>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vl-check-'));
const file = path.join(tmp, 'index.html');
fs.writeFileSync(file, pageHtml.replace('<div class="app"', probe + '\n<div class="app"').replace(/<\/html>\s*$/, runner + '\n</html>\n'));

let total = 0;
for (const [label, size] of [['宽屏', '1500,900'], ['中等窗口', '1143,1000'], ['大屏', '2048,1100'], ['手机', '390,844']]) {
  let dom = '';
  try {
    dom = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--window-size=${size}`, '--virtual-time-budget=20000', '--dump-dom', 'file://' + file],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120000 });
  } catch (e) {
    console.error(`${label}：Chrome 没跑完（${e.message.split('\n')[0]}）`);
    total++;
    continue;
  }
  const m = dom.match(/<pre id="vl-check">([\s\S]*?)<\/pre>/);
  if (!m) { console.error(`${label}：没拿到检查结果，页面可能没加载完。`); total++; continue; }
  const issues = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
  const seen = new Set();
  const uniq = issues.filter((x) => { const k = x.where + x.kind + x.detail; if (seen.has(k)) return false; seen.add(k); return true; });
  if (!uniq.length) { console.log(`${label}（${size.replace(',', '×')}）：没问题。自己画的图和现成格式都画出来了，边讲边画的图话在图里、翻过去变淡；备注对齐、能点开、单击能展开成整页、能标颜色；左边的目录只列页、一页一行、备注页缩进、不贴正文；没有备注的页在窗口正中，大窗口里跟着放大；能标记、能取消标记、问题里也能标记、能加新备注；地图一页一块、能跳，标记在地图里、点了能跳到那处标记，按住右键能拖动地图；「返回」能一步步退回去，往上走不多记步，直接打开的备注页一层层往上，退到头带人出项目；复述图标、复述页、收进思维模型、复述合集、新开复述都对；备注能删，点两下才删，连同下面挂着的一起删。`); continue; }
  total += uniq.length;
  console.log(`${label}（${size.replace(',', '×')}）：${uniq.length} 处问题`);
  for (const x of uniq) console.log(`- [${x.where}] ${x.kind}${x.detail ? '：' + x.detail : ''}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(total ? 1 : 0);

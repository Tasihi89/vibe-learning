// 学习页的生成和检查。服务每次打开一个学习项目，都用这里现场把 topic.json 和回答格式（answer-spec.md）
// 填进 template.html；改了模板，所有项目下次打开就是新的。build.mjs、check.mjs 也用这里。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const str = (v) => typeof v === 'string' && v.trim();
const arr = (v) => (Array.isArray(v) ? v : []);

// 嵌进 <script> 里的 JSON：转义 <，避免内容里的 </script> 提前结束脚本
export const embed = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// 学习页：模板 + 这个项目的 topic.json + 回答格式
export function renderTopic(dir) {
  const topic = readJson(path.join(dir, 'topic.json'));
  if (!topic) return null;
  const spec = fs.readFileSync(path.join(HERE, 'answer-spec.md'), 'utf8');
  const template = fs.readFileSync(path.join(HERE, 'template.html'), 'utf8');
  return '<!DOCTYPE html>\n<html lang="zh-CN">\n' + template
    .replace('__TITLE__', () => escapeHtml(topic.title || 'Vibe Learning'))
    .replace('__TOPIC_JSON__', () => embed(topic))
    .replace('__SPEC_JSON__', () => embed(spec)) + '\n</html>\n';
}

// 页面代码最后改动的时间：模板或回答格式改了，开着的页面就刷新
export function codeRev() {
  const m = (f) => { try { return fs.statSync(path.join(HERE, f)).mtimeMs; } catch { return 0; } };
  return Math.max(m('template.html'), m('answer-spec.md'), m('home.html'));
}

// 首页用：每个学习项目的标题、问了几个问题、最后问的是什么、什么时候
const topicDirs = (root) => { try { return fs.readdirSync(root).filter((d) => SLUG.test(d) && fs.existsSync(path.join(root, d, 'topic.json'))); } catch { return []; } };
function readQAs(root, slug) {
  try {
    return fs.readdirSync(path.join(root, slug, 'data', 'qa')).filter((n) => n.endsWith('.json'))
      .map((n) => readJson(path.join(root, slug, 'data', 'qa', n))).filter((q) => q && str(q.q));
  } catch { return []; /* 还没有问答 */ }
}
export function listTopics(root) {
  return topicDirs(root).map((slug) => {
    const topic = readJson(path.join(root, slug, 'topic.json')) ?? {};
    const qas = readQAs(root, slug);
    qas.sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')));
    // 复述页里说的话不算问题；什么时候用过，复述也算。课程项目里预先放好的笔记（带 lesson）不算问题
    const retold = new Set(qas.filter((q) => q.retell && q.thread).map((q) => q.thread));
    const asked = qas.filter((q) => !retold.has(q.thread) && !q.lesson);
    const last = asked[asked.length - 1];
    return {
      slug,
      title: str(topic.title) ? topic.title : slug,
      scope: str(topic.scope) ? topic.scope : '',
      count: asked.length,
      last: last ? last.q : '',
      at: qas[qas.length - 1]?.at || topic.createdAt || '',
      preparing: !!topic.preparing,
      // 课程项目：属于哪门课、第几集。首页把同一门课的几集收成一张卡片，点进去是这门课的页
      course: topic.course && str(topic.course.name) ? { id: str(topic.course.id) ? topic.course.id : topic.course.name, name: topic.course.name, no: topic.course.no, total: topic.course.total, teacher: topic.course.teacher || '', duration: topic.course.duration || '' } : null,
    };
  }).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// 首页用：学习者在复述页里收进来的思维模型（图上记着 kept），所有项目的，最近收的在前
export function listModels(root) {
  const out = [];
  for (const slug of topicDirs(root)) {
    const topic = readJson(path.join(root, slug, 'topic.json')) ?? {};
    for (const qa of readQAs(root, slug)) {
      arr(qa.blocks).forEach((b, i) => {
        if (b?.t !== 'view' || b.kind !== 'draw' || !str(b.kept) || !str(b.svg)) return;
        out.push({ slug, project: str(topic.title) ? topic.title : slug, qa: qa.id, thread: qa.thread || '', i, title: str(b.title) ? b.title : '', alt: str(b.alt) ? b.alt : '', svg: b.svg, at: b.kept });
      });
    }
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// 检查一个项目的 topic.json 和问答。页面会尽量照样显示，这里只给提醒
const KINDS = ['draw', 'steps', 'tree', 'web', 'flow', 'compare', 'cause', 'analogy', 'layers', 'instance', 'timeline', 'scale', 'formula'];
const WREL = ['contains', 'partOf', 'isa', 'kind', 'needs', 'usedBy', 'causes', 'because', 'contrast', 'extends', 'example'];

export function checkTopic(dir) {
  const errors = [];
  const warnings = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  const topic = readJson(path.join(dir, 'topic.json'));
  if (!topic) return { errors: [`读不了 ${path.join(dir, 'topic.json')}`], warnings, count: 0 };
  need(SLUG.test(topic.slug ?? ''), 'slug 只能用小写字母、数字和连字符');
  need(path.basename(dir) === topic.slug, `slug「${topic.slug}」要和目录名「${path.basename(dir)}」一样`);
  need(str(topic.title), '缺 title');
  need(str(topic.learner), '缺 learner：学习者是谁、会什么、为什么学');
  if (!str(topic.scope)) warnings.push('没有 scope：这次想弄懂什么，一句话');
  if (topic.sources != null) need(Array.isArray(topic.sources) && topic.sources.every((s) => str(s?.path) || str(s?.url)), 'sources 每一项要有 path 或 url');
  if (!str(topic.brief)) warnings.push('没有 brief（底稿）：网页上的 AI 只能靠自己的知识和现查');
  if (!topic.course && (!Array.isArray(topic.starters) || !topic.starters.length)) warnings.push('没有 starters：2 到 4 个可以从这里问起的问题');

  let files = [];
  try { files = fs.readdirSync(path.join(dir, 'data', 'qa')).filter((n) => n.endsWith('.json')); } catch { /* 还没有问答 */ }
  const ids = new Set(files.map((n) => n.slice(0, -5)));
  for (const n of files) {
    let qa;
    try { qa = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'qa', n), 'utf8')); } catch (e) { errors.push(`问答 ${n}：不是合法 JSON（${e.message}）`); continue; }
    const at = `问答 ${n}`;
    if (!str(qa.id) || qa.id + '.json' !== n) errors.push(`${at}：id 要和文件名一样`);
    if (!str(qa.q)) errors.push(`${at}：缺 q（问题）`);
    if (!str(qa.at)) errors.push(`${at}：缺 at（时间）`);
    if (qa.retell != null && (!str(qa.retell.qa) || !str(qa.thread))) errors.push(`${at}：retell 要有 qa，问答要有 thread`);
    else if (qa.retell && !ids.has(qa.retell.qa)) warnings.push(`${at}：复述的那个回答（${qa.retell.qa}）找不到了`);
    const blocks = Array.isArray(qa.blocks) ? qa.blocks : [];
    if (!blocks.length) errors.push(`${at}：blocks 是空的`);
    if (!blocks.some((b) => b?.t === 'view') && !qa.lesson) warnings.push(`${at}：没有可视化（view）`);
    blocks.forEach((b, i) => checkBlock(b, `${at} 第 ${i + 1} 块`, warnings));
  }
  return { errors, warnings, count: files.length };
}

function checkBlock(b, at, warnings) {
  if (!b || !['text', 'view', 'saved', 'img', 'fold'].includes(b.t)) { warnings.push(`${at}：t 只能是 text / view / saved / img / fold`); return; }
  if (b.t === 'text' && !str(b.md)) warnings.push(`${at}：text 缺 md`);
  if (b.t === 'img' && !(Array.isArray(b.items) && b.items.length && b.items.every((it) => str(it?.src)))) warnings.push(`${at}：img 要有 items，每一项要有 src`);
  if (b.t === 'fold' && (!str(b.title) || !str(b.md))) warnings.push(`${at}：fold 要有 title 和 md`);
  if (b.t !== 'view') return;
  if (!KINDS.includes(b.kind)) { warnings.push(`${at}：kind「${b.kind}」不认识，只能是 ${KINDS.join(' / ')}`); return; }
  const list = (v) => (Array.isArray(v) ? v : []);
  const bad = (msg) => warnings.push(`${at}（${b.kind}）：${msg}`);
  const k = b.kind;
  const svgOk = (svg, where) => {
    if (!/^\s*<svg[\s>]/i.test(svg ?? '')) bad(where + 'svg 要是一个完整的 <svg>');
    else if (!/viewBox=/.test(svg)) bad(where + 'svg 要写 viewBox');
    if (String(svg ?? '').length > 30000) bad(where + 'svg 太大了（超过 30KB）');
  };
  if (k === 'draw') svgOk(b.svg, '');
  if (k === 'steps') {
    const n = list(b.steps).length;
    if (n < 2) bad('steps 至少两步');
    if (typeof b.svg === 'string') {
      // 一张图分几页亮出来：图里的东西标 data-step="2"（第 2 页起）或 "2-3"（只在这几页），每一步只写说明
      svgOk(b.svg, '');
      list(b.steps).forEach((s, i) => { if (!str(s?.md) && !str(s?.say)) bad(`第 ${i + 1} 步缺 say（画在图里的那句话）或 md（图上面的说明）`); });
      const marks = [...b.svg.matchAll(/data-step=(?:"([^"]*)"|'([^']*)')/g)].map((m) => m[1] ?? m[2]);
      if (!marks.length) bad('图里没有标 data-step，翻页时图不会变');
      for (const v of marks) {
        const m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(v);
        if (!m) bad(`data-step「${v}」只能写成「2」或「2-3」`);
        else if (+m[1] < 1 || +m[1] > n || (m[2] != null && +m[2] < +m[1])) bad(`data-step「${v}」超出了 1 到 ${n} 页`);
      }
    } else list(b.steps).forEach((s, i) => svgOk(s?.svg, `第 ${i + 1} 步的 `));
  }
  if (k === 'tree' && !str(b.root?.name)) bad('root 要有 name');
  if (k === 'web') {
    if (!str(b.center?.name)) bad('center 要有 name');
    if (!list(b.links).length) bad('links 不能为空');
    for (const l of list(b.links)) if (!WREL.includes(l?.rel)) bad(`rel「${l?.rel}」只能是 ${WREL.join(' / ')}`);
    if (list(b.links).length > 10) bad('links 超过 10 个，画不下');
  }
  if (k === 'flow') {
    if (!list(b.steps).length) bad('steps 不能为空');
    const actors = new Set(list(b.actors).map((a) => a?.id));
    if (actors.size) for (const s of list(b.steps)) for (const f of ['from', 'to', 'at']) if (s?.[f] != null && !actors.has(s[f])) bad(`步骤「${s?.title}」的 ${f}「${s[f]}」不在 actors 里`);
  }
  if (k === 'compare') {
    const n = list(b.items).length;
    if (n < 2) bad('items 至少两样');
    for (const r of list(b.rows)) if (list(r?.values).length !== n) bad(`行「${r?.aspect}」的 values 数量要和 items 一样`);
  }
  if (k === 'cause' && list(b.chain).length < 2) bad('chain 至少两环');
  if (k === 'analogy' && (!list(b.pairs).length || !str(b.breaks))) bad('要有 pairs 和 breaks（哪里不像）');
  if (k === 'layers' && list(b.layers).length < 2) bad('layers 至少两层');
  if (k === 'instance' && !str(b.code) && !list(b.rows).length) bad('要有 code 或 rows');
  if (k === 'timeline' && !list(b.events).length) bad('events 不能为空');
  if (k === 'scale' && !list(b.items).every((it) => Number.isFinite(Number(it?.value)))) bad('items 的 value 要是数字');
  if (k === 'formula' && !str(b.tex)) bad('要有 tex');
}

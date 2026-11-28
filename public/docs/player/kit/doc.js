/* work-doc kit (#165). The page's own script sets DOC before this one runs.
   ?fill=r1:c1,… is what each line holds (absent: the version handed in); ?c=N lights line N. */
const q = new URLSearchParams(location.search);
const LIVE = q.has('fill');
const FILL = LIVE ? Object.fromEntries(q.get('fill').split(',').filter(Boolean).map(x => x.split(':').map(decodeURIComponent))) : Object.fromEntries(DOC.items.map(it => [it.slot, it.answer]));
const CUR = LIVE ? (DOC.items[Number(q.get('c') || 0)] || {}).slot : null;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
const svg = (tag, attrs, text) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
const cardOf = (slot) => FILL[slot] || null;
const textOf = (slot) => { const id = FILL[slot]; return id ? (DOC.cards[id] !== undefined ? DOC.cards[id] : id) : null; };
const isKuro = (slot) => (FILL[slot] || '').charAt(0) === 'k';
/* the advisers' mark: two rings, ticks between them, a point */
function ringMark() {
  const s = svg('svg', { viewBox: '0 0 40 40' });
  s.append(svg('circle', { cx: 20, cy: 20, r: 18, fill: 'none', stroke: '#23395D', 'stroke-width': 1.4 }), svg('circle', { cx: 20, cy: 20, r: 13, fill: 'none', stroke: '#A8842C', 'stroke-width': 1 }));
  for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; s.append(svg('line', { x1: 20 + 14.2 * Math.cos(a), y1: 20 + 14.2 * Math.sin(a), x2: 20 + 16.8 * Math.cos(a), y2: 20 + 16.8 * Math.sin(a), stroke: '#23395D', 'stroke-width': i % 6 === 0 ? 1.4 : .6 })); }
  s.append(svg('circle', { cx: 20, cy: 20, r: 1.6, fill: '#23395D' }));
  return s;
}
/* the Group's mark (和光: the light evened out): a disc, half of it dimmed */
function sunMark() {
  const s = svg('svg', { viewBox: '0 0 40 40' });
  s.append(svg('circle', { cx: 20, cy: 20, r: 17.5, fill: 'none', stroke: '#3A3F4B', 'stroke-width': 1 }), svg('circle', { cx: 20, cy: 20, r: 11, fill: '#3A3F4B' }), svg('path', { d: 'M20 9 A11 11 0 0 1 20 31 Z', fill: '#B9BCC4' }));
  return s;
}
function sheetOf() {
  document.title = DOC.title;
  if (DOC.skin) document.body.classList.add(DOC.skin);
  document.body.style.setProperty('--rot', String(DOC.rot || 0));
  const sheet = el('div', 'sheet');
  const lh = el('div', 'lh'); const org = el('div', 'org', DOC.head.org); org.append(el('small', '', DOC.head.sub));
  const code = el('div', 'code'); DOC.head.code.forEach((c) => code.append(el('div', '', c)));
  lh.append(DOC.head.mark === 'sun' ? sunMark() : ringMark(), org, code);
  const head = el('div', 'head'); head.append(el('h1', '', DOC.title), el('p', 'sub', DOC.sub));
  const meta = el('div', 'meta'); DOC.meta.forEach(([k, v]) => { const d = el('div'); d.append(el('b', '', k), document.createTextNode(v)); meta.append(d); });
  const body = el('div', 'body');
  const foot = el('div', 'foot'); foot.append(el('span', '', DOC.words.foot), el('span', '', DOC.words.page));
  sheet.append(lh, head, meta, body, foot);
  document.getElementById('doc').append(sheet);
  return body;
}
const h2 = (text, small) => { const h = el('h2', '', text); if (small) h.append(el('small', '', small)); return h; };
const rules = (list) => { const ul = el('ul', 'rules'); list.forEach((r) => ul.append(el('li', '', r))); return ul; };
const sign = (list) => { const d = el('div', 'sign'); list.forEach(([k, v]) => { const s = el('span', '', k); s.append(el('b', '', v)); d.append(s); }); return d; };

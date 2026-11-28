/* day 9: the seating of tomorrow's meeting: four seats on the circle, one in the triangle */
(() => {
  const body = sheetOf();
  body.append(h2(DOC.words.plan, DOC.words.planNote));
  const s = svg('svg', { viewBox: '0 0 680 330', class: 'plan' });
  const cx = 215, cy = 165, R = 118;
  s.append(svg('rect', { x: .5, y: .5, width: 679, height: 329, fill: '#F7F8FA', stroke: 'rgba(29,35,48,.14)' }));
  s.append(svg('circle', { cx, cy, r: R + 14, fill: '#fff', stroke: '#23395D', 'stroke-width': 1.2 }), svg('circle', { cx, cy, r: R, fill: 'none', stroke: '#A8842C', 'stroke-width': 1 }), svg('circle', { cx, cy, r: R - 34, fill: 'none', stroke: 'rgba(29,35,48,.14)', 'stroke-dasharray': '3 4' }));
  for (let i = 0; i < 72; i++) { const a = i * Math.PI / 36; s.append(svg('line', { x1: cx + (R + 2) * Math.cos(a), y1: cy + (R + 2) * Math.sin(a), x2: cx + (R + (i % 18 === 0 ? 12 : i % 6 === 0 ? 9 : 6)) * Math.cos(a), y2: cy + (R + (i % 18 === 0 ? 12 : i % 6 === 0 ? 9 : 6)) * Math.sin(a), stroke: '#23395D', 'stroke-width': .6 })); }
  s.append(svg('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#A3A8B3', 'letter-spacing': 3 }, DOC.words.circle));
  const tx = 548, ty = 172, T = 96;
  s.append(svg('polygon', { points: [[tx - T, ty + T * .62], [tx + T, ty + T * .62], [tx, ty - T * 1.1]].map((p) => p.join(',')).join(' '), fill: '#fff', stroke: '#23395D', 'stroke-width': 1.2 }));
  s.append(svg('line', { x1: cx + R + 16, y1: cy, x2: tx - T * .55, y2: cy, stroke: '#A3A8B3', 'stroke-dasharray': '2 4' }), svg('text', { x: (cx + R + 16 + tx - T * .55) / 2, y: cy - 7, 'text-anchor': 'middle', 'font-size': 10, fill: '#A3A8B3' }, DOC.words.gap));
  const at = { chair: [cx, cy - R], s1: [cx - R, cy], s2: [cx, cy + R], s3: [cx + R, cy], tri: [tx, ty + 14] };
  DOC.items.forEach((it) => {
    const [x, y] = at[it.seat]; const id = cardOf(it.slot); const cur = it.slot === CUR; const w = 104, h = 44;
    s.append(svg('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 4, fill: cur ? '#FFF3D6' : '#fff', stroke: cur ? '#C77700' : id ? '#23395D' : '#B5B9C2', 'stroke-width': cur ? 1.6 : 1, 'stroke-dasharray': id ? '' : '4 3' }));
    s.append(svg('text', { x, y: y - 6, 'text-anchor': 'middle', 'font-size': 10, fill: '#6A7180', 'letter-spacing': 1 }, it.label));
    s.append(svg('text', { x, y: y + 13, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 600, fill: id ? (isKuro(it.slot) ? '#3B3F8F' : '#1D2330') : '#B5B9C2' }, id ? DOC.names[id] : DOC.words.vacant));
  });
  body.append(s);
  body.append(h2(DOC.words.list));
  const t = el('table'); const hr = el('tr'); DOC.cols.forEach((c) => hr.append(el('th', '', c))); t.append(hr);
  DOC.items.forEach((it) => { const tr = el('tr'); const text = textOf(it.slot); const td = el('td', (text ? (isKuro(it.slot) ? 'kuro' : '') : 'empty') + (it.slot === CUR ? ' cur' : ''), text || DOC.words.empty); tr.append(el('td', '', it.label), td, el('td', 'off', it.note)); t.append(tr); });
  body.append(t, rules(DOC.rules), sign(DOC.sign));
})();

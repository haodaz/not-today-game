/* day 11: the cost sheet, weighed level */
(() => {
  const body = sheetOf(), W = DOC.words;
  body.append(h2(W.sheet, W.sheetNote));
  const two = el('div', 'two'), t = el('table', 'grid');
  const head = el('tr'); ['', 'A', 'B', 'C'].forEach((c) => head.append(el('th', 'col', c))); t.append(head);
  const names = el('tr'); ['1', ...DOC.cols].forEach((c, i) => names.append(el(i ? 'th' : 'td', i ? '' : 'no', c))); t.append(names);
  let wrong = 0, filled = 0;
  DOC.items.forEach((it, i) => {
    const id = cardOf(it.slot), text = textOf(it.slot);
    if (id) { filled++; if (id !== it.answer) wrong++; }
    const tr = el('tr', i === DOC.items.length - 1 ? 'total' : '');
    tr.append(el('td', 'no', String(i + 2)), el('td', 'name', it.row), el('td', (text ? (isKuro(it.slot) ? 'kuro' : '') : 'empty') + (it.slot === CUR ? ' cur' : ''), text || W.empty), el('td', 'off', it.note));
    t.append(tr);
  });
  // the scales: level only when every line is in and right
  const level = filled === DOC.items.length && wrong === 0, tilt = level ? 0 : filled === 0 ? 0 : wrong ? 9 : 4;
  const s = svg('svg', { viewBox: '0 0 210 170', class: 'scale' });
  s.append(svg('line', { x1: 105, y1: 30, x2: 105, y2: 150, stroke: '#3A3F4B', 'stroke-width': 3 }), svg('rect', { x: 70, y: 150, width: 70, height: 8, fill: '#3A3F4B' }));
  const beam = svg('g', { transform: 'rotate(' + tilt + ' 105 34)' });
  beam.append(svg('line', { x1: 25, y1: 34, x2: 185, y2: 34, stroke: '#8C6A2A', 'stroke-width': 3 }));
  [[25, W.pans[0]], [185, W.pans[1]]].forEach(([x, word]) => { beam.append(svg('line', { x1: x, y1: 34, x2: x - 18, y2: 84, stroke: '#6A7180' }), svg('line', { x1: x, y1: 34, x2: x + 18, y2: 84, stroke: '#6A7180' }), svg('path', { d: 'M' + (x - 22) + ' 84 Q' + x + ' 102 ' + (x + 22) + ' 84 Z', fill: '#E9E5D8', stroke: '#8C6A2A' }), svg('text', { x, y: 116, 'text-anchor': 'middle', 'font-size': 11, fill: '#6A7180' }, word)); });
  s.append(beam, svg('circle', { cx: 105, cy: 34, r: 4, fill: '#3A3F4B' }), svg('text', { x: 105, y: 20, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: level ? '#13A37A' : '#9C2318' }, filled === 0 ? '' : level ? W.level : W.off));
  two.append(t, s); body.append(two, rules(DOC.rules), sign(DOC.sign));
})();

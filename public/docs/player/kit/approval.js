/* day 13: a loan request and its chain of approvals */
(() => {
  const body = sheetOf(), W = DOC.words;
  body.append(h2(W.form, W.formNote));
  const f = el('div', 'form'); let filled = 0;
  DOC.items.forEach((it) => { const row = el('div', 'f'), text = textOf(it.slot); if (text) filled++; row.append(el('b', '', it.row), el('span', (text ? (isKuro(it.slot) ? 'kuro' : '') : 'empty') + (it.slot === CUR ? ' cur' : ''), text || W.empty)); f.append(row); });
  body.append(f, h2(W.chain));
  const done = filled === DOC.items.length, c = el('div', 'chain');
  DOC.chain.forEach(([role, name], i) => { const d = el('div'); d.append(el('b', '', role)); const last = i === DOC.chain.length - 1; d.append(el('span', 'stamp' + (done ? '' : ' none'), done ? (last ? W.passed : name) : (i === 0 ? name : W.waiting))); if (last && done) d.append(el('p', 'guide', W.nobody)); c.append(d); });
  body.append(c, rules(DOC.rules), sign(DOC.sign));
})();

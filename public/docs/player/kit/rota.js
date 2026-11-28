/* day 12: the week's watch rota: every night the same, nobody sleeps */
(() => {
  const body = sheetOf(), W = DOC.words;
  body.append(h2(W.grid, W.gridNote));
  const t = el('table', 'rota'), head = el('tr'); [W.slot, ...DOC.days].forEach((d) => head.append(el('th', '', d))); t.append(head);
  DOC.items.forEach((it) => {
    const id = cardOf(it.slot), short = id ? DOC.short[id] : '';
    const tr = el('tr', (it.slot === CUR ? 'cur ' : '') + (it.name && id === it.answer ? 'gone' : ''));
    tr.append(el('td', '', it.row));
    DOC.days.forEach(() => tr.append(el('td', id ? (isKuro(it.slot) ? 'kuro' : 'on') : 'empty', short || '·')));
    t.append(tr);
  });
  const sl = el('tr', 'sleep'); sl.append(el('td', '', W.sleep)); DOC.days.forEach(() => sl.append(el('td', '', '—'))); t.append(sl);
  body.append(t);
  DOC.items.forEach((it) => { const p = el('p', 'what'); p.append(el('b', '', it.row), el('span', textOf(it.slot) ? (isKuro(it.slot) ? 'kuro' : '') : 'empty', textOf(it.slot) || W.empty)); body.append(p); });
  body.append(rules(DOC.rules), sign(DOC.sign));
})();

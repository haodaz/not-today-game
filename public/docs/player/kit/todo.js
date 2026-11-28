/* day 18: the last list: five slips, each closed its own way */
(() => {
  const body = sheetOf(), W = DOC.words;
  body.append(h2(W.list, W.listNote));
  const slips = el('div', 'slips');
  DOC.items.forEach((it) => { const text = textOf(it.slot), row = el('div', 'slip' + (text ? ' done' : '') + (it.slot === CUR ? ' cur' : '')); row.append(el('div', 'box', text ? '✓' : ''), el('div', 't', it.row), el('span', 'stamp' + (text ? (isKuro(it.slot) ? ' kuro' : '') : ' none'), text || W.empty)); slips.append(row); });
  body.append(slips, rules(DOC.rules), sign(DOC.sign));
})();

/* day 14: the first batch of a thousand: who gets a desk, who gets a name */
(() => {
  const body = sheetOf(), W = DOC.words;
  body.append(h2(W.flow, W.flowNote));
  const flow = el('div', 'flow');
  DOC.items.forEach((it, i) => {
    if (i) flow.append(el('div', 'arrow'));
    const row = el('div', 'step2'), text = textOf(it.slot);
    row.append(el('div', 'n', String(i + 1)), el('div', 'who2', it.row), el('div', 'rule' + (text ? (isKuro(it.slot) ? ' kuro' : '') : ' empty') + (it.slot === CUR ? ' cur' : ''), text || W.empty));
    flow.append(row);
  });
  const count = el('div', 'count'); count.append(el('span', '', W.count), el('i'), el('span', '', W.total));
  body.append(flow, count, rules(DOC.rules), sign(DOC.sign));
})();

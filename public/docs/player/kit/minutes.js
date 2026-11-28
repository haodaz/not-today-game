/* day 7: the morning meeting's minutes, on the advisers' template */
(() => {
  const body = sheetOf();
  body.append(h2(DOC.roll.title, DOC.roll.note));
  const t = el('table'); const hr = el('tr'); DOC.roll.cols.forEach((c) => hr.append(el('th', '', c))); t.append(hr);
  DOC.roll.rows.forEach((r) => { const tr = el('tr'); r.forEach((c, i) => tr.append(el('td', (i === 2 ? 'num ' : '') + (r[3] === DOC.roll.offWord ? 'off' : ''), c))); t.append(tr); });
  body.append(t);
  body.append(h2(DOC.words.steps));
  DOC.items.forEach((it) => {
    const row = el('div', 'step'); const left = el('div'); left.append(el('div', 'name', it.step));
    const right = el('div'); right.append(el('p', 'guide', it.guide));
    const text = textOf(it.slot);
    const said = el('p', 'said' + (text ? (isKuro(it.slot) ? ' kuro' : '') : ' empty') + (it.slot === CUR ? ' cur' : ''));
    said.append(el('small', '', DOC.words.said), document.createTextNode(text || DOC.words.empty));
    right.append(said); row.append(left, right); body.append(row);
  });
  const end = DOC.end.values[cardOf(DOC.end.by) || ''] || DOC.end.values[''];
  body.append(sign([...DOC.sign, [DOC.end.label, end]]));
})();

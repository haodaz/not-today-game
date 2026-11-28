/* day 15: the launch deck: three slides and what the room did */
(() => {
  const body = sheetOf(), W = DOC.words;
  body.append(h2(W.deck, W.deckNote));
  const deck = el('div', 'deck');
  DOC.items.filter((it) => it.slide).forEach((it) => { const text = textOf(it.slot), s = el('div', 'slide' + (text ? (isKuro(it.slot) ? ' kuro' : '') : ' empty') + (it.slot === CUR ? ' cur' : '')); s.append(el('small', '', it.row), el('div', '', text || W.empty)); deck.append(s); });
  body.append(deck, h2(W.room));
  const f = el('div', 'form');
  DOC.items.filter((it) => !it.slide).forEach((it) => { const row = el('div', 'f'), text = textOf(it.slot); row.append(el('b', '', it.row), el('span', (text ? (isKuro(it.slot) ? 'kuro' : '') : 'empty') + (it.slot === CUR ? ' cur' : ''), text || W.empty)); f.append(row); });
  body.append(f, rules(DOC.rules), sign(DOC.sign));
})();

/* day 16: the briefing as a recording: opening, middle, ending, and the beat under them */
(() => {
  const body = sheetOf(), W = DOC.words;
  body.append(h2(W.reel, W.reelNote));
  const reel = el('div', 'reel'), track = el('div', 'track2');
  const clip = (it) => { const text = textOf(it.slot), c = el('div', 'clip' + (text ? (isKuro(it.slot) ? ' kuro' : '') : ' empty') + (it.slot === CUR ? ' cur' : '')); c.append(el('b', '', it.row), document.createTextNode(text || W.empty)); return c; };
  const by = Object.fromEntries(DOC.items.map((it) => [it.part, it]));
  track.append(clip(by.open), clip(by.mid), clip(by.end));
  reel.append(track);
  const beat = el('div', 'beat' + (by.beat.slot === CUR ? ' cur' : '')); beat.append(el('b', '', by.beat.row), el('i'), el('span', textOf(by.beat.slot) ? (isKuro(by.beat.slot) ? 'kuro' : '') : 'empty', textOf(by.beat.slot) || W.empty)); reel.append(beat);
  // no ending: the line goes back to the start
  if (cardOf(by.end.slot) === by.end.answer) { const s = svg('svg', { viewBox: '0 0 680 34', class: 'loop', preserveAspectRatio: 'none' }); s.append(svg('path', { d: 'M640 2 V20 H40 V6', fill: 'none', stroke: '#9C2318', 'stroke-width': 1.5 }), svg('path', { d: 'M34 10 L40 0 L46 10 Z', fill: '#9C2318' })); reel.append(s); }
  body.append(reel, rules(DOC.rules), sign(DOC.sign));
})();

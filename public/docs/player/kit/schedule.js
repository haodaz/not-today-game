/* day 8: the toast schedule, a day of hours with one bar a leader */
(() => {
  const body = sheetOf();
  body.append(h2(DOC.words.grid, DOC.words.gridNote));
  const A = DOC.axis, pct = (h) => ((h - A.from) / (A.to - A.from) * 100) + '%';
  const g = el('div', 'gantt');
  const ax = el('div', 'row axis'); const axt = el('div', 'track');
  A.ticks.forEach((h) => { const s = el('span', 'tick', String(h).padStart(2, '0') + ':00'); s.style.left = pct(h); axt.append(s); });
  ax.append(el('div', 'who', DOC.cols[0]), axt, el('div', 'note', DOC.cols[2])); g.append(ax);
  DOC.items.forEach((it) => {
    const row = el('div', 'row' + (it.slot === CUR ? ' cur' : ''));
    const who = el('div', 'who', it.label); who.append(el('small', '', it.rank));
    const track = el('div', 'track'); const id = cardOf(it.slot); const b = id ? DOC.bars[id] : null;
    if (b) {
      const share = b.from !== undefined ? (b.to - b.from) / (A.to - A.from) : 1;
      const narrow = share < .3;
      const bar = el('div', 'bar ' + (b.kind || '') + (isKuro(it.slot) ? ' kuro' : ''), narrow ? '' : b.tag);
      if (b.from !== undefined) { bar.style.left = pct(b.from); bar.style.width = 'calc(' + (share * 100) + '% - ' + (narrow ? 0 : 16) + 'px)'; }
      track.append(bar);
      if (narrow) { const tag = el('span', 'tag', b.tag); tag.style.left = 'calc(' + pct(b.to) + ' + 6px)'; track.append(tag); }
    }
    row.append(who, track, el('div', 'note' + (id ? (isKuro(it.slot) ? ' kuro' : '') : ' empty'), textOf(it.slot) || DOC.words.empty));
    g.append(row);
  });
  body.append(g, rules(DOC.rules), sign(DOC.sign));
})();

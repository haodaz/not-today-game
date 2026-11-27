// Plays the day-18 corridor for a recording (the replay driver's PAC_BOT=1): to a coffee, then after each of the four
// colleagues in turn while the coffee lasts (each one once), then the five lines. A breadth-first walk on the maze read
// from the game's own state; turns go in through the game's arrow buttons. Every swallow is logged with who it was, when,
// and where on the page (window.__pacLog), so a cut can find it. Evaluated in the page; returns at once, runs on a timer.
(() => {
  if (window.__pacbot) return 1;
  const turn = (d) => { const b = document.querySelector("[data-action=pacman-turn][data-dir=" + d + "]"); if (b) b.click(); };
  const WHO = ["boss", "partner", "xiaozhang", "laozhou"]; let was = {}; window.__pacLog = []; window.__pacDone = {};
  window.__pacbot = setInterval(() => {
    const g = window.__nt && window.__nt.session.pacman; if (!g || g.done || g.over || !g.running) { was = {}; return; }
    for (const h of g.ghosts) { if (h.eaten && !was[h.id] && !window.__pacDone[h.id]) { window.__pacDone[h.id] = true; const r = document.querySelector(".pm-you").getBoundingClientRect(); window.__pacLog.push({ at: Date.now(), who: WHO[h.id % 4], x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); } was[h.id] = h.eaten; }
    const C = g.cols, R = g.rows, id = (x, y) => y * C + x, cx = Math.round(g.you.x), cy = Math.round(g.you.y);
    const fear = !!document.querySelector(".pm-maze.fear"), live = g.ghosts.filter((h) => !h.eaten), want = live.filter((h) => !window.__pacDone[h.id]), hungry = Object.keys(window.__pacDone).length < g.ghosts.length;
    const danger = new Set(); if (!fear) for (const h of live) { const hx = Math.round(h.x), hy = Math.round(h.y); for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) danger.add(id(hx + dx, hy + dy)); }
    const goals = new Set(fear && want.length ? want.map((h) => id(Math.round(h.x), Math.round(h.y))) : !fear && hungry && g.powers.length ? g.powers : g.lines.filter((v) => v >= 0));
    if (!goals.size) return;
    const prev = new Map([[id(cx, cy), null]]), q = [[cx, cy]]; let hit = null;
    while (q.length) { const [x, y] = q.shift(); if (goals.has(id(x, y)) && !(x === cx && y === cy)) { hit = id(x, y); break; }
      for (const [d, dx, dy] of [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue; const k = id(nx, ny); if (g.walls[k] || prev.has(k) || (danger.has(k) && !goals.has(k))) continue; prev.set(k, [id(x, y), d]); q.push([nx, ny]); } }
    if (hit === null) return; let k = hit, d = null; while (prev.get(k)) { d = prev.get(k)[1]; k = prev.get(k)[0]; } if (d) turn(d);
  }, 70); return 2;
})()

// Plays the day-18 corridor for a recording (the replay driver's PAC_BOT=1): to a coffee, after the colleagues while the
// coffee lasts until four have been swallowed, then the five lines. A breadth-first walk on the maze read from the game's
// own state; turns go in through the game's arrow buttons. Evaluated in the page; returns at once, runs on a timer.
(() => {
  if (window.__pacbot) return 1;
  const turn = (d) => { const b = document.querySelector("[data-action=pacman-turn][data-dir=" + d + "]"); if (b) b.click(); };
  let seen = 0, last = 0, key = ""; window.__pacSwallows = 0;
  window.__pacbot = setInterval(() => {
    const g = window.__nt && window.__nt.session.pacman; if (!g || g.done || g.over || !g.running) return;
    if (g.seed !== key) { key = g.seed; seen = 0; }
    // the game's own count runs up every tick while one stands on a colleague's home: count a swallow once per 600 ms
    if (g.eatenGhosts > seen) { seen = g.eatenGhosts; const now = Date.now(); if (now - last > 600) { last = now; window.__pacSwallows++; } }
    const C = g.cols, R = g.rows, id = (x, y) => y * C + x, cx = Math.round(g.you.x), cy = Math.round(g.you.y);
    const fear = !!document.querySelector(".pm-maze.fear"), live = g.ghosts.filter((h) => !h.eaten), hungry = window.__pacSwallows < 4;
    const danger = new Set(); if (!fear) for (const h of live) { const hx = Math.round(h.x), hy = Math.round(h.y); for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) danger.add(id(hx + dx, hy + dy)); }
    const goals = new Set(fear && hungry && live.length ? live.map((h) => id(Math.round(h.x), Math.round(h.y))) : !fear && hungry && g.powers.length ? g.powers : g.lines.filter((v) => v >= 0));
    if (!goals.size) return;
    const prev = new Map([[id(cx, cy), null]]), q = [[cx, cy]]; let hit = null;
    while (q.length) { const [x, y] = q.shift(); if (goals.has(id(x, y)) && !(x === cx && y === cy)) { hit = id(x, y); break; }
      for (const [d, dx, dy] of [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue; const k = id(nx, ny); if (g.walls[k] || prev.has(k) || (danger.has(k) && !goals.has(k))) continue; prev.set(k, [id(x, y), d]); q.push([nx, ny]); } }
    if (hit === null) return; let k = hit, d = null; while (prev.get(k)) { d = prev.get(k)[1]; k = prev.get(k)[0]; } if (d) turn(d);
  }, 70); return 2;
})()
